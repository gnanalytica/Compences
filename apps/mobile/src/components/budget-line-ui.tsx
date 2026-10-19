import { View } from 'react-native';
import { formatMoney, overLineBy, type BudgetLineBalance } from '@compences/core';
import { supabase } from '../lib/supabase';
import { useCommunityData } from '../lib/use-community-data';
import { Caption } from './ui';

/**
 * A budget line with what is left of it. `remaining` is the plan minus the
 * bills a committee member has approved, as public.budget_line_balances works
 * it out; `pending` is what is waiting for approval, shown beside it. A
 * resident reads the same view but can only see approved bills, so for them
 * `pending` is always 0.
 */
export type LineBalance = BudgetLineBalance & {
  categoryId: string | null;
  vendorId: string | null;
};

/** An event's budget lines in the order they were entered, with their balances. */
export async function fetchLineBalances(eventId: string): Promise<LineBalance[]> {
  const [lines, balances] = await Promise.all([
    supabase
      .from('budget_lines')
      .select('id, category, category_id, vendor, vendor_id, amount')
      .eq('event_id', eventId)
      .order('position'),
    supabase
      .from('budget_line_balances')
      .select('id, planned, approved, pending, remaining')
      .eq('event_id', eventId),
  ]);
  const byId = new Map((balances.data ?? []).map((row) => [row.id, row]));
  return (lines.data ?? []).map((line) => {
    const balance = byId.get(line.id);
    const planned = Number(balance?.planned ?? line.amount);
    const approved = Number(balance?.approved ?? 0);
    return {
      id: line.id,
      category: line.category,
      categoryId: line.category_id,
      vendor: line.vendor,
      vendorId: line.vendor_id,
      planned,
      approved,
      pending: Number(balance?.pending ?? 0),
      remaining: Number(balance?.remaining ?? planned - approved),
    };
  });
}

export function useLineBalances(eventId: string) {
  return useCommunityData(`budget-lines:${eventId}`, () =>
    eventId ? fetchLineBalances(eventId) : Promise.resolve([]),
  );
}

/** "6L total · 6L remaining · 1L pending", the pending part only when there is some. */
export function lineFigures(
  line: Pick<BudgetLineBalance, 'planned' | 'remaining' | 'pending'>,
  currency: string,
) {
  return [
    `${formatMoney(line.planned, currency)} total`,
    `${formatMoney(line.remaining, currency)} remaining`,
    line.pending > 0 ? `${formatMoney(line.pending, currency)} pending` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/**
 * The flag the committee sees before approving a bill that would take its
 * budget line below zero. It does not stop anyone: real spending sometimes goes
 * over, and the ledger should say so.
 */
export function OverBudgetFlag({
  lineId,
  amount,
  currency,
}: {
  lineId: string | null;
  amount: number;
  currency: string;
}) {
  const { data } = useCommunityData(`budget-line:${lineId}`, async () => {
    if (!lineId) return null;
    const { data: row } = await supabase
      .from('budget_line_balances')
      .select('remaining')
      .eq('id', lineId)
      .maybeSingle();
    return row ? Number(row.remaining) : null;
  });
  if (data === null || data === undefined) return null;
  const over = overLineBy(data, amount);
  if (over <= 0) return null;
  return <Caption tone="danger">Over budget by {formatMoney(over, currency)}</Caption>;
}

/** The same flag for a bill known only by its id, as the To do queue has it. */
export function OverBudgetFlagForBill({ billId, currency }: { billId: string; currency: string }) {
  const { data } = useCommunityData(`bill-line:${billId}`, async () => {
    const { data: row } = await supabase
      .from('expenses')
      .select('amount, budget_line_id')
      .eq('id', billId)
      .maybeSingle();
    return row ? { amount: Number(row.amount), lineId: row.budget_line_id } : null;
  });
  if (!data?.lineId) return null;
  return <OverBudgetFlag lineId={data.lineId} amount={data.amount} currency={currency} />;
}

/** Vendor, then the figures, read-only: what a bill form shows once a line is chosen. */
export function LineSummary({ line, currency }: { line: LineBalance; currency: string }) {
  return (
    <View style={{ gap: 2 }}>
      <Caption>Vendor: {line.vendor ?? 'Not named'}</Caption>
      <Caption>{lineFigures(line, currency)}</Caption>
    </View>
  );
}
