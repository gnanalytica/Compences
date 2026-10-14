import Link from 'next/link';
import { Receipt } from 'lucide-react';
import {
  correctionNote,
  formatDate,
  formatMoney,
  myPaymentTotals,
  receiptRef,
} from '@compences/core';
import { getSupabase } from '@/lib/supabase/server';
import { Card, CardHeader } from '@/components/ui/card';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PaymentStatusBadge, StatTile, StatTiles } from '@/components/badges';

/**
 * What this member has paid and where each payment stands. It used to be on
 * Me, away from the rest of the money; somebody checking whether their payment
 * was confirmed now looks where the money is.
 */
export async function MyContributions({
  slug,
  membershipId,
  currency,
}: {
  slug: string;
  membershipId: string;
  currency: string;
}) {
  const supabase = await getSupabase();
  const { data } = await supabase
    .from('contributions')
    .select(
      'id, amount, reported_amount, status, reference, review_note, receipt_no, paid_at, events(slug, name, emoji)',
    )
    .eq('membership_id', membershipId)
    .order('paid_at', { ascending: false })
    .limit(200);
  const rows = data ?? [];
  const totals = myPaymentTotals(rows);

  return (
    <>
      <StatTiles>
        <StatTile label="Confirmed" value={formatMoney(totals.confirmed, currency)} />
        <StatTile label="To be confirmed" value={formatMoney(totals.pending, currency)} />
      </StatTiles>

      <Card className="mt-5">
        <CardHeader title="Your payments" />
        {rows.length ? (
          <ul className="divide-border-base divide-y">
            {rows.map((contribution) => {
              const corrected = correctionNote(
                contribution.amount,
                contribution.reported_amount,
                currency,
              );
              return (
                <li
                  key={contribution.id}
                  className="flex items-center justify-between gap-3 px-5 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-ink text-sm font-medium">
                      {contribution.events?.slug ? (
                        <Link
                          href={`/app/${slug}/events/${contribution.events.slug}`}
                          className="hover:underline"
                        >
                          {contribution.events.name}
                        </Link>
                      ) : null}
                    </p>
                    <p className="text-ink-subtle mt-0.5 text-xs">
                      <span className="font-mono">
                        {contribution.status === 'succeeded'
                          ? receiptRef(contribution.events?.slug, contribution.receipt_no)
                          : (contribution.reference ?? 'UPI payment')}
                      </span>
                      {' · '}
                      {formatDate(contribution.paid_at.slice(0, 10))}
                    </p>
                    {contribution.status === 'failed' && contribution.review_note ? (
                      <p className="text-danger mt-1 text-xs">{contribution.review_note}</p>
                    ) : null}
                    {/* A figure that moved with no explanation on the row is
                        the app looking like it lost somebody's money. */}
                    {corrected ? (
                      <p className="text-warning mt-1 text-xs">
                        {corrected}
                        {contribution.review_note ? ` · ${contribution.review_note}` : ''}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-ink text-sm font-semibold">
                      {formatMoney(contribution.amount, currency)}
                    </span>
                    <PaymentStatusBadge status={contribution.status} />
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            icon={<Receipt className="size-6" />}
            title="Nothing yet"
            description="Your receipts show up here after you contribute."
            action={
              <ButtonLink href={`/app/${slug}/contribute`} size="sm">
                Contribute
              </ButtonLink>
            }
          />
        )}
      </Card>
    </>
  );
}
