import { budgetBar, budgetTotal, formatMoney, type BudgetBar } from '@compences/core';
import { cn } from '@/lib/utils';

/**
 * The budget against what was spent: the whole budget as one bar, then a bar
 * per line, each filled against its own plan. Only approved bills count; one
 * still waiting is the committee's to decide, and residents can't see it.
 */
export function BudgetBars({
  rows,
  currency,
}: {
  rows: { label: string; planned: number; spent: number }[];
  currency: string;
}) {
  const total = budgetTotal(rows);
  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-ink-muted text-sm">
            <span className="text-ink text-base font-semibold">
              {formatMoney(total.spent, currency)}
            </span>
            {total.planned > 0
              ? ` of ${formatMoney(total.planned, currency)} spent`
              : ' spent, with no budget set'}
          </p>
          {total.planned > 0 ? (
            <span
              className={cn(
                'shrink-0 text-sm font-medium',
                total.over ? 'text-danger' : 'text-ink-muted',
              )}
            >
              {total.over ? `${formatMoney(total.over, currency)} over` : `${total.percent}%`}
            </span>
          ) : null}
        </div>
        {total.planned > 0 ? <Bar bar={total} label="Whole budget" /> : null}
      </div>

      <ul className="space-y-4">
        {rows.map((row) => {
          const bar = budgetBar(row.planned, row.spent);
          return (
            <li key={row.label}>
              <div className="flex justify-between gap-3 text-sm">
                <span className="text-ink font-medium">{row.label}</span>
                <span className={bar.over ? 'text-danger' : 'text-ink-muted'}>
                  {bar.unplanned
                    ? formatMoney(row.spent, currency)
                    : `${formatMoney(row.spent, currency)} of ${formatMoney(row.planned, currency)}`}
                </span>
              </div>
              <Bar bar={bar} label={row.label} />
              {bar.over ? (
                <p className="text-danger mt-1 text-xs">{formatMoney(bar.over, currency)} over</p>
              ) : null}
              {bar.unplanned ? (
                <p className="text-warning mt-1 text-xs">Not in the budget</p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Bar({ bar, label }: { bar: BudgetBar; label: string }) {
  return (
    <div
      className="bg-surface-sunken mt-1.5 h-2 overflow-hidden rounded-full"
      role="progressbar"
      aria-label={`${label}, spent against plan`}
      aria-valuenow={bar.percent}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn(
          'h-full rounded-full',
          bar.over ? 'bg-danger' : bar.unplanned ? 'bg-warning' : 'bg-accent',
        )}
        style={{ width: `${bar.percent}%` }}
      />
    </div>
  );
}
