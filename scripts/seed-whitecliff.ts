/**
 * Fills an existing community with a believable, clearly fictional society
 * modelled on Sraddha White Cliff, Seegehalli (Bengaluru): two towers, 220
 * 2 and 3 BHK flats. Residents, money and events are invented; nothing here
 * describes real people.
 *
 * Uses the three pilot roles: committee (President, Secretary, Treasurer),
 * staff (Supervisor, Facility Manager — operators who never contribute, vote,
 * suggest or register) and residents, several flats with two accounts.
 *
 * Every demo account uses an `@demo.compences.test` address (a reserved,
 * undeliverable domain) and `user_metadata.demo = true`, so `--clean` can find
 * and remove exactly what this script added while keeping the community and
 * its real members.
 *
 *   tsx scripts/seed-whitecliff.ts [community-slug]           # seed
 *   tsx scripts/seed-whitecliff.ts [community-slug] --clean   # remove demo data
 *
 * Needs SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.
 * The service role bypasses row-level security, so point it only at a project
 * you mean to change.
 */
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../packages/supabase/src/database.types';

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const args = process.argv.slice(2);
const CLEAN = args.includes('--clean');
const SLUG = args.find((arg) => !arg.startsWith('--')) ?? 'shraddha-whitecliff';
const DEMO_DOMAIN = 'demo.compences.test';

const db = createClient<Database>(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Tables = Database['public']['Tables'];
type Relation = Database['public']['Enums']['occupant_relation'];
type Channel = Database['public']['Enums']['origin_channel'];
type ExpenseStatus = Database['public']['Enums']['expense_status'];
type SuggestionStatus = Database['public']['Enums']['suggestion_status'];

// ── People ──────────────────────────────────────────────────────────────────

const COMMITTEE = [
  { name: 'Ramesh Gowda', title: 'President' },
  { name: 'Anitha Rao', title: 'Secretary' },
  { name: 'Lakshmi Narayanan', title: 'Treasurer' },
];

const STAFF = [
  { name: 'Manjunath B', title: 'Supervisor' },
  { name: 'Joseph Mathew', title: 'Facility Manager' },
];

/** Resident households: one or two accounts per flat, owners or tenants. */
const HOUSEHOLDS: { people: string[]; tenant?: boolean }[] = [
  { people: ['Kavya Shetty', 'Rohit Shetty'] },
  { people: ['Vikram Malhotra'], tenant: true },
  { people: ['Ananya Iyer', 'Karthik Iyer'] },
  { people: ['Suresh Kumar'] },
  { people: ['Deepa Nair', 'Arun Nair'] },
  { people: ['Rahul Verma', 'Sneha Verma'], tenant: true },
  { people: ['Meera Rao'] },
  { people: ['Neha Agarwal'], tenant: true },
  { people: ['Shalini Pillai', 'Rajesh Pillai'] },
  { people: ['Aditya Joshi'] },
  { people: ['Sowmya Prakash', 'Prakash Murthy'] },
  { people: ['Imran Khan'], tenant: true },
  { people: ['Divya Menon'] },
  { people: ['Harish Bhat', 'Geetha Bhat'] },
  { people: ['Pooja Sinha'], tenant: true },
  { people: ['Naveen Chandra'] },
  { people: ['Rekha Srinivas', 'Srinivas Rao'] },
  { people: ['Siddharth Kulkarni'] },
  { people: ['Thomas George', 'Mary George'] },
  { people: ['Bhavana Kamath'] },
];

const WAITING = ['Rohan Deshpande', 'Latha Venkatesh', 'Sameer Qureshi'];

const KIDS = ['Aarav', 'Diya', 'Ishaan', 'Anika', 'Vihaan', 'Myra', 'Reyansh', 'Saanvi'];

const emailFor = (name: string) =>
  `${name
    .toLowerCase()
    .replace(/[^a-z]+/g, '.')
    .replace(/^\.|\.$/g, '')}@${DEMO_DOMAIN}`;

const DAY = 86_400_000;
const at = (iso: string) => new Date(iso).toISOString();
const daysAgo = (days: number) => new Date(Date.now() - days * DAY).toISOString();
const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** Deterministic pseudo-random so re-running produces the same society. */
let seed = 20260913;
const rand = () => (seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31) / 2 ** 31;
const pick = <T>(items: readonly T[]) => items[Math.floor(rand() * items.length)]!;
const shuffle = <T>(items: readonly T[]) => [...items].sort(() => rand() - 0.5);

/**
 * Throws on a query error. Callers only use the returned data after a
 * `.select()`, where a successful query always has rows or a row.
 */
function check<T>(
  label: string,
  result: { data: T; error: { message: string } | null },
): NonNullable<T> {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data as NonNullable<T>;
}

async function listDemoUsers() {
  const users: { id: string; email?: string }[] = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    users.push(...data.users.filter((user) => user.email?.endsWith(`@${DEMO_DOMAIN}`)));
    if (data.users.length < 200) return users;
  }
}

