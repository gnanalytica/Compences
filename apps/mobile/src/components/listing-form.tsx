import { useState } from 'react';
import { Alert, Image, Pressable, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  KIND_CATEGORIES,
  LISTING_CATEGORY_HINT,
  LISTING_CATEGORY_LABEL,
  LISTING_KIND_PRICE,
  LISTING_KIND_TITLE,
  MAX_LISTING_PHOTOS,
  closedLabel,
  isOnceOffKind,
  isReviewedKind,
  listingSchema,
  type ListingCategory,
  type ListingKind,
} from '@compences/core';
import { useAuth } from '../lib/auth';
import { invalidateMarket, type Listing } from '../lib/market';
import {
  listingPhotoPath,
  pickFile,
  pickImages,
  removeStoredFiles,
  uploadFile,
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

/** What the details box asks for, kind by kind. */
const DETAILS_PLACEHOLDER: Record<ListingKind, string> = {
  offer: 'What you make or teach, when, how to order or collect',
  sale: 'How old it is, what condition it is in, where to collect it',
  wanted: 'What you need it for, for how long, and whether to buy or borrow',
  shop: 'What you sell, when you take orders, how neighbours collect',
  business: 'What they do, when they come, anything the committee knows of them',
};

/** What the photos are for, kind by kind. */
const PHOTO_HINT: Record<ListingKind, string> = {
  offer: 'A picture of the food, the work or the class helps neighbours decide.',
  sale: 'A few sides, and any wear, save a lot of questions.',
  wanted: 'A photo of the kind of thing you mean helps, if you have one.',
  shop: 'The first is your shop’s cover: your food, your work, your sign.',
  business: 'Their shop front, their van, or their work.',
};

/** What the last day is for, on the kinds that have one. */
const UNTIL_HINT: Partial<Record<ListingKind, string>> = {
  offer:
    'For something seasonal, like crackers before Diwali. It leaves the marketplace by itself after this day.',
  sale: 'If it has to go by a date — before you move, say. It leaves the marketplace by itself after this day.',
  wanted: 'When you stop needing it. It leaves the marketplace by itself after this day.',
};

const SUBMIT_LABEL: Record<ListingKind, string> = {
  offer: 'Post to the marketplace',
  sale: 'Put it up for sale',
  wanted: 'Post what you are looking for',
  shop: 'Open the shop',
  business: 'Add the business',
};

/**
 * One photo on the form: already stored (with the path it is stored at), or
 * just picked and not yet uploaded. `uri` is what the thumbnail shows.
 */
type FormPhoto = {
  key: string;
  uri: string | null;
  stored: string | null;
  file: PickedFile | null;
};

/**
 * Posting a listing, or changing one. The same form both ways, so what a
 * seller is asked does not depend on whether it is their first time, and the
 * same form for every kind, with the words changed to fit: an asking price
 * for a cycle, a budget for something wanted, rates for a business.
 *
 * Photos are only uploaded when the form is saved, as the contribute screen
 * does with a payment screenshot, so backing out leaves nothing in storage.
 * The first is the cover. Each goes into the poster's own folder — for an
 * outside business that is whichever of the committee is editing it, which
 * the database accepts for a business and nothing else.
 *
 * The flat sent is always the one the seller lives in now: the database will
 * not accept a listing that names a flat they have moved out of, so carrying
 * an old one forward would make the listing impossible to edit. An outside
 * business has no flat at all.
 */
export function ListingForm({
  kind,
  existing,
  defaults,
}: {
  kind: ListingKind;
  existing: Listing | null;
  defaults: SellerDefaults;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const { activeCommunity, membershipId } = useAuth();
  const business = kind === 'business';
  const [category, setCategory] = useState<ListingCategory | null>(existing?.category ?? null);
  const [title, setTitle] = useState(existing?.title ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [priceNote, setPriceNote] = useState(existing?.priceNote ?? '');
  // A business's own number, never the committee member's.
  const [phone, setPhone] = useState(
    existing?.contactPhone ?? (business ? '' : (defaults.phone ?? '')),
  );
  const [onWhatsapp, setOnWhatsapp] = useState(existing?.onWhatsapp ?? true);
  const [until, setUntil] = useState<string | null>(existing?.availableUntil ?? null);
  const [photos, setPhotos] = useState<FormPhoto[]>(
    (existing?.photoPaths ?? []).map((path, index) => ({
      key: path,
      uri: existing?.photoUrls[index] ?? null,
      stored: path,
      file: null,
    })),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  // A shop and a business are there until somebody takes them away.
  const hasLastDay = kind !== 'shop' && kind !== 'business';
  // The category it already has stays on the list, even if this kind's short
  // list would not offer it.
  const options = KIND_CATEGORIES[kind].includes(existing?.category as ListingCategory)
    ? KIND_CATEGORIES[kind]
    : existing
      ? [existing.category, ...KIND_CATEGORIES[kind]]
      : KIND_CATEGORIES[kind];
  const room = MAX_LISTING_PHOTOS - photos.length;

  const addPicked = (files: PickedFile[]) =>
    setPhotos((current) =>
      [
        ...current,
        ...files.map((file, index) => ({
          key: `${file.uri}#${Date.now()}-${index}`,
          uri: file.uri,
          stored: null,
          file,
        })),
      ].slice(0, MAX_LISTING_PHOTOS),
    );

  const takePhoto = async () => {
    setPhotoError(null);
    const result = await pickFile('camera');
    if (!result) return;
    if ('error' in result) {
      setPhotoError(result.error);
      return;
    }
    addPicked([result]);
  };

  const choosePhotos = async () => {
    setPhotoError(null);
    const picked = await pickImages(room);
    if (picked?.length) addPicked(picked);
  };

  const photoMenu = (photo: FormPhoto, index: number) =>
    Alert.alert(
      index === 0 ? 'The cover photo' : `Photo ${index + 1}`,
      index === 0 ? 'Neighbours see this one first, on the card.' : undefined,
      [
        ...(index > 0
          ? [
              {
                text: 'Make it the cover',
                onPress: () =>
                  setPhotos((current) => [photo, ...current.filter((p) => p.key !== photo.key)]),
              },
            ]
          : []),
        {
          text: 'Remove',
          style: 'destructive' as const,
          onPress: () => setPhotos((current) => current.filter((p) => p.key !== photo.key)),
        },
        { text: 'Cancel', style: 'cancel' as const },
      ],
    );

  const save = async () => {
    if (!activeCommunity || !membershipId) return;
    const parsed = listingSchema.safeParse({
      kind,
      category: category ?? '',
      title,
      description,
      price_note: priceNote,
      contact_phone: phone,
      on_whatsapp: onWhatsapp,
      available_until: hasLastDay ? (until ?? '') : '',
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the form and try again.');
      return;
    }
    setBusy(true);
    setError(null);

    // Up they go in the order they are shown, which is the order they are
    // kept: the first is the cover.
    const uploaded: string[] = [];
    const paths: string[] = [];
    for (const photo of photos) {
      if (photo.stored) {
        paths.push(photo.stored);
        continue;
      }
      if (!photo.file) continue;
      const result = await uploadFile(
        'listing-photos',
        listingPhotoPath(activeCommunity.id, membershipId, photo.file.name),
        photo.file,
      );
      if ('error' in result) {
        void removeStoredFiles('listing-photos', uploaded);
        setBusy(false);
        setError(result.error);
        return;
      }
      uploaded.push(result.path);
      paths.push(result.path);
    }

    // The kind is said once, when it is posted; the database will not let it
    // change, so an edit does not send it at all.
    const { kind: _kind, ...rest } = parsed.data;
    const fields = {
      ...rest,
      unit_id: business ? null : (defaults.unit?.id ?? null),
      photo_paths: paths,
    };

    const saved = existing
      ? await supabase
          .from('listings')
          .update(fields)
          .eq('id', existing.id)
          .select('id')
          .maybeSingle()
      : await supabase
          .from('listings')
          .insert({
            ...fields,
            kind: parsed.data.kind,
            community_id: activeCommunity.id,
            membership_id: membershipId,
          })
          .select('id')
          .maybeSingle();

    if (saved.error || !saved.data) {
      setBusy(false);
      // The photos went up for a listing that did not; take them back down.
      void removeStoredFiles('listing-photos', uploaded);
      const message = saved.error?.message ?? '';
      setError(
        message.includes('taken down')
          ? 'The committee took this listing down. Ask them to restore it.'
          : message.includes('already have a shop')
            ? 'You already have a shop here. Edit it rather than opening another.'
            : 'That did not save. Check your connection and try again.',
      );
      return;
    }
    // The photos that were taken off, once nothing points at them.
    const dropped = (existing?.photoPaths ?? []).filter((path) => !paths.includes(path));
    if (dropped.length) void removeStoredFiles('listing-photos', dropped);
    setBusy(false);
    invalidateMarket(queryClient);
    if (existing) router.back();
    else router.replace({ pathname: '/listing/[id]', params: { id: saved.data.id } });
  };

  const price = LISTING_KIND_PRICE[kind];
  const titleCopy = LISTING_KIND_TITLE[kind];

  return (
    <View style={{ gap: spacing.lg }}>
      <Card style={{ gap: spacing.md }}>
        <Heading>What is it?</Heading>
        <ChipRow>
          {options.map((option) => (
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
          label={titleCopy.label}
          value={title}
          onChangeText={setTitle}
          placeholder={`e.g. ${titleCopy.placeholder}`}
          maxLength={120}
        />
        <Input
          label="Details (optional)"
          value={description}
          onChangeText={setDescription}
          placeholder={DETAILS_PLACEHOLDER[kind]}
          multiline
          maxLength={2000}
          style={{ minHeight: 110, textAlignVertical: 'top' }}
        />
        <Input
          label={`${price.label} (optional)`}
          value={priceNote}
          onChangeText={setPriceNote}
          placeholder={`e.g. ${price.placeholder}`}
          maxLength={80}
        />
      </Card>

      <Card style={{ gap: spacing.md }}>
        <Heading>{business ? 'How residents reach them' : 'How neighbours reach you'}</Heading>
        <Input
          label="Phone"
          value={phone}
          onChangeText={setPhone}
          placeholder="98765 43210"
          keyboardType="phone-pad"
          autoComplete={business ? 'off' : 'tel'}
          textContentType={business ? 'none' : 'telephoneNumber'}
        />
        <Caption>
          {business
            ? 'The business’s own number, shown on this listing.'
            : 'Shown on this listing only. The number on your profile stays private.'}
        </Caption>
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
        {!business && defaults.unit ? (
          <Caption>Neighbours will see it is from {defaults.unit.label}.</Caption>
        ) : null}
      </Card>

      {hasLastDay ? (
        <Card style={{ gap: spacing.md }}>
          <DateField
            label="Available until (optional)"
            value={until}
            onChange={setUntil}
            minimumDate={today()}
            clearable
            placeholder="Always — no end date"
          />
          <Caption>{UNTIL_HINT[kind]}</Caption>
        </Card>
      ) : null}

      <Card style={{ gap: spacing.md }}>
        <View style={{ gap: 2 }}>
          <Heading>Photos (optional)</Heading>
          <Caption>
            {photos.length
              ? `${photos.length} of ${MAX_LISTING_PHOTOS}. Tap one to make it the cover or remove it.`
              : `${PHOTO_HINT[kind]} Up to ${MAX_LISTING_PHOTOS}.`}
          </Caption>
        </View>
        {photos.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {photos.map((photo, index) => (
              <Pressable
                key={photo.key}
                accessibilityRole="button"
                accessibilityLabel={
                  index === 0
                    ? 'Cover photo. Tap to remove it.'
                    : `Photo ${index + 1}. Tap for more.`
                }
                onPress={() => photoMenu(photo, index)}
                style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
              >
                {photo.uri ? (
                  <Image
                    source={{ uri: photo.uri }}
                    accessibilityIgnoresInvertColors
                    resizeMode="cover"
                    style={{
                      width: 92,
                      height: 92,
                      borderRadius: radius.sm,
                      backgroundColor: colors.surfaceSunken,
                    }}
                  />
                ) : (
                  <View
                    style={{
                      width: 92,
                      height: 92,
                      borderRadius: radius.sm,
                      backgroundColor: colors.surfaceSunken,
                    }}
                  />
                )}
                {index === 0 ? (
                  // Solid, not the usual tinted badge: over a photo a 10%
                  // tint is unreadable.
                  <View
                    style={{
                      position: 'absolute',
                      left: 4,
                      bottom: 4,
                      borderRadius: radius.pill,
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      backgroundColor: colors.ink,
                    }}
                  >
                    <Text style={{ color: colors.surface, fontSize: 11, fontWeight: '600' }}>
                      Cover
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            ))}
          </View>
        ) : null}
        {room > 0 ? (
          <ChipRow>
            <Chip label="Take photo" onPress={() => void takePhoto()} />
            <Chip
              label={photos.length ? 'Add more' : 'Choose photos'}
              onPress={() => void choosePhotos()}
            />
          </ChipRow>
        ) : (
          <Caption>That is the most a listing takes. Remove one to add another.</Caption>
        )}
        <ErrorText message={photoError} />
      </Card>

      <ErrorText message={error} />
      <Button
        label={existing ? 'Save changes' : SUBMIT_LABEL[kind]}
        onPress={() => void save()}
        loading={busy}
      />
    </View>
  );
}

/**
 * What a seller can do with their own listing besides edit it: pause it while
 * they are away, put it back, or delete it. Something sold once is marked
 * sold (or a wanted notice found), which takes it off the board without
 * losing it, in case the buyer drops out. A listing the committee took down
 * can only be deleted — the database will not let its seller re-open it.
 *
 * An outside business belongs to the committee rather than to whoever added
 * it, so anybody on staff or the committee gets these too.
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
  const onceOff = isOnceOffKind(listing.kind);
  const done = closedLabel(listing.kind);

  const update = async (
    what: string,
    change: { status: 'active' | 'paused' } | { closed_at: string },
  ) => {
    setBusy(what);
    const { error } = await supabase.from('listings').update(change).eq('id', listing.id);
    setBusy(null);
    if (error) {
      Alert.alert('That did not go through', 'Pull down to refresh and try again.');
      return;
    }
    invalidateMarket(queryClient);
  };

  const remove = () =>
    Alert.alert(
      listing.kind === 'business' ? 'Delete this business?' : 'Delete this listing?',
      `${
        listing.kind === 'business' ? 'It leaves the marketplace for everyone in the society. ' : ''
      }${isReviewedKind(listing.kind) ? 'Its reviews go with it. ' : ''}This cannot be undone.`,
      [
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
              .select('id')
              .then(({ data, error }) => {
                setBusy(null);
                if (error || !data?.length) {
                  Alert.alert('Could not delete it', 'Please try again.');
                  return;
                }
                void removeStoredFiles('listing-photos', listing.photoPaths);
                invalidateMarket(queryClient);
                // Back to the Market tab, wherever the listing was opened from.
                router.dismissTo('/market');
              });
          },
        },
      ],
    );

  const removed = listing.status === 'removed';
  const closed = !removed && listing.closedAt !== null;
  const heading =
    listing.kind === 'business'
      ? 'Recommended business'
      : listing.kind === 'shop'
        ? 'Your shop'
        : 'Your listing';

  return (
    <Card style={{ gap: spacing.md }}>
      <View style={{ gap: 2 }}>
        <Heading>{heading}</Heading>
        <Caption>
          {removed
            ? 'The committee took this down. Ask them if you would like it back.'
            : closed
              ? listing.kind === 'wanted'
                ? `${done}: it is off the marketplace. Put it back if you are still looking.`
                : `${done}: it is off the marketplace. Put it back if the buyer drops out.`
              : listing.status === 'paused'
                ? 'Paused: neighbours cannot see it until you resume it.'
                : listing.kind === 'business'
                  ? 'On the marketplace for every resident. Anybody on the committee can change it.'
                  : 'On the marketplace. Pause it while you are away or out of stock.'}
        </Caption>
      </View>
      {removed ? null : closed ? (
        <Button
          label="Put back on the board"
          variant="secondary"
          loading={busy === 'reopen'}
          disabled={busy !== null}
          onPress={() => void update('reopen', { status: 'active' })}
        />
      ) : (
        <>
          {onceOff && listing.status === 'active' ? (
            <Button
              label={`Mark as ${done.toLowerCase()}`}
              loading={busy === 'close'}
              disabled={busy !== null}
              onPress={() => void update('close', { closed_at: new Date().toISOString() })}
            />
          ) : null}
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
                loading={busy === 'status'}
                disabled={busy !== null}
                onPress={() =>
                  void update('status', {
                    status: listing.status === 'paused' ? 'active' : 'paused',
                  })
                }
              />
            </View>
          </View>
        </>
      )}
      <Button
        label={listing.kind === 'business' ? 'Delete business' : 'Delete listing'}
        variant="secondary"
        loading={busy === 'delete'}
        disabled={busy !== null}
        onPress={remove}
      />
    </Card>
  );
}
