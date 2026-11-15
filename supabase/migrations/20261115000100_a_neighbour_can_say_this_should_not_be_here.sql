-- ============================================================================
-- Compences · 1115.0100 · A neighbour can say this should not be here
-- ----------------------------------------------------------------------------
-- Residents write things other residents read: a marketplace listing, a review
-- of one, a comment under an event. Until now the only people who could do
-- anything about a bad one were staff and the committee, and only if they
-- happened to see it. A resident who found a listing for something that should
-- not be sold here, or a review written to settle a score, had a WhatsApp
-- group to complain in and nothing else. Both app stores ask for more than
-- that of any app where people post — Apple's guideline 1.2 names it: a way
-- to report, a way to block, and somebody who acts on reports promptly.
--
-- So, two things a resident can do:
--
--   content_reports  "this should not be here": about one listing, one review
--                    or one comment, with a reason from a short list and a few
--                    words if they want. It goes to the To do list of staff
--                    and the committee, who take the thing down or leave it up.
--
--   member_blocks    "I would rather not see this person": what the blocked
--                    person posts disappears for the one who blocked them, at
--                    once, and nobody else's view changes. The committee is
--                    told that it happened, because one neighbour blocking
--                    another is worth knowing about even with no report.
--
-- Three decisions that are not obvious from the tables:
--
-- Who reported is not shown to anybody in the society. The committee are
-- neighbours too, and "A-402 reported you" is how a moderation tool starts a
-- feud. The row keeps the reporter — to stop the same person reporting the
-- same thing twice, and so they can be told what was decided — but staff read
-- reports through reports_to_review(), which does not return it.
--
-- Nobody decides a report about what they posted themselves. The same rule
-- 0921.0200 set for money: it is somebody else's call, unless there is nobody
-- else, in which case hiding it would mean nobody ever sees it.
--
-- Hiding a blocked person's posts is done by the row policies, not by each
-- screen remembering to filter. A screen that forgets would show exactly what
-- the person asked not to see, and the website and the phone app each read
-- these tables in several places. The cost is that a committee member who
-- blocks somebody stops seeing that person's listings on the board like
-- anyone else would — so deciding a report goes through resolve_report(),
-- which checks the caller's role itself rather than relying on what the
-- caller can see.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Reports
-- ---------------------------------------------------------------------------

create table public.content_reports (
  id              uuid primary key default extensions.gen_random_uuid(),
  community_id    uuid not null references public.communities (id) on delete cascade,
  reporter_id     uuid not null references public.memberships (id) on delete cascade,
  -- Mirrors REPORT_SUBJECTS in packages/core/src/reports.ts.
  subject_kind    text not null,
  -- Exactly one of these when the report is filed. The first three empty
  -- themselves if the thing is deleted; the report stays, closed, with what it
  -- said in `excerpt`, so there is a record of what was reported and decided.
  listing_id      uuid references public.listings (id) on delete set null,
  review_id       uuid references public.listing_reviews (id) on delete set null,
  comment_id      uuid references public.comments (id) on delete set null,
  -- A person rather than a post: filed when somebody is blocked. It goes when
  -- the person does; there is nothing left for it to be about.
  member_id       uuid references public.memberships (id) on delete cascade,
  -- Filled in by the trigger from the thing itself, never taken from the form.
  author_id       uuid references public.memberships (id) on delete set null,
  excerpt         text,
  -- Mirrors REPORT_REASONS in packages/core/src/reports.ts, plus 'blocked',
  -- which only the block trigger may use.
  reason          text not null,
  details         text,
  status          text not null default 'open',
  resolved_by     uuid references public.memberships (id) on delete set null,
  resolved_at     timestamptz,
  resolution_note text,
  created_at      timestamptz not null default now(),
  constraint content_reports_kind_known
    check (subject_kind in ('listing', 'review', 'comment', 'member')),
  constraint content_reports_one_subject
    check (num_nonnulls(listing_id, review_id, comment_id, member_id) <= 1),
  constraint content_reports_reason_known
    check (reason in ('spam', 'offensive', 'harassment', 'scam', 'unsafe', 'other', 'blocked')),
  constraint content_reports_status_known
    check (status in ('open', 'actioned', 'dismissed')),
  constraint content_reports_details_length
    check (details is null or length(details) <= 500),
  constraint content_reports_note_length
    check (resolution_note is null or length(resolution_note) <= 500)
);

create index content_reports_queue_idx
  on public.content_reports (community_id, status, created_at);
