'use client';

import { useId, useMemo, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  budgetArcs,
  formatDate,
  formatMoney,
  groupBudget,
  seriesVar,
  type BudgetBar,
  type BudgetBill,
  type BudgetGroup,
  type BudgetItem,
  type BudgetView,
} from '@compences/core';
import { cn } from '@/lib/utils';

export type BudgetChartBill = BudgetBill & { name: string; spent_on: string };

/**
 * The budget against what was spent, as one picture: a ring split by vendor or
 * by service, each share filled as far as it has been spent, then a bar for
 * each. Tapping a bar opens it into its line items and the bills paid out of
 * each. Only approved bills count; one still waiting is the committee's to
 * decide, and residents can't see it.
 *
 * `billLinks` are the "View bill" buttons, rendered on the server because each
 * one signs a short-lived link to the picture.
 */
export function BudgetBars({
  lines,
  bills,
  currency,
  billLinks,
}: {
  lines: BudgetItem[];
  bills: BudgetChartBill[];
  currency: string;
  billLinks: Record<string, ReactNode>;
}) {
  const [view, setView] = useState<BudgetView>('vendor');
  const [open, setOpen] = useState<string[]>([]);
  const { groups, total, outside } = useMemo(
    () => groupBudget(lines, bills, view),
    [lines, bills, view],
  );
  const colourOf = (group: BudgetGroup<BudgetChartBill>, index: number) =>
    group.kind === 'unplanned' ? 'var(--warning)' : seriesVar(index);
  const pending = lines.reduce((sum, line) => sum + (line.pending ?? 0), 0);
  const toggle = (key: string) =>
    setOpen((current) =>
      current.includes(key) ? current.filter((k) => k !== key) : [...current, key],
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-7">
        <BudgetRing
          groups={groups}
          total={total}
          colourOf={colourOf}
          focus={open}
          view={view}
          currency={currency}
        />
        <dl className="grid w-full grid-cols-2 gap-x-4 gap-y-3 sm:flex-1">
          <Figure label="Spent" value={formatMoney(total.spent, currency)} strong />
          <Figure
            label="Budget"
            value={total.planned > 0 ? formatMoney(total.planned, currency) : 'Not set'}
          />
          {total.over > 0 ? (
            <Figure label="Over budget" value={formatMoney(total.over, currency)} tone="danger" />
          ) : total.planned > 0 ? (
            <Figure label="Left" value={formatMoney(total.planned - total.spent, currency)} />
          ) : null}
          {outside > 0 ? (
            <Figure
              label="Outside the budget"
              value={formatMoney(outside, currency)}
              tone="warning"
            />
          ) : pending > 0 ? (
            <Figure label="Waiting for approval" value={formatMoney(pending, currency)} />
          ) : null}
        </dl>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-ink-muted text-sm">Open a bar to see its line items and bills.</p>
        <div
          role="group"
          aria-label="Show the budget by"
          className="bg-surface-sunken grid grid-cols-2 gap-1 rounded-lg p-1"
        >
          {(['vendor', 'service'] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={view === option}
              onClick={() => {
                setView(option);
                setOpen([]);
              }}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                view === option
                  ? 'bg-surface-raised text-ink shadow-sm'
                  : 'text-ink-muted hover:text-ink',
              )}
            >
              {option === 'vendor' ? 'By vendor' : 'By service'}
            </button>
          ))}
        </div>
      </div>

      <ul className="divide-border-base -mx-5 divide-y border-y">
        {groups.map((group, index) => (
          <GroupRow
            key={group.key}
            group={group}
            colour={colourOf(group, index)}
            open={open.includes(group.key)}
            onToggle={() => toggle(group.key)}
            currency={currency}
            billLinks={billLinks}
          />
        ))}
      </ul>
    </div>
  );
}

function Figure({
  label,
  value,
  strong = false,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: 'danger' | 'warning';
}) {
  return (
    <div className="min-w-0">
      <dt className="text-ink-subtle text-xs">{label}</dt>
      <dd
        className={cn(
          'mt-0.5 truncate font-semibold tabular-nums',
          strong ? 'text-ink text-xl' : 'text-ink text-base',
          tone === 'danger' && 'text-danger',
          tone === 'warning' && 'text-warning',
        )}
      >
        {value}
      </dd>
    </div>
  );
}

