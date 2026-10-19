-- ============================================================================
-- Compences · RLS and business-rule test suite
-- ----------------------------------------------------------------------------
-- Two societies, several members each. The suite exists to prove the promises
-- the product makes:
--
--   · a resident sees every approved rupee of spending, with the bill
--   · a resident does not see what their neighbour gave
--   · nobody approves their own expense
--   · a closed ledger stays closed
--   · moving money between funds takes a vote that clears a threshold
--   · one member, one vote
--   · nothing leaks across societies
-- ============================================================================

truncate test.results;

reset role;

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 'asha@example.com',   '{"full_name":"Asha Menon"}'),
  ('22222222-2222-4222-8222-222222222222', 'bala@example.com',   '{"full_name":"Bala Krishnan"}'),
  ('33333333-3333-4333-8333-333333333333', 'chitra@example.com', '{"full_name":"Chitra Rao"}'),
  ('44444444-4444-4444-8444-444444444444', 'dev@example.com',    '{"full_name":"Dev Sharma"}'),
  ('55555555-5555-4555-8555-555555555555', 'esha@example.com',   '{"full_name":"Esha Patil"}'),
  ('66666666-6666-4666-8666-666666666666', 'farid@example.com',  '{"full_name":"Farid Khan"}'),
  ('77777777-7777-4777-8777-777777777777', 'gita@example.com',   '{"full_name":"Gita Nair"}');

select test.eq((select count(*)::int from public.profiles), 7,
  'signup trigger mirrors every auth user into profiles');

create or replace function test.act_as(p_uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
                     json_build_object('sub', p_uid, 'role', 'authenticated')::text, false);
  execute 'set role authenticated';
end $$;

create or replace function test.act_anon()
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', false);
  execute 'set role anon';
end $$;

-- ---------------------------------------------------------------------------
-- Two societies
-- ---------------------------------------------------------------------------
-- Societies are set up by the platform team (the service role here), with the
-- first committee member named as created_by.
reset role;
insert into public.communities (id, slug, join_code, name, created_by) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'green-valley', 'MHR4827',
   'My Home Residency', '11111111-1111-4111-8111-111111111111');

select test.eq(
  (select role::text from public.memberships
    where community_id = 'aaaaaaaa-0000-4000-8000-000000000001'
      and user_id = '11111111-1111-4111-8111-111111111111'),
  'committee', 'the named founder joins the society as committee');

select test.act_as('11111111-1111-4111-8111-111111111111');

insert into public.units (id, community_id, block, number) values
  ('bbbbbbbb-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'A', '101'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', 'A', '102'),
  ('bbbbbbbb-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001', 'B', '201');

reset role;
insert into public.communities (id, slug, join_code, name, created_by) values
  ('aaaaaaaa-0000-4000-8000-000000000002', 'lake-view', 'LKV1234',
   'Lake View Residency', '77777777-7777-4777-8777-777777777777');
select test.act_as('77777777-7777-4777-8777-777777777777');

select test.eq(test.visible('select id from public.communities'), 1::bigint,
  'a committee member sees only their own society');

-- ---------------------------------------------------------------------------
-- Founding a society from the app
-- ---------------------------------------------------------------------------
-- public.communities still has no INSERT policy, so create_society() is the
-- only door in. That is what stops a client naming itself the founder of a
-- society it invented, or of one that already exists.
reset role;
insert into auth.users (id, email, raw_user_meta_data) values
  ('88888888-8888-4888-8888-888888888888', 'hana@example.com',   '{"full_name":"Hana Iyer"}'),
  ('b9b9b9b9-b9b9-4b9b-8b9b-b9b9b9b9b9b9', 'ismail@example.com', '{"full_name":"Ismail Rahman"}');

select test.act_as('88888888-8888-4888-8888-888888888888');
select test.raises(
  $q$insert into public.communities (slug, name, created_by)
     values ('hill-crest', 'Hill Crest', '88888888-8888-4888-8888-888888888888')$q$,
  'a signed-in user cannot insert a society directly');

select test.eq(
  (select status from public.create_society('Hill Crest', 'Bengaluru')),
  'ok', 'a signed-in user can found a society through create_society()');
select test.eq(
  (select slug from public.communities where name = 'Hill Crest'),
  'hill-crest', 'the web address is derived from the name');
select test.eq(
  (select role::text from public.memberships m
     join public.communities c on c.id = m.community_id
    where c.slug = 'hill-crest'
      and m.user_id = '88888888-8888-4888-8888-888888888888'),
  'committee', 'the founder joins their own society as committee');
select test.ok(
  (select count(*) from public.catalogue_items ci
     join public.communities c on c.id = ci.community_id
    where c.slug = 'hill-crest') > 0,
  'a founded society starts with the default catalogue');
select test.eq(test.visible($q$select id from public.communities where slug = 'hill-crest'$q$), 1::bigint,
  'the founder can see the society they just opened');
select test.eq(
  (select created_by from public.communities where slug = 'hill-crest'),
  '88888888-8888-4888-8888-888888888888'::uuid,
  'the founder is recorded from the session, not from the request');
select test.eq((select status from public.create_society('x')), 'invalid_name',
  'a one-character name is refused');

-- ---------------------------------------------------------------------------
-- The founder's phone number
-- ---------------------------------------------------------------------------
-- Nobody had one. Founding never asked, so the person every resident needs to
-- reach was the one member with no way to be reached.
reset role;
select test.eq(app.e164('98450 10101'), '+919845010101',
  'a ten-digit Indian mobile is given its country code');
select test.eq(app.e164('+91 98450-10101'), '+919845010101',
  'spaces and dashes are not part of a phone number');
select test.eq(app.e164('919845010101'), '+919845010101',
  'an international number missing its plus gets one');
select test.eq(app.e164('12345'), null::text, 'too short is not a phone number');
select test.eq(app.e164('not a phone'), null::text, 'nor is a sentence');
select test.eq(app.e164(null), null::text, 'and null stays null');

select test.act_as('88888888-8888-4888-8888-888888888888');
-- Read through my_contact(): since 0918.0100 a client cannot select the column.
select test.eq((select phone from public.my_contact()),
  null::text, 'founding without a phone leaves the profile as it was');

select test.eq(
  (select status from public.create_society('Hill Crest Annexe', 'Bengaluru', null, null, '98450 10101')),
  'ok', 'a society can be founded with a phone number');
reset role;
select test.eq((select phone from public.profiles where id = '88888888-8888-4888-8888-888888888888'),
  '+919845010101', 'and the founder ends up reachable');

select test.act_as('88888888-8888-4888-8888-888888888888');
select test.eq(
  (select status from public.create_society('Hill Crest Gardens', 'Bengaluru', null, null, 'not a phone')),
  'invalid_phone', 'a phone that cannot be dialled is named, not silently dropped');
reset role;
select test.eq((select count(*) from public.communities where name = 'Hill Crest Gardens'), 0::bigint,
  'and nothing is created when it is refused');
select test.eq((select phone from public.profiles where id = '88888888-8888-4888-8888-888888888888'),
  '+919845010101', 'a number already set is never overwritten by a later society');

-- ---------------------------------------------------------------------------
-- The founder lives somewhere too
-- ---------------------------------------------------------------------------
-- Every resident is asked which flat they live in; the founder never was, and
-- was the one member of a society who lived nowhere. Their own payments then
-- showed up on the Money page with no flat beside them — not the ledger
-- failing to look, but nothing to find.
select test.act_as('88888888-8888-4888-8888-888888888888');
select test.eq(
  (select status from public.create_society('Hill Crest Mews', 'Bengaluru', null, null, null, 'nowhere')),
  'invalid_flat', 'a flat with no number in it is named, not silently dropped');
reset role;
select test.eq((select count(*) from public.communities where name = 'Hill Crest Mews'), 0::bigint,
  'and nothing is created when it is refused');

select test.act_as('88888888-8888-4888-8888-888888888888');
create temporary table t_founded as
select * from public.create_society('Hill Crest Towers', 'Bengaluru', null, null, null, 'C 1402');
grant select on t_founded to authenticated;
select test.eq((select status from t_founded), 'ok', 'a founder can say which flat is theirs');

reset role;
select test.eq(
  (select btrim(coalesce(u.block || ' ', '') || u.number) from public.units u
    where u.community_id = (select community_id from t_founded)),
  'C 1402', 'the society''s first flat is the founder''s own');
select test.eq(
  (select count(*)::int from public.unit_occupants o
     join public.memberships m on m.id = o.membership_id
    where m.community_id = (select community_id from t_founded)
      and m.user_id = '88888888-8888-4888-8888-888888888888'
      and o.moved_out_on is null),
  1, 'and they are seated in it');

-- Split the way generateFlats() writes them, or a founder's hand-typed flat
-- and the generator's later one are two different rows and the resident who
-- picked the wrong one is invisible to the other.
select test.eq((select block || '|' || number from app.split_flat('A 703')), 'A|703',
  'a space between the tower and the number is not part of either');
select test.eq((select block || '|' || number from app.split_flat('a-703')), 'A|703',
  'nor is a dash, and the tower is stored upper case');
select test.eq((select block || '|' || number from app.split_flat('A703')), 'A|703',
  'and the two run together is the same flat again');
select test.eq((select block || '|' || number from app.split_flat('B G01')), 'B|G01',
  'a ground-floor flat keeps its letter, because that letter is part of the number');
select test.eq((select block || '|' || number from app.split_flat('G01')), 'G|01',
  'the same thing without the space is a tower instead, which a space settles');
select test.ok((select block is null and number = '703' from app.split_flat('703')),
  'a society without towers has flats that are only a number');

-- Hand the suite back the society count it was written against.
select test.act_as('88888888-8888-4888-8888-888888888888');
delete from public.communities where slug = 'hill-crest-annexe';
delete from public.communities where slug = 'hill-crest-towers';
reset role;
select test.eq((select count(*) from public.communities where slug = 'hill-crest-annexe'), 0::bigint,
  'and the society founded to prove it is cleaned up again');

-- Two societies may share a name; they cannot share a web address.
select test.act_as('b9b9b9b9-b9b9-4b9b-8b9b-b9b9b9b9b9b9');
select test.ok(
  (select slug from public.create_society('Hill Crest', 'Pune')) not in ('hill-crest'),
  'a name already taken still gets a free web address of its own');
select test.eq((select status from public.create_society('Ismail Gardens')), 'ok',
  'a second society is fine');
select test.eq((select status from public.create_society('Ismail Heights')), 'ok',
  'and a third');
select test.eq((select status from public.create_society('Ismail Towers')), 'too_many',
  'one account cannot open more than three societies');

-- A founder may undo a society nobody has joined; that is all delete is for.
-- Both statements run as Ismail: RLS silently narrows the second to no rows.
delete from public.communities where slug = 'ismail-heights';
delete from public.communities where slug = 'hill-crest';

reset role;
select test.eq((select count(*) from public.communities where slug = 'ismail-heights'), 0::bigint,
  'the founder can delete a society nobody else is in');
select test.eq((select count(*) from public.communities where slug = 'hill-crest'), 1::bigint,
  'and cannot touch a society somebody else founded');

-- The rest of the suite shares one Society ID for Hill Crest, so pin the
-- generated one to something readable.
reset role;
update public.communities set join_code = 'HILL2026' where slug = 'hill-crest';

-- ---------------------------------------------------------------------------
-- Joining by Society ID, with admin approval
-- ---------------------------------------------------------------------------
reset role;
select test.act_as('33333333-3333-4333-8333-333333333333');

create temporary table t_req as
select * from public.request_to_join(
  'MHR4827', 'bbbbbbbb-0000-4000-8000-000000000001', 'Chitra Rao', '9876543210', 'owner');
grant select on t_req to authenticated;

select test.eq((select status from t_req), 'pending',
  'knowing the Society ID gets you a pending request, not membership');
select test.eq(test.visible('select id from public.memberships'), 0::bigint,
  'a pending request is not membership: the society is still invisible');
select test.eq(
  (select status from public.request_to_join('NOPE99')),
  'not_found', 'a wrong Society ID is refused');

-- Asking again refreshes the same request rather than queueing a second.
select test.eq(
  (select status from public.request_to_join('MHR4827', 'bbbbbbbb-0000-4000-8000-000000000001', 'Chitra Rao')),
  'pending', 'asking twice refreshes the pending request');
reset role;
select test.eq((select count(*)::int from public.join_requests
                 where user_id = '33333333-3333-4333-8333-333333333333'), 1,
  'and does not create a second row for staff to wade through');

-- The number typed while joining used to stop at the join request: staff read
-- it once while admitting the person, and the profile stayed blank for ever.
-- The request filed above carried '9876543210'.
select test.eq((select phone from public.profiles where id = '33333333-3333-4333-8333-333333333333'),
  '+919876543210',
  'the number given while joining becomes the resident’s, before anyone admits them');

-- Their own number outlasts every later application.
select test.act_as('33333333-3333-4333-8333-333333333333');
select test.eq(
  (select status from public.request_to_join(
     'MHR4827', 'bbbbbbbb-0000-4000-8000-000000000001', 'Chitra Rao', '9845010303')),
  'pending', 'a later request is still accepted');
reset role;
select test.eq((select phone from public.profiles where id = '33333333-3333-4333-8333-333333333333'),
  '+919876543210', 'without quietly replacing the number already on the profile');

-- A resident cannot admit themselves.
select test.act_as('33333333-3333-4333-8333-333333333333');
select test.raises(
  format($q$select public.review_join_request('%s', true)$q$, (select request_id from t_req)),
  'a requester cannot approve their own join request');

reset role;
select test.act_as('11111111-1111-4111-8111-111111111111');
select test.eq(
  (select status::text from public.review_join_request((select request_id from t_req), true, 'resident')),
  'approved', 'the committee admits the request');

reset role;
select test.act_as('33333333-3333-4333-8333-333333333333');
select test.eq(test.visible('select id from public.communities'), 1::bigint,
  'approval lets the resident in');
select test.eq(
  (select count(*)::int from public.unit_occupants o
     join public.memberships m on m.id = o.membership_id
    where m.user_id = '33333333-3333-4333-8333-333333333333'),
  1, 'and seats them in the flat they claimed');

