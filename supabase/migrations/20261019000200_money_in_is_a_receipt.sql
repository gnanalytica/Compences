-- Money in is a receipt; "payment" is money out.
--
-- The society RECEIVES money from residents (public.contributions, ledger rows
-- of kind 'payment') and PAYS bills. What the database says to people now
-- follows that. Only prose changes: table, enum, column, bucket and function
-- names, notification `type` values, the 'payment_to_confirm' todo kind and the
-- ledger kind 'payment' are identifiers clients depend on, and stay as they are.
-- Each function is its latest definition with only the wording changed;
-- same-signature replacement keeps the ACLs.

create or replace function public.review_contribution(
  p_contribution_id uuid,
  p_confirm         boolean,
  p_note            text default null,
  p_reference       text default null,
  p_amount          numeric default null
)
returns public.contributions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.contributions;
  v_ref text := nullif(btrim(coalesce(p_reference, '')), '');
  v_actor uuid;
  v_amount numeric(12, 2);
begin
  select * into v_row from public.contributions c where c.id = p_contribution_id for update;
  if v_row.id is null then
    raise exception 'No such receipt' using errcode = 'P0002';
  end if;

  if not app.is_staff(v_row.community_id) then
    raise exception 'Only staff or the committee can confirm receipts'
      using errcode = '42501';
  end if;

  if v_row.status <> 'pending' then
    raise exception 'This receipt has already been reviewed'
      using errcode = '22023';
  end if;

  if not p_confirm and coalesce(btrim(p_note), '') = '' then
    raise exception 'Say why the receipt could not be confirmed'
      using errcode = '22023';
  end if;

  v_actor := app.my_membership_id(v_row.community_id);

  -- The hole this closes: reporting your own receipt and confirming it in the
  -- next tap. A staff member's own payment is somebody else's to confirm too —
  -- the hatch is about there being nobody else, not about rank.
  if v_row.membership_id is not null and v_row.membership_id = v_actor
     and not app.sole_committee_member(v_row.community_id) then
    raise exception 'You cannot confirm your own receipt; another committee member must'
      using errcode = '42501';
  end if;

  v_amount := v_row.amount;

  if p_confirm and p_amount is not null and p_amount <> v_row.amount then
    -- Staff confirm what the statement shows; rewriting what it shows is a
    -- ledger correction, which is the committee's to make. Staff who find a
    -- mismatch turn the receipt down with a note, as before.
    if not app.is_committee(v_row.community_id) then
      raise exception 'Only the committee can correct the amount of a receipt'
        using errcode = '42501';
    end if;
    if p_amount <= 0 then
      raise exception 'A corrected amount must be more than zero'
        using errcode = '22023';
    end if;
    v_amount := p_amount;
  end if;

  update public.contributions
     set status = case when p_confirm then 'succeeded' else 'failed' end::public.contribution_status,
         amount = v_amount,
         -- Kept the moment the payer's figure stops being the society's. A
         -- second correction keeps the payer's original, not the first
         -- correction: what a resident wants to see is what they typed.
         reported_amount = case
           when v_amount <> v_row.amount then coalesce(v_row.reported_amount, v_row.amount)
           else v_row.reported_amount
         end,
         -- The reference staff read off the screenshot, or off the statement.
         -- It overwrites what the resident typed rather than deferring to it:
         -- the person confirming is looking at the evidence and at the bank,
         -- and a mistyped digit that can never be corrected is worse than a
         -- correction the audit trail records. Leaving it out changes nothing,
         -- so confirming without one is still a one-tap act.
         reference = coalesce(v_ref, v_row.reference),
         verified_by = v_actor,
         verified_at = now(),
         review_note = p_note
   where id = p_contribution_id
   returning * into v_row;

  return v_row;
end;
$$;

comment on function public.review_contribution(uuid, boolean, text, text, numeric) is
  'Staff confirm or turn down a reported receipt, optionally recording the UPI '
  'reference read off the resident''s screenshot. The committee can also '
  'correct the amount to what the bank actually shows; the payer''s figure is '
  'kept in reported_amount. Confirming is what makes a receipt count.';

create or replace function app.notify_contribution()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events;
  v_payer uuid;
  v_corrected boolean := new.reported_amount is not null
                         and new.reported_amount is distinct from new.amount;
