import { useState } from 'react';
import { Alert, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  AGE_GROUPS,
  COPY,
  EVENT_STATUS_LABEL,
  EVENT_TABS,
  can,
  carriedFromLine,
  correctionNote,
  countdown,
  formatDate,
  formatMoney,
  eventMoney,
  fundBarSegments,
  inTheFund,
  movedOnSummary,
  practiceDatesLine,
} from '@compences/core';
import { useAuth } from '../../src/lib/auth';
import { supabase } from '../../src/lib/supabase';
import { fetchEventDetail, lookOf } from '../../src/lib/events';
import { useCommunityData } from '../../src/lib/use-community-data';
import {
  Amount,
  Badge,
  Body,
  Button,
  Caption,
  Card,
  EmptyState,
  Heading,
  Input,
  Loading,
  Screen,
  SectionLabel,
} from '../../src/components/ui';
import { FestivalHero } from '../../src/components/festival';
import { Chip, ChipRow } from '../../src/components/admin-ui';
import {
  EventBalanceCard,
  EventMoneyTiles,
  FundKey,
  KeyValue,
  Meter,
  SpendKey,
  StatTile,
} from '../../src/components/event-ui';
import { Suggestions } from '../../src/components/suggestions';
import { ViewFileButton } from '../../src/components/file-ui';
import { BudgetChart } from '../../src/components/budget-chart';
import { SectionBar, useSectionScroll } from '../../src/components/section-scroll';
import { spacing } from '../../src/lib/theme';

type Detail = NonNullable<Awaited<ReturnType<typeof fetchEventDetail>>>;

const SECTION_IDS = EVENT_TABS.map((section) => section.id);

/**
 * An event on one screen, read top to bottom: what it is, its money,
 * activities to register for and ideas to vote on, under a bar that jumps
 * between them. `?tab=activities` still opens at that section.
 */
