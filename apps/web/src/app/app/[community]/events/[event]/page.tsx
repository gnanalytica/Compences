import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRightLeft,
  CalendarDays,
  Check,
  Clock,
  MapPin,
  Receipt,
  Settings2,
  Sparkles,
  Tag,
  Users,
  Wallet,
} from 'lucide-react';
import {
  COPY,
  can,
  correctionNote,
  countdown,
  eventMoney,
  formatDate,
  festivalFor,
  formatMoney,
  fundBarSegments,
  inTheFund,
  movedOnSummary,
  practiceDatesLine,
  receiptRef,
} from '@compences/core';
import { requireCommunity } from '@/lib/auth';
import {
  getActivities,
  getBudgetLines,
  getCarriedInto,
  getEventStats,
  getExpenses,
  getMovedFrom,
  getMyParticipation,
  getRegistrations,
  getSuggestions,
  requireEvent,
} from '@/lib/events';
import { getCatalogue } from '@/lib/catalogue';
import { PageBody } from '@/components/page-header';
import { FestivalHero, festivalVars } from '@/components/festival';
import { RollingAmount } from '@/components/rolling-amount';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { ButtonLink } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import {
  EventStatusBadge,
  ExpenseStatusBadge,
  FundBar,
  FundKey,
  PaymentStatusBadge,
  SpendBar,
  SpendKey,
} from '@/components/badges';
import { EventBalanceCard, EventMoneyTiles } from '@/components/event-balance';
import { getSupabase } from '@/lib/supabase/server';
import { BillLink, StoredFileLink } from '@/components/bill-link';
import { BudgetBars } from '@/components/budget-bars';
import { CarriedIn } from '@/components/carried-in';
import { AuditTrail } from '@/components/audit-trail';
import { SuggestionBoard } from '@/components/suggestion-board';
import { CommentThread } from '@/components/comment-thread';
import { WhatsappGroupLink } from '@/components/whatsapp-group-link';
import { eventTabsFor } from '@/components/event-tabs';
import { SectionBar } from '@/components/section-bar';
import { cancelRegistration } from '../actions';
import { SocietySuggestionForm } from '../../suggest/suggest-form';
import { RegisterForm, SuggestionForm } from './participation-forms';

/**
 * An event on one page, read top to bottom: what it is, its money (the fund,
 * budget against spending and every approved bill), activities to register
 * for, ideas to vote on, and the discussion. A bar pinned above them jumps
 * between the sections and shows which one is being read.
 */
