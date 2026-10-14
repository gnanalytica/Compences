import { z } from 'zod';

// ---------------------------------------------------------------------------
// Founding a society
// ---------------------------------------------------------------------------

/** The statuses public.create_society() can return. */
export type FoundSocietyStatus =
  | 'ok'
  | 'unauthenticated'
  | 'invalid_name'
  | 'invalid_phone'
  | 'invalid_flat'
  | 'too_many'
  | 'no_slug_free';

/** How many societies one account may open before the platform team steps in. */
export const SOCIETY_LIMIT = 3;

const FOUND_MESSAGES: Record<FoundSocietyStatus, string> = {
  ok: 'Your society is ready.',
  unauthenticated: 'Please sign in first.',
  invalid_name: 'Give your society a name of at least two characters.',
  invalid_phone: 'Enter a 10-digit mobile number, or the full international form.',
  invalid_flat: 'Write your flat the way it is on the door, like A 703 or 1402.',
  too_many: `You have already opened ${SOCIETY_LIMIT} societies. Write to us and we'll set the next one up with you.`,
  no_slug_free: 'Too many societies have that name. Add your area or city to it.',
};

export function foundSocietyMessage(status: string): string {
  return (
    FOUND_MESSAGES[status as FoundSocietyStatus] ??
    'We could not create that society. Please try again.'
  );
}

/**
 * Reads a typed flat label the way the flats table stores it.
 *
 * The founder types one thing; units keep a block and a number. Splitting it
 * here rather than asking for two fields keeps "start your society" to the
 * questions somebody will answer on a phone.
 *
 * The shape has to match generateFlats() below — an upper-case block and a
 * bare number — or a founder's hand-typed "A 703" and the generator's later
 * A/703 would be two different flats, and the resident who picked the wrong
 * one would be invisible to the other. app.split_flat() does the same in SQL,
 * and a test holds the two together.
 *
 * A space settles the ambiguous case: "B G01" is flat G01 of tower B, where
 * that G is the ground floor; "G01" on its own reads as tower G, flat 01.
 */
export function splitFlat(label: string): { block: string | null; number: string } {
  const trimmed = label.replace(/\s+/g, ' ').trim();
  const parts =
    /^([A-Za-z]+)[\s._/-]+(.+)$/.exec(trimmed) ?? /^([A-Za-z]{1,3})([0-9].*)$/.exec(trimmed);
  const block = parts?.[1];
  const number = parts?.[2];
  return block && number
    ? { block: block.toUpperCase(), number: number.trim() }
    : { block: null, number: trimmed };
}

/** A flat has to have a number in it; "nowhere" is not one. */
export function isFlatLabel(label: string): boolean {
  const trimmed = label.trim();
  return trimmed.length > 0 && trimmed.length <= 24 && /[0-9]/.test(splitFlat(trimmed).number);
}

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

export const CATALOGUE_KINDS = [
  'event_type',
  'budget_category',
  'venue',
  'activity_type',
  'vendor',
] as const;
export type CatalogueKind = (typeof CATALOGUE_KINDS)[number];

export const CATALOGUE_KIND_LABEL: Record<
  CatalogueKind,
  { title: string; singular: string; hint: string }
> = {
  event_type: {
    title: 'Event types',
    singular: 'Event type',
    hint: 'What kind of event it is: festival, sports, cultural evening.',
  },
  budget_category: {
    title: 'Budget and bill categories',
    singular: 'Category',
    hint: 'Used for budget lines and bills.',
  },
  venue: {
    title: 'Venues',
    singular: 'Venue',
    hint: 'Places in the society where events happen.',
  },
  activity_type: {
    title: 'Activity types',
    singular: 'Activity type',
    hint: 'Suggested activities residents register for.',
  },
  vendor: {
    title: 'Vendors',
    singular: 'Vendor',
    hint: 'Suppliers the society pays, with contact details for staff.',
  },
};

export const catalogueItemSchema = z.object({
  kind: z.enum(CATALOGUE_KINDS),
  label: z.string().trim().min(1, 'Give it a name').max(80, 'Keep it under 80 characters'),
  emoji: z
    .string()
    .trim()
    .max(8)
    .optional()
    .transform((value) => value || null),
  // Vendors: contact details. Venues: capacity. Everything else: nothing.
  phone: z.string().trim().max(20).optional(),
  upi_vpa: z.string().trim().max(120).optional(),
  capacity: z.coerce.number().int().positive().max(100000).optional(),
});

// ---------------------------------------------------------------------------
// Flats
// ---------------------------------------------------------------------------

export type FlatRow = {
  block: string | null;
  number: string;
  floor: number | null;
  bedrooms: number | null;
  area_sqft: number | null;
};

export const flatGeneratorSchema = z.object({
  towers: z
    .string()
    .trim()
    .min(1, 'List at least one tower, e.g. A, B')
    .transform((value) =>
      value
        .split(/[,\s]+/)
        .map((tower) => tower.trim().toUpperCase())
        .filter(Boolean),
    )
    .pipe(z.array(z.string().max(10)).min(1).max(40)),
  floors: z.coerce.number().int().min(1, 'At least one floor').max(80),
  flats_per_floor: z.coerce.number().int().min(1, 'At least one flat per floor').max(40),
  // Numbering: 1104 = floor 11, flat 04. Ground floor starts at G01 when set.
  include_ground_floor: z.coerce.boolean().optional().default(false),
});

