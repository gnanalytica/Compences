/* eslint-disable */
// Generated set for the demo video. Copied into apps/web/src/app/zz-demo/ by
// video/capture/stage.mjs and deleted again when the capture finishes.
//
// The event page, which is the product's actual centre: the spec's organising
// unit is the event, and a checklist, a fund, activities, volunteer roles,
// expenses and a closure rule all hang off one. The first cut of this video
// showed the fund and nothing else, which made a co-ordination product look
// like a payments app.
//
// Everything drawn here is the app's own component — ReadinessBar, FundBar,
// StatTiles, AuditTrail, Card — with the numbers the real page would have
// fetched handed to it directly.
import { CalendarDays, Check, FileText, Users } from 'lucide-react';
import { festivalFor, formatDate, formatMoney, fundBarSegments, inTheFund } from '@compences/core';
import { FundBar, FundKey, ReadinessBar, StatTile, StatTiles } from '@/components/badges';
import { AuditTrail } from '@/components/audit-trail';
import { PageBody } from '@/components/page-header';
import { FestivalHeader, festivalVars } from '@/components/festival';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import {
  ACTIVITIES,
  APPROVED_EXPENSES,
  AWAITING_EXPENSE,
  BUDGET,
  CHECKLIST,
  FUND,
  SOCIETY,
  VOLUNTEER_ROLES,
  YOU,
} from '../demo-data';

const { currency } = SOCIETY;
const pct = (part: number, whole: number) => Math.round((part / whole) * 100);

const done = CHECKLIST.filter((task) => task.done).length;
const readiness = pct(done, CHECKLIST.length);
// The same arithmetic the real page does: what the fund holds, carried money
// included, against the event's target.
const bar = fundBarSegments(FUND.raised, FUND.pending, FUND.target, FUND.carried);
const funded = bar.confirmed;
const held = inTheFund(FUND.raised, FUND.carried);

/**
 * The real page renders BillLink, which signs a Storage URL. This capture runs
 * against a placeholder project that cannot sign one, so the real component
 * would draw "Bill not available" — true of the harness and false of the app.
 * The button below is that component's markup with the link taken out.
 */
function BillButton() {
  return (
    <span className="border-border-base bg-surface-raised text-ink mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold sm:w-auto">
      <FileText className="size-4" aria-hidden="true" />
      View bill
    </span>
  );
}

