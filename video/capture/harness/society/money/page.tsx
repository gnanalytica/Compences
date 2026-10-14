/* eslint-disable */
// Generated set for the demo video. Copied into apps/web/src/app/zz-demo/ by
// video/capture/capture.mjs and deleted again when the capture finishes.
//
// The Money page's body, rendered from invented rows. The components are the
// page's own — LedgerRow decides what a row says, so "Flat not recorded"
// appears here for the same reason it appears in the app.
import { PiggyBank } from 'lucide-react';
import { formatDate, formatMoney, fundMovementLine } from '@compences/core';
import { StatTile, StatTiles } from '@/components/badges';
import { PageBody, PageHeader } from '@/components/page-header';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { LedgerRow } from '@/components/ledger-row';
import { LEDGER, MOVEMENTS, SOCIETY, TOTALS } from '../demo-data';

const { currency, slug } = SOCIETY;

export default function DemoMoney() {
  return (
    <>
      <PageHeader
        title="Money"
        description="Every rupee Shanti Nivas has taken in and spent, since the day it started."
      />
      <PageBody>
        <StatTiles>
          <StatTile label="Collected" value={formatMoney(TOTALS.collected, currency)} />
          <StatTile label="Spent" value={formatMoney(TOTALS.spent, currency)} />
          <StatTile label="Balance" value={formatMoney(TOTALS.balance, currency)} tone="success" />
        </StatTiles>

        <Card className="mt-5">
          <CardHeader
            title="Where money has moved"
            description="What was left over when an event closed, and what the committee decided to do with it — carry it to another event, or keep it for the society."
          />
          <CardBody className="border-border-base flex items-center gap-3 border-b">
            <PiggyBank className="text-accent size-6 shrink-0" aria-hidden="true" />
            <div>
              <p className="text-ink text-lg font-semibold">
                {formatMoney(TOTALS.society, currency)}
              </p>
              <p className="text-ink-subtle text-xs">
                Kept for the society · behind no event, until the committee puts it behind one
              </p>
            </div>
          </CardBody>
          <ul className="divide-border-base divide-y">
            {MOVEMENTS.map((movement) => (
              <li key={movement.id} className="px-5 py-3">
                <p className="text-ink text-sm">{fundMovementLine(movement as never, currency)}</p>
                <p className="text-ink-subtle mt-0.5 text-xs">
                  {formatDate(movement.decided_at.slice(0, 10))}
                  {` · decided by ${movement.decider.profiles.full_name}`}
                  {movement.note ? ` · ${movement.note}` : ''}
                </p>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="mt-5">
          <CardHeader
            title="Every transaction"
            description="Confirmed payments in and approved bills out. A payment waiting to be confirmed is not here yet."
          />
          <ul className="divide-border-base divide-y">
            {LEDGER.map((row) => (
              <LedgerRow key={row.id} row={row} slug={slug} currency={currency} />
            ))}
          </ul>
        </Card>
      </PageBody>
    </>
  );
}
