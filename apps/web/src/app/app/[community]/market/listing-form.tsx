'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  KIND_CATEGORIES,
  LISTING_CATEGORY_HINT,
  LISTING_CATEGORY_LABEL,
  LISTING_KIND_PRICE,
  LISTING_KIND_TITLE,
  MAX_LISTING_PHOTOS,
  isListingCategory,
  type ListingCategory,
  type ListingKind,
} from '@compences/core';
import { Button, ButtonLink } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { PhotoUploads } from '@/components/photo-uploads';
import { FocusFirstError } from '@/components/focus-first-error';
import { EMPTY_STATE, type ActionState } from '@/lib/action-state';
import { saveListing } from './actions';

export type ListingDraft = {
  id: string;
  category: ListingCategory;
  title: string;
  description: string | null;
  priceNote: string | null;
  contactPhone: string;
  onWhatsapp: boolean;
  /** Its photos, cover first, with a link to show each while editing. */
  photos: { path: string; url: string | null }[];
  availableUntil: string | null;
  unitId: string | null;
};

/** The button that posts one, in words for what it is. */
const POST_LABEL: Record<ListingKind, string> = {
  offer: 'Post to the marketplace',
  sale: 'Put it up for sale',
  wanted: 'Post what you are looking for',
  shop: 'Open the shop',
  business: 'Add the business',
};

/** What the details box is for, and an example, kind by kind. */
const DETAILS: Record<ListingKind, { hint: string; placeholder: string }> = {
  offer: {
    hint: 'Optional. What it is, when and how to order, any timings.',
    placeholder: 'Ground fresh every morning. Order by 8 pm for the next day.',
  },
  sale: {
    hint: 'Optional. How old it is, what condition, and when it can be collected.',
    placeholder: 'Two years old, new tyres. Collect from the basement any evening.',
  },
  wanted: {
    hint: 'Optional. What would do, and for how long if you are borrowing.',
    placeholder: 'A 5-litre one for a family function on Sunday. Back by Tuesday.',
  },
  shop: {
    hint: 'Optional. What you sell, when you take orders, how people collect.',
    placeholder: 'Batter, podis and weekday tiffins from our kitchen in A-402.',
  },
  business: {
    hint: 'Optional. What they do, when they come, and anything the committee knows of them.',
    placeholder: 'Wiring, fans and inverters. Has done the clubhouse for three years.',
  },
};

function Submit({ label, disabled }: { label: string; disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled}>
      {pending ? 'Saving…' : label}
    </Button>
  );
}

/**
 * What a seller fills in to go on the board, and again to change it, worded
 * for the kind of listing it is: an offer, something for sale once, something
 * wanted, a shop, or — for staff and the committee — an outside business.
 *
 * The phone starts as the one on the seller's profile, because it usually is
 * the right one — but it is a field they can see and change, never copied
 * silently: 0918.0100 made the profile's number private, and putting it on an
 * ad has to be the seller's own doing. A business's number is the business's,
 * so it starts empty.
 *
 * Nothing here is cleared on success: a new listing goes to its own page and
 * an edited one back to it, so the form is gone either way.
 */