const RADIUS = 46;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * The whole plan as a ring, one arc per group sized by its share of the plan.
 * The pale part of an arc is still to be spent, the solid part has been. The
 * middle says how much of the whole budget is gone.
 */
function BudgetRing({
  groups,
  total,
  colourOf,
  focus,
  view,
  currency,
}: {
  groups: BudgetGroup<BudgetChartBill>[];
  total: BudgetBar;
  colourOf: (group: BudgetGroup<BudgetChartBill>, index: number) => string;
  focus: string[];
  view: BudgetView;
  currency: string;
}) {
  const arcs = budgetArcs(groups);
  const gap = arcs.length > 1 ? 1.2 : 0;
  const described = groups
    .filter((group) => group.planned > 0)
    .map(
      (group) =>
        `${group.label}: ${formatMoney(group.planned, currency)} planned, ${formatMoney(group.spent, currency)} spent`,
    )
    .join('; ');

  return (
    <figure className="relative size-40 shrink-0">
      <svg
        viewBox="0 0 120 120"
        className="size-full -rotate-90"
        role="img"
        aria-label={
          total.planned > 0 ? `The budget by ${view}. ${described}.` : 'No budget has been set yet.'
        }
      >
        <circle
          cx="60"
          cy="60"
          r={RADIUS}
          fill="none"
          strokeWidth="14"
          className="stroke-surface-sunken"
        />
        {arcs.map((arc) => {
          const index = groups.findIndex((group) => group.key === arc.key);
          const group = groups[index]!;
          const colour = colourOf(group, index);
          const length = Math.max(0, arc.length * CIRCUMFERENCE - gap);
          const offset = -arc.start * CIRCUMFERENCE;
          const dimmed = focus.length > 0 && !focus.includes(arc.key);
          return (
            <g
              key={arc.key}
              className="transition-opacity duration-200"
              style={{ opacity: dimmed ? 0.3 : 1 }}
            >
              <circle
                cx="60"
                cy="60"
                r={RADIUS}
                fill="none"
                strokeWidth="14"
                stroke={colour}
                strokeOpacity={0.28}
                strokeDasharray={`${length} ${CIRCUMFERENCE}`}
                strokeDashoffset={offset}
              />
              <circle
                cx="60"
                cy="60"
                r={RADIUS}
                fill="none"
                strokeWidth="14"
                stroke={colour}
                strokeDasharray={`${length * arc.filled} ${CIRCUMFERENCE}`}
                strokeDashoffset={offset}
              />
            </g>
          );
        })}
      </svg>
      <figcaption className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {total.planned > 0 ? (
          <>
            <span
              className={cn(
                'font-serif text-3xl leading-none font-medium tabular-nums',
                total.over > 0 ? 'text-danger' : 'text-ink',
              )}
            >
              {Math.round((total.spent / total.planned) * 100)}%
            </span>
            <span className="text-ink-subtle mt-1 text-xs">spent</span>
          </>
        ) : (
          <span className="text-ink-subtle px-6 text-xs">No budget set</span>
        )}
      </figcaption>
    </figure>
  );
}