-- One open report per person per thing. Ids are unique across the four tables,
-- so the kind does not need to be part of it.
create unique index content_reports_once_while_open
  on public.content_reports (reporter_id, (coalesce(listing_id, review_id, comment_id, member_id)))
  where status = 'open';
create index content_reports_listing_idx
  on public.content_reports (listing_id) where listing_id is not null;
create index content_reports_review_idx
  on public.content_reports (review_id) where review_id is not null;
create index content_reports_comment_idx
  on public.content_reports (comment_id) where comment_id is not null;
create index content_reports_member_idx
  on public.content_reports (member_id) where member_id is not null;
create index content_reports_author_idx
  on public.content_reports (author_id) where author_id is not null;

comment on table public.content_reports is
  'A resident saying a listing, a review or a comment should not be there, or '
  'that they blocked somebody. Staff and the committee read these through '
  'reports_to_review(), which leaves out who reported.';

-- What a reason reads as, for the To do list and the notification. The same
-- words as REPORT_REASON_LABEL in packages/core/src/reports.ts.
create or replace function app.report_reason_label(p_reason text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_reason
    when 'spam'       then 'Spam or advertising'
    when 'offensive'  then 'Offensive or hateful'
    when 'harassment' then 'Harassment or a personal attack'
    when 'scam'       then 'Misleading or a scam'
    when 'unsafe'     then 'Unsafe or not allowed'
    when 'blocked'    then 'Blocked by a neighbour'
    else 'Something else'
  end;
$$;

-- Runs with the reporter's own rights on purpose: it looks the thing up the
-- way the reporter would, so nobody can report — and so read the title of —
-- a listing they are not able to see.
create or replace function app.guard_content_report()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_community  uuid;
  v_author     uuid;
  v_excerpt    text;
  -- The block trigger files a report of its own. Inside it this trigger runs
  -- one level down, which is how it is told apart from a form.
  v_from_block boolean := pg_trigger_depth() > 1;
begin
  if new.reason = 'blocked' and not v_from_block then
    raise exception 'Pick a reason for the report';
  end if;
  if num_nonnulls(new.listing_id, new.review_id, new.comment_id, new.member_id) <> 1 then
    raise exception 'A report is about exactly one thing';
  end if;

  if new.subject_kind = 'listing' and new.listing_id is not null then
    select l.community_id, l.membership_id, l.title
      into v_community, v_author, v_excerpt
      from public.listings l where l.id = new.listing_id;
  elsif new.subject_kind = 'review' and new.review_id is not null then
    select r.community_id, r.membership_id,
           coalesce(nullif(btrim(r.body), ''), r.rating || ' out of 5 stars, with no words')
      into v_community, v_author, v_excerpt
      from public.listing_reviews r where r.id = new.review_id;
  elsif new.subject_kind = 'comment' and new.comment_id is not null then
    select c.community_id, c.membership_id, c.body
      into v_community, v_author, v_excerpt
      from public.comments c where c.id = new.comment_id;
  elsif new.subject_kind = 'member' and new.member_id is not null then
    select m.community_id, m.id, null::text
      into v_community, v_author, v_excerpt
      from public.memberships m where m.id = new.member_id;
  end if;

  if v_community is null or v_community is distinct from new.community_id then
    raise exception 'That is no longer there to report';
  end if;
  if v_author = new.reporter_id then
    raise exception 'You cannot report yourself or something you posted';
  end if;

  -- A report is cheap to file and costs a volunteer's evening to read.
  if not v_from_block
     and (select count(*) from public.content_reports r
           where r.reporter_id = new.reporter_id
             and r.created_at > now() - interval '1 day') >= 20 then
    raise exception 'That is a lot of reports for one day. Please speak to the committee.';
  end if;

  new.author_id := v_author;
  new.excerpt := left(v_excerpt, 280);
  new.details := nullif(btrim(coalesce(new.details, '')), '');
  new.status := 'open';
  new.resolved_by := null;
  new.resolved_at := null;
  new.resolution_note := null;
  new.created_at := now();
  return new;
end;
$$;

revoke execute on function app.guard_content_report() from public, anon;

create trigger content_reports_guard
  before insert on public.content_reports
  for each row execute function app.guard_content_report();

alter table public.content_reports enable row level security;

-- Your own, so a screen can say "you reported this" and what came of it.
-- Nobody else's: staff go through reports_to_review().
create policy content_reports_select_own
  on public.content_reports for select to authenticated
  using (reporter_id = app.my_membership_id(community_id));

-- Anybody in the society, staff included, in their own name. What it is about
-- and whether they may report it is the trigger's to decide.
create policy content_reports_insert_own
  on public.content_reports for insert to authenticated
  with check (
    app.is_member(community_id)
    and reporter_id = app.my_membership_id(community_id)
  );

-- No update and no delete: a report is decided by resolve_report().

-- Supabase grants everything on a new table to both client roles, so both
-- are cleared before the two things a client may do are given back.
revoke all on public.content_reports from anon, authenticated;
grant select, insert on public.content_reports to authenticated;
grant all on public.content_reports to service_role;

-- ---------------------------------------------------------------------------
-- Blocks
-- ---------------------------------------------------------------------------

create table public.member_blocks (
  id            uuid primary key default extensions.gen_random_uuid(),
  community_id  uuid not null references public.communities (id) on delete cascade,
  blocker_id    uuid not null references public.memberships (id) on delete cascade,
  blocked_id    uuid not null references public.memberships (id) on delete cascade,
  created_at    timestamptz not null default now(),
  constraint member_blocks_not_yourself check (blocker_id <> blocked_id),
  constraint member_blocks_once unique (blocker_id, blocked_id)
);

create index member_blocks_blocked_idx on public.member_blocks (blocked_id);

comment on table public.member_blocks is
  'One resident choosing not to see what another posts. Readable only by the '
  'one who blocked; the blocked person is not told.';

create or replace function app.guard_member_block()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.memberships m
     where m.id = new.blocked_id and m.community_id = new.community_id
  ) then
    raise exception 'That person is not in this society';
  end if;
  new.created_at := now();
  return new;