export function ListingForm({
  slug,
  kind,
  photoFolder,
  defaultPhone,
  units,
  listing,
  cancelHref,
}: {
  slug: string;
  kind: ListingKind;
  /** `{community_id}/{membership_id}`: the folder this person's uploads go in. */
  photoFolder: string;
  defaultPhone: string | null;
  /** The seller's own flats, when there is more than one to choose between. */
  units: { id: string; label: string }[];
  listing?: ListingDraft;
  cancelHref: string;
}) {
  const [state, action] = useActionState<ActionState, FormData>(saveListing, EMPTY_STATE);
  const [category, setCategory] = useState<string>(listing?.category ?? '');
  const [uploading, setUploading] = useState(false);

  // The kind's own short list, plus whatever a listing posted before kinds
  // already has, so an edit never silently changes its category.
  const categories: readonly ListingCategory[] =
    listing && !KIND_CATEGORIES[kind].includes(listing.category)
      ? [...KIND_CATEGORIES[kind], listing.category]
      : KIND_CATEGORIES[kind];
  const title = LISTING_KIND_TITLE[kind];
  const price = LISTING_KIND_PRICE[kind];
  const details = DETAILS[kind];
  const hasLastDay = kind !== 'shop' && kind !== 'business';
  const business = kind === 'business';

  return (
    <form action={action} className="space-y-4">
      <FocusFirstError signal={state} />
      <input type="hidden" name="slug" value={slug} />
      {listing ? (
        <input type="hidden" name="listing_id" value={listing.id} />
      ) : (
        // Chosen once, when it is posted; an edit never sends it.
        <input type="hidden" name="kind" value={kind} />
      )}

      <Field label={title.label} htmlFor="listing-title" error={state.fieldErrors?.title} required>
        {(control) => (
          <Input
            {...control}
            name="title"
            defaultValue={listing?.title}
            placeholder={title.placeholder}
            maxLength={120}
          />
        )}
      </Field>

      <Field
        label="What kind of thing"
        htmlFor="listing-category"
        error={state.fieldErrors?.category}
        hint={isListingCategory(category) ? LISTING_CATEGORY_HINT[category] : undefined}
        required
      >
        {(control) => (
          <Select
            {...control}
            name="category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="" disabled>
              Choose one
            </option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {LISTING_CATEGORY_LABEL[c]}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <Field
        label="Details"
        htmlFor="listing-description"
        error={state.fieldErrors?.description}
        hint={details.hint}
      >
        {(control) => (
          <Textarea
            {...control}
            name="description"
            defaultValue={listing?.description ?? ''}
            rows={4}
            maxLength={2000}
            placeholder={details.placeholder}
          />
        )}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={price.label}
          htmlFor="listing-price"
          error={state.fieldErrors?.price_note}
          hint="Optional, in your words."
        >
          {(control) => (
            <Input
              {...control}
              name="price_note"
              defaultValue={listing?.priceNote ?? ''}
              placeholder={price.placeholder}
              maxLength={80}
            />
          )}
        </Field>
        {hasLastDay ? (
          <Field
            label={kind === 'wanted' ? 'Looking until' : 'Available until'}
            htmlFor="listing-until"
            error={state.fieldErrors?.available_until}
            hint={
              kind === 'wanted'
                ? 'Optional. It leaves the board after this day if nobody has one.'
                : 'Optional. For something seasonal; it leaves the board after this day.'
            }
          >
            {(control) => (
              <Input
                {...control}
                name="available_until"
                type="date"
                defaultValue={listing?.availableUntil ?? ''}
              />
            )}
          </Field>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={business ? 'The business’s phone' : 'Phone for enquiries'}
          htmlFor="listing-phone"
          error={state.fieldErrors?.contact_phone}
          hint="Shown on the listing to everyone in the society."
          required
        >
          {(control) => (
            <Input
              {...control}
              name="contact_phone"
              type="tel"
              inputMode="tel"
              autoComplete={business ? 'off' : 'tel'}
              defaultValue={listing?.contactPhone ?? (business ? '' : (defaultPhone ?? ''))}
              placeholder="98765 43210"
            />
          )}
        </Field>
        {!business && units.length > 1 ? (
          <Field
            label="Your flat"
            htmlFor="listing-unit"
            error={state.fieldErrors?.unit_id}
            hint="Where a neighbour collects from."
          >
            {(control) => (
              <Select
                {...control}
                name="unit_id"
                defaultValue={listing?.unitId ?? units[0]?.id ?? ''}
              >
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        ) : null}
      </div>

      <label className="text-ink flex items-start gap-2.5 text-sm pointer-coarse:min-h-11">
        <input
          type="checkbox"
          name="on_whatsapp"
          defaultChecked={listing?.onWhatsapp ?? true}
          className="accent-ink mt-0.5 size-4"
        />
        <span>
          This number is on WhatsApp
          <span className="text-ink-subtle block text-xs">
            Neighbours get a WhatsApp button as well as Call.
          </span>
        </span>
      </label>

      <PhotoUploads
        folder={photoFolder}
        name="photo_paths"
        max={MAX_LISTING_PHOTOS}
        label="Photos"
        hint={`Optional. Up to ${MAX_LISTING_PHOTOS}; the first is the cover. Everyone in the society can see them.`}
        maxBytes={5 * 1_048_576}
        initial={listing?.photos}
        onUploadingChange={setUploading}
      />

      {state.error ? (
        <p role="alert" className="text-danger text-sm">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Submit label={listing ? 'Save changes' : POST_LABEL[kind]} disabled={uploading} />
        <ButtonLink href={cancelHref} variant="ghost">
          Cancel
        </ButtonLink>
      </div>
    </form>
  );
}