export default function EventDetail() {
  const { slug, tab: initialTab } = useLocalSearchParams<{ slug: string; tab?: string }>();
  const { scroll, current, jump, onScroll, sectionProps, onBarLayout } = useSectionScroll(
    SECTION_IDS,
    initialTab,
  );
  const router = useRouter();
  const queryClient = useQueryClient();
  const { activeCommunity, membershipId, viewRole: role } = useAuth();
  const currency = activeCommunity?.currency ?? 'INR';

  const { data, loading, refreshing, refresh } = useCommunityData(
    `event:${slug}`,
    async (communityId) => fetchEventDetail(communityId, String(slug), membershipId ?? ''),
  );

  if (loading && !data) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  if (!data) {
    return (
      <Screen>
        <EmptyState title="Event not found" description="It may have been removed." />
      </Screen>
    );
  }

  const { event, stats } = data;
  const target = stats.fundTarget || event.fund_target;
  const fundBar = fundBarSegments(stats.fundRaised, stats.fundPending, target, stats.fundCarriedIn);
  const funded = fundBar.confirmed;
  // What the fund holds, carried money included: the headline, against the
  // event's target. Carried sums are rows under the bar, with who moved them.
  const held = inTheFund(stats.fundRaised, stats.fundCarriedIn);
  // Collected, spent, moved on and left, adding up: the Fund card's tiles, and
  // for staff and the committee the balance at the top of the page.
  const money = eventMoney(stats);
  const open = event.status === 'published';

  const changed = () => {
    refresh();
    void queryClient.invalidateQueries({ queryKey: ['events'] });
  };

  // A campaign has no activities, and a proposal nothing to vote on yet.
  const sections = EVENT_TABS.filter((section) =>
    section.id === 'activities'
      ? event.kind !== 'campaign'
      : section.id === 'vote'
        ? event.status !== 'proposed'
        : true,
  );
  const has = (id: string) => sections.some((section) => section.id === id);
  const look = lookOf(event);
  const kind =
    event.kind === 'campaign'
      ? 'Fundraising campaign'
      : look.kind === 'festival'
        ? 'Festival'
        : look.kind === 'national'
          ? 'National day'
          : look.kind === 'occasion'
            ? look.label
            : 'Event';

  return (
    <Screen>
      <ScrollView
        ref={scroll}
        // The section bar, the second child, stays pinned while the rest scrolls.
        stickyHeaderIndices={[1]}
        onScroll={onScroll}
        scrollEventThrottle={32}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        keyboardShouldPersistTaps="handled"
      >
        {/* The festival's banner, edge to edge: its colour, and the thing it
            is decorated with moving beside the name. */}
        <View style={{ marginHorizontal: -spacing.lg, marginTop: -spacing.lg }}>
          <FestivalHero
            festival={look}
            eyebrow={`${kind} · ${formatDate(event.starts_on)}`}
            title={event.name}
            meta={
              [event.venue, countdown(event.starts_on)].filter(Boolean).join(' · ') || undefined
            }
            bottom={spacing.xxl + spacing.lg}
          >
            <HeroPill label={EVENT_STATUS_LABEL[event.status]} />
            {can(role, 'events:manage') ? (
              <Button
                label="Manage event"
                variant="glass"
                compact
                onPress={() =>
                  router.push({ pathname: '/admin/event/[slug]', params: { slug: event.slug } })
                }
              />
            ) : null}
          </FestivalHero>
        </View>

        {/* Pulled up over the banner's lower edge, then pinned as it scrolls. */}
        <SectionBar
          sections={sections}
          current={current}
          onJump={jump}
          onLayout={onBarLayout}
          style={{ marginTop: -(spacing.lg + spacing.xxl) }}
        />

        <View {...sectionProps('about')} style={{ gap: spacing.lg }}>
          {/* Staff and the committee see what is left before anything else,
              so nobody commits to a bill the event cannot pay. */}
          {can(role, 'events:manage') && event.status !== 'proposed' ? (
            <EventBalanceCard
              money={money}
              currency={currency}
              onPayBack={can(role, 'expenses:approve') ? () => router.push('/manage') : undefined}
            />
          ) : null}
          <About data={data} />
        </View>

        <View {...sectionProps('money')} style={{ gap: spacing.lg }}>
          <SectionLabel>{COPY.money}</SectionLabel>
          <Card style={{ gap: spacing.md }}>
            <Heading>Fund</Heading>
            <View style={{ gap: 2 }}>
              <Amount value={held} currency={currency} />
              <Caption>
                of {formatMoney(target, currency)} · {stats.contributors}{' '}
                {stats.contributors === 1 ? 'household' : COPY.households.toLowerCase()} gave
              </Caption>
            </View>
            <Meter
              percent={funded}
              pendingPercent={fundBar.pending}
              tone="success"
              label="Fund progress"
            />
            <FundKey confirmed={held} pending={stats.fundPending} currency={currency} />
            {data.carriedIn.map((movement) => (
              <Caption key={movement.id}>+ {carriedFromLine(movement, currency)}</Caption>
            ))}
            {/* What the approved bills have used of it, in its own colour,
                then what was handed on when the event closed. */}
            <Meter
              percent={money.spentPercent}
              nextPercent={money.overBy > 0 ? 0 : money.movedPercent}
              tone={money.overBy > 0 ? 'danger' : 'warning'}
              label="Spent"
            />
            <SpendKey
              spent={money.spent}
              movedOut={money.movedOut}
              balance={money.balance}
              currency={currency}
            />
            <EventMoneyTiles
              money={money}
              currency={currency}
              movedTo={data.movedFrom.length ? movedOnSummary(data.movedFrom) : undefined}
            />
            {open && can(role, 'contribute') ? (
              <Button
                label="Contribute"
                onPress={() => router.push(`/contribute?event=${event.slug}`)}
              />
            ) : null}
            {can(role, 'payments:view') ? (
              <Button
                label="Who has paid"
                variant="secondary"
                onPress={() => router.push(`/admin/payments?event=${event.slug}`)}
              />
            ) : null}
          </Card>

          {data.myPayments.length ? <YourPayments data={data} currency={currency} /> : null}

          <Analytics data={data} currency={currency} />

          <BudgetAndSpending data={data} currency={currency} />
        </View>

        {has('activities') ? (
          <View {...sectionProps('activities')} style={{ gap: spacing.lg }}>
            <Activities data={data} open={open} onChange={changed} />
          </View>
        ) : null}

        {has('vote') ? (
          <View {...sectionProps('vote')} style={{ gap: spacing.lg }}>
            {/* One target, so no picker: on an event's own page there is only
                one thing a suggestion could be about. Once the event is over,
                that one thing is the society, for next time. */}
            <Suggestions
              rows={data.suggestions}
              targets={
                open
                  ? [{ id: data.event.id, label: data.event.name }]
                  : [{ id: null, label: 'The society' }]
              }
              open
              suggestLabel={open ? undefined : 'SUGGEST AN IDEA FOR NEXT TIME'}
              suggestHint={
                open
                  ? undefined
                  : `${data.event.name} is over, so your idea goes to the society's Ideas.`
              }
              onChange={changed}
            />
          </View>
        ) : null}
        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </Screen>
  );
}