async function createDemoUser(name: string) {
  const { data, error } = await db.auth.admin.createUser({
    email: emailFor(name),
    email_confirm: true,
    user_metadata: { full_name: name, demo: true },
  });
  if (error || !data.user) throw new Error(`create ${name}: ${error?.message}`);
  return data.user.id;
}

async function findCommunity() {
  const community = check(
    'find community',
    await db.from('communities').select('id, name, created_by').eq('slug', SLUG).maybeSingle(),
  );
  if (!community) throw new Error(`No community with slug "${SLUG}".`);
  return community;
}

// ── Clean ───────────────────────────────────────────────────────────────────

async function clean() {
  const community = await findCommunity();
  const where = { community_id: community.id } as const;
  console.log(`▸ removing demo data from “${community.name}”`);

  // Events cascade to budget lines, activities, registrations, contributions
  // and expenses. Reallocations reference events, so they go first.
  for (const table of [
    'fund_reallocations',
    'polls',
    'announcements',
    'activity_suggestions',
    'invite_codes',
    'join_requests',
    'events',
    'units',
  ] as const) {
    check(`clear ${table}`, await db.from(table).delete().match(where));
    console.log(`   ${table}`);
  }

  const demo = await listDemoUsers();
  for (const user of demo) {
    const { error } = await db.auth.admin.deleteUser(user.id);
    if (error) throw new Error(`delete ${user.email}: ${error.message}`);
  }
  console.log(`   ${demo.length} demo accounts`);
  console.log('\n✓ Demo data removed. The community and its real members are untouched.');
}

// ── Seed ────────────────────────────────────────────────────────────────────

type Member = {
  name: string;
  userId: string;
  role: 'resident' | 'staff' | 'committee';
  membershipId: string;
  unitId: string | null;
  household: number | null;
};

type EventSpec = {
  slug: string;
  emoji: string;
  name: string;
  startsOn: string;
  endsOn?: string;
  venue: string;
  organizer: string;
  description: string;
  expectedAttendance: number;
  fundRule: Database['public']['Enums']['fund_rule'];
  fundRuleNote?: string;
  budget: [category: string, amount: number][];
  activities: { name: string; emoji: string; description: string; capacity?: number }[];
  registrations: number;
  giving: {
    members: number;
    offlineFlats: number;
    amounts: number[];
    from: string;
    to: string;
  };
  expenses: [
    name: string,
    category: string,
    amount: number,
    vendor: string,
    status: ExpenseStatus,
    spentOn: string,
    note?: string,
  ][];
  suggestions: {
    kind: 'activity' | 'idea';
    name: string;
    description: string;
    status: SuggestionStatus;
    reviewNote?: string;
  }[];
};

