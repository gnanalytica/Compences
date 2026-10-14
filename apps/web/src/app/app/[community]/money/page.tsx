import Link from 'next/link';
import { PiggyBank, Scale, Wallet } from 'lucide-react';
import {
  LEDGER_FILTERS,
  SOCIETY_BALANCE_LEDGER,
  UNPUBLISHED_EVENT,
  can,
  filterLedger,
  formatDate,
  formatMoney,
  fundMovementLine,
  holdingNote,
  ledgerFilterFrom,
  ledgerScopes,
  ledgerTotals,
  relativeTime,
  todayIn,
  whereTheBalanceIs,
} from '@compences/core';
import { requireCommunity } from '@/lib/auth';
import { getFundMovements, getSocietyBalance } from '@/lib/events';
import { getSupabase } from '@/lib/supabase/server';
import { rowsOf } from '@/lib/rows';
import { PageBody, PageHeader } from '@/components/page-header';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { RollingAmount } from '@/components/rolling-amount';
import { LedgerRow } from '@/components/ledger-row';
import { StoredFileLink } from '@/components/bill-link';
import { cn } from '@/lib/utils';
import { MyContributions } from './my-contributions';
import { SocietyExpenseForm } from './money-forms';

export const metadata = { title: 'Money' };

/**
 * The society's money, all of it, for everybody.
 *
 * A resident could already see where the money went for the event they happened
 * to be looking at, and nowhere could they see the whole thing: what came in
 * last Deepavali, what it was spent on, what is left, and what the year before
 * looked like. The history existed and was unreachable, which for a
 * transparency ledger is close to not existing.
 *
 * Money in names the payer, their flat and how they paid; money out names the
 * vendor — the line society_ledger draws and explains. Payments nobody has
 * confirmed are not here: a ledger of claims is what this replaces.
 *
 * Every row carries its evidence where there is any to carry: the bill behind
 * a payment out, which every member may open, and the screenshot behind a
 * payment in, which the view hands only to the payer and to staff.
 */
