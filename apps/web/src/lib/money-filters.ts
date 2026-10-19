import { SOCIETY_BALANCE_LEDGER, isSocietyBalanceRow, isTransfer } from '@compences/core';

/**
 * The Money tab's filters, read from the URL and applied in memory.
 *
 * Four narrow the list: the event's type, the vendor paid, and two toggles for
 * the side of the money — Receipts (in) and Payments (out). The event itself
 * was already a filter on this page and stays. All of it lives in the query
 * string so a filtered ledger is a link.
 */
export type MoneyFilters = {
  eventType: string;
  vendor: string;
  event: string;
  receipts: boolean;
  payments: boolean;
};

const one = (value: unknown) => (typeof value === 'string' ? value : '');

/** `side=in` shows receipts only, `side=out` payments only; anything else, both. */
export function moneyFiltersFrom(params: Record<string, unknown>): MoneyFilters {
  const side = one(params.side);
  return {
    eventType: one(params.type),
    vendor: one(params.vendor),
    event: one(params.event),
    receipts: side !== 'out',
    payments: side !== 'in',
  };
}

export type MoneyFilterRow = {
  direction: string | null;
  event_id?: string | null;
  event_slug: string | null;
  kind?: string | null;
  counterpart: string | null;
};

/**
 * The rows that pass. A vendor only ever received money out, so choosing one
 * drops every receipt. An event's own ledger keeps the money the committee
 * moved in or out of it, so its rows add up to what it holds; society-wide the
 * two sides of a movement cancel and are left out.
 */
export function filterMoney<T extends MoneyFilterRow>(
  rows: T[],
  filters: MoneyFilters,
  typeOfEvent: (eventId: string) => string | null,
): T[] {
  return rows.filter((row) => {
    if (row.direction === 'in' && !filters.receipts) return false;
    if (row.direction === 'out' && !filters.payments) return false;
    if (filters.vendor) {
      if (row.direction !== 'out' || isTransfer(row) || row.counterpart !== filters.vendor) {
        return false;
      }
    }
    if (filters.eventType) {
      if (!row.event_id || typeOfEvent(row.event_id) !== filters.eventType) return false;
    }
    if (filters.event === SOCIETY_BALANCE_LEDGER) return isSocietyBalanceRow(row);
    if (filters.event) return row.event_slug === filters.event;
    return !isTransfer(row);
  });
}

/** The vendors paid, by the name the ledger shows, A to Z. */
export function vendorsPaid(rows: MoneyFilterRow[]): string[] {
  const names = new Set<string>();
  for (const row of rows) {
    if (row.direction === 'out' && !isTransfer(row) && row.counterpart) names.add(row.counterpart);
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

/** The link for the same filters with some changed; empty values drop out. */
export function moneyHref(
  slug: string,
  filters: MoneyFilters,
  change: Partial<MoneyFilters> = {},
): string {
  const next = { ...filters, ...change };
  const query = new URLSearchParams();
  if (next.eventType) query.set('type', next.eventType);
  if (next.vendor) query.set('vendor', next.vendor);
  if (next.event) query.set('event', next.event);
  if (next.receipts !== next.payments) query.set('side', next.receipts ? 'in' : 'out');
  const text = query.toString();
  return `/app/${slug}/money${text ? `?${text}` : ''}`;
}
