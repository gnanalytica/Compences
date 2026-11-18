import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { BadgeCheck, HandHeart, Search, Store, Tag, type LucideIcon } from 'lucide-react-native';
import {
  LISTING_KIND_ACTION,
  LISTING_KIND_HINT,
  can,
  isListingKind,
  type ListingKind,
} from '@compences/core';
import { useAuth } from '../../src/lib/auth';
import { fetchBoard, fetchSellerDefaults } from '../../src/lib/market';
import { useCommunityData } from '../../src/lib/use-community-data';
import {
  Body,
  Caption,
  Card,
  EmptyState,
  Heading,
  Loading,
  Screen,
  Title,
} from '../../src/components/ui';
import { Chip, ChipRow } from '../../src/components/admin-ui';
import { ListingForm } from '../../src/components/listing-form';
import { minTapTarget, radius, spacing } from '../../src/lib/theme';
import { useTheme } from '../../src/lib/use-theme';

/** The order the chooser offers them in: the most common first. */
const CHOICES: { kind: ListingKind; icon: LucideIcon }[] = [
  { kind: 'sale', icon: Tag },
  { kind: 'offer', icon: HandHeart },
  { kind: 'wanted', icon: Search },
  { kind: 'shop', icon: Store },
  { kind: 'business', icon: BadgeCheck },
];

/**
 * Posting to the marketplace: first what kind of thing it is, then the form
 * for that kind. A link may name the kind already (`?kind=business`), and
 * then the chooser is skipped. A static segment, so expo-router matches it
 * before listing/[id] and "new" is never read as a listing's id.
 *
 * Residents and the committee may post anything but an outside business;
 * staff and the committee may add one of those. Staff who are not on the
 * committee therefore see only that. A shop is one each, so somebody who has
 * one is not offered another.
 */
export default function NewListing() {
  const params = useLocalSearchParams<{ kind?: string }>();
  const { viewRole, membershipId } = useAuth();
  const [picked, setPicked] = useState<ListingKind | null>(
    isListingKind(params.kind) ? params.kind : null,
  );
  const defaults = useCommunityData(`market:defaults:${membershipId}`, () =>
    fetchSellerDefaults(membershipId ?? ''),
  );
  const board = useCommunityData('market', (communityId) => fetchBoard(communityId));

  const mayPost = can(viewRole, 'marketplace:post');
  const mayAddBusiness = can(viewRole, 'marketplace:business');
  const hasShop = (board.data ?? []).some(
    (listing) => listing.kind === 'shop' && listing.membershipId === membershipId,
  );
  const allowed = CHOICES.filter(({ kind }) =>
    kind === 'business' ? mayAddBusiness : mayPost && !(kind === 'shop' && hasShop),
  );
  // With only one thing they may post (staff, who add businesses and nothing
  // else), there is nothing to choose between.
  const chosen =
    picked && allowed.some((choice) => choice.kind === picked)
      ? picked
      : allowed.length === 1
        ? (allowed[0]?.kind ?? null)
        : null;

  // Staff run the society and do not trade on it; the database refuses it too.
  if (!allowed.length) {
    return (
      <Screen>
        <EmptyState
          title="Residents post here"
          description="Staff can moderate the marketplace but not sell on it."
        />
      </Screen>
    );
  }

  if ((defaults.loading && !defaults.data) || (board.loading && !board.data)) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: chosen ? LISTING_KIND_ACTION[chosen] : 'Post' }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
          keyboardShouldPersistTaps="handled"
        >
          {chosen ? (
            <>
              {/* Picked here rather than handed in by a link: a way back to
                  the other kinds without leaving the screen. */}
              {!isListingKind(params.kind) && allowed.length > 1 ? (
                <ChipRow>
                  <Chip label="Post something else" onPress={() => setPicked(null)} />
                </ChipRow>
              ) : null}
              {/* Mounted once the defaults are in, so the phone field starts
                  filled rather than filling itself in under the seller's thumb. */}
              <ListingForm
                key={chosen}
                kind={chosen}
                existing={null}
                defaults={defaults.data ?? { phone: null, unit: null }}
              />
            </>
          ) : (
            <>
              <View style={{ gap: 2 }}>
                <Title>What are you posting?</Title>
                <Caption>
                  Neighbours call or WhatsApp you from it. Nothing is paid in the app.
                </Caption>
              </View>
              {allowed.map(({ kind, icon }) => (
                <KindChoice key={kind} kind={kind} icon={icon} onPress={() => setPicked(kind)} />
              ))}
            </>
          )}
          <View style={{ height: spacing.xl }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function KindChoice({
  kind,
  icon: Icon,
  onPress,
}: {
  kind: ListingKind;
  icon: LucideIcon;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={LISTING_KIND_ACTION[kind]}
      accessibilityHint={LISTING_KIND_HINT[kind]}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
    >
      <Card
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          minHeight: minTapTarget,
        }}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: radius.sm,
            backgroundColor: colors.surfaceSunken,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon size={22} color={colors.ink} strokeWidth={1.6} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Heading>{LISTING_KIND_ACTION[kind]}</Heading>
          <Body muted>{LISTING_KIND_HINT[kind]}</Body>
        </View>
      </Card>
    </Pressable>
  );
}
