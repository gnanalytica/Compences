import { useState, type ReactNode } from 'react';
import {
  Alert,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { MessageCircle, Phone } from 'lucide-react-native';
import {
  LISTING_CATEGORY_EMOJI,
  LISTING_CATEGORY_LABEL,
  can,
  formatDate,
  formatRating,
  listingEnquiryText,
  listingReviewSchema,
  reviewCountLabel,
  starString,
  telLink,
  whatsappLink,
} from '@compences/core';
import { useAuth } from '../../src/lib/auth';
import {
  fetchListing,
  hasEnded,
  invalidateMarket,
  type ListingDetail,
  type ListingReview,
} from '../../src/lib/market';
import { supabase } from '../../src/lib/supabase';
import { useCommunityData } from '../../src/lib/use-community-data';
import {
  Body,
  Button,
  Caption,
  Card,
  EmptyState,
  Heading,
  Input,
  Loading,
  Screen,
  Title,
} from '../../src/components/ui';
import { Chip, ChipRow, ErrorText } from '../../src/components/admin-ui';
import { ListingStatusBadge, StarPicker, untilLine } from '../../src/components/market-ui';
import { OwnerActions } from '../../src/components/listing-form';
import { fonts, minTapTarget, radius, spacing } from '../../src/lib/theme';
import { useTheme } from '../../src/lib/use-theme';

/**
 * One listing: its picture and details, a way to call or WhatsApp the seller,
 * what neighbours thought of it, and the events it has supplied.
 *
 * Notifications for a new review or a listing taken down open here, so it has
 * to make sense to the seller as much as to a buyer: the seller sees their
 * own controls and why it went, if it went, in place of the Call button.
 */
export default function ListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { membershipId, viewRole } = useAuth();

  const { data, loading, refreshing, refresh } = useCommunityData(`listing:${id}`, (communityId) =>
    fetchListing(communityId, String(id)),
  );

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
        <EmptyState
          title="Listing not found"
          description="It may have been paused, taken down or deleted."
        />
      </Screen>
    );
  }

  const { listing, reviews, vendorFor } = data;
  const mine = listing.membershipId === membershipId;
  const mayModerate = can(viewRole, 'marketplace:moderate') && !mine;
  const myReview = reviews.find((review) => review.membershipId === membershipId) ?? null;
  // A new review needs the listing on the board; one already written can
  // still be changed or withdrawn, as the database allows.
  const mayReview =
    can(viewRole, 'marketplace:review') && !mine && (listing.status === 'active' || !!myReview);
  const others = reviews.filter((review) => review.id !== myReview?.id);
  const until = untilLine(listing);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        keyboardShouldPersistTaps="handled"
      >
        {listing.photoUrl ? (
          <Image
            source={{ uri: listing.photoUrl }}
            accessibilityLabel={`Photo of ${listing.title}`}
            resizeMode="cover"
            style={{
              width: '100%',
              aspectRatio: 4 / 3,
              borderRadius: radius.lg,
              backgroundColor: colors.surfaceSunken,
            }}
          />
        ) : null}

        <View style={{ gap: spacing.xs }}>
          <Caption>
            {LISTING_CATEGORY_EMOJI[listing.category]} {LISTING_CATEGORY_LABEL[listing.category]}
          </Caption>
          <Title>{listing.title}</Title>
          {listing.priceNote ? <Heading>{listing.priceNote}</Heading> : null}
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: spacing.sm,
            }}
          >
            <ListingStatusBadge listing={listing} />
            {until ? (
              <Caption tone={hasEnded(listing) ? undefined : 'warning'}>
                {hasEnded(listing) ? `Last day was ${formatDate(listing.availableUntil)}` : until}
              </Caption>
            ) : null}
          </View>
        </View>

        {listing.status === 'removed' ? (
          <Card style={{ gap: spacing.xs }}>
            <Heading>Taken down by the committee</Heading>
            <Body muted>{listing.removedReason ?? 'No reason was given.'}</Body>
          </Card>
        ) : null}

        <Card style={{ gap: spacing.md }}>
          <View style={{ gap: 2 }}>
            <Caption>OFFERED BY</Caption>
            <Heading>{[listing.sellerName, listing.flat].filter(Boolean).join(' · ')}</Heading>
          </View>
          {mine ? (
            <Caption>
              This is your listing. Neighbours see the number {listing.contactPhone}.
            </Caption>
          ) : (
            <ContactButtons data={data} />
          )}
        </Card>

        {listing.description ? (
          <Card>
            <Body>{listing.description}</Body>
          </Card>
        ) : null}

        {vendorFor.length ? (
          <Card style={{ gap: spacing.sm }}>
            <Heading>Vendor for</Heading>
            {vendorFor.map((vendor) =>
              vendor.event ? (
                <Pressable
                  key={vendor.id}
                  accessibilityRole="link"
                  onPress={() =>
                    router.push({
                      pathname: '/event/[slug]',
                      params: { slug: vendor.event?.slug ?? '' },
                    })
                  }
                  style={({ pressed }) => ({
                    minHeight: minTapTarget,
                    justifyContent: 'center',
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Body>
                    {vendor.event.emoji ? `${vendor.event.emoji} ` : ''}
                    {vendor.event.name} ›
                  </Body>
                  <Caption>
                    {[vendor.note, formatDate(vendor.event.startsOn)].filter(Boolean).join(' · ')}
                  </Caption>
                </Pressable>
              ) : null,
            )}
          </Card>
        ) : null}

        <Reviews
          data={data}
          others={others}
          myReview={myReview}
          mayReview={mayReview}
          // Not on their own listing: a seller who moderates should not be the
          // one deciding which of their reviews stand.
          mayModerate={mayModerate}
        />

        {mine ? <OwnerActions listing={listing} /> : null}
        {mayModerate ? <Moderation data={data} /> : null}

        <Caption>Posted {formatDate(listing.createdAt.slice(0, 10))}</Caption>
        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </Screen>
  );
}

/**
 * Call, and WhatsApp when the seller said the number is on it. WhatsApp opens
 * with a line saying where the buyer saw the listing, so the seller is not
 * left wondering who this stranger is.
 */
function ContactButtons({ data }: { data: ListingDetail }) {
  const { colors } = useTheme();
  const { activeCommunity } = useAuth();
  const { listing } = data;

  const open = (url: string, what: string) => {
    Linking.openURL(url).catch(() =>
      Alert.alert(`Could not open ${what}`, `You can reach them on ${listing.contactPhone}.`),
    );
  };

  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
      <ContactButton
        label="Call"
        icon={<Phone size={18} color={colors.surface} strokeWidth={2} />}
        primary
        onPress={() => open(telLink(listing.contactPhone), 'the phone')}
      />
      {listing.onWhatsapp ? (
        <ContactButton
          label="WhatsApp"
          icon={<MessageCircle size={18} color={colors.ink} strokeWidth={2} />}
          onPress={() =>
            open(
              whatsappLink(
                listing.contactPhone,
                listingEnquiryText(listing.title, activeCommunity?.name ?? 'society'),
              ),
              'WhatsApp',
            )
          }
        />
      ) : null}
    </View>
  );
}

