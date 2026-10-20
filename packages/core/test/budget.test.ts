import { describe, expect, it } from 'vitest';
import {
  BUDGET_SERIES,
  NOT_IN_BUDGET,
  NO_VENDOR,
  budgetArcs,
  groupBudget,
  oklchToHex,
  seriesVar,
  vendorGroups,
  type BudgetBill,
  type BudgetItem,
} from '../src';

const lines: BudgetItem[] = [
  { id: 'tent', category: 'Pandal', vendor: 'Sri Tents', planned: 60_000, approved: 30_000 },
  { id: 'lights', category: 'Lighting', vendor: 'Sri Tents', planned: 20_000, approved: 0 },
  { id: 'food', category: 'Food', vendor: 'Annapurna', planned: 90_000, approved: 95_000 },
  { id: 'snacks', category: 'Food', vendor: null, planned: 10_000, approved: 0 },
];

const bill = (
  id: string,
  line: string | null,
  amount: number,
  status = 'approved',
): BudgetBill => ({
  id,
  budget_line_id: line,
  category: null,
  vendor: null,
  amount,
  status,
});

describe('vendorGroups', () => {
  it('lists each vendor once with all its services, in the order they were added', () => {
    const groups = vendorGroups(lines);
    expect(groups.map((group) => group.vendor)).toEqual(['Sri Tents', 'Annapurna', null]);
    expect(groups[0]!.lines.map((line) => line.category)).toEqual(['Pandal', 'Lighting']);
  });

  it('treats "sri tents " and "Sri Tents" as the same vendor', () => {
    const groups = vendorGroups([
      { vendor: 'Sri Tents' },
      { vendor: ' sri tents ' },
      { vendor: '' },
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0]!.lines).toHaveLength(2);
    expect(groups[1]!.vendor).toBeNull();
  });
});

describe('groupBudget', () => {
  const bills = [
    bill('b1', 'tent', 30_000),
    bill('b2', 'food', 95_000),
    bill('b3', 'tent', 5_000, 'pending'),
    bill('b4', null, 4_000),
    bill('b5', 'removed-line', 1_000),
  ];

  it('groups by vendor, biggest plan first, with each service under it', () => {
    const { groups } = groupBudget(lines, bills, 'vendor');
    expect(groups.map((group) => group.label)).toEqual([
      'Annapurna',
      'Sri Tents',
      NO_VENDOR,
      NOT_IN_BUDGET,
    ]);
    const tents = groups.find((group) => group.label === 'Sri Tents')!;
    expect(tents).toMatchObject({ planned: 80_000, spent: 30_000 });
    expect(tents.items.map((item) => item.label)).toEqual(['Pandal', 'Lighting']);
    expect(tents.items[0]!.bills.map((b) => b.id)).toEqual(['b1']);
  });

  it('groups by service, with each vendor under it', () => {
    const { groups } = groupBudget(lines, bills, 'service');
    const food = groups.find((group) => group.label === 'Food')!;
    expect(food).toMatchObject({ planned: 100_000, spent: 95_000 });
    expect(food.items.map((item) => item.label)).toEqual(['Annapurna', NO_VENDOR]);
  });

  it('shows a line that went over on its own bar', () => {
    const { groups } = groupBudget(lines, bills, 'service');
    const food = groups.find((group) => group.label === 'Food')!;
    expect(food.items[0]!.bar).toMatchObject({ over: 5_000, percent: 100 });
  });

  it('only counts approved bills, and keeps bills with no line in their own group', () => {
    const { groups, total, outside } = groupBudget(lines, bills, 'vendor');
    const loose = groups.at(-1)!;
    expect(loose).toMatchObject({ kind: 'unplanned', spent: 5_000, planned: 0 });
    expect(loose.bills.map((b) => b.id)).toEqual(['b4', 'b5']);
    expect(outside).toBe(5_000);
    expect(total).toMatchObject({ planned: 180_000, spent: 130_000 });
  });

  it('has nothing outside the budget when every bill has its line', () => {
    const { groups, outside } = groupBudget(lines, [bill('b1', 'tent', 30_000)], 'vendor');
    expect(groups.some((group) => group.kind === 'unplanned')).toBe(false);
    expect(outside).toBe(0);
  });
});

describe('budgetArcs', () => {
  it('lays each group around the ring by its share of the plan', () => {
    const arcs = budgetArcs([
      { key: 'a', planned: 75, spent: 75 },
      { key: 'b', planned: 25, spent: 50 },
      { key: 'loose', planned: 0, spent: 10 },
    ]);
    expect(arcs).toEqual([
      { key: 'a', start: 0, length: 0.75, filled: 1 },
      { key: 'b', start: 0.75, length: 0.25, filled: 1 },
    ]);
  });

  it('draws nothing for an empty budget', () => {
    expect(budgetArcs([{ key: 'loose', planned: 0, spent: 10 }])).toEqual([]);
  });
});

describe('the series colours', () => {
  it('come in light and dark, the same number of each', () => {
    expect(BUDGET_SERIES.light).toHaveLength(BUDGET_SERIES.dark.length);
    for (const colour of [...BUDGET_SERIES.light, ...BUDGET_SERIES.dark]) {
      expect(oklchToHex(colour)).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('repeat after the last one', () => {
    expect(seriesVar(0)).toBe('var(--series-1)');
    expect(seriesVar(BUDGET_SERIES.light.length)).toBe('var(--series-1)');
  });
});
