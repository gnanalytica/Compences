/* eslint-disable */
// Generated set for the demo video. Copied into apps/web/src/app/zz-demo/ by
// video/capture/stage.mjs and deleted again when the capture finishes.
//
// Reconciliation: import the society's bank statement and pair each line with
// the payment it turned out to be. This is the screen that makes the ledger
// trustworthy rather than merely public — a reported payment is a claim until
// the bank agrees with it — and the first cut of the video did not mention it.
//
// The narrations below are the shapes real banks post, because that is what
// the parser in packages/core/src/statement.ts was written against: a UTR
// buried in free text, and the note Compences put on the payment carrying the
// flat through to the statement.
import { Scale } from 'lucide-react';
import { formatDate, formatMoney } from '@compences/core';
import { StatTile, StatTiles } from '@/components/badges';
import { PageBody, PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { SOCIETY } from '../../demo-data';

const { currency } = SOCIETY;

const open = [
  {
    id: 'l1',
    amount: 3001,
    posted_on: '2026-09-11',
    narration: 'UPI/612345678901/ESHA PATIL/OKAXIS/SMDB306 GANESH',
    reference: '612345678901',
    flat: 'B306',
    candidates: [
      { id: 'c1', who: 'Esha Patil · B 306', amount: 3001, why: 'same UTR' },
      { id: 'c2', who: 'Dev Sharma · B 1104', amount: 3001, why: 'same amount' },
    ],
  },
  {
    id: 'l2',
    amount: 1500,
    posted_on: '2026-09-12',
    narration: 'NEFT-CITIN2609121144-R SUBRAMANIAN-SHANTI NIVAS WELFARE',
    reference: null,
    flat: null,
    candidates: [],
  },
];

const settled = [
  {
    id: 's1',
    amount: 2001,
    posted_on: '2026-09-14',
    narration: 'UPI/998812340077/ASHA MENON/OKICICI/SMDA402 GANESH',
    outcome: 'Matched to Asha Menon · A 402',
    by: 'Chitra Rao',
  },
  {
    id: 's2',
    amount: -6500,
    posted_on: '2026-09-11',
    narration: 'IMPS/SRI GANESH SOUND SERVICE',
    outcome: 'Set aside — paid to a vendor, matched to the bill by hand',
    by: 'Bala Krishnan',
  },
];

export default function DemoReconcile() {
  return (
    <>
      <PageHeader
        title="Reconcile"
        description="Import the society's statement and pair each line with the payment it turned out to be."
      />
      <PageBody>
        <StatTiles>
          <StatTile label="Lines imported" value="64" />
          <StatTile label="Matched" value="62" tone="success" />
          <StatTile label="Unexplained lines" value={String(open.length)} tone="danger" />
        </StatTiles>

        <Card className="mt-5">
          <CardHeader
            title={`Nobody has explained these yet (${open.length})`}
            description="Every line the bank posted that the app cannot account for. Pair it with a payment, or say what it was."
          />
          <ul className="divide-border-base divide-y">
            {open.map((line) => (
              <li key={line.id} className="space-y-3 px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-ink text-sm font-semibold">
                      +{formatMoney(line.amount, currency)}
                      <span className="text-ink-muted font-normal">
                        {' '}
                        · {formatDate(line.posted_on)}
                      </span>
                    </p>
                    <p className="text-ink-subtle mt-0.5 font-mono text-xs break-all">
                      {line.narration}
                    </p>
                    {line.reference ? (
                      <p className="text-ink mt-0.5 font-mono text-xs">UTR {line.reference}</p>
                    ) : null}
                    {line.flat ? (
                      <p className="text-ink mt-0.5 text-xs">
                        Names flat <span className="font-mono font-semibold">{line.flat}</span>
                      </p>
                    ) : null}
                  </div>
                  <Badge tone="success">Money in</Badge>
                </div>

                {line.candidates.length ? (
                  <div className="border-border-base bg-surface-sunken space-y-2 rounded-lg border p-3">
                    <p className="text-ink-subtle text-xs font-medium">
                      Reported payments this could be
                    </p>
                    {line.candidates.map((candidate) => (
                      <label
                        key={candidate.id}
                        className="border-border-base bg-surface-raised flex items-center gap-3 rounded-md border px-3 py-2 text-sm"
                      >
                        <input
                          type="radio"
                          name={line.id}
                          defaultChecked={candidate.why === 'same UTR'}
                          className="accent-accent"
                        />
                        <span className="text-ink flex-1">{candidate.who}</span>
                        <span className="text-ink-muted tabular-nums">
                          {formatMoney(candidate.amount, currency)}
                        </span>
                        <Badge tone={candidate.why === 'same UTR' ? 'success' : 'neutral'}>
                          {candidate.why}
                        </Badge>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-ink-subtle text-xs">
                    No reported payment matches this. Ask around, or set it aside.
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Card>

        <Card className="mt-5">
          <CardHeader
            title={`Settled (${settled.length})`}
            description="Lines already paired or written off, and who decided."
          />
          <ul className="divide-border-base divide-y">
            {settled.map((line) => (
              <li key={line.id} className="flex items-start justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="text-ink text-sm font-medium">
                    {line.amount > 0 ? '+' : '−'}
                    {formatMoney(Math.abs(line.amount), currency)}
                    <span className="text-ink-muted font-normal">
                      {' '}
                      · {formatDate(line.posted_on)}
                    </span>
                  </p>
                  <p className="text-ink-subtle mt-0.5 font-mono text-xs break-all">
                    {line.narration}
                  </p>
                  <p className="text-ink-muted mt-0.5 text-xs">
                    {line.outcome} · decided by {line.by}
                  </p>
                </div>
                <Scale className="text-ink-subtle size-4 shrink-0" aria-hidden="true" />
              </li>
            ))}
          </ul>
        </Card>
      </PageBody>
    </>
  );
}
