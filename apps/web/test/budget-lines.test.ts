import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { tidyLabel } from '../src/lib/catalogue';

/**
 * A budget is vendors and the services each provides, with a budget for each
 * service, typed freely with the society's own words offered back; a bill names
 * the vendor and the service it is paid out of. The grouping itself is tested
 * in @compences/core (test/budget.test.ts).
 */
const SRC = join(import.meta.dirname, '..', 'src');
const read = (...parts: string[]) => readFileSync(join(SRC, ...parts), 'utf8');
const EVENTS = ['app', 'app', '[community]', 'admin', 'events'];

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

  it('pick the vendor, then their service, then the amount billed, then the bill, then remarks', () => {
    const forms = read(...EVENTS, '[event]', 'forms.tsx');
    const at = (text: string) => forms.indexOf(text);
    expect(at('label="Vendor"')).toBeGreaterThan(-1);
    expect(at('name="budget_line_id"')).toBeGreaterThan(at('label="Vendor"'));
    expect(at('Amount billed')).toBeGreaterThan(at('name="budget_line_id"'));
    expect(at('bucket="bills"')).toBeGreaterThan(at('Amount billed'));
    expect(at('label="Remarks"')).toBeGreaterThan(at('bucket="bills"'));
  });

  it('choose the service for you when the vendor has only one', () => {
    const forms = read(...EVENTS, '[event]', 'forms.tsx');
    expect(forms).toContain('next?.lines.length === 1 ? next.lines[0]!.id');
  });

  it('build the budget as vendors, each with their services and a budget for each', () => {
    const page = read(...EVENTS, '[event]', 'page.tsx');
    const editor = read(...EVENTS, '[event]', 'budget-editor.tsx');
    expect(page).toContain('<BudgetEditor');
    expect(page).toContain('<AddVendorForm');
    expect(editor).toContain('vendorGroups(lines)');
    expect(editor).toContain('<AddServiceForm');
    const wizard = read(...EVENTS, 'new', 'create-event-form.tsx');
    expect(wizard).toContain('Add a vendor');
    expect(wizard).toContain('Add a service');
  });

  it('no longer ask for a suggested amount per flat', () => {
    for (const source of [
      read(...EVENTS, 'new', 'create-event-form.tsx'),
      read(...EVENTS, '[event]', 'forms.tsx'),
      read(...EVENTS, 'actions.ts'),
      read('app', 'app', '[community]', 'events', '[event]', 'contribute', 'contribute-form.tsx'),
    ]) {
      expect(source).not.toContain('suggested_amount');
      expect(source).not.toMatch(/per flat/i);
    }
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
