-- ============================================================================
-- A bill is paid out of a budget line
-- ----------------------------------------------------------------------------
-- A budget line is now Type + Vendor + Amount, and a bill names the line it is
-- paid from. What is left of a line is derived from the approved bills against
-- it rather than stored, so a bill that is later rejected, revised or removed
-- puts the line right without anything having to remember to.
--
-- The society no longer ships a list of categories. Types and vendors are
-- whatever its committees have typed, offered back as suggestions.
-- ============================================================================

alter table public.budget_lines
  add column vendor    text,
  add column vendor_id uuid references public.catalogue_items (id) on delete set null,
  add constraint budget_lines_vendor_length check (vendor is null or length(vendor) <= 80);

alter table public.expenses
  add column budget_line_id uuid references public.budget_lines (id) on delete set null;

create index expenses_budget_line_idx
  on public.expenses (budget_line_id) where budget_line_id is not null;

comment on column public.expenses.budget_line_id is
  'The budget line this bill is paid out of. Null for a bill with no line '
  'behind it, which the event''s accounts show as not in the budget.';

-- A bill can only draw on a line of its own event.
create or replace function app.expense_line_is_same_event()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.budget_line_id is not null and not exists (
    select 1 from public.budget_lines b
     where b.id = new.budget_line_id and b.event_id = new.event_id
  ) then
    raise exception 'That budget line belongs to another event'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger expenses_line_is_same_event
  before insert or update of budget_line_id, event_id on public.expenses
  for each row execute function app.expense_line_is_same_event();

-- What each line has left. `approved` is what has been signed off and is what
-- the remaining amount is taken from; `pending` is shown beside it so nobody
-- is surprised when a bill already waiting is approved. A security-invoker
-- view: a resident reads the same rows they can read in the ledger, so for
-- them `pending` is always 0.
create or replace view public.budget_line_balances
with (security_invoker = true) as
select b.id,
       b.event_id,
       b.community_id,
       b.category,
       b.vendor,
       b.amount as planned,
       coalesce(sum(e.amount) filter (where e.status = 'approved'), 0)::numeric(12, 2) as approved,
       coalesce(sum(e.amount) filter (where e.status in ('pending', 'changes_requested')), 0)::numeric(12, 2) as pending,
       (b.amount - coalesce(sum(e.amount) filter (where e.status = 'approved'), 0))::numeric(12, 2) as remaining,
       b.position
  from public.budget_lines b
  left join public.expenses e on e.budget_line_id = b.id
 group by b.id;

grant select on public.budget_line_balances to authenticated;

-- No predefined categories. Drop the ones that were seeded and never used; any
-- a committee has actually budgeted or billed against stay, because the
-- ledger names them.
create or replace function app.seed_default_catalogue(p_community uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.catalogue_items (community_id, kind, label, emoji, position)
  select p_community, v.kind, v.label, v.emoji, v.position
    from (values
      ('event_type', 'Festival', '🪔', 0),
      ('event_type', 'Cultural evening', '🎭', 1),
      ('event_type', 'Sports', '🏏', 2),
      ('event_type', 'Social gathering', '🎉', 3),
      ('event_type', 'Community service', '🤝', 4),
      ('event_type', 'Workshop', '🧑‍🏫', 5),

      ('venue', 'Clubhouse', '🏠', 0),
      ('venue', 'Party hall', '🎊', 1),
      ('venue', 'Amphitheatre', '🎭', 2),
      ('venue', 'Central lawn', '🌳', 3),
      ('venue', 'Swimming pool deck', '🏊', 4),
      ('venue', 'Terrace', '🌇', 5),
      ('venue', 'Sports court', '🏸', 6),

      ('activity_type', 'Dance', '💃', 0),
      ('activity_type', 'Singing', '🎤', 1),
      ('activity_type', 'Drama / skit', '🎭', 2),
      ('activity_type', 'Kids performance', '🧒', 3),
      ('activity_type', 'Rangoli', '🎨', 4),
      ('activity_type', 'Quiz', '🧠', 5),
      ('activity_type', 'Sports', '🏅', 6),
      ('activity_type', 'Cooking contest', '🍳', 7),
      ('activity_type', 'Workshop', '🧑‍🏫', 8)
    ) as v(kind, label, emoji, position)
  on conflict do nothing;
$$;

delete from public.catalogue_items c
 where c.kind = 'budget_category'
   and not exists (select 1 from public.budget_lines b where b.category_id = c.id)
   and not exists (select 1 from public.expenses e where e.category_id = c.id);