export default function DemoEvent() {
  // The whole page takes the festival's colour, exactly as the app does:
  // festivalVars re-points --accent, so every chip, bar and button below turns
  // marigold without knowing which festival it is in. Filming this with the
  // plain header was filming the app with its dressing taken off.
  const festival = festivalFor('Ganesh Chaturthi 2026');

  return (
    <div style={festivalVars(festival)}>
      <FestivalHeader
        festival={festival}
        title="🪔 Ganesh Chaturthi 2026"
        description="15–17 September · Shanti Nivas clubhouse and podium · in 3 days"
        action={<Badge tone="success">Collecting</Badge>}
      />
      <PageBody>
        <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
          <div className="space-y-5">
            {/* ------------------------------------------------- readiness */}
            <Card>
              <CardHeader
                title="Readiness"
                description="Completed tasks over total tasks. Nothing here is typed in by hand."
                action={<span className="text-accent text-sm font-semibold">{readiness}%</span>}
              />
              <CardBody>
                <ReadinessBar percent={readiness} />
                <ul className="mt-4 space-y-2">
                  {CHECKLIST.map((task) => (
                    <li key={task.id} className="flex items-center gap-3 text-sm">
                      <span
                        className={
                          task.done
                            ? 'bg-success/15 text-success grid size-5 shrink-0 place-items-center rounded-full'
                            : 'border-border-base grid size-5 shrink-0 place-items-center rounded-full border border-dashed'
                        }
                      >
                        {task.done ? <Check className="size-3" aria-hidden="true" /> : null}
                      </span>
                      <span
                        className={task.done ? 'text-ink-subtle line-through' : 'text-ink flex-1'}
                      >
                        {task.title}
                      </span>
                      <span className="text-ink-subtle ml-auto text-xs">
                        {task.owner ?? 'Nobody yet'} · {formatDate(task.due)}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>

            {/* ------------------------------------------------ the money out */}
            <Card>
              <CardHeader title={`Where the money went (${APPROVED_EXPENSES.length})`} />
              <ul className="divide-border-base divide-y">
                {APPROVED_EXPENSES.map((expense) => (
                  <li key={expense.id} className="flex items-start justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="text-ink text-sm font-medium">{expense.name}</p>
                      <p className="text-ink-subtle mt-0.5 text-xs">
                        {[expense.category, expense.vendor, formatDate(expense.spent_on)].join(
                          ' · ',
                        )}
                      </p>
                      <p className="text-ink-subtle mt-0.5 text-xs">
                        <AuditTrail
                          confirmedBy={expense.approved_by}
                          confirmedAt={expense.approved_at}
                          confirmedLabel="Approved"
                        />
                      </p>
                      <BillButton />
                    </div>
                    <span className="text-ink shrink-0 text-sm font-semibold">
                      {formatMoney(expense.amount, currency)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="border-border-base bg-surface-sunken flex justify-between border-t px-5 py-3 text-sm font-semibold">
                <span className="text-ink">Total spent</span>
                <span className="text-ink">{formatMoney(FUND.spent, currency)}</span>
              </div>
            </Card>

            {/* --------------------------- nobody signs off their own money */}
            <Card>
              <CardHeader
                title="Waiting for the committee"
                description="A bill is approved by somebody other than whoever filed it. The database refuses the other way round, not just the screen."
              />
              <CardBody className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-ink text-sm font-medium">{AWAITING_EXPENSE.name}</p>
                  <p className="text-ink-subtle text-xs">
                    {AWAITING_EXPENSE.vendor} · filed by {AWAITING_EXPENSE.filed_by}
                  </p>
                  <p className="text-ink-subtle mt-1 text-xs">
                    You filed this one, so it is not yours to approve.
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-ink-muted text-sm">
                    {formatMoney(AWAITING_EXPENSE.amount, currency)}
                  </span>
                  <Badge tone="warning">Awaiting approval</Badge>
                </div>
              </CardBody>
            </Card>
          </div>

          <div className="space-y-5">
            {/* ----------------------------------------------------- the fund */}
            <Card>
              <CardHeader
                title="Fund"
                action={<span className="text-success text-sm font-semibold">{funded}%</span>}
              />
              <CardBody>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-ink text-2xl font-semibold tracking-tight">
                      {formatMoney(held, currency)}
                    </p>
                    <p className="text-ink-muted text-sm">
                      of {formatMoney(FUND.target, currency)} · {FUND.contributors} households gave
                    </p>
                  </div>
                  <ButtonLink href={`/app/${SOCIETY.slug}/contribute`} size="sm">
                    Contribute
                  </ButtonLink>
                </div>
                <div className="mt-3">
                  <FundBar percent={funded} pendingPercent={bar.pending} />
                </div>
                <FundKey
                  confirmed={held}
                  pending={FUND.pending}
                  currency={currency}
                  className="mt-2"
                />
                <p className="text-ink-subtle mt-2 text-xs">
                  + {formatMoney(FUND.carried, currency)} left over from Summer Camp 2026
                </p>
                <StatTiles className="mt-4 gap-2">
                  <StatTile label="From residents" value={formatMoney(FUND.raised, currency)} />
                  <StatTile label="Spent" value={formatMoney(FUND.spent, currency)} />
                  <StatTile
                    label="Balance"
                    value={formatMoney(FUND.raised + FUND.carried - FUND.spent, currency)}
                    tone="success"
                  />
                </StatTiles>
              </CardBody>
            </Card>

            {/* ------------------------------------------ budget vs spending */}
            <Card>
              <CardHeader
                title="Budget and spending"
                description="What was planned, next to what actually went out."
              />
              <ul className="divide-border-base divide-y">
                {BUDGET.map((line) => (
                  <li key={line.id} className="px-5 py-3">
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="text-ink">{line.category}</span>
                      <span className="text-ink-muted tabular-nums">
                        {formatMoney(line.spent, currency)} of {formatMoney(line.planned, currency)}
                      </span>
                    </div>
                    <div className="bg-surface-sunken mt-1.5 h-1.5 overflow-hidden rounded-full">
                      <div
                        className={
                          line.spent > line.planned
                            ? 'bg-danger h-full rounded-full'
                            : 'bg-accent h-full rounded-full'
                        }
                        style={{ width: `${Math.min(100, pct(line.spent, line.planned))}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </Card>

            {/* ------------------------------------------------- activities */}
            <Card>
              <CardHeader
                title="Activities"
                description="Cultural acts residents sign up to perform in."
              />
              <ul className="divide-border-base divide-y">
                {ACTIVITIES.map((activity) => (
                  <li key={activity.id} className="flex items-center gap-3 px-5 py-3">
                    <CalendarDays className="text-accent size-4 shrink-0" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="text-ink text-sm font-medium">{activity.name}</p>
                      <p className="text-ink-subtle text-xs">{activity.slot}</p>
                    </div>
                    {activity.signed >= activity.cap ? (
                      <Badge>Full</Badge>
                    ) : (
                      <span className="text-ink-muted text-xs">
                        {activity.signed} of {activity.cap}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </Card>

            {/* --------------------------------------------- volunteer roles */}
            <Card>
              <CardHeader
                title="Where help is needed"
                description="Volunteers needed is the role's target minus whoever has signed up."
              />
              <ul className="divide-border-base divide-y">
                {VOLUNTEER_ROLES.map((role) => (
                  <li key={role.id} className="flex items-center gap-3 px-5 py-3">
                    <Users className="text-accent size-4 shrink-0" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="text-ink text-sm font-medium">{role.name}</p>
                      <p className="text-ink-subtle text-xs">
                        {role.signed} of {role.needed} signed up
                      </p>
                    </div>
                    {role.signed >= role.needed ? (
                      <Badge tone="success">Covered</Badge>
                    ) : (
                      <Badge tone="warning">{role.needed - role.signed} more</Badge>
                    )}
                  </li>
                ))}
              </ul>
            </Card>

            <div className="border-border-base bg-surface-sunken text-ink-muted rounded-lg border px-4 py-3 text-sm">
              🔒 <span className="text-ink font-medium">If money is left over:</span> keep it for
              the society.
              <p className="text-ink-subtle mt-1 text-xs">
                Fixed when the event was created, before any money was collected.
              </p>
            </div>
          </div>
        </div>
      </PageBody>
    </div>
  );
}