end;
$$;

revoke execute on function app.guard_member_block() from public, anon;

create trigger member_blocks_guard
  before insert on public.member_blocks
  for each row execute function app.guard_member_block();

-- The committee hears about a block, as a report about the person. Not a
-- second one if the blocker has already reported them or something of theirs
-- and that is still waiting: one neighbour's complaint is one item to read.
create or replace function app.report_block()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.content_reports (community_id, reporter_id, subject_kind, member_id, reason)
  select new.community_id, new.blocker_id, 'member', new.blocked_id, 'blocked'
   where not exists (
     select 1 from public.content_reports r
      where r.reporter_id = new.blocker_id
        and r.author_id = new.blocked_id
        and r.status = 'open'
   );
  return null;
end;
$$;

revoke execute on function app.report_block() from public, anon;

create trigger member_blocks_report
  after insert on public.member_blocks
  for each row execute function app.report_block();

alter table public.member_blocks enable row level security;

-- Only the one who blocked. Not the blocked person, and not staff: who has
-- stopped reading whom is nobody else's business.
create policy member_blocks_select_own
  on public.member_blocks for select to authenticated
  using (blocker_id = app.my_membership_id(community_id));

create policy member_blocks_insert_own
  on public.member_blocks for insert to authenticated
  with check (blocker_id = app.my_membership_id(community_id));

-- Unblocking is deleting the row. There is nothing to update.
create policy member_blocks_delete_own
  on public.member_blocks for delete to authenticated
  using (blocker_id = app.my_membership_id(community_id));

revoke all on public.member_blocks from anon, authenticated;
grant select, insert, delete on public.member_blocks to authenticated;
grant all on public.member_blocks to service_role;

-- ---------------------------------------------------------------------------
-- What a block hides
-- ---------------------------------------------------------------------------
-- Everybody the caller has blocked, in any of their societies, as one array.
-- The policies below ask for it inside a scalar subquery, so PostgreSQL works
-- it out once for the statement rather than once for every row it looks at.

create or replace function app.my_blocked_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(b.blocked_id), '{}'::uuid[])
    from public.member_blocks b
    join public.memberships m on m.id = b.blocker_id
   where m.user_id = (select auth.uid());
$$;

revoke execute on function app.my_blocked_ids() from public, anon;
grant execute on function app.my_blocked_ids() to authenticated, service_role;

-- Each of these is the policy as it was, with one line added at the end.

alter policy listings_select_member on public.listings
  using (
    app.is_member(community_id)
    and (
      status = 'active'
      or membership_id = app.my_membership_id(community_id)
      or app.is_staff(community_id)
    )
    and membership_id <> all ((select app.my_blocked_ids())::uuid[])
  );