function GroupRow({
  group,
  colour,
  open,
  onToggle,
  currency,
  billLinks,
}: {
  group: BudgetGroup<BudgetChartBill>;
  colour: string;
  open: boolean;
  onToggle: () => void;
  currency: string;
  billLinks: Record<string, ReactNode>;
}) {
  const panel = useId();
  const unplanned = group.kind === 'unplanned';
  const count = unplanned ? group.bills.length : group.items.length;
  const noun = unplanned
    ? count === 1
      ? 'bill'
      : 'bills'
    : group.kind === 'vendor'
      ? count === 1
        ? 'service'
        : 'services'
      : count === 1
        ? 'vendor'
        : 'vendors';

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panel}
        className="hover:bg-surface-sunken/60 focus-visible:bg-surface-sunken/60 w-full px-5 py-3.5 text-left transition-colors focus-visible:outline-none"
      >
        <span className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2.5">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: colour }}
              aria-hidden="true"
            />
            <span className="text-ink text-sm font-medium break-words">{group.label}</span>
            <span className="text-ink-subtle hidden shrink-0 text-xs sm:inline">
              {count} {noun}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <span className="text-sm tabular-nums">
              <span className="text-ink font-semibold">{formatMoney(group.spent, currency)}</span>
              {unplanned ? null : (
                <span className="text-ink-subtle"> of {formatMoney(group.planned, currency)}</span>
              )}
            </span>
            <ChevronDown
              className={cn(
                'text-ink-subtle size-4 transition-transform duration-200',
                open && 'rotate-180',
              )}
              aria-hidden="true"
            />
          </span>
        </span>
        <Bar bar={group.bar} colour={colour} label={group.label} className="mt-2 h-2.5" />
        <Status bar={group.bar} currency={currency} className="mt-1.5" />
      </button>

      {open ? (
        <div id={panel} className="px-5 pb-4">
          {unplanned ? (
            <Bills bills={group.bills} billLinks={billLinks} currency={currency} loose />
          ) : (
            <ul className="space-y-4 border-l-2 pl-4" style={{ borderColor: colour }}>
              {group.items.map((item) => (
                <li key={item.line.id}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="text-ink min-w-0 break-words">{item.label}</span>
                    <span className="shrink-0 tabular-nums">
                      <span className="text-ink font-medium">
                        {formatMoney(item.line.approved, currency)}
                      </span>
                      <span className="text-ink-subtle">
                        {' '}
                        of {formatMoney(item.line.planned, currency)}
                      </span>
                    </span>
                  </div>
                  <Bar bar={item.bar} colour={colour} label={item.label} className="mt-1.5 h-1.5" />
                  <Status bar={item.bar} currency={currency} className="mt-1" />
                  <Bills bills={item.bills} billLinks={billLinks} currency={currency} />
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </li>
  );
}

function Bills({
  bills,
  billLinks,
  currency,
  loose = false,
}: {
  bills: BudgetChartBill[];
  billLinks: Record<string, ReactNode>;
  currency: string;
  loose?: boolean;
}) {
  if (!bills.length) {
    return <p className="text-ink-subtle mt-2 text-xs">No bills approved against this yet.</p>;
  }
  return (
    <ul className="mt-2.5 space-y-2.5">
      {bills.map((bill) => (
        <li key={bill.id} className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-ink-muted text-sm">{bill.name}</p>
            <p className="text-ink-subtle mt-0.5 text-xs">
              {[
                loose ? bill.category : null,
                loose ? (bill.vendor ?? 'Vendor not recorded') : null,
                formatDate(bill.spent_on),
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            {billLinks[bill.id] ? <div className="mt-1.5">{billLinks[bill.id]}</div> : null}
          </div>
          <span className="text-ink shrink-0 text-sm tabular-nums">
            {formatMoney(bill.amount, currency)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Status({
  bar,
  currency,
  className,
}: {
  bar: BudgetBar;
  currency: string;
  className?: string;
}) {
  if (bar.unplanned) {
    return (
      <span className={cn('text-ink-subtle block text-xs', className)}>
        Paid without a budget line behind it
      </span>
    );
  }
  if (bar.over > 0) {
    return (
      <span className={cn('text-danger block text-xs', className)}>
        {formatMoney(bar.over, currency)} over
      </span>
    );
  }
  return (
    <span className={cn('text-ink-subtle block text-xs', className)}>
      {formatMoney(bar.planned - bar.spent, currency)} left · {bar.percent}% spent
    </span>
  );
}

function Bar({
  bar,
  colour,
  label,
  className,
}: {
  bar: BudgetBar;
  colour: string;
  label: string;
  className?: string;
}) {
  // Past the plan, the bar is full: the plan in the group's colour and the
  // part beyond it in red, so the overspend reads as a share of what was spent.
  const within = bar.over > 0 ? (bar.planned / bar.spent) * 100 : bar.percent;
  return (
    <span
      className={cn('bg-surface-sunken flex overflow-hidden rounded-full', className)}
      role="progressbar"
      aria-label={`${label}, spent against plan`}
      aria-valuenow={bar.percent}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span
        className="block h-full transition-[width] duration-500"
        style={{
          width: `${within}%`,
          background: bar.unplanned ? 'var(--warning)' : colour,
        }}
      />
      {bar.over > 0 ? (
        <span
          className="bg-danger block h-full border-l-2 border-[var(--surface-raised)]"
          style={{ width: `${100 - within}%` }}
        />
      ) : null}
    </span>
  );
}
