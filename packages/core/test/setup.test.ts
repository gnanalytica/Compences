import { describe, expect, it } from 'vitest';
import {
  catalogueItemSchema,
  flatGeneratorSchema,
  generateFlats,
  isFlatLabel,
  joinLink,
  parseFlatsCsv,
  residentInviteMessage,
  setupProgress,
  setupSteps,
  splitFlat,
} from '../src/setup';

describe('flat generator', () => {
  it('numbers towers, floors and flats the Indian way', () => {
    const rows = generateFlats(
      flatGeneratorSchema.parse({ towers: 'a, b', floors: 11, flats_per_floor: 10 }),
    );
    expect(rows).toHaveLength(220);
    expect(rows[0]).toMatchObject({ block: 'A', number: '101', floor: 1 });
    expect(rows.at(-1)).toMatchObject({ block: 'B', number: '1110', floor: 11 });
  });

  it('adds a ground floor when asked', () => {
    const rows = generateFlats(
      flatGeneratorSchema.parse({
        towers: 'A',
        floors: 2,
        flats_per_floor: 2,
        include_ground_floor: true,
      }),
    );
    expect(rows.map((row) => row.number)).toEqual(['G01', 'G02', '101', '102']);
  });
});

describe('flats CSV', () => {
  it('reads a spreadsheet export with headers in any order', () => {
    const { rows, errors } = parseFlatsCsv('Flat,Tower,BHK,Sqft\n1104,a,3,1680\n1105,A,2,1185\n');
    expect(errors).toEqual([]);
    expect(rows[0]).toEqual({
      block: 'A',
      number: '1104',
      floor: null,
      bedrooms: 3,
      area_sqft: 1680,
    });
  });

  it('reports missing numbers and duplicates by line', () => {
    const { rows, errors } = parseFlatsCsv('tower,flat\nA,101\nA,\nA,101\n');
    expect(rows).toHaveLength(1);
    expect(errors).toEqual(['Line 3: missing flat number.', 'Line 4: A-101 appears twice.']);
  });

  it('needs a flat column', () => {
    expect(parseFlatsCsv('tower\nA').errors[0]).toContain('"flat" column');
  });
});

describe('joining', () => {
  it('builds a join link and an invite message', () => {
    const link = joinLink('https://compences.com/', 'WHITE CLIFF');
    expect(link).toBe('https://compences.com/join/WHITE%20CLIFF');
    const message = residentInviteMessage({ societyName: 'Whitecliff', code: 'WC2026', link });
    expect(message).toContain('WC2026');
    expect(message).toContain(link);
  });
});

describe('setup checklist', () => {
  it('tracks what the committee still has to do', () => {
    const steps = setupSteps({
      hasAddress: true,
      flats: 220,
      catalogueReviewed: false,
      upiSet: true,
      staff: 0,
      residents: 0,
      events: 0,
    });
    expect(setupProgress(steps)).toEqual({ done: 3, total: 7 });
    expect(steps.find((step) => !step.done)?.id).toBe('catalogue');
  });
});

describe('catalogue items', () => {
  it('validates labels and keeps optional details', () => {
    expect(catalogueItemSchema.safeParse({ kind: 'vendor', label: '' }).success).toBe(false);
    expect(
      catalogueItemSchema.parse({ kind: 'vendor', label: ' Shubh Tents ', emoji: '' }),
    ).toMatchObject({
      label: 'Shubh Tents',
      emoji: null,
    });
  });
});

/**
 * The founder types one flat; units store a block and a number.
 *
 * The founder was the one member of a society never asked where they live —
 * create_society() made them a member and app.seed_community_owner() seated
 * them nowhere — so their own payments appeared on the Money page with no flat
 * beside them. Asking is the fix; reading the answer the same way the flat
 * generator writes it is what stops the answer becoming a second, duplicate
 * flat the moment somebody bulk-generates the rest.
 */
describe('reading a typed flat', () => {
  it('reads the shapes people actually type', () => {
    expect(splitFlat('A 703')).toEqual({ block: 'A', number: '703' });
    expect(splitFlat('a-703')).toEqual({ block: 'A', number: '703' });
    expect(splitFlat('A703')).toEqual({ block: 'A', number: '703' });
    expect(splitFlat('  A   703 ')).toEqual({ block: 'A', number: '703' });
  });

  it('leaves a society without towers its bare numbers', () => {
    expect(splitFlat('703')).toEqual({ block: null, number: '703' });
    expect(splitFlat('1402')).toEqual({ block: null, number: '1402' });
  });

  it('lets a space settle the ground floor', () => {
    // In "B G01" that G is the floor, not the tower. Without the space there
    // is nothing to tell the two apart, and the comment on app.split_flat
    // says so out loud rather than pretending otherwise.
    expect(splitFlat('B G01')).toEqual({ block: 'B', number: 'G01' });
    expect(splitFlat('G01')).toEqual({ block: 'G', number: '01' });
  });

  it('agrees with what the generator writes, or the two become different flats', () => {
    const rows = generateFlats(
      flatGeneratorSchema.parse({
        towers: 'A, B',
        floors: 2,
        flats_per_floor: 2,
        include_ground_floor: true,
      }),
    );
    for (const row of rows) {
      const typed = `${row.block} ${row.number}`;
      expect(splitFlat(typed), typed).toEqual({ block: row.block, number: row.number });
    }
  });

  it('knows a flat from a sentence', () => {
    expect(isFlatLabel('A 703')).toBe(true);
    expect(isFlatLabel('1402')).toBe(true);
    expect(isFlatLabel('nowhere')).toBe(false);
    expect(isFlatLabel('')).toBe(false);
    expect(isFlatLabel('a'.repeat(30))).toBe(false);
  });
});