const EVENTS: EventSpec[] = [
  {
    slug: 'ganesh-chaturthi-2026',
    emoji: '🪔',
    name: 'Ganesh Chaturthi 2026',
    startsOn: '2026-09-14',
    endsOn: '2026-09-16',
    venue: 'Clubhouse amphitheatre',
    organizer: 'Whitecliff Residents Association',
    description:
      'Three days with an eco-friendly clay idol: daily pooja and aarti, cultural evenings, a community lunch on day two, and visarjan in the portable tank near the clubhouse.',
    expectedAttendance: 450,
    fundRule: 'carry_next_edition',
    fundRuleNote: 'Any surplus is carried to Ganesh Chaturthi 2027.',
    budget: [
      ['Idol & pooja', 38000],
      ['Pandal & decoration', 45000],
      ['Sound & lighting', 22000],
      ['Community lunch', 52000],
      ['Visarjan tank', 9000],
      ['Cultural programme', 10000],
      ['Cleaning & misc', 4000],
    ],
    activities: [
      {
        name: 'Bharatanatyam',
        emoji: '💃',
        description: 'Solo and group items, day one.',
        capacity: 16,
      },
      { name: 'Bhajans', emoji: '🎶', description: 'Evening bhajans with harmonium and tabla.' },
      {
        name: 'Kids skit: Ganesha stories',
        emoji: '🎭',
        description: 'Ages 6–12, two rehearsals.',
        capacity: 20,
      },
      {
        name: 'Rangoli competition',
        emoji: '🎨',
        description: 'Teams of two in the clubhouse foyer.',
        capacity: 24,
      },
    ],
    registrations: 34,
    giving: {
      members: 24,
      offlineFlats: 46,
      amounts: [1001, 1001, 2001, 2001, 2501, 3001, 5001],
      from: '2026-08-20T09:00:00+05:30',
      to: '2026-09-13T11:00:00+05:30',
    },
    expenses: [
      [
        'Clay idol and transport',
        'Idol & pooja',
        26000,
        'Kumbarapete Idol Makers',
        'approved',
        '2026-09-08',
      ],
      [
        'Pandal, stage and chairs',
        'Pandal & decoration',
        41000,
        'Shubh Tent House',
        'approved',
        '2026-09-10',
      ],
      [
        'Sound and lights (3 days)',
        'Sound & lighting',
        19500,
        'Whitefield Sound & Lights',
        'approved',
        '2026-09-09',
      ],
      [
        'Lunch caterer advance',
        'Community lunch',
        25000,
        'Sri Krishna Caterers',
        'approved',
        '2026-09-06',
      ],
      [
        'Flowers and pooja items',
        'Idol & pooja',
        9800,
        'KR Market Traders',
        'pending',
        '2026-09-12',
      ],
      [
        'Portable visarjan tank',
        'Visarjan tank',
        8500,
        'Eco Visarjan Services',
        'changes_requested',
        '2026-09-12',
        'Bill shows ₹8,500 but the quote was ₹7,500. Please re-upload the corrected bill.',
      ],
    ],
    suggestions: [
      {
        kind: 'activity',
        name: 'Kids clay Ganesha workshop',
        description: 'Children make small clay idols on day one.',
        status: 'accepted',
      },
      {
        kind: 'idea',
        name: 'Steel plates instead of disposables',
        description: 'Hire steel plates for the lunch to cut plastic waste.',
        status: 'accepted',
      },
      {
        kind: 'activity',
        name: 'Dhol tasha procession',
        description: 'A short procession around both towers before visarjan.',
        status: 'declined',
        reviewNote: 'Noise limits after 10 pm; we will revisit for next year with an earlier slot.',
      },
      {
        kind: 'idea',
        name: 'Live-stream the aarti for elders',
        description: 'Stream on the society YouTube for residents who cannot come down.',
        status: 'new',
      },
    ],
  },
  {
    slug: 'dussehra-2026',
    emoji: '🏹',
    name: 'Dussehra & Ayudha Pooja 2026',
    startsOn: '2026-10-19',
    endsOn: '2026-10-20',
    venue: 'Central lawn and basement parking',
    organizer: 'Whitecliff Residents Association',
    description:
      'Ayudha Pooja for vehicles and tools on day one with the security and maintenance teams, then a Golu display, dandiya night and Vijayadashami celebrations on the lawn.',
    expectedAttendance: 300,
    fundRule: 'general_fund',
    budget: [
      ['Pooja & flowers', 14000],
      ['Golu display', 9000],
      ['Dandiya night', 30000],
      ['Food & sweets', 28000],
      ['Staff gifts', 10000],
      ['Decoration', 6000],
    ],
    activities: [
      {
        name: 'Dandiya night',
        emoji: '🥢',
        description: 'Dandiya and garba on the lawn, all ages.',
      },
      {
        name: 'Golu display',
        emoji: '🪆',
        description: 'Bring dolls from home for the clubhouse Golu.',
      },
      {
        name: 'Kids fancy dress',
        emoji: '🧒',
        description: 'Characters from the Ramayana.',
        capacity: 30,
      },
    ],
    registrations: 22,
    giving: {
      members: 14,
      offlineFlats: 14,
      amounts: [501, 1001, 1001, 1501, 2001],
      from: '2026-09-01T09:00:00+05:30',
      to: '2026-09-13T09:00:00+05:30',
    },
    expenses: [
      ['Dandiya DJ advance', 'Dandiya night', 8000, 'Beat Box Events', 'approved', '2026-09-10'],
      ['Golu steps rental', 'Golu display', 3500, 'Shubh Tent House', 'pending', '2026-09-11'],
    ],
    suggestions: [
      {
        kind: 'activity',
        name: 'Ramleela skit by teenagers',
        description: 'A 20-minute skit before dandiya.',
        status: 'accepted',
      },
      {
        kind: 'idea',
        name: 'Thank-you lunch for security staff',
        description: 'Serve the staff lunch first on Ayudha Pooja.',
        status: 'accepted',
      },
      {
        kind: 'activity',
        name: 'Ravana effigy burning',
        description: 'A small effigy on the lawn.',
        status: 'declined',
        reviewNote: 'Fire safety rules do not allow open fires on the lawn.',
      },
    ],
  },
  {
    slug: 'diwali-2026',
    emoji: '✨',
    name: 'Deepavali 2026',
    startsOn: '2026-11-08',
    venue: 'Clubhouse party area and poolside',
    organizer: 'Whitecliff Residents Association',
    description:
      'Diya lighting around the pool, a rangoli walk through both towers, a sweets exchange, and a green-crackers-only window from 7 to 9 pm.',
    expectedAttendance: 420,
    fundRule: 'carry_related',
    fundRuleNote: 'Any surplus goes towards the New Year’s Eve party.',
    budget: [
      ['Diyas & lighting', 26000],
      ['Rangoli & decoration', 18000],
      ['Sweets & snacks', 42000],
      ['Music & sound', 20000],
      ['Fire safety', 14000],
      ['Prizes', 8000],
      ['Cleaning', 6000],
    ],
    activities: [
      {
        name: 'Rangoli walk',
        emoji: '🎨',
        description: 'One rangoli per floor landing, judged at 6 pm.',
        capacity: 44,
      },
      {
        name: 'Diya painting for kids',
        emoji: '🪔',
        description: 'Paint your own diya, ages 4–12.',
        capacity: 40,
      },
      {
        name: 'Antakshari: Tower A vs Tower B',
        emoji: '🎤',
        description: 'Old and new Bollywood and Kannada songs.',
      },
    ],
    registrations: 26,
    giving: {
      members: 9,
      offlineFlats: 6,
      amounts: [1001, 2001, 2001, 3001],
      from: '2026-09-07T09:00:00+05:30',
      to: '2026-09-13T08:00:00+05:30',
    },
    expenses: [
      [
        'Bulk diyas and wicks',
        'Diyas & lighting',
        6500,
        'Kumbarapete Potters',
        'approved',
        '2026-09-11',
      ],
      ['Sweets tasting samples', 'Sweets & snacks', 1800, 'Anand Sweets', 'pending', '2026-09-12'],
    ],
    suggestions: [
      {
        kind: 'idea',
        name: 'Green crackers only, 7–9 pm',
        description: 'A fixed window to protect pets and elders.',
        status: 'accepted',
      },
      {
        kind: 'activity',
        name: 'Lantern-making workshop',
        description: 'Paper lanterns the weekend before.',
        status: 'accepted',
      },
      {
        kind: 'activity',
        name: 'Housie night',
        description: 'Tambola with small prizes after dinner.',
        status: 'new',
      },
    ],
  },
  {
    slug: 'christmas-2026',
    emoji: '🎄',
    name: 'Christmas 2026',
    startsOn: '2026-12-24',
    endsOn: '2026-12-25',
    venue: 'Clubhouse lobby and terrace',
    organizer: 'Whitecliff Residents Association',
    description:
      'Tree lighting in the lobby on Christmas Eve, carols by the residents’ choir, a Secret Santa for kids and cake on the terrace.',
    expectedAttendance: 220,
    fundRule: 'general_fund',
    budget: [
      ['Tree & decoration', 15000],
      ['Cake & snacks', 18000],
      ['Secret Santa gifts', 12000],
      ['Choir & sound', 8000],
      ['Santa costume & props', 5000],
    ],
    activities: [
      {
        name: 'Carol choir',
        emoji: '🎵',
        description: 'Three rehearsals in December.',
        capacity: 24,
      },
      { name: 'Secret Santa for kids', emoji: '🎁', description: 'Gifts under ₹500, ages 3–12.' },
    ],
    registrations: 9,
    giving: {
      members: 4,
      offlineFlats: 0,
      amounts: [1001, 2001],
      from: '2026-09-10T09:00:00+05:30',
      to: '2026-09-13T08:00:00+05:30',
    },
    expenses: [
      [
        'Tree quote (8 ft)',
        'Tree & decoration',
        6000,
        'Garden City Nursery',
        'pending',
        '2026-09-12',
      ],
    ],
    suggestions: [
      {
        kind: 'idea',
        name: 'Donate unused gifts to an orphanage',
        description: 'Collect extra gifts for Ashraya children’s home.',
        status: 'new',
      },
    ],
  },
  {
    slug: 'new-years-eve-2026',
    emoji: '🎆',
    name: 'New Year’s Eve 2026',
    startsOn: '2026-12-31',
    venue: 'Clubhouse terrace',
    organizer: 'Whitecliff Residents Association',
    description: 'DJ, dinner buffet, a kids’ corner until 10 pm and a countdown on the terrace.',
    expectedAttendance: 320,
    fundRule: 'general_fund',
    budget: [
      ['DJ & sound', 35000],
      ['Dinner buffet', 70000],
      ['Decoration & lighting', 20000],
      ['Kids corner', 8000],
      ['Security & cleanup', 12000],
    ],
    activities: [
      {
        name: 'Dance performances',
        emoji: '🕺',
        description: 'Group dances before the countdown.',
        capacity: 30,
      },
    ],
    registrations: 5,
    giving: {
      members: 3,
      offlineFlats: 1,
      amounts: [2001, 5001],
      from: '2026-09-11T09:00:00+05:30',
      to: '2026-09-13T08:00:00+05:30',
    },
    expenses: [],
    suggestions: [
      {
        kind: 'activity',
        name: 'Bollywood theme night',
        description: 'Dress up as your favourite film character.',
        status: 'accepted',
      },
      {
        kind: 'idea',
        name: 'No alcohol on the terrace',
        description: 'Keep it family friendly.',
        status: 'new',
      },
    ],
  },
];

