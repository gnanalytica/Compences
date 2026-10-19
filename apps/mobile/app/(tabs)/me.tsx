import { Alert, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ROLE_DESCRIPTION, ROLE_LABEL, can, normalizeRole } from '@compences/core';
import { useAuth } from '../../src/lib/auth';
import { supabase } from '../../src/lib/supabase';
import { useCommunityData } from '../../src/lib/use-community-data';
import {
  Body,
  Button,
  Caption,
  Card,
  Heading,
  Loading,
  Screen,
  Title,
} from '../../src/components/ui';
import { LinkRow } from '../../src/components/admin-ui';
import { ViewSwitchCard } from '../../src/components/view-switch';
import { AppearanceCard } from '../../src/components/appearance-card';
import { useUnreadCount } from '../../src/lib/notifications';
import { minTapTarget, spacing } from '../../src/lib/theme';

/** Profile, registrations, notifications, societies, sign out. Receipts are under Money. */
export default function Me() {
  const router = useRouter();
  const {
    profile,
    activeCommunity,
    role,
    viewRole,
    memberships,
    membershipId,
    setActiveCommunity,
    signOut,
  } = useAuth();
  const normalized = normalizeRole(role);
  const participant = can(role, 'contribute');
  // Money is on the bar for residents; staff and the committee reach it here.
  const moneyOnTheBar = !can(viewRole, 'events:manage');
  const unread = useUnreadCount();

  const { data, loading, refreshing, refresh } = useCommunityData(
    `me:${membershipId}`,
    async () => {
      if (!participant) return { registrations: [] };
      const registrations = await supabase
        .from('activity_participants')
        .select('id, participant_name, event_activities(name, emoji, events(name))')
        .eq('membership_id', membershipId ?? '');
      return { registrations: registrations.data ?? [] };
    },
  );

  if (loading && !data) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        <View style={{ gap: 2 }}>
          <Title>{profile?.full_name ?? 'You'}</Title>
          <Caption>
            {activeCommunity?.name}
            {normalized ? ` · ${ROLE_LABEL[normalized]}` : ''}
          </Caption>
          {normalized ? <Caption>{ROLE_DESCRIPTION[normalized]}</Caption> : null}
        </View>

        <ViewSwitchCard />

        <Card style={{ gap: spacing.xs }}>
          <LinkRow
            label={unread ? `Notifications (${unread} unread)` : 'Notifications'}
            detail="Join requests, receipts, bills and new events"
            onPress={() => router.push('/notifications')}
          />
          {moneyOnTheBar ? null : (
            <LinkRow
              label="Society money"
              detail="Every rupee in and out, for every event"
              onPress={() => router.push('/money')}
            />
          )}
          {/* The screen has always been there and has never turned a resident
              away — /people checks nothing beyond membership. What it lacked
              was a way in. The only two screens that opened it were Manage,
              which residents never see, and Community, which is switched off
              for the pilot, so on a phone a resident could not look up a
              neighbour at all. */}
          <LinkRow
            label="Residents"
            detail="Everyone in the society, by flat"
            onPress={() => router.push('/people')}
          />
          <LinkRow
            label="Ideas"
            detail="Suggest ideas and vote on them"
            onPress={() => router.push('/ideas')}
          />
        </Card>

        {participant && data?.registrations.length ? (
          <Card style={{ gap: spacing.md }}>
            <Heading>Registered for</Heading>
            {data.registrations.map((row) => (
              <View key={row.id} style={{ gap: 2 }}>
                <Body>
                  {row.event_activities?.name}
                  {row.participant_name ? ` · ${row.participant_name}` : ''}
                </Body>
                <Caption>{row.event_activities?.events?.name}</Caption>
              </View>
            ))}
          </Card>
        ) : null}

        {memberships.length > 1 ? (
          <Card style={{ gap: spacing.md }}>
            <Heading>Switch society</Heading>
            {memberships.map((membership) => {
              const isActive = membership.community_id === activeCommunity?.id;
              return (
                <Pressable
                  key={membership.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                  onPress={() => setActiveCommunity(membership.community_id)}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    paddingVertical: spacing.sm,
                  }}
                >
                  <View style={{ gap: 1 }}>
                    <Body>{membership.communities?.name ?? 'Society'}</Body>
                    <Caption>{ROLE_LABEL[normalizeRole(membership.role) ?? 'resident']}</Caption>
                  </View>
                  {isActive ? <Body muted>Current</Body> : null}
                </Pressable>
              );
            })}
          </Card>
        ) : null}

        <AppearanceCard />

        <Button
          label="Join another society"
          variant="secondary"
          onPress={() => router.push('/join')}
        />

        <Button
          label="Start a new society"
          variant="secondary"
          onPress={() => router.push('/found')}
        />

        <Pressable
          accessibilityRole="button"
          onPress={() =>
            Alert.alert('Sign out?', 'You’ll need to sign in again to use the app.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
            ])
          }
          style={{ paddingVertical: spacing.md, alignItems: 'center' }}
        >
          <Body muted>Sign out</Body>
        </Pressable>

        {/* Both stores require an app with accounts to offer this, and to
            offer it in the app rather than only by email. It sits below Sign
            out because that is where somebody looks for it, and it is a plain
            row rather than a button so it does not compete with the things
            people actually came here to do. */}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/delete-account')}
          style={{
            paddingVertical: spacing.md,
            alignItems: 'center',
            minHeight: minTapTarget,
            justifyContent: 'center',
          }}
        >
          <Caption>Delete account</Caption>
        </Pressable>
        <View style={{ alignItems: 'center', paddingTop: spacing.md }}>
          <Caption>Compences · A Gnanalytica product</Caption>
        </View>
        {/* Clears the tab bar so the last row is never half-hidden behind it. */}
        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </Screen>
  );
}