function About({ data }: { data: Detail }) {
  const { event } = data;
  const dates =
    event.ends_on && event.ends_on !== event.starts_on
      ? `${formatDate(event.starts_on)} – ${formatDate(event.ends_on)}`
      : formatDate(event.starts_on);

  return (
    <>
      {event.status === 'proposed' ? (
        <Card>
          <Body muted>Waiting for the committee. Residents can contribute once it’s approved.</Body>
        </Card>
      ) : null}

      <Card style={{ gap: spacing.md }}>
        {event.description ? (
          <Body>{event.description}</Body>
        ) : (
          <Body muted>No description yet.</Body>
        )}
        <View style={{ gap: spacing.xs }}>
          <KeyValue label="Date" value={dates} />
          {event.venue ? <KeyValue label="Venue" value={event.venue} /> : null}
          {data.eventType ? <KeyValue label="Type" value={data.eventType} /> : null}
          {event.organizer ? <KeyValue label="Organiser" value={event.organizer} /> : null}
        </View>
      </Card>
    </>
  );
}

function YourPayments({ data, currency }: { data: Detail; currency: string }) {
  return (
    <Card style={{ gap: spacing.sm }}>
      <Heading>Your receipts</Heading>
      {data.myPayments.map((payment) => (
        <View key={payment.id} style={{ gap: 2 }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              gap: spacing.sm,
            }}
          >
            <Caption>
              {formatMoney(payment.amount, currency)}
              {payment.reference ? ` · UPI transaction ID ${payment.reference}` : ''}
            </Caption>
            <Badge
              label={
                payment.status === 'succeeded'
                  ? 'Confirmed'
                  : payment.status === 'failed'
                    ? 'Not confirmed'
                    : 'Waiting for confirmation'
              }
              tone={
                payment.status === 'succeeded'
                  ? 'success'
                  : payment.status === 'failed'
                    ? 'danger'
                    : 'warning'
              }
            />
          </View>
          {payment.status === 'failed' && payment.review_note ? (
            <Caption>{payment.review_note}</Caption>
          ) : null}
          {correctionNote(payment.amount, payment.reported_amount, currency) ? (
            <Caption>
              {correctionNote(payment.amount, payment.reported_amount, currency)}
              {payment.review_note ? ` · ${payment.review_note}` : ''}
            </Caption>
          ) : null}
        </View>
      ))}
    </Card>
  );
}

function Analytics({ data, currency }: { data: Detail; currency: string }) {
  const { stats, expenses } = data;
  const perContribution = stats.contributors > 0 ? stats.fundRaised / stats.contributors : 0;
  const biggest = [...expenses].sort((a, b) => Number(b.amount) - Number(a.amount))[0];

  return (
    <View style={{ gap: spacing.md }}>
      <Heading>At a glance</Heading>
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <StatTile label="PER HOUSEHOLD" value={formatMoney(perContribution, currency)} />
        <StatTile label="BILLS" value={String(expenses.length)} />
      </View>
      {biggest ? (
        <Caption>
          Largest bill: {biggest.name} · {formatMoney(biggest.amount, currency)}
          {biggest.vendor ? ` · ${biggest.vendor}` : ''}
        </Caption>
      ) : null}
    </View>
  );
}

