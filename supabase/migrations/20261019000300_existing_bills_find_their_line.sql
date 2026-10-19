-- ============================================================================
-- Bills filed before budget lines named them find their line
-- ----------------------------------------------------------------------------
-- The event's accounts used to match a bill to a budget line by category name.
-- They now go by expenses.budget_line_id, so a bill filed before that column
-- existed would drop out of its line and read as "not in the budget". Link
-- each one to the line of its own event with the same category — only where
-- there is exactly one, so nothing is guessed. Everything else stays unlinked
-- and shows as it did: spending with no line behind it.
--
-- Only budget_line_id changes, which none of the guards on a decided bill
-- watch: an approved bill stays approved and nobody is notified.
-- ============================================================================

update public.expenses e
   set budget_line_id = b.id
  from public.budget_lines b
 where e.budget_line_id is null
   and e.category is not null
   and b.event_id = e.event_id
   and lower(btrim(b.category)) = lower(btrim(e.category))
   and (select count(*)
          from public.budget_lines o
         where o.event_id = e.event_id
           and lower(btrim(o.category)) = lower(btrim(e.category))) = 1;
