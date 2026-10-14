import { useCallback, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { can, setupProgress, setupSteps, type SetupStepId } from '@compences/core';
import { useAuth } from '../../src/lib/auth';
import { supabase } from '../../src/lib/supabase';
import { fetchSetupFacts } from '../../src/lib/setup';
import { useCommunityData } from '../../src/lib/use-community-data';
import {
  Body,
  Button,
  Caption,
  Card,
  EmptyState,
  Loading,
  Screen,
  Title,
} from '../../src/components/ui';
import { ErrorText } from '../../src/components/admin-ui';
import { Meter } from '../../src/components/event-ui';
import { radius, spacing } from '../../src/lib/theme';
import { useTheme } from '../../src/lib/use-theme';

/**
 * The committee's first-time setup: seven steps from society details to the
 * first event. Each step is ticked off by what actually exists (flats added,
 * UPI ID set, staff admitted…), not by pressing a button.
 */
export default function Setup() {
  const router = useRouter();
  const { colors } = useTheme();
  const { role, activeCommunity, refresh: refreshAuth } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const key = `setup:${activeCommunity?.address ?? ''}:${activeCommunity?.upi_vpa ?? ''}:${activeCommunity?.catalogue_reviewed_at ?? ''}`;
  const { data, loading, refreshing, refresh } = useCommunityData(key, async () =>
    activeCommunity ? fetchSetupFacts(activeCommunity) : null,
  );

  // Coming back from a step (flats added, staff admitted) should tick it off.
  useFocusEffect(
    useCallback(() => {
      void queryClient.invalidateQueries({ queryKey: [key] });
    }, [queryClient, key]),
  );

  if (!can(role, 'roles:manage') || !activeCommunity) {
    return (
      <Screen>
        <EmptyState title="Committee only" />
      </Screen>
    );
  }

  if (loading && !data) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  const steps = data ? setupSteps(data) : [];
  const progress = setupProgress(steps);
  const complete = progress.done === progress.total;
  const finished = Boolean(activeCommunity.setup_completed_at);

  const open = (id: SetupStepId) => {
    const routes: Record<SetupStepId, Href> = {
      details: '/admin/society',
      flats: '/admin/flats',
      catalogue: { pathname: '/admin/catalogue', params: { setup: '1' } },
      upi: '/admin/upi',
      staff: { pathname: '/admin/share', params: { for: 'staff' } },
      residents: { pathname: '/admin/share', params: { for: 'residents' } },
      event: '/admin/event/new',
    };
    router.push(routes[id]);
  };

  const finish = async () => {
    setBusy(true);
    setError(null);
    const { error: updateError } = await supabase
      .from('communities')
      .update({ setup_completed_at: new Date().toISOString() })
      .eq('id', activeCommunity.id);
    setBusy(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    await refreshAuth();
    router.back();
  };

  const confirmFinish = () => {
    if (complete) {
      void finish();
      return;
    }
    Alert.alert(
      'Finish setup now?',
      `${progress.total - progress.done} step${progress.total - progress.done === 1 ? ' is' : 's are'} still open. The checklist leaves Home; every step stays under Manage → Society settings.`,
      [
        { text: 'Keep going', style: 'cancel' },
        { text: 'Finish anyway', onPress: () => void finish() },
      ],
    );
  };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        <View style={{ gap: 2 }}>
          <Title>Set up {activeCommunity.name}</Title>
          <Caption>
            {progress.done} of {progress.total} done
            {finished ? ' · setup marked finished' : ''}
          </Caption>
        </View>
        <Meter
          percent={progress.total ? Math.round((progress.done / progress.total) * 100) : 0}
          tone="success"
          label="Setup progress"
        />

        {steps.map((step, index) => (
          <Pressable
            key={step.id}
            accessibilityRole="button"
            onPress={() => open(step.id)}
            style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
          >
            <Card style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: radius.pill,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: step.done ? colors.success : colors.surfaceSunken,
                }}
              >
                <Text
                  style={{
                    color: step.done ? colors.accentInk : colors.inkMuted,
                    fontWeight: '700',
                  }}
                >
                  {step.done ? '✓' : String(index + 1)}
                </Text>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Body>{step.title}</Body>
                <Caption>{step.description}</Caption>
              </View>
              <Text style={{ color: colors.inkSubtle, fontSize: 18 }}>›</Text>
            </Card>
          </Pressable>
        ))}

        <ErrorText message={error} />
        {!finished ? (
          <Button
            label={complete ? 'Finish setup' : 'Finish setup for now'}
            variant={complete ? 'primary' : 'secondary'}
            onPress={confirmFinish}
            loading={busy}
          />
        ) : null}
      </ScrollView>
    </Screen>
  );
}