-- Bring the rest in directly, as an admin would with a pre-approved code.
reset role;
insert into public.memberships (community_id, user_id, role, status) values
  ('aaaaaaaa-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'committee', 'active'),
  ('aaaaaaaa-0000-4000-8000-000000000001', '44444444-4444-4444-8444-444444444444', 'resident', 'active'),
  ('aaaaaaaa-0000-4000-8000-000000000001', '55555555-5555-4555-8555-555555555555', 'staff', 'active');

insert into public.unit_occupants (unit_id, membership_id, relation, is_primary)
select 'bbbbbbbb-0000-4000-8000-000000000002', m.id, 'owner', true
  from public.memberships m where m.user_id = '44444444-4444-4444-8444-444444444444';

-- ---------------------------------------------------------------------------
-- An event: draft, then published
-- ---------------------------------------------------------------------------
select test.act_as('11111111-1111-4111-8111-111111111111');

insert into public.events (id, community_id, slug, emoji, name, starts_on, venue, organizer, description, fund_target, fund_rule, fund_rule_note, created_by)
values ('cccccccc-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
        'ganesh-2026', '🎉', 'Ganesh Chaturthi 2026', '2026-09-14', 'Clubhouse',
        'Society Cultural Committee', 'Ten days of pooja, performances and community meals.',
        150000, 'carry_next_edition',
        'Any surplus will be carried forward to Ganesh Chaturthi 2027.',
        '11111111-1111-4111-8111-111111111111');

reset role;
select test.act_as('33333333-3333-4333-8333-333333333333');
select test.eq(test.visible('select id from public.events'), 0::bigint,
  'a draft event is invisible to residents');

reset role;
select test.act_as('55555555-5555-4555-8555-555555555555');
select test.eq(test.visible('select id from public.events'), 1::bigint,
  'staff can see the draft they are preparing');
select test.raises(
  $q$update public.events set status = 'completed'
      where id = 'cccccccc-0000-4000-8000-000000000001'$q$,
  'staff cannot close an event; that is a committee decision');

reset role;
select test.act_as('11111111-1111-4111-8111-111111111111');
update public.events set status = 'published'
 where id = 'cccccccc-0000-4000-8000-000000000001';
select test.ok(
  (select published_at is not null from public.events
    where id = 'cccccccc-0000-4000-8000-000000000001'),
  'publishing stamps published_at automatically');

reset role;
select test.act_as('33333333-3333-4333-8333-333333333333');
select test.eq(test.visible('select id from public.events'), 1::bigint,
  'once published, residents see the event');

-- ---------------------------------------------------------------------------
-- Checklist drives readiness
-- ---------------------------------------------------------------------------
reset role;
select test.act_as('55555555-5555-4555-8555-555555555555');
insert into public.event_tasks (event_id, community_id, name, status) values
  ('cccccccc-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'Ganesh idol finalized', 'done'),
  ('cccccccc-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'Decoration vendor selected', 'done'),
  ('cccccccc-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'Sound system booking', 'in_progress'),
  ('cccccccc-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'Food vendor confirmation', 'todo');

select test.eq(
  (select readiness from public.event_stats where event_id = 'cccccccc-0000-4000-8000-000000000001'),
  50, 'readiness is computed from the checklist, not stored');
select test.ok(
  (select completed_at is not null from public.event_tasks where name = 'Ganesh idol finalized'),
  'completing a task stamps completed_at');

update public.event_tasks set status = 'todo' where name = 'Ganesh idol finalized';
select test.ok(
  (select completed_at is null from public.event_tasks where name = 'Ganesh idol finalized'),
  'reopening a task clears the stamp, so readiness history stays truthful');
update public.event_tasks set status = 'done' where name = 'Ganesh idol finalized';

reset role;
select test.act_as('33333333-3333-4333-8333-333333333333');
select test.eq(test.visible('select id from public.event_tasks'), 4::bigint,
  'residents can watch the checklist');
update public.event_tasks set status = 'done' where name = 'Food vendor confirmation';
reset role;
select test.eq(
  (select status::text from public.event_tasks where name = 'Food vendor confirmation'),
  'todo', 'but cannot tick tasks off themselves');
select test.act_as('33333333-3333-4333-8333-333333333333');

-- ---------------------------------------------------------------------------
-- Contributions: totals public, amounts private
-- ---------------------------------------------------------------------------
insert into public.contributions (event_id, community_id, membership_id, amount, method)
select 'cccccccc-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
       app.my_membership_id('aaaaaaaa-0000-4000-8000-000000000001'), 5000, 'upi';

reset role;
select test.act_as('44444444-4444-4444-8444-444444444444');
insert into public.contributions (event_id, community_id, membership_id, amount, method)
select 'cccccccc-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
       app.my_membership_id('aaaaaaaa-0000-4000-8000-000000000001'), 2000, 'card';

select test.eq(test.visible('select id from public.contributions'), 1::bigint,
  'a resident sees only their own contribution, not their neighbour''s');
select test.eq(
  coalesce((select fund_raised from public.event_stats where event_id = 'cccccccc-0000-4000-8000-000000000001'), 0),
  0::numeric, 'a reported payment does not count until staff confirm it');

reset role;
select test.act_as('55555555-5555-4555-8555-555555555555');
select public.review_contribution(c.id, true) from public.contributions c
 where c.event_id = 'cccccccc-0000-4000-8000-000000000001' and c.status = 'pending';

reset role;
select test.act_as('44444444-4444-4444-8444-444444444444');
select test.eq(
  (select fund_raised from public.event_stats where event_id = 'cccccccc-0000-4000-8000-000000000001'),
  7000::numeric(12,2),
  'but the society total is public — that is the whole point of the fund');
select test.eq(
  (select contributors from public.event_stats where event_id = 'cccccccc-0000-4000-8000-000000000001'),
  2, 'and so is the number of families who gave');

select test.raises(
  $q$insert into public.contributions (event_id, community_id, membership_id, amount)
     select 'cccccccc-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
            m.id, 999 from public.memberships m
      where m.user_id = '33333333-3333-4333-8333-333333333333'$q$,
  'a resident cannot record a contribution in somebody else''s name');

update public.contributions set amount = 999999;
reset role;
select test.eq(
  (select sum(amount) from public.contributions
    where event_id = 'cccccccc-0000-4000-8000-000000000001'),
  7000::numeric,
  'and cannot edit a payment record after the fact');
select test.act_as('44444444-4444-4444-8444-444444444444');

-- ---------------------------------------------------------------------------
-- A payment names the flat it came from
-- ---------------------------------------------------------------------------
-- A member nobody has listed at a door could still pay, and their payment
-- carried a name and no flat — on the Money page, in the UPI note, in the bank
-- matcher — for ever. The Contribute screens ask them now, which is the first
-- time a value a resident chose reaches contributions.unit_id.
--
-- So the policy has to say what they may choose. Not "a flat they live in":
-- they are paying precisely because nobody has listed them at one, and staff
-- confirm the payment against the bank before it counts, the same as they do
-- the amount. The boundary is the society.
reset role;
insert into public.units (id, community_id, block, number) values
  ('bbbbbbbb-0000-4000-8000-0000000000ff', 'aaaaaaaa-0000-4000-8000-000000000002', 'C', '303');
select test.act_as('44444444-4444-4444-8444-444444444444');

insert into public.contributions (event_id, community_id, membership_id, unit_id, amount, method)
select 'cccccccc-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
       app.my_membership_id('aaaaaaaa-0000-4000-8000-000000000001'),
       'bbbbbbbb-0000-4000-8000-000000000003', 101, 'upi';
select test.eq(
  (select count(*) from public.contributions
    where unit_id = 'bbbbbbbb-0000-4000-8000-000000000003'),
  1::bigint,
  'a resident names the flat their payment came from, so the ledger can show it');

select test.raises(
  $q$insert into public.contributions (event_id, community_id, membership_id, unit_id, amount, method)
     select 'cccccccc-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
            app.my_membership_id('aaaaaaaa-0000-4000-8000-000000000001'),
            'bbbbbbbb-0000-4000-8000-0000000000ff', 101, 'upi'$q$,
  'but never one that belongs to another society');

-- Put the fund back the way the rest of this file expects to find it.
reset role;
delete from public.contributions where amount = 101;
select test.act_as('44444444-4444-4444-8444-444444444444');

-- ---------------------------------------------------------------------------
-- The ledger: approved spending is public, pending is not
-- ---------------------------------------------------------------------------
reset role;
select test.act_as('55555555-5555-4555-8555-555555555555');

insert into public.expenses (id, event_id, community_id, name, category, amount, vendor, bill_url, requested_by)
select 'dddddddd-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000001',
       'aaaaaaaa-0000-4000-8000-000000000001', 'Decoration', 'decoration', 25000,
       'ABC Decorations', 'bills/abc-decorations.pdf',
       app.my_membership_id('aaaaaaaa-0000-4000-8000-000000000001');

select test.raises(
  $q$insert into public.expenses (event_id, community_id, name, amount, vendor, bill_url, status, requested_by)
     select 'cccccccc-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
            'Sneaky', 1000, 'Anybody', 'aaaaaaaa-0000-4000-8000-000000000001/sneaky.pdf', 'approved',
            app.my_membership_id('aaaaaaaa-0000-4000-8000-000000000001')$q$,
  'an expense cannot be filed pre-approved');

reset role;
select test.act_as('33333333-3333-4333-8333-333333333333');
select test.eq(test.visible('select id from public.expenses'), 0::bigint,
  'a resident does not see an expense that is still under review');
select test.eq(
  (select spent from public.event_stats where event_id = 'cccccccc-0000-4000-8000-000000000001'),
  0::numeric(12,2),
  'and unapproved spending is not counted as spent');

-- The requester must not be able to sign off their own claim.
reset role;
select test.act_as('55555555-5555-4555-8555-555555555555');
select test.raises(
  $q$select public.review_expense('dddddddd-0000-4000-8000-000000000001', 'approved')$q$,
  'staff cannot approve a bill at all');

reset role;
select test.act_as('11111111-1111-4111-8111-111111111111');
insert into public.expenses (id, event_id, community_id, name, amount, vendor, bill_url, requested_by)
select 'dddddddd-0000-4000-8000-000000000009', 'cccccccc-0000-4000-8000-000000000001',
       'aaaaaaaa-0000-4000-8000-000000000001', 'Own claim', 4000, 'Self',
       'aaaaaaaa-0000-4000-8000-000000000001/cccccccc-0000-4000-8000-000000000001/own-claim.pdf',
       app.my_membership_id('aaaaaaaa-0000-4000-8000-000000000001');
select test.raises(
  $q$select public.review_expense('dddddddd-0000-4000-8000-000000000009', 'approved')$q$,
  'a committee member cannot approve a bill they raised themselves');

select test.eq(
  (select status::text from public.review_expense('dddddddd-0000-4000-8000-000000000001', 'approved')),
  'approved', 'the committee approves somebody else''s bill');

reset role;
select test.act_as('33333333-3333-4333-8333-333333333333');
select test.eq(test.visible('select id from public.expenses'), 1::bigint,
  'the moment it is approved, every resident can see it');
select test.eq(
  (select vendor from public.expenses where id = 'dddddddd-0000-4000-8000-000000000001'),
  'ABC Decorations', 'including which vendor was paid');
select test.ok(
  (select bill_url is not null from public.expenses
    where id = 'dddddddd-0000-4000-8000-000000000001'),
  'and the bill itself');
select test.eq(
  (select spent from public.event_stats where event_id = 'cccccccc-0000-4000-8000-000000000001'),
  25000::numeric(12,2), 'approved spending counts towards the total');
select test.eq(
  (select available from public.event_stats where event_id = 'cccccccc-0000-4000-8000-000000000001'),
  (7000 - 25000)::numeric(12,2),
  'available is raised minus spent, even when that goes negative');

update public.expenses set status = 'approved'
 where id = 'dddddddd-0000-4000-8000-000000000009';
reset role;
select test.eq(
  (select status::text from public.expenses where id = 'dddddddd-0000-4000-8000-000000000009'),
  'pending', 'a resident cannot approve an expense with a direct update');
select test.act_as('33333333-3333-4333-8333-333333333333');

-- ---------------------------------------------------------------------------
-- Activities and volunteering
-- ---------------------------------------------------------------------------
reset role;
select test.act_as('55555555-5555-4555-8555-555555555555');
insert into public.event_activities (id, event_id, community_id, name, emoji, description)
values ('eeeeeeee-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000001',
        'aaaaaaaa-0000-4000-8000-000000000001', 'Dance', '💃', 'Group dance for all ages.');

insert into public.volunteer_roles (id, event_id, community_id, name, emoji, target_count)
values ('ffffffff-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000001',
        'aaaaaaaa-0000-4000-8000-000000000001', 'Decoration', '🎈', 3);

reset role;
select test.act_as('33333333-3333-4333-8333-333333333333');
insert into public.activity_participants (activity_id, membership_id, performance_type, age_group)
select 'eeeeeeee-0000-4000-8000-000000000001',
       app.my_membership_id('aaaaaaaa-0000-4000-8000-000000000001'), 'Group', 'Adult';

select test.eq(
  (select interested from public.activity_stats where activity_id = 'eeeeeeee-0000-4000-8000-000000000001'),
  1, 'joining an activity is counted');

select test.raises(
  $q$insert into public.activity_participants (activity_id, membership_id)
     select 'eeeeeeee-0000-4000-8000-000000000001',
            app.my_membership_id('aaaaaaaa-0000-4000-8000-000000000001')$q$,
  'signing up twice is a double tap, not a second performer');

insert into public.event_volunteers (role_id, membership_id)
select 'ffffffff-0000-4000-8000-000000000001',
       app.my_membership_id('aaaaaaaa-0000-4000-8000-000000000001');

select test.eq(
  (select still_needed from public.volunteer_role_stats where role_id = 'ffffffff-0000-4000-8000-000000000001'),
  2, '"2 more needed" is computed from the target, never counted down by hand');

select test.eq(
  (select participants from public.event_stats where event_id = 'cccccccc-0000-4000-8000-000000000001'),
  1, 'event participation reflects activity sign-ups');

-- ---------------------------------------------------------------------------
-- Polls: one member, one vote; ballots secret
-- ---------------------------------------------------------------------------
reset role;
select test.act_as('55555555-5555-4555-8555-555555555555');
insert into public.polls (id, community_id, question)
values ('a1a1a1a1-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
        'Should we organize a children''s drawing competition?');
insert into public.poll_options (id, poll_id, label, emoji, position) values
  ('a2a2a2a2-0000-4000-8000-000000000001', 'a1a1a1a1-0000-4000-8000-000000000001', 'Yes', '👍', 0),
  ('a2a2a2a2-0000-4000-8000-000000000002', 'a1a1a1a1-0000-4000-8000-000000000001', 'No',  '👎', 1);

reset role;
select test.act_as('33333333-3333-4333-8333-333333333333');
insert into public.poll_votes (poll_id, option_id, membership_id)
select 'a1a1a1a1-0000-4000-8000-000000000001', 'a2a2a2a2-0000-4000-8000-000000000001',
       app.my_membership_id('aaaaaaaa-0000-4000-8000-000000000001');

select test.raises(
  $q$insert into public.poll_votes (poll_id, option_id, membership_id)
     select 'a1a1a1a1-0000-4000-8000-000000000001', 'a2a2a2a2-0000-4000-8000-000000000002',
            app.my_membership_id('aaaaaaaa-0000-4000-8000-000000000001')$q$,
  'a member cannot vote twice in the same poll');

reset role;
select test.act_as('44444444-4444-4444-8444-444444444444');
insert into public.poll_votes (poll_id, option_id, membership_id)
select 'a1a1a1a1-0000-4000-8000-000000000001', 'a2a2a2a2-0000-4000-8000-000000000002',
       app.my_membership_id('aaaaaaaa-0000-4000-8000-000000000001');

select test.eq(test.visible('select id from public.poll_votes'), 1::bigint,
  'a ballot is secret: you see your own vote and nobody else''s');
select test.eq(
  (select votes from public.poll_results where option_id = 'a2a2a2a2-0000-4000-8000-000000000001'),
  1, 'but the tally is public');
select test.eq(
  (select total_votes from public.poll_results where option_id = 'a2a2a2a2-0000-4000-8000-000000000001'),
  2, 'and so is the turnout');

-- ---------------------------------------------------------------------------
-- Closing an event freezes its ledger
-- ---------------------------------------------------------------------------
reset role;
select test.act_as('11111111-1111-4111-8111-111111111111');
update public.events set status = 'completed'
 where id = 'cccccccc-0000-4000-8000-000000000001';
select test.ok(
  (select closed_at is not null from public.events where id = 'cccccccc-0000-4000-8000-000000000001'),
  'closing an event stamps closed_at');

-- Bala did not raise this bill, so only the closed ledger can stop him.
reset role;
select test.act_as('22222222-2222-4222-8222-222222222222');
select test.raises(
  $q$select public.review_expense('dddddddd-0000-4000-8000-000000000009', 'approved')$q$,
  'a closed event''s ledger cannot take new approvals');

reset role;
select test.act_as('11111111-1111-4111-8111-111111111111');
select test.raises(
  $q$update public.events set status = 'published'
      where id = 'cccccccc-0000-4000-8000-000000000001'$q$,
  'and a closed event cannot be reopened');

-- ---------------------------------------------------------------------------
-- Nothing leaks across societies
-- ---------------------------------------------------------------------------
reset role;
select test.act_as('77777777-7777-4777-8777-777777777777');
select test.eq(test.visible('select id from public.events'), 0::bigint,
  'a member of another society sees none of these events');
select test.eq(test.visible('select * from public.event_stats'), 0::bigint,
  'nor any of their numbers');
select test.eq(test.visible('select id from public.expenses'), 0::bigint,
  'nor a single line of their ledger');
select test.eq(test.visible('select id from public.contributions'), 0::bigint,
  'nor who contributed');
select test.eq(test.visible('select * from public.poll_results'), 0::bigint,
  'nor their poll results');
select test.eq(test.visible('select id from public.memberships'), 1::bigint,
  'membership rows do not leak across societies');

reset role;
select test.act_as('66666666-6666-4666-8666-666666666666');
select test.eq(test.visible('select id from public.communities'), 0::bigint,
  'someone with no membership sees no societies at all');
select test.eq(test.visible('select id from public.events'), 0::bigint,
  'and no events');
select test.eq(test.visible('select id from public.profiles'), 1::bigint,
  'and only their own profile');

reset role;
select test.act_anon();
select test.eq(test.visible('select id from public.events'), 0::bigint,
  'anonymous callers see nothing');
select test.eq(test.visible('select * from public.event_stats'), 0::bigint,
  'not even aggregate numbers');

-- ---------------------------------------------------------------------------
-- Three roles in Hill Crest: Hana (committee), Sam (staff), Ria and Tom
-- (residents of the same flat), Neil (resident waiting to be admitted)
-- ---------------------------------------------------------------------------
reset role;
insert into auth.users (id, email, raw_user_meta_data) values
  ('99999999-9999-4999-8999-999999999999', 'sam@example.com',  '{"full_name":"Sam Supervisor"}'),
  ('abababab-abab-4bab-8bab-abababababab', 'ria@example.com',  '{"full_name":"Ria Menon"}'),
  ('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd', 'tom@example.com',  '{"full_name":"Tom Menon"}'),
  ('efefefef-efef-4fef-8fef-efefefefefef', 'neil@example.com', '{"full_name":"Neil Das"}');
insert into public.units (id, community_id, block, number)
select 'b2b2b2b2-0000-4000-8000-000000000001', c.id, 'A', '1104' from public.communities c where c.slug = 'hill-crest';
insert into public.memberships (community_id, user_id, role, status)
select c.id, u.id::uuid, u.role::public.member_role, 'active'
  from public.communities c,
       (values ('99999999-9999-4999-8999-999999999999', 'staff'),
               ('abababab-abab-4bab-8bab-abababababab', 'resident'),
               ('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd', 'resident')) as u(id, role)
 where c.slug = 'hill-crest';
insert into public.events (id, community_id, slug, name, starts_on, status, fund_target)
select 'cccccccc-0000-4000-8000-0000000000aa', c.id, 'hill-diwali', 'Hill Crest Diwali', '2026-11-07', 'published', 50000
  from public.communities c where c.slug = 'hill-crest';
insert into public.event_activities (id, event_id, community_id, name)
select 'eeeeeeee-0000-4000-8000-0000000000aa', 'cccccccc-0000-4000-8000-0000000000aa', c.id, 'Rangoli'
  from public.communities c where c.slug = 'hill-crest';

-- Joining with the one society code; staff admit.
select test.act_as('efefefef-efef-4fef-8fef-efefefefefef');
select test.eq((select count(*) from public.society_units('HILL2026')), 1::bigint,
  'someone with the society code can pick from its flats before joining');
select test.eq((select count(*) from public.society_units('WRONG1')), 0::bigint,
  'a wrong code shows no flats');
select test.eq(test.visible('select id from public.units'), 0::bigint,
  'and flats stay hidden from non-members otherwise');
create temporary table t_neil as
select * from public.request_to_join('HILL2026', 'b2b2b2b2-0000-4000-8000-000000000001', 'Neil Das', '9845012345', 'tenant');
grant select on t_neil to authenticated;
select test.eq((select status from t_neil), 'pending', 'a new resident submits the society code and their details');
select test.eq(test.visible($q$select id from public.events where slug = 'hill-diwali'$q$), 0::bigint,
  'and sees nothing until admitted');

reset role;
select test.act_as('99999999-9999-4999-8999-999999999999');
select test.raises(
  format($q$select public.review_join_request('%s', true, 'staff')$q$, (select request_id from t_neil)),
  'staff cannot admit someone as staff');
select test.eq(
  (select status::text from public.review_join_request((select request_id from t_neil), true)),
  'approved', 'staff admit a new resident');

reset role;
select test.act_as('efefefef-efef-4fef-8fef-efefefefefef');
select test.eq(test.visible($q$select id from public.events where slug = 'hill-diwali'$q$), 1::bigint,
  'once admitted, the resident sees events');

-- Staff remove residents, but never committee or other staff.
reset role;
select test.act_as('99999999-9999-4999-8999-999999999999');
delete from public.memberships where user_id = 'efefefef-efef-4fef-8fef-efefefefefef';
select test.eq(
  (select count(*)::int from public.memberships where user_id = 'efefefef-efef-4fef-8fef-efefefefefef'),
  0, 'staff remove a resident');
delete from public.memberships where user_id = '88888888-8888-4888-8888-888888888888';
reset role;
select test.eq(
  (select count(*)::int from public.memberships where user_id = '88888888-8888-4888-8888-888888888888'),
  1, 'but cannot remove a committee member');
select test.act_as('99999999-9999-4999-8999-999999999999');
select test.raises(
  $q$update public.memberships set role = 'staff'
      where user_id = 'abababab-abab-4bab-8bab-abababababab'$q$,
  'and cannot change anyone''s role');

-- Money: residents contribute, staff do not; staff see and record every flat.
reset role;
select test.act_as('abababab-abab-4bab-8bab-abababababab');
insert into public.contributions (event_id, community_id, membership_id, unit_id, amount)
select 'cccccccc-0000-4000-8000-0000000000aa', m.community_id, m.id, 'b2b2b2b2-0000-4000-8000-000000000001', 2001
  from public.memberships m where m.user_id = 'abababab-abab-4bab-8bab-abababababab';

reset role;
select test.act_as('99999999-9999-4999-8999-999999999999');
select test.raises(
  $q$insert into public.contributions (event_id, community_id, membership_id, amount)
     select 'cccccccc-0000-4000-8000-0000000000aa', m.community_id, m.id, 500
       from public.memberships m where m.user_id = '99999999-9999-4999-8999-999999999999'$q$,
  'staff cannot contribute as a participant');
insert into public.contributions (event_id, community_id, unit_id, amount, method, channel, status)
select 'cccccccc-0000-4000-8000-0000000000aa', e.community_id, 'b2b2b2b2-0000-4000-8000-000000000001', 1500, 'cash', 'system', 'succeeded'
  from public.events e where e.id = 'cccccccc-0000-4000-8000-0000000000aa';
select test.eq(test.visible($q$select id from public.contributions where event_id = 'cccccccc-0000-4000-8000-0000000000aa'$q$),
  2::bigint, 'staff record cash against a flat and see every flat''s payments');

reset role;
select test.act_as('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd');
select test.eq(test.visible($q$select id from public.contributions where event_id = 'cccccccc-0000-4000-8000-0000000000aa'$q$),
  0::bigint, 'a resident does not see other people''s payments');

-- Bills: staff raise them, only committee decides.
reset role;
select test.act_as('99999999-9999-4999-8999-999999999999');
insert into public.expenses (id, event_id, community_id, name, category, amount, vendor, bill_url, requested_by)
select 'dddddddd-0000-4000-8000-0000000000aa', 'cccccccc-0000-4000-8000-0000000000aa', m.community_id,
       'Diyas', 'decoration', 2500, 'Clay Crafts', 'bills/diyas.pdf', m.id
  from public.memberships m where m.user_id = '99999999-9999-4999-8999-999999999999';
update public.expenses set amount = 2400, bill_url = 'bills/diyas-corrected.pdf'
 where id = 'dddddddd-0000-4000-8000-0000000000aa';
select test.eq((select amount from public.expenses where id = 'dddddddd-0000-4000-8000-0000000000aa'),
  2400::numeric(12,2), 'staff correct a pending bill and re-upload it');
select test.raises(
  $q$select public.review_expense('dddddddd-0000-4000-8000-0000000000aa', 'approved')$q$,
  'staff cannot approve a bill');

reset role;
select test.act_as('88888888-8888-4888-8888-888888888888');
select test.eq(
  (select status::text from public.review_expense('dddddddd-0000-4000-8000-0000000000aa', 'approved')),
  'approved', 'the committee approves it');

-- Budget: staff plan it, residents read it.
reset role;
select test.act_as('99999999-9999-4999-8999-999999999999');
insert into public.budget_lines (event_id, community_id, category, amount)
select 'cccccccc-0000-4000-8000-0000000000aa', e.community_id, 'Decoration', 12000
  from public.events e where e.id = 'cccccccc-0000-4000-8000-0000000000aa';
reset role;
select test.act_as('abababab-abab-4bab-8bab-abababababab');
select test.eq(test.visible('select id from public.budget_lines'), 1::bigint, 'residents see the budget');
select test.raises(
  $q$insert into public.budget_lines (event_id, community_id, category, amount)
     select 'cccccccc-0000-4000-8000-0000000000aa', e.community_id, 'Sweets', 5000
       from public.events e where e.id = 'cccccccc-0000-4000-8000-0000000000aa'$q$,
  'but cannot change it');

-- Several people from one flat register for an activity.
insert into public.activity_participants (activity_id, membership_id, participant_name)
select 'eeeeeeee-0000-4000-8000-0000000000aa', m.id, n
  from public.memberships m, (values ('Ria Menon'), ('Aarav Menon')) v(n)
 where m.user_id = 'abababab-abab-4bab-8bab-abababababab';
reset role;
select test.act_as('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd');
insert into public.activity_participants (activity_id, membership_id)
select 'eeeeeeee-0000-4000-8000-0000000000aa', m.id
  from public.memberships m where m.user_id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd';
reset role;
select test.eq(
  (select count(*)::int from public.activity_participants where activity_id = 'eeeeeeee-0000-4000-8000-0000000000aa'),
  3, 'two family members and a flatmate from the same flat all register');

-- Campaigns: a resident proposes, only the committee approves.
select test.act_as('abababab-abab-4bab-8bab-abababababab');
insert into public.events (id, community_id, slug, name, starts_on, kind, status, fund_target, created_by)
select 'cccccccc-0000-4000-8000-0000000000bb', c.id, 'park-benches', 'New benches for the park', '2026-12-01',
       'campaign', 'proposed', 40000, 'abababab-abab-4bab-8bab-abababababab'
  from public.communities c where c.slug = 'hill-crest';
select test.eq(test.visible($q$select id from public.events where slug = 'park-benches'$q$), 1::bigint,
  'a resident proposes a fundraising campaign and sees it');
reset role;
select test.act_as('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd');
select test.eq(test.visible($q$select id from public.events where slug = 'park-benches'$q$), 0::bigint,
  'other residents do not see it until approved');
reset role;
select test.act_as('99999999-9999-4999-8999-999999999999');
select test.raises(
  $q$update public.events set status = 'published' where slug = 'park-benches'$q$,
  'staff cannot approve a campaign');
reset role;
select test.act_as('88888888-8888-4888-8888-888888888888');
update public.events set status = 'published' where slug = 'park-benches';
reset role;
select test.act_as('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd');
select test.eq(test.visible($q$select id from public.events where slug = 'park-benches'$q$), 1::bigint,
  'once the committee approves, every resident sees it');

-- Suggestions: residents suggest, committee opens voting, one vote each.
reset role;
select test.act_as('abababab-abab-4bab-8bab-abababababab');
insert into public.activity_suggestions (id, community_id, event_id, kind, name, suggested_by)
select 'f1f1f1f1-0000-4000-8000-0000000000aa', m.community_id, 'cccccccc-0000-4000-8000-0000000000aa', 'activity',
       'Lantern walk', m.id
  from public.memberships m where m.user_id = 'abababab-abab-4bab-8bab-abababababab';
select test.raises(
  $q$insert into public.suggestion_votes (suggestion_id, membership_id, support)
     select 'f1f1f1f1-0000-4000-8000-0000000000aa', m.id, true
       from public.memberships m where m.user_id = 'abababab-abab-4bab-8bab-abababababab'$q$,
  'nobody votes on a suggestion before the committee approves it');

reset role;
select test.act_as('99999999-9999-4999-8999-999999999999');
select test.raises(
  $q$update public.activity_suggestions set status = 'accepted'
      where id = 'f1f1f1f1-0000-4000-8000-0000000000aa'$q$,
  'staff cannot approve a suggestion');
reset role;
select test.act_as('88888888-8888-4888-8888-888888888888');
update public.activity_suggestions set status = 'accepted' where id = 'f1f1f1f1-0000-4000-8000-0000000000aa';

reset role;
select test.act_as('abababab-abab-4bab-8bab-abababababab');
insert into public.suggestion_votes (suggestion_id, membership_id, support)
select 'f1f1f1f1-0000-4000-8000-0000000000aa', m.id, true
  from public.memberships m where m.user_id = 'abababab-abab-4bab-8bab-abababababab';
reset role;
select test.act_as('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd');
insert into public.suggestion_votes (suggestion_id, membership_id, support)
select 'f1f1f1f1-0000-4000-8000-0000000000aa', m.id, false
  from public.memberships m where m.user_id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd';
select test.raises(
  $q$insert into public.suggestion_votes (suggestion_id, membership_id, support)
     select 'f1f1f1f1-0000-4000-8000-0000000000aa', m.id, true
       from public.memberships m where m.user_id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd'$q$,
  'one vote per person, even from the same flat');
reset role;
select test.eq((select count(*)::int from public.suggestion_votes where suggestion_id = 'f1f1f1f1-0000-4000-8000-0000000000aa'),
  2, 'two people in the same flat each get a vote');
select test.act_as('99999999-9999-4999-8999-999999999999');
select test.raises(
  $q$insert into public.suggestion_votes (suggestion_id, membership_id, support)
     select 'f1f1f1f1-0000-4000-8000-0000000000aa', m.id, true
       from public.memberships m where m.user_id = '99999999-9999-4999-8999-999999999999'$q$,
  'staff do not vote');

-- ---------------------------------------------------------------------------
-- UPI payments: report, then staff confirm
-- ---------------------------------------------------------------------------
reset role;
select test.act_as('88888888-8888-4888-8888-888888888888');
update public.communities set upi_vpa = 'hillcrest.rwa@okaxis', upi_payee_name = 'Hill Crest RWA'
 where slug = 'hill-crest';
select test.eq((select upi_vpa from public.communities where slug = 'hill-crest'),
  'hillcrest.rwa@okaxis', 'the committee sets the society''s UPI ID');
select test.raises(
  $q$update public.communities set upi_vpa = 'not a vpa' where slug = 'hill-crest'$q$,
  'an invalid UPI ID is refused');

reset role;
select test.act_as('99999999-9999-4999-8999-999999999999');
update public.communities set upi_vpa = 'staff.personal@okicici' where slug = 'hill-crest';
reset role;
select test.eq((select upi_vpa from public.communities where slug = 'hill-crest'),
  'hillcrest.rwa@okaxis', 'staff cannot redirect payments to another UPI ID');

select test.act_as('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd');
select test.raises(
  $q$insert into public.contributions (event_id, community_id, membership_id, amount, method, reference, status)
     select 'cccccccc-0000-4000-8000-0000000000aa', m.community_id, m.id, 1001, 'upi', '612345678901', 'succeeded'
       from public.memberships m where m.user_id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd'$q$,
  'a resident cannot mark their own payment as confirmed');
insert into public.contributions (event_id, community_id, membership_id, amount, method, reference)
select 'cccccccc-0000-4000-8000-0000000000aa', m.community_id, m.id, 1001, 'upi', '612345678901'
  from public.memberships m where m.user_id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd';
select test.eq(
  (select status::text from public.contributions where reference = '612345678901'),
  'pending', 'a resident reports a UPI payment with its reference');
select test.raises(
  $q$insert into public.contributions (event_id, community_id, membership_id, amount, method, reference)
     select 'cccccccc-0000-4000-8000-0000000000aa', m.community_id, m.id, 1001, 'upi', ' 612345678901'
       from public.memberships m where m.user_id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd'$q$,
  'the same UPI reference cannot be reported twice');

-- Look the id up as the platform, so the resident below really calls the
-- function instead of RLS hiding the row and skipping the call.
reset role;
create temporary table t_upi as
select id from public.contributions where reference = '612345678901';
grant select on t_upi to authenticated;
select test.act_as('abababab-abab-4bab-8bab-abababababab');
select test.raises(
  format($q$select public.review_contribution('%s', true)$q$, (select id from t_upi)),
  'a resident cannot confirm a payment');

reset role;
select test.act_as('99999999-9999-4999-8999-999999999999');
select test.raises(
  $q$select public.review_contribution(c.id, false) from public.contributions c where c.reference = '612345678901'$q$,
  'turning a payment down needs a reason');
select test.eq(
  (select status::text from public.review_contribution(
     (select c.id from public.contributions c where c.reference = '612345678901'), true)),
  'succeeded', 'staff confirm it against the bank statement');
select test.raises(
  $q$select public.review_contribution(c.id, false, 'duplicate') from public.contributions c where c.reference = '612345678901'$q$,
  'and a confirmed payment cannot be reviewed again');

-- ---------------------------------------------------------------------------
-- Storage: bills and payment screenshots
-- ---------------------------------------------------------------------------
reset role;
select test.act_as('99999999-9999-4999-8999-999999999999');
insert into storage.objects (bucket_id, name)
select 'bills', c.id || '/cccccccc-0000-4000-8000-0000000000aa/lanterns.pdf'
  from public.communities c where c.slug = 'hill-crest';
insert into public.expenses (id, event_id, community_id, name, category, amount, vendor, requested_by, bill_url)
select 'dddddddd-0000-4000-8000-0000000000bb', 'cccccccc-0000-4000-8000-0000000000aa', m.community_id,
       'Lanterns', 'decoration', 1800, 'Paper Glow', m.id, m.community_id || '/cccccccc-0000-4000-8000-0000000000aa/lanterns.pdf'
  from public.memberships m where m.user_id = '99999999-9999-4999-8999-999999999999';
select test.eq(test.visible($q$select id from storage.objects where bucket_id = 'bills'$q$), 1::bigint,
  'staff upload a bill and can read it');

reset role;
select test.act_as('abababab-abab-4bab-8bab-abababababab');
select test.raises(
  $q$insert into storage.objects (bucket_id, name)
     select 'bills', c.id || '/cccccccc-0000-4000-8000-0000000000aa/fake.pdf'
       from public.communities c where c.slug = 'hill-crest'$q$,
  'a resident cannot upload bills');
select test.eq(test.visible($q$select id from storage.objects where bucket_id = 'bills'$q$), 0::bigint,
  'a resident cannot open a bill that is still pending');

reset role;
select test.act_as('88888888-8888-4888-8888-888888888888');
select public.review_expense('dddddddd-0000-4000-8000-0000000000bb', 'approved');

reset role;
select test.act_as('abababab-abab-4bab-8bab-abababababab');
select test.eq(test.visible($q$select id from storage.objects where bucket_id = 'bills'$q$), 1::bigint,
  'once approved, residents can open the bill');

reset role;
select test.act_as('99999999-9999-4999-8999-999999999999');
delete from storage.objects where bucket_id = 'bills';
reset role;
select test.eq((select count(*)::int from storage.objects where bucket_id = 'bills'), 1,
  'nobody can delete an approved bill''s file');

select test.act_as('abababab-abab-4bab-8bab-abababababab');
insert into storage.objects (bucket_id, name)
select 'payment-proofs', m.community_id || '/' || m.id || '/utr.png'
  from public.memberships m where m.user_id = 'abababab-abab-4bab-8bab-abababababab';
select test.raises(
  $q$insert into storage.objects (bucket_id, name)
     select 'payment-proofs', m.community_id || '/' || m.id || '/not-mine.png'
       from public.memberships m where m.user_id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd'$q$,
  'a resident cannot upload into someone else''s payment folder');

reset role;
select test.act_as('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd');
select test.eq(test.visible($q$select id from storage.objects where bucket_id = 'payment-proofs'$q$), 0::bigint,
  'a flatmate cannot see another person''s payment screenshot');

reset role;
select test.act_as('99999999-9999-4999-8999-999999999999');
select test.eq(test.visible($q$select id from storage.objects where bucket_id = 'payment-proofs'$q$), 1::bigint,
  'staff can see it to confirm the payment');

-- ---------------------------------------------------------------------------
-- Catalogue, flats and first-run welcome
-- ---------------------------------------------------------------------------
reset role;
select test.ok(
  (select count(*) from public.catalogue_items i join public.communities c on c.id = i.community_id
    where c.slug = 'hill-crest' and i.kind = 'event_type') >= 5,
  'a new society starts with a default catalogue');
select test.ok(
  (select count(*) from public.catalogue_items i join public.communities c on c.id = i.community_id
    where c.slug = 'hill-crest' and i.kind = 'budget_category') = 0,
  'but with no predefined budget categories');

select test.act_as('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd');
select test.ok(
  test.visible($q$select id from public.catalogue_items where kind = 'venue'$q$) > 0,
  'residents can read the catalogue to pick from it');
select test.raises(
  $q$insert into public.catalogue_items (community_id, kind, label)
     select c.id, 'vendor', 'Resident Vendor' from public.communities c where c.slug = 'hill-crest'$q$,
  'but cannot change it');

reset role;
select test.act_as('99999999-9999-4999-8999-999999999999');
insert into public.catalogue_items (community_id, kind, label, details)
select c.id, 'vendor', 'Shubh Tent House', '{"phone":"+919845000111"}'
  from public.communities c where c.slug = 'hill-crest';
select test.eq(test.visible($q$select id from public.catalogue_items where label = 'Shubh Tent House'$q$),
  1::bigint, 'staff add a vendor to the catalogue');
select test.raises(
  $q$insert into public.catalogue_items (community_id, kind, label)
     select c.id, 'vendor', ' shubh tent house ' from public.communities c where c.slug = 'hill-crest'$q$,
  'the same label cannot be added twice in a different case');
select test.raises(
  $q$insert into public.units (community_id, block, number)
     select c.id, 'Z', '999' from public.communities c where c.slug = 'hill-crest'$q$,
  'staff cannot add flats; the committee sets them up');

reset role;
select test.act_as('77777777-7777-4777-8777-777777777777');
select test.eq(test.visible($q$select i.id from public.catalogue_items i join public.communities c on c.id = i.community_id where c.slug = 'hill-crest'$q$),
  0::bigint, 'another society''s catalogue stays private');

reset role;
select test.act_as('88888888-8888-4888-8888-888888888888');
insert into public.units (community_id, block, number, floor)
select c.id, 'B', '201', 2 from public.communities c where c.slug = 'hill-crest';
select test.eq(test.visible($q$select id from public.units where block = 'B' and number = '201'$q$),
  1::bigint, 'the committee adds flats during setup');

reset role;
update public.memberships set welcomed_at = null where user_id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd';
select test.act_as('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd');
select public.mark_welcomed(c.id) from public.communities c where c.slug = 'hill-crest';
reset role;
select test.ok(
  (select welcomed_at is not null from public.memberships where user_id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd'),
  'a member marks their own welcome as seen');
update public.memberships set welcomed_at = null where user_id = 'abababab-abab-4bab-8bab-abababababab';
select test.act_as('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd');
select public.mark_welcomed(c.id) from public.communities c where c.slug = 'hill-crest';
reset role;
select test.ok(
  (select welcomed_at is null from public.memberships where user_id = 'abababab-abab-4bab-8bab-abababababab'),
  'and nobody else''s');

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
reset role;
truncate public.notifications;
insert into auth.users (id, email, raw_user_meta_data) values
  ('f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0', 'omar@example.com', '{"full_name":"Omar Sheikh"}');

select test.act_as('f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0');
create temporary table t_omar as
select * from public.request_to_join('HILL2026', 'b2b2b2b2-0000-4000-8000-000000000001', 'Omar Sheikh', '9845098450', 'tenant');
grant select on t_omar to authenticated;

reset role;
select test.eq(
  (select array_agg(m.role::text order by m.role::text) from public.notifications n
     join public.memberships m on m.user_id = n.user_id
     join public.communities c on c.id = m.community_id and c.slug = 'hill-crest'
    where n.kind = 'join_request'),
  array['committee', 'staff'], 'a join request notifies staff and committee, not residents');

select test.act_as('99999999-9999-4999-8999-999999999999');
select public.review_join_request((select request_id from t_omar), true);
reset role;
select test.eq(
  (select count(*)::int from public.notifications
    where kind = 'join_approved' and user_id = 'f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0'),
  1, 'the new resident is told they are in');

select test.act_as('f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0');
insert into public.contributions (event_id, community_id, membership_id, unit_id, amount, method, reference)
select 'cccccccc-0000-4000-8000-0000000000aa', m.community_id, m.id, 'b2b2b2b2-0000-4000-8000-000000000001', 501, 'upi', '698765432109'
  from public.memberships m where m.user_id = 'f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0';
select test.eq(test.visible($q$select id from public.notifications where kind = 'payment_reported'$q$), 0::bigint,
  'the payer is not notified about their own report');

reset role;
select test.eq((select count(*)::int from public.notifications where kind = 'payment_reported'), 2,
  'staff and committee are asked to confirm it');

select test.act_as('99999999-9999-4999-8999-999999999999');
select public.review_contribution(c.id, true) from public.contributions c where c.reference = '698765432109';
select public.mark_notifications_read();
reset role;
select test.eq(
  (select count(*)::int from public.notifications
    where kind = 'payment_confirmed' and user_id = 'f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0'),
  1, 'and the payer hears when it is confirmed');
select test.ok(
  (select bool_and(read_at is not null) from public.notifications where user_id = '99999999-9999-4999-8999-999999999999')
  and (select bool_and(read_at is null) from public.notifications where user_id = 'f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0'),
  'marking all read only touches the caller''s own notifications');

select test.act_as('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd');
select test.eq(test.visible($q$select id from public.notifications where kind = 'payment_confirmed'$q$), 0::bigint,
  'nobody reads another member''s notifications');

reset role;
select test.act_as('88888888-8888-4888-8888-888888888888');
select test.eq(
  (select contributors from public.event_stats where event_id = 'cccccccc-0000-4000-8000-0000000000aa'),
  2, 'contributors count households: two confirmed payments for flat A-1104 (staff cash and Omar) plus Tom''s count as two');

-- ---------------------------------------------------------------------------
-- To do queue
-- ---------------------------------------------------------------------------
reset role;
insert into auth.users (id, email, raw_user_meta_data) values
  ('a0a0a0a0-a0a0-4a0a-8a0a-a0a0a0a0a0a0', 'priya@example.com', '{"full_name":"Priya Das"}');
select test.act_as('a0a0a0a0-a0a0-4a0a-8a0a-a0a0a0a0a0a0');
select public.request_to_join('HILL2026', null, 'Priya Das', '9845011111', 'other');

reset role;
select test.act_as('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd');
insert into public.contributions (event_id, community_id, membership_id, amount, method, reference)
select 'cccccccc-0000-4000-8000-0000000000aa', m.community_id, m.id, 750, 'upi', '677700011122'
  from public.memberships m where m.user_id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd';
insert into public.activity_suggestions (community_id, event_id, kind, name, suggested_by)
select m.community_id, 'cccccccc-0000-4000-8000-0000000000aa', 'idea', 'Glow sticks for kids', m.id
  from public.memberships m where m.user_id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd';

reset role;
select test.act_as('99999999-9999-4999-8999-999999999999');
insert into public.expenses (event_id, community_id, name, category, amount, vendor, bill_url, requested_by)
select 'cccccccc-0000-4000-8000-0000000000aa', m.community_id, 'Sweets', 'Food & catering', 3200, 'Anand Sweets',
       'bills/sweets.pdf', m.id
  from public.memberships m where m.user_id = '99999999-9999-4999-8999-999999999999';
select test.eq(
  (select array_agg(distinct kind order by kind) from public.todo_items((select id from public.communities where slug = 'hill-crest'))),
  array['join_request', 'payment_to_confirm'],
  'staff see join requests and payments to confirm, not approvals that need the committee');

reset role;
select test.act_as('88888888-8888-4888-8888-888888888888');
-- Hill Crest's event has an approved bill and nothing collected yet, so it is
-- also overspent: somebody paid for the diyas and nobody has paid them back.
select test.eq(
  (select array_agg(distinct kind order by kind) from public.todo_items((select id from public.communities where slug = 'hill-crest'))),
  array['bill_to_approve', 'join_request', 'overspent', 'payment_to_confirm', 'suggestion_to_review'],
  'the committee also sees bills, campaigns, suggestions and overspent events to decide');

reset role;
select test.act_as('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd');
select test.eq(
  (select count(*) from public.todo_items((select id from public.communities where slug = 'hill-crest'))),
  0::bigint, 'residents have no admin to do list');

reset role;
select test.act_as('77777777-7777-4777-8777-777777777777');
select test.eq(
  (select count(*) from public.todo_items((select id from public.communities where slug = 'hill-crest'))),
  0::bigint, 'another society''s committee sees nothing');

reset role;

-- ---------------------------------------------------------------------------
-- todo_count() is the badge: it must always agree with todo_items()
-- ---------------------------------------------------------------------------
select test.act_as('99999999-9999-4999-8999-999999999999');
select test.eq(
  public.todo_count((select id from public.communities where slug = 'hill-crest'))::bigint,
  (select count(*) from public.todo_items((select id from public.communities where slug = 'hill-crest'))),
  'staff badge count matches their To do list');

reset role;
select test.act_as('88888888-8888-4888-8888-888888888888');
select test.eq(
  public.todo_count((select id from public.communities where slug = 'hill-crest'))::bigint,
  (select count(*) from public.todo_items((select id from public.communities where slug = 'hill-crest'))),
  'committee badge count matches their To do list');
select test.ok(
  public.todo_count((select id from public.communities where slug = 'hill-crest')) > 0,
  'the committee badge is not trivially zero');

reset role;
select test.act_as('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd');
select test.eq(
  public.todo_count((select id from public.communities where slug = 'hill-crest')),
  0, 'residents have no badge');

reset role;
select test.act_as('77777777-7777-4777-8777-777777777777');
select test.eq(
  public.todo_count((select id from public.communities where slug = 'hill-crest')),
  0, 'another society''s committee gets no count');

reset role;

-- ---------------------------------------------------------------------------
-- A society people actually live in cannot be deleted
-- ---------------------------------------------------------------------------
-- Founding from the app needs an undo for the society opened by mistake. It
-- must not become a way to cascade away a live ledger, so the guard closes the
-- moment anyone else is in.
reset role;
select test.act_as('88888888-8888-4888-8888-888888888888');
select test.raises(
  $q$delete from public.communities where slug = 'hill-crest'$q$,
  'even the founder cannot delete a society once others have joined');
select test.eq(
  (select count(*) from public.communities where slug = 'hill-crest'),
  1::bigint, 'and the society is still there');

reset role;

-- ---------------------------------------------------------------------------
-- One person, two societies, two different roles
-- ---------------------------------------------------------------------------
-- The committee member who founded Hill Crest also rents a flat in Green
-- Valley. Role is a property of the membership, not of the person, so every
-- permission has to resolve per society and never leak from the stronger one.
reset role;
insert into public.units (id, community_id, block, number)
select 'b3b3b3b3-0000-4000-8000-000000000001', c.id, 'C', '302'
  from public.communities c where c.slug = 'green-valley';
insert into public.memberships (community_id, user_id, role, status)
select c.id, '88888888-8888-4888-8888-888888888888', 'resident', 'active'
  from public.communities c where c.slug = 'green-valley';

select test.act_as('88888888-8888-4888-8888-888888888888');

select test.eq(test.visible('select id from public.communities'), 2::bigint,
  'one account can belong to two societies at once');
select test.eq(
  (select m.role::text from public.memberships m
     join public.communities c on c.id = m.community_id
    where c.slug = 'hill-crest' and m.user_id = '88888888-8888-4888-8888-888888888888'),
  'committee', 'committee in the society they founded');
select test.eq(
  (select m.role::text from public.memberships m
     join public.communities c on c.id = m.community_id
    where c.slug = 'green-valley' and m.user_id = '88888888-8888-4888-8888-888888888888'),
  'resident', 'and a plain resident in the other');

-- todo_count is role-sensitive, so it reads the two memberships apart.
select test.ok(
  public.todo_count((select id from public.communities where slug = 'hill-crest')) > 0,
  'their committee queue in one society is not empty');
select test.eq(
  public.todo_count((select id from public.communities where slug = 'green-valley')),
  0, 'and being committee elsewhere earns them no queue here');

-- Promoting someone is a committee act. Being committee in Hill Crest must buy
-- nothing in Green Valley: RLS narrows the statement to no rows, so it reports
-- success and changes nothing rather than raising.
update public.memberships m
   set role = 'staff'
  from public.communities c
 where c.id = m.community_id and c.slug = 'green-valley'
   and m.user_id = '44444444-4444-4444-8444-444444444444';

reset role;
select test.eq(
  (select m.role::text from public.memberships m
     join public.communities c on c.id = m.community_id
    where c.slug = 'green-valley'
      and m.user_id = '44444444-4444-4444-8444-444444444444'),
  'resident', 'committee in one society changes no roles in another');

-- ---------------------------------------------------------------------------
-- The people list: everyone sees who is here, not how to reach them
-- ---------------------------------------------------------------------------
-- society_people() is the only source for the directory, so a resident cannot
-- be handed a neighbour's phone number by a screen that forgot to drop it.
reset role;
select test.act_as('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd');

select test.ok(
  (select count(*) from public.society_people(
     (select id from public.communities where slug = 'hill-crest'))) > 1,
  'a resident sees the whole society in the directory');
select test.eq(
  (select count(*) from public.society_people(
     (select id from public.communities where slug = 'hill-crest'))
    where email is not null or phone is not null),
  0::bigint, 'and no contact details at all');
select test.ok(
  (select count(*) from public.society_people(
     (select id from public.communities where slug = 'hill-crest'))
    where role = 'committee') > 0,
  'roles are visible, so residents know who decides');

-- Staff keep the contact details they need to check somebody in.
reset role;
select test.act_as('99999999-9999-4999-8999-999999999999');
select test.ok(
  (select count(*) from public.society_people(
     (select id from public.communities where slug = 'hill-crest'))
    where email is not null) > 0,
  'staff still see contact details');

-- A different society's committee gets nothing, not a lean list.
reset role;
select test.act_as('77777777-7777-4777-8777-777777777777');
select test.eq(
  (select count(*) from public.society_people(
     (select id from public.communities where slug = 'hill-crest'))),
  0::bigint, 'the directory does not leak across societies');

reset role;

-- ---------------------------------------------------------------------------
-- Contact details are not a column a neighbour can select
-- ---------------------------------------------------------------------------
-- society_people() withheld email and phone from residents from the day it
-- shipped. profiles_select_self_or_neighbour is a *row* policy, so the table
-- underneath handed them over anyway. Column privileges settle it.
reset role;
update public.profiles set phone = '+919845012345'
 where id = '99999999-9999-4999-8999-999999999999';

select test.act_as('33333333-3333-4333-8333-333333333333');
select test.raises(
  $q$select phone from public.profiles where id = '99999999-9999-4999-8999-999999999999'$q$,
  'a member cannot read a neighbour''s phone straight from the table');
select test.raises(
  $q$select email from public.profiles limit 1$q$,
  'nor their email');
select test.ok(
  (select count(*) from (select full_name from public.profiles) t) > 1,
  'names are still readable — that is what a directory is for');

-- Your own, through the function that only ever answers for auth.uid().
select test.eq((select phone from public.my_contact()), '+919876543210',
  'you can still read your own number');
select test.eq((select count(*) from public.my_contact()), 1::bigint,
  'and only ever one row: your own');

-- Setting it is still allowed; the column grant is what makes that safe.
update public.profiles set phone = '+919845055555'
 where id = '33333333-3333-4333-8333-333333333333';
select test.eq((select phone from public.my_contact()), '+919845055555',
  'a member may set their own number');
select test.raises(
  $q$update public.profiles set is_platform_admin = true
      where id = '33333333-3333-4333-8333-333333333333'$q$,
  'and still cannot make themselves a platform admin');

-- ---------------------------------------------------------------------------
-- A vote nobody can watch you cast, and one that ends
-- ---------------------------------------------------------------------------
-- Hill Crest: Hana is the committee, Ria and Tom are residents, Sam is staff.
-- A fresh suggestion of its own, so nothing here depends on what earlier
-- sections left lying around.
reset role;
insert into public.activity_suggestions (community_id, name, kind, status, suggested_by)
select c.id, 'Terrace garden', 'idea', 'accepted', m.id
  from public.communities c
  join public.memberships m
    on m.community_id = c.id and m.user_id = 'abababab-abab-4bab-8bab-abababababab'
 where c.slug = 'hill-crest';

create temporary table t_ballot as
select s.id, s.community_id
  from public.activity_suggestions s
  join public.communities c on c.id = s.community_id
 where c.slug = 'hill-crest' and s.name = 'Terrace garden';
grant select on t_ballot to authenticated;

-- Two residents, one for and one against.
select test.act_as('abababab-abab-4bab-8bab-abababababab');
insert into public.suggestion_votes (suggestion_id, membership_id, support)
select b.id, app.my_membership_id(b.community_id), true from t_ballot b;

select test.eq(test.visible('select id from public.suggestion_votes where suggestion_id = (select id from t_ballot)'),
  1::bigint, 'you can see your own vote');

reset role;
select test.act_as('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd');
insert into public.suggestion_votes (suggestion_id, membership_id, support)
select b.id, app.my_membership_id(b.community_id), false from t_ballot b;

-- 0920.0300 narrowed the secret ballot: a vote in favour is public to the
-- society, a vote against is the committee's to see. Tom voted against, so he
-- sees his own row and Ria's public one.
select test.eq(test.visible('select id from public.suggestion_votes where suggestion_id = (select id from t_ballot)'),
  2::bigint, 'a neighbour who voted for it is named');
select test.eq(test.visible($q$select id from public.suggestion_votes
   where suggestion_id = (select id from t_ballot) and not support$q$),
  1::bigint, 'and the only vote against you can see is your own');

-- Ria voted for it, so there is nothing of Tom's for her to see.
reset role;
select test.act_as('abababab-abab-4bab-8bab-abababababab');
select test.eq(test.visible('select id from public.suggestion_votes where suggestion_id = (select id from t_ballot)'),
  1::bigint, 'while a resident never learns who voted against');

reset role;
select test.eq(
  (select votes_for + votes_against from public.suggestion_stats
    where suggestion_id = (select id from t_ballot)),
  2, 'though the tally counts both either way');

-- Staff run the society; they do not take part in it, so they cannot vote.
reset role;
select test.act_as('99999999-9999-4999-8999-999999999999');
select test.raises(
  $q$insert into public.suggestion_votes (suggestion_id, membership_id, support)
     select b.id, app.my_membership_id(b.community_id), true from t_ballot b$q$,
  'staff are not participants, so they have no vote');
select test.raises(
  $q$select public.close_suggestion_vote((select id from t_ballot))$q$,
  'nor can staff close one');
-- Staff are members, so the public "for" is public to them too. The "against"
-- is not: running the society is not the same as deciding for it.
select test.eq(test.visible('select id from public.suggestion_votes where suggestion_id = (select id from t_ballot)'),
  1::bigint, 'staff see the votes in favour, like any other member');

-- The committee sees the whole ballot, because they are the ones who have to
-- weigh an objection rather than just count it.
reset role;
select test.act_as('88888888-8888-4888-8888-888888888888');
select test.eq(test.visible('select id from public.suggestion_votes where suggestion_id = (select id from t_ballot)'),
  2::bigint, 'and the committee sees both sides');

-- The committee closes it, and the count decides: one for, one against.
reset role;
select test.act_as('88888888-8888-4888-8888-888888888888');
select test.eq(
  (select (public.close_suggestion_vote((select id from t_ballot))).status::text),
  'not_adopted', 'a tie is not a mandate');

-- Closing freezes it: every suggestion_votes policy keys on status='accepted'.
reset role;
select test.act_as('f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0');
select test.raises(
  $q$insert into public.suggestion_votes (suggestion_id, membership_id, support)
     select b.id, app.my_membership_id(b.community_id), true from t_ballot b$q$,
  'and a late vote is refused');

reset role;
select test.ok(
  (select resolved_at is not null from public.activity_suggestions
    where id = (select id from t_ballot)),
  'the decision is written down, not just implied by the numbers');
select test.act_as('88888888-8888-4888-8888-888888888888');
select test.eq(
  (select (public.close_suggestion_vote((select id from t_ballot))).status::text),
  'not_adopted', 'and closing it again changes nothing');
reset role;

-- ---------------------------------------------------------------------------
-- Comments: a thread hangs off the thing it is about
-- ---------------------------------------------------------------------------
reset role;
create temporary table t_thread as
select e.id as event_id, e.community_id
  from public.events e
  join public.communities c on c.id = e.community_id
 where c.slug = 'hill-crest' limit 1;
grant select on t_thread to authenticated;

select test.act_as('abababab-abab-4bab-8bab-abababababab');
insert into public.comments (community_id, event_id, membership_id, body)
select t.community_id, t.event_id, app.my_membership_id(t.community_id),
       'Can we start the rangoli at 6 instead?'
  from t_thread t;

select test.eq(test.visible('select id from public.comments'), 1::bigint,
  'a resident can leave a comment on an event');

-- Staff run the society and answer for it, so they are in the conversation
-- even though they have no vote in it.
reset role;
select test.act_as('99999999-9999-4999-8999-999999999999');
insert into public.comments (community_id, event_id, membership_id, body)
select t.community_id, t.event_id, app.my_membership_id(t.community_id),
       'The decorator arrives at 5.'
  from t_thread t;
select test.eq(test.visible('select id from public.comments'), 2::bigint,
  'staff can too, and everybody reads the whole thread');

-- The person who started the thread hears about the reply.
reset role;
select test.ok(
  (select count(*) from public.notifications
    where kind = 'comment'
      and user_id = 'abababab-abab-4bab-8bab-abababababab') > 0,
  'and whoever raised it is told');

-- A comment belongs to exactly one thing.
-- Both subjects at once.
select test.raises(
  $q$insert into public.comments (community_id, event_id, suggestion_id, membership_id, body)
     select t.community_id, t.event_id, s.id, app.my_membership_id(t.community_id), 'about two things'
       from t_thread t
       join public.activity_suggestions s on s.community_id = t.community_id limit 1$q$,
  'a comment about two things at once is refused');
-- And neither.
select test.raises(
  $q$insert into public.comments (community_id, event_id, suggestion_id, membership_id, body)
     select t.community_id, null, null, app.my_membership_id(t.community_id), 'about nothing'
       from t_thread t$q$,
  'and so is one about nothing');

-- Another society sees nothing of it.
select test.act_as('77777777-7777-4777-8777-777777777777');
select test.eq(test.visible('select id from public.comments'), 0::bigint,
  'a thread does not cross societies');

-- You may withdraw your own words; you may not rewrite somebody else's.
reset role;
select test.act_as('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd');
delete from public.comments;
reset role;
select test.eq((select count(*) from public.comments), 2::bigint,
  'a passer-by deletes nothing');

select test.act_as('abababab-abab-4bab-8bab-abababababab');
delete from public.comments where membership_id = app.my_membership_id(
  (select community_id from t_thread));
reset role;
select test.eq((select count(*) from public.comments), 1::bigint,
  'but you can take back what you said');

-- Staff can take down what should not have been said.
select test.act_as('99999999-9999-4999-8999-999999999999');
delete from public.comments;
reset role;
select test.eq((select count(*) from public.comments), 0::bigint,
  'and staff can take down anything');

-- ---------------------------------------------------------------------------
-- The WhatsApp group link
-- ---------------------------------------------------------------------------
reset role;
update public.communities set whatsapp_group_url = 'https://chat.whatsapp.com/AbCdEfGh12345678'
 where slug = 'hill-crest';
select test.eq(
  (select whatsapp_group_url from public.communities where slug = 'hill-crest'),
  'https://chat.whatsapp.com/AbCdEfGh12345678', 'a society can hold its group''s invite link');

select test.raises(
  $q$update public.communities set whatsapp_group_url = 'https://example.com/not-whatsapp'
      where slug = 'hill-crest'$q$,
  'and only an invite link: this is rendered as something people tap');
select test.raises(
  $q$update public.events set whatsapp_group_url = 'javascript:alert(1)'
      where id = (select event_id from t_thread)$q$,
  'an event''s link is held to the same shape');

-- ---------------------------------------------------------------------------
-- Money that counts names the person who said so
-- ---------------------------------------------------------------------------
-- Staff recording cash insert 'succeeded' straight away; before 0920.0200
-- nothing recorded who. A year later the books said a payment was accepted and
-- could not say by whom, which is the one question an audit asks.
reset role;
select test.act_as('99999999-9999-4999-8999-999999999999');
insert into public.contributions (event_id, community_id, unit_id, amount, method, status, channel)
select 'cccccccc-0000-4000-8000-0000000000aa', m.community_id,
       'b2b2b2b2-0000-4000-8000-000000000001', 500, 'cash', 'succeeded', 'system'
  from public.memberships m where m.user_id = '99999999-9999-4999-8999-999999999999';

select test.eq(
  (select p.full_name
     from public.contributions c
     join public.memberships m on m.id = c.verified_by
     join public.profiles p on p.id = m.user_id
    where c.method = 'cash' and c.amount = 500),
  'Sam Supervisor', 'staff recording cash are recorded as having confirmed it');
select test.ok(
  (select verified_at is not null from public.contributions
    where method = 'cash' and amount = 500),
  'and when they did');

-- ---------------------------------------------------------------------------
-- The audit log: what changed, who changed it, and no rubbing it out
-- ---------------------------------------------------------------------------
reset role;
select test.act_as('88888888-8888-4888-8888-888888888888');
update public.contributions set amount = 450
 where method = 'cash' and amount = 500;

select test.eq(
  (select (changed -> 'amount' ->> 'from')
     from public.audit_log
    where table_name = 'contributions' and action = 'update'
      and changed ? 'amount'
    order by at desc limit 1),
  '500.00', 'an edited amount keeps what it used to be');
select test.eq(
  (select (changed -> 'amount' ->> 'to')
     from public.audit_log
    where table_name = 'contributions' and action = 'update'
      and changed ? 'amount'
    order by at desc limit 1),
  '450.00', 'and what it became');
select test.eq(
  (select p.full_name
     from public.audit_log l
     join public.memberships m on m.id = l.actor_id
     join public.profiles p on p.id = m.user_id
    where l.table_name = 'contributions' and l.action = 'update' and l.changed ? 'amount'
    order by l.at desc limit 1),
  'Hana Iyer', 'and who did it');
select test.eq(
  (select updated_by from public.contributions where method = 'cash' and amount = 450),
  (select id from public.memberships m
     where m.user_id = '88888888-8888-4888-8888-888888888888'
       and m.community_id = (select id from public.communities where slug = 'hill-crest')),
  'the row itself says who touched it last');

-- The log is written by the trigger and by nothing else.
select test.raises(
  $q$insert into public.audit_log (community_id, table_name, row_id, action)
     select id, 'contributions', id, 'update' from public.communities where slug = 'hill-crest'$q$,
  'nobody can file an entry by hand');
select test.raises(
  $q$update public.audit_log set changed = '{}'::jsonb where id = (
        select max(id) from public.audit_log)$q$,
  'nor quietly correct one');
select test.raises(
  $q$delete from public.audit_log where id = (select max(id) from public.audit_log)$q$,
  'nor make one go away');

-- It holds every field of every change, including what a neighbour paid, so
-- it stops at staff. What a resident is owed is on the record itself.
reset role;
select test.act_as('abababab-abab-4bab-8bab-abababababab');
select test.eq(test.visible('select id from public.audit_log'), 0::bigint,
  'a resident cannot read the log');
reset role;
select test.act_as('99999999-9999-4999-8999-999999999999');
select test.ok(test.visible('select id from public.audit_log') > 0,
  'staff can');

-- ---------------------------------------------------------------------------
-- Reconciliation: the bank's version, next to ours
-- ---------------------------------------------------------------------------
reset role;
select test.act_as('88888888-8888-4888-8888-888888888888');
insert into public.bank_accounts (id, community_id, label, bank_name, last4)
select 'eeeeeeee-0000-4000-8000-0000000000aa', id, 'Current account', 'Axis', '4417'
  from public.communities where slug = 'hill-crest';

select test.raises(
  $q$insert into public.bank_accounts (community_id, label, last4)
     select id, 'Bad', '44177' from public.communities where slug = 'hill-crest'$q$,
  'an account number fragment is four digits or nothing');

-- A resident reports a payment; the statement then shows it arriving.
reset role;
select test.act_as('abababab-abab-4bab-8bab-abababababab');
insert into public.contributions (event_id, community_id, membership_id, amount, method, reference)
select 'cccccccc-0000-4000-8000-0000000000aa', m.community_id, m.id, 2001, 'upi', '755500011122'
  from public.memberships m where m.user_id = 'abababab-abab-4bab-8bab-abababababab';

reset role;
select test.act_as('99999999-9999-4999-8999-999999999999');
select test.eq(
  app.record_bank_lines('eeeeeeee-0000-4000-8000-0000000000aa', $j$[
    {"posted_on": "2026-09-16", "amount": 2001, "reference": "755500011122",
     "narration": "UPI/755500011122/RIA MENON", "counterparty": "Ria Menon"},
    {"posted_on": "2026-09-16", "amount": -350, "narration": "ACCOUNT MAINTENANCE CHARGE"}
  ]$j$),
  2, 'a statement goes in as lines');
select test.eq(
  app.record_bank_lines('eeeeeeee-0000-4000-8000-0000000000aa', $j$[
    {"posted_on": "2026-09-16", "amount": 2001, "reference": "755500011122",
     "narration": "UPI/755500011122/RIA MENON", "counterparty": "Ria Menon"}
  ]$j$),
  0, 'and the same statement imported twice is still one statement');

reset role;
create temporary table t_line as
select id, amount from public.bank_transactions where reference = '755500011122';
create temporary table t_charge as
select id from public.bank_transactions where narration = 'ACCOUNT MAINTENANCE CHARGE';
grant select on t_line, t_charge to authenticated;

select test.act_as('99999999-9999-4999-8999-999999999999');
select test.eq(
  (select confidence from public.bank_line_candidates((select id from t_line)) limit 1),
  'reference', 'the UTR the resident typed is matched against the one the bank saw');
select test.eq(
  (select payer from public.bank_line_candidates((select id from t_line)) limit 1),
  'Ria Menon', 'and the candidate says whose payment it would be');

select test.eq(
  (select status::text from public.reconcile_bank_line(
     (select id from t_line),
     (select contribution_id from public.bank_line_candidates((select id from t_line)) limit 1))),
  'succeeded', 'pairing the line with the payment confirms the money');
select test.eq(
  (select p.full_name
     from public.bank_transactions t
     join public.memberships m on m.id = t.matched_by
     join public.profiles p on p.id = m.user_id
    where t.id = (select id from t_line)),
  'Sam Supervisor', 'and the line records who paired it');
select test.raises(
  format($q$select public.reconcile_bank_line('%s', (select id from public.contributions
            where reference = '755500011122'))$q$, (select id from t_line)),
  'a line already matched cannot be spent twice');

-- Undoing it is the committee's call, not the desk's.
select test.raises(
  format($q$select public.unreconcile_bank_line('%s')$q$, (select id from t_line)),
  'staff cannot unpick a reconciliation');
reset role;
select test.act_as('88888888-8888-4888-8888-888888888888');
select public.unreconcile_bank_line((select id from t_line));
select test.eq(
  (select status::text from public.contributions where reference = '755500011122'),
  'pending', 'undoing the match puts the payment back to waiting');

-- A bank charge will never match anything; it is set aside, not deleted.
reset role;
select test.act_as('99999999-9999-4999-8999-999999999999');
select test.raises(
  format($q$select public.ignore_bank_line('%s', '  ')$q$, (select id from t_charge)),
  'setting a line aside needs a reason');
select public.ignore_bank_line((select id from t_charge), 'Bank charge');
select test.eq(
  (select unexplained_lines from public.reconciliation_summary
    where community_id = (select id from public.communities where slug = 'hill-crest')),
  1::bigint, 'and it stops counting as unexplained');

-- The feed is not for residents: a statement line carries the name and bank of
-- whoever sent the money.
reset role;
select test.act_as('abababab-abab-4bab-8bab-abababababab');
select test.eq(test.visible('select id from public.bank_transactions'), 0::bigint,
  'a resident cannot read the bank feed');
select test.eq(test.visible('select id from public.bank_accounts'), 0::bigint,
  'nor see which accounts the society keeps');
select test.raises(
  $q$select public.import_bank_lines('eeeeeeee-0000-4000-8000-0000000000aa',
       $j$[{"posted_on": "2026-09-16", "amount": 9999}]$j$)$q$,
  'nor post lines into it');

-- ---------------------------------------------------------------------------
-- One ledger, for everybody
-- ---------------------------------------------------------------------------
-- Confirmed money in and approved money out, across every event, readable by
-- any member. Unconfirmed reports are not in it: a ledger of claims is what
-- this replaces.
reset role;
select test.act_as('abababab-abab-4bab-8bab-abababababab');
select test.ok(
  test.visible($q$select id from public.society_ledger where direction = 'in'$q$) > 0,
  'a resident can see money the society received');
select test.ok(
  test.visible($q$select id from public.society_ledger where direction = 'out'$q$) > 0,
  'and what it was spent on');
select test.eq(
  test.visible($q$select id from public.society_ledger
                 where id = 'in:' || (select c.id::text from public.contributions c
                                       where c.reference = '755500011122')$q$),
  0::bigint, 'but not a payment nobody has confirmed');
select test.eq(
  (select counterpart from public.society_ledger
    where id = 'out:dddddddd-0000-4000-8000-0000000000bb'),
  'Paper Glow', 'a bill names the vendor it was paid to');
select test.eq(
  (select confirmed_by from public.society_ledger
    where id = 'out:dddddddd-0000-4000-8000-0000000000bb'),
  'Hana Iyer', 'and the committee member who approved it');

-- Who gave how much is what a contribution list has always said, so money in
-- names the payer and their flat — and stops there. A neighbour's phone and
-- email stay where society_people() keeps them.
--
-- The ids are looked up as the platform on purpose: a resident cannot select
-- either contribution row directly, so looking them up as Ria would compare
-- against null and pass without testing anything.
reset role;
create temporary table t_cash as
select 'in:' || id::text as ledger_id from public.contributions
 where method = 'cash' and amount = 450;
create temporary table t_named as
select 'in:' || id::text as ledger_id from public.contributions
 where reference = '612345678901';
grant select on t_cash, t_named to authenticated;

select test.act_as('abababab-abab-4bab-8bab-abababababab');
select test.eq(
  (select counterpart from public.society_ledger
    where id = (select ledger_id from t_named)),
  'Tom Menon', 'a neighbour can see who paid');
select test.eq(
  (select amount from public.society_ledger
    where id = (select ledger_id from t_named)),
  1001::numeric, 'and how much they paid');

-- ---------------------------------------------------------------------------
-- Both halves of the answer, on every row
-- ---------------------------------------------------------------------------
-- The ledger used to have one field for "who", so a row could say the name or
-- the flat and never both: a resident reporting their own payment records a
-- membership and no unit, staff recording cash record a unit and no
-- membership. Each half is recoverable from unit_occupants, and now is.
reset role;
insert into public.units (id, community_id, block, number)
select 'b2b2b2b2-0000-4000-8000-000000000002', c.id, 'A', '1105'
  from public.communities c where c.slug = 'hill-crest';
insert into public.unit_occupants (unit_id, membership_id, relation, is_primary, moved_in_on)
select 'b2b2b2b2-0000-4000-8000-000000000002', m.id, 'owner', true, current_date - 30
  from public.memberships m
  join public.communities c on c.id = m.community_id and c.slug = 'hill-crest'
 where m.user_id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd';

select test.act_as('abababab-abab-4bab-8bab-abababababab');
select test.eq(
  (select payer_name from public.society_ledger
    where id = (select ledger_id from t_named)),
  'Tom Menon', 'a payment that recorded no flat still names the payer');
select test.eq(
  (select unit_label from public.society_ledger
    where id = (select ledger_id from t_named)),
  'A 1105', 'and finds the flat they were living in when they paid');
select test.eq(
  (select method from public.society_ledger
    where id = (select ledger_id from t_named)),
  'Upi', 'and says how the money arrived');

-- Cash staff collected against a door names the flat's resident, and keeps the
-- flat beside it so nothing is being asserted that the row cannot show.
select test.eq(
  (select payer_name from public.society_ledger
    where id = (select ledger_id from t_cash)),
  'Omar Sheikh', 'money with no account behind it is named by whoever lives there');
select test.eq(
  (select unit_label from public.society_ledger
    where id = (select ledger_id from t_cash)),
  'A 1104', 'with the flat it was collected from');
select test.eq(
  (select method from public.society_ledger
    where id = (select ledger_id from t_cash)),
  'Cash', 'and how it was handed over');

-- The join is bounded by the occupancy dates, not by who lives there today.
-- The two lookups carry different risks, so they are bounded differently.
--
-- moved_in_on is not when somebody moved in: every path that seats a resident
-- writes current_date, the day they were typed into the app. A society
-- onboarding now gives everyone a move-in date of today, so a hard date bound
-- throws away the very rows it was meant to help.
--
-- Deciding *who paid* is where getting it wrong puts a neighbour's name
-- against money they never paid, so that one stays hard-bounded. Deciding
-- which flat to print beside a payer we have already identified is a label,
-- and falls back to where they live now.
reset role;
insert into public.contributions
  (id, event_id, community_id, membership_id, amount, method, status, reference, paid_at)
select 'dddddddd-0000-4000-8000-0000000000e1', 'cccccccc-0000-4000-8000-0000000000aa',
       m.community_id, m.id, 777, 'upi', 'succeeded', '601100022200',
       (current_date - 400)::timestamptz
  from public.memberships m where m.user_id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd';

-- Cash against a door, from long before the person now living there arrived.
insert into public.contributions
  (id, event_id, community_id, unit_id, amount, method, status, paid_at)
select 'dddddddd-0000-4000-8000-0000000000e2', 'cccccccc-0000-4000-8000-0000000000aa',
       c.id, 'b2b2b2b2-0000-4000-8000-000000000001',
       350, 'cash', 'succeeded', (current_date - 400)::timestamptz
  from public.communities c where c.slug = 'hill-crest';

select test.act_as('abababab-abab-4bab-8bab-abababababab');
select test.eq(
  (select payer_name from public.society_ledger
    where id = 'in:dddddddd-0000-4000-8000-0000000000e1'),
  'Tom Menon', 'an old payment still names who paid it');
select test.eq(
  (select unit_label from public.society_ledger
    where id = 'in:dddddddd-0000-4000-8000-0000000000e1'),
  'A 1105', 'and prints where they live now, because a move-in date is only when we typed it');

select test.eq(
  (select payer_name from public.society_ledger
    where id = 'in:dddddddd-0000-4000-8000-0000000000e2'),
  null, 'but cash from before the current resident arrived is never pinned on them');
select test.eq(
  (select unit_label from public.society_ledger
    where id = 'in:dddddddd-0000-4000-8000-0000000000e2'),
  'A 1104', 'it keeps the flat it was collected from, and says nothing more');

-- ---------------------------------------------------------------------------
-- Seating somebody after they have already joined
-- ---------------------------------------------------------------------------
-- The only two doors into a flat were request_to_join() and a unit-bound
-- invite code, both one-time and both at the moment of joining. The Flats page
-- counts occupants without being able to add one and Settings edits a name and
-- a phone, so a member who joined without a flat — every founder, until
-- 0922.0300 — had no way to ever have one.
reset role;
insert into public.units (id, community_id, block, number)
select 'b2b2b2b2-0000-4000-8000-000000000009', c.id, 'A', '1106'
  from public.communities c where c.slug = 'hill-crest';
create temporary table t_seat as
select m.id from public.memberships m
 where m.user_id = 'abababab-abab-4bab-8bab-abababababab'
   and m.community_id = (select id from public.communities where slug = 'hill-crest');
grant select on t_seat to authenticated;

-- Which flat somebody lives in decides who the ledger names against their
-- money. That is the committee's to answer for, not a resident's and not the
-- staff who run the events.
select test.act_as('abababab-abab-4bab-8bab-abababababab');
select test.eq(
  public.set_member_unit((select id from t_seat), 'b2b2b2b2-0000-4000-8000-000000000009'),
  'not_committee', 'a resident cannot put themselves in a flat');
select test.act_as('99999999-9999-4999-8999-999999999999');
select test.eq(
  public.set_member_unit((select id from t_seat), 'b2b2b2b2-0000-4000-8000-000000000009'),
  'not_committee', 'nor can the staff who run the events');

select test.act_as('88888888-8888-4888-8888-888888888888');
select test.eq(
  public.set_member_unit((select id from t_seat), 'b2b2b2b2-0000-4000-8000-000000000009'),
  'ok', 'the committee can');
reset role;
select test.eq(
  (select btrim(coalesce(u.block || ' ', '') || u.number)
     from public.unit_occupants o join public.units u on u.id = o.unit_id
    where o.membership_id = (select id from t_seat) and o.moved_out_on is null),
  'A 1106', 'and the member is living there afterwards');

-- Moving is the normal case, not a special one: a tenant leaves, an owner
-- arrives, somebody picked the wrong flat when they joined.
select test.act_as('88888888-8888-4888-8888-888888888888');
select test.eq(
  public.set_member_unit((select id from t_seat), 'b2b2b2b2-0000-4000-8000-000000000002'),
  'ok', 'moving them again is the same call');
reset role;
select test.eq(
  (select count(*)::int from public.unit_occupants o
    where o.membership_id = (select id from t_seat) and o.moved_out_on is null),
  1, 'a move does not stack a second flat on top of the first');
select test.eq(
  (select count(*)::int from public.unit_occupants o
    where o.membership_id = (select id from t_seat) and o.moved_out_on is not null),
  1, 'and the flat they left stays as history, so their old payments keep it');

-- A flat from another society would make the directory and the ledger nonsense.
select test.act_as('88888888-8888-4888-8888-888888888888');
select test.eq(
  public.set_member_unit((select id from t_seat), 'bbbbbbbb-0000-4000-8000-000000000002'),
  'wrong_community', 'a flat in someone else''s society is refused');
select test.eq(
  public.set_member_unit('dddddddd-dddd-4ddd-8ddd-dddddddddddd', null),
  'no_member', 'and a membership that does not exist is not a silent no-op');

-- Clearing is the other half: somebody who has moved out and not back in.
select test.act_as('88888888-8888-4888-8888-888888888888');
select test.eq(public.set_member_unit((select id from t_seat), null), 'ok',
  'the committee can take a member out of a flat as well');
reset role;
select test.eq(
  (select count(*)::int from public.unit_occupants o
    where o.membership_id = (select id from t_seat) and o.moved_out_on is null),
  0, 'and then they live nowhere, without their history being erased');

-- ---------------------------------------------------------------------------
-- A resident can say they moved
-- ---------------------------------------------------------------------------
-- Seating somebody is the committee's, because it decides who the ledger
-- names against their money. Saying "I moved" is the resident's, and until
-- 0922.0400 they had nowhere to say it — they could watch every payment they
-- made carry the wrong flat and not even mention it in the app.
reset role;
insert into public.units (id, community_id, block, number)
select 'b2b2b2b2-0000-4000-8000-00000000000a', c.id, 'C', '1102'
  from public.communities c where c.slug = 'hill-crest';

-- The seating block above left Ria living nowhere, so put her back in a flat:
-- this is about moving between two, not about being seated for the first time.
select test.act_as('88888888-8888-4888-8888-888888888888');
select public.set_member_unit((select id from t_seat), 'b2b2b2b2-0000-4000-8000-000000000009');

select test.act_as('abababab-abab-4bab-8bab-abababababab');
select test.eq(
  public.request_unit_change(
    (select id from public.communities where slug = 'hill-crest'),
    'b2b2b2b2-0000-4000-8000-00000000000a', 'Moved last month'),
  'ok', 'a resident can ask to be moved');

select test.eq(
  public.request_unit_change(
    (select id from public.communities where slug = 'hill-crest'),
    'b2b2b2b2-0000-4000-8000-00000000000a'),
  'ok', 'asking again is allowed');
reset role;
select test.eq(
  (select count(*)::int from public.unit_change_requests where status = 'pending'),
  1, 'and edits the question rather than queueing a second one');

-- Asking does not move anybody. If it did, the committee''s say would be a
-- formality and the ledger would follow whoever typed last.
select test.eq(
  (select btrim(coalesce(u.block || ' ', '') || u.number)
     from public.unit_occupants o join public.units u on u.id = o.unit_id
     join public.memberships m on m.id = o.membership_id
    where m.user_id = 'abababab-abab-4bab-8bab-abababababab'
      and m.community_id = (select id from public.communities where slug = 'hill-crest')
      and o.moved_out_on is null),
  'A 1106', 'asking does not move them');

select test.eq(
  (select count(*)::int from public.notifications
    where kind = 'unit_change_requested'),
  2, 'the committee is told, and told again when the question changes');

-- The queue is where the committee answers it.
select test.act_as('88888888-8888-4888-8888-888888888888');
select test.eq(
  (select count(*)::int from public.todo_items(
     (select id from public.communities where slug = 'hill-crest'))
    where kind = 'flat_change'),
  1, 'and it waits in the To do queue');
select test.act_as('99999999-9999-4999-8999-999999999999');
select test.eq(
  (select count(*)::int from public.todo_items(
     (select id from public.communities where slug = 'hill-crest'))
    where kind = 'flat_change'),
  0, 'staff do not see it, because it is not theirs to answer');

-- Only the committee answers. A resident approving their own move would make
-- the whole request a formality.
reset role;
create temporary table t_move as
select id from public.unit_change_requests where status = 'pending';
grant select on t_move to authenticated;

select test.act_as('abababab-abab-4bab-8bab-abababababab');
select test.eq(public.review_unit_change((select id from t_move), true),
  'not_committee', 'a resident cannot approve their own move');
select test.act_as('99999999-9999-4999-8999-999999999999');
select test.eq(public.review_unit_change((select id from t_move), true),
  'not_committee', 'nor can staff');

select test.act_as('88888888-8888-4888-8888-888888888888');
select test.eq(public.review_unit_change((select id from t_move), true), 'ok',
  'the committee can');
select test.eq(public.review_unit_change((select id from t_move), true),
  'already_decided', 'and a second click is a no-op, not an error');

reset role;
select test.eq(
  (select btrim(coalesce(u.block || ' ', '') || u.number)
     from public.unit_occupants o join public.units u on u.id = o.unit_id
     join public.memberships m on m.id = o.membership_id
    where m.user_id = 'abababab-abab-4bab-8bab-abababababab'
      and m.community_id = (select id from public.communities where slug = 'hill-crest')
      and o.moved_out_on is null),
  'C 1102', 'approving actually moves them');
select test.eq(
  (select count(*)::int from public.notifications
    where kind = 'unit_change_approved'),
  1, 'and the resident is told');

-- Asking for the flat you are already in is a misunderstanding worth naming.
select test.act_as('abababab-abab-4bab-8bab-abababababab');
select test.eq(
  public.request_unit_change(
    (select id from public.communities where slug = 'hill-crest'),
    'b2b2b2b2-0000-4000-8000-00000000000a'),
  'already_there', 'asking for the flat you are already in says so');
select test.eq(
  public.request_unit_change(
    (select id from public.communities where slug = 'hill-crest'),
    'bbbbbbbb-0000-4000-8000-000000000002'),
  'wrong_community', 'and a flat in another society is refused');

-- Nobody reads somebody else's request. It carries where they live and why
-- they say they moved.
select test.act_as('abababab-abab-4bab-8bab-abababababab');
select public.request_unit_change(
  (select id from public.communities where slug = 'hill-crest'), null, 'Moved out');
select test.act_as('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd');
select test.eq(test.visible('select id from public.unit_change_requests'), 0::bigint,
  'a neighbour cannot read a flat-change request');
select test.act_as('abababab-abab-4bab-8bab-abababababab');
select test.eq(test.visible('select id from public.unit_change_requests'), 2::bigint,
  'the person who asked can read their own, decided and open');

-- Every write goes through the two functions, so the table itself takes none.
-- Asserted by counting rather than by expecting an error: with no UPDATE
-- policy, RLS narrows the statement to no rows instead of refusing it, and an
-- update that quietly changes nothing looks like success to test.raises.
update public.unit_change_requests set status = 'approved';
reset role;
select test.eq(
  (select count(*)::int from public.unit_change_requests where status = 'pending'),
  1, 'and cannot approve their own by writing the row');

-- Seating somebody by hand answers what they were asking, rather than leaving
-- it in the queue for a click that would undo the flat just chosen.
select test.act_as('88888888-8888-4888-8888-888888888888');
select test.eq(
  public.set_member_unit(
    (select m.id from public.memberships m
      where m.user_id = 'abababab-abab-4bab-8bab-abababababab'
        and m.community_id = (select id from public.communities where slug = 'hill-crest')),
    'b2b2b2b2-0000-4000-8000-000000000009'),
  'ok', 'the committee can still seat somebody directly');
reset role;
select test.eq(
  (select count(*)::int from public.unit_change_requests where status = 'pending'),
  0, 'which settles the request they had open');
select test.eq(
  (select count(*)::int from public.notifications where kind = 'unit_change_declined'),
  1, 'and tells them a different flat was chosen');

-- ---------------------------------------------------------------------------
-- The evidence, to the people the bucket already opens it to
-- ---------------------------------------------------------------------------
-- A bill belongs to the whole society: it is the society's money being spent
-- by people the society elected. A UPI screenshot carries the payer's handle
-- and often their phone number, so it goes to the payer and to staff and
-- nobody else -- the same line storage draws, said here so a screen can
-- offer the button only when it will work.
reset role;
update public.contributions set proof_path =
  community_id::text || '/' || membership_id::text || '/upi.jpg'
 where reference = '612345678901';

select test.act_as('abababab-abab-4bab-8bab-abababababab');
select test.eq(
  (select document_url from public.society_ledger
    where id = (select ledger_id from t_named)),
  null, 'a neighbour is not handed somebody else''s payment screenshot');
select test.ok(
  (select document_url from public.society_ledger
    where id = 'out:dddddddd-0000-4000-8000-0000000000bb') is not null,
  'but an approved bill is every member''s to open');

select test.act_as('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd');
select test.ok(
  (select document_url from public.society_ledger
    where id = (select ledger_id from t_named)) like '%/upi.jpg',
  'the payer can open their own');

select test.act_as('99999999-9999-4999-8999-999999999999');
select test.ok(
  (select document_url from public.society_ledger
    where id = (select ledger_id from t_named)) like '%/upi.jpg',
  'and so can the staff who have to check it against the bank');

-- The ledger is a definer view, so what it does not select is the only thing
-- stopping it. Pin the column list: a later edit that adds a contact column
-- has to break this test first.
reset role;
select test.eq(
  (select string_agg(column_name, ',' order by column_name)
     from information_schema.columns
    where table_schema = 'public' and table_name = 'society_ledger'),
  'amount,community_id,confirmed_at,confirmed_by,counterpart,detail,direction,'
  'document_url,event_id,event_name,event_slug,happened_at,id,kind,membership_id,'
  'method,payer_name,receipt_no,unit_label',
  'and the ledger carries a name, a flat and a method, never a way to contact anyone');

select test.ok(
  (select balance = total_in - total_out from public.society_money
    where community_id = (select id from public.communities where slug = 'hill-crest')),
  'the totals add up to what is left');

-- ---------------------------------------------------------------------------
-- Nothing here is callable before you sign in
-- ---------------------------------------------------------------------------
-- `grant execute ... to authenticated` adds a grant; it does not remove the one
-- PostgreSQL already gave PUBLIC, which every role inherits. So a function that
-- looked staff-only was reachable by anon, and only its internal guard stopped
-- it — a guard nobody had decided should be load-bearing. 0920.0600 revokes
-- PUBLIC; this says so out loud, because the next function added here should
-- have a failing test to answer to rather than a comment to believe.
reset role;
select test.ok(
  not has_function_privilege('anon',
    'app.record_bank_lines(uuid,jsonb,public.bank_line_source)', 'EXECUTE'),
  'anon cannot post lines into a society''s bank feed');
select test.ok(
  not has_function_privilege('anon', 'public.import_bank_lines(uuid,jsonb)', 'EXECUTE'),
  'nor reach the same door through its public wrapper');
select test.ok(
  not has_function_privilege('anon', 'public.reconcile_bank_line(uuid,uuid,boolean)', 'EXECUTE'),
  'nor confirm money against a statement line');
select test.ok(
  not has_function_privilege('anon', 'public.member_history(uuid)', 'EXECUTE'),
  'nor ask what a member has paid');

-- 0920.0700 retired this exception. Joining needs a session: /join/CODE sends a
-- visitor without one to /login first, and mobile's index to /sign-in, so
-- request_to_join is only ever reached as `authenticated`. What a joiner lacks
-- is a membership, not an account, and confusing the two is what carved this
-- hole out in the first place.
select test.ok(
  not has_function_privilege('anon',
    'public.request_to_join(text,uuid,text,text,public.occupant_relation)', 'EXECUTE'),
  'and joining needs a session too — a joiner lacks a membership, not an account');
select test.ok(
  has_function_privilege('authenticated',
    'public.request_to_join(text,uuid,text,text,public.occupant_relation)', 'EXECUTE'),
  'which is exactly who the join form calls it as');

-- Nothing in `public` is callable before sign-in any more. Written as a sweep
-- rather than a list so a function added later is covered the day it lands,
-- instead of the day somebody remembers to extend a list.
select test.eq(
  (select count(*) from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
      and has_function_privilege('anon', p.oid, 'EXECUTE')),
  0::bigint,
  'no security definer function in public is callable by anon');

-- That sweep asks only about `public`, which is how forty definer functions in
-- `app` went unnoticed until 0920.0800: anon held EXECUTE on every one of them.
-- They were unreachable, because PostgREST exposes `public` and
-- `graphql_public` only — but that is project config in a dashboard, not a
-- grant, and this suite should not be resting on it. Reaching a function takes
-- USAGE on its schema as well as EXECUTE on the function, so the honest sweep
-- asks for both, and covers `app` the day somebody adds a function there.
select test.eq(
  (select count(*) from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'app') and p.prosecdef
      and has_schema_privilege('anon', n.oid, 'USAGE')
      and has_function_privilege('anon', p.oid, 'EXECUTE')),
  0::bigint,
  'no security definer function in public or app is reachable by anon');

select test.ok(
  not has_schema_privilege('anon', 'app', 'USAGE'),
  'anon cannot enter the app schema at all');

-- Taking that USAGE away must not cost the roles that do the work. It is the
-- SECURITY INVOKER paths that would notice: todo_items() lives in `public` and
-- calls app.flat_label(), so it runs on the caller's own privileges.
select test.ok(
  has_schema_privilege('authenticated', 'app', 'USAGE')
    and has_schema_privilege('service_role', 'app', 'USAGE'),
  'authenticated and service_role keep their way into app');

-- And the behaviour the revoke is not allowed to change. An RLS policy calling
-- app.is_member() keeps filtering for a role that cannot enter `app`, because
-- policy expressions are not privilege-checked against the querying role. This
-- reads a table with rows in it on purpose: an empty table never evaluates its
-- policy, so it would pass this whether or not the revoke broke anything.
reset role;
select test.ok(
  (select count(*) from public.events) > 0,
  'the policy check below is reading a table that actually has rows');

select test.act_anon();
select test.eq(
  (select count(*) from public.events),
  0::bigint,
  'anon still reads an empty events list rather than hitting a schema error');
reset role;

-- The roles that do the work keep it. service_role matters on its own: the
-- WhatsApp bot and the v1 API call these with it, and a revoke that took PUBLIC
-- and its grant together would break both silently.
select test.ok(
  has_function_privilege('service_role', 'public.review_contribution(uuid,boolean,text,text,numeric)', 'EXECUTE'),
  'the WhatsApp bot and the API keep their door');
select test.ok(
  has_function_privilege('authenticated', 'public.society_people(uuid)', 'EXECUTE'),
  'and a signed-in member can still read the directory');

-- Per-flat invite codes are a live feature, whatever 0913.0300's comment said
-- while revoking all three from authenticated — a revoke that did nothing,
-- because PUBLIC's grant stayed. 0920.0900 corrected the record: the codes stay.
--
-- So these two assertions are not two halves of one decision. The first is the
-- feature, and must not be swept away again by a security pass reading that
-- stale comment. The second is only that the redemption flow does not exist
-- yet: nothing anywhere calls redeem_invite_code, so it is granted to
-- service_role alone until the screen that needs it is written.
select test.ok(
  has_function_privilege('authenticated',
    'public.create_invite_code(uuid,public.member_role,uuid,public.occupant_relation,integer,timestamptz,text)',
    'EXECUTE'),
  'the committee can still mint a per-flat invite code');
select test.ok(
  has_function_privilege('authenticated',
    'public.redeem_invite_code(text,public.origin_channel)', 'EXECUTE'),
  'and since 0920.1000 a member can redeem one, because a screen now calls it');
select test.ok(
  has_function_privilege('authenticated', 'public.preview_invite_code(text)', 'EXECUTE'),
  'and see which society it is for before committing to it');

-- ---------------------------------------------------------------------------
-- Redeeming a code, end to end
-- ---------------------------------------------------------------------------
-- The functions were written whole in 0912.0500 and sat unreachable for a
-- fortnight, so nothing had ever exercised them from outside. This walks the
-- path a resident actually takes: a committee member mints a code against a
-- flat, somebody who is not a member previews it, redeems it, and lands inside
-- with the flat already theirs.
select test.act_as('11111111-1111-4111-8111-111111111111');
create temporary table redeem_probe as
select code from public.create_invite_code(
  'aaaaaaaa-0000-4000-8000-000000000001',   -- My Home Residency
  'resident',
  'bbbbbbbb-0000-4000-8000-000000000001',   -- flat A 101
  'owner',
  1,                                        -- one use only
  null,
  'A 101 owner');

select test.eq((select length(code) from redeem_probe), 8,
  'a minted code is eight characters of the no-lookalikes alphabet');

-- Ismail founded societies of his own but has never been near this one.
select test.act_as('b9b9b9b9-b9b9-4b9b-8b9b-b9b9b9b9b9b9');

select test.eq(
  (select p.status from redeem_probe r,
     lateral public.preview_invite_code(r.code) p),
  'ok', 'an outsider can look the code up before using it');
select test.eq(
  (select p.community_name from redeem_probe r,
     lateral public.preview_invite_code(r.code) p),
  'My Home Residency', 'and is told which society it lets them into');
select test.eq(
  (select p.unit_label from redeem_probe r,
     lateral public.preview_invite_code(r.code) p),
  'A 101', 'and which flat, so nobody joins by guessing');

select test.eq(
  (select d.status from redeem_probe r,
     lateral public.redeem_invite_code(r.code, 'web') d),
  'ok', 'redeeming it puts them in');
select test.eq(
  (select m.role::text from public.memberships m
    where m.community_id = 'aaaaaaaa-0000-4000-8000-000000000001'
      and m.user_id = 'b9b9b9b9-b9b9-4b9b-8b9b-b9b9b9b9b9b9'),
  'resident', 'with the role the code carried, already active');
select test.eq(
  (select count(*) from public.unit_occupants o
     join public.memberships m on m.id = o.membership_id
    where o.unit_id = 'bbbbbbbb-0000-4000-8000-000000000001'
      and m.user_id = 'b9b9b9b9-b9b9-4b9b-8b9b-b9b9b9b9b9b9'),
  1::bigint, 'and seated in the flat the code named');

reset role;
select test.eq(
  (select ic.used_count from public.invite_codes ic
     join redeem_probe r on r.code = ic.code),
  1, 'the use is counted');
select test.eq(
  (select count(*) from public.invite_code_redemptions red
     join public.invite_codes ic on ic.id = red.invite_code_id
     join redeem_probe r on r.code = ic.code),
  1::bigint, 'and written down, which nothing had ever done before');

-- Idempotent: the same person entering the same code again gets their seat
-- back rather than a second membership.
select test.act_as('b9b9b9b9-b9b9-4b9b-8b9b-b9b9b9b9b9b9');
select test.eq(
  (select d.status from redeem_probe r,
     lateral public.redeem_invite_code(r.code, 'web') d),
  'already_member', 'using it twice is not an error, just nothing new');
reset role;
select test.eq(
  (select count(*) from public.memberships m
    where m.community_id = 'aaaaaaaa-0000-4000-8000-000000000001'
      and m.user_id = 'b9b9b9b9-b9b9-4b9b-8b9b-b9b9b9b9b9b9'),
  1::bigint, 'and certainly not a second seat');

-- max_uses was one, and it is spent.
select test.act_as('66666666-6666-4666-8666-666666666666');
select test.eq(
  (select d.status from redeem_probe r,
     lateral public.redeem_invite_code(r.code, 'web') d),
  'exhausted', 'a one-use code does not let a second stranger in');
reset role;
select test.eq(
  (select count(*) from public.memberships m
    where m.community_id = 'aaaaaaaa-0000-4000-8000-000000000001'
      and m.user_id = '66666666-6666-4666-8666-666666666666'),
  0::bigint, 'and leaves them outside');

drop table redeem_probe;

-- And the people who should be able to call them still can.
select test.ok(
  has_function_privilege('authenticated', 'public.import_bank_lines(uuid,jsonb)', 'EXECUTE'),
  'a signed-in member is not locked out by the revoke');
select test.ok(
  has_function_privilege('service_role',
    'app.record_bank_lines(uuid,jsonb,public.bank_line_source)', 'EXECUTE'),
  'and a feed job under the service role keeps its door');

-- ---------------------------------------------------------------------------
-- A member's history: theirs, and the committee's to ask about
-- ---------------------------------------------------------------------------
reset role;
create temporary table t_ria as
select m.id from public.memberships m
 where m.user_id = 'abababab-abab-4bab-8bab-abababababab'
   and m.community_id = (select id from public.communities where slug = 'hill-crest');
grant select on t_ria to authenticated;

select test.act_as('abababab-abab-4bab-8bab-abababababab');
select test.ok(
  (select count(*) from public.member_history((select id from t_ria))) > 0,
  'you can see your own history');

reset role;
select test.act_as('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd');
select test.eq(
  (select count(*) from public.member_history((select id from t_ria))),
  0::bigint, 'a neighbour cannot see yours');

reset role;
select test.act_as('99999999-9999-4999-8999-999999999999');
select test.eq(
  (select count(*) from public.member_history((select id from t_ria))),
  0::bigint, 'nor can staff, who run the events rather than the household');

reset role;
select test.act_as('88888888-8888-4888-8888-888888888888');
select test.ok(
  (select count(*) from public.member_history((select id from t_ria))) > 0,
  'the committee can, because "has A-204 paid?" is asked at every meeting');
reset role;

-- ---------------------------------------------------------------------------
-- Deleting your account: what goes, and what a ledger has to keep
-- ---------------------------------------------------------------------------
-- Both stores require this before they will take the app at all, and the
-- Privacy Policy has described exactly what it does since it was written.
-- These are that description, as assertions.
reset role;
select test.ok(
  not has_function_privilege('anon', 'public.delete_my_account()', 'EXECUTE'),
  'a stranger cannot delete somebody''s account');
select test.ok(
  has_function_privilege('authenticated', 'public.delete_my_account()', 'EXECUTE'),
  'a signed-in member can delete their own');

-- Hana is the only committee member Hill Crest has, and Ria, Tom and the staff
-- member are still in it. Leaving would hand them a society nobody can run.
select test.act_as('88888888-8888-4888-8888-888888888888');
select test.eq(
  (select status from public.delete_my_account()), 'last_committee',
  'the last committee member of a society with residents in it is refused');
select test.eq(
  (select detail from public.delete_my_account()), 'Hill Crest',
  'and told which society is holding them, rather than just "no"');
reset role;
select test.eq(
  (select count(*) from auth.users where id = '88888888-8888-4888-8888-888888888888'),
  1::bigint, 'a refused deletion deletes nothing');

-- Dev is a resident of My Home Residency who gave ₹2000 to the Ganesh fund,
-- and owns flat A-102.
select test.act_as('44444444-4444-4444-8444-444444444444');
select test.eq(
  (select status from public.delete_my_account()), 'deleted',
  'a resident can delete their account');

reset role;
select test.eq(
  (select count(*) from auth.users where id = '44444444-4444-4444-8444-444444444444'),
  0::bigint, 'the account itself is gone, not just its profile');
select test.eq(
  (select count(*) from public.profiles where id = '44444444-4444-4444-8444-444444444444'),
  0::bigint, 'the profile goes with it');
select test.eq(
  (select count(*) from public.memberships where user_id = '44444444-4444-4444-8444-444444444444'),
  0::bigint, 'and every membership');
select test.eq(
  (select count(*) from public.unit_occupants o
     where o.unit_id = 'bbbbbbbb-0000-4000-8000-000000000002'),
  0::bigint, 'the flat no longer records them as living there');

-- The half the Privacy Policy is careful about: the money stays, unattached.
select test.eq(
  (select count(*) from public.contributions
    where event_id = 'cccccccc-0000-4000-8000-000000000001'
      and amount = 2000 and membership_id is null),
  1::bigint, 'the ₹2000 they gave is kept, and is no longer theirs');
select test.eq(
  (select sum(amount) from public.contributions
    where event_id = 'cccccccc-0000-4000-8000-000000000001'),
  7000::numeric, 'so the fund still adds up to what was actually collected');

-- Nobody is stranded by the only member of a society leaving it.
reset role;
insert into auth.users (id, email, raw_user_meta_data) values
  ('d0d0d0d0-d0d0-4d0d-8d0d-d0d0d0d0d0d0', 'nadia@example.com', '{"full_name":"Nadia Sheikh"}');
select test.act_as('d0d0d0d0-d0d0-4d0d-8d0d-d0d0d0d0d0d0');
select test.eq(
  (select status from public.create_society('Palm Court', 'Pune')), 'ok',
  'a founder opens a society and is its only member');
select test.eq(
  (select status from public.delete_my_account()), 'deleted',
  'and leaving strands nobody, so it is allowed');
reset role;
select test.eq(
  (select count(*) from public.communities where slug = 'palm-court'),
  0::bigint, 'the society goes with its last member, rather than sitting unreachable');
select test.eq(
  (select count(*) from public.communities where slug = 'green-valley'),
  1::bigint, 'a society that still has members is left alone');

-- ---------------------------------------------------------------------------
-- Money on its way, and what the committee asks each flat for
-- ---------------------------------------------------------------------------
-- The fund bar's promise: the headline total is confirmed money, and what has
-- been reported but not yet matched against the bank is a second number that
-- is never folded into the first.
--
-- Checked as the committee, who may read every contribution in their society,
-- so the aggregate can be held against the rows it claims to summarise. A
-- literal expected figure would only be restating this file's own fixtures.
reset role;
select test.act_as('88888888-8888-4888-8888-888888888888');

select test.eq(
  (select fund_pending from public.event_stats
    where event_id = 'cccccccc-0000-4000-8000-0000000000aa'),
  (select coalesce(sum(c.amount), 0) from public.contributions c
    where c.event_id = 'cccccccc-0000-4000-8000-0000000000aa' and c.status = 'pending'),
  'money on its way is exactly what has been reported and not confirmed');
select test.eq(
  (select fund_raised from public.event_stats
    where event_id = 'cccccccc-0000-4000-8000-0000000000aa'),
  (select coalesce(sum(c.amount), 0) from public.contributions c
    where c.event_id = 'cccccccc-0000-4000-8000-0000000000aa' and c.status = 'succeeded'),
  'and the raised total is confirmed money only, with none of it folded in');

create temporary table fund_before as
select fund_raised, fund_pending, pending_contributors
  from public.event_stats where event_id = 'cccccccc-0000-4000-8000-0000000000aa';

-- Tom reports ₹3,000 he has not been confirmed for.
reset role;
select test.act_as('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd');
insert into public.contributions (event_id, community_id, membership_id, amount, method, status)
select 'cccccccc-0000-4000-8000-0000000000aa', m.community_id, m.id, 3000, 'upi', 'pending'
  from public.memberships m where m.user_id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd';

reset role;
select test.act_as('88888888-8888-4888-8888-888888888888');
select test.eq(
  (select s.fund_pending - b.fund_pending
     from public.event_stats s, fund_before b
    where s.event_id = 'cccccccc-0000-4000-8000-0000000000aa'),
  3000::numeric, 'reporting it moves the money-on-its-way total by exactly that');
select test.eq(
  (select s.fund_raised - b.fund_raised
     from public.event_stats s, fund_before b
    where s.event_id = 'cccccccc-0000-4000-8000-0000000000aa'),
  0::numeric, 'and moves the raised total by nothing at all');
-- Tom had already reported once. A household that reports twice is one
-- household waiting, the same rule contributors has always counted by, which
-- is why the amount above moved and this does not.
select test.eq(
  (select s.pending_contributors - b.pending_contributors
     from public.event_stats s, fund_before b
    where s.event_id = 'cccccccc-0000-4000-8000-0000000000aa'),
  0::integer, 'a household reporting twice is still one household waiting');
select test.ok(
  (select pending_contributors from public.event_stats
    where event_id = 'cccccccc-0000-4000-8000-0000000000aa')
  < (select count(*) from public.contributions c
      where c.event_id = 'cccccccc-0000-4000-8000-0000000000aa' and c.status = 'pending'),
  'so there are fewer households waiting than there are reports');

drop table fund_before;

-- A resident sees the society's total, including what is on its way. They do
-- not see whose it is: the aggregate is public, the row behind it is not.
reset role;
select test.act_as('abababab-abab-4bab-8bab-abababababab');
select test.ok(
  (select fund_pending from public.event_stats
    where event_id = 'cccccccc-0000-4000-8000-0000000000aa') >= 3000,
  'a resident sees the society total including money on its way');
select test.eq(
  test.visible($q$select c.id from public.contributions c
                  join public.memberships m on m.id = c.membership_id
                 where m.user_id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd'$q$),
  0::bigint, 'but never the neighbour''s payment behind it');

-- What the committee asks each flat for.
reset role;
select test.act_as('88888888-8888-4888-8888-888888888888');
update public.events set suggested_amount = 2100
 where id = 'cccccccc-0000-4000-8000-0000000000aa';
reset role;
select test.eq(
  (select suggested_amount from public.events
    where id = 'cccccccc-0000-4000-8000-0000000000aa'),
  2100::numeric, 'the committee names a figure on the event');

select test.act_as('88888888-8888-4888-8888-888888888888');
select test.raises(
  $q$update public.events set suggested_amount = 0
      where id = 'cccccccc-0000-4000-8000-0000000000aa'$q$,
  'a figure of zero is not an ask, and is refused');
select test.raises(
  $q$update public.events set suggested_amount = -500
      where id = 'cccccccc-0000-4000-8000-0000000000aa'$q$,
  'nor is a negative one');

reset role;
select test.act_as('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd');
update public.events set suggested_amount = 1
 where id = 'cccccccc-0000-4000-8000-0000000000aa';
reset role;
select test.eq(
  (select suggested_amount from public.events
    where id = 'cccccccc-0000-4000-8000-0000000000aa'),
  2100::numeric, 'a resident cannot decide what the society asks for');

-- ---------------------------------------------------------------------------
-- The reference can arrive later
-- ---------------------------------------------------------------------------
-- A resident on an iPhone uploads the screenshot and types no twelve-digit
-- reference. Whoever confirms the payment has the bank statement open and the
-- screenshot in front of them, so the reference is recorded then.
reset role;
select test.act_as('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd');
insert into public.contributions
  (id, event_id, community_id, membership_id, amount, method, status, reference, proof_path)
select 'dddddddd-0000-4000-8000-00000000000a',
       'cccccccc-0000-4000-8000-0000000000aa', m.community_id, m.id,
       4100, 'upi', 'pending', null, 'proof/one.jpg'
  from public.memberships m where m.user_id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd';

reset role;
select test.eq(
  (select reference from public.contributions where id = 'dddddddd-0000-4000-8000-00000000000a'),
  null::text, 'a payment can be reported with a screenshot and no reference');

select test.act_as('99999999-9999-4999-8999-999999999999');
select public.review_contribution(
  'dddddddd-0000-4000-8000-00000000000a', true, null, '612345678999');
reset role;
select test.eq(
  (select reference from public.contributions where id = 'dddddddd-0000-4000-8000-00000000000a'),
  '612345678999', 'and staff record the reference they read off it when confirming');
select test.eq(
  (select status::text from public.contributions
    where id = 'dddddddd-0000-4000-8000-00000000000a'),
  'succeeded', 'which confirms the payment in the same act');

-- A mistyped digit is correctable, because the person confirming is the one
-- holding the evidence.
select test.act_as('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd');
insert into public.contributions
  (id, event_id, community_id, membership_id, amount, method, status, reference)
select 'dddddddd-0000-4000-8000-00000000000b',
       'cccccccc-0000-4000-8000-0000000000aa', m.community_id, m.id,
       4200, 'upi', 'pending', '600000000001'
  from public.memberships m where m.user_id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd';

reset role;
select test.act_as('99999999-9999-4999-8999-999999999999');
select public.review_contribution(
  'dddddddd-0000-4000-8000-00000000000b', true, null, '600000000002');
reset role;
select test.eq(
  (select reference from public.contributions where id = 'dddddddd-0000-4000-8000-00000000000b'),
  '600000000002', 'staff correct a reference the resident mistyped');

-- Confirming without one changes nothing, so the one-tap confirm still works.
select test.act_as('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd');
insert into public.contributions
  (id, event_id, community_id, membership_id, amount, method, status, reference)
select 'dddddddd-0000-4000-8000-00000000000c',
       'cccccccc-0000-4000-8000-0000000000aa', m.community_id, m.id,
       4300, 'upi', 'pending', '600000000003'
  from public.memberships m where m.user_id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd';

reset role;
select test.act_as('99999999-9999-4999-8999-999999999999');
select public.review_contribution('dddddddd-0000-4000-8000-00000000000c', true);
reset role;
select test.eq(
  (select reference from public.contributions where id = 'dddddddd-0000-4000-8000-00000000000c'),
  '600000000003', 'and confirming without one leaves what was there alone');

-- The revoke that dropping and recreating a function would have undone.
select test.ok(
  not has_function_privilege('anon', 'public.review_contribution(uuid,boolean,text,text,numeric)', 'EXECUTE'),
  'a stranger cannot confirm a payment');
select test.ok(
  has_function_privilege('authenticated', 'public.review_contribution(uuid,boolean,text,text,numeric)', 'EXECUTE'),
  'and staff still can');

-- ---------------------------------------------------------------------------
-- The note says whose money it is
-- ---------------------------------------------------------------------------
reset role;
select test.eq(app.flat_tag_in('UPI/CR/612345678901/RIA MENON/HDFC/SMDA1104 GANESH'),
  'A1104', 'the flat is found in a narration the bank has wrapped in its own punctuation');
select test.eq(app.flat_tag_in('upi-smda1104-612345678901'), 'A1104',
  'however the bank cased it');
select test.eq(app.flat_tag_in('UPI/CR/612345678901/RIA MENON/HDFC'), null::text,
  'and is null when the payer did not keep the note');
select test.eq(app.normalize_flat('A-1104'), app.normalize_flat('a 1104'),
  'a flat is the same flat however it is punctuated');

-- Ria reports ₹2,100 for her flat and actually sends ₹2,000. Before the note
-- was read back, the candidate list for that line was empty: the amounts are
-- ₹100 apart, and the reported figure is the payer's own.
select test.act_as('abababab-abab-4bab-8bab-abababababab');
insert into public.contributions
  (id, event_id, community_id, membership_id, unit_id, amount, method, status)
select 'dddddddd-0000-4000-8000-00000000000d',
       'cccccccc-0000-4000-8000-0000000000aa', m.community_id, m.id,
       'b2b2b2b2-0000-4000-8000-000000000001', 2100, 'upi', 'pending'
  from public.memberships m where m.user_id = 'abababab-abab-4bab-8bab-abababababab';

-- And a neighbour reports exactly ₹2,000, so amount alone would pick the wrong one.
reset role;
select test.act_as('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd');
insert into public.contributions
  (id, event_id, community_id, membership_id, amount, method, status)
select 'dddddddd-0000-4000-8000-00000000000e',
       'cccccccc-0000-4000-8000-0000000000aa', m.community_id, m.id,
       2000, 'upi', 'pending'
  from public.memberships m where m.user_id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd';

reset role;
select test.act_as('99999999-9999-4999-8999-999999999999');
-- Posted today, because the payments it should match were reported today: the
-- matcher looks a fortnight either side of the line, so a fixed date here
-- stopped matching anything once the calendar moved past it.
select test.eq(
  app.record_bank_lines('eeeeeeee-0000-4000-8000-0000000000aa', jsonb_build_array(
    jsonb_build_object(
      'posted_on', current_date::text, 'amount', 2000,
      'narration', 'UPI/CR/799900022233/RIA MENON/HDFC/SMDA1104 GANESH'))),
  1, 'a credit arrives naming the flat that sent it');

reset role;
create temporary table t_tagged as
select id from public.bank_transactions
 where narration = 'UPI/CR/799900022233/RIA MENON/HDFC/SMDA1104 GANESH';
grant select on t_tagged to authenticated;

select test.act_as('99999999-9999-4999-8999-999999999999');
select test.eq(
  (select confidence from public.bank_line_candidates((select id from t_tagged)) limit 1),
  'flat', 'the flat the line names outranks a neighbour whose amount happens to match');
-- Which of that flat's payments comes first is decided by how close in time
-- it is, and the flat has more than one waiting. What matters is that the top
-- candidate belongs to the flat the line named, rather than to the neighbour
-- whose amount happens to be exact.
select test.eq(
  (select app.normalize_flat(app.flat_label(c.unit_id))
     from public.bank_line_candidates((select id from t_tagged)) cand
     join public.contributions c on c.id = cand.contribution_id
    limit 1),
  'A1104', 'and the payment offered belongs to the flat the line named');
select test.ok(
  (select count(*) from public.bank_line_candidates((select id from t_tagged))
    where contribution_id = 'dddddddd-0000-4000-8000-00000000000d') = 1,
  'her ₹2,100 report is on the list at all, though she sent ₹100 less');
select test.ok(
  (select count(*) from public.bank_line_candidates((select id from t_tagged))
    where contribution_id = 'dddddddd-0000-4000-8000-00000000000e') = 1,
  'and the exact-amount neighbour is still offered, just not first');

-- Pairing them is what the spec has always described: a person decides which
-- figure the books keep.
select test.eq(
  (select status::text from public.reconcile_bank_line(
     (select id from t_tagged), 'dddddddd-0000-4000-8000-00000000000d')),
  'succeeded', 'and the pairing the list could not reach before now goes through');

reset role;
drop table t_tagged;

select test.ok(
  not has_function_privilege('anon', 'public.bank_line_candidates(uuid)', 'EXECUTE'),
  'recreating the matcher did not hand it back to anon');
select test.ok(
  has_function_privilege('authenticated', 'public.bank_line_candidates(uuid)', 'EXECUTE'),
  'and staff can still call it');

-- ---------------------------------------------------------------------------
-- Nobody signs off their own money
-- ---------------------------------------------------------------------------
-- Every rule below is read twice, because the interesting case is the society
-- where there is nobody else to read it to. Green Valley has two committee
-- members, Asha and Bala. Hill Crest has one, Hana.

reset role;
select test.act_as('88888888-8888-4888-8888-888888888888');
select test.ok(
  app.sole_committee_member((select c.id from public.communities c where c.slug = 'hill-crest')),
  'Hill Crest''s founder is the whole of its committee');
select test.ok(
  not app.sole_committee_member('aaaaaaaa-0000-4000-8000-000000000001'),
  'and carries no such hatch into the society where she is only a resident');

reset role;
select test.act_as('11111111-1111-4111-8111-111111111111');
select test.ok(
  not app.sole_committee_member('aaaaaaaa-0000-4000-8000-000000000001'),
  'a committee of two is never a committee of one');

-- A live event to spend against: Green Valley's Ganesh ledger was closed
-- further up, and a closed ledger refuses everything below on its own terms.
insert into public.events (id, community_id, slug, name, starts_on, fund_target, created_by)
values ('cccccccc-0000-4000-8000-0000000000f1', 'aaaaaaaa-0000-4000-8000-000000000001',
        'gv-onam-2026', 'Green Valley Onam 2026', '2026-09-05', 30000,
        '11111111-1111-4111-8111-111111111111');
update public.events set status = 'published'
 where id = 'cccccccc-0000-4000-8000-0000000000f1';

-- Asha uploads a bill and Bala approves it, which is the rule working.
insert into public.expenses
  (id, event_id, community_id, name, amount, vendor, bill_url, requested_by)
values ('dddddddd-0000-4000-8000-0000000000f1', 'cccccccc-0000-4000-8000-0000000000f1',
        'aaaaaaaa-0000-4000-8000-000000000001', 'Pandal', 12000, 'Sree Decorators',
        'aaaaaaaa-0000-4000-8000-000000000001/cccccccc-0000-4000-8000-0000000000f1/pandal.pdf',
        app.my_membership_id('aaaaaaaa-0000-4000-8000-000000000001'));

reset role;
select test.act_as('22222222-2222-4222-8222-222222222222');
select test.eq(
  (select status::text from public.review_expense('dddddddd-0000-4000-8000-0000000000f1', 'approved')),
  'approved', 'Bala approves the bill Asha uploaded');

-- Asha then revises it. Nothing in the request says to un-approve it; the
-- database says so, because the client is not the only way in.
reset role;
select test.act_as('11111111-1111-4111-8111-111111111111');
update public.expenses
   set amount = 13500,
       bill_url = 'aaaaaaaa-0000-4000-8000-000000000001/cccccccc-0000-4000-8000-0000000000f1/pandal-v2.pdf'
 where id = 'dddddddd-0000-4000-8000-0000000000f1';
select test.eq(
  (select spent from public.event_stats where event_id = 'cccccccc-0000-4000-8000-0000000000f1'),
  0::numeric(12,2), 'a revised bill stops being spending until it is approved again');

reset role;
select test.eq(
  (select status::text from public.expenses where id = 'dddddddd-0000-4000-8000-0000000000f1'),
  'pending', 'a revised bill goes back for approval');
select test.ok(
  (select approved_by is null and approved_at is null from public.expenses
    where id = 'dddddddd-0000-4000-8000-0000000000f1'),
  'and stops claiming somebody signed off a number they never saw');
select test.eq(
  (select p.full_name from public.expenses e
     join public.memberships m on m.id = e.revised_by
     join public.profiles p on p.id = m.user_id
    where e.id = 'dddddddd-0000-4000-8000-0000000000f1'),
  'Asha Menon', 'naming whoever wrote the version now on the table');

select test.act_as('11111111-1111-4111-8111-111111111111');
select test.raises(
  $q$select public.review_expense('dddddddd-0000-4000-8000-0000000000f1', 'approved')$q$,
  'which is the one person who may not approve it');

-- The queue has to agree, or the badge counts a button the database refuses.
select test.eq(
  (select count(*) from public.todo_items('aaaaaaaa-0000-4000-8000-000000000001')
    where kind = 'bill_to_approve' and id = 'dddddddd-0000-4000-8000-0000000000f1'),
  0::bigint, 'so her queue does not offer it to her');
select test.eq(
  public.todo_count('aaaaaaaa-0000-4000-8000-000000000001')::bigint,
  (select count(*) from public.todo_items('aaaaaaaa-0000-4000-8000-000000000001')),
  'and the badge still counts exactly what the queue lists');

reset role;
select test.act_as('22222222-2222-4222-8222-222222222222');
select test.eq(
  (select count(*) from public.todo_items('aaaaaaaa-0000-4000-8000-000000000001')
    where kind = 'bill_to_approve' and id = 'dddddddd-0000-4000-8000-0000000000f1'),
  1::bigint, 'while Bala is asked to look at it');

reset role;
select test.act_as('22222222-2222-4222-8222-222222222222');
select test.eq(
  (select status::text from public.review_expense('dddddddd-0000-4000-8000-0000000000f1', 'approved')),
  'approved', 'somebody else on the committee can, though they uploaded none of it');

-- The closed ledger still wins. Green Valley's Ganesh bill was approved before
-- the event closed; revising it now is the same edit by another name.
reset role;
select test.act_as('11111111-1111-4111-8111-111111111111');
select test.raises(
  $q$update public.expenses set amount = 99
      where id = 'dddddddd-0000-4000-8000-000000000001'$q$,
  'and a closed event''s bill cannot be revised out from under it');

-- Hill Crest has nobody else. A rule that cannot be satisfied is not a control.
reset role;
select test.act_as('88888888-8888-4888-8888-888888888888');
insert into public.expenses (id, event_id, community_id, name, amount, vendor, bill_url, requested_by)
select 'dddddddd-0000-4000-8000-0000000000f2', 'cccccccc-0000-4000-8000-0000000000aa',
       c.id, 'Marquee', 9000, 'Tent House', 'bills/marquee.pdf', app.my_membership_id(c.id)
  from public.communities c where c.slug = 'hill-crest';
select test.eq(
  (select count(*) from public.todo_items((select c.id from public.communities c where c.slug = 'hill-crest'))
    where kind = 'bill_to_approve' and id = 'dddddddd-0000-4000-8000-0000000000f2'),
  1::bigint, 'and her queue is where she finds it, rather than hiding it from her');
select test.eq(
  (select status::text from public.review_expense('dddddddd-0000-4000-8000-0000000000f2', 'approved')),
  'approved', 'the only committee member a society has approves her own bill');

-- Payments, which never had the rule at all.
reset role;
select test.act_as('22222222-2222-4222-8222-222222222222');
insert into public.contributions
  (id, event_id, community_id, membership_id, amount, method, status, reference)
select 'dddddddd-0000-4000-8000-0000000000f3', 'cccccccc-0000-4000-8000-0000000000f1',
       m.community_id, m.id, 5000, 'upi', 'pending', '700000000001'
  from public.memberships m
 where m.user_id = '22222222-2222-4222-8222-222222222222'
   and m.community_id = 'aaaaaaaa-0000-4000-8000-000000000001';
select test.raises(
  $q$select public.review_contribution('dddddddd-0000-4000-8000-0000000000f3', true)$q$,
  'a committee member cannot confirm the payment they reported themselves');
select test.eq(
  (select count(*) from public.todo_items('aaaaaaaa-0000-4000-8000-000000000001')
    where kind = 'payment_to_confirm' and id = 'dddddddd-0000-4000-8000-0000000000f3'),
  0::bigint, 'and his queue does not offer it to him');

reset role;
select test.act_as('11111111-1111-4111-8111-111111111111');
select test.eq(
  (select status::text from public.review_contribution('dddddddd-0000-4000-8000-0000000000f3', true)),
  'succeeded', 'somebody else on the committee confirms it');

-- Chitra reports ₹1,000 and ₹10 arrived. (Not Dev, who deleted his account
-- further up — the suite's own fixtures outlive their owners.)
reset role;
select test.act_as('33333333-3333-4333-8333-333333333333');
insert into public.contributions
  (id, event_id, community_id, membership_id, unit_id, amount, method, status, proof_path)
select 'dddddddd-0000-4000-8000-0000000000f4', 'cccccccc-0000-4000-8000-0000000000f1',
       m.community_id, m.id, o.unit_id, 1000, 'upi', 'pending',
       'aaaaaaaa-0000-4000-8000-000000000001/' || m.id::text || '/chitra.jpg'
  from public.memberships m
  join public.unit_occupants o on o.membership_id = m.id
 where m.user_id = '33333333-3333-4333-8333-333333333333';
select test.eq(
  (select amount from public.contributions where id = 'dddddddd-0000-4000-8000-0000000000f4'),
  1000::numeric(12,2), 'a resident reports the figure they believe they sent');

reset role;
select test.act_as('55555555-5555-4555-8555-555555555555');
select test.raises(
  $q$select public.review_contribution(
       'dddddddd-0000-4000-8000-0000000000f4', true, null, null, 10)$q$,
  'staff hold the bank statement but not the pen');

reset role;
select test.act_as('11111111-1111-4111-8111-111111111111');
select test.raises(
  $q$select public.review_contribution(
       'dddddddd-0000-4000-8000-0000000000f4', true, null, null, 0)$q$,
  'nor can the committee correct a payment down to nothing');
select test.eq(
  (select amount from public.review_contribution(
     'dddddddd-0000-4000-8000-0000000000f4', true, 'The bank shows ₹10', null, 10)),
  10::numeric(12,2), 'the committee writes down what the bank actually shows');
select test.eq(
  (select fund_raised from public.event_stats where event_id = 'cccccccc-0000-4000-8000-0000000000f1'),
  5010::numeric(12,2), 'and every total follows the corrected figure, not the reported one');

reset role;
select test.eq(
  (select reported_amount from public.contributions
    where id = 'dddddddd-0000-4000-8000-0000000000f4'),
  1000::numeric(12,2), 'with what the resident said kept beside it');
select test.ok(
  exists (
    select 1 from public.notifications n
     where n.user_id = '33333333-3333-4333-8333-333333333333'
       and n.kind = 'payment_confirmed'
       and n.body like 'You reported ₹1,000; the committee recorded ₹10 %'
  ),
  'and the resident told, in both figures, rather than left to notice');

-- And again, in the society with nobody else to ask.
reset role;
select test.act_as('88888888-8888-4888-8888-888888888888');
insert into public.contributions
  (id, event_id, community_id, membership_id, amount, method, status, reference)
select 'dddddddd-0000-4000-8000-0000000000f5', 'cccccccc-0000-4000-8000-0000000000aa',
       c.id, app.my_membership_id(c.id), 2100, 'upi', 'pending', '700000000002'
  from public.communities c where c.slug = 'hill-crest';
select test.eq(
  (select count(*) from public.todo_items((select c.id from public.communities c where c.slug = 'hill-crest'))
    where kind = 'payment_to_confirm' and id = 'dddddddd-0000-4000-8000-0000000000f5'),
  1::bigint, 'her own payment is in her queue for the same reason');
select test.eq(
  public.todo_count((select c.id from public.communities c where c.slug = 'hill-crest'))::bigint,
  (select count(*) from public.todo_items((select c.id from public.communities c where c.slug = 'hill-crest'))),
  'and the badge agrees with it under the hatch too');
select test.eq(
  (select status::text from public.review_contribution('dddddddd-0000-4000-8000-0000000000f5', true)),
  'succeeded', 'the society with one committee member can still count its own money');

-- The revoke that dropping and recreating review_expense would have undone.
reset role;
select test.ok(
  not has_function_privilege('anon',
    'public.review_expense(uuid,public.expense_status,text)', 'EXECUTE'),
  'a stranger cannot approve a bill');
select test.ok(
  has_function_privilege('authenticated',
    'public.review_expense(uuid,public.expense_status,text)', 'EXECUTE'),
  'and the committee still can');

-- ---------------------------------------------------------------------------
-- Where the leftover goes
-- ---------------------------------------------------------------------------
-- Two events that close with money still in them, and the three answers the
-- committee can give.

reset role;
select test.act_as('11111111-1111-4111-8111-111111111111');
insert into public.events (id, community_id, slug, name, starts_on, fund_target, created_by)
values
  ('cccccccc-0000-4000-8000-0000000000f2', 'aaaaaaaa-0000-4000-8000-000000000001',
   'gv-onam-2027', 'Green Valley Onam 2027', '2027-09-05', 20000,
   '11111111-1111-4111-8111-111111111111'),
  ('cccccccc-0000-4000-8000-0000000000f3', 'aaaaaaaa-0000-4000-8000-000000000001',
   'gv-pongal-2027', 'Green Valley Pongal 2027', '2027-01-14', 20000,
   '11111111-1111-4111-8111-111111111111'),
  ('cccccccc-0000-4000-8000-0000000000f4', 'aaaaaaaa-0000-4000-8000-000000000001',
   'gv-holi-2027', 'Green Valley Holi 2027', '2027-03-08', 20000,
   '11111111-1111-4111-8111-111111111111');
update public.events set status = 'published'
 where id in ('cccccccc-0000-4000-8000-0000000000f2',
              'cccccccc-0000-4000-8000-0000000000f3',
              'cccccccc-0000-4000-8000-0000000000f4');

-- ₹3,000 into Onam 2027 and ₹2,000 into Holi 2027, neither of them spent.
reset role;
select test.act_as('33333333-3333-4333-8333-333333333333');
insert into public.contributions
  (id, event_id, community_id, membership_id, amount, method, status, reference)
select 'dddddddd-0000-4000-8000-0000000000f6', 'cccccccc-0000-4000-8000-0000000000f2',
       m.community_id, m.id, 3000, 'upi', 'pending', '700000000003'
  from public.memberships m where m.user_id = '33333333-3333-4333-8333-333333333333';
insert into public.contributions
  (id, event_id, community_id, membership_id, amount, method, status, reference)
select 'dddddddd-0000-4000-8000-0000000000f7', 'cccccccc-0000-4000-8000-0000000000f4',
       m.community_id, m.id, 2000, 'upi', 'pending', '700000000004'
  from public.memberships m where m.user_id = '33333333-3333-4333-8333-333333333333';

reset role;
select test.act_as('11111111-1111-4111-8111-111111111111');
select public.review_contribution('dddddddd-0000-4000-8000-0000000000f6', true);
select public.review_contribution('dddddddd-0000-4000-8000-0000000000f7', true);

-- Deciding before the event closes is deciding the fate of a surplus nobody
-- has finished counting.
select test.raises(
  $q$select public.allocate_surplus('cccccccc-0000-4000-8000-0000000000f2', 'society_balance')$q$,
  'a surplus cannot be allocated while the event is still running');

update public.events set status = 'completed'
 where id in ('cccccccc-0000-4000-8000-0000000000f2', 'cccccccc-0000-4000-8000-0000000000f4');

reset role;
select test.act_as('33333333-3333-4333-8333-333333333333');
select test.raises(
  $q$select public.allocate_surplus('cccccccc-0000-4000-8000-0000000000f2',
       'next_event', 'cccccccc-0000-4000-8000-0000000000f3')$q$,
  'and a resident cannot decide it at all');

reset role;
select test.act_as('11111111-1111-4111-8111-111111111111');
select test.raises(
  $q$select public.allocate_surplus('cccccccc-0000-4000-8000-0000000000f2',
       'next_event', 'cccccccc-0000-4000-8000-0000000000f4')$q$,
  'nor can it be carried into an event that has already closed');
select test.raises(
  $q$select public.allocate_surplus('cccccccc-0000-4000-8000-0000000000f2',
       'next_event', 'cccccccc-0000-4000-8000-0000000000f2')$q$,
  'nor back into the event it came from');

-- Answer one: the next thing on the calendar.
select test.eq(
  (select amount from public.allocate_surplus('cccccccc-0000-4000-8000-0000000000f2',
     'next_event', 'cccccccc-0000-4000-8000-0000000000f3', 'Carried to Pongal')),
  3000::numeric(12,2),
  'the committee carries the whole of what is left, not a figure they typed');
select test.eq(
  (select fund_carried from public.event_stats
    where event_id = 'cccccccc-0000-4000-8000-0000000000f3'),
  3000::numeric(12,2), 'which lands on the next event as money already received');
select test.eq(
  (select fund_raised from public.event_stats
    where event_id = 'cccccccc-0000-4000-8000-0000000000f3'),
  0::numeric(12,2), 'without being counted as a contribution, because nobody contributed it');
select test.eq(
  (select available from public.event_stats
    where event_id = 'cccccccc-0000-4000-8000-0000000000f3'),
  3000::numeric(12,2), 'and is money that event can spend');
select test.eq(
  (select available from public.event_stats
    where event_id = 'cccccccc-0000-4000-8000-0000000000f2'),
  0::numeric(12,2), 'while the event it came from stops reporting a surplus it gave away');
select test.raises(
  $q$select public.allocate_surplus('cccccccc-0000-4000-8000-0000000000f2',
       'next_event', 'cccccccc-0000-4000-8000-0000000000f3')$q$,
  'so allocating it a second time finds nothing left');

-- Answer three: the society keeps it.
select test.eq(
  (select amount from public.allocate_surplus('cccccccc-0000-4000-8000-0000000000f4',
     'society_balance', null, 'Keep it for now')),
  2000::numeric(12,2), 'Holi''s leftover stays with the society instead');
select test.eq(
  (select balance from public.society_balance
    where community_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  2000::numeric(12,2), 'which is what the balance on everybody''s home screen reads');
select test.raises(
  $q$select public.allocate_surplus('cccccccc-0000-4000-8000-0000000000f4',
       'society_balance', 'cccccccc-0000-4000-8000-0000000000f3')$q$,
  'and keeping a surplus does not name another event');

-- The way back out, so the third answer is not a one-way door.
select test.raises(
  $q$select public.spend_society_balance('cccccccc-0000-4000-8000-0000000000f3', 5000)$q$,
  'the committee cannot spend a balance the society does not have');
select test.eq(
  (select amount from public.spend_society_balance(
     'cccccccc-0000-4000-8000-0000000000f3', 500, 'Towards the pandal')),
  500::numeric(12,2), 'but can put part of it behind an event that is still collecting');
select test.eq(
  (select balance from public.society_balance
    where community_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  1500::numeric(12,2), 'which comes off the balance');
select test.eq(
  (select fund_carried from public.event_stats
    where event_id = 'cccccccc-0000-4000-8000-0000000000f3'),
  3500::numeric(12,2), 'and onto the event');

reset role;
select test.act_as('55555555-5555-4555-8555-555555555555');
select test.raises(
  $q$select public.spend_society_balance('cccccccc-0000-4000-8000-0000000000f3', 100)$q$,
  'staff cannot spend it either; this is the committee''s to decide');

-- Every member reads the decisions. A committee decision about residents'
-- money that residents cannot see is not an improvement on a WhatsApp message
-- saying the same thing.
reset role;
select test.act_as('33333333-3333-4333-8333-333333333333');
select test.eq(test.visible('select id from public.fund_movements'), 3::bigint,
  'a resident sees every movement their society made');
-- No delete policy at all, which RLS renders as a delete that matches nothing
-- rather than one that errors — so the assertion is about the rows, not the
-- error. The committee member who made the decision is held to it too.
delete from public.fund_movements;
reset role;
select test.act_as('11111111-1111-4111-8111-111111111111');
delete from public.fund_movements;
update public.fund_movements set amount = 1;
reset role;
select test.eq((select count(*) from public.fund_movements), 3::bigint,
  'and nobody can delete or rewrite one, the committee member who decided included');
select test.eq(
  (select balance from public.society_balance
    where community_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  1500::numeric(12,2), 'so the balance is what the decisions add up to, still');

reset role;
select test.act_as('77777777-7777-4777-8777-777777777777');
select test.eq(test.visible('select id from public.fund_movements'), 0::bigint,
  'another society sees none of them');
select test.eq(test.visible('select * from public.society_balance'), 0::bigint,
  'nor what this one is holding');

reset role;
select test.act_anon();
select test.eq(test.visible('select * from public.society_balance'), 0::bigint,
  'and a stranger sees nothing at all');

reset role;
select test.ok(
  not has_function_privilege('anon',
    'public.allocate_surplus(uuid,public.fund_movement_kind,uuid,text)', 'EXECUTE'),
  'a stranger cannot decide where a surplus goes');
select test.ok(
  not has_function_privilege('anon', 'public.spend_society_balance(uuid,numeric,text)', 'EXECUTE'),
  'nor spend the society balance');
select test.ok(
  has_function_privilege('authenticated',
    'public.allocate_surplus(uuid,public.fund_movement_kind,uuid,text)', 'EXECUTE'),
  'while the committee can, signed in');

-- ---------------------------------------------------------------------------
-- The vote that was never built
-- ---------------------------------------------------------------------------
-- 0870 built fund reallocation voting and nothing ever reached it: no app
-- inserted a proposal, and the card that would have collected the votes was
-- exported and never rendered. 0921.0300 then settled the same question — where
-- a closed event's surplus goes — a different way. 0921.0400 removed it.
--
-- Asserted by absence, so re-introducing the schema without re-introducing a
-- way to reach it fails here rather than in a year's reading of the spec.
reset role;
select test.eq(
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('fund_reallocations', 'reallocation_votes', 'reallocation_results')),
  0::bigint, 'the reallocation tables and view are gone');
select test.eq(
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'vote_on_reallocation'),
  0::bigint, 'and so is the function that counted the votes');
select test.ok(
  exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
           where n.nspname = 'public' and t.typname = 'proposal_status'),
  'while proposal_status stays, because polls use it and polls are reachable');
select test.ok(
  (select count(*) from public.polls) >= 0,
  'and the polls half of 0870 still answers');

-- ---------------------------------------------------------------------------
-- A policy name that lies is worse than no name
-- ---------------------------------------------------------------------------
-- 0913.0300 renamed the role helpers in place — the old app.is_committee
-- became app.is_staff, the old app.is_admin became app.is_committee — and a
-- policy binds to a function by OID, so twenty-four of them kept working and
-- started meaning something other than what they were called. Nobody was let
-- in or shut out; the names simply stopped being evidence.
--
-- Written as a sweep rather than a list of twenty-four, so a policy added next
-- year is covered the day it lands instead of the day somebody remembers.
--
-- `admin` is in the failing set on its own terms: memberships_role_not_retired
-- forbids the role outright, so a policy named for it is named for nobody.
select test.eq(
  (select coalesce(string_agg(policyname, ', ' order by policyname), '')
     from pg_policies
    where schemaname in ('public', 'storage')
      and (
        policyname ~ 'admin'
        or (policyname ~ 'committee'
            and (coalesce(qual, '') || coalesce(with_check, '')) !~ 'app\.is_committee')
        or (policyname ~ 'staff'
            and (coalesce(qual, '') || coalesce(with_check, '')) !~ 'app\.is_staff')
      )),
  '', 'no policy names a role it does not enforce, nor one nobody may hold');

-- The rename changed names and nothing else, so the two that decide who
-- touches a bill still decide exactly what they decided before.
select test.eq(
  (select with_check from pg_policies
    where schemaname = 'public' and policyname = 'expenses_insert_staff'),
  '(app.is_staff(community_id) AND (requested_by = app.my_membership_id(community_id)) AND (status = ''pending''::expense_status))'::text,
  'staff file their own bill as pending, exactly as before the rename');
select test.eq(
  (select qual from pg_policies
    where schemaname = 'public' and policyname = 'expenses_update_own_pending_or_committee'),
  '(app.is_committee(community_id) OR ((requested_by = app.my_membership_id(community_id)) AND (status = ANY (ARRAY[''pending''::expense_status, ''changes_requested''::expense_status]))))'::text,
  'and the committee, or the filer while it is still open, may still edit one');

-- ============================================================================
-- 0930.0100 — money out has a reason
-- ============================================================================
-- Green Valley's society balance stands at ₹1,500 here, and Pongal (…f3) is
-- holding ₹3,500 it was given and has spent none of.

-- A bill names its vendor and carries a copy.
reset role;
select test.act_as('55555555-5555-4555-8555-555555555555');
select test.raises(
  $q$insert into public.expenses (event_id, community_id, name, amount, bill_url, requested_by)
     select 'cccccccc-0000-4000-8000-0000000000f3', 'aaaaaaaa-0000-4000-8000-000000000001',
            'Rope', 300,
            'aaaaaaaa-0000-4000-8000-000000000001/cccccccc-0000-4000-8000-0000000000f3/rope.pdf',
            app.my_membership_id('aaaaaaaa-0000-4000-8000-000000000001')$q$,
  'a bill that does not name its vendor is refused');
select test.raises(
  $q$insert into public.expenses (event_id, community_id, name, amount, vendor, requested_by)
     select 'cccccccc-0000-4000-8000-0000000000f3', 'aaaaaaaa-0000-4000-8000-000000000001',
            'Rope', 300, 'Hardware store',
            app.my_membership_id('aaaaaaaa-0000-4000-8000-000000000001')$q$,
  'and so is one without a copy of the bill');

-- The society spends its own balance: staff may, with everything filled in.
reset role;
select test.act_as('33333333-3333-4333-8333-333333333333');
select test.raises(
  $q$select public.record_society_expense('aaaaaaaa-0000-4000-8000-000000000001', 200,
       'Gate motor repair', 'Sri Ram Electricals',
       'aaaaaaaa-0000-4000-8000-000000000001/society/gate.jpg')$q$,
  'a resident cannot spend the society balance');

reset role;
select test.act_as('55555555-5555-4555-8555-555555555555');
select test.raises(
  $q$select public.record_society_expense('aaaaaaaa-0000-4000-8000-000000000001', 200,
       'Gate motor repair', 'Sri Ram Electricals', '')$q$,
  'staff cannot record spending without the bill or a screenshot');
select test.raises(
  $q$select public.record_society_expense('aaaaaaaa-0000-4000-8000-000000000001', 200,
       ' ', 'Sri Ram Electricals', 'aaaaaaaa-0000-4000-8000-000000000001/society/gate.jpg')$q$,
  'nor without saying what it was for');
select test.raises(
  $q$select public.record_society_expense('aaaaaaaa-0000-4000-8000-000000000001', 200,
       'Gate motor repair', 'Sri Ram Electricals', 'bbbbbbbb-0000-4000-8000-000000000001/gate.jpg')$q$,
  'nor with a receipt filed under another society');
select test.raises(
  $q$select public.record_society_expense('aaaaaaaa-0000-4000-8000-000000000001', 200,
       'Gate motor repair', 'Sri Ram Electricals',
       'aaaaaaaa-0000-4000-8000-000000000001/cccccccc-0000-4000-8000-0000000000f3/bill.jpg')$q$,
  'nor with an event''s bill as the receipt, which would show it to every resident');
select test.raises(
  $q$select public.record_society_expense('aaaaaaaa-0000-4000-8000-000000000001', 2000,
       'Gate motor repair', 'Sri Ram Electricals',
       'aaaaaaaa-0000-4000-8000-000000000001/society/gate.jpg')$q$,
  'nor spend more than the society holds');
select test.eq(
  (select amount from public.record_society_expense('aaaaaaaa-0000-4000-8000-000000000001', 500,
     'Gate motor repair', 'Sri Ram Electricals',
     'aaaaaaaa-0000-4000-8000-000000000001/society/gate.jpg', '2026-09-28')),
  500::numeric(12,2), 'but can record a repair paid from it');
insert into storage.objects (bucket_id, name)
values ('bills', 'aaaaaaaa-0000-4000-8000-000000000001/society/gate.jpg');

reset role;
select test.act_as('33333333-3333-4333-8333-333333333333');
select test.eq(
  (select balance from public.society_balance
    where community_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  1000::numeric(12,2), 'which comes off the balance every resident sees');
select test.eq(
  (select concat_ws(' | ', direction, amount::text, counterpart, detail, confirmed_by)
     from public.society_ledger
    where community_id = 'aaaaaaaa-0000-4000-8000-000000000001'
      and kind = 'society_spending'),
  'out | -500.00 | Sri Ram Electricals | Gate motor repair | Esha Patil',
  'and sits in the ledger: who was paid, what for, and who recorded it');
select test.eq(
  test.visible($q$select 1 from storage.objects
                  where bucket_id = 'bills'
                    and name = 'aaaaaaaa-0000-4000-8000-000000000001/society/gate.jpg'$q$),
  1::bigint, 'with a receipt the resident can open');
select test.eq(
  (select count(*) from public.notifications
    where kind = 'society_spent' and user_id = '33333333-3333-4333-8333-333333333333'),
  1::bigint, 'and a notification saying so');

-- Nothing gets in or changes except through the function.
reset role;
select test.act_as('11111111-1111-4111-8111-111111111111');
select test.raises(
  $q$insert into public.society_expenses (community_id, amount, reason, paid_to, proof_path)
     values ('aaaaaaaa-0000-4000-8000-000000000001', 1, 'x', 'y',
             'aaaaaaaa-0000-4000-8000-000000000001/society/x.jpg')$q$,
  'nobody writes a society expense directly, the committee included');
delete from public.society_expenses;
update public.society_expenses set amount = 1;
reset role;
select test.eq(
  (select amount from public.society_expenses
    where community_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  500::numeric(12,2), 'and nobody can delete or rewrite one');

reset role;
select test.act_as('55555555-5555-4555-8555-555555555555');
delete from storage.objects
 where bucket_id = 'bills' and name = 'aaaaaaaa-0000-4000-8000-000000000001/society/gate.jpg';
reset role;
select test.eq(
  (select count(*) from storage.objects
    where bucket_id = 'bills' and name = 'aaaaaaaa-0000-4000-8000-000000000001/society/gate.jpg'),
  1::bigint, 'nor quietly remove the receipt behind it');

-- An event spends more than it collected: Esha paid for a ₹5,000 sound system
-- on an event holding ₹3,500.
reset role;
select test.act_as('55555555-5555-4555-8555-555555555555');
insert into public.expenses
  (id, event_id, community_id, name, category, amount, vendor, bill_url, paid_by, requested_by)
select 'dddddddd-0000-4000-8000-0000000001a1', 'cccccccc-0000-4000-8000-0000000000f3',
       'aaaaaaaa-0000-4000-8000-000000000001', 'Sound system', 'Sound & lighting', 5000,
       'Beat Box Audio',
       'aaaaaaaa-0000-4000-8000-000000000001/cccccccc-0000-4000-8000-0000000000f3/sound.pdf',
       app.my_membership_id('aaaaaaaa-0000-4000-8000-000000000001')::text,
       app.my_membership_id('aaaaaaaa-0000-4000-8000-000000000001');

reset role;
select test.act_as('11111111-1111-4111-8111-111111111111');
select test.eq(
  (select subtitle from public.todo_items('aaaaaaaa-0000-4000-8000-000000000001')
    where kind = 'bill_to_approve' and id = 'dddddddd-0000-4000-8000-0000000001a1'),
  'Sound & lighting · Beat Box Audio · takes the event ₹1,500 over what it collected',
  'before approving, the committee is warned the bill is more than the event has left');
select public.review_expense('dddddddd-0000-4000-8000-0000000001a1', 'approved');
select test.eq(
  (select available from public.event_stats
    where event_id = 'cccccccc-0000-4000-8000-0000000000f3'),
  -1500::numeric(12,2), 'the approval leaves the event ₹1,500 over');

reset role;
select test.eq(
  (select title || ' — ' || body from public.notifications
    where kind = 'overspent' and user_id = '22222222-2222-4222-8222-222222222222'
      and data ->> 'event_slug' = (select slug from public.events
                                    where id = 'cccccccc-0000-4000-8000-0000000000f3')),
  (select name from public.events where id = 'cccccccc-0000-4000-8000-0000000000f3')
    || ' is ₹1,500 over what it collected — Esha Patil paid ₹5,000 for Sound system'
    || ' (Sound & lighting). The society balance cannot cover it yet, so it stays in To do.',
  'the rest of the committee hears who paid, how much, and whether the balance can pay them back');
select test.eq(
  (select count(*) from public.notifications
    where kind = 'overspent' and user_id = '33333333-3333-4333-8333-333333333333'),
  0::bigint, 'residents are not told; it is the committee''s to settle');

select test.act_as('11111111-1111-4111-8111-111111111111');
select test.eq(
  (select amount from public.todo_items('aaaaaaaa-0000-4000-8000-000000000001')
    where kind = 'overspent' and id = 'cccccccc-0000-4000-8000-0000000000f3'),
  1500::numeric, 'and it waits in their To do for what is owed');

reset role;
select test.act_as('55555555-5555-4555-8555-555555555555');
select test.eq(
  (select count(*) from public.todo_items('aaaaaaaa-0000-4000-8000-000000000001')
    where kind = 'overspent'),
  0::bigint, 'not in staff''s, who cannot settle it');
select test.raises(
  $q$select public.cover_overspend('cccccccc-0000-4000-8000-0000000000f3', 1000, 'Esha Patil',
       'aaaaaaaa-0000-4000-8000-000000000001/society/esha.png')$q$,
  'staff cannot pay it back either');

-- The committee pays Esha back, as far as the balance goes.
reset role;
select test.act_as('11111111-1111-4111-8111-111111111111');
select test.raises(
  $q$select public.cover_overspend('cccccccc-0000-4000-8000-0000000000f3', 1000, 'Esha Patil', '')$q$,
  'not without the screenshot of the transfer');
select test.raises(
  $q$select public.cover_overspend('cccccccc-0000-4000-8000-0000000000f3', 1000, ' ',
       'aaaaaaaa-0000-4000-8000-000000000001/society/esha.png')$q$,
  'nor without saying who was paid');
select test.raises(
  $q$select public.cover_overspend('cccccccc-0000-4000-8000-0000000000f3', 1000, 'Esha Patil',
       'aaaaaaaa-0000-4000-8000-000000000001/cccccccc-0000-4000-8000-0000000000f3/esha.png')$q$,
  'nor with a screenshot filed outside the society''s folder');
select test.raises(
  $q$select public.cover_overspend('cccccccc-0000-4000-8000-0000000000f3', 1500, 'Esha Patil',
       'aaaaaaaa-0000-4000-8000-000000000001/society/esha.png')$q$,
  'nor for more than the society balance holds');
select test.eq(
  (select amount from public.cover_overspend('cccccccc-0000-4000-8000-0000000000f3', 1000,
     'Esha Patil', 'aaaaaaaa-0000-4000-8000-000000000001/society/esha.png', 'Sound system')),
  1000::numeric(12,2), 'but can pay back what the balance holds');
insert into storage.objects (bucket_id, name)
values ('bills', 'aaaaaaaa-0000-4000-8000-000000000001/society/esha.png');
select test.eq(
  (select available from public.event_stats
    where event_id = 'cccccccc-0000-4000-8000-0000000000f3'),
  -500::numeric(12,2), 'which leaves the event ₹500 over');
select test.eq(
  (select amount from public.todo_items('aaaaaaaa-0000-4000-8000-000000000001')
    where kind = 'overspent' and id = 'cccccccc-0000-4000-8000-0000000000f3'),
  500::numeric, 'still in To do for the rest');
select test.raises(
  $q$select public.cover_overspend('cccccccc-0000-4000-8000-0000000000f3', 500, 'Esha Patil',
       'aaaaaaaa-0000-4000-8000-000000000001/society/esha-2.png')$q$,
  'until the balance has it: it is empty now');

reset role;
select test.act_as('33333333-3333-4333-8333-333333333333');
select test.eq(
  (select paid_to from public.fund_movements
    where proof_path = 'aaaaaaaa-0000-4000-8000-000000000001/society/esha.png'),
  'Esha Patil', 'every resident sees who was paid back');
select test.eq(
  test.visible($q$select 1 from storage.objects
                  where bucket_id = 'bills'
                    and name = 'aaaaaaaa-0000-4000-8000-000000000001/society/esha.png'$q$),
  1::bigint, 'and can open the screenshot of the transfer');
select test.eq(
  (select title from public.notifications
    where kind = 'fund_moved' and user_id = '33333333-3333-4333-8333-333333333333'
      and title like '%paid back%'),
  '₹1,000 paid back from the society balance', 'and is told the committee paid it back');
select test.eq(
  (select balance from public.society_balance
    where community_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  0::numeric(12,2), 'which comes off the balance like any other movement');

reset role;
select test.act_as('77777777-7777-4777-8777-777777777777');
select test.eq(test.visible('select id from public.society_expenses'), 0::bigint,
  'another society sees none of this society''s spending');

reset role;
select test.ok(
  not has_function_privilege('anon',
    'public.record_society_expense(uuid,numeric,text,text,text,date)', 'EXECUTE'),
  'a stranger cannot spend a society balance');
select test.ok(
  not has_function_privilege('anon',
    'public.cover_overspend(uuid,numeric,text,text,text)', 'EXECUTE'),
  'nor pay anybody back from it');

-- ---------------------------------------------------------------------------
-- Money moved on is in the ledger
-- ---------------------------------------------------------------------------
-- Green Valley so far: Onam 2027 carried its ₹3,000 to Pongal 2027, Holi 2027
-- kept its ₹2,000 for the society, the committee put ₹500 of that behind
-- Pongal, and paid Esha back ₹1,000 of Pongal's overspend from the rest.

reset role;
select test.act_as('33333333-3333-4333-8333-333333333333');
select test.eq(
  (select fund_carried_in from public.event_stats
    where event_id = 'cccccccc-0000-4000-8000-0000000000f3'),
  4500::numeric(12,2),
  'an event counts everything carried into it: a leftover, the balance and a pay-back');
select test.eq(
  (select fund_moved_out from public.event_stats
    where event_id = 'cccccccc-0000-4000-8000-0000000000f2'),
  3000::numeric(12,2), 'and what it handed on when it closed, on its own');
select test.eq(
  (select fund_carried from public.event_stats
    where event_id = 'cccccccc-0000-4000-8000-0000000000f2'),
  -3000::numeric(12,2), 'while the net figure reads as it always did');

select test.eq(
  (select count(*) from public.society_ledger
    where kind = 'transfer' and community_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  8::bigint, 'every movement is in the ledger twice: where it left and where it arrived');
select test.eq(
  (select amount from public.society_ledger
    where kind = 'transfer' and event_id = 'cccccccc-0000-4000-8000-0000000000f2'),
  -3000::numeric(12,2), 'a closed event''s ledger shows the money it handed on');
select test.eq(
  (select counterpart || ' · ' || detail from public.society_ledger
    where kind = 'transfer' and event_id = 'cccccccc-0000-4000-8000-0000000000f2'),
  'Green Valley Pongal 2027 · Carried forward', 'named after where it went');
select test.eq(
  (select counterpart || ' · ' || detail from public.society_ledger
    where kind = 'transfer' and event_id = 'cccccccc-0000-4000-8000-0000000000f3'
      and amount = 3000),
  'Green Valley Onam 2027 · Carried in',
  'and the next event''s shows it arriving, named after where it came from');
select test.eq(
  (select counterpart || ' · ' || detail from public.society_ledger
    where kind = 'transfer' and event_id = 'cccccccc-0000-4000-8000-0000000000f4'),
  'Society balance · Kept for the society', 'a leftover the society kept says so');
select test.eq(
  (select detail || ' · ' || document_url from public.society_ledger
    where kind = 'transfer' and event_id = 'cccccccc-0000-4000-8000-0000000000f3'
      and amount = 1000),
  'Overspend paid back to Esha Patil · aaaaaaaa-0000-4000-8000-000000000001/society/esha.png',
  'and a pay-back says who was paid, with the screenshot of the transfer');
select test.eq(
  (select confirmed_by from public.society_ledger
    where kind = 'transfer' and event_id = 'cccccccc-0000-4000-8000-0000000000f4'),
  'Asha Menon', 'with the committee member who decided it');

select test.eq(
  (select count(*) from public.event_stats s
    where s.community_id = 'aaaaaaaa-0000-4000-8000-000000000001'
      and s.available is distinct from (
        select coalesce(sum(l.amount), 0) from public.society_ledger l
         where l.event_id = s.event_id)),
  0::bigint, 'so every event''s ledger adds up to what it holds');
select test.eq(
  (select coalesce(sum(amount), 0) from public.society_ledger
    where community_id = 'aaaaaaaa-0000-4000-8000-000000000001' and event_id is null),
  (select balance from public.society_balance
    where community_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  'and the society balance''s own rows add up to what it holds');

select test.eq(
  (select total_in from public.society_money
    where community_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  (select sum(amount) from public.society_ledger
    where community_id = 'aaaaaaaa-0000-4000-8000-000000000001' and kind = 'payment'),
  'money collected society-wide is payments, not money moved between events');
select test.eq(
  (select total_out from public.society_money
    where community_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  (select -sum(amount) from public.society_ledger
    where community_id = 'aaaaaaaa-0000-4000-8000-000000000001'
      and kind in ('bill', 'society_spending')),
  'and money spent is bills and the society''s own spending');
select test.eq(
  (select balance from public.society_money
    where community_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  (select sum(amount) from public.society_ledger
    where community_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  'while the two sides of every movement cancel in the balance');

-- A leftover carried into an event nobody has published yet: the rows stay,
-- the name is the committee's until it is published.
reset role;
select test.act_as('11111111-1111-4111-8111-111111111111');
insert into public.events (id, community_id, slug, name, starts_on, fund_target, created_by)
values
  ('cccccccc-0000-4000-8000-0000000000f5', 'aaaaaaaa-0000-4000-8000-000000000001',
   'gv-navratri-2027', 'Green Valley Navratri 2027', '2027-10-01', 5000,
   '11111111-1111-4111-8111-111111111111'),
  ('cccccccc-0000-4000-8000-0000000000f6', 'aaaaaaaa-0000-4000-8000-000000000001',
   'gv-diwali-2027', 'Green Valley Diwali 2027', '2027-10-29', 5000,
   '11111111-1111-4111-8111-111111111111');
update public.events set status = 'published'
 where id = 'cccccccc-0000-4000-8000-0000000000f5';

reset role;
select test.act_as('33333333-3333-4333-8333-333333333333');
insert into public.contributions
  (id, event_id, community_id, membership_id, amount, method, status, reference)
select 'dddddddd-0000-4000-8000-0000000000f8', 'cccccccc-0000-4000-8000-0000000000f5',
       m.community_id, m.id, 1200, 'upi', 'pending', '700000000009'
  from public.memberships m where m.user_id = '33333333-3333-4333-8333-333333333333';

reset role;
select test.act_as('11111111-1111-4111-8111-111111111111');
select public.review_contribution('dddddddd-0000-4000-8000-0000000000f8', true);
update public.events set status = 'completed'
 where id = 'cccccccc-0000-4000-8000-0000000000f5';
select test.eq(
  (select amount from public.allocate_surplus('cccccccc-0000-4000-8000-0000000000f5',
     'next_event', 'cccccccc-0000-4000-8000-0000000000f6')),
  1200::numeric(12,2), 'Navratri''s leftover goes behind Diwali, still a draft');
select test.eq(
  (select counterpart from public.society_ledger
    where kind = 'transfer' and event_id = 'cccccccc-0000-4000-8000-0000000000f5'),
  'Green Valley Diwali 2027', 'the committee sees where it went');

reset role;
select test.act_as('33333333-3333-4333-8333-333333333333');
select test.eq(
  (select counterpart from public.society_ledger
    where kind = 'transfer' and event_id = 'cccccccc-0000-4000-8000-0000000000f5'),
  'An event not published yet', 'a resident is not told the name of an unpublished event');
select test.eq(
  (select coalesce(event_slug, 'none') || ' · ' || coalesce(event_name, 'none')
     from public.society_ledger
    where kind = 'transfer' and event_id = 'cccccccc-0000-4000-8000-0000000000f6'),
  'none · none', 'nor shown its slug on the row where the money arrived');
select test.eq(
  (select count(*) from public.event_stats s
    where s.community_id = 'aaaaaaaa-0000-4000-8000-000000000001'
      and s.available is distinct from (
        select coalesce(sum(l.amount), 0) from public.society_ledger l
         where l.event_id = s.event_id)),
  0::bigint, 'and the rows still add up, draft included');

reset role;
select test.act_as('77777777-7777-4777-8777-777777777777');
select test.eq(
  test.visible($q$select id from public.society_ledger where kind = 'transfer'$q$),
  0::bigint, 'another society sees none of this one''s movements');

-- ---------------------------------------------------------------------------
-- A reply can be a face
-- ---------------------------------------------------------------------------
-- Ria says something under Hill Crest Diwali; anyone in Hill Crest can react,
-- with one of the faces, once each, and take only their own back.

reset role;
select test.act_as('abababab-abab-4bab-8bab-abababababab');
insert into public.comments (id, community_id, event_id, membership_id, body)
select 'c0c0c0c0-0000-4000-8000-000000000001', e.community_id, e.id,
       app.my_membership_id(e.community_id), 'Lanterns along the main road this year?'
  from public.events e where e.id = 'cccccccc-0000-4000-8000-0000000000aa';
insert into public.comment_reactions (comment_id, community_id, membership_id, emoji)
select 'c0c0c0c0-0000-4000-8000-000000000001', e.community_id,
       app.my_membership_id(e.community_id), '🎉'
  from public.events e where e.id = 'cccccccc-0000-4000-8000-0000000000aa';
select test.eq(test.visible('select 1 from public.comment_reactions'), 1::bigint,
  'a member can react to a comment, their own included');

reset role;
select test.act_as('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd');
insert into public.comment_reactions (comment_id, community_id, membership_id, emoji)
select 'c0c0c0c0-0000-4000-8000-000000000001', e.community_id,
       app.my_membership_id(e.community_id), face
  from public.events e, (values ('👍'), ('❤️')) as faces(face)
 where e.id = 'cccccccc-0000-4000-8000-0000000000aa';
select test.eq(test.visible('select 1 from public.comment_reactions'), 3::bigint,
  'and so can a neighbour, with more than one face');
select test.raises(
  $q$insert into public.comment_reactions (comment_id, community_id, membership_id, emoji)
     select 'c0c0c0c0-0000-4000-8000-000000000001', e.community_id,
            app.my_membership_id(e.community_id), '👍'
       from public.events e where e.id = 'cccccccc-0000-4000-8000-0000000000aa'$q$,
  'but each face only once');
select test.raises(
  $q$insert into public.comment_reactions (comment_id, community_id, membership_id, emoji)
     select 'c0c0c0c0-0000-4000-8000-000000000001', e.community_id,
            app.my_membership_id(e.community_id), 'lol'
       from public.events e where e.id = 'cccccccc-0000-4000-8000-0000000000aa'$q$,
  'and only a face from the set, never text');
select test.raises(
  $q$insert into public.comment_reactions (comment_id, community_id, membership_id, emoji)
     select 'c0c0c0c0-0000-4000-8000-000000000001', m.community_id, m.id, '😂'
       from public.memberships m where m.user_id = 'abababab-abab-4bab-8bab-abababababab'$q$,
  'nor on somebody else''s behalf');

-- Taking a face off: only your own.
delete from public.comment_reactions where emoji = '🎉';
reset role;
select test.eq(
  (select count(*) from public.comment_reactions
    where comment_id = 'c0c0c0c0-0000-4000-8000-000000000001'),
  3::bigint, 'a neighbour cannot take somebody else''s reaction off');
select test.act_as('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd');
delete from public.comment_reactions where emoji = '❤️';
reset role;
select test.eq(
  (select count(*) from public.comment_reactions
    where comment_id = 'c0c0c0c0-0000-4000-8000-000000000001'),
  2::bigint, 'but can take their own off');

-- Staff are in the conversation, so they can react too.
select test.act_as('99999999-9999-4999-8999-999999999999');
insert into public.comment_reactions (comment_id, community_id, membership_id, emoji)
select 'c0c0c0c0-0000-4000-8000-000000000001', e.community_id,
       app.my_membership_id(e.community_id), '🙏'
  from public.events e where e.id = 'cccccccc-0000-4000-8000-0000000000aa';
select test.eq(test.visible('select 1 from public.comment_reactions'), 3::bigint,
  'staff can react too');

-- Reacting notifies nobody: a thumbs-up is not news.
reset role;
select test.eq(
  (select count(*) from public.notifications
    where data ->> 'comment_id' = 'c0c0c0c0-0000-4000-8000-000000000001'
      and kind <> 'comment'),
  0::bigint, 'and nobody is notified of a reaction');

-- Another society sees none of it and cannot react. The ids are read here,
-- as nobody in particular, because Gita cannot see Hill Crest's event to
-- read them herself — and an insert that selects nothing proves nothing.
create temporary table t_faces as
select e.community_id as hill_crest,
       (select m.id from public.memberships m
         where m.user_id = '77777777-7777-4777-8777-777777777777' limit 1) as gita,
       (select m.community_id from public.memberships m
         where m.user_id = '77777777-7777-4777-8777-777777777777' limit 1) as green_valley
  from public.events e where e.id = 'cccccccc-0000-4000-8000-0000000000aa';
grant select on t_faces to authenticated;
select test.act_as('77777777-7777-4777-8777-777777777777');
select test.eq(test.visible('select 1 from public.comment_reactions'), 0::bigint,
  'another society sees none of the reactions');
select test.raises(
  $q$insert into public.comment_reactions (comment_id, community_id, membership_id, emoji)
     select 'c0c0c0c0-0000-4000-8000-000000000001', hill_crest, gita, '👍' from t_faces$q$,
  'nor reacts to a thread that is not theirs');
select test.raises(
  $q$insert into public.comment_reactions (comment_id, community_id, membership_id, emoji)
     select 'c0c0c0c0-0000-4000-8000-000000000001', green_valley, gita, '👍' from t_faces$q$,
  'even by filing the reaction under their own society');

-- A comment that goes takes its reactions with it.
reset role;
select test.act_as('abababab-abab-4bab-8bab-abababababab');
delete from public.comments where id = 'c0c0c0c0-0000-4000-8000-000000000001';
reset role;
select test.eq(
  (select count(*) from public.comment_reactions
    where comment_id = 'c0c0c0c0-0000-4000-8000-000000000001'),
  0::bigint, 'and a withdrawn comment takes its reactions with it');

select test.ok(
  not has_table_privilege('anon', 'public.comment_reactions', 'SELECT')
  and not has_table_privilege('anon', 'public.comment_reactions', 'INSERT'),
  'a stranger can neither see a reaction nor leave one');


-- A bill is paid out of a budget line, and what the line has left is derived.
reset role;
select test.act_as('88888888-8888-4888-8888-888888888888');
insert into public.budget_lines (id, event_id, community_id, category, vendor, amount)
select 'b0b0b0b0-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-0000000000aa',
       (select community_id from public.events where id = 'cccccccc-0000-4000-8000-0000000000aa'), 'Food', 'Tesla', 600000;
reset role;
select test.act_as('99999999-9999-4999-8999-999999999999');
insert into public.expenses (id, event_id, community_id, name, category, amount, vendor, bill_url, requested_by, budget_line_id)
select 'dddddddd-0000-4000-8000-0000000000c1', 'cccccccc-0000-4000-8000-0000000000aa',
       (select community_id from public.events where id = 'cccccccc-0000-4000-8000-0000000000aa'), 'Lunch', 'Food', 200000, 'Tesla',
       'aaaaaaaa-0000-4000-8000-000000000001/cccccccc-0000-4000-8000-000000000001/lunch.pdf',
       app.my_membership_id((select community_id from public.events where id = 'cccccccc-0000-4000-8000-0000000000aa')),
       'b0b0b0b0-0000-4000-8000-000000000001';
select test.eq(
  (select remaining from public.budget_line_balances where id = 'b0b0b0b0-0000-4000-8000-000000000001'),
  600000::numeric, 'a bill waiting for approval leaves the line''s remaining untouched');
select test.eq(
  (select pending from public.budget_line_balances where id = 'b0b0b0b0-0000-4000-8000-000000000001'),
  200000::numeric, 'but is shown as pending beside it');
reset role;
select test.act_as('88888888-8888-4888-8888-888888888888');
select public.review_expense('dddddddd-0000-4000-8000-0000000000c1', 'approved');
select test.eq(
  (select remaining from public.budget_line_balances where id = 'b0b0b0b0-0000-4000-8000-000000000001'),
  400000::numeric, 'approving the bill takes it off what the line has left');
select test.eq(
  (select pending from public.budget_line_balances where id = 'b0b0b0b0-0000-4000-8000-000000000001'),
  0::numeric, 'and it is no longer pending');
reset role;
select test.act_as('99999999-9999-4999-8999-999999999999');
select test.raises(
  $q$insert into public.expenses (event_id, community_id, name, amount, vendor, bill_url, requested_by, budget_line_id)
     select 'cccccccc-0000-4000-8000-000000000001', m.community_id, 'Wrong event', 100, 'Tesla', 'x/y.pdf', m.id,
            'b0b0b0b0-0000-4000-8000-000000000001'
       from public.memberships m where m.user_id = '99999999-9999-4999-8999-999999999999' limit 1$q$,
  'a bill cannot draw on another event''s budget line');