export default async function MoneyPage(props: PageProps<'/app/[community]/money'>) {
  const { community: slug } = await props.params;
  const { show, event, view } = await props.searchParams;
  const { community, role, membership } = await requireCommunity(slug);
  // Staff don't contribute, so they have nothing of their own to show.
  const hasOwn = can(role, 'contribute');
  const mine = hasOwn && view === 'mine';
  const views = hasOwn ? <MoneyViews slug={slug} mine={mine} /> : null;

  if (mine) {
    return (
      <>
        <PageHeader title="Money" description="Your payments, and where each one stands." />
        <PageBody>
          {views}
          <MyContributions slug={slug} membershipId={membership.id} currency={community.currency} />
        </PageBody>
      </>
    );
  }

  const supabase = await getSupabase();

  const [ledger, totals, society, movements, eventStats, eventNames] = await Promise.all([
    supabase
      .from('society_ledger')
      .select(
        'id, kind, direction, happened_at, amount, counterpart, detail, payer_name, unit_label, method, receipt_no, document_url, confirmed_by, confirmed_at, event_id, event_slug, event_name',
      )
      .eq('community_id', community.id)
      .order('happened_at', { ascending: false })
      .limit(500),
    supabase.from('society_money').select('*').eq('community_id', community.id).maybeSingle(),
    getSocietyBalance(community.id),
    getFundMovements(community.id),
    // Every event, drafts included: event_stats answers for any member. The
    // names come from events, which leaves drafts out for a resident — hence
    // UNPUBLISHED_EVENT rather than a row that silently goes missing.
    supabase
      .from('event_stats')
      .select(
        'event_id, available, fund_carried, fund_carried_in, fund_raised, spent, fund_moved_out',
      )
      .eq('community_id', community.id),
    supabase
      .from('events')
      .select('id, name, emoji, slug, status')
      .eq('community_id', community.id)
      .limit(500),
  ]);

  const rows = rowsOf(ledger, 'the society ledger');
  const filter = ledgerFilterFrom(show);
  const eventFilter = typeof event === 'string' ? event : '';
  const visible = filterLedger(rows, filter, eventFilter);

  // Built from the ledger rather than from events, so the filter only ever
  // offers a year that has something in it — and the society balance, once it
  // has rows of its own.
  const scopes = ledgerScopes(rows);
  const scope = scopes.find((option) => option.value === eventFilter);
  // One event's ledger, or the society balance's, adds up to what it holds:
  // say so under the list, so nobody has to add it up to check. An event's
  // figures come from its own numbers rather than the rows on screen, which
  // stop at the newest 500; the society balance's rows are few.
  const totalsFor = (value: string) => {
    if (value === SOCIETY_BALANCE_LEDGER) return ledgerTotals(visible);
    const id = (eventNames.data ?? []).find((row) => row.slug === value)?.id;
    const stats = (eventStats.data ?? []).find((row) => row.event_id === id);
    if (!stats) return ledgerTotals(visible);
    return {
      in: Number(stats.fund_raised ?? 0) + Number(stats.fund_carried_in ?? 0),
      out: Number(stats.spent ?? 0) + Number(stats.fund_moved_out ?? 0),
      left: Number(stats.available ?? 0),
    };
  };
  const scopeTotals = !scope || filter !== 'all' ? null : totalsFor(eventFilter);

  const balance = Number(totals.data?.balance ?? 0);
  const holdings = whereTheBalanceIs(
    rowsOf(eventStats, 'what each event holds'),
    rowsOf(eventNames, 'event names for the money page'),
  );
  // A split that is missing a row is worse than no split: it would not add up
  // to the balance above it, and adding up is the only thing it is for.
  const splitReadable = !eventStats.error && !eventNames.error;

  return (
    <>
      <PageHeader
        title="Money"
        description={`Every rupee ${community.name} has taken in and spent.`}
      />
      <PageBody>
        {views}
        {/* The one number everybody asks the committee for, as large as the
            page allows, with what came in and went out beneath it. */}
        <Card className="rise-in px-5 py-5">
          <p className="text-gold text-[11px] font-semibold tracking-[0.14em] uppercase">Balance</p>
          <RollingAmount
            value={balance}
            currency={community.currency}
            className={cn(
              'mt-2 font-serif text-4xl leading-none font-medium tracking-tight md:text-5xl',
              balance < 0 ? 'text-danger' : 'text-ink',
            )}
          />
          <dl className="text-ink-muted mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <div className="flex gap-1.5">
              <dt>Collected</dt>
              <dd className="text-ink font-medium">
                {formatMoney(Number(totals.data?.total_in ?? 0), community.currency)}
              </dd>
            </div>
            <div className="flex gap-1.5">
              <dt>Spent</dt>
              <dd className="text-ink font-medium">
                {formatMoney(Number(totals.data?.total_out ?? 0), community.currency)}
              </dd>
            </div>
          </dl>
        </Card>

        {/* Where the balance is: each event still holding money, and what the
            society kept outside any event, adding up to the Balance tile. It
            answers the question the tiles raise the moment money has been
            carried across. A committee member carried ₹6,990 from one event
            to another and then read "Balance ₹7,820" over "Society balance
            ₹0" with nothing to say where the other ₹830 was; both figures
            were right and the page made them look like a contradiction. The
            home screen links here. */}
        {splitReadable && (holdings.length || society.balance !== 0 || movements.length) ? (
          <Card className="mt-5 scroll-mt-20" id="society-balance">
            <CardHeader title={`Where the ${formatMoney(balance, community.currency)} is`} />
            <ul className="divide-border-base divide-y">
              {holdings.map((holding) => {
                const note = holdingNote(holding, community.currency);
                return (
                  <li
                    key={holding.eventId}
                    className="flex items-start justify-between gap-3 px-5 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-ink text-sm font-medium">
                        {holding.name && holding.slug ? (
                          <Link
                            href={`/app/${slug}/events/${holding.slug}`}
                            className="hover:underline"
                          >
                            {holding.name}
                          </Link>
                        ) : (
                          (holding.name ?? UNPUBLISHED_EVENT)
                        )}
                      </p>
                      {note ? <p className="text-ink-subtle mt-0.5 text-xs">{note}</p> : null}
                    </div>
                    <p
                      className={cn(
                        'shrink-0 text-sm font-semibold tabular-nums',
                        holding.amount < 0 ? 'text-danger' : 'text-ink',
                      )}
                    >
                      {formatMoney(holding.amount, community.currency)}
                    </p>
                  </li>
                );
              })}
              <li className="flex items-start justify-between gap-3 px-5 py-3">
                <div className="flex min-w-0 items-start gap-2">
                  <PiggyBank className="text-accent mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <div>
                    <p className="text-ink text-sm font-medium">Kept for the society</p>
                    <p className="text-ink-subtle mt-0.5 text-xs">Not behind any event yet</p>
                  </div>
                </div>
                <p className="text-ink shrink-0 text-sm font-semibold tabular-nums">
                  {formatMoney(society.balance, community.currency)}
                </p>
              </li>
              <li className="bg-surface-sunken flex justify-between gap-3 px-5 py-3 text-sm font-semibold">
                <span className="text-ink">Balance</span>
                <span className="text-ink tabular-nums">
                  {formatMoney(balance, community.currency)}
                </span>
              </li>
            </ul>
          </Card>
        ) : null}

        {/* Where the money left in a closed event went — kept for the society,
            or straight behind another event. The home screen used to link
            here for the society's own pot; the split above is that figure's
            home now, and this is the history of how it got there. */}
        {movements.length ? (
          <Card className="mt-5">
            <CardHeader
              title="Where money has moved"
              description="What the committee did with money left over from closed events, and who the society paid back."
            />
            <ul className="divide-border-base divide-y">
              {movements.map((movement) => (
                <li key={movement.id} className="px-5 py-3">
                  <p className="text-ink text-sm">
                    {fundMovementLine(movement, community.currency)}
                  </p>
                  <p className="text-ink-subtle mt-0.5 text-xs">
                    {movement.decided_at ? formatDate(movement.decided_at.slice(0, 10)) : ''}
                    {movement.decider?.profiles?.full_name
                      ? ` · decided by ${movement.decider.profiles.full_name}`
                      : ''}
                    {movement.note ? ` · ${movement.note}` : ''}
                  </p>
                  {/* A pay-back carries the screenshot of the transfer, for
                      every resident: they should know people get paid back. */}
                  {movement.proof_path ? (
                    <StoredFileLink
                      bucket="bills"
                      path={movement.proof_path}
                      label="View screenshot"
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        {/* Staff and the committee spend the society's own balance here: a
            repair, damage, anything that is not an event's. The receipt is
            required and every resident sees the entry in the list below. */}
        {can(role, 'expenses:submit') ? (
          <Card className="mt-5" id="spend-society">
            <CardHeader
              title="Spend from the society balance"
              description="For a repair, damage or anything that is not an event's."
            />
            <CardBody>
              <SocietyExpenseForm
                slug={slug}
                communityId={community.id}
                balance={society.balance}
                currency={community.currency}
                today={todayIn(community.timezone)}
              />
            </CardBody>
          </Card>
        ) : null}

        <Card className="mt-5">
          <CardHeader
            title="Every transaction"
            description="Confirmed payments in; approved bills and the society's own spending out. A payment appears once staff confirm it. Pick an event to see the money the committee moved in or out of it too."
          />
          <CardBody className="border-border-base border-b">
            {/* A GET form, so a filtered ledger is a link somebody can send to
                a neighbour who is asking where the money went. */}
            <form method="get" className="flex flex-wrap items-end gap-2">
              <div>
                <label htmlFor="show" className="text-ink-subtle mb-1 block text-xs font-medium">
                  Showing
                </label>
                <select
                  id="show"
                  name="show"
                  defaultValue={filter}
                  className="border-border-base bg-surface-raised text-ink rounded-lg border px-3 py-2 pr-8 text-base sm:text-sm"
                >
                  {LEDGER_FILTERS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              {scopes.length ? (
                <div>
                  <label htmlFor="event" className="text-ink-subtle mb-1 block text-xs font-medium">
                    Event
                  </label>
                  <select
                    id="event"
                    name="event"
                    defaultValue={eventFilter}
                    className="border-border-base bg-surface-raised text-ink rounded-lg border px-3 py-2 pr-8 text-base sm:text-sm"
                  >
                    <option value="">Every event</option>
                    {scopes.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              <button
                type="submit"
                className="border-border-base bg-surface-raised text-ink hover:bg-surface-sunken rounded-lg border px-4 py-2 text-sm font-medium"
              >
                Apply
              </button>
            </form>
          </CardBody>

          {visible.length ? (
            <ul className="divide-border-base divide-y">
              {visible.map((row) => (
                <LedgerRow key={row.id} row={row} slug={slug} currency={community.currency} />
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={<Wallet className="size-6" />}
              title={rows.length ? 'Nothing matches that' : 'Nothing has moved yet'}
              description={
                rows.length
                  ? 'Try a different filter.'
                  : 'Confirmed payments and approved bills appear here.'
              }
            />
          )}
          {scope && scopeTotals && visible.length ? (
            <div className="border-border-base bg-surface-sunken space-y-1 border-t px-5 py-3 text-sm">
              <div className="text-ink-muted flex justify-between gap-3">
                <span>Money in</span>
                <span className="tabular-nums">
                  +{formatMoney(scopeTotals.in, community.currency)}
                </span>
              </div>
              <div className="text-ink-muted flex justify-between gap-3">
                <span>Money out</span>
                <span className="tabular-nums">
                  −{formatMoney(scopeTotals.out, community.currency)}
                </span>
              </div>
              <div className="text-ink flex justify-between gap-3 font-semibold">
                <span>
                  {eventFilter === SOCIETY_BALANCE_LEDGER
                    ? 'Kept for the society'
                    : `Left in ${scope.label}`}
                </span>
                <span
                  className={cn('tabular-nums', scopeTotals.left < 0 ? 'text-danger' : undefined)}
                >
                  {formatMoney(scopeTotals.left, community.currency)}
                </span>
              </div>
            </div>
          ) : null}
        </Card>

        <p className="text-ink-subtle mt-4 flex items-start gap-2 text-xs">
          <Scale className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>
            Money in shows who paid, their flat and how they paid. Money out shows the vendor and
            who approved it, with the bill for anyone to open. A payment screenshot opens only for
            the payer and staff. Phone numbers and emails stay on the People page, for staff and the
            committee only.{' '}
            {totals.data?.last_movement_at ? (
              <>Last movement {relativeTime(totals.data.last_movement_at)}.</>
            ) : null}
          </span>
        </p>

        {rows.length >= 500 ? (
          <p className="text-ink-subtle mt-2 text-xs">
            <Badge tone="neutral">Showing the most recent 500</Badge>
          </p>
        ) : null}
      </PageBody>
    </>
  );
}

/** The society's money and the member's own, as two views of one page. */
function MoneyViews({ slug, mine }: { slug: string; mine: boolean }) {
  const tab = (active: boolean) =>
    cn(
      'flex-1 rounded-[10px] px-4 py-2 text-center whitespace-nowrap transition-colors sm:flex-none',
      active
        ? 'bg-surface-raised text-ink shadow-card font-medium'
        : 'text-ink-muted hover:text-ink',
    );
  return (
    <nav
      aria-label="Whose money"
      className="bg-surface-sunken mb-5 flex w-full gap-1 rounded-xl p-1 text-sm sm:w-fit"
    >
      <Link
        href={`/app/${slug}/money`}
        aria-current={mine ? undefined : 'page'}
        className={tab(!mine)}
      >
        Society
      </Link>
      <Link
        href={`/app/${slug}/money?view=mine`}
        aria-current={mine ? 'page' : undefined}
        className={tab(mine)}
      >
        My contributions
      </Link>
    </nav>
  );
}
