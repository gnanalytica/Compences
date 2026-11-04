'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  LISTING_CATEGORIES,
  LISTING_CATEGORY_HINT,
  LISTING_CATEGORY_LABEL,
  isListingCategory,
  type ListingCategory,
} from '@compences/core';
import { Button, ButtonLink } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { FileUpload } from '@/components/file-upload';
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
  photoPath: string | null;
  availableUntil: string | null;
  unitId: string | null;
};

function Submit({ editing, disabled }: { editing: boolean; disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled}>
      {pending ? 'Saving…' : editing ? 'Save changes' : 'Post to the marketplace'}
    </Button>
  );
}

/**
 * What a seller fills in to go on the board, and again to change it.
 *
 * The phone starts as the one on the seller's profile, because it usually is
 * the right one — but it is a field they can see and change, never copied
 * silently: 0918.0100 made the profile's number private, and putting it on an
 * ad has to be the seller's own doing.
 *
 * Nothing here is cleared on success: a new listing goes to its own page and
 * an edited one back to it, so the form is gone either way.
 */
export function ListingForm({
  slug,
  photoFolder,
  defaultPhone,
  units,
  listing,
  cancelHref,
}: {
  slug: string;
  /** `{community_id}/{membership_id}`: the only folder the photo may go in. */
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

  return (
    <form action={action} className="space-y-4">
      <FocusFirstError signal={state} />
      <input type="hidden" name="slug" value={slug} />
      {listing ? <input type="hidden" name="listing_id" value={listing.id} /> : null}

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
            {LISTING_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {LISTING_CATEGORY_LABEL[c]}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <Field label="Title" htmlFor="listing-title" error={state.fieldErrors?.title} required>
        {(control) => (
          <Input
            {...control}
            name="title"
            defaultValue={listing?.title}
            placeholder="Fresh idly and dosa batter"
            maxLength={120}
          />
        )}
      </Field>

      <Field
        label="Details"
        htmlFor="listing-description"
        error={state.fieldErrors?.description}
        hint="Optional. What it is, when and how to order, any timings."
      >
        {(control) => (
          <Textarea
            {...control}
            name="description"
            defaultValue={listing?.description ?? ''}
            rows={4}
            maxLength={2000}
            placeholder="Ground fresh every morning. Order by 8 pm for the next day."
          />
        )}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Price"
          htmlFor="listing-price"
          error={state.fieldErrors?.price_note}
          hint="Optional, in your words."
        >
          {(control) => (
            <Input
              {...control}
              name="price_note"
              defaultValue={listing?.priceNote ?? ''}
              placeholder="₹80 a kg"
              maxLength={80}
            />
          )}
        </Field>
        <Field
          label="Available until"
          htmlFor="listing-until"
          error={state.fieldErrors?.available_until}
          hint="Optional. For something seasonal; it leaves the board after this day."
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
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Phone for enquiries"
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
              autoComplete="tel"
              defaultValue={listing?.contactPhone ?? defaultPhone ?? ''}
              placeholder="98765 43210"
            />
          )}
        </Field>
        {units.length > 1 ? (
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

      <FileUpload
        bucket="listing-photos"
        folder={photoFolder}
        name="photo_path"
        label="Photo"
        hint="Optional. One picture of what you offer; everyone in the society can see it."
        maxBytes={5 * 1_048_576}
        defaultPath={listing?.photoPath}
        onUploadingChange={setUploading}
      />

      {state.error ? (
        <p role="alert" className="text-danger text-sm">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Submit editing={Boolean(listing)} disabled={uploading} />
        <ButtonLink href={cancelHref} variant="ghost">
          Cancel
        </ButtonLink>
      </div>
    </form>
  );
}
