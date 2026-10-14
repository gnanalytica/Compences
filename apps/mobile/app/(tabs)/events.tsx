import { Pressable, RefreshControl, SectionList, Text, View } from 'react-native';
import { today as localToday } from '../../src/components/date-field';
import { useRouter } from 'expo-router';
import {
  EVENT_STATUS_LABEL,
  can,
  countdown,
  formatDate,
  formatMoney,
  fundBarSegments,
  inTheFund,
} from '@compences/core';
import { useAuth } from '../../src/lib/auth';
import { fetchEvents, fetchStats, lookOf } from '../../src/lib/events';
import { useCommunityData } from '../../src/lib/use-community-data';
import {
  Badge,
  Button,
  Caption,
  Card,
  EmptyState,
  Loading,
  Screen,
  SectionLabel,
} from '../../src/components/ui';
import { FundKey, Meter } from '../../src/components/event-ui';
import { FestivalTile } from '../../src/components/festival';
import { fonts, spacing } from '../../src/lib/theme';
import { useTheme } from '../../src/lib/use-theme';

export default function Events() {
  const router = useRouter();
  const { colors } = useTheme();
  const { activeCommunity, viewRole: role, user } = useAuth();
  const currency = activeCommunity?.currency ?? 'INR';

  const { data, loading, refreshing, refresh } = useCommunityData('events', async (communityId) => {
    const events = await fetchEvents(communityId);
    const stats = await fetchStats(events.map((event) => event.id));
    return events.map((event) => ({ ...event, stats: stats.get(event.id) }));
  });

  if (loading && !data) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  const rows = data ?? [];
  const today = localToday();
  const inPlay = (row: (typeof rows)[number]) =>
    row.status === 'published' || row.status === 'draft';

  const sections = [
    {
      title: 'Proposals waiting for the committee',
      data: rows.filter(
        (row) =>
          row.status === 'proposed' &&
          (row.created_by === user?.id ||
            can(role, 'campaigns:approve') ||
            can(role, 'events:manage')),
      ),
    },
    {
      title: 'Upcoming events',
      data: rows.filter((row) => row.kind === 'event' && inPlay(row) && row.starts_on >= today),
    },
    {
      title: 'Fundraising campaigns',
      data: rows.filter((row) => row.kind === 'campaign' && inPlay(row)),
    },
    {
      title: 'Past events',
      data: rows
        .filter(
          (row) =>
            row.kind === 'event' &&
            (row.status === 'completed' || (inPlay(row) && row.starts_on < today)),
        )
        .reverse(),
    },
  ].filter((section) => section.data.length > 0);

  return (
    <Screen>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          can(role, 'campaigns:propose') || can(role, 'events:manage') || can(role, 'suggest') ? (
            <View style={{ marginBottom: spacing.sm, gap: spacing.sm }}>
              {can(role, 'events:manage') ? (
                <Button label="New event" onPress={() => router.push('/admin/event/new')} />
              ) : null}
              {can(role, 'campaigns:propose') ? (
                <Button
                  label="Start a fundraising campaign"
                  variant="secondary"
                  onPress={() => router.push('/campaign/new')}
                />
              ) : null}
              {/* Ideas live here as well as under Me: this is where people are
                  already thinking about what the society does. */}
              {can(role, 'suggest') ? (
                <Button
                  label="Suggest an idea"
                  variant="secondary"
                  onPress={() => router.push('/ideas')}
                />
              ) : null}
            </View>
          ) : null
        }
        ListEmptyComponent={
          <EmptyState title="No events yet" description="New events will show up here." />
        }
        renderSectionHeader={({ section }) => (
          <View style={{ paddingTop: spacing.md, paddingBottom: spacing.sm }}>
            <SectionLabel>{section.title}</SectionLabel>
          </View>
        )}
        renderItem={({ item }) => {
          const target = item.stats?.fundTarget ?? item.fund_target;
          const fundBar = fundBarSegments(
            item.stats?.fundRaised ?? 0,
            item.stats?.fundPending ?? 0,
            target,
            item.stats?.fundCarriedIn ?? 0,
          );
          const funded = fundBar.confirmed;
          const held = inTheFund(item.stats?.fundRaised ?? 0, item.stats?.fundCarriedIn ?? 0);
          return (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(`/event/${item.slug}`)}
              style={({ pressed }) => ({
                marginBottom: spacing.md,
                transform: [{ scale: pressed ? 0.985 : 1 }],
              })}
            >
              <Card style={{ gap: spacing.md }}>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: spacing.md,
                  }}
                >
                  {/* A list of events should look like a year: each leads with
                      its festival's colour and what it is decorated with. */}
                  <FestivalTile festival={lookOf(item)} size={46} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text
                      numberOfLines={2}
                      style={{ color: colors.ink, fontFamily: fonts.serif, fontSize: 18 }}
                    >
                      {item.name}
                    </Text>
                    <Caption>
                      {formatDate(item.starts_on)}
                      {item.venue ? ` · ${item.venue}` : ''}
                      {countdown(item.starts_on) ? ` · ${countdown(item.starts_on)}` : ''}
                    </Caption>
                  </View>
                  <Badge
                    label={EVENT_STATUS_LABEL[item.status]}
                    tone={
                      item.status === 'published'
                        ? 'info'
                        : item.status === 'completed'
                          ? 'success'
                          : item.status === 'proposed'
                            ? 'warning'
                            : 'neutral'
                    }
                  />
                </View>

                {item.status !== 'cancelled' && item.status !== 'proposed' ? (
                  <View style={{ gap: 2 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Caption>
                        {formatMoney(held, currency)} of {formatMoney(target, currency)}
                      </Caption>
                      <Caption>{funded}%</Caption>
                    </View>
                    <Meter
                      percent={funded}
                      pendingPercent={fundBar.pending}
                      tone="success"
                      label="Fund progress"
                    />
                    <FundKey
                      confirmed={held}
                      pending={item.stats?.fundPending ?? 0}
                      currency={currency}
                    />
                  </View>
                ) : item.status === 'proposed' ? (
                  <Caption>Target {formatMoney(item.fund_target, currency)}</Caption>
                ) : null}
              </Card>
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}
