import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  LEDGER_FILTERS,
  SOCIETY_BALANCE_LEDGER,
  UNPUBLISHED_EVENT,
  can,
  correctionNote,
  filterLedger,
  formatDate,
  formatMoney,
  myPaymentTotals,
  receiptRef,
  fundMovementLine,
  holdingNote,
  isSocietySpending,
  isTransfer,
  ledgerEvidence,
  ledgerFilterFrom,
  ledgerMeta,
  ledgerFlat,
  ledgerScopes,
  ledgerTitle,
  ledgerTotals,
  relativeTime,
  whereTheBalanceIs,
} from '@compences/core';
import { useAuth } from '../../src/lib/auth';
import { supabase } from '../../src/lib/supabase';
import { useCommunityData } from '../../src/lib/use-community-data';
import { reportHandled } from '../../src/lib/observability';
import {
  Amount,
  Badge,
  Body,
  Button,
  Caption,
  Card,
  EmptyState,
  Heading,
  Loading,
  Screen,
} from '../../src/components/ui';
import { Chip, ChipRow, Segmented } from '../../src/components/admin-ui';
import { StatTile } from '../../src/components/event-ui';
import { ViewFileButton } from '../../src/components/file-ui';
import { minTapTarget, spacing } from '../../src/lib/theme';
import { useTheme } from '../../src/lib/use-theme';

/**
 * The society's money, all of it, for everybody — the web Money page, on a
 * phone.
 *
 * The web app has had this since the ledger landed and the native app had
 * nothing: a resident with only the phone installed could see the money for
 * whichever event they happened to open and never the whole picture. Same two
 * reads, same 500-row bound, and the same filters through the same functions in
 * @compences/core, so the two surfaces cannot drift into disagreeing about what
 * "money in" means.
 *
 * Money in names the payer, their flat and how they paid; money out names the
 * vendor — the line society_ledger draws. Payments nobody has confirmed are not
 * here. Nothing on this screen is a way to contact anybody; RLS decides what
 * comes back, so a resident gets the resident's ledger without this screen
 * deciding anything — including which rows offer their evidence, since the view
 * hands a payment screenshot only to the payer and to staff.
 */
const MONEY_VIEWS = [
  { id: 'society', label: 'Society' },
  { id: 'mine', label: 'My contributions' },
] as const;

/** The society's money and the member's own, as two views of one tab. */
export default function Money() {
  const { role } = useAuth();
  // Staff don't contribute, so they have nothing of their own to show.
  const hasOwn = can(role, 'contribute');
  const [view, setView] = useState<(typeof MONEY_VIEWS)[number]['id']>('society');

  return (
    <Screen>
      {hasOwn ? (
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
          <Segmented options={MONEY_VIEWS} value={view} onChange={setView} />
        </View>
      ) : null}
      {hasOwn && view === 'mine' ? <MyContributions /> : <SocietyMoney />}
    </Screen>
  );
}

/**
 * What this member has paid and where each payment stands. It used to be on
 * Me, away from the rest of the money; somebody checking whether their payment
 * was confirmed now looks where the money is.
 */
