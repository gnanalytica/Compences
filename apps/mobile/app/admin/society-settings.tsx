import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { COPY, can } from '@compences/core';
import { useAuth } from '../../src/lib/auth';
import { Caption, Card, EmptyState, Screen, Title } from '../../src/components/ui';
import { LinkRow } from '../../src/components/admin-ui';
import { spacing } from '../../src/lib/theme';

/**
 * Everything about the society itself, in one place for the committee. The
 * setup checklist links into these same screens.
 */
export default function SocietySettings() {
  const router = useRouter();
  const { role, activeCommunity } = useAuth();

  if (!can(role, 'roles:manage') || !activeCommunity) {
    return (
      <Screen>
        <EmptyState title="Committee only" />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <View style={{ gap: 2 }}>
          <Title>{activeCommunity.name}</Title>
          <Caption>
            {COPY.societyCode} {activeCommunity.join_code}
          </Caption>
        </View>

        <Card style={{ gap: 0 }}>
          <LinkRow
            label="Society details"
            detail={activeCommunity.address ?? 'Add the society’s address'}
            onPress={() => router.push('/admin/society')}
          />
          <LinkRow
            label="Flats"
            detail="Add, import or remove flats"
            onPress={() => router.push('/admin/flats')}
          />
          <LinkRow
            label="Catalogue"
            detail="Event types, venues, budget categories, activity types, vendors"
            onPress={() => router.push('/admin/catalogue')}
          />
          <LinkRow
            label="UPI ID"
            detail={activeCommunity.upi_vpa ?? 'Not set. Residents can’t pay by UPI yet'}
            onPress={() => router.push('/admin/upi')}
          />
          <LinkRow
            label={`Share ${COPY.societyCode.toLowerCase()}`}
            detail="Invite residents or staff on WhatsApp"
            onPress={() => router.push({ pathname: '/admin/share', params: { for: 'residents' } })}
          />
        </Card>

        <Card style={{ gap: 0 }}>
          <LinkRow
            label="Setup checklist"
            detail={activeCommunity.setup_completed_at ? 'Finished' : 'In progress'}
            onPress={() => router.push('/admin/setup')}
          />
        </Card>
      </ScrollView>
    </Screen>
  );
}
