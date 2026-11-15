import { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { formatDate } from '@compences/core';
import {
  fetchBlocked,
  invalidateAfterModeration,
  unblockMember,
  type BlockedMember,
} from '../src/lib/reports';
import { useCommunityData } from '../src/lib/use-community-data';
import { Body, Button, Caption, Card, EmptyState, Loading, Screen } from '../src/components/ui';
import { ErrorText } from '../src/components/admin-ui';
import { spacing } from '../src/lib/theme';

/**
 * Everybody the viewer has blocked in this society, each with a way back.
 *
 * A block hides what somebody posts — listings, reviews, comments — and is
 * known only to the one who made it. That makes this screen the only place it
 * can be seen at all, so it is always reachable from Me, blocked anybody or
 * not.
 */
export default function Blocked() {
  const { data, loading, refreshing, refresh, error } = useCommunityData('blocked', fetchBlocked);

  if (loading && !data) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  const blocked = data ?? [];

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        <Caption>
          You do not see listings, reviews or comments from anybody here. They are not told, and
          they still see yours.
        </Caption>
        {error ? <Caption tone="danger">{error}</Caption> : null}
        {blocked.length ? (
          blocked.map((member) => <BlockedCard key={member.id} member={member} />)
        ) : (
          <Card>
            <EmptyState
              title="Nobody is blocked"
              description="To block somebody, open one of their listings or reviews and choose Block."
            />
          </Card>
        )}
        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </Screen>
  );
}

function BlockedCard({ member }: { member: BlockedMember }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unblock = async () => {
    setBusy(true);
    setError(null);
    const unblockError = await unblockMember(member.id);
    if (unblockError) {
      setBusy(false);
      setError(unblockError);
      return;
    }
    // The card goes with the refresh; nothing to reset.
    await invalidateAfterModeration(queryClient);
  };

  return (
    <Card style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Body>{member.name}</Body>
          <Caption>Blocked on {formatDate(member.since.slice(0, 10))}</Caption>
        </View>
        <Button
          label="Unblock"
          variant="secondary"
          compact
          onPress={() => void unblock()}
          loading={busy}
        />
      </View>
      <ErrorText message={error} />
    </Card>
  );
}
