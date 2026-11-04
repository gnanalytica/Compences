/**
 * Fills a Supabase project with a small demo society so the app has something
 * to show on first run: an event mid-flight, a checklist part-done, a fund
 * part-raised, approved spending with bills, and a surplus proposal out to
 * vote.
 *
 * Uses the service role, which bypasses row-level security — that is the point
 * here (it has to create users and back-date data), and also why this must only
 * ever be pointed at a development project.
 *
 *   pnpm db:seed
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import type { Database } from '../packages/supabase/src/database.types';

config({ path: 'apps/web/.env.local' });
config({ path: '.env' });

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    'Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (apps/web/.env.local works).',
  );
  process.exit(1);
}

if (url.includes('placeholder')) {
  console.error('That looks like the placeholder URL. Point this at a real dev project.');
  process.exit(1);
}

const db = createClient<Database>(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const PEOPLE = [
  { email: 'asha@example.com', name: 'Asha Menon', role: 'owner' as const },
  { email: 'bala@example.com', name: 'Bala Krishnan', role: 'admin' as const },
  { email: 'chitra@example.com', name: 'Chitra Rao', role: 'committee' as const },
  { email: 'dev@example.com', name: 'Dev Sharma', role: 'resident' as const },
  { email: 'esha@example.com', name: 'Esha Patil', role: 'resident' as const },
];

/** Creates the user if missing; returns the id either way, so this is re-runnable. */
async function ensureUser(email: string, name: string): Promise<string> {
  const { data: created, error } = await db.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: name },
  });

  if (created?.user) return created.user.id;

  if (error?.message?.match(/already|registered|exists/i)) {
    const { data: list } = await db.auth.admin.listUsers({ perPage: 200 });
    const found = list?.users.find((user) => user.email === email);
    if (found) return found.id;
  }
  throw error ?? new Error(`Could not create ${email}`);
}

/** `2026-09-14` for a date N days from today. */
const inDays = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

