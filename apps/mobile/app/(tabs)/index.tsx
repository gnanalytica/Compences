import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ROLE_LABEL,
  TODO_KIND,
  can,
  countdown,
  formatDate,
  formatMoney,
  fundBarSegments,
  headingTowards,
  inTheFund,
  normalizeRole,
  normalizeStats,
  setupProgress,
  setupSteps,
  type Festival,
} from '@compences/core';
import { useAuth } from '../../src/lib/auth';
import {
  fetchEvents,
  fetchSocietyBalance,
  fetchStats,
  lookOf,
  pickNextEvent,
} from '../../src/lib/events';
import { fetchSetupFacts } from '../../src/lib/setup';
import { groupTodo, useTodoItems } from '../../src/lib/todo';
import { useCommunityData } from '../../src/lib/use-community-data';
import {
  Amount,
  Body,
  Button,
  Caption,
  Card,
  EmptyState,
  Heading,
  Loading,
  Screen,
  SectionLabel,
  Title,
} from '../../src/components/ui';
import { LinkRow } from '../../src/components/admin-ui';
import { ResidentViewBanner } from '../../src/components/view-switch';
import { FestivalHero } from '../../src/components/festival';
import { FundKey, Meter, StatTile } from '../../src/components/event-ui';
import { todoTitle } from '../../src/components/todo-queue';
import { spacing } from '../../src/lib/theme';
import { useTheme } from '../../src/lib/use-theme';

/** Morning, afternoon or evening, by the phone's own clock. */
function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
}

/** "Ganesh Chaturthi is in 12 days." — or on a date, or was. */
function whenLine(name: string, startsOn: string) {
  const when = countdown(startsOn);
  if (!when) return `${name} is on ${formatDate(startsOn)}.`;
  if (when === 'yesterday' || when.endsWith('ago')) return `${name} was ${when}.`;
  return `${name} is ${when}.`;
}

/** What kind of day the banner's small capitals announce. */
function kindOf(festival: Festival, isCampaign: boolean) {
  if (isCampaign) return 'Fundraising campaign';
  if (festival.kind === 'festival') return 'Festival';
  if (festival.kind === 'national') return 'National day';
  if (festival.kind === 'occasion') return festival.label;
  return 'Event';
}