alter policy listing_reviews_select_member on public.listing_reviews
  using (
    app.is_member(community_id)
    and exists (select 1 from public.listings l where l.id = listing_reviews.listing_id)
    and membership_id <> all ((select app.my_blocked_ids())::uuid[])
  );

alter policy comments_select_member on public.comments
  using (
    app.is_member(community_id)
    and membership_id <> all ((select app.my_blocked_ids())::uuid[])
  );

-- A notification would carry the blocked person's name and words straight
-- past all of that, so the two triggers that quote a resident leave out
-- anybody who has blocked the one being quoted. Only these two: a block is
-- about what a neighbour posts, and must not stop "your receipt was
-- confirmed" arriving because the person confirming it has been blocked.

create or replace function app.without_blockers_of(p_users uuid[], p_actor uuid)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select array_agg(u)
    from unnest(p_users) as u
   where not exists (
     select 1 from public.member_blocks b
       join public.memberships m on m.id = b.blocker_id
      where m.user_id = u and b.blocked_id = p_actor
   );
$$;

revoke execute on function app.without_blockers_of(uuid[], uuid) from public, anon;

-- As 0919.0100 wrote it, with the list of people passed through
-- without_blockers_of() before anybody is told.
create or replace function app.notify_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_subject text;
  v_slug    text;
  v_users   uuid[];
begin
  select coalesce(e.name, s.name, 'the society'),
         coalesce(e.slug, '')
    into v_subject, v_slug
    from (select 1) one
    left join public.events e on e.id = new.event_id
    left join public.activity_suggestions s on s.id = new.suggestion_id;

  select array_agg(distinct u) into v_users from (
    -- Whoever raised it.
    select e.created_by as u from public.events e where e.id = new.event_id
    union
    select m.user_id from public.activity_suggestions s
      join public.memberships m on m.id = s.suggested_by
     where s.id = new.suggestion_id
    union
    -- And whoever is already in the thread.
    select m.user_id from public.comments c
      join public.memberships m on m.id = c.membership_id
     where c.id <> new.id
       and c.event_id is not distinct from new.event_id
       and c.suggestion_id is not distinct from new.suggestion_id
  ) people;

  v_users := app.without_blockers_of(v_users, new.membership_id);

  if v_users is not null then
    perform app.notify(
      new.community_id,
      v_users,
      'comment',
      'New comment on ' || v_subject,
      left(new.body, 200),
      jsonb_build_object(
        'comment_id', new.id,
        'event_id', new.event_id,
        'event_slug', nullif(v_slug, ''),
        'suggestion_id', new.suggestion_id
      )
    );
  end if;
  return null;
end;
$$;

-- As 1103.0100 wrote it, unless the seller has blocked the reviewer.
create or replace function app.notify_listing_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title  text;
  v_seller uuid;
  v_name   text;
  v_users  uuid[];
begin
  select l.title, m.user_id into v_title, v_seller
    from public.listings l
    join public.memberships m on m.id = l.membership_id
   where l.id = new.listing_id;

  select coalesce(nullif(btrim(p.full_name), ''), 'A neighbour') into v_name
    from public.memberships m
    join public.profiles p on p.id = m.user_id
   where m.id = new.membership_id;

  v_users := app.without_blockers_of(array[v_seller], new.membership_id);
  if v_users is null then
    return null;
  end if;

  perform app.notify(
    new.community_id,
    v_users,
    'listing_review',
    repeat('★', new.rating) || repeat('☆', 5 - new.rating) || ' for ' || v_title,
    coalesce(v_name, 'A neighbour') || coalesce(': ' || nullif(btrim(new.body), ''), ' left a rating.'),
    jsonb_build_object('screen', 'listing', 'listing_id', new.listing_id)
  );
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Telling staff and the committee
-- ---------------------------------------------------------------------------
-- Once per thing, not once per report: the fifth neighbour to report the same
-- listing adds to the count on the To do list and wakes nobody. And not the
-- person it is about, when they are staff or committee themselves — unless
-- nobody else is.

create or replace function app.notify_content_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_subject     uuid := coalesce(new.listing_id, new.review_id, new.comment_id, new.member_id);
  v_author_user uuid;
  v_name        text;
  v_users       uuid[];
