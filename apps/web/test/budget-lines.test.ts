import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { budgetVsSpent } from '../src/lib/events';
import { tidyLabel } from '../src/lib/catalogue';

/**
 * A budget is rows of Type | Vendor | Amount, typed freely with the society's
 * own words offered back; a bill is paid out of one of those rows.
 */
const SRC = join(import.meta.dirname, '..', 'src');
const read = (...parts: string[]) => readFileSync(join(SRC, ...parts), 'utf8');
const EVENTS = ['app', 'app', '[community]', 'admin', 'events'];

describe('the budget against what was spent', () => {
  const lines = [
    { id: 'a', category: 'Food', vendor: 'Tesla', amount: 600000 },
    { id: 'b', category: 'Food', vendor: 'Mavericks', amount: 200000 },
  ];

  it('gives each line its own row, even when the type repeats', () => {
    const rows = budgetVsSpent(lines, []);
    expect(rows.map((row) => row.label)).toEqual(['Food · Tesla', 'Food · Mavericks']);
    expect(rows.map((row) => row.planned)).toEqual([600000, 200000]);
  });

  it('counts only approved bills, against the line they were paid from', () => {
    const rows = budgetVsSpent(lines, [
      { budget_line_id: 'a', category: 'Food', amount: 100000, status: 'approved' },
      { budget_line_id: 'a', category: 'Food', amount: 50000, status: 'pending' },
      { budget_line_id: 'b', category: 'Food', amount: 25000, status: 'approved' },
    ]);
    expect(rows.map((row) => row.spent)).toEqual([100000, 25000]);
  });

  it('still shows a bill with no line, grouped by its category', () => {
    const rows = budgetVsSpent(lines, [
      { budget_line_id: null, category: 'Sound', amount: 4000, status: 'approved' },
      { category: 'sound', amount: 1000, status: 'approved' },
    ]);
    const loose = rows.find((row) => row.planned === 0);
    expect(loose).toMatchObject({ label: 'Sound', spent: 5000 });
  });
});

describe('typed words', () => {
  it('are tidied the way the catalogue compares them', () => {
    expect(tidyLabel('  Food   court ')).toBe('Food court');
    expect(tidyLabel(null)).toBe('');
  });
});

describe('the forms', () => {
  it('start the budget empty and suggest from the catalogue, not a fixed list', () => {
    const form = read(...EVENTS, 'new', 'create-event-form.tsx');
    expect(form).toContain('<SuggestionList id="budget-types"');
    expect(form).toContain('name="budget_vendor"');
    expect(form).not.toContain('pickers.budget_category\n      .slice');
  });

  it('pick a budget line first on a bill, then amount, then the bill, then remarks', () => {
    const forms = read(...EVENTS, '[event]', 'forms.tsx');
    const at = (text: string) => forms.indexOf(text);
    expect(at('name="budget_line_id"')).toBeGreaterThan(-1);
    expect(at('Record amount')).toBeGreaterThan(at('name="budget_line_id"'));
    expect(at('bucket="bills"')).toBeGreaterThan(at('Record amount'));
    expect(at('label="Remarks"')).toBeGreaterThan(at('bucket="bills"'));
  });

  it('warn about going over a line without blocking the bill', () => {
    const forms = read(...EVENTS, '[event]', 'forms.tsx');
    expect(forms).toContain('over what’s left on this line');
    expect(forms).toContain('Over budget by');
  });

  it('check on the server that the line belongs to the event', () => {
    const actions = read(...EVENTS, 'actions.ts');
    expect(actions).toMatch(/\.eq\('id', lineId\.data\)\s+\.eq\('event_id', eventId\)/);
  });
});