export default async function EventDetailPage(props: PageProps<'/app/[community]/events/[event]'>) {
  const { community: slug, event: eventSlug } = await props.params;
  // Committee in resident view sees exactly what residents see.
  const { community, viewRole: role, membership } = await requireCommunity(slug);
  const event = await requireEvent(community.id, eventSlug);

  const supabase = await getSupabase();
  const [
    stats,
    budget,
    expenses,
    activities,
    registrations,
    suggestions,
    mine,
    myPayments,
    carriedIn,
    movedFrom,
  ] = await Promise.all([
    getEventStats(event.id),
    getBudgetLines(event.id),
    getExpenses(event.id),
    getActivities(event.id),
    getRegistrations(event.id),
    getSuggestions(event.id, membership.id),
    getMyParticipation(event.id, membership.id),
    supabase
      .from('contributions')
      .select(
        'id, amount, reported_amount, status, method, reference, receipt_no, review_note, paid_at',
      )
      .eq('event_id', event.id)
      .eq('membership_id', membership.id)
      .order('paid_at', { ascending: false }),
    getCarriedInto(event.id),
    getMovedFrom(event.id),
  ]);

  const base = `/app/${community.slug}`;
  const here = `${base}/events/${event.slug}`;
  const bar = fundBarSegments(
    stats.fundRaised,
    stats.fundPending,
    stats.fundTarget,
    stats.fundCarriedIn,
  );
  const funded = bar.confirmed;
  // What the fund holds, carried money included: what every fund card leads
  // with, against the event's target.
  const held = inTheFund(stats.fundRaised, stats.fundCarriedIn);
  // Collected, spent, moved on and left, adding up: the Fund card's tiles and,
  // for staff and the committee, the balance at the top of the page.
  const money = eventMoney(stats);
  const open = event.status === 'published';
  const isCampaign = event.kind === 'campaign';
  const isStaff = can(role, 'events:manage');
  const canApprove = can(role, 'suggestions:approve');
  // The Ideas badge counts what is waiting on *this* person: a vote they have
  // not cast, or — for the committee — a suggestion nobody has opened yet.
  const needsMe = suggestions.filter((s) =>
    s.status === 'accepted' ? s.myVote === null : canApprove && s.status === 'new',
  ).length;
  const approved = expenses.filter((expense) => expense.status === 'approved');
  const awaiting = expenses.filter((expense) => expense.status !== 'approved');
  // Approved bills with no budget line behind them: filed before bills drew on
  // a line, or against a line since removed.
  const unplanned = approved.filter(
    (expense) => !budget.some((line) => line.id === expense.budget_line_id),
  );
  const myRegistrations = registrations.filter((r) => r.membership_id === membership.id);

  // One list, shared with the console, so this page's sections and the
  // organiser's pages cannot drift apart. A campaign has no activities, and a
  // proposal nothing to vote on yet.
  const tabs = eventTabsFor({ role, kind: event.kind, status: event.status });
  const shown = new Set(tabs.filter((t) => !t.admin).map((t) => t.id));
  const sections = [
    ...tabs
      .filter((t) => !t.admin)
      .map((t) => ({ id: t.id, label: t.label, count: t.id === 'vote' ? needsMe : undefined })),
    { id: 'discussion', label: 'Discussion' },
  ];
  const organiserPages = tabs
    .filter((t) => t.admin)
    .map((t) => ({
      label: t.label,
      href: `${base}/admin/events/${event.slug}${t.id === 'overview' ? '' : `?tab=${t.id}`}`,
    }));

  const eventType = event.event_type_id
    ? (await getCatalogue(community.id)).event_type.find((item) => item.id === event.event_type_id)
    : null;
  const canContribute = open && can(role, 'contribute');
  // Deepavali is marigold, Dasara vermilion, a clean-up drive the society's own
  // green. The whole page takes the colour, not just its header.
  const festival = festivalFor(eventType?.label, event.name);

  return (
    <div style={festivalVars(festival)}>
      <FestivalHero
        festival={festival}
        back={
          <Link
            href={`${base}/events`}
            className="inline-flex items-center gap-1.5 hover:text-white"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            All events
          </Link>
        }
        eyebrow={[
          isCampaign
            ? 'Fundraising campaign'
            : festival.kind === 'festival'
              ? 'Festival'
              : festival.kind === 'national'
                ? 'National day'
                : festival.kind === 'occasion'
                  ? festival.label
                  : 'Event',
          formatDate(event.starts_on),
        ].join(' · ')}
        title={event.name}
        meta={[event.venue, countdown(event.starts_on)].filter(Boolean).join(' · ') || null}
        action={
          <>
            <EventStatusBadge status={event.status} />
            {canContribute ? (
              <ButtonLink href={`${here}/contribute`} size="sm" variant="inverse">
                Contribute
              </ButtonLink>
            ) : null}
            {isStaff && event.status !== 'proposed' ? (
              <ButtonLink href={`${base}/admin/events/${event.slug}`} size="sm" variant="glass">
                <Settings2 className="size-4" aria-hidden="true" />
                Manage
              </ButtonLink>
            ) : null}
          </>
        }
      />

      <PageBody>
        {/* Pulled up over the banner's lower edge, then pinned as it scrolls. */}
        <SectionBar sections={sections} links={organiserPages} className="-mt-11 md:-mt-12" />

        {event.status === 'proposed' ? (
          <div className="border-warning/40 bg-warning/10 mb-5 flex items-start gap-3 rounded-2xl border p-4 text-sm">
            <Clock className="text-warning mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <p className="text-ink">
              Waiting for the committee. Once approved, residents can see it and contribute.
            </p>
          </div>
        ) : null}

        <div className="space-y-10">
          {/* ---------------------------------------------------------- about */}
          <section id="about" aria-label="About" className={SECTION}>
            {/* Staff and the committee see what is left before anything else,
                so nobody commits to a bill the event cannot pay. */}
            {isStaff && event.status !== 'proposed' ? (
              <EventBalanceCard
                money={money}
                currency={community.currency}
                todoHref={can(role, 'expenses:approve') ? `${base}/todo#overspent` : undefined}
              />
            ) : null}
            <Card>
              <CardBody className="space-y-4">
                {event.description ? (
                  <p className="text-ink max-w-2xl text-sm leading-relaxed whitespace-pre-line">
                    {event.description}
                  </p>
                ) : null}
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  <div className="flex items-start gap-2.5">
                    <CalendarDays className="text-ink-subtle mt-0.5 size-4" aria-hidden="true" />
                    <div>
                      <dt className="sr-only">Date</dt>
                      <dd className="text-ink">
                        {formatDate(event.starts_on)}
                        {event.ends_on && event.ends_on !== event.starts_on
                          ? ` to ${formatDate(event.ends_on)}`
                          : ''}
                      </dd>
                      {countdown(event.starts_on) ? (
                        <dd className="text-ink-subtle text-xs">{countdown(event.starts_on)}</dd>
                      ) : null}
                    </div>
                  </div>
                  {event.venue ? (
                    <div className="flex items-start gap-2.5">
                      <MapPin className="text-ink-subtle mt-0.5 size-4" aria-hidden="true" />
                      <div>
                        <dt className="sr-only">Venue</dt>
                        <dd className="text-ink">{event.venue}</dd>
                      </div>
                    </div>
                  ) : null}
                  {eventType || isCampaign ? (
                    <div className="flex items-start gap-2.5">
                      <Tag className="text-ink-subtle mt-0.5 size-4" aria-hidden="true" />
                      <div>
                        <dt className="sr-only">Type</dt>
                        <dd className="text-ink">
                          {isCampaign ? 'Fundraising campaign' : eventType?.label}
                        </dd>
                      </div>
                    </div>
                  ) : null}
                  {event.organizer ? (
                    <div className="flex items-start gap-2.5">
                      <Users className="text-ink-subtle mt-0.5 size-4" aria-hidden="true" />
                      <div>
                        {/* The label lives in the dt like every other row here. It
                            used to be repeated in the value too, which a screen
                            reader read back as "Organised by Organised by …". */}
                        <dt className="sr-only">Organised by</dt>
                        <dd className="text-ink">{event.organizer}</dd>
                      </div>
                    </div>
                  ) : null}
                </dl>
              </CardBody>
            </Card>

            {event.whatsapp_group_url ? (
              <Card>
                <CardBody className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-ink text-sm font-medium">This event has a WhatsApp group</p>
                  </div>
                  <WhatsappGroupLink url={event.whatsapp_group_url} />
                </CardBody>
              </Card>
            ) : null}
          </section>

          {/* ---------------------------------------------------------- money */}
          <section id="money" aria-labelledby="money-heading" className={SECTION}>
            <h2 id="money-heading" className={HEADING}>
              {COPY.money}
            </h2>
            <Card>
              <CardHeader
                title={isCampaign ? 'Campaign fund' : 'Fund'}
                action={<span className="text-success text-sm font-semibold">{funded}%</span>}
              />
              <CardBody>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <RollingAmount
                      value={held}
                      currency={community.currency}
                      className="text-ink font-serif text-[30px] leading-tight font-medium tracking-tight"
                    />
                    <p className="text-ink-muted text-sm">
                      of {formatMoney(stats.fundTarget, community.currency)} · {stats.contributors}{' '}
                      {stats.contributors === 1 ? 'household' : COPY.households.toLowerCase()} gave
                    </p>
                  </div>
                  {canContribute ? (
                    <ButtonLink href={`${here}/contribute`} size="sm">
                      Contribute
                    </ButtonLink>
                  ) : mine.contributed > 0 ? (
                    <Badge tone="success">
                      You gave {formatMoney(mine.contributed, community.currency)}
                    </Badge>
                  ) : null}
                </div>
                <div className="mt-3">
                  <FundBar percent={funded} pendingPercent={bar.pending} />
                </div>
                <FundKey
                  confirmed={held}
                  pending={stats.fundPending}
                  currency={community.currency}
                  className="mt-2"
                />
                {/* Money the committee carried in: a row each, with who moved it. */}
                <CarriedIn movements={carriedIn} currency={community.currency} />
                {/* What the approved bills have used of it, in its own colour,
                    then what was handed on when the event closed. */}
                <div className="mt-4">
                  <SpendBar
                    percent={money.spentPercent}
                    movedPercent={money.movedPercent}
                    over={money.overBy > 0}
                  />
                </div>
                <SpendKey
                  spent={money.spent}
                  movedOut={money.movedOut}
                  balance={money.balance}
                  currency={community.currency}
                  className="mt-2"
                />
                <EventMoneyTiles
                  money={money}
                  currency={community.currency}
                  movedTo={movedFrom.length ? movedOnSummary(movedFrom) : undefined}
                  className="mt-4 gap-2"
                />
              </CardBody>
            </Card>

            {myPayments.data?.length ? (
              <Card>
                <CardHeader title="Your receipts" />
                <ul className="divide-border-base divide-y">
                  {myPayments.data.map((payment) => (
                    <li
                      key={payment.id}
                      className="flex items-start justify-between gap-3 px-5 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-ink text-sm font-medium">
                          {formatMoney(payment.amount, community.currency)}
                        </p>
                        <p className="text-ink-subtle mt-0.5 text-xs">
                          {payment.status === 'succeeded' ? (
                            <span className="font-mono">
                              {receiptRef(event.slug, payment.receipt_no)} ·{' '}
                            </span>
                          ) : payment.reference ? (
                            <span className="font-mono">{payment.reference} · </span>
                          ) : null}
                          {formatDate(payment.paid_at.slice(0, 10))} ·{' '}
                          <span className="uppercase">{payment.method}</span>
                        </p>
                        {payment.status === 'failed' && payment.review_note ? (
                          <p className="text-danger mt-1 text-xs">{payment.review_note}</p>
                        ) : null}
                        {correctionNote(
                          payment.amount,
                          payment.reported_amount,
                          community.currency,
                        ) ? (
                          <p className="text-warning mt-1 text-xs">
                            {correctionNote(
                              payment.amount,
                              payment.reported_amount,
                              community.currency,
                            )}
                            {payment.review_note ? ` · ${payment.review_note}` : ''}
                          </p>
                        ) : null}
                      </div>
                      <PaymentStatusBadge status={payment.status} />
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}

            {!isCampaign ? (
              <Card>
                <CardHeader
                  title="Budget & spending"
                  description="Where the budget goes, how much of it is spent, and the bills behind each part."
                />
                {budget.length || unplanned.length ? (
                  <CardBody>
                    <BudgetBars
                      lines={budget.map(({ id, category, vendor, planned, approved, pending }) => ({
                        id,
                        category,
                        vendor,
                        planned,
                        approved,
                        pending,
                      }))}
                      bills={approved.map((expense) => ({
                        id: expense.id,
                        name: expense.name,
                        amount: expense.amount,
                        status: expense.status,
                        category: expense.category,
                        vendor: expense.vendor,
                        budget_line_id: expense.budget_line_id,
                        spent_on: expense.spent_on,
                      }))}
                      currency={community.currency}
                      billLinks={Object.fromEntries(
                        approved.map((expense) => [
                          expense.id,
                          <StoredFileLink
                            key={expense.id}
                            bucket="bills"
                            path={expense.bill_url}
                            label="View bill"
                            compact
                          />,
                        ]),
                      )}
                    />
                  </CardBody>
                ) : (
                  <EmptyState
                    icon={<Wallet className="size-6" />}
                    title="No budget yet"
                    description="Staff add the vendors and, for each, the services they provide and what is set aside for them."
                  />
                )}
              </Card>
            ) : null}

            <Card>
              <CardHeader title={`Where the money went (${approved.length + movedFrom.length})`} />
              {approved.length || movedFrom.length ? (
                <>
                  <ul className="divide-border-base divide-y">
                    {approved.map((expense) => (
                      <li
                        key={expense.id}
                        className="flex items-start justify-between gap-3 px-5 py-3"
                      >
                        <div className="min-w-0">
                          <p className="text-ink text-sm font-medium">{expense.name}</p>
                          <p className="text-ink-subtle mt-0.5 text-xs">
                            {[
                              expense.category,
                              expense.vendor ?? 'Vendor not recorded',
                              formatDate(expense.spent_on),
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                          {/* Who signed this off and when, on the bill itself,
                              where a resident reading the ledger can see it. */}
                          <p className="text-ink-subtle mt-0.5 text-xs">
                            <AuditTrail
                              confirmedBy={expense.approver?.profiles?.full_name}
                              confirmedAt={expense.approved_at}
                              editedBy={expense.editor?.profiles?.full_name}
                              editedAt={expense.updated_at}
                              confirmedLabel="Approved"
                            />
                          </p>
                          <BillLink url={expense.bill_url} />
                        </div>
                        <span className="text-ink shrink-0 text-sm font-semibold">
                          {formatMoney(expense.amount, community.currency)}
                        </span>
                      </li>
                    ))}
                    {/* What was left when the event closed, and where the
                        committee sent it: the last entries in its ledger, so
                        the money is accounted for down to the last rupee. */}
                    {movedFrom.map((movement) => (
                      <li
                        key={movement.id}
                        className="flex items-start justify-between gap-3 px-5 py-3"
                      >
                        <div className="flex min-w-0 gap-2.5">
                          <ArrowRightLeft
                            className="text-info mt-0.5 size-4 shrink-0"
                            aria-hidden="true"
                          />
                          <div className="min-w-0">
                            <p className="text-ink text-sm font-medium">
                              {movement.kind === 'society_balance' ? (
                                'Kept for the society'
                              ) : movement.to_event?.slug ? (
                                <>
                                  Carried to{' '}
                                  <Link
                                    href={`${base}/events/${movement.to_event.slug}#money`}
                                    className="underline underline-offset-2"
                                  >
                                    {movement.to_event.name}
                                  </Link>
                                </>
                              ) : (
                                `Carried to ${movement.to_event?.name ?? 'another event'}`
                              )}
                            </p>
                            <p className="text-ink-subtle mt-0.5 text-xs">
                              {[
                                movement.decider?.profiles?.full_name
                                  ? `Decided by ${movement.decider.profiles.full_name}`
                                  : null,
                                movement.decided_at
                                  ? formatDate(movement.decided_at.slice(0, 10))
                                  : null,
                                movement.note,
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                          </div>
                        </div>
                        <span className="text-ink shrink-0 text-sm font-semibold">
                          {formatMoney(movement.amount, community.currency)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="border-border-base bg-surface-sunken space-y-1 border-t px-5 py-3 text-sm font-semibold">
                    <div className="flex justify-between">
                      <span className="text-ink">Total spent</span>
                      <span className="text-ink">
                        {formatMoney(stats.spent, community.currency)}
                      </span>
                    </div>
                    {money.movedOut > 0 ? (
                      <div className="flex justify-between">
                        <span className="text-ink">Moved on when it closed</span>
                        <span className="text-ink">
                          {formatMoney(money.movedOut, community.currency)}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </>
              ) : (
                <EmptyState
                  icon={<Receipt className="size-6" />}
                  title="Nothing spent yet"
                  description="Bills the committee approves appear here, for everyone to see."
                />
              )}
            </Card>

            {isStaff && awaiting.length ? (
              <Card>
                <CardHeader title="Waiting for the committee" />
                <ul className="divide-border-base divide-y">
                  {awaiting.map((expense) => (
                    <li
                      key={expense.id}
                      className="flex items-center justify-between gap-3 px-5 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-ink text-sm font-medium">{expense.name}</p>
                        <p className="text-ink-subtle text-xs">
                          {expense.vendor ?? '—'}
                          {expense.review_note ? ` · ${expense.review_note}` : ''}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="text-ink-muted text-sm">
                          {formatMoney(expense.amount, community.currency)}
                        </span>
                        <ExpenseStatusBadge status={expense.status} />
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}
          </section>

          {/* ----------------------------------------------------- activities */}
          {shown.has('activities') ? (
            <section id="activities" aria-labelledby="activities-heading" className={SECTION}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id="activities-heading" className={HEADING}>
                  Activities
                </h2>
                {can(role, 'activities:manage') ? (
                  <ButtonLink
                    href={`${base}/admin/events/${event.slug}?tab=activities`}
                    size="sm"
                    variant="secondary"
                  >
                    <Settings2 className="size-4" aria-hidden="true" />
                    Manage activities
                  </ButtonLink>
                ) : null}
              </div>
              {activities.length ? (
                <div className="space-y-3">
                  {activities.map((activity) => {
                    const mineHere = myRegistrations.filter((r) => r.activity_id === activity.id);
                    const selfRegistered = mineHere.some((r) => !r.participant_name);
                    const count = registrations.filter((r) => r.activity_id === activity.id).length;
                    const full = activity.capacity !== null && count >= activity.capacity;
                    return (
                      <Card key={activity.id}>
                        <CardBody>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-ink text-sm font-semibold">{activity.name}</p>
                              {activity.description ? (
                                <p className="text-ink-muted mt-1 text-sm">
                                  {activity.description}
                                </p>
                              ) : null}
                              <p className="text-ink-subtle mt-1.5 text-xs">
                                {count} registered
                                {activity.capacity ? ` of ${activity.capacity} places` : ''}
                              </p>
                              {activity.memberships?.profiles?.full_name ? (
                                <p className="text-ink-subtle mt-0.5 text-xs">
                                  Coordinator: {activity.memberships.profiles.full_name}
                                </p>
                              ) : null}
                              {activity.practice_dates.length ? (
                                <p className="text-ink-subtle mt-0.5 text-xs">
                                  Practice: {practiceDatesLine(activity.practice_dates)}
                                </p>
                              ) : null}
                            </div>
                            {!activity.is_open ? (
                              <Badge tone="neutral">Closed</Badge>
                            ) : full ? (
                              <Badge tone="neutral">Full</Badge>
                            ) : null}
                          </div>

                          {mineHere.length ? (
                            <ul className="mt-3 space-y-1.5">
                              {mineHere.map((registration) => (
                                <li
                                  key={registration.id}
                                  className="flex items-center justify-between gap-3 text-sm"
                                >
                                  <span className="text-success inline-flex items-center gap-1.5">
                                    <Check className="size-4" aria-hidden="true" />
                                    {registration.participant_name ?? 'You'}
                                  </span>
                                  {open ? (
                                    <form action={cancelRegistration}>
                                      <input type="hidden" name="slug" value={slug} />
                                      <input type="hidden" name="event" value={event.slug} />
                                      <input
                                        type="hidden"
                                        name="registration_id"
                                        value={registration.id}
                                      />
                                      <button
                                        type="submit"
                                        className="text-ink-muted hover:text-ink text-xs underline underline-offset-4"
                                      >
                                        Withdraw
                                      </button>
                                    </form>
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                          ) : null}

                          {open && activity.is_open && !full && can(role, 'activities:register') ? (
                            <div className="border-border-base mt-3 border-t pt-3">
                              <RegisterForm
                                slug={slug}
                                eventSlug={event.slug}
                                activityId={activity.id}
                                activityName={activity.name}
                                selfRegistered={selfRegistered}
                              />
                            </div>
                          ) : null}
                        </CardBody>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <Card>
                  <EmptyState
                    icon={<Sparkles className="size-6" />}
                    title="No activities yet"
                    description="Staff add activities you and your family can register for."
                  />
                </Card>
              )}
            </section>
          ) : null}

          {/* ---------------------------------------------------------- ideas */}
          {shown.has('vote') ? (
            <section id="vote" aria-labelledby="ideas-heading" className={SECTION}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id="ideas-heading" className={HEADING}>
                  Ideas
                </h2>
                {/* Right where somebody lands on the section, not under a long
                    list of things already being voted on. */}
                {can(role, 'suggest') ? (
                  <ButtonLink href="#suggest-idea" size="sm">
                    <Sparkles className="size-4" aria-hidden="true" />
                    Suggest an idea
                  </ButtonLink>
                ) : null}
              </div>
              <SuggestionBoard
                slug={slug}
                eventSlug={event.slug}
                rows={suggestions}
                myMembershipId={membership.id}
                canVote={can(role, 'vote') && event.status !== 'completed'}
                canApprove={canApprove}
                emptyDescription="Suggestions the committee approves go to a vote here."
              />
              {can(role, 'suggest') ? (
                <Card id="suggest-idea" className="scroll-mt-36 md:scroll-mt-16">
                  {open ? (
                    <>
                      <CardHeader
                        title="Suggest an idea"
                        description={`For ${event.name}. The committee reviews it first, then everybody votes.`}
                      />
                      <CardBody>
                        <SuggestionForm slug={slug} eventSlug={event.slug} eventId={event.id} />
                      </CardBody>
                    </>
                  ) : (
                    // An event that is over can still prompt an idea; it goes
                    // to the society's own Ideas, for next time.
                    <>
                      <CardHeader
                        title="Suggest an idea for next time"
                        description={`${event.name} is over, so your idea goes to the society's Ideas. The committee reviews it first, then everybody votes.`}
                      />
                      <CardBody>
                        <SocietySuggestionForm slug={slug} />
                      </CardBody>
                    </>
                  )}
                </Card>
              ) : null}
            </section>
          ) : null}

          {/* ----------------------------------------------------- discussion */}
          <section id="discussion" aria-label="Discussion" className={SECTION}>
            {/* The argument that produced the decision, kept on the same page,
                after everything it was about. */}
            <Card>
              <CardHeader title="Discussion" description="Everyone in the society can read this." />
              <CardBody>
                <CommentThread
                  slug={slug}
                  subject={{ eventId: event.id }}
                  eventSlug={event.slug}
                  myMembershipId={membership.id}
                  canModerate={isStaff}
                />
              </CardBody>
            </Card>
          </section>
        </div>
      </PageBody>
    </div>
  );
}

/**
 * A link from another page (#money) lands a section under the pinned bar: the
 * phone header and the bar, or just the bar on a desktop. The bar's own jumps
 * measure instead.
 */
const SECTION = 'scroll-mt-36 space-y-5 md:scroll-mt-16';
/** Gold small capitals with a hairline, as SectionLabel draws them. */
const HEADING =
  'text-gold flex flex-1 items-center gap-3 text-[11px] font-semibold tracking-[0.14em] uppercase ' +
  'after:h-px after:flex-1 after:bg-gradient-to-r after:from-border-base after:to-transparent';
