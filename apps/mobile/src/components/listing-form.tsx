import { useState } from 'react';
import { Alert, Image, Switch, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  LISTING_CATEGORIES,
  LISTING_CATEGORY_HINT,
  LISTING_CATEGORY_LABEL,
  listingSchema,
  type ListingCategory,
} from '@compences/core';
import { useAuth } from '../lib/auth';
import { invalidateMarket, type Listing } from '../lib/market';
import {
  listingPhotoPath,
  pickFile,
  removeStoredFiles,
  uploadFile,
  type PickSource,
  type PickedFile,
} from '../lib/storage';
import { supabase } from '../lib/supabase';
import { radius, spacing } from '../lib/theme';
import { useTheme } from '../lib/use-theme';
import { DateField, today } from './date-field';
import { Body, Button, Caption, Card, Heading, Input } from './ui';
import { Chip, ChipRow, ErrorText } from './admin-ui';

/** The seller's flat and number, looked up once before the form opens. */
export type SellerDefaults = {
  phone: string | null;
  unit: { id: string; label: string } | null;
};

/**
 * Posting a listing, or changing one. The same form both ways, so what a
 * seller is asked does not depend on whether it is their first time.
 *
 * The photo is only uploaded when the form is saved, as the contribute screen
 * does with a payment screenshot, so backing out leaves nothing in storage.
 * The flat sent is always the one the seller lives in now: the database will
 * not accept a listing that names a flat they have moved out of, so carrying
 * an old one forward would make the listing impossible to edit.
 */