/** Tower × floor × flat, numbered like 101, 1104, G02. */
export function generateFlats(input: z.infer<typeof flatGeneratorSchema>): FlatRow[] {
  const rows: FlatRow[] = [];
  const firstFloor = input.include_ground_floor ? 0 : 1;
  for (const block of input.towers) {
    for (let floor = firstFloor; floor < firstFloor + input.floors; floor += 1) {
      for (let flat = 1; flat <= input.flats_per_floor; flat += 1) {
        const suffix = String(flat).padStart(2, '0');
        rows.push({
          block,
          number: floor === 0 ? `G${suffix}` : `${floor}${suffix}`,
          floor,
          bedrooms: null,
          area_sqft: null,
        });
      }
    }
  }
  return rows;
}

/**
 * Reads a flats CSV exported from a spreadsheet. Columns (header row required,
 * any order, case-insensitive): tower or block, flat or number, and optionally
 * floor, bedrooms (or bhk) and area (or sqft).
 */
export function parseFlatsCsv(text: string): { rows: FlatRow[]; errors: string[] } {
  const lines = text
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return { rows: [], errors: ['The file is empty.'] };

  const split = (line: string) => line.split(',').map((cell) => cell.trim().replace(/^"|"$/g, ''));
  const header = split(lines[0]!).map((cell) => cell.toLowerCase());
  const col = (...names: string[]) => header.findIndex((cell) => names.includes(cell));
  const blockCol = col('tower', 'block', 'wing');
  const numberCol = col('flat', 'number', 'flat number', 'unit', 'door');
  const floorCol = col('floor');
  const bedroomsCol = col('bedrooms', 'bhk');
  const areaCol = col('area', 'sqft', 'area_sqft', 'area (sqft)');

  if (numberCol === -1) {
    return {
      rows: [],
      errors: ['Add a header row with a "flat" column (and "tower" if you have towers).'],
    };
  }

  const rows: FlatRow[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  lines.slice(1).forEach((line, index) => {
    const cells = split(line);
    const number = cells[numberCol]?.trim() ?? '';
    const block = blockCol > -1 ? cells[blockCol]?.trim().toUpperCase() || null : null;
    const lineNo = index + 2;
    if (!number) {
      errors.push(`Line ${lineNo}: missing flat number.`);
      return;
    }
    const key = `${block ?? ''}|${number.toUpperCase()}`;
    if (seen.has(key)) {
      errors.push(`Line ${lineNo}: ${block ? `${block}-` : ''}${number} appears twice.`);
      return;
    }
    seen.add(key);
    const toInt = (i: number) => {
      if (i === -1) return null;
      const value = Number.parseInt((cells[i] ?? '').replace(/[^0-9]/g, ''), 10);
      return Number.isFinite(value) ? value : null;
    };
    rows.push({
      block,
      number,
      floor: toInt(floorCol),
      bedrooms: toInt(bedroomsCol),
      area_sqft: toInt(areaCol),
    });
  });

  return { rows, errors };
}

// ---------------------------------------------------------------------------
// Joining
// ---------------------------------------------------------------------------

/** A link that opens the join form with the society code filled in. */
export function joinLink(siteUrl: string, code: string): string {
  return `${siteUrl.replace(/\/$/, '')}/join/${encodeURIComponent(code)}`;
}

/** Ready-to-send WhatsApp text for inviting residents. */
export function residentInviteMessage({
  societyName,
  code,
  link,
}: {
  societyName: string;
  code: string;
  link: string;
}): string {
  return [
    `Namaste! ${societyName} now plans its events on Compences and shows where every rupee goes.`,
    '',
    `1. Open ${link}`,
    '2. Sign in with Google',
    `3. Society code: ${code} (the link fills it in)`,
    '4. Pick your flat and send your details',
    '',
    'Staff will approve you, and then you can see events, contribute and vote.',
  ].join('\n');
}

export const whatsappShareUrl = (message: string) =>
  `https://wa.me/?text=${encodeURIComponent(message)}`;

// ---------------------------------------------------------------------------
// Committee setup checklist
// ---------------------------------------------------------------------------

export type SetupFacts = {
  hasAddress: boolean;
  flats: number;
  catalogueReviewed: boolean;
  upiSet: boolean;
  staff: number;
  residents: number;
  events: number;
};

export type SetupStepId =
  'details' | 'flats' | 'catalogue' | 'upi' | 'staff' | 'residents' | 'event';

export type SetupStep = { id: SetupStepId; title: string; description: string; done: boolean };

export function setupSteps(facts: SetupFacts): SetupStep[] {
  return [
    {
      id: 'details',
      title: 'Confirm society details',
      description: 'Name, address and city as residents should see them.',
      done: facts.hasAddress,
    },
    {
      id: 'flats',
      title: 'Add your flats',
      description: 'Generate towers and floors, or import a spreadsheet.',
      done: facts.flats > 0,
    },
    {
      id: 'catalogue',
      title: 'Review the catalogue',
      description: 'Categories, venues, activity types and vendors your events will use.',
      done: facts.catalogueReviewed,
    },
    {
      id: 'upi',
      title: 'Set the society’s UPI ID',
      description: 'Where contributions go. Use the association’s account.',
      done: facts.upiSet,
    },
    {
      id: 'staff',
      title: 'Bring in staff',
      description: 'Share the society code with your supervisor, then admit them as staff.',
      done: facts.staff > 0,
    },
    {
      id: 'residents',
      title: 'Invite residents',
      description: 'Send the join link to your society’s WhatsApp group.',
      done: facts.residents > 0,
    },
    {
      id: 'event',
      title: 'Create your first event',
      description: 'Add a budget and activities.',
      done: facts.events > 0,
    },
  ];
}

export const setupProgress = (steps: SetupStep[]) => ({
  done: steps.filter((step) => step.done).length,
  total: steps.length,
});
