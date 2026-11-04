import { useState, type ReactNode } from 'react';
import { Alert, Image, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  BookOpen,
  Briefcase,
  CakeSlice,
  CookingPot,
  Flower2,
  Gift,
  Music,
  Scissors,
  Shapes,
  Sparkles,
  Star,
  Wrench,
  type LucideIcon,
} from 'lucide-react-native';
import {
  LISTING_CATEGORY_LABEL,
  eventVendorSchema,
  formatDate,
  formatRating,
  reviewCountLabel,
  starString,
  type ListingCategory,
} from '@compences/core';
import { useAuth } from '../lib/auth';
import {
  fetchBoard,
  fetchEventVendors,
  hasEnded,
  invalidateMarket,
  matchesSearch,
  onTheBoard,
  sortBoard,
  type Listing,
} from '../lib/market';
import { supabase } from '../lib/supabase';
import { useCommunityData } from '../lib/use-community-data';
import { minTapTarget, radius, spacing } from '../lib/theme';
import { useTheme } from '../lib/use-theme';
import { Badge, Body, Button, Caption, Card, Heading, Input } from './ui';
import { Chip, ChipRow, ErrorText } from './admin-ui';

/**
 * The pieces every marketplace screen shares: a listing's picture, its stars,
 * the card it sits on in a list, the star picker for a review, and the
 * "Vendors" an event names — read on the event's page and chosen on its
 * Manage page.
 */

/** The photo when there is one; otherwise the category's line icon on a tile, so a card is never blank. */
export function ListingThumb({
  uri,
  category,
  size = 64,
}: {
  uri: string | null;
  category: ListingCategory;
  size?: number;
}) {
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);
  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        accessibilityIgnoresInvertColors
        onError={() => setFailed(true)}
        style={{
          width: size,
          height: size,
          borderRadius: radius.sm,
          backgroundColor: colors.surfaceSunken,
        }}
      />
    );
  }
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: radius.sm,
        backgroundColor: colors.surfaceSunken,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <CategoryIcon category={category} size={size * 0.42} color={colors.inkSubtle} />
    </View>
  );
}

/**
 * A line drawing for each kind of listing, the same ones the website uses.
 * Not emoji: neither app shows any (see apps/web/test/premium-look.test.ts).
 */
export const LISTING_CATEGORY_ICON: Record<ListingCategory, LucideIcon> = {
  home_food: CookingPot,
  bakes: CakeSlice,
  tuition: BookOpen,
  music_dance: Music,
  tailoring: Scissors,
  home_decor: Flower2,
  beauty_wellness: Sparkles,
  professional: Briefcase,
  festive: Gift,
  home_services: Wrench,
  other: Shapes,
};

export function CategoryIcon({
  category,
  size = 16,
  color,
}: {
  category: ListingCategory;
  size?: number;
  color: string;
}) {
  const Icon = LISTING_CATEGORY_ICON[category];
  return <Icon size={size} color={color} strokeWidth={1.6} />;
}