function ContactButton({
  label,
  icon,
  onPress,
  primary = false,
}: {
  label: string;
  icon: ReactNode;
  onPress: () => void;
  primary?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        minHeight: 48,
        borderRadius: radius.md,
        backgroundColor: primary ? colors.ink : colors.surfaceRaised,
        borderColor: colors.border,
        borderWidth: primary ? 0 : 1,
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}
    >
      {icon}
      <Text
        style={{ color: primary ? colors.surface : colors.ink, fontSize: 15, fontWeight: '600' }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Reviews({
  data,
  others,
  myReview,
  mayReview,
  mayModerate,
}: {
  data: ListingDetail;
  others: ListingReview[];
  myReview: ListingReview | null;
  mayReview: boolean;
  mayModerate: boolean;
}) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const { listing } = data;
  const average = formatRating(listing.averageRating);

  const removeReview = (review: ListingReview) =>
    Alert.alert('Delete this review?', `${review.reviewerName}’s review will be removed.`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void supabase
            .from('listing_reviews')
            .delete()
            .eq('id', review.id)
            .then(({ error }) => {
              if (error) {
                Alert.alert('Could not delete that review', 'Please try again.');
                return;
              }
              invalidateMarket(queryClient);
            });
        },
      },
    ]);

  return (
    <Card style={{ gap: spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Heading>Reviews</Heading>
          <Caption>{reviewCountLabel(listing.reviewCount)}</Caption>
        </View>
        {average && listing.averageRating !== null ? (
          <View
            accessible
            accessibilityLabel={`Rated ${average} out of 5`}
            style={{ alignItems: 'flex-end' }}
          >
            <Text style={{ color: colors.ink, fontFamily: fonts.serif, fontSize: 26 }}>
              {average}
            </Text>
            <Text style={{ color: colors.gold, fontSize: 13, letterSpacing: 1 }}>
              {starString(listing.averageRating)}
            </Text>
          </View>
        ) : null}
      </View>

      {mayReview ? <ReviewForm key={myReview?.id ?? 'new'} data={data} mine={myReview} /> : null}

      {others.map((review) => (
        <View
          key={review.id}
          style={{
            gap: 4,
            paddingTop: spacing.md,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Body>{review.reviewerName}</Body>
            </View>
            <Caption>{formatDate(review.updatedAt.slice(0, 10))}</Caption>
          </View>
          <View accessible accessibilityLabel={`${review.rating} out of 5 stars`}>
            <Caption>{starString(review.rating)}</Caption>
          </View>
          {review.body ? <Body muted>{review.body}</Body> : null}
          {mayModerate ? (
            <ChipRow>
              <Chip label="Delete review" onPress={() => removeReview(review)} />
            </ChipRow>
          ) : null}
        </View>
      ))}

      {!others.length && !mayReview ? <Caption>Nobody has reviewed this yet.</Caption> : null}
    </Card>
  );
}

/**
 * The viewer's own review: stars and a few words, saved over the last one
 * rather than added beside it — one neighbour, one review.
 */
function ReviewForm({ data, mine }: { data: ListingDetail; mine: ListingReview | null }) {
  const queryClient = useQueryClient();
  const { activeCommunity, membershipId } = useAuth();
  const [rating, setRating] = useState(mine?.rating ?? 0);
  const [body, setBody] = useState(mine?.body ?? '');
  const [busy, setBusy] = useState<'save' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    if (!activeCommunity || !membershipId) return;
    const parsed = listingReviewSchema.safeParse({ listing_id: data.listing.id, rating, body });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Choose from one to five stars');
      return;
    }
    setBusy('save');
    setError(null);
    // A review already written is changed in place. An upsert would also be
    // held to the insert rule — the listing must be on the board — and so
    // could not fix a typo on a listing its seller has since paused. A new
    // one is an upsert, so a second tap from another phone replaces rather
    // than collides with the first.
    const { error: saveError } = mine
      ? await supabase
          .from('listing_reviews')
          .update({ rating: parsed.data.rating, body: parsed.data.body })
          .eq('id', mine.id)
      : await supabase.from('listing_reviews').upsert(
          {
            community_id: activeCommunity.id,
            listing_id: parsed.data.listing_id,
            membership_id: membershipId,
            rating: parsed.data.rating,
            body: parsed.data.body,
          },
          { onConflict: 'listing_id,membership_id' },
        );
    setBusy(null);
    if (saveError) {
      setError('Your review did not go through. The listing may no longer be on the marketplace.');
      return;
    }
    setSaved(true);
    invalidateMarket(queryClient);
  };

  const remove = () =>
    Alert.alert('Delete your review?', undefined, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          if (!mine) return;
          setBusy('delete');
          void supabase
            .from('listing_reviews')
            .delete()
            .eq('id', mine.id)
            .then(({ error: deleteError }) => {
              setBusy(null);
              if (deleteError) {
                setError('Could not delete your review. Please try again.');
                return;
              }
              invalidateMarket(queryClient);
            });
        },
      },
    ]);

  return (
    <View style={{ gap: spacing.sm }}>
      <Caption>{mine ? 'YOUR REVIEW' : 'BOUGHT FROM THEM? LEAVE A REVIEW'}</Caption>
      <StarPicker
        value={rating}
        onChange={(next) => {
          setRating(next);
          setSaved(false);
        }}
        disabled={busy !== null}
      />
      <Input
        value={body}
        onChangeText={(value) => {
          setBody(value);
          setSaved(false);
        }}
        placeholder="A few words for your neighbours (optional)"
        accessibilityLabel="Your review"
        multiline
        maxLength={1000}
        style={{ minHeight: 80, textAlignVertical: 'top' }}
      />
      <Button
        label={mine ? 'Update review' : 'Post review'}
        onPress={() => void save()}
        loading={busy === 'save'}
        disabled={busy !== null || rating < 1}
      />
      {mine ? (
        <Button
          label="Delete my review"
          variant="secondary"
          onPress={remove}
          loading={busy === 'delete'}
          disabled={busy !== null}
        />
      ) : null}
      {saved ? <Caption>Thank you — the seller has been told.</Caption> : null}
      <ErrorText message={error} />
    </View>
  );
}

