import Link from 'next/link';
import { ArrowLeft, FileText, Receipt, Sparkles, Wallet } from 'lucide-react';
import {
  COPY,
  can,
  eventMoney,
  formatDate,
  formatMoney,
  fundBarSegments,
  inTheFund,
  nextEditionName,
  practiceDatesLine,
  receiptRef,
  stillNeeded,
  todayIn,
  unitLabel,
  upiCaptureNote,
} from '@compences/core';
import { requireCapability } from '@/lib/auth';
import {
  budgetVsSpent,
  getActivities,
  getBudgetLines,
  getCommitteeCount,
  getEventStats,
  getExpenses,
  getCarriedInto,
  getOpenEvents,
  getPayments,
  getSocietyBalance,
  getRegistrations,
  requireEvent,
} from '@/lib/events';
import { getSupabase } from '@/lib/supabase/server';
import { activeItems, getCatalogue } from '@/lib/catalogue';
import { CarriedIn } from '@/components/carried-in';
import { CatalogueSelect } from '@/components/catalogue-select';
import { PageBody, PageHeader } from '@/components/page-header';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Button, ButtonLink } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import {
  EventStatusBadge,
  ExpenseStatusBadge,
  FundBar,
  FundKey,
  PaymentStatusBadge,
  StatTile,
  StatTiles,
} from '@/components/badges';
import { EventBalanceCard } from '@/components/event-balance';
import { BillLink, StoredFileLink } from '@/components/bill-link';
import { AuditTrail } from '@/components/audit-trail';
import {
  AddActivityForm,
  AddBudgetLineForm,
  AllocateSurplusForm,
  CloseEventForm,
  EditActivityForm,
  EventDetailsForm,
  ExpenseForm,
  RecordPaymentForm,
  ReviewExpenseForm,
  ReviewPaymentForm,
  SpendBalanceForm,
  type Pickers,
} from './forms';
import { removeBudgetLine, setEventStatus, updateActivity, updateBudgetLine } from '../actions';
import { EventTabs, eventTabsFor } from '@/components/event-tabs';

