import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { can } from '@compences/core';
import { useAuth } from '../../src/lib/auth';
import { fetchSellerDefaults } from '../../src/lib/market';
import { useCommunityData } from '../../src/lib/use-community-data';
import { Caption, EmptyState, Loading, Screen, Title } from '../../src/components/ui';
import { ListingForm } from '../../src/components/listing-form';
import { spacing } from '../../src/lib/theme';

/**
 * Posting to the marketplace. A static segment, so expo-router matches it
 * before listing/[id] and "new" is never read as a listing's id.
 */
export default function NewListing() {
  const { viewRole, membershipId } = useAuth();
  const { data, loading } = useCommunityData(`market:defaults:${membershipId}`, () =>
    fetchSellerDefaults(membershipId ?? ''),
  );

  // Staff run the society and do not trade on it; the database refuses it too.
  if (!can(viewRole, 'marketplace:post')) {
    return (
      <Screen>
        <EmptyState
          title="Residents post here"
          description="Staff can moderate the marketplace but not sell on it."
        />
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

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ gap: 2 }}>
            <Title>Post a listing</Title>
            <Caption>Tell your neighbours what you make, teach or sell.</Caption>
          </View>
          {/* Mounted once the defaults are in, so the phone field starts
              filled rather than filling itself in under the seller's thumb. */}
          <ListingForm existing={null} defaults={data ?? { phone: null, unit: null }} />
          <View style={{ height: spacing.xl }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