async function main() {
  console.log('▸ creating demo users');
  const ids = new Map<string, string>();
  for (const person of PEOPLE) {
    ids.set(person.email, await ensureUser(person.email, person.name));
    console.log(`   ${person.email}`);
  }
  const ownerId = ids.get('asha@example.com')!;

  console.log('▸ creating the society');
  const { data: community, error: communityError } = await db
    .from('communities')
    .upsert(
      {
        slug: 'green-valley',
        join_code: 'MHR4827',
        name: 'My Home Residency',
        city: 'Hyderabad',
        created_by: ownerId,
      },
      { onConflict: 'slug' },
    )
    .select()
    .single();
  if (communityError || !community) throw communityError;

  // The trigger seeds the founder as owner only on INSERT, so an upsert onto
  // an existing row needs the membership ensured explicitly.
  await db
    .from('memberships')
    .upsert(
      { community_id: community.id, user_id: ownerId, role: 'owner', status: 'active' },
      { onConflict: 'community_id,user_id' },
    );

  console.log('▸ adding flats');
  const unitRows = [
    ...['101', '102', '201', '202'].map((number) => ({ block: 'A', number })),
    ...['101', '102', '201'].map((number) => ({ block: 'B', number })),
  ].map((unit) => ({ ...unit, community_id: community.id }));
  await db
    .from('units')
    .upsert(unitRows, { onConflict: 'community_id,block,number', ignoreDuplicates: true });

  const { data: units } = await db
    .from('units')
    .select('id, block, number')
    .eq('community_id', community.id)
    .order('block')
    .order('number');

  console.log('▸ adding members');
  for (const person of PEOPLE.slice(1)) {
    await db.from('memberships').upsert(
      {
        community_id: community.id,
        user_id: ids.get(person.email)!,
        role: person.role,
        status: 'active',
      },
      { onConflict: 'community_id,user_id' },
    );
  }

  const { data: memberships } = await db
    .from('memberships')
    .select('id, user_id')
    .eq('community_id', community.id);
  const memberFor = (email: string) =>
    memberships?.find((m) => m.user_id === ids.get(email))?.id ?? null;

  // Seat the residents in flats.
  for (const [email, index] of [
    ['dev@example.com', 0],
    ['esha@example.com', 1],
  ] as const) {
    const unit = units?.[index];
    const membershipId = memberFor(email);
    if (!unit || !membershipId) continue;
    await db
      .from('unit_occupants')
      .upsert(
        { unit_id: unit.id, membership_id: membershipId, relation: 'owner', is_primary: true },
        { onConflict: 'unit_id,membership_id', ignoreDuplicates: true },
      );
  }

  console.log('▸ creating an event, mid-flight');
  const { data: event, error: eventError } = await db
    .from('events')
    .upsert(
      {
        community_id: community.id,
        slug: 'ganesh-2026',
        emoji: '🎉',
        name: 'Ganesh Chaturthi 2026',
        starts_on: inDays(21),
        venue: 'Clubhouse',
        organizer: 'Society Cultural Committee',
        description:
          'Ten days of pooja, cultural performances and community meals. Everyone welcome.',
        status: 'published',
        expected_attendance: 200,
        fund_target: 150000,
        fund_rule: 'carry_next_edition',
        fund_rule_note: 'Any surplus will be carried forward to Ganesh Chaturthi 2027.',
        created_by: ownerId,
      },
      { onConflict: 'community_id,slug' },
    )
    .select()
    .single();
  if (eventError || !event) throw eventError;

  console.log('▸ building the checklist');
  const tasks: [string, 'todo' | 'in_progress' | 'done'][] = [
    ['Finalize idol / deity arrangements', 'done'],
    ['Order pooja materials', 'done'],
    ['Book the priest', 'done'],
    ['Select decoration vendor', 'done'],
    ['Confirm stage and mandap setup', 'in_progress'],
    ['Finalize food vendor', 'in_progress'],
    ['Confirm prasad arrangements', 'todo'],
    ['Book sound system', 'done'],
    ['Arrange generator backup', 'todo'],
    ['Finalize cultural program', 'in_progress'],
    ['Schedule the final rehearsal', 'todo'],
    ['Recruit volunteers', 'done'],
    ['Book photographer', 'todo'],
  ];
  await db.from('event_tasks').insert(
    tasks.map(([name, status], index) => ({
      event_id: event.id,
      community_id: community.id,
      name,
      status,
      position: index,
      assignee_id: memberFor(PEOPLE[index % PEOPLE.length]!.email),
    })),
  );

  console.log('▸ opening activities and volunteer roles');
  await db.from('event_activities').insert(
    [
      { name: 'Dance', emoji: '💃', description: 'Group dance — all ages welcome.' },
      { name: 'Singing', emoji: '🎤', description: 'Devotional and folk singing.' },
      { name: 'Skit', emoji: '🎭', description: 'A short community skit.' },
      { name: 'Kids performance', emoji: '🧒', description: 'A stage for our youngest.' },
      { name: 'Open mic', emoji: '🎙️', description: 'Five minutes, open to everyone.' },
    ].map((activity, index) => ({
      ...activity,
      event_id: event.id,
      community_id: community.id,
      position: index,
      coordinator_id: memberFor('chitra@example.com'),
    })),
  );

  await db.from('volunteer_roles').insert(
    [
      { name: 'Decoration', emoji: '🎈', target_count: 6 },
      { name: 'Food', emoji: '🍛', target_count: 5 },
      { name: 'Photography', emoji: '📷', target_count: 2 },
      { name: 'Cleanup', emoji: '🧹', target_count: 8 },
    ].map((role, index) => ({
      ...role,
      event_id: event.id,
      community_id: community.id,
      position: index,
      coordinator_id: memberFor('bala@example.com'),
    })),
  );

  const { data: activities } = await db
    .from('event_activities')
    .select('id')
    .eq('event_id', event.id);
  const { data: roles } = await db.from('volunteer_roles').select('id').eq('event_id', event.id);

  // A few sign-ups so the counts are not all zero.
  if (activities?.length) {
    await db.from('activity_participants').upsert(
      [
        { activity_id: activities[0]!.id, membership_id: memberFor('dev@example.com')! },
        { activity_id: activities[3]!.id, membership_id: memberFor('esha@example.com')! },
      ],
      { onConflict: 'activity_id,membership_id', ignoreDuplicates: true },
    );
  }
  if (roles?.length) {
    await db.from('event_volunteers').upsert(
      [
        { role_id: roles[0]!.id, membership_id: memberFor('esha@example.com')! },
        { role_id: roles[1]!.id, membership_id: memberFor('dev@example.com')! },
        { role_id: roles[1]!.id, membership_id: memberFor('chitra@example.com')! },
      ],
      { onConflict: 'role_id,membership_id', ignoreDuplicates: true },
    );
  }

  console.log('▸ collecting contributions');
  await db.from('contributions').insert(
    [
      ['asha@example.com', 5000],
      ['bala@example.com', 2000],
      ['chitra@example.com', 2500],
      ['dev@example.com', 1000],
      ['esha@example.com', 3000],
    ].map(([email, amount]) => ({
      event_id: event.id,
      community_id: community.id,
      membership_id: memberFor(email as string),
      amount: amount as number,
      method: 'upi' as const,
      status: 'succeeded' as const,
    })),
  );

  console.log('▸ recording spending, approved and pending');
  const { data: expenses } = await db
    .from('expenses')
    .insert([
      {
        event_id: event.id,
        community_id: community.id,
        name: 'Decoration',
        category: 'decoration',
        amount: 4500,
        vendor: 'ABC Decorations',
        bill_url: 'bills/abc-decorations.pdf',
        requested_by: memberFor('chitra@example.com'),
        status: 'pending' as const,
      },
      {
        event_id: event.id,
        community_id: community.id,
        name: 'Sound system',
        category: 'sound',
        amount: 3000,
        vendor: 'Beat Box Audio',
        bill_url: 'bills/beatbox-invoice.pdf',
        requested_by: memberFor('chitra@example.com'),
        status: 'pending' as const,
      },
      {
        event_id: event.id,
        community_id: community.id,
        name: 'Pooja materials',
        amount: 1800,
        vendor: 'Sri Ganesh Stores',
        bill_url: 'bills/sri-ganesh-stores.pdf',
        requested_by: memberFor('chitra@example.com'),
        status: 'pending' as const,
      },
    ])
    .select('id');

  // Approve two of the three, leaving one for the admin to decide — which is
  // also what makes the "waiting on you" panel non-empty on first run.
  for (const expense of (expenses ?? []).slice(0, 2)) {
    await db
      .from('expenses')
      .update({
        status: 'approved',
        approved_by: memberFor('asha@example.com'),
        approved_at: new Date().toISOString(),
      })
      .eq('id', expense.id);
  }

  console.log('▸ posting a notice and a poll');
  await db.from('announcements').insert([
    {
      community_id: community.id,
      event_id: event.id,
      author_id: memberFor('asha@example.com'),
      title: 'Water tank cleaning this Saturday',
      body: 'Supply will be off from 10am to 2pm. Please store what you need.',
      is_pinned: true,
    },
  ]);

  const { data: poll } = await db
    .from('polls')
    .insert({
      community_id: community.id,
      question: 'Should we organise a children’s drawing competition?',
      created_by: memberFor('bala@example.com'),
    })
    .select('id')
    .single();

  if (poll) {
    await db.from('poll_options').insert([
      { poll_id: poll.id, label: 'Yes', emoji: '👍', position: 0 },
      { poll_id: poll.id, label: 'No', emoji: '👎', position: 1 },
    ]);
  }

  console.log('▸ suggesting an activity');
  await db.from('activity_suggestions').insert({
    community_id: community.id,
    name: 'Weekend badminton tournament',
    description: 'Open to all ages, played over two Saturdays on the back courts.',
    expected_participants: 24,
    wants_to_coordinate: true,
    suggested_by: memberFor('dev@example.com'),
  });

  console.log('▸ putting a few neighbours on the marketplace');
  const { data: listings } = await db
    .from('listings')
    .insert([
      {
        community_id: community.id,
        membership_id: memberFor('dev@example.com')!,
        unit_id: units?.[0]?.id ?? null,
        category: 'home_food',
        title: 'Fresh idly & dosa batter',
        description: 'Ground every morning, no soda. Order by 8 pm for the next day.',
        price_note: '₹80 a kg',
        contact_phone: '+919845010404',
      },
      {
        community_id: community.id,
        membership_id: memberFor('esha@example.com')!,
        unit_id: units?.[1]?.id ?? null,
        category: 'tuition',
        title: 'Hindi classes for kids (6–12)',
        description: 'Saturday and Sunday mornings in the clubhouse. Reading, writing and stories.',
        price_note: '₹1,200 a month',
        contact_phone: '+919845010505',
      },
    ])
    .select('id, membership_id');
  const batter = listings?.find((row) => row.membership_id === memberFor('dev@example.com'));
  if (batter) {
    await db.from('listing_reviews').insert({
      community_id: community.id,
      listing_id: batter.id,
      membership_id: memberFor('esha@example.com')!,
      rating: 5,
      body: 'Soft idlis every single time.',
    });
  }

  console.log('\n✓ Seeded “My Home Residency”.');
  console.log('  Society ID: MHR4827');
  console.log('  Sign in with a magic link as any of:');
  for (const person of PEOPLE) console.log(`    ${person.email}  (${person.role})`);
  console.log('\n  One expense is waiting for an admin to approve it.');
}

main().catch((error) => {
  console.error('\n✗ Seeding failed:', error?.message ?? error);
  process.exit(1);
});