export default async function ManageEventPage(
  props: PageProps<'/app/[community]/admin/events/[event]'>,
) {
  const { community: slug, event: eventSlug } = await props.params;
  const { tab } = await props.searchParams;
  const { community, role, membership } = await requireCapability(slug, 'events:manage');
  const event = await requireEvent(community.id, eventSlug);
  const supabase = await getSupabase();

  const isCommittee = can(role, 'expenses:approve');
  // The same list the event page renders, so one strip spans both routes.
  // Activities is a reader's tab in that strip; its organiser half, reached
  // from there by "Manage activities", lives here.
  const tabs = eventTabsFor({ role, kind: event.kind, status: event.status }).filter(
    (t) => t.admin || (t.id === 'activities' && can(role, 'activities:manage')),
  );
  const active = tabs.find((t) => t.id === tab)?.id ?? 'overview';
  const base = `/app/${community.slug}`;

  const [
    stats,
    budget,
    expenses,
    activities,
    registrations,
    payments,
    units,
    catalogue,
    committeeCount,
    society,
    openEvents,
    carriedIn,
    directory,
  ] = await Promise.all([
    getEventStats(event.id),
    getBudgetLines(event.id),
    getExpenses(event.id),
    getActivities(event.id),
    getRegistrations(event.id),
    getPayments(event.id),
    supabase
      .from('units')
      .select('id, block, number')
      .eq('community_id', community.id)
      .order('block', { nullsFirst: true })
      .order('number')
      .limit(2000),
    getCatalogue(community.id),
    getCommitteeCount(community.id),
    getSocietyBalance(community.id),
    getOpenEvents(community.id, event.id),
    getCarriedInto(event.id),
    // Whoever could coordinate an activity. The whole society, so only on the
    // tab that asks.
    active === 'activities'
      ? supabase.rpc('society_people', { p_community_id: community.id })
      : null,
  ]);

  // The database steps the separation-of-duties rule aside when there is
  // nobody else on the committee. The screens have to say the same thing.
  const alone = isCommittee && committeeCount <= 1;

  const pick = (kind: keyof typeof catalogue) =>
    activeItems(catalogue, kind).map(({ id, label, emoji }) => ({ id, label, emoji }));
  const pickers: Pickers = {
    event_type: pick('event_type'),
    venue: pick('venue'),
    budget_category: pick('budget_category'),
    activity_type: pick('activity_type'),
    vendor: pick('vendor'),
    manageHref: `${base}/admin/catalogue`,
  };

  const bar = fundBarSegments(
    stats.fundRaised,
    stats.fundPending,
    stats.fundTarget,
    stats.fundCarriedIn,
  );
  const funded = bar.confirmed;
  const held = inTheFund(stats.fundRaised, stats.fundCarriedIn);
  const money = eventMoney(stats);
  const today = todayIn(community.timezone);
  const closed = event.status === 'completed';
  // As on the phone: an event's activities stop changing once it is closed or
  // cancelled.
  const locked = closed || event.status === 'cancelled';
  const members = (directory?.data ?? [])
    .flatMap((person) =>
      person.membership_id
        ? [
            {
              id: person.membership_id,
              label: [person.full_name ?? 'Unnamed', person.flat].filter(Boolean).join(' · '),
            },
          ]
        : [],
    )
    .sort((a, b) => a.label.localeCompare(b.label));
  const open = expenses.filter((e) => e.status === 'pending' || e.status === 'changes_requested');
  const decided = expenses.filter((e) => e.status === 'approved' || e.status === 'rejected');
  const categories = budgetVsSpent(budget, expenses);
  const confirmedPayments = payments.filter((payment) => payment.status === 'succeeded');
  const waitingPayments = payments.filter((payment) => payment.status === 'pending');
  const flatsPaid = new Set(
    confirmedPayments.filter((payment) => payment.units).map((payment) => unitLabel(payment.units)),
  ).size;

  return (
    <>
      <PageHeader
        title={event.name}
        description={[
          event.kind === 'campaign' ? 'Fundraising campaign' : null,
          formatDate(event.starts_on),
          event.venue,
        ]
          .filter(Boolean)
          .join(' · ')}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <EventStatusBadge status={event.status} />
            {event.status === 'draft' ? (
              <form action={setEventStatus}>
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="event" value={event.slug} />
                <input type="hidden" name="status" value="published" />
                <Button type="submit" size="sm">
                  {COPY.publish}
                </Button>
              </form>
            ) : null}
            {event.status === 'published' ? (
              <ButtonLink href={`${base}/events/${event.slug}`} size="sm" variant="secondary">
                View as resident
              </ButtonLink>
            ) : null}
          </div>
        }
      />

      <PageBody>
        <Link
          href={`${base}/admin`}
          className="text-ink-muted hover:text-ink mb-4 inline-flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          All events
        </Link>

        <EventTabs
          base={base}
          eventSlug={event.slug}
          active={active}
          role={role}
          kind={event.kind}
          status={event.status}
          counts={{ bills: open.length }}
        />

        {active === 'overview' ? (
          <div className="space-y-5">
            {/* What is left to spend, first: nobody should commit to a bill
                without knowing whether this event can pay it. */}
            <EventBalanceCard
              money={money}
              currency={community.currency}
              todoHref={isCommittee ? `${base}/todo#overspent` : undefined}
            />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile
                label="Collected"
                value={formatMoney(money.collected, community.currency)}
              />
              <StatTile label="Spent" value={formatMoney(stats.spent, community.currency)} />
              <StatTile label="Flats paid" value={String(flatsPaid)} />
              <StatTile label="Registered" value={String(registrations.length)} />
            </div>
            <Card>
              <CardBody>
                {/* What the fund holds, carried money included, against the
                    event's target; striped, what is still to be confirmed. */}
                <div className="text-ink-muted flex justify-between text-sm font-medium">
                  <span>
                    {formatMoney(held, community.currency)} of{' '}
                    {formatMoney(stats.fundTarget, community.currency)}
                  </span>
                  <span>{funded}%</span>
                </div>
                <div className="mt-2">
                  <FundBar percent={funded} pendingPercent={bar.pending} />
                </div>
                <FundKey
                  confirmed={held}
                  pending={stats.fundPending}
                  currency={community.currency}
                  className="mt-2"
                />
                <CarriedIn movements={carriedIn} currency={community.currency} />
                {stats.fundMovedOut > 0 ? (
                  <p className="text-ink-subtle mt-2 text-xs">
                    {`${formatMoney(stats.fundMovedOut, community.currency)} of this event's money was handed on when it closed.`}
                  </p>
                ) : null}
                {!closed ? (
                  <p className="text-ink-subtle mt-1 text-xs">
                    {formatMoney(
                      stillNeeded(stats.fundTarget, stats.fundRaised, stats.fundCarriedIn),
                      community.currency,
                    )}{' '}
                    still to raise.
                  </p>
                ) : null}
              </CardBody>
            </Card>
            {/* The way back out of the society balance, so keeping a surplus
                is not a one-way door. */}
            {isCommittee && !closed && society.balance > 0 ? (
              <Card>
                <CardHeader
                  title="Bring in society funds"
                  description={`The society is holding ${formatMoney(society.balance, community.currency)} that is not behind any event.`}
                />
                <CardBody>
                  <SpendBalanceForm
                    slug={slug}
                    eventSlug={event.slug}
                    balance={society.balance}
                    currency={community.currency}
                  />
                </CardBody>
              </Card>
            ) : null}
            <Card>
              <CardHeader title="Details" />
              <CardBody>
                <EventDetailsForm slug={slug} event={event} pickers={pickers} />
              </CardBody>
            </Card>
            {event.status === 'published' || event.status === 'draft' ? (
              <Card>
                <CardHeader
                  title="Status"
                  description={
                    event.status === 'published'
                      ? 'Residents can see this event and contribute.'
                      : 'Only staff and the committee can see a draft.'
                  }
                />
                <CardBody className="flex flex-wrap gap-2">
                  {event.status === 'published' ? (
                    <form action={setEventStatus}>
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="event" value={event.slug} />
                      <input type="hidden" name="status" value="draft" />
                      <Button type="submit" size="sm" variant="secondary">
                        Move back to draft
                      </Button>
                    </form>
                  ) : null}
                  <form action={setEventStatus}>
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="event" value={event.slug} />
                    <input type="hidden" name="status" value="cancelled" />
                    <Button type="submit" size="sm" variant="ghost">
                      Cancel event
                    </Button>
                  </form>
                </CardBody>
              </Card>
            ) : null}
          </div>
        ) : null}

        {active === 'budget' ? (
          <div className="space-y-5">
            <Card>
              <CardHeader
                title="Budget"
                description={`The fund target is the total of these lines: ${formatMoney(
                  stats.fundTarget,
                  community.currency,
                )}.`}
              />
              {budget.length ? (
                <ul className="divide-border-base divide-y">
                  {budget.map((line) => {
                    const spent =
                      categories.find(
                        (row) => row.label.toLowerCase() === line.category.trim().toLowerCase(),
                      )?.spent ?? 0;
                    return (
                      <li key={line.id} className="px-5 py-3">
                        <form
                          action={updateBudgetLine}
                          className="flex flex-wrap items-center gap-2"
                        >
                          <input type="hidden" name="slug" value={slug} />
                          <input type="hidden" name="event" value={event.slug} />
                          <input type="hidden" name="line_id" value={line.id} />
                          <div className="min-w-44 flex-1">
                            <CatalogueSelect
                              slug={slug}
                              kind="budget_category"
                              name="category"
                              label={`Category for ${line.category}`}
                              items={pickers.budget_category}
                              defaultId={line.category_id}
                              defaultLabel={line.category}
                              disabled={closed}
                              hideLabel
                              required
                            />
                          </div>
                          <label className="sr-only" htmlFor={`amt-${line.id}`}>
                            Amount
                          </label>
                          <Input
                            id={`amt-${line.id}`}
                            name="amount"
                            type="number"
                            min={0}
                            defaultValue={Number(line.amount)}
                            className="w-32"
                            disabled={closed}
                          />
                          <span className="text-ink-subtle w-36 text-xs">
                            Spent {formatMoney(spent, community.currency)}
                          </span>
                          {!closed ? (
                            <>
                              <Button type="submit" size="sm" variant="secondary">
                                Save
                              </Button>
                              <Button
                                type="submit"
                                size="sm"
                                variant="ghost"
                                formAction={removeBudgetLine}
                              >
                                Remove
                              </Button>
                            </>
                          ) : null}
                        </form>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <EmptyState
                  icon={<Wallet className="size-6" />}
                  title="No budget yet"
                  description="Add what you plan to spend, category by category."
                />
              )}
              {!closed ? (
                <CardBody className="border-border-base border-t">
                  <AddBudgetLineForm slug={slug} eventSlug={event.slug} pickers={pickers} />
                </CardBody>
              ) : null}
            </Card>
          </div>
        ) : null}

        {active === 'activities' ? (
          <div className="space-y-5">
            {activities.length ? (
              activities.map((activity) => {
                const people = registrations.filter((r) => r.activity_id === activity.id);
                const coordinator = activity.memberships?.profiles?.full_name ?? null;
                return (
                  <Card key={activity.id}>
                    <CardHeader
                      title={activity.name}
                      description={
                        <>
                          {`${people.length} registered${
                            activity.capacity ? ` of ${activity.capacity} places` : ''
                          }${activity.is_open ? '' : ' · registrations closed'}`}
                          {coordinator ? (
                            <span className="text-ink-subtle block text-xs">
                              Coordinator: {coordinator}
                            </span>
                          ) : null}
                          {activity.practice_dates.length ? (
                            <span className="text-ink-subtle block text-xs">
                              Practice: {practiceDatesLine(activity.practice_dates)}
                            </span>
                          ) : null}
                        </>
                      }
                      action={
                        locked ? undefined : (
                          <form action={updateActivity} className="flex gap-2">
                            <input type="hidden" name="slug" value={slug} />
                            <input type="hidden" name="event" value={event.slug} />
                            <input type="hidden" name="activity_id" value={activity.id} />
                            <Button
                              type="submit"
                              size="sm"
                              variant="secondary"
                              name="intent"
                              value={activity.is_open ? 'close' : 'open'}
                            >
                              {activity.is_open ? 'Close registrations' : 'Reopen'}
                            </Button>
                            {people.length === 0 ? (
                              <Button
                                type="submit"
                                size="sm"
                                variant="ghost"
                                name="intent"
                                value="remove"
                              >
                                Remove
                              </Button>
                            ) : null}
                          </form>
                        )
                      }
                    />
                    {people.length ? (
                      <ul className="divide-border-base divide-y">
                        {people.map((person) => (
                          <li
                            key={person.id}
                            className="flex justify-between gap-3 px-5 py-2 text-sm"
                          >
                            <span className="text-ink">
                              {person.participant_name ??
                                person.memberships?.profiles?.full_name ??
                                'Resident'}
                            </span>
                            <span className="text-ink-subtle text-xs">
                              {person.participant_name && person.memberships?.profiles?.full_name
                                ? `registered by ${person.memberships.profiles.full_name}`
                                : formatDate(person.joined_at.slice(0, 10))}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {!locked ? (
                      <CardBody
                        className={people.length ? 'border-border-base border-t' : undefined}
                      >
                        <details className="group">
                          <summary className="text-accent cursor-pointer text-sm">
                            Edit<span className="sr-only"> {activity.name}</span>
                          </summary>
                          <div className="mt-3">
                            <EditActivityForm
                              slug={slug}
                              eventSlug={event.slug}
                              activity={{
                                id: activity.id,
                                name: activity.name,
                                emoji: activity.emoji,
                                description: activity.description,
                                capacity: activity.capacity,
                                coordinator_id: activity.coordinator_id,
                                coordinator_name: coordinator,
                                practice_dates: activity.practice_dates,
                              }}
                              members={members}
                            />
                          </div>
                        </details>
                      </CardBody>
                    ) : null}
                  </Card>
                );
              })
            ) : (
              <Card>
                <EmptyState
                  icon={<Sparkles className="size-6" />}
                  title="No activities yet"
                  description="Add performances, contests or games residents can register for."
                />
              </Card>
            )}
            {!locked ? (
              <Card>
                <CardHeader title="Add an activity" />
                <CardBody>
                  <AddActivityForm slug={slug} eventSlug={event.slug} pickers={pickers} />
                </CardBody>
              </Card>
            ) : null}
          </div>
        ) : null}

        {active === 'bills' ? (
          <div className="space-y-5">
            {open.length ? (
              <Card className="border-warning/40">
                <CardHeader
                  title="Waiting for the committee"
                  description={
                    !isCommittee
                      ? 'Correct or re-upload a bill while it is pending or sent back.'
                      : alone
                        ? 'Approving shows a bill to residents. As the only committee member, you approve your own bills too.'
                        : 'Approving shows a bill to residents. You can’t approve a bill you uploaded or revised.'
                  }
                />
                <ul className="divide-border-base divide-y">
                  {open.map((expense) => (
                    <li key={expense.id} className="space-y-3 px-5 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-ink text-sm font-semibold">
                            {expense.name} · {formatMoney(expense.amount, community.currency)}
                          </p>
                          <p className="text-ink-subtle mt-0.5 text-xs">
                            {[expense.category, expense.vendor, formatDate(expense.spent_on)]
                              .filter(Boolean)
                              .join(' · ')}
                            {expense.requester?.profiles?.full_name
                              ? ` · uploaded by ${expense.requester.profiles.full_name}`
                              : ''}
                          </p>
                          {/* Who wrote the version on the table, which is who
                              may not be the one to approve it. */}
                          {expense.revised_at ? (
                            <p className="text-warning mt-1 text-xs">
                              Revised
                              {expense.reviser?.profiles?.full_name
                                ? ` by ${expense.reviser.profiles.full_name}`
                                : ''}{' '}
                              on {formatDate(expense.revised_at.slice(0, 10))}. Needs approving
                              again.
                            </p>
                          ) : null}
                          {expense.review_note ? (
                            <p className="text-info mt-1 text-xs">
                              Committee: {expense.review_note}
                            </p>
                          ) : null}
                          <BillLink url={expense.bill_url} />
                        </div>
                        <ExpenseStatusBadge status={expense.status} />
                      </div>
                      {isCommittee && expense.status === 'pending' ? (
                        <ReviewExpenseForm
                          slug={slug}
                          eventSlug={event.slug}
                          expenseId={expense.id}
                          // Whoever wrote the version on the table. Once a bill
                          // has been revised that is the reviser, not the
                          // original uploader — otherwise a committee of two
                          // could not approve anything either of them touched.
                          mayApprove={
                            alone || (expense.revised_by ?? expense.requested_by) !== membership.id
                          }
                        />
                      ) : null}
                      {!closed ? (
                        <details className="group">
                          <summary className="text-accent cursor-pointer text-sm">
                            Correct or re-upload
                          </summary>
                          <div className="mt-3">
                            <ExpenseForm
                              slug={slug}
                              eventSlug={event.slug}
                              communityId={community.id}
                              eventId={event.id}
                              expense={{
                                id: expense.id,
                                name: expense.name,
                                category: expense.category,
                                category_id: expense.category_id,
                                amount: Number(expense.amount),
                                vendor: expense.vendor,
                                vendor_id: expense.vendor_id,
                                paid_by: expense.paid_by,
                                method: expense.method,
                                bill_url: expense.bill_url,
                                spent_on: expense.spent_on,
                              }}
                              pickers={pickers}
                              today={today}
                            />
                          </div>
                        </details>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}

            <Card>
              <CardHeader title={`Decided (${decided.length})`} />
              {decided.length ? (
                <ul className="divide-border-base divide-y">
                  {decided.map((expense) => (
                    <li key={expense.id} className="space-y-3 px-5 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-ink text-sm font-medium">{expense.name}</p>
                          <p className="text-ink-subtle text-xs">
                            {[expense.category, expense.vendor].filter(Boolean).join(' · ')}
                            {expense.approver?.profiles?.full_name
                              ? ` · approved by ${expense.approver.profiles.full_name}`
                              : ''}
                          </p>
                          <BillLink url={expense.bill_url} />
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <span className="text-ink text-sm font-semibold">
                            {formatMoney(expense.amount, community.currency)}
                          </span>
                          <ExpenseStatusBadge status={expense.status} />
                        </div>
                      </div>
                      {/* A wrong figure on an approved bill used to have no
                          way out but a second bill cancelling the first. The
                          revision goes back for approval on its own — the
                          database resets it whatever this form sends — and the
                          copy residents already saw is kept, because a
                          revision should be answerable to it. */}
                      {isCommittee && !closed ? (
                        <details className="group">
                          <summary className="text-accent cursor-pointer text-sm">
                            Upload a revised bill
                          </summary>
                          <div className="mt-3">
                            <ExpenseForm
                              slug={slug}
                              eventSlug={event.slug}
                              communityId={community.id}
                              eventId={event.id}
                              expense={{
                                id: expense.id,
                                name: expense.name,
                                category: expense.category,
                                category_id: expense.category_id,
                                amount: Number(expense.amount),
                                vendor: expense.vendor,
                                vendor_id: expense.vendor_id,
                                paid_by: expense.paid_by,
                                method: expense.method,
                                bill_url: expense.bill_url,
                                spent_on: expense.spent_on,
                              }}
                              pickers={pickers}
                              today={today}
                            />
                          </div>
                        </details>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  icon={<Receipt className="size-6" />}
                  title="No decided bills yet"
                  description="Approved bills appear in every resident’s spending list."
                />
              )}
            </Card>

            {!closed ? (
              <Card>
                <CardHeader title="Upload a bill" />
                <CardBody>
                  <ExpenseForm
                    slug={slug}
                    eventSlug={event.slug}
                    communityId={community.id}
                    eventId={event.id}
                    pickers={pickers}
                    today={today}
                  />
                </CardBody>
              </Card>
            ) : null}
          </div>
        ) : null}

        {active === 'payments' ? (
          <div className="space-y-5">
            <StatTiles>
              <StatTile
                label="Collected"
                value={formatMoney(stats.fundRaised, community.currency)}
              />
              <StatTile label="Confirmed payments" value={String(confirmedPayments.length)} />
              <StatTile label="Flats paid" value={String(flatsPaid)} />
            </StatTiles>
            {waitingPayments.length ? (
              <Card>
                <CardHeader
                  title={`Waiting for confirmation (${waitingPayments.length})`}
                  description={
                    isCommittee
                      ? 'Check each UPI transaction ID against the bank statement. Only confirmed payments count. Correct the amount if the bank shows a different one.'
                      : 'Check each UPI transaction ID against the bank statement. Only confirmed payments count.'
                  }
                />
                <ul className="divide-border-base divide-y">
                  {waitingPayments.map((payment) => (
                    <li key={payment.id} className="space-y-3 px-5 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-ink text-sm font-semibold">
                            {unitLabel(payment.units) || 'No flat'} ·{' '}
                            {formatMoney(payment.amount, community.currency)}
                          </p>
                          <p className="text-ink-subtle mt-0.5 text-xs">
                            {[
                              payment.memberships?.profiles?.full_name,
                              payment.method.toUpperCase(),
                              formatDate(payment.paid_at.slice(0, 10)),
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                          <p className="text-ink mt-1 font-mono text-xs">
                            UPI transaction ID {payment.reference ?? '—'}
                          </p>
                          {upiCaptureNote(payment.gateway_payload) ? (
                            <p className="text-ink-muted mt-1 text-xs">
                              {upiCaptureNote(payment.gateway_payload)}
                            </p>
                          ) : null}
                          <StoredFileLink
                            bucket="payment-proofs"
                            path={payment.proof_path}
                            label="View screenshot"
                          />
                        </div>
                        <Badge tone="warning">Waiting</Badge>
                      </div>
                      {/* Reporting a payment and confirming it in the next tap
                          is the fund bar moving on nobody's word but yours.
                          The database refuses it; saying so here saves the
                          round trip. */}
                      {payment.membership_id === membership.id && !alone ? (
                        <p className="border-border-base text-ink-muted rounded-lg border border-dashed px-4 py-3 text-sm">
                          This is your own payment. Another committee member confirms it.
                        </p>
                      ) : (
                        <ReviewPaymentForm
                          slug={slug}
                          eventSlug={event.slug}
                          contributionId={payment.id}
                          showReferenceField={!payment.reference}
                          reportedAmount={Number(payment.amount)}
                          currency={community.currency}
                          mayCorrect={isCommittee}
                        />
                      )}
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}
            {event.status === 'published' && can(role, 'payments:record') ? (
              <Card>
                <CardHeader
                  title="Record a payment"
                  description="Cash, UPI to the society account or a cheque, collected from a flat."
                />
                <CardBody>
                  <RecordPaymentForm
                    slug={slug}
                    eventSlug={event.slug}
                    communityId={community.id}
                    membershipId={membership.id}
                    units={(units.data ?? []).map((unit) => ({
                      id: unit.id,
                      label: unitLabel(unit),
                    }))}
                  />
                </CardBody>
              </Card>
            ) : null}
            <Card>
              <CardHeader
                title="Who paid"
                description="Every payment for this event, newest first."
              />
              {payments.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-border-base text-ink-subtle border-b text-left text-xs tracking-wide uppercase">
                        <th scope="col" className="px-5 py-2.5 font-medium">
                          Flat
                        </th>
                        <th scope="col" className="px-5 py-2.5 font-medium">
                          Paid by
                        </th>
                        <th scope="col" className="px-5 py-2.5 text-right font-medium">
                          Amount
                        </th>
                        <th scope="col" className="px-5 py-2.5 font-medium">
                          Method
                        </th>
                        <th scope="col" className="px-5 py-2.5 font-medium">
                          Reference
                        </th>
                        {/* Reconciliation happens later, when the bank
                            statement arrives — long after the confirming tap.
                            The evidence has to outlive the decision, so the
                            screenshot sits beside the amount and the
                            transaction ID for every flat, not only the ones
                            still waiting. */}
                        <th scope="col" className="px-5 py-2.5 font-medium">
                          Screenshot
                        </th>
                        <th scope="col" className="px-5 py-2.5 font-medium">
                          Date
                        </th>
                        <th scope="col" className="px-5 py-2.5 font-medium">
                          Status
                        </th>
                        {/* The four questions an audit asks, in one column:
                            who accepted this money, when, and whether anybody
                            has touched the row since. */}
                        <th scope="col" className="px-5 py-2.5 font-medium">
                          Trail
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-border-base divide-y">
                      {payments.map((payment) => (
                        <tr key={payment.id}>
                          <td className="text-ink px-5 py-3 font-medium">
                            {unitLabel(payment.units)}
                          </td>
                          <td className="text-ink-muted px-5 py-3">
                            {payment.memberships?.profiles?.full_name ?? (
                              <Badge tone="neutral">Recorded by staff</Badge>
                            )}
                          </td>
                          <td className="text-ink px-5 py-3 text-right font-medium">
                            {formatMoney(payment.amount, community.currency)}
                            {/* The figure the flat reported, when it is not the
                                figure the books kept. A number that moved with
                                no trace of the move is the thing this app
                                exists to replace. */}
                            {payment.reported_amount != null ? (
                              <span className="text-ink-subtle block text-xs font-normal">
                                was {formatMoney(payment.reported_amount, community.currency)}
                              </span>
                            ) : null}
                          </td>
                          <td className="text-ink-muted px-5 py-3 uppercase">{payment.method}</td>
                          <td className="text-ink-subtle px-5 py-3 font-mono text-xs">
                            {payment.reference ?? receiptRef(event.slug, payment.receipt_no)}
                          </td>
                          <td className="text-ink-subtle px-5 py-3 text-xs">
                            {payment.proof_path ? (
                              <StoredFileLink
                                bucket="payment-proofs"
                                path={payment.proof_path}
                                label="View"
                                compact
                              />
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="text-ink-subtle px-5 py-3 text-xs">
                            {formatDate(payment.paid_at.slice(0, 10))}
                          </td>
                          <td className="px-5 py-3">
                            <PaymentStatusBadge status={payment.status} />
                            {payment.status === 'failed' && payment.review_note ? (
                              <p className="text-ink-subtle mt-1 text-xs">{payment.review_note}</p>
                            ) : null}
                          </td>
                          <td className="text-ink-subtle px-5 py-3 text-xs">
                            <AuditTrail
                              confirmedBy={payment.verifier?.profiles?.full_name}
                              confirmedAt={payment.verified_at}
                              editedBy={payment.editor?.profiles?.full_name}
                              editedAt={payment.updated_at}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  icon={<Wallet className="size-6" />}
                  title="No payments yet"
                  description="Payments made in the app and recorded by staff appear here."
                />
              )}
            </Card>
          </div>
        ) : null}

        {active === 'close' ? (
          closed ? (
            // Residents' money the event did not spend. Asked after closing
            // rather than inside it, so the decision is not something somebody
            // clicks past on the way to the confirmation box.
            stats.available > 0 && isCommittee ? (
              <AllocateSurplusForm
                slug={slug}
                eventSlug={event.slug}
                surplus={stats.available}
                currency={community.currency}
                openEvents={openEvents}
                nextEdition={nextEditionName(event.name, event.starts_on)}
              />
            ) : (
              <Card>
                <EmptyState
                  icon={<FileText className="size-6" />}
                  title="This event is closed"
                  description={
                    stats.available > 0
                      ? `${formatMoney(stats.available, community.currency)} is left over. The committee decides where it goes.`
                      : 'Its accounts are published and the ledger is frozen.'
                  }
                />
              </Card>
            )
          ) : (
            <CloseEventForm
              slug={slug}
              eventSlug={event.slug}
              eventName={event.name}
              openBills={open.length}
            />
          )
        ) : null}
      </PageBody>
    </>
  );
}
