import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { relativeTime } from '@compences/core';
import {
  NOTIFICATIONS_KEY,
  UNREAD_KEY,
  markRead,
  useNotifications,
  useOpenNotification,
} from '../src/lib/notifications';
import { useAuth } from '../src/lib/auth';
import { Body, Button, Caption, Card, EmptyState, Loading, Screen } from '../src/components/ui';
import { radius, spacing } from '../src/lib/theme';
import { useTheme } from '../src/lib/use-theme';

/** Everything the database told this member about, newest first. */
export default function NotificationsScreen() {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const { memberships } = useAuth();
  const { data, isPending, isRefetching, refetch } = useNotifications();
  const open = useOpenNotification();
  const [busy, setBusy] = useState(false);

  const rows = data ?? [];
  const unread = rows.filter((row) => !row.read_at).length;
  const societies = new Map(
    memberships.map((membership) => [membership.community_id, membership.communities?.name]),
  );

  const markAll = async () => {
    setBusy(true);
    await markRead(null);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_KEY] }),
      queryClient.invalidateQueries({ queryKey: [UNREAD_KEY] }),
    ]);
    setBusy(false);
  };

  if (isPending) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  return (
    <Screen>
      <FlatList
        data={rows}
        keyExtractor={(row) => row.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />
        }
        ListHeaderComponent={
          unread ? (
            <View style={{ marginBottom: spacing.sm }}>
              <Button
                label={`Mark all ${unread} as read`}
                variant="secondary"
                onPress={() => void markAll()}
                loading={busy}
              />
            </View>
          ) : null
        }
        ListEmptyComponent={
          <EmptyState
            title="No notifications yet"
            description="Join requests, receipts, bills and new events will show up here."
          />
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${item.read_at ? '' : 'Unread. '}${item.title}`}
            onPress={() => void open(item.read_at ? null : item.id, item.data)}
            style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
          >
            <Card style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}>
              <View
                style={{
                  width: 10,
                  height: 10,
                  marginTop: 6,
                  borderRadius: radius.pill,
                  backgroundColor: item.read_at ? 'transparent' : colors.accent,
                }}
              />
              <View style={{ flex: 1, gap: 2 }}>
                <Body muted={Boolean(item.read_at)}>{item.title}</Body>
                {item.body ? <Caption>{item.body}</Caption> : null}
                <Caption>
                  {relativeTime(item.created_at)}
                  {memberships.length > 1 && item.community_id
                    ? ` · ${societies.get(item.community_id) ?? ''}`
                    : ''}
                </Caption>
              </View>
            </Card>
          </Pressable>
        )}
      />
    </Screen>
  );
}