async function seedSociety() {
  const community = await findCommunity();
  const existingEvents = check(
    'count events',
    await db.from('events').select('id').eq('community_id', community.id),
  );
  if (existingEvents.length) {
    throw new Error(
      `“${community.name}” already has ${existingEvents.length} event(s). Run with --clean first.`,
    );
  }
  const cid = community.id;
  console.log(`▸ seeding “${community.name}” (${SLUG})`);

  check(
    'describe community',
    await db
      .from('communities')
      .update({
        city: 'Bengaluru',
        timezone: 'Asia/Kolkata',
        currency: 'INR',
        // Deliberately not a real UPI handle: a test payment from the demo
        // fails in the UPI app instead of reaching a stranger. The committee
        // sets the society's real UPI ID in the app.
        upi_vpa: 'whitecliff.demo@compencesdemo',
        upi_payee_name: 'Whitecliff Residents Association',
        address: 'Seegehalli Village Road, Seegehalli, Whitefield',
        pincode: '560067',
        // The demo is a fully running society, so skip the setup checklist.
        catalogue_reviewed_at: new Date().toISOString(),
        setup_completed_at: new Date().toISOString(),
      })
      .eq('id', cid),
  );

  // Flats: 2 towers × 11 floors × 10 flats = 220.
  console.log('▸ adding 220 flats across Tower A and Tower B');
  const unitRows: Tables['units']['Insert'][] = ['A', 'B'].flatMap((block) =>
    Array.from({ length: 11 }, (_, f) => f + 1).flatMap((floor) =>
      Array.from({ length: 10 }, (_, i) => i + 1).map((flat) => {
        const threeBhk = flat <= 4; // corner and park-facing stacks are 3 BHK
        return {
          community_id: cid,
          block,
          floor,
          number: `${floor}${String(flat).padStart(2, '0')}`,
          bedrooms: threeBhk ? 3 : 2,
          area_sqft: threeBhk ? pick([1515, 1680, 1840, 2075]) : pick([1140, 1185, 1230]),
        };
      }),
    ),
  );
  const units = check('insert units', await db.from('units').insert(unitRows).select('id'));
  const flats = shuffle(units.map((unit) => unit.id));
  let nextFlat = 0;
  const takeFlat = () => flats[nextFlat++]!;

  const members: Member[] = [];

  async function addMember(
    name: string,
    role: Member['role'],
    options: {
      title?: string;
      unitId?: string | null;
      relation?: Relation;
      household?: number | null;
    },
  ) {
    const userId = await createDemoUser(name);
    const membership = check(
      `membership ${name}`,
      await db
        .from('memberships')
        .insert({
          community_id: cid,
          user_id: userId,
          role,
          title: options.title ?? null,
          status: 'active',
          joined_at: daysAgo(150 - members.length * 3),
        })
        .select('id')
        .single(),
    );
    const unitId = options.unitId ?? null;
    if (unitId) {
      check(
        `seat ${name}`,
        await db.from('unit_occupants').insert({
          unit_id: unitId,
          membership_id: membership.id,
          relation: options.relation ?? 'owner',
          // Only the first account in a flat is its primary occupant.
          is_primary: !members.some((member) => member.unitId === unitId),
          moved_in_on: new Date(Date.now() - (400 + members.length * 29) * DAY)
            .toISOString()
            .slice(0, 10),
        }),
      );
    }
    const member: Member = {
      name,
      userId,
      role,
      membershipId: membership.id,
      unitId,
      household: options.household ?? null,
    };
    members.push(member);
    return member;
  }

  console.log('▸ creating committee, staff and residents');
  for (const person of COMMITTEE) {
    await addMember(person.name, 'committee', { title: person.title, unitId: takeFlat() });
  }
  for (const person of STAFF) {
    await addMember(person.name, 'staff', { title: person.title });
  }
  for (const [index, household] of HOUSEHOLDS.entries()) {
    const unitId = takeFlat();
    for (const [position, name] of household.people.entries()) {
      await addMember(name, 'resident', {
        unitId,
        household: index,
        relation: household.tenant ? 'tenant' : position === 0 ? 'owner' : 'family',
      });
    }
  }

  const by = (name: string) => members.find((member) => member.name === name)!;
  const treasurer = by('Lakshmi Narayanan');
  const president = by('Ramesh Gowda');
  const staff = members.filter((member) => member.role === 'staff');
  const participants = members.filter((member) => member.role !== 'staff');
  const occupiedFlats = new Set(members.map((member) => member.unitId).filter(Boolean));
  const waitingFlats = [takeFlat(), takeFlat(), takeFlat()];
  const offlineFlats = flats.slice(nextFlat).filter((id) => !occupiedFlats.has(id));

  const summary: string[] = [];

  async function insertBudget(eventId: string, budget: EventSpec['budget']) {
    check(
      'budget lines',
      await db.from('budget_lines').insert(
        budget.map(([category, amount], position) => ({
          event_id: eventId,
          community_id: cid,
          category,
          amount,
          position,
        })),
      ),
    );
  }

  async function insertContributions(eventId: string, giving: EventSpec['giving']) {
    const start = new Date(giving.from).getTime();
    const span = new Date(giving.to).getTime() - start;
    const when = () => new Date(start + rand() * span).toISOString();
    // UPI references (UTRs) are 12 digits.
    const upiRef = () =>
      `6${Math.floor(rand() * 1e11)
        .toString()
        .padStart(11, '0')}`;
    const verifier = staff[0]?.membershipId ?? null;

    const online: Tables['contributions']['Insert'][] = shuffle(participants)
      .slice(0, giving.members)
      .map((member) => {
        const method = rand() < 0.85 ? ('upi' as const) : ('bank_transfer' as const);
        // Some residents have reported a UPI payment staff have not checked yet.
        const confirmed = method !== 'upi' || rand() < 0.85;
        const paidAt = when();
        return {
          event_id: eventId,
          community_id: cid,
          membership_id: member.membershipId,
          unit_id: member.unitId,
          amount: pick(giving.amounts),
          method,
          status: confirmed ? ('succeeded' as const) : ('pending' as const),
          verified_by: confirmed ? verifier : null,
          verified_at: confirmed ? paidAt : null,
          channel: pick(['web', 'mobile', 'mobile'] as const satisfies readonly Channel[]),
          reference: method === 'upi' ? upiRef() : null,
          paid_at: paidAt,
        };
      });
    // Flats that never open the app pay staff by UPI or cash; staff record the
    // payment against the flat with no member attached.
    const offline: Tables['contributions']['Insert'][] = shuffle(offlineFlats)
      .slice(0, giving.offlineFlats)
      .map((unitId) => {
        const method = rand() < 0.6 ? ('upi' as const) : ('cash' as const);
        return {
          event_id: eventId,
          community_id: cid,
          membership_id: null,
          unit_id: unitId,
          amount: pick(giving.amounts),
          method,
          status: 'succeeded',
          verified_by: verifier,
          verified_at: new Date().toISOString(),
          channel: 'system',
          reference: method === 'upi' ? upiRef() : null,
          paid_at: when(),
        };
      });
    const rows = [...online, ...offline];
    if (rows.length) {
      check('contributions', await db.from('contributions').insert(rows, { defaultToNull: false }));
    }
    // Only confirmed money counts as raised, the same as event_stats.
    return rows
      .filter((row) => row.status === 'succeeded')
      .reduce((sum, row) => sum + row.amount, 0);
  }

  async function insertExpenses(eventId: string, expenses: EventSpec['expenses']) {
    const rows: Tables['expenses']['Insert'][] = expenses.map(
      ([name, category, amount, vendor, status, spentOn, note], index) => {
        const requester = staff[index % staff.length]!;
        return {
          event_id: eventId,
          community_id: cid,
          name,
          category,
          amount,
          vendor,
          method: 'upi',
          spent_on: spentOn,
          bill_url: `bills/${slugify(name)}.pdf`,
          requested_by: requester.membershipId,
          paid_by: requester.membershipId,
          status,
          approved_by: status === 'approved' ? treasurer.membershipId : null,
          approved_at: status === 'approved' ? at(`${spentOn}T18:30:00+05:30`) : null,
          review_note: note ?? null,
        };
      },
    );
    if (rows.length) {
      check('expenses', await db.from('expenses').insert(rows, { defaultToNull: false }));
    }
    return expenses
      .filter(([, , , , status]) => status === 'approved')
      .reduce((sum, [, , amount]) => sum + amount, 0);
  }

  async function insertActivities(eventId: string, spec: EventSpec) {
    const activities = check(
      'activities',
      await db
        .from('event_activities')
        .insert(
          spec.activities.map((activity, position) => ({
            ...activity,
            event_id: eventId,
            community_id: cid,
            position,
            coordinator_id: pick(COMMITTEE.map((person) => by(person.name).membershipId)),
          })),
          { defaultToNull: false },
        )
        .select('id'),
    );

    const seen = new Set<string>();
    const rows: Tables['activity_participants']['Insert'][] = [];
    const register = (activityId: string, member: Member, participantName: string | null) => {
      const key = `${activityId}:${member.membershipId}:${participantName ?? ''}`;
      if (seen.has(key)) return;
      seen.add(key);
      rows.push({
        activity_id: activityId,
        membership_id: member.membershipId,
        participant_name: participantName,
        age_group: participantName ? 'Kids (5–12)' : pick(['Adults', 'Teens', 'Seniors']),
        channel: pick(['web', 'mobile', 'mobile'] as const),
      });
    };

    for (let i = 0; rows.length < spec.registrations && i < spec.registrations * 4; i += 1) {
      const activity = pick(activities);
      const member = pick(participants);
      register(activity.id, member, null);
      // Whole households sign up together: the other account in the flat,
      // and sometimes a child registered by name.
      if (member.household !== null && rand() < 0.5) {
        const partner = participants.find(
          (other) => other.household === member.household && other !== member,
        );
        if (partner) register(activity.id, partner, null);
      }
      if (rand() < 0.35) {
        register(activity.id, member, `${pick(KIDS)} ${member.name.split(' ').at(-1)}`);
      }
    }
    const trimmed = rows.slice(0, spec.registrations);
    if (trimmed.length) {
      check(
        'registrations',
        await db.from('activity_participants').insert(trimmed, { defaultToNull: false }),
      );
    }
    return trimmed.length;
  }

  async function insertSuggestions(eventId: string, suggestions: EventSpec['suggestions']) {
    let votes = 0;
    for (const suggestion of suggestions) {
      const author = pick(participants.filter((member) => member.role === 'resident'));
      const row = check(
        `suggestion ${suggestion.name}`,
        await db
          .from('activity_suggestions')
          .insert({
            community_id: cid,
            event_id: eventId,
            kind: suggestion.kind,
            name: suggestion.name,
            description: suggestion.description,
            status: suggestion.status,
            review_note: suggestion.reviewNote ?? null,
            suggested_by: author.membershipId,
            expected_participants:
              suggestion.kind === 'activity' ? 10 + Math.floor(rand() * 30) : null,
            wants_to_coordinate: rand() < 0.4,
          })
          .select('id')
          .single(),
      );
      if (suggestion.status === 'accepted') {
        const voters = shuffle(participants).slice(0, 12 + Math.floor(rand() * 14));
        check(
          'suggestion votes',
          await db.from('suggestion_votes').insert(
            voters.map((voter) => ({
              suggestion_id: row.id,
              membership_id: voter.membershipId,
              support: rand() < 0.74,
              voted_at: daysAgo(Math.floor(rand() * 6)),
            })),
          ),
        );
        votes += voters.length;
      }
    }
    return votes;
  }

  // ── Events ──────────────────────────────────────────────────────────────────
  for (const spec of EVENTS) {
    console.log(`▸ ${spec.name}`);
    const fundTarget = spec.budget.reduce((sum, [, amount]) => sum + amount, 0);
    const event = check(
      `event ${spec.name}`,
      await db
        .from('events')
        .insert({
          community_id: cid,
          kind: 'event',
          slug: spec.slug,
          emoji: spec.emoji,
          name: spec.name,
          starts_on: spec.startsOn,
          ends_on: spec.endsOn ?? null,
          venue: spec.venue,
          organizer: spec.organizer,
          description: spec.description,
          status: 'published',
          expected_attendance: spec.expectedAttendance,
          fund_target: fundTarget,
          fund_rule: spec.fundRule,
          fund_rule_note: spec.fundRuleNote ?? null,
          created_by: community.created_by,
        })
        .select('id')
        .single(),
    );

    await insertBudget(event.id, spec.budget);
    const raised = await insertContributions(event.id, spec.giving);
    const spent = await insertExpenses(event.id, spec.expenses);
    if (spent > raised) {
      throw new Error(`${spec.name}: approved spending ₹${spent} exceeds raised ₹${raised}`);
    }
    const registrations = await insertActivities(event.id, spec);
    const votes = await insertSuggestions(event.id, spec.suggestions);
    summary.push(
      `  ${spec.name}: budget ₹${fundTarget.toLocaleString('en-IN')} · raised ₹${raised.toLocaleString('en-IN')} · spent ₹${spent.toLocaleString('en-IN')} · ${spec.expenses.length} bills · ${spec.activities.length} activities / ${registrations} registrations · ${spec.suggestions.length} suggestions / ${votes} votes`,
    );
  }

  // ── Campaigns ───────────────────────────────────────────────────────────────
  console.log('▸ fundraising campaigns');
  const solarBudget: EventSpec['budget'] = [
    ['Solar lamp posts (12)', 62000],
    ['Wiring & installation', 14000],
    ['Contingency', 6000],
  ];
  const solar = check(
    'solar campaign',
    await db
      .from('events')
      .insert({
        community_id: cid,
        kind: 'campaign',
        slug: 'solar-lights-jogging-track',
        emoji: '☀️',
        name: 'Solar lights for the jogging track',
        starts_on: '2026-10-01',
        description:
          'The jogging track is dark after 7 pm. Twelve solar lamp posts, no running cost. Proposed by residents of Tower B and approved by the committee.',
        status: 'published',
        fund_target: solarBudget.reduce((sum, [, amount]) => sum + amount, 0),
        fund_rule: 'general_fund',
        created_by: by('Siddharth Kulkarni').userId,
      })
      .select('id')
      .single(),
  );
  await insertBudget(solar.id, solarBudget);
  const solarRaised = await insertContributions(solar.id, {
    members: 12,
    offlineFlats: 10,
    amounts: [1001, 2001, 2001, 3001],
    from: '2026-08-25T09:00:00+05:30',
    to: '2026-09-12T20:00:00+05:30',
  });

  check(
    'proposed campaign',
    await db.from('events').insert({
      community_id: cid,
      kind: 'campaign',
      slug: 'rainwater-pit-repair',
      emoji: '💧',
      name: 'Repair the rainwater harvesting pits',
      starts_on: '2026-11-15',
      description:
        'Two of the four recharge pits are silted up. Desilting and new filter media before the next monsoon.',
      status: 'proposed',
      fund_target: 48000,
      fund_rule: 'general_fund',
      created_by: by('Harish Bhat').userId,
    }),
  );
  summary.push(
    `  Campaign “Solar lights for the jogging track”: raised ₹${solarRaised.toLocaleString('en-IN')} of ₹82,000`,
    '  Campaign “Repair the rainwater harvesting pits”: awaiting committee approval',
  );

  // ── Join requests ───────────────────────────────────────────────────────────
  console.log('▸ pending join requests');
  for (const [index, name] of WAITING.entries()) {
    const userId = await createDemoUser(name);
    check(
      `join request ${name}`,
      await db.from('join_requests').insert({
        community_id: cid,
        user_id: userId,
        unit_id: waitingFlats[index]!,
        claimed_name: name,
        claimed_phone: `+9198450${String(10000 + index * 7331).slice(0, 5)}`,
        relation: index === 1 ? 'tenant' : 'owner',
        status: 'pending',
      }),
    );
  }

  console.log(`\n✓ Seeded “${community.name}” with fictional data.`);
  console.log(
    `  220 flats · ${COMMITTEE.length} committee · ${STAFF.length} staff · ${members.filter((m) => m.role === 'resident').length} residents in ${HOUSEHOLDS.length} flats · ${WAITING.length} join requests`,
  );
  console.log(`  President: ${president.name} · Treasurer: ${treasurer.name}`);
  for (const line of summary) console.log(line);
  console.log(`\n  Remove it all with: tsx scripts/seed-whitecliff.ts ${SLUG} --clean`);
}

(CLEAN ? clean() : seedSociety()).catch((error) => {
  console.error('\n✗', error?.message ?? error);
  process.exit(1);
});
