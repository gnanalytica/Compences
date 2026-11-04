import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../../src/lib/auth';
import { fetchListing, fetchSellerDefaults } from '../../../src/lib/market';
import { useCommunityData } from '../../../src/lib/use-community-data';
import { EmptyState, Loading, Screen } from '../../../src/components/ui';
import { ListingForm, OwnerActions } from '../../../src/components/listing-form';
import { spacing } from '../../../src/lib/theme';

/**
 * Changing a listing, for its seller. Under listing/edit/ rather than a
 * parameter on listing/[id], so the listing's own page — which notifications
 * open — stays one plain route.
 */
export default function EditListing() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { membershipId } = useAuth();
  const { data, loading } = useCommunityData(`listing:${id}:edit`, async (communityId) => {
    const [detail, defaults] = await Promise.all([
      fetchListing(communityId, String(id)),
      fetchSellerDefaults(membershipId ?? ''),
    ]);
    return detail ? { listing: detail.listing, defaults } : null;
  });

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
        <EmptyState title="Listing not found" description="It may have been deleted." />
      </Screen>
    );
  }

  if (data.listing.membershipId !== membershipId) {
    return (
      <Screen>
        <EmptyState title="Only the seller can edit this" />
      </Screen>
    );
  }

  if (data.listing.status === 'removed') {
    return (
      <Screen>
        <EmptyState
          title="Taken down by the committee"
          description="Ask them to restore it before you change it."
        />
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
          <ListingForm key={data.listing.id} existing={data.listing} defaults={data.defaults} />
          <OwnerActions listing={data.listing} showEdit={false} />
          <View style={{ height: spacing.xl }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