/**
 * For staff and the committee: take somebody's listing down, with a reason the
 * seller is sent, or put it back. Only the status changes; the words on it
 * stay the seller's, and the database holds them to that.
 */
function Moderation({ data }: { data: ListingDetail }) {
  const queryClient = useQueryClient();
  const { listing } = data;
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const removed = listing.status === 'removed';

  const apply = async (status: 'removed' | 'active') => {
    setBusy(true);
    setError(null);
    const { error: updateError } = await supabase
      .from('listings')
      .update(
        status === 'removed'
          ? { status, removed_reason: reason.trim().slice(0, 500) || null }
          : { status, removed_reason: null },
      )
      .eq('id', listing.id);
    setBusy(false);
    if (updateError) {
      setError('That did not go through. Pull down to refresh and try again.');
      return;
    }
    setReason('');
    invalidateMarket(queryClient);
  };

  const takeDown = () =>
    Alert.alert(
      'Take this listing down?',
      'It leaves the marketplace and the seller is told why. You can restore it later.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Take down', style: 'destructive', onPress: () => void apply('removed') },
      ],
    );

  return (
    <Card style={{ gap: spacing.md }}>
      <View style={{ gap: 2 }}>
        <Heading>Moderation</Heading>
        <Caption>
          {removed
            ? 'Taken down. Restoring puts it back on the marketplace as the seller left it.'
            : 'If this breaks the society’s rules, take it down. The seller is told why.'}
        </Caption>
      </View>
      {removed ? (
        <Button
          label="Restore listing"
          variant="secondary"
          onPress={() => void apply('active')}
          loading={busy}
        />
      ) : (
        <>
          <Input
            label="Reason for the seller"
            value={reason}
            onChangeText={setReason}
            placeholder="e.g. Not allowed under the society’s bye-laws"
            multiline
            maxLength={500}
          />
          <Button label="Take down" variant="secondary" onPress={takeDown} loading={busy} />
        </>
      )}
      <ErrorText message={error} />
    </Card>
  );
}