begin
  if exists (
    select 1 from public.content_reports r
     where r.id <> new.id
       and r.status = 'open'
       and coalesce(r.listing_id, r.review_id, r.comment_id, r.member_id) = v_subject
  ) then
    return null;
  end if;

  select m.user_id, coalesce(nullif(btrim(p.full_name), ''), 'A resident')
    into v_author_user, v_name
    from public.memberships m
    left join public.profiles p on p.id = m.user_id
   where m.id = new.author_id;

  select array_agg(u) into v_users
    from app.member_user_ids(new.community_id,
                             array['staff', 'committee']::public.member_role[]) as u
   where u is distinct from v_author_user;
  if v_users is null then
    select array_agg(u) into v_users
      from app.member_user_ids(new.community_id,
                               array['staff', 'committee']::public.member_role[]) as u;
  end if;

  perform app.notify(
    new.community_id,
    v_users,
    'content_report',
    case new.subject_kind
      when 'listing' then 'A neighbour reported a listing'
      when 'review'  then 'A neighbour reported a review'
      when 'comment' then 'A neighbour reported a comment'
      else coalesce(v_name, 'A resident') || ' was blocked by a neighbour'
    end,
    case
      when new.subject_kind = 'member'
        then 'No report came with it. It is on your To do list so you know.'
      else concat_ws(' · ', app.report_reason_label(new.reason), nullif(left(new.excerpt, 120), ''))
    end,
    jsonb_build_object('screen', 'reports', 'report_id', new.id)
  );
  return null;
end;
$$;

revoke execute on function app.notify_content_report() from public, anon;

create trigger content_reports_notify
  after insert on public.content_reports
  for each row execute function app.notify_content_report();

-- ---------------------------------------------------------------------------
-- Closing reports
-- ---------------------------------------------------------------------------
-- Every open report about one thing, closed the same way: a decision about a
-- listing is a decision about all five reports of it. Whoever reported is told
-- what came of it when p_tell says so — except for a block, which asked no
-- question and is owed no answer.