function MyContributions() {
  const router = useRouter();
  const { activeCommunity, membershipId } = useAuth();
  const currency = activeCommunity?.currency ?? 'INR';

  const { data, loading, refreshing, refresh } = useCommunityData(
    `money:mine:${membershipId}`,
    async () => {
      const { data: rows } = await supabase
        .from('contributions')
        .select(
          'id, amount, reported_amount, status, reference, review_note, receipt_no, paid_at, events(slug, name, emoji)',
        )
        .eq('membership_id', membershipId ?? '')
        .order('paid_at', { ascending: false })
        .limit(200);
      return rows ?? [];
    },
  );

  if (loading && !data) return <Loading />;

  const rows = data ?? [];
  const totals = myPaymentTotals(rows);

  return (
    <FlatList
      data={rows}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      ListHeaderComponent={
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm }}>
          <StatTile label="CONFIRMED" value={formatMoney(totals.confirmed, currency)} />
          <StatTile label="TO BE CONFIRMED" value={formatMoney(totals.pending, currency)} />
        </View>
      }
      ListEmptyComponent={
        <Card style={{ gap: spacing.md }}>
          <Caption>Nothing yet. Your receipts will show up here.</Caption>
          <Button label="Contribute" onPress={() => router.push('/contribute')} />
        </Card>
      }
      renderItem={({ item: contribution }) => {
        const corrected = correctionNote(
          contribution.amount,
          contribution.reported_amount,
          currency,
        );
        return (
          <Card style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Body>{contribution.events?.name}</Body>
              <Caption>
                {contribution.status === 'succeeded'
                  ? receiptRef(contribution.events?.slug, contribution.receipt_no)
                  : contribution.reference
                    ? `UPI transaction ID ${contribution.reference}`
                    : 'Reported'}{' '}
                · {formatDate(contribution.paid_at.slice(0, 10))}
              </Caption>
              <View style={{ flexDirection: 'row' }}>
                <PaymentStatus status={contribution.status} />
              </View>
              {contribution.status === 'failed' && contribution.review_note ? (
                <Caption>{contribution.review_note}</Caption>
              ) : null}
              {/* A figure that moved with no explanation on the row is the app
                  looking like it lost somebody's money. */}
              {corrected ? (
                <Caption>
                  {corrected}
                  {contribution.review_note ? ` · ${contribution.review_note}` : ''}
                </Caption>
              ) : null}
            </View>
            <Heading>{formatMoney(contribution.amount, currency)}</Heading>
          </Card>
        );
      }}
    />
  );
}

/** Where a member's reported payment stands. */
function PaymentStatus({ status }: { status: string }) {
  if (status === 'succeeded') return <Badge label="Confirmed" tone="success" />;
  if (status === 'failed') return <Badge label="Not confirmed" tone="danger" />;
  if (status === 'refunded') return <Badge label="Refunded" />;
  return <Badge label="Waiting for confirmation" tone="warning" />;
}