export function ListingForm({
  existing,
  defaults,
}: {
  existing: Listing | null;
  defaults: SellerDefaults;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const { activeCommunity, membershipId } = useAuth();
  const [category, setCategory] = useState<ListingCategory | null>(existing?.category ?? null);
  const [title, setTitle] = useState(existing?.title ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [priceNote, setPriceNote] = useState(existing?.priceNote ?? '');
  const [phone, setPhone] = useState(existing?.contactPhone ?? defaults.phone ?? '');
  const [onWhatsapp, setOnWhatsapp] = useState(existing?.onWhatsapp ?? true);
  const [until, setUntil] = useState<string | null>(existing?.availableUntil ?? null);
  const [photo, setPhoto] = useState<PickedFile | null>(null);
  const [keepPhoto, setKeepPhoto] = useState(Boolean(existing?.photoPath));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const choose = async (source: PickSource) => {
    setPhotoError(null);
    const result = await pickFile(source);
    if (!result) return;
    if ('error' in result) {
      setPhotoError(result.error);
      return;
    }
    setPhoto(result);
  };

  const save = async () => {
    if (!activeCommunity || !membershipId) return;
    const parsed = listingSchema.safeParse({
      category: category ?? '',
      title,
      description,
      price_note: priceNote,
      contact_phone: phone,
      on_whatsapp: onWhatsapp,
      available_until: until ?? '',
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the form and try again.');
      return;
    }
    setBusy(true);
    setError(null);

    let uploaded: string | null = null;
    if (photo) {
      const result = await uploadFile(
        'listing-photos',
        listingPhotoPath(activeCommunity.id, membershipId, photo.name),
        photo,
      );
      if ('error' in result) {
        setBusy(false);
        setError(result.error);
        return;
      }
      uploaded = result.path;
    }
    const previous = existing?.photoPath ?? null;
    const photoPath = uploaded ?? (keepPhoto ? previous : null);
    const fields = { ...parsed.data, unit_id: defaults.unit?.id ?? null, photo_path: photoPath };

    const saved = existing
      ? await supabase
          .from('listings')
          .update(fields)
          .eq('id', existing.id)
          .select('id')
          .maybeSingle()
      : await supabase
          .from('listings')
          .insert({ ...fields, community_id: activeCommunity.id, membership_id: membershipId })
          .select('id')
          .maybeSingle();

    if (saved.error || !saved.data) {
      setBusy(false);
      // The photo went up for a listing that did not; take it back down.
      if (uploaded) void removeStoredFiles('listing-photos', [uploaded]);
      setError(
        saved.error?.message.includes('taken down')
          ? 'The committee took this listing down. Ask them to restore it.'
          : 'That did not save. Check your connection and try again.',
      );
      return;
    }
    // The old picture, once nothing points at it.
    if (previous && previous !== photoPath) void removeStoredFiles('listing-photos', [previous]);
    setBusy(false);
    invalidateMarket(queryClient);
    if (existing) router.back();
    else router.replace({ pathname: '/listing/[id]', params: { id: saved.data.id } });
  };

  const preview = photo?.uri ?? (keepPhoto ? existing?.photoUrl : null) ?? null;

  return (
    <View style={{ gap: spacing.lg }}>
      <Card style={{ gap: spacing.md }}>
        <Heading>What is it?</Heading>
        <ChipRow>
          {LISTING_CATEGORIES.map((option) => (
            <Chip
              key={option}
              label={LISTING_CATEGORY_LABEL[option]}
              selected={category === option}
              onPress={() => setCategory(option)}
            />
          ))}
        </ChipRow>
        <Caption>
          {category
            ? LISTING_CATEGORY_HINT[category]
            : 'Pick the closest fit. Neighbours browse by these.'}
        </Caption>
        <Input
          label="Title"
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Fresh idly & dosa batter"
          maxLength={120}
        />
        <Input
          label="Details (optional)"
          value={description}
          onChangeText={setDescription}
          placeholder="What you make or teach, when, how to order or collect"
          multiline
          maxLength={2000}
          style={{ minHeight: 110, textAlignVertical: 'top' }}
        />
        <Input
          label="Price (optional)"
          value={priceNote}
          onChangeText={setPriceNote}
          placeholder="e.g. ₹60 a kg, ₹1,500 a month, On request"
          maxLength={80}
        />
      </Card>

      <Card style={{ gap: spacing.md }}>
        <Heading>How neighbours reach you</Heading>
        <Input
          label="Phone"
          value={phone}
          onChangeText={setPhone}
          placeholder="98765 43210"
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
        />
        <Caption>Shown on this listing only. The number on your profile stays private.</Caption>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Body>On WhatsApp</Body>
            <Caption>Adds a WhatsApp button next to Call.</Caption>
          </View>
          <Switch
            value={onWhatsapp}
            onValueChange={setOnWhatsapp}
            accessibilityLabel="This number is on WhatsApp"
            trackColor={{ true: colors.accent, false: colors.border }}
          />
        </View>
        {defaults.unit ? (
          <Caption>Neighbours will see it is from {defaults.unit.label}.</Caption>
        ) : null}
      </Card>

      <Card style={{ gap: spacing.md }}>
        <DateField
          label="Available until (optional)"
          value={until}
          onChange={setUntil}
          minimumDate={today()}
          clearable
          placeholder="Always — no end date"
        />
        <Caption>
          For something seasonal, like crackers before Diwali. It leaves the marketplace by itself
          after this day.
        </Caption>
      </Card>

      <Card style={{ gap: spacing.md }}>
        <Heading>Photo (optional)</Heading>
        {preview ? (
          <View style={{ gap: spacing.sm }}>
            <Image
              source={{ uri: preview }}
              accessibilityLabel="Listing photo"
              resizeMode="cover"
              style={{
                width: '100%',
                aspectRatio: 4 / 3,
                borderRadius: radius.md,
                backgroundColor: colors.surfaceSunken,
              }}
            />
            <ChipRow>
              <Chip
                label="Remove photo"
                onPress={() => {
                  setPhoto(null);
                  setKeepPhoto(false);
                }}
              />
            </ChipRow>
          </View>
        ) : (
          <Caption>A picture of the food, the work or the class helps neighbours decide.</Caption>
        )}
        <ChipRow>
          <Chip label="Take photo" onPress={() => void choose('camera')} />
          <Chip
            label={preview ? 'Choose another' : 'Choose image'}
            onPress={() => void choose('library')}
          />
        </ChipRow>
        <ErrorText message={photoError} />
      </Card>

      <ErrorText message={error} />
      <Button
        label={existing ? 'Save changes' : 'Post to the marketplace'}
        onPress={() => void save()}
        loading={busy}
      />
    </View>
  );
}

/**
 * What a seller can do with their own listing besides edit it: pause it while
 * they are away, put it back, or delete it. A listing the committee took down
 * can only be deleted — the database will not let its seller re-open it.
 */
export function OwnerActions({
  listing,
  showEdit = true,
}: {
  listing: Listing;
  /** Off on the edit screen itself, where an Edit button would lead nowhere. */
  showEdit?: boolean;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  const setStatus = async (status: 'active' | 'paused') => {
    setBusy(status);
    const { error } = await supabase.from('listings').update({ status }).eq('id', listing.id);
    setBusy(null);
    if (error) {
      Alert.alert('That did not go through', 'Pull down to refresh and try again.');
      return;
    }
    invalidateMarket(queryClient);
  };

  const remove = () =>
    Alert.alert('Delete this listing?', 'Its reviews go with it. This cannot be undone.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setBusy('delete');
          void supabase
            .from('listings')
            .delete()
            .eq('id', listing.id)
            .then(({ error }) => {
              setBusy(null);
              if (error) {
                Alert.alert('Could not delete it', 'Please try again.');
                return;
              }
              void removeStoredFiles('listing-photos', [listing.photoPath]);
              invalidateMarket(queryClient);
              router.replace('/market');
            });
        },
      },
    ]);

  const removed = listing.status === 'removed';
  return (
    <Card style={{ gap: spacing.md }}>
      <View style={{ gap: 2 }}>
        <Heading>Your listing</Heading>
        <Caption>
          {removed
            ? 'The committee took this down. Ask them if you would like it back.'
            : listing.status === 'paused'
              ? 'Paused: neighbours cannot see it until you resume it.'
              : 'On the marketplace. Pause it while you are away or out of stock.'}
        </Caption>
      </View>
      {removed ? null : (
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {showEdit ? (
            <View style={{ flex: 1 }}>
              <Button
                label="Edit"
                variant="secondary"
                disabled={busy !== null}
                onPress={() =>
                  router.push({ pathname: '/listing/edit/[id]', params: { id: listing.id } })
                }
              />
            </View>
          ) : null}
          <View style={{ flex: 1 }}>
            <Button
              label={listing.status === 'paused' ? 'Resume' : 'Pause'}
              variant="secondary"
              loading={busy === 'active' || busy === 'paused'}
              disabled={busy !== null}
              onPress={() => void setStatus(listing.status === 'paused' ? 'active' : 'paused')}
            />
          </View>
        </View>
      )}
      <Button
        label="Delete listing"
        variant="secondary"
        loading={busy === 'delete'}
        disabled={busy !== null}
        onPress={remove}
      />
    </Card>
  );
}
