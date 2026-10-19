import { describe, expect, it } from 'vitest';
import { filterMoney, moneyFiltersFrom, moneyHref, vendorsPaid } from '../src/lib/money-filters';

const row = (
  id: string,
  direction: 'in' | 'out',
  counterpart: string,
  event_id: string | null,
  kind = direction === 'in' ? 'payment' : 'bill',
) => ({ id, direction, counterpart, event_id, event_slug: event_id, kind });

const rows = [
  row('1', 'in', 'Asha', 'diwali'),
  row('2', 'out', 'Sharma Tents', 'diwali'),
  row('3', 'out', 'Sharma Tents', 'holi'),
  row('4', 'out', 'Sound Co', 'holi'),
  row('5', 'in', 'Ravi', 'holi'),
  row('6', 'in', 'Carried', 'holi', 'transfer'),
];
const types: Record<string, string> = { diwali: 'festival', holi: 'festival' };
const typeOf = (id: string) => types[id] ?? null;
const ids = (list: { id: string }[]) => list.map((r) => r.id);

describe('the Money tab filters', () => {
  it('read side, type, vendor and event from the URL, both sides by default', () => {
    expect(moneyFiltersFrom({})).toMatchObject({ receipts: true, payments: true });
    expect(moneyFiltersFrom({ side: 'in' })).toMatchObject({ receipts: true, payments: false });
    expect(moneyFiltersFrom({ side: 'out', vendor: 'X', type: 'T' })).toMatchObject({
      receipts: false,
      payments: true,
      vendor: 'X',
      eventType: 'T',
    });
  });

  it('leaves out money the committee moved, society-wide', () => {
    expect(ids(filterMoney(rows, moneyFiltersFrom({}), typeOf))).toEqual(['1', '2', '3', '4', '5']);
  });

  it('a vendor shows only that vendor’s payments, never a receipt', () => {
    const got = filterMoney(rows, moneyFiltersFrom({ vendor: 'Sharma Tents' }), typeOf);
    expect(ids(got)).toEqual(['2', '3']);
  });

  it('receipts and payments restrict the list to one side', () => {
    expect(ids(filterMoney(rows, moneyFiltersFrom({ side: 'in' }), typeOf))).toEqual(['1', '5']);
    expect(ids(filterMoney(rows, moneyFiltersFrom({ side: 'out' }), typeOf))).toEqual([
      '2',
      '3',
      '4',
    ]);
  });

  it('an event type keeps the rows of events of that type', () => {
    expect(filterMoney(rows, moneyFiltersFrom({ type: 'festival' }), typeOf)).toHaveLength(5);
    expect(filterMoney(rows, moneyFiltersFrom({ type: 'other' }), typeOf)).toHaveLength(0);
  });

  it('lists vendors once, and builds shareable links', () => {
    expect(vendorsPaid(rows)).toEqual(['Sharma Tents', 'Sound Co']);
    const filters = moneyFiltersFrom({ vendor: 'Sound Co', side: 'out' });
    expect(moneyHref('x', filters, { receipts: true, payments: true })).toBe(
      '/app/x/money?vendor=Sound+Co',
    );
    expect(moneyHref('x', moneyFiltersFrom({}))).toBe('/app/x/money');
  });
});