function SocietyMoney() {
  const router = useRouter();
  const { colors } = useTheme();
  const { activeCommunity, role } = useAuth();
  const [direction, setDirection] = useState<string>('all');
  const [eventSlug, setEventSlug] = useState('');

  const currency = activeCommunity?.currency ?? 'INR';

  const { data, loading, refreshing, refresh, error } = useCommunityData(
    'money',
    async (communityId) => {
      const [ledger, totals, society, movements, eventStats, eventNames] = await Promise.all([
        // One string literal, not a concatenation: supabase-js reads the row type
        // off the literal itself, and `'a, b' + 'c'` widens it to string, which
        // hands every row back as GenericStringError.
        supabase
          .from('society_ledger')
          .select(
            'id, kind, direction, happened_at, amount, counterpart, detail, payer_name, unit_label, method, receipt_no, document_url, confirmed_by, confirmed_at, event_id, event_slug, event_name',
          )
          .eq('community_id', communityId)
          .order('happened_at', { ascending: false })
          .limit(500),
        supabase.from('society_money').select('*').eq('community_id', communityId).maybeSingle(),
        supabase
          .from('society_balance')
          .select('balance, movements_in')
          .eq('community_id', communityId)
          .maybeSingle(),
        supabase
          .from('fund_movements')
          .select(
            'id, kind, amount, note, decided_at, paid_to, proof_path, from_event:events!fund_movements_from_event_id_fkey(name), to_event:events!fund_movements_to_event_id_fkey(name), decider:memberships!fund_movements_decided_by_fkey(profiles(full_name))',
          )
          .eq('community_id', communityId)
          .order('decided_at', { ascending: false })
          .limit(100),
        // Every event, drafts included: event_stats answers for any member.
        // The names come from events, which leaves drafts out for a resident.
        supabase
          .from('event_stats')
          .select(
            'event_id, available, fund_carried, fund_carried_in, fund_raised, spent, fund_moved_out',
          )
          .eq('community_id', communityId),
        supabase
          .from('events')
          .select('id, name, emoji, slug, status')
          .eq('community_id', communityId)
          .limit(500),
      ]);
      // A read that fails must not arrive here as an empty ledger. The web app
      // learned this the expensive way — an ambiguous embed answered 300 for two
      // days while every society was told "Nothing to vote on yet" — and on a
      // money screen the wrong version is worse: "nothing has moved yet" is a
      // claim about the society's finances, not a blank list.
      const failure = ledger.error ?? totals.error;
      if (failure) {
        console.error(
          '[compences] read failed: the society ledger',
          failure.code,
          failure.message,
          failure.details ?? '',
        );
        reportHandled(failure, 'the society ledger');
        throw new Error(failure.message);
      }
      return {
        rows: ledger.data ?? [],
        totals: totals.data ?? null,
        society: society.data ?? null,
        movements: movements.data ?? [],
        // A split missing a row would not add up to the balance, and adding up
        // is the only thing it is for — so a failed read shows no split at all.
        holdings:
          eventStats.error || eventNames.error
            ? null
            : whereTheBalanceIs(eventStats.data ?? [], eventNames.data ?? []),
        eventStats: eventStats.data ?? [],
        eventNames: eventNames.data ?? [],
      };
    },
  );

  if (loading && !data) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  if (error && !data) {
    return (
      <Screen>
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <EmptyState title="Could not load the ledger" description={error} />
          <Button label="Try again" onPress={refresh} />
        </View>
      </Screen>
    );
  }

  const rows = data?.rows ?? [];
  const totals = data?.totals ?? null;
  const visible = filterLedger(rows, ledgerFilterFrom(direction), eventSlug);
  const balance = Number(totals?.balance ?? 0);
  const heldBySociety = Number(data?.society?.balance ?? 0);
  const movements = data?.movements ?? [];
  const holdings = data?.holdings ?? null;

  // Built from the ledger rather than from events, so the filter only offers an
  // event that has something in it — and the society balance, once it has rows
  // of its own.
  const scopes = ledgerScopes(rows);
  const scope = scopes.find((option) => option.value === eventSlug);
  // One event's ledger, or the society balance's, adds up to what it holds. An
  // event's figures come from its own numbers, not the rows on screen, which
  // stop at the newest 500; the society balance's rows are few. Same as the web.
  const scopeTotals = (() => {
    if (!scope || direction !== 'all') return null;
    if (eventSlug === SOCIETY_BALANCE_LEDGER) return ledgerTotals(visible);
    const id = (data?.eventNames ?? []).find((row) => row.slug === eventSlug)?.id;
    const stats = (data?.eventStats ?? []).find((row) => row.event_id === id);
    if (!stats) return ledgerTotals(visible);
    return {
      in: Number(stats.fund_raised ?? 0) + Number(stats.fund_carried_in ?? 0),
      out: Number(stats.spent ?? 0) + Number(stats.fund_moved_out ?? 0),
      left: Number(stats.available ?? 0),
    };
  })();

  return (
    <Screen>
      <FlatList
        data={visible}
        keyExtractor={(item) => item.id ?? String(item.receipt_no)}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        ListHeaderComponent={
          <View style={{ gap: spacing.md, marginBottom: spacing.sm }}>
            {/* The one number everybody asks the committee for, as large as
                the screen allows, with what came in and went out beneath it. */}
            <Card style={{ gap: spacing.sm, paddingVertical: spacing.xl }}>
              <Text
                style={{
                  color: colors.gold,
                  fontSize: 11,
                  fontWeight: '600',
                  letterSpacing: 1.5,
                  textTransform: 'uppercase',
                }}
              >
                Balance
              </Text>
              <Amount
                value={balance}
                currency={currency}
                size={38}
                style={balance < 0 ? { color: colors.danger } : undefined}
              />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.xl }}>
                <Caption>Collected {formatMoney(totals?.total_in ?? 0, currency)}</Caption>
                <Caption>Spent {formatMoney(totals?.total_out ?? 0, currency)}</Caption>
              </View>
            </Card>

            {/* Where the balance is: each event still holding money, and what
                the society kept outside any event, adding up to the balance
                above. Without it, "Balance ₹7,820" beside "₹0 kept for the
                society" read as a contradiction after a carry, with nowhere to
                find the rest. Same rows as the web, from the same function. */}
            {holdings && (holdings.length || heldBySociety !== 0 || movements.length) ? (
              <Card style={{ gap: spacing.sm }}>
                <Body>Where the {formatMoney(balance, currency)} is</Body>
                {holdings.map((holding) => {
                  const note = holdingNote(holding, currency);
                  const row = (
                    <View style={{ flexDirection: 'row', gap: spacing.md }}>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Body>{holding.name ?? UNPUBLISHED_EVENT}</Body>
                        {note ? <Caption>{note}</Caption> : null}
                      </View>
                      <Text
                        style={{
                          color: holding.amount < 0 ? colors.danger : colors.ink,
                          fontSize: 14,
                          fontWeight: '600',
                        }}
                      >
                        {formatMoney(holding.amount, currency)}
                      </Text>
                    </View>
                  );
                  return holding.name && holding.slug ? (
                    <Pressable
                      key={holding.eventId}
                      accessibilityRole="link"
                      onPress={() => router.push(`/event/${holding.slug}`)}
                      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                    >
                      {row}
                    </Pressable>
                  ) : (
                    <View key={holding.eventId}>{row}</View>
                  );
                })}
                <View style={{ flexDirection: 'row', gap: spacing.md }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Body>Kept for the society</Body>
                    <Caption>Not behind any event yet</Caption>
                  </View>
                  <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '600' }}>
                    {formatMoney(heldBySociety, currency)}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '700' }}>
                    Balance
                  </Text>
                  <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '700' }}>
                    {formatMoney(balance, currency)}
                  </Text>
                </View>
              </Card>
            ) : null}

            {/* What was left when an event closed, and what the committee
                decided to do with it — carry it to another event, or keep it.
                The history behind the split above: from what, and decided by
                whom. */}
            {movements.length ? (
              <Card style={{ gap: spacing.sm }}>
                <Body>Where money has moved</Body>
                {movements.map((movement) => (
                  <View key={movement.id} style={{ gap: 2 }}>
                    <Body>{fundMovementLine(movement, currency)}</Body>
                    <Caption>
                      {movement.decided_at ? formatDate(movement.decided_at.slice(0, 10)) : ''}
                      {movement.decider?.profiles?.full_name
                        ? ` · decided by ${movement.decider.profiles.full_name}`
                        : ''}
                      {movement.note ? ` · ${movement.note}` : ''}
                    </Caption>
                    {/* A pay-back carries the screenshot of the transfer, for
                        every resident: they should know people get paid back. */}
                    {movement.proof_path ? (
                      <ViewFileButton
                        bucket="bills"
                        value={movement.proof_path}
                        label="View screenshot"
                      />
                    ) : null}
                  </View>
                ))}
              </Card>
            ) : null}

            <ChipRow>
              {LEDGER_FILTERS.map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  selected={direction === option.value}
                  onPress={() => setDirection(option.value)}
                />
              ))}
            </ChipRow>

            {scopes.length ? (
              <ChipRow>
                <Chip
                  label="Every event"
                  selected={eventSlug === ''}
                  onPress={() => setEventSlug('')}
                />
                {scopes.map((option) => (
                  <Chip
                    key={option.value}
                    label={option.label}
                    selected={eventSlug === option.value}
                    onPress={() => setEventSlug(option.value)}
                  />
                ))}
              </ChipRow>
            ) : null}

            {/* What the narrowed ledger adds up to: in, out, and what is left
                in that event or kept by the society. */}
            {scope && scopeTotals ? (
              <Card style={{ gap: 4 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Caption>Money in</Caption>
                  <Caption>+{formatMoney(scopeTotals.in, currency)}</Caption>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Caption>Money out</Caption>
                  <Caption>−{formatMoney(scopeTotals.out, currency)}</Caption>
                </View>
                <View
                  style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}
                >
                  <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '700', flex: 1 }}>
                    {eventSlug === SOCIETY_BALANCE_LEDGER
                      ? 'Kept for the society'
                      : `Left in ${scope.label}`}
                  </Text>
                  <Text
                    style={{
                      color: scopeTotals.left < 0 ? colors.danger : colors.ink,
                      fontSize: 14,
                      fontWeight: '700',
                    }}
                  >
                    {formatMoney(scopeTotals.left, currency)}
                  </Text>
                </View>
              </Card>
            ) : null}

            {/* Staff and the committee spend the society's own balance from
                here: a repair, damage, anything that is not an event's. */}
            {can(role, 'expenses:submit') ? (
              <Button
                label="Spend from the society balance"
                variant="secondary"
                onPress={() => router.push('/admin/society-spend')}
              />
            ) : null}

            <Caption>
              Confirmed payments in; approved bills and the society&rsquo;s own spending out.
              Payments show here once confirmed. Pick an event to see the money the committee moved
              in or out of it too.
            </Caption>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title={rows.length ? 'Nothing matches that' : 'Nothing has moved yet'}
            description={
              rows.length
                ? 'Try a different filter.'
                : 'Confirmed payments and approved bills will show up here.'
            }
          />
        }
        ListFooterComponent={
          <View style={{ gap: spacing.xs, paddingTop: spacing.lg }}>
            <Caption>
              Money in shows who paid, their flat and how. Money out shows the vendor, who approved
              it and the bill, which anyone can open. Only the payer and staff can open a payment
              screenshot. No contact details are shown here.
            </Caption>
            {totals?.last_movement_at ? (
              <Caption>Last movement {relativeTime(totals.last_movement_at)}.</Caption>
            ) : null}
            {rows.length >= 500 ? <Caption>Showing the most recent 500.</Caption> : null}
          </View>
        }
        renderItem={({ item }) => {
          const incoming = item.direction === 'in';
          const when = item.happened_at ? formatDate(item.happened_at.slice(0, 10)) : null;
          const flat = ledgerFlat(item);
          const evidence = ledgerEvidence(item);
          const societySpending = isSocietySpending(item);
          // Money the committee moved: this ledger's money arriving or
          // leaving, never a payment from a resident or to a vendor.
          const moved = isTransfer(item);
          return (
            <Card style={{ gap: spacing.xs, marginBottom: spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
                <View style={{ flex: 1, gap: 2 }}>
                  {/* Name and flat on one line, the same pair the laptop shows
                      — through the same functions, so the two cannot drift
                      into naming a payment differently. A flat the society
                      does not know is said in the quieter ink the laptop
                      gives it, so the gap reads as a gap and not as a name
                      with something chopped off the end. */}
                  <Body>
                    {ledgerTitle(item)}
                    {flat ? (
                      <Text
                        style={
                          flat.known
                            ? { color: colors.inkMuted }
                            : { color: colors.inkSubtle, fontSize: 12 }
                        }
                      >
                        {` · ${flat.label}`}
                      </Text>
                    ) : null}
                  </Body>
                  <Caption>
                    {[
                      moved ? (incoming ? 'Moved in' : 'Moved out') : null,
                      ledgerMeta(item),
                      when,
                      societySpending ? 'from the society balance' : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Caption>
                  {item.confirmed_at ? (
                    <Caption>
                      {moved
                        ? 'Decided'
                        : incoming
                          ? 'Confirmed'
                          : societySpending
                            ? 'Recorded'
                            : 'Approved'}{' '}
                      by {item.confirmed_by ?? (moved ? 'the committee' : 'the society')} ·{' '}
                      {relativeTime(item.confirmed_at)}
                    </Caption>
                  ) : null}
                </View>
                {/* The sign, not just the colour, carries the direction: green
                    against dark ink is exactly the pair that goes on people who
                    cannot separate the two. */}
                <Text
                  style={{
                    color: incoming && !moved ? colors.success : colors.ink,
                    fontSize: 14,
                    fontWeight: '600',
                  }}
                >
                  {incoming ? '+' : '−'}
                  {formatMoney(Math.abs(Number(item.amount ?? 0)), currency)}
                </Text>
              </View>

              {item.event_slug ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push(`/event/${item.event_slug}`)}
                  // Not hitSlop here: the bill chip sits four points below and
                  // is tappable too, so a slop big enough to matter would start
                  // taking its taps. The row grows instead.
                  style={{ minHeight: minTapTarget, justifyContent: 'center' }}
                >
                  <Caption>{String(item.event_name ?? 'Event')} ›</Caption>
                </Pressable>
              ) : null}

              {/* The bill for money out, the payer's screenshot for money in.
                  A row whose evidence is not this viewer's to open arrives
                  with a null path and grows no button. */}
              {evidence ? (
                <ViewFileButton
                  bucket={evidence.bucket}
                  value={evidence.path}
                  label={evidence.label}
                />
              ) : null}
            </Card>
          );
        }}
      />
    </Screen>
  );
}