type SpendBill = Detail['expenses'][number];

/** One approved bill: its remarks, the amount, and the picture behind it. */
function SpendBillRow({ bill, currency }: { bill: SpendBill; currency: string }) {
  return (
    <View style={{ gap: spacing.xs }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Body>{bill.name}</Body>
          <Caption>{bill.spent_on ? formatDate(bill.spent_on) : 'No date'}</Caption>
        </View>
        <Body>{formatMoney(bill.amount, currency)}</Body>
      </View>
      <ViewFileButton bucket="bills" value={bill.bill_url} label="View bill" />
    </View>
  );
}

/**
 * Budget and spending: the ring and bars by vendor or by service, each opening
 * into its line items and the approved bills paid out of them, with each
 * bill's remarks and picture. Bills with no line behind them are their own
 * group, outside the budget.
 */
function BudgetAndSpending({ data, currency }: { data: Detail; currency: string }) {
  const unlinked = data.expenses.filter(
    (expense) => !data.lines.some((line) => line.id === expense.budget_line_id),
  );

  return (
    <>
      <Card style={{ gap: spacing.md }}>
        <Heading>Budget &amp; spending</Heading>
        {data.lines.length || unlinked.length ? (
          <>
            <BudgetChart
              lines={data.lines}
              bills={data.expenses}
              currency={currency}
              renderBill={(bill) => <SpendBillRow bill={bill} currency={currency} />}
            />
            {!data.expenses.length ? (
              <Caption>Nothing spent yet. Approved bills appear here, itemised.</Caption>
            ) : null}
          </>
        ) : (
          <Caption>No budget set yet.</Caption>
        )}
      </Card>

      {/* What was left when the event closed, and where the committee sent
          it: the last entries in its ledger, so every rupee is accounted for. */}
      {data.movedFrom.length ? (
        <Card style={{ gap: spacing.md }}>
          <Heading>Where the rest went</Heading>
          {data.movedFrom.map((movement) => (
            <View
              key={movement.id}
              style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Body>
                  {movement.kind === 'society_balance'
                    ? 'Kept for the society'
                    : `Carried to ${movement.to_event?.name ?? 'another event'}`}
                </Body>
                <Caption>
                  {[
                    movement.decider?.profiles?.full_name
                      ? `Decided by ${movement.decider.profiles.full_name}`
                      : null,
                    movement.decided_at ? formatDate(movement.decided_at.slice(0, 10)) : null,
                    movement.note,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Caption>
              </View>
              <Body>{formatMoney(movement.amount, currency)}</Body>
            </View>
          ))}
        </Card>
      ) : null}
    </>
  );
}

function Activities({
  data,
  open,
  onChange,
}: {
  data: Detail;
  open: boolean;
  onChange: () => void;
}) {
  const { viewRole: role, membershipId, profile } = useAuth();
  const [addingFor, setAddingFor] = useState<string | null>(null);
  const [familyName, setFamilyName] = useState('');
  const [familyAge, setFamilyAge] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const mayRegister = open && can(role, 'activities:register');

  if (!data.activities.length) {
    return (
      <Card>
        <EmptyState
          title="No activities yet"
          description="Register here once the organisers add activities."
        />
      </Card>
    );
  }

  const register = async (activityId: string, participantName: string | null) => {
    if (!membershipId) return;
    setBusy(activityId);
    const { error } = await supabase.from('activity_participants').insert({
      activity_id: activityId,
      membership_id: membershipId,
      participant_name: participantName,
      // Asked only about a family member, as on the web.
      age_group: participantName ? familyAge : null,
      channel: 'mobile',
    });
    setBusy(null);
    if (error) {
      Alert.alert(
        'Could not register',
        error.code === '23505' ? 'That person is already registered.' : 'Please try again.',
      );
      return;
    }
    setFamilyName('');
    setFamilyAge(null);
    setAddingFor(null);
    onChange();
  };

  const withdraw = async (registrationId: string) => {
    setBusy(registrationId);
    const { error } = await supabase
      .from('activity_participants')
      .delete()
      .eq('id', registrationId);
    setBusy(null);
    if (error) {
      Alert.alert('Could not remove that registration', 'Please try again.');
      return;
    }
    onChange();
  };

  return (
    <Card style={{ gap: spacing.lg }}>
      <View style={{ gap: 2 }}>
        <Heading>Activities</Heading>
        {mayRegister ? <Caption>Register yourself or anyone from your flat.</Caption> : null}
      </View>
      {data.activities.map((activity) => {
        const mine = data.registrations.filter((row) => row.activity_id === activity.id);
        const selfRegistered = mine.some((row) => !row.participant_name);
        // As on the web: a full activity stops offering places it doesn't have.
        const full = activity.capacity != null && activity.registered >= activity.capacity;
        return (
          <View key={activity.id} style={{ gap: spacing.sm }}>
            <View
              style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Body>{activity.name}</Body>
                {activity.description ? <Caption>{activity.description}</Caption> : null}
                <Caption>
                  {activity.registered} registered
                  {activity.capacity ? ` · ${activity.capacity} places` : ''}
                  {!activity.is_open ? ' · registration closed' : full ? ' · full' : ''}
                </Caption>
                {activity.memberships?.profiles?.full_name ? (
                  <Caption>Coordinator: {activity.memberships.profiles.full_name}</Caption>
                ) : null}
                {activity.practice_dates.length ? (
                  <Caption>Practice: {practiceDatesLine(activity.practice_dates)}</Caption>
                ) : null}
              </View>
            </View>

            {mine.length ? (
              <ChipRow>
                {mine.map((row) => (
                  <Chip
                    key={row.id}
                    label={`✓ ${row.participant_name ?? profile?.full_name ?? 'You'}  ✕`}
                    selected
                    disabled={busy !== null || !mayRegister}
                    onPress={() =>
                      Alert.alert('Remove this registration?', undefined, [
                        { text: 'Keep', style: 'cancel' },
                        {
                          text: 'Remove',
                          style: 'destructive',
                          onPress: () => void withdraw(row.id),
                        },
                      ])
                    }
                  />
                ))}
              </ChipRow>
            ) : null}

            {mayRegister && activity.is_open && !full ? (
              addingFor === activity.id ? (
                <View style={{ gap: spacing.sm }}>
                  <Input
                    label="Family member’s name"
                    value={familyName}
                    onChangeText={setFamilyName}
                    autoCapitalize="words"
                    placeholder="e.g. Aarav"
                  />
                  <View style={{ gap: spacing.xs }}>
                    <Body>Age group</Body>
                    <ChipRow>
                      {AGE_GROUPS.map((group) => (
                        <Chip
                          key={group}
                          label={group}
                          selected={familyAge === group}
                          onPress={() => setFamilyAge(familyAge === group ? null : group)}
                        />
                      ))}
                    </ChipRow>
                  </View>
                  <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    <View style={{ flex: 1 }}>
                      <Button
                        label="Cancel"
                        variant="secondary"
                        onPress={() => setAddingFor(null)}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Button
                        label="Register"
                        onPress={() => void register(activity.id, familyName.trim())}
                        disabled={familyName.trim().length < 2}
                        loading={busy === activity.id}
                      />
                    </View>
                  </View>
                </View>
              ) : (
                <ChipRow>
                  {!selfRegistered ? (
                    <Chip
                      label="Register me"
                      onPress={() => void register(activity.id, null)}
                      disabled={busy !== null}
                    />
                  ) : null}
                  <Chip
                    label="+ Family member"
                    onPress={() => {
                      setFamilyName('');
                      setFamilyAge(null);
                      setAddingFor(activity.id);
                    }}
                    disabled={busy !== null}
                  />
                </ChipRow>
              )
            ) : null}
          </View>
        );
      })}
    </Card>
  );
}

/** A status on the festival's banner: white on a veil of it. */
function HeroPill({ label }: { label: string }) {
  return (
    <View
      style={{
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 6,
        backgroundColor: 'rgba(255,255,255,0.16)',
        borderColor: 'rgba(255,255,255,0.3)',
        borderWidth: 1,
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}