create or replace function app.close_reports(
  p_subject uuid,
  p_status  text,
  p_note    text,
  p_by      uuid,
  p_tell    boolean
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row   record;
  v_count integer := 0;
begin
  if p_subject is null then
    return 0;
  end if;
  for v_row in
    update public.content_reports r
       set status = p_status,
           resolved_by = p_by,
           resolved_at = now(),
           resolution_note = left(nullif(btrim(coalesce(p_note, '')), ''), 500)
     where r.status = 'open'
       and p_subject in (r.listing_id, r.review_id, r.comment_id, r.member_id)
    returning r.community_id, r.reporter_id, r.reason
  loop
    v_count := v_count + 1;
    if p_tell and v_row.reason <> 'blocked' then
      perform app.notify(
        v_row.community_id,
        array(select m.user_id from public.memberships m where m.id = v_row.reporter_id),
        'report_resolved',
        case when p_status = 'actioned' then 'Thank you for your report'
             else 'Your report was looked at' end,
        case when p_status = 'actioned'
             then 'The committee has taken down what you reported.'
             else 'The committee looked at it and decided it can stay. '
                  || 'You can block the person if you would rather not see what they post.'
        end,
        '{}'::jsonb
      );
    end if;
  end loop;
  return v_count;
end;
$$;

revoke execute on function app.close_reports(uuid, text, text, uuid, boolean) from public, anon;

-- A listing taken down from its own page, rather than from a report, settles
-- the reports about it just the same.
create or replace function app.reports_follow_takedown()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'removed' and old.status is distinct from 'removed' then
    perform app.close_reports(new.id, 'actioned', new.removed_reason, new.removed_by, true);
  end if;
  return null;
end;
$$;

revoke execute on function app.reports_follow_takedown() from public, anon;

create trigger listings_reports_follow_takedown
  after update of status on public.listings
  for each row execute function app.reports_follow_takedown();

-- Something deleted — by whoever wrote it, by staff from its own page, or
-- along with an account or a whole society — has nothing left to decide. This
-- only ever updates report rows. It sends nothing: it also runs inside the
-- cascade when a society is deleted, where a notification would be a row
-- pointing at a society that is already gone.
create or replace function app.reports_close_on_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.close_reports(old.id, 'actioned',
                            'It was deleted before the committee decided.', null, false);
  return old;
end;
$$;

revoke execute on function app.reports_close_on_delete() from public, anon;

create trigger listings_reports_close_on_delete
  before delete on public.listings
  for each row execute function app.reports_close_on_delete();

create trigger listing_reviews_reports_close_on_delete
  before delete on public.listing_reviews
  for each row execute function app.reports_close_on_delete();

create trigger comments_reports_close_on_delete
  before delete on public.comments
  for each row execute function app.reports_close_on_delete();

-- ---------------------------------------------------------------------------
-- What staff and the committee read
-- ---------------------------------------------------------------------------
-- One row per thing reported, however many neighbours reported it, oldest
-- first. No reporter. `id` is the earliest open report and is what
-- resolve_report() is given.

create or replace function public.reports_to_review(p_community_id uuid)
returns table (
  id           uuid,
  subject_kind text,
  listing_id   uuid,
  review_id    uuid,
  comment_id   uuid,
  member_id    uuid,
  event_slug   text,
  author_name  text,
  excerpt      text,
  reasons      text[],
  details      text[],
  report_count integer,
  created_at   timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select app.is_staff(p_community_id) as staff,
           app.my_membership_id(p_community_id) as membership,
           app.sole_committee_member(p_community_id) as alone
  ),
  waiting as (
    select r.*,
           coalesce(r.listing_id, r.review_id, r.comment_id, r.member_id) as subject
      from public.content_reports r, me
     where me.staff
       and r.community_id = p_community_id
       and r.status = 'open'
       -- Not a report about what the caller posted: somebody else decides.
       and (me.alone or r.author_id is distinct from me.membership)
  ),
  grouped as (
    select w.subject,
           (array_agg(w.id order by w.created_at, w.id))[1] as first_id,
           min(w.created_at) as first_at,
           count(*)::integer as report_count,
           array_agg(distinct w.reason) as reasons,
           (array_agg(w.details order by w.created_at) filter (where w.details is not null))[1:5]
             as details
      from waiting w
     where w.subject is not null
     group by w.subject
  )
  select g.first_id,
         w.subject_kind,
         -- A review's listing too, so the screen can link to where it is.
         coalesce(w.listing_id, rv.listing_id),
         w.review_id,
         w.comment_id,
         w.member_id,
         e.slug,
         coalesce(nullif(btrim(p.full_name), ''), 'A resident'),
         w.excerpt,
         g.reasons,
         coalesce(g.details, '{}'::text[]),
         g.report_count,
         g.first_at
    from grouped g
    join waiting w on w.id = g.first_id
    left join public.listing_reviews rv on rv.id = w.review_id
    left join public.comments c on c.id = w.comment_id
    left join public.events e on e.id = c.event_id
    left join public.memberships m on m.id = w.author_id
    left join public.profiles p on p.id = m.user_id
   order by g.first_at;
$$;

revoke all on function public.reports_to_review(uuid) from public;
revoke all on function public.reports_to_review(uuid) from anon;
grant execute on function public.reports_to_review(uuid) to authenticated, service_role;

comment on function public.reports_to_review(uuid) is
  'What residents have reported and nobody has decided yet, one row per thing '
  'reported. For staff and the committee only; returns nothing to anyone else, '
  'never says who reported, and leaves out reports about the caller''s own posts.';

-- ---------------------------------------------------------------------------
-- Deciding one
-- ---------------------------------------------------------------------------
-- p_remove true: the listing comes off the board, the review or comment is
-- deleted, and whoever wrote it is told, with the note as the reason. For a
-- block there is nothing to take down, and it only marks it as seen to.
-- p_remove false: it stays, and the reports are closed.

create or replace function public.resolve_report(
  p_report_id uuid,
  p_remove    boolean,
  p_note      text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row     public.content_reports;
  v_me      uuid;
  v_subject uuid;
  v_note    text := left(nullif(btrim(coalesce(p_note, '')), ''), 500);
  v_author  uuid;
  v_slug    text;
  v_listing uuid;
begin
  select * into v_row from public.content_reports r
   where r.id = p_report_id for update;
  if v_row.id is null then return 'no_report'; end if;

  -- Asked here, of the report's own society, because this function can reach
  -- rows the caller cannot.
  if not app.is_staff(v_row.community_id) then return 'not_staff'; end if;
  if v_row.status <> 'open' then return 'already_resolved'; end if;

  v_me := app.my_membership_id(v_row.community_id);
  if v_row.author_id is not distinct from v_me
     and not app.sole_committee_member(v_row.community_id) then
    return 'own_content';
  end if;

  v_subject := coalesce(v_row.listing_id, v_row.review_id, v_row.comment_id, v_row.member_id);
  if v_subject is null then return 'already_resolved'; end if;

  if not p_remove then
    perform app.close_reports(v_subject, 'dismissed', v_note, v_me, true);
    return 'ok';
  end if;

  -- The reports first, so they carry who decided and why. The delete below
  -- would otherwise close them itself, as "deleted before anybody decided".
  perform app.close_reports(v_subject, 'actioned', v_note, v_me, true);

  select m.user_id into v_author
    from public.memberships m where m.id = v_row.author_id;

  if v_row.subject_kind = 'listing' then
    -- The seller is told by the trigger on listings, as for any take-down.
    update public.listings l
       set status = 'removed',
           removed_reason = coalesce(
             v_note,
             'Neighbours reported it, and the committee agreed it should not be on the marketplace.')
     where l.id = v_row.listing_id and l.status <> 'removed';

  elsif v_row.subject_kind = 'review' then
    select r.listing_id into v_listing
      from public.listing_reviews r where r.id = v_row.review_id;
    delete from public.listing_reviews r where r.id = v_row.review_id;
    perform app.notify(
      v_row.community_id, array[v_author], 'content_removed',
      'Your review was removed',
      coalesce(v_note, 'A neighbour reported it, and the committee agreed it should not stay up.'),
      jsonb_build_object('screen', 'listing', 'listing_id', v_listing)
    );

  elsif v_row.subject_kind = 'comment' then
    select e.slug into v_slug
      from public.comments c
      left join public.events e on e.id = c.event_id
     where c.id = v_row.comment_id;
    delete from public.comments c where c.id = v_row.comment_id;
    perform app.notify(
      v_row.community_id, array[v_author], 'content_removed',
      'Your comment was removed',
      coalesce(v_note, 'A neighbour reported it, and the committee agreed it should not stay up.'),
      jsonb_build_object('screen', 'event', 'event_slug', v_slug)
    );
  end if;

  return 'ok';
end;
$$;

revoke all on function public.resolve_report(uuid, boolean, text) from public;
revoke all on function public.resolve_report(uuid, boolean, text) from anon;
grant execute on function public.resolve_report(uuid, boolean, text)
  to authenticated, service_role;

comment on function public.resolve_report(uuid, boolean, text) is
  'Staff or the committee decide a report: take the thing down (and tell '
  'whoever posted it why) or leave it up. Closes every open report about the '
  'same thing and tells the people who reported. Returns ok, no_report, '
  'not_staff, already_resolved or own_content.';

-- ---------------------------------------------------------------------------
-- On the To do list
-- ---------------------------------------------------------------------------
-- todo_items() as 0930.0100 left it, with one more kind at the end. An app
-- built before this one drops a kind it does not know, so the phones already
-- out there keep showing the list they always did.

create or replace function public.todo_items(p_community_id uuid)
returns table (
  kind        text,
  id          uuid,
  title       text,
  subtitle    text,
  amount      numeric,
  event_slug  text,
  event_name  text,
  created_at  timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  with me as (
    select app.is_staff(p_community_id) as staff,
           app.is_committee(p_community_id) as committee,
           app.my_membership_id(p_community_id) as membership,
           app.sole_committee_member(p_community_id) as alone
  )
  select * from (
    -- Join requests
    select 'join_request'::text, r.id, r.claimed_name,
           coalesce('Flat ' || app.flat_label(r.unit_id), 'Works for the society'),
           null::numeric, null::text, null::text, r.created_at
      from public.join_requests r, me
     where me.staff and r.community_id = p_community_id and r.status = 'pending'

    union all
    -- UPI payments residents reported (not the confirmer's own)
    select 'payment_to_confirm', c.id,
           coalesce(p.full_name, 'Flat ' || app.flat_label(c.unit_id), 'A resident'),
           concat_ws(' · ', 'Flat ' || app.flat_label(c.unit_id), 'Ref ' || c.reference),
           c.amount, e.slug, e.name, c.created_at
      from public.contributions c
      join public.events e on e.id = c.event_id
      left join public.memberships m on m.id = c.membership_id
      left join public.profiles p on p.id = m.user_id
      cross join me
     where me.staff and c.community_id = p_community_id and c.status = 'pending'
       and (me.alone or c.membership_id is distinct from me.membership)

    union all
    -- Bills waiting for the committee (not the ones the approver wrote), and
    -- a warning, before the decision, when approving one would take the event
    -- past what it collected.
    select 'bill_to_approve', x.id, x.name,
           concat_ws(' · ', x.category, x.vendor,
             case when app.event_surplus(x.event_id) < x.amount
                  then 'takes the event ' || app.money(x.amount - app.event_surplus(x.event_id))
                       || ' over what it collected'
             end),
           x.amount, e.slug, e.name, x.created_at
      from public.expenses x
      join public.events e on e.id = x.event_id
      cross join me
     where me.committee and x.community_id = p_community_id and x.status = 'pending'
       and (me.alone
            or coalesce(x.revised_by, x.requested_by) is distinct from me.membership)

    union all
    -- The caller's own bills that were sent back for changes
    select 'bill_sent_back', x.id, x.name,
           coalesce(x.review_note, 'Sent back for changes'),
           x.amount, e.slug, e.name, x.updated_at
      from public.expenses x
      join public.events e on e.id = x.event_id
      cross join me
     where me.staff and x.community_id = p_community_id and x.status = 'changes_requested'
       and x.requested_by = me.membership

    union all
    -- Campaigns residents proposed
    select 'campaign_to_review', e.id, e.name,
           'Target ' || app.money(e.fund_target),
           e.fund_target, e.slug, e.name, e.created_at
      from public.events e, me
     where me.committee and e.community_id = p_community_id and e.status = 'proposed'

    union all
    -- New suggestions
    select 'suggestion_to_review', s.id, s.name,
           initcap(s.kind) || coalesce(' · ' || e.name, ''),
           null::numeric, e.slug, e.name, s.created_at
      from public.activity_suggestions s
      left join public.events e on e.id = s.event_id
      cross join me
     where me.committee and s.community_id = p_community_id and s.status = 'new'

    union all
    -- Residents who say they have moved
    select 'flat_change', r.id,
           coalesce(p.full_name, 'A resident'),
           concat_ws(' · ',
             coalesce('Now at ' || app.flat_label(r.unit_id), 'No longer in a flat'),
             'was ' || app.flat_label(o.unit_id),
             r.note),
           null::numeric, null::text, null::text, r.created_at
      from public.unit_change_requests r
      join public.memberships m on m.id = r.membership_id
      left join public.profiles p on p.id = m.user_id
      left join public.unit_occupants o
             on o.membership_id = r.membership_id and o.moved_out_on is null
      cross join me
     where me.committee and r.community_id = p_community_id and r.status = 'pending'

    union all
    -- Events that spent more than they collected: somebody paid the difference
    -- and is owed it. The amount is what is still owed.
    select 'overspent', e.id, e.name,
           concat_ws(' · ',
             'Paid by ' || app.bill_payer(last_bill.paid_by, last_bill.requested_by),
             'society balance ' || app.money(app.society_pool(p_community_id))),
           -app.event_surplus(e.id), e.slug, e.name,
           coalesce(last_bill.approved_at, e.created_at)
      from public.events e
      cross join me
      left join lateral (
        select x.paid_by, x.requested_by, x.approved_at
          from public.expenses x
         where x.event_id = e.id and x.status = 'approved'
         order by x.approved_at desc nulls last
         limit 1
      ) last_bill on true
     where me.committee and e.community_id = p_community_id
       and e.status <> 'cancelled'
       and app.event_surplus(e.id) < 0

    union all
    -- What neighbours have reported, once per thing however many reported it.
    -- reports_to_review() decides who sees which: staff and the committee,
    -- and nobody a report about something they posted themselves.
    select 'report_to_review', r.id,
           case r.subject_kind
             when 'listing' then 'Listing: ' || coalesce(r.excerpt, 'no longer there')
             when 'review'  then 'Review by ' || r.author_name
             when 'comment' then 'Comment by ' || r.author_name
             else 'Resident: ' || r.author_name
           end,
           concat_ws(' · ',
             (select string_agg(app.report_reason_label(x), ', ' order by x)
                from unnest(r.reasons) as x),
             case when r.subject_kind in ('review', 'comment')
                  then '“' || left(r.excerpt, 80) || '”' end,
             case when r.report_count > 1 then r.report_count || ' neighbours' end),
           null::numeric, null::text, null::text, r.created_at
      from public.reports_to_review(p_community_id) r
  ) items (kind, id, title, subtitle, amount, event_slug, event_name, created_at)
  order by created_at desc
  limit 200;
$$;

revoke all on function public.todo_items(uuid) from public;
revoke all on function public.todo_items(uuid) from anon;
grant execute on function public.todo_items(uuid) to authenticated, service_role;

-- app.report_reason_label() is called from todo_items(), which runs with the
-- caller's rights.
revoke execute on function app.report_reason_label(text) from public, anon;
grant execute on function app.report_reason_label(text) to authenticated, service_role;