/** "★★★★☆ 4.3 · 12 reviews", or "No reviews yet". */
export function RatingLine({ average, count }: { average: number | null; count: number }) {
  const { colors } = useTheme();
  const shown = formatRating(average);
  if (!count || !shown || average === null) return <Caption>{reviewCountLabel(0)}</Caption>;
  return (
    <View
      accessible
      accessibilityLabel={`Rated ${shown} out of 5, ${reviewCountLabel(count)}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
    >
      <Text style={{ color: colors.gold, fontSize: 13, letterSpacing: 1 }}>
        {starString(average)}
      </Text>
      <Caption>
        {shown} · {reviewCountLabel(count)}
      </Caption>
    </View>
  );
}

/** Where a listing stands, for its seller and for whoever moderates. */
export function ListingStatusBadge({ listing }: { listing: Listing }) {
  if (listing.status === 'removed') return <Badge label="Taken down" tone="danger" />;
  if (listing.status === 'paused') return <Badge label="Paused" tone="warning" />;
  if (hasEnded(listing)) return <Badge label="Ended" />;
  return null;
}

/** "Until 12 Nov 2026" for a seasonal listing still on offer; nothing otherwise. */
export function untilLine(listing: Pick<Listing, 'availableUntil'>): string | null {
  return listing.availableUntil ? `Until ${formatDate(listing.availableUntil)}` : null;
}

/** A listing in a list: picture, title, what kind, price, who and where, stars. */
export function ListingCard({
  listing,
  onPress,
  showStatus = false,
}: {
  listing: Listing;
  onPress: () => void;
  /** On "Your listings" and "Taken down", where state is the point. */
  showStatus?: boolean;
}) {
  const until = onTheBoard(listing) ? untilLine(listing) : null;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${listing.title}, ${LISTING_CATEGORY_LABEL[listing.category]}`}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
    >
      <Card style={{ flexDirection: 'row', gap: spacing.md, padding: spacing.md }}>
        <ListingThumb uri={listing.photoUrl} category={listing.category} />
        <View style={{ flex: 1, gap: 3 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Heading>{listing.title}</Heading>
            </View>
            {showStatus ? <ListingStatusBadge listing={listing} /> : null}
          </View>
          <Caption>
            {LISTING_CATEGORY_LABEL[listing.category]}
            {listing.priceNote ? ` · ${listing.priceNote}` : ''}
          </Caption>
          <Caption>{[listing.sellerName, listing.flat].filter(Boolean).join(' · ')}</Caption>
          <RatingLine average={listing.averageRating} count={listing.reviewCount} />
          {until ? <Caption tone="warning">{until}</Caption> : null}
          {showStatus && listing.status === 'removed' && listing.removedReason ? (
            <Caption tone="danger">{listing.removedReason}</Caption>
          ) : null}
        </View>
      </Card>
    </Pressable>
  );
}

/**
 * One to five stars, tapped. Each star is its own button so a screen reader
 * can say "3 stars" and select it, rather than a slider nobody can aim.
 */
export function StarPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: number;
  onChange: (next: number) => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: spacing.xs }}>
      {[1, 2, 3, 4, 5].map((star) => {
        const lit = star <= value;
        return (
          <Pressable
            key={star}
            accessibilityRole="radio"
            accessibilityLabel={`${star} star${star === 1 ? '' : 's'}`}
            accessibilityState={{ checked: value === star, disabled }}
            onPress={disabled ? undefined : () => onChange(star)}
            style={{
              width: minTapTarget,
              height: minTapTarget,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Star
              size={30}
              color={lit ? colors.gold : colors.inkSubtle}
              fill={lit ? colors.gold : 'transparent'}
              strokeWidth={1.6}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

/** A vendor's line: picture, title, what they are doing for the event, who. */
function VendorRow({
  listing,
  note,
  onPress,
  trailing,
}: {
  listing: Listing;
  note: string | null;
  onPress: () => void;
  trailing?: ReactNode;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`${listing.title}${note ? `, ${note}` : ''}`}
        onPress={onPress}
        style={({ pressed }) => ({
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          minHeight: minTapTarget,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <ListingThumb uri={null} category={listing.category} size={44} />
        <View style={{ flex: 1, gap: 2 }}>
          <Body>{listing.title}</Body>
          {note ? <Caption>{note}</Caption> : null}
          <Caption>{[listing.sellerName, listing.flat].filter(Boolean).join(' · ')}</Caption>
        </View>
      </Pressable>
      {trailing}
    </View>
  );
}

/**
 * "Vendors" on an event's page: whose stall, whose snacks, whose rangoli —
 * each a tap away from their listing, to call them or read what neighbours
 * thought. Absent until the committee names one, rather than an empty card
 * on every event.
 */
export function EventVendors({ eventId }: { eventId: string }) {
  const router = useRouter();
  const { data } = useCommunityData(`event-vendors:${eventId}`, () => fetchEventVendors(eventId));
  // Staff see a vendor whose listing has since been taken down, so they can
  // remove it; residents never do, and this card is theirs.
  const vendors = (data ?? []).filter((vendor) => vendor.listing.status === 'active');
  if (!vendors.length) return null;
  return (
    <Card style={{ gap: spacing.md }}>
      <View style={{ gap: 2 }}>
        <Heading>Vendors</Heading>
        <Caption>Neighbours from the marketplace supplying this event.</Caption>
      </View>
      {vendors.map((vendor) => (
        <VendorRow
          key={vendor.id}
          listing={vendor.listing}
          note={vendor.note}
          onPress={() =>
            router.push({ pathname: '/listing/[id]', params: { id: vendor.listing.id } })
          }
        />
      ))}
    </Card>
  );
}

/**
 * Choosing who supplies an event, on its Manage page: the vendors named so
 * far with a way to remove each, and a search over what is on the board to
 * add another, with a few words on what they are doing for it.
 */
export function ManageVendorsCard({ eventId }: { eventId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { activeCommunity, membershipId } = useAuth();
  const vendors = useCommunityData(`event-vendors:${eventId}`, () => fetchEventVendors(eventId));
  const board = useCommunityData('market', (communityId) => fetchBoard(communityId));
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<Listing | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const named = vendors.data ?? [];
  const taken = new Set(named.map((vendor) => vendor.listing.id));
  // Only what is on the board today can be named: the database refuses a
  // listing that is paused or taken down, and an ended one would be a stall
  // nobody is running.
  const candidates = sortBoard(
    (board.data ?? []).filter((listing) => onTheBoard(listing) && !taken.has(listing.id)),
  );
  const matches = search.trim()
    ? candidates.filter((listing) => matchesSearch(listing, search)).slice(0, 8)
    : candidates.slice(0, 5);

  const add = async () => {
    if (!picked || !activeCommunity || !membershipId) return;
    const parsed = eventVendorSchema.safeParse({
      event_id: eventId,
      listing_id: picked.id,
      note,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the note.');
      return;
    }
    setBusy('add');
    setError(null);
    const { error: insertError } = await supabase.from('event_vendors').insert({
      community_id: activeCommunity.id,
      event_id: parsed.data.event_id,
      listing_id: parsed.data.listing_id,
      note: parsed.data.note,
      added_by: membershipId,
    });
    setBusy(null);
    if (insertError) {
      setError(
        insertError.code === '23505'
          ? 'That listing is already a vendor for this event.'
          : 'Could not add that vendor. The listing may no longer be on the marketplace.',
      );
      return;
    }
    setPicked(null);
    setNote('');
    setSearch('');
    invalidateMarket(queryClient);
  };

  const remove = (vendorId: string, title: string) =>
    Alert.alert(`Remove ${title} as a vendor?`, 'Their listing stays on the marketplace.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          setBusy(vendorId);
          void supabase
            .from('event_vendors')
            .delete()
            .eq('id', vendorId)
            .then(({ error: deleteError }) => {
              setBusy(null);
              if (deleteError) {
                Alert.alert('Could not remove that vendor', 'Please try again.');
                return;
              }
              invalidateMarket(queryClient);
            });
        },
      },
    ]);

  return (
    <Card style={{ gap: spacing.md }}>
      <View style={{ gap: 2 }}>
        <Heading>Vendors</Heading>
        <Caption>
          Name a neighbour from the marketplace who is supplying this event. It shows on the event’s
          page, and they are told.
        </Caption>
      </View>

      {named.map((vendor) => (
        <VendorRow
          key={vendor.id}
          listing={vendor.listing}
          note={
            vendor.listing.status === 'active'
              ? vendor.note
              : [vendor.note, 'No longer on the marketplace'].filter(Boolean).join(' · ')
          }
          onPress={() =>
            router.push({ pathname: '/listing/[id]', params: { id: vendor.listing.id } })
          }
          trailing={
            <Chip
              label="Remove"
              disabled={busy !== null}
              onPress={() => remove(vendor.id, vendor.listing.title)}
            />
          }
        />
      ))}

      {picked ? (
        <View style={{ gap: spacing.sm }}>
          <Caption>ADD AS A VENDOR</Caption>
          <VendorRow listing={picked} note={null} onPress={() => setPicked(null)} />
          <Input
            label="What are they doing for the event? (optional)"
            value={note}
            onChangeText={setNote}
            placeholder="e.g. Snacks stall"
            maxLength={120}
          />
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Button label="Cancel" variant="secondary" onPress={() => setPicked(null)} />
            </View>
            <View style={{ flex: 1 }}>
              <Button label="Add vendor" onPress={() => void add()} loading={busy === 'add'} />
            </View>
          </View>
        </View>
      ) : candidates.length ? (
        <View style={{ gap: spacing.sm }}>
          <Input
            value={search}
            onChangeText={setSearch}
            placeholder="Search the marketplace"
            accessibilityLabel="Search the marketplace for a vendor"
            autoCorrect={false}
          />
          <ChipRow>
            {matches.map((listing) => (
              <Chip
                key={listing.id}
                label={`${listing.title}${listing.flat ? ` · ${listing.flat}` : ''}`}
                onPress={() => {
                  setPicked(listing);
                  setError(null);
                }}
              />
            ))}
          </ChipRow>
          {search.trim() && !matches.length ? <Caption>Nothing matches that.</Caption> : null}
        </View>
      ) : board.data ? (
        <Caption>
          {named.length
            ? 'Every listing on the marketplace is already a vendor here.'
            : 'Nothing is on the marketplace yet. Vendors are chosen from it.'}
        </Caption>
      ) : null}
      <ErrorText message={error} />
    </Card>
  );
}
