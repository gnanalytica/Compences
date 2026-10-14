import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { ROLE_LABEL, normalizeRole, type Role } from '@compences/core';
import { useAuth } from '../src/lib/auth';
import { supabase } from '../src/lib/supabase';
import { Badge, Body, Button, Caption, Card, Heading, Screen, Title } from '../src/components/ui';
import { spacing } from '../src/lib/theme';

type Copy = {
  headline: string;
  intro: string;
  points: { title: string; detail: string }[];
  cta: { label: string; href: Href };
};

const COPY: Record<Role, Copy> = {
  resident: {
    headline: 'You’re in',
    intro: 'Your society’s events and every rupee behind them.',
    points: [
      {
        title: 'See what’s coming up',
        detail: 'Festivals and events with their budget and activities.',
      },
      { title: 'Contribute by UPI', detail: 'Pay the society directly from your UPI app.' },
      {
        title: 'Take part',
        detail: 'Register for activities, suggest ideas and vote.',
      },
      {
        title: 'Follow the money',
        detail: 'Every approved bill with its category and vendor, against the budget.',
      },
      {
        title: 'Start a campaign',
        detail: 'The committee reviews each campaign before residents can contribute.',
      },
    ],
    cta: { label: 'See events', href: '/(tabs)/events' },
  },
  staff: {
    headline: 'Welcome to the team',
    intro: 'You run the society day to day. The committee has the final say on money.',
    points: [
      {
        title: 'Admit residents',
        detail: 'Check join requests against the flat and let people in.',
      },
      {
        title: 'Upload bills',
        detail: 'Photograph each bill, pick its category and vendor, and fix any sent back.',
      },
      {
        title: 'Confirm payments',
        detail: 'Match reported UPI payments with the bank statement; record cash.',
      },
      { title: 'Keep the catalogue tidy', detail: 'Categories, venues and vendors events use.' },
    ],
    cta: { label: 'Open join requests', href: '/admin/requests' },
  },
  committee: {
    headline: 'Welcome, committee',
    intro: 'You have the final say: bills, campaigns, suggestions and roles.',
    points: [
      {
        title: 'Finish setting up',
        detail: 'Flats, catalogue, the society’s UPI ID, staff and resident invites.',
      },
      {
        title: 'Approve bills',
        detail: 'Nothing counts as spent until the committee approves it.',
      },
      {
        title: 'Decide on proposals',
        detail: 'Residents’ campaigns and suggestions wait for you before others see them.',
      },
      { title: 'Assign roles', detail: 'Make someone staff or committee from Residents.' },
    ],
    cta: { label: 'Start setup', href: '/admin/setup' },
  },
};

/** Shown once, the first time someone gets in after being admitted. */
export default function Welcome() {
  const router = useRouter();
  const { activeCommunity, role, refresh } = useAuth();
  const [busy, setBusy] = useState<'cta' | 'home' | null>(null);
  const normalized = normalizeRole(role) ?? 'resident';
  const copy = COPY[normalized];
  const cta =
    normalized === 'committee' && activeCommunity?.setup_completed_at
      ? { label: 'Go to Home', href: '/(tabs)' as Href }
      : copy.cta;

  const done = async (target: 'cta' | 'home') => {
    setBusy(target);
    if (activeCommunity) {
      await supabase.rpc('mark_welcomed', { p_community_id: activeCommunity.id });
      await refresh();
    }
    setBusy(null);
    router.replace('/(tabs)');
    if (target === 'cta' && cta.href !== '/(tabs)') router.push(cta.href);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg, paddingTop: 72 }}>
        <View style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row' }}>
            <Badge label={ROLE_LABEL[normalized]} tone="info" />
          </View>
          <Title>{copy.headline}</Title>
          <Body muted>
            {activeCommunity?.name ? `${activeCommunity.name}. ` : ''}
            {copy.intro}
          </Body>
        </View>
        <Card style={{ gap: spacing.md }}>
          {copy.points.map((point) => (
            <View key={point.title} style={{ gap: 2 }}>
              <Heading>{point.title}</Heading>
              <Caption>{point.detail}</Caption>
            </View>
          ))}
        </Card>
        <Button label={cta.label} onPress={() => void done('cta')} loading={busy === 'cta'} />
        {cta.href !== '/(tabs)' ? (
          <Button
            label="Go to Home"
            variant="secondary"
            onPress={() => void done('home')}
            loading={busy === 'home'}
          />
        ) : null}
      </ScrollView>
    </Screen>
  );
}