export default function Home() {
  const router = useRouter();
  const { colors } = useTheme();
  // The committee's resident view renders Home exactly as residents see it.
  const { profile, activeCommunity, viewRole: role } = useAuth();
  const staffView = can(role, 'events:manage');
  const setupOpen = can(role, 'roles:manage') && !activeCommunity?.setup_completed_at;
  const { data: todoData } = useTodoItems();
  const todoItems = todoData ?? [];
  const todoGroups = groupTodo(todoItems);

  const { data, loading, refreshing, refresh } = useCommunityData(
    `home:${role}`,
    async (communityId) => {
      const events = await fetchEvents(communityId);
      const next = pickNextEvent(events);
      const [stats, society] = await Promise.all([
        next ? fetchStats([next.id]) : new Map<string, ReturnType<typeof normalizeStats>>(),
        fetchSocietyBalance(communityId),
      ]);
      return {
        next: next ?? null,
        stats: next ? (stats.get(next.id) ?? normalizeStats(null)) : normalizeStats(null),
        society,
      };
    },
  );

  // The committee's setup checklist, until they finish it.
  const setup = useCommunityData(
    `home:setup:${setupOpen}:${activeCommunity?.address ?? ''}:${activeCommunity?.upi_vpa ?? ''}:${activeCommunity?.catalogue_reviewed_at ?? ''}`,
    async () => (setupOpen && activeCommunity ? fetchSetupFacts(activeCommunity) : null),
  );

  if (loading && !data) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  const firstName = profile?.full_name?.split(' ')[0];
  const currency = activeCommunity?.currency ?? 'INR';
  const next = data?.next;
  const stats = data?.stats ?? normalizeStats(null);
  const fundBar = fundBarSegments(
    stats.fundRaised,
    stats.fundPending,
    stats.fundTarget,
    stats.fundCarriedIn,
  );
  const funded = fundBar.confirmed;
  // What the fund holds, carried money included: the card's headline and the
  // bar's solid part. Where carried money came from is a row on the event.
  const held = inTheFund(stats.fundRaised, stats.fundCarriedIn);
  const heldBySociety = data?.society.balance ?? 0;
  const balanceMovements = data?.society.movements ?? 0;
  const normalized = normalizeRole(role);
  const look = next ? lookOf(next) : null;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        {/* A greeting, not a banner: the colour is saved for what the
            society is heading towards, a little further down. */}
        <View style={{ gap: 4 }}>
          <Text
            style={{
              color: colors.gold,
              fontSize: 11,
              fontWeight: '600',
              letterSpacing: 1.5,
              textTransform: 'uppercase',
            }}
          >
            {activeCommunity?.name ?? ''}
            {normalized ? ` · ${ROLE_LABEL[normalized]}` : ''}
          </Text>
          <Title>{firstName ? `${greeting()}, ${firstName}` : greeting()}</Title>
          {next && look ? (
            <Body muted>{whenLine(headingTowards(look, next.name), next.starts_on)}</Body>
          ) : null}
        </View>

        <ResidentViewBanner />

        {setupOpen && setup.data ? (
          <SetupCard steps={setupSteps(setup.data)} onOpen={() => router.push('/admin/setup')} />
        ) : null}

        {staffView ? (
          <Card style={{ gap: spacing.xs }}>
            <Heading>{todoTitle(todoItems.length)}</Heading>
            {todoGroups.length ? (
              todoGroups.map((group) => (
                <LinkRow
                  key={group.kind}
                  label={`${TODO_KIND[group.kind].section} (${group.items.length})`}
                  onPress={() => router.push('/manage')}
                />
              ))
            ) : (
              <Caption>Nothing waiting on you.</Caption>
            )}
          </Card>
        ) : null}

        {next && look ? (
          <>
            <SectionLabel>Coming up</SectionLabel>
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              {/* The festival's banner: its colour, and the thing it is
                  decorated with, moving the way it does. */}
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={`Open ${next.name}`}
                onPress={() => router.push(`/event/${next.slug}`)}
              >
                <FestivalHero
                  festival={look}
                  eyebrow={`${kindOf(look, next.kind === 'campaign')} · ${formatDate(next.starts_on)}`}
                  title={next.name}
                  meta={
                    [next.venue, countdown(next.starts_on)].filter(Boolean).join(' · ') || undefined
                  }
                  bottom={spacing.lg}
                  motifSize={132}
                  titleSize={24}
                />
              </Pressable>
              <View style={{ padding: spacing.lg, gap: spacing.md }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    gap: spacing.md,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                    <Amount value={held} currency={currency} />
                    <Caption>of {formatMoney(stats.fundTarget, currency)}</Caption>
                  </View>
                  <Text style={{ color: colors.success, fontSize: 13, fontWeight: '600' }}>
                    {funded}%
                  </Text>
                </View>
                <Meter
                  percent={funded}
                  pendingPercent={fundBar.pending}
                  tone="success"
                  label="Fund progress"
                />
                <FundKey confirmed={held} pending={stats.fundPending} currency={currency} />
                <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.xs }}>
                  <View style={{ flex: 1 }}>
                    <Button
                      label="View event"
                      variant={can(role, 'contribute') ? 'secondary' : 'primary'}
                      onPress={() => router.push(`/event/${next.slug}`)}
                    />
                  </View>
                  {can(role, 'contribute') ? (
                    <View style={{ flex: 1 }}>
                      <Button
                        label="Contribute"
                        onPress={() => router.push(`/contribute?event=${next.slug}`)}
                      />
                    </View>
                  ) : null}
                </View>
              </View>
            </Card>

            <SectionLabel>{look.kind === 'festival' ? 'This festival' : 'This event'}</SectionLabel>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <StatTile label="Spent" value={formatMoney(stats.spent, currency)} />
              <StatTile label="Households" value={String(stats.contributors)} />
              <StatTile label="Registered" value={String(stats.participants)} />
            </View>
          </>
        ) : (
          <Card>
            <EmptyState title="Nothing planned yet" description="New events will show up here." />
          </Card>
        )}

        {/* Money the society is holding that is not behind any event: what a
            closed event had left, once the committee decided to keep it. On
            everybody's home screen, resident and committee alike, because it
            is the one figure a society is most often asked about and least
            often able to answer. Tapping it shows where every rupee came
            from. */}
        {heldBySociety > 0 ? (
          <>
            <SectionLabel>Kept for the society</SectionLabel>
            <Card style={{ paddingVertical: spacing.sm }}>
              <LinkRow
                label={formatMoney(heldBySociety, currency)}
                detail={`Left over from ${balanceMovements} closed ${
                  balanceMovements === 1 ? 'event' : 'events'
                }`}
                onPress={() => router.push('/money')}
              />
            </Card>
          </>
        ) : null}

        {can(role, 'campaigns:propose') ? (
          <Card style={{ gap: spacing.sm }}>
            <Heading>Raising money for something?</Heading>
            <Body muted>The committee reviews each campaign before residents can contribute.</Body>
            <Button
              label="Start a campaign"
              variant="secondary"
              onPress={() => router.push('/campaign/new')}
            />
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function SetupCard({
  steps,
  onOpen,
}: {
  steps: ReturnType<typeof setupSteps>;
  onOpen: () => void;
}) {
  const progress = setupProgress(steps);
  const next = steps.find((step) => !step.done);
  return (
    <Card style={{ gap: spacing.md }}>
      <View style={{ gap: 2 }}>
        <Heading>Set up your society</Heading>
        <Caption>
          {progress.done} of {progress.total} done
          {next ? ` · next: ${next.title}` : ' · all steps done'}
        </Caption>
      </View>
      <Meter
        percent={Math.round((progress.done / progress.total) * 100)}
        tone="success"
        label="Setup progress"
      />
      <Button label={next ? 'Continue setup' : 'Review and finish'} onPress={onOpen} />
    </Card>
  );
}