begin
  select * into v_event from public.events e where e.id = new.event_id;
  select m.user_id into v_payer from public.memberships m where m.id = new.membership_id;

  if tg_op = 'INSERT' and new.status = 'pending' and new.membership_id is not null then
    perform app.notify(
      new.community_id,
      array(select app.member_user_ids(new.community_id, array['staff', 'committee']::public.member_role[])),
      'payment_reported',
      'Receipt to confirm: ' || app.money(new.amount),
      coalesce('Flat ' || app.flat_label(new.unit_id) || ' · ', '') || v_event.name,
      jsonb_build_object('screen', 'payments', 'event_slug', v_event.slug, 'contribution_id', new.id)
    );
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status in ('succeeded', 'failed') then
    perform app.notify(
      new.community_id,
      array[v_payer],
      case when new.status = 'succeeded' then 'payment_confirmed' else 'payment_declined' end,
      case
        when new.status <> 'succeeded' then 'Receipt not confirmed: ' || app.money(new.amount)
        when v_corrected then 'Receipt confirmed as ' || app.money(new.amount)
        else 'Receipt confirmed: ' || app.money(new.amount)
      end,
      case
        when new.status <> 'succeeded'
          then coalesce(new.review_note, 'Staff could not match it with the bank statement.')
        when v_corrected
          then 'You reported ' || app.money(new.reported_amount) || '; the committee recorded '
               || app.money(new.amount) || ' against the bank statement. '
               || coalesce(new.review_note, 'Your records now show the corrected figure.')
        else 'Thank you for supporting ' || v_event.name || '.'
      end,
      jsonb_build_object('screen', 'event', 'event_slug', v_event.slug)
    );
  end if;
  return null;
end;
$$;

create or replace function public.reconcile_bank_line(
  p_transaction_id   uuid,
  p_contribution_id  uuid,
  p_take_bank_amount boolean default false
)
returns public.contributions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_line public.bank_transactions;
  v_row public.contributions;
  v_actor uuid;
begin
  select * into v_line from public.bank_transactions where id = p_transaction_id;
  if v_line.id is null then
    raise exception 'That statement line no longer exists' using errcode = 'no_data_found';
  end if;
  if not app.is_staff(v_line.community_id) then
    raise exception 'Only staff can reconcile' using errcode = 'insufficient_privilege';
  end if;
  if v_line.contribution_id is not null or v_line.expense_id is not null then
    raise exception 'That line is already matched' using errcode = 'unique_violation';
  end if;
  if v_line.amount <= 0 then
    raise exception 'Money going out cannot pay a contribution'
      using errcode = 'check_violation';
  end if;

  select * into v_row from public.contributions
   where id = p_contribution_id and community_id = v_line.community_id;
  if v_row.id is null then
    raise exception 'That receipt no longer exists' using errcode = 'no_data_found';
  end if;
  if v_row.status = 'succeeded' then
    raise exception 'That receipt is already confirmed' using errcode = 'unique_violation';
  end if;

  v_actor := app.my_membership_id(v_line.community_id);

  update public.contributions
     set status = 'succeeded',
         amount = case when p_take_bank_amount then v_line.amount else amount end,
         verified_by = v_actor,
         verified_at = now(),
         review_note = case
           when v_line.amount <> v_row.amount and not p_take_bank_amount
             then concat('Bank shows ', app.money(v_line.amount),
                         '; reported amount kept.')
           else review_note
         end
   where id = p_contribution_id
   returning * into v_row;

  update public.bank_transactions
     set contribution_id = p_contribution_id,
         matched_by = v_actor,
         matched_at = now()
   where id = p_transaction_id;

  return v_row;
end;
$$;

grant execute on function public.reconcile_bank_line(uuid, uuid, boolean) to authenticated;

-- History reads the same as the future. Idempotent: only rows still carrying the
-- old wording match, and the stored text is exactly what the triggers wrote.
update public.notifications
   set title = regexp_replace(title, '^Payment (to confirm|not confirmed|confirmed)', 'Receipt \1')
 where kind in ('payment_reported', 'payment_confirmed', 'payment_declined')
   and title like 'Payment %';
