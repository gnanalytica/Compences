import { budgetBar, budgetTotal, type BudgetBar } from './events';

/**
 * A budget is vendors and the services each provides, with what is set aside
 * for each service. In the database that is one budget line per service:
 * Type (the service) + Vendor + Amount. These helpers turn those lines back
 * into what a committee thinks in, and what a resident reads.
 */

/** A budget line as the screens hold it: `approved` is what its approved bills add up to. */
export type BudgetItem = {
  id: string;
  category: string;
  vendor: string | null;
  planned: number;
  approved: number;
  /** Bills waiting on the committee. Always 0 for a resident, who cannot see them. */
  pending?: number;
};

/** A bill as the budget view needs it. Only approved bills are spent. */
export type BudgetBill = {
  id: string;
  budget_line_id: string | null;
  category: string | null;
  vendor: string | null;
  amount: number | string;
  status: string;
};

export type BudgetView = 'vendor' | 'service';

/** What a line without a vendor is filed under until the committee chooses one. */
export const NO_VENDOR = 'Vendor not chosen yet';

/** Spending with no budget line behind it. */
export const NOT_IN_BUDGET = 'Not in the budget';

const key = (value: string | null | undefined) => (value ?? '').trim().toLowerCase();

/**
 * Lines grouped by vendor, in the order each vendor first appears, so the
 * editor and the bill form list a vendor once with all its services under it.
 * Lines with no vendor come last, together.
 */
export function vendorGroups<L extends { vendor: string | null }>(
  lines: L[],
): { key: string; vendor: string | null; lines: L[] }[] {
  const groups = new Map<string, { key: string; vendor: string | null; lines: L[] }>();
  for (const line of lines) {
    const id = key(line.vendor);
    const group = groups.get(id) ?? { key: id, vendor: line.vendor?.trim() || null, lines: [] };
    group.lines.push(line);
    groups.set(id, group);
  }
  const named = [...groups.values()].filter((group) => group.key);
  const unnamed = groups.get('');
  return unnamed ? [...named, unnamed] : named;
}

/** One budget line inside a group: named by whichever of service or vendor the group is not. */
export type BudgetGroupItem<B> = {
  line: BudgetItem;
  label: string;
  bar: BudgetBar;
  bills: B[];
};

export type BudgetGroup<B> = {
  key: string;
  label: string;
  kind: BudgetView | 'unplanned';
  planned: number;
  spent: number;
  pending: number;
  bar: BudgetBar;
  items: BudgetGroupItem<B>[];
  /** For the group of spending outside the budget, the bills themselves. */
  bills: B[];
};

/**
 * The budget for the budget view: one group per vendor or per service, biggest
 * plan first, each holding its lines and the approved bills paid out of them.
 * Bills with no line behind it (filed before bills drew on a line, or whose
 * line was removed) are one last group, outside the budget.
 *
 * The whole-budget bar counts every approved rupee, the loose ones included,
 * so it agrees with the event's accounts.
 */
export function groupBudget<B extends BudgetBill>(
  lines: BudgetItem[],
  bills: B[],
  by: BudgetView,
): { groups: BudgetGroup<B>[]; total: BudgetBar; outside: number } {
  const approved = bills.filter((bill) => bill.status === 'approved');
  const lineIds = new Set(lines.map((line) => line.id));
  const groups = new Map<string, BudgetGroup<B>>();

  for (const line of lines) {
    const name = by === 'vendor' ? line.vendor?.trim() || null : line.category.trim();
    const id = `${by}:${key(name)}`;
    const group =
      groups.get(id) ??
      ({
        key: id,
        label: name ?? NO_VENDOR,
        kind: by,
        planned: 0,
        spent: 0,
        pending: 0,
        bar: budgetBar(0, 0),
        items: [],
        bills: [],
      } satisfies BudgetGroup<B>);
    group.planned += line.planned;
    group.spent += line.approved;
    group.pending += line.pending ?? 0;
    group.items.push({
      line,
      label: by === 'vendor' ? line.category.trim() : line.vendor?.trim() || NO_VENDOR,
      bar: budgetBar(line.planned, line.approved),
      bills: approved.filter((bill) => bill.budget_line_id === line.id),
    });
    groups.set(id, group);
  }

  const loose = approved.filter(
    (bill) => !bill.budget_line_id || !lineIds.has(bill.budget_line_id),
  );
  const ordered = [...groups.values()]
    .map((group) => ({ ...group, bar: budgetBar(group.planned, group.spent) }))
    .sort((a, b) => b.planned - a.planned);
  const outside = loose.reduce((sum, bill) => sum + Number(bill.amount), 0);
  if (loose.length) {
    ordered.push({
      key: 'unplanned',
      label: NOT_IN_BUDGET,
      kind: 'unplanned',
      planned: 0,
      spent: outside,
      pending: 0,
      bar: budgetBar(0, outside),
      items: [],
      bills: loose,
    });
  }

  return { groups: ordered, total: budgetTotal(ordered), outside };
}

/**
 * Where each group sits on the ring: its share of the whole plan as a start
 * and a length, both from 0 to 1, and how much of its own share is spent.
 * Spending outside the budget has no share of the plan, so it has no arc.
 */
export function budgetArcs(groups: { key: string; planned: number; spent: number }[]) {
  const total = groups.reduce((sum, group) => sum + Math.max(0, group.planned), 0);
  let start = 0;
  return groups
    .filter((group) => group.planned > 0 && total > 0)
    .map((group) => {
      const length = group.planned / total;
      const arc = {
        key: group.key,
        start,
        length,
        filled: Math.min(1, Math.max(0, group.spent / group.planned)),
      };
      start += length;
      return arc;
    });
}

/**
 * Colours for the budget's groups, one per group in order and repeating after
 * six. Each pairs with the warm ivory of the app rather than shouting over it,
 * and each holds its own against the surface in both themes. The web writes
 * them into globals.css as --series-1 to --series-6.
 */
export const BUDGET_SERIES: Readonly<Record<'light' | 'dark', readonly string[]>> = {
  light: [
    'oklch(0.52 0.1 165)',
    'oklch(0.6 0.12 70)',
    'oklch(0.52 0.12 250)',
    'oklch(0.55 0.14 15)',
    'oklch(0.5 0.12 300)',
    'oklch(0.56 0.09 205)',
  ],
  dark: [
    'oklch(0.76 0.1 165)',
    'oklch(0.8 0.12 75)',
    'oklch(0.74 0.1 250)',
    'oklch(0.74 0.12 15)',
    'oklch(0.74 0.1 300)',
    'oklch(0.78 0.08 205)',
  ],
};

/** The series colour for the group at `index`, as a CSS variable the web defines. */
export function seriesVar(index: number): string {
  return `var(--series-${(index % BUDGET_SERIES.light.length) + 1})`;
}
