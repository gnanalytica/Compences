'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { eventVendorSchema, listingReviewSchema, listingSchema, uuid } from '@compences/core';
import { requireCapability, requireCommunity } from '@/lib/auth';
import { removeStoredFile } from '@/lib/storage';
import { getSupabase } from '@/lib/supabase/server';
import { EMPTY_STATE, fieldErrors, friendlyDbError, type ActionState } from '@/lib/action-state';

/**
 * Everything done to the marketplace from the web: posting and editing a
 * listing, pausing and deleting it, reviewing one, taking one down, and naming
 * one as a vendor for an event.
 *
 * As everywhere else, who the caller is comes from the session and never from
 * the form, and the database checks it all again — the triggers and policies
 * in 1103.0100 are the boundary. What is here gives a sentence instead of a
 * permission error, and sends people to the right page afterwards.
 */

function revalidateListing(slug: string, listingId?: string | null) {
  revalidatePath(`/app/${slug}/market`);
  if (listingId) revalidatePath(`/app/${slug}/market/${listingId}`);
}

/**
 * Event pages show their vendors, so a listing that changes (renamed, paused,
 * taken down) changes them too. Which events is one query away, but the
 * layout-wide revalidation is cheaper than asking, and these pages are
 * dynamic anyway.
 */
function revalidateEvents(slug: string) {
  revalidatePath(`/app/${slug}/events`, 'layout');
  revalidatePath(`/app/${slug}/admin/events`, 'layout');
}

/**
 * Posts a new listing, or saves the seller's changes to one of theirs.
 *
 * The flat it is listed under has to be one the seller lives in. Usually there
 * is only one and the form does not ask; when there are two, it does, and the
 * choice is checked here and again by the policy.
 */
export async function saveListing(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const slug = String(formData.get('slug') ?? '');
  const context = await requireCapability(slug, 'marketplace:post');

  const listingId = String(formData.get('listing_id') ?? '').trim() || null;
  if (listingId && !uuid.safeParse(listingId).success) {
    return { error: 'That listing no longer exists.' };
  }

  const parsed = listingSchema.safeParse({
    category: formData.get('category'),
    title: formData.get('title'),
    description: formData.get('description') ?? undefined,
    price_note: formData.get('price_note') ?? undefined,
    contact_phone: formData.get('contact_phone'),
    on_whatsapp: formData.get('on_whatsapp') ?? '',
    available_until: formData.get('available_until') ?? '',
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  // Photos live under the seller's own folder, which is all the storage and
  // row policies accept; refuse anything else with a sentence, not a 42501.
  const photo = String(formData.get('photo_path') ?? '').trim() || null;
  const photoFolder = `${context.community.id}/${context.membership.id}/`;
  if (photo && !photo.startsWith(photoFolder)) {
    return { error: 'That photo could not be attached. Please upload it again.' };
  }

  // Always the seller's flat as it is today, or none: the update policy
  // checks unit_id against the flats they live in now, so carrying over the
  // one saved on a listing from before a move would refuse the whole edit.
  const askedUnit = String(formData.get('unit_id') ?? '').trim();
  const unitId = askedUnit
    ? context.unitIds.includes(askedUnit)
      ? askedUnit
      : null
    : (context.unitIds[0] ?? null);
  if (askedUnit && !unitId) return { fieldErrors: { unit_id: 'Pick one of your own flats.' } };

  const supabase = await getSupabase();
  const fields = { ...parsed.data, photo_path: photo, unit_id: unitId };

  if (!listingId) {
    const { data, error } = await supabase
      .from('listings')
      .insert({
        ...fields,
        community_id: context.community.id,
        membership_id: context.membership.id,
        status: 'active',
      })
      .select('id')
      .single();
    if (error || !data) return { error: friendlyDbError(error) };

    revalidateListing(slug);
    redirect(`/app/${slug}/market/${data.id}?posted=1`);
  }

  // Only the seller's own: the policy says so too, but asking for the old
  // photo first is also how the replaced file gets cleaned up afterwards.
  const { data: existing } = await supabase
    .from('listings')
    .select('id, photo_path, status')
    .eq('id', listingId)
    .eq('membership_id', context.membership.id)
    .maybeSingle();
  if (!existing) return { error: 'That listing no longer exists.' };
  if (existing.status === 'removed') {
    return {
      error: 'This listing was taken down by the committee. Ask them to restore it.',
    };
  }

  const { error } = await supabase
    .from('listings')
    .update(fields)
    .eq('id', listingId)
    .eq('membership_id', context.membership.id);
  if (error) return { error: friendlyDbError(error) };

  // The new photo is saved, so the old one is referenced by nothing.
  if (existing.photo_path && existing.photo_path !== photo) {
    await removeStoredFile('listing-photos', existing.photo_path);
  }

  revalidateListing(slug, listingId);
  revalidateEvents(slug);
  redirect(`/app/${slug}/market/${listingId}?saved=1`);
}

/**
 * Takes a listing off the board for a while, or puts it back: the tiffin
 * service on holiday for a fortnight, say. Only the seller's own, and not one
 * the committee took down — the trigger refuses that, with a sentence that
 * says who to ask.
 */
export async function setListingPaused(formData: FormData): Promise<void> {
  const slug = String(formData.get('slug') ?? '');
  const listingId = String(formData.get('listing_id') ?? '');
  const context = await requireCommunity(slug);
  const paused = formData.get('paused') === '1';

  const supabase = await getSupabase();
  const { error } = await supabase
    .from('listings')
    .update({ status: paused ? 'paused' : 'active' })
    .eq('id', listingId)
    .eq('membership_id', context.membership.id)
    .neq('status', 'removed');
  if (error) console.error('[compences] listing was not paused', error.code, error.message);

  revalidateListing(slug, listingId);
  revalidateEvents(slug);
}

/** The seller deletes their listing, its reviews and its photo with it. */
export async function deleteListing(formData: FormData): Promise<void> {
  const slug = String(formData.get('slug') ?? '');
  const listingId = String(formData.get('listing_id') ?? '');
  const context = await requireCommunity(slug);

  const supabase = await getSupabase();
  const { data: deleted, error } = await supabase
    .from('listings')
    .delete()
    .eq('id', listingId)
    .eq('membership_id', context.membership.id)
    .select('photo_path');
  if (error) {
    console.error('[compences] listing was not deleted', error.code, error.message);
    revalidateListing(slug, listingId);
    return;
  }
  for (const row of deleted ?? []) await removeStoredFile('listing-photos', row.photo_path);

  revalidateListing(slug, listingId);
  revalidateEvents(slug);
  redirect(`/app/${slug}/market`);
}

const takeDownSchema = z.object({
  listing_id: uuid,
  reason: z
    .string()
    .trim()
    .min(3, 'Tell the seller why, in a few words')
    .max(500, 'Keep it under 500 characters'),
});

/**
 * Staff or the committee take a listing off the board. The seller is told,
 * with this reason, by the trigger on listings — which is why a reason is
 * asked for here although the column allows none: "your listing was taken
 * down" with no why is the message that starts an argument on WhatsApp.
 */
export async function takeDownListing(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const slug = String(formData.get('slug') ?? '');
  const context = await requireCapability(slug, 'marketplace:moderate');

  const parsed = takeDownSchema.safeParse({
    listing_id: formData.get('listing_id'),
    reason: formData.get('reason'),
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('listings')
    .update({ status: 'removed', removed_reason: parsed.data.reason })
    .eq('id', parsed.data.listing_id)
    .eq('community_id', context.community.id)
    .select('id');
  if (error) return { error: friendlyDbError(error) };
  if (!data?.length) return { error: 'That listing no longer exists.' };

  revalidateListing(slug, parsed.data.listing_id);
  revalidateEvents(slug);
  return { ...EMPTY_STATE, success: 'Taken down. The seller has been told why.' };
}

/** Puts a listing that was taken down back on the board. */
export async function restoreListing(formData: FormData): Promise<void> {
  const slug = String(formData.get('slug') ?? '');
  const listingId = String(formData.get('listing_id') ?? '');
  const context = await requireCapability(slug, 'marketplace:moderate');

  const supabase = await getSupabase();
  const { error } = await supabase
    .from('listings')
    .update({ status: 'active' })
    .eq('id', listingId)
    .eq('community_id', context.community.id)
    .eq('status', 'removed');
  if (error) console.error('[compences] listing was not restored', error.code, error.message);

  revalidateListing(slug, listingId);
  revalidateEvents(slug);
}

/**
 * A neighbour's stars and a few words. One each: writing again changes what
 * you wrote rather than adding another. The seller is told about a new review
 * by the database, not here.
 *
 * A first review is an insert and a changed one an update, never an upsert:
 * Postgres checks an upsert against the insert policy as well, which wants
 * the listing on the board, so a review of a listing since paused could not
 * be corrected through one.
 */
export async function saveReview(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const slug = String(formData.get('slug') ?? '');
  const context = await requireCapability(slug, 'marketplace:review');

  const parsed = listingReviewSchema.safeParse({
    listing_id: formData.get('listing_id'),
    rating: formData.get('rating') ?? undefined,
    body: formData.get('body') ?? undefined,
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await getSupabase();
  const [{ data: listing }, { data: existing }] = await Promise.all([
    supabase
      .from('listings')
      .select('id, membership_id, status')
      .eq('id', parsed.data.listing_id)
      .eq('community_id', context.community.id)
      .maybeSingle(),
    supabase
      .from('listing_reviews')
      .select('id')
      .eq('listing_id', parsed.data.listing_id)
      .eq('membership_id', context.membership.id)
      .maybeSingle(),
  ]);
  if (!listing) return { error: 'That listing no longer exists.' };
  if (listing.membership_id === context.membership.id) {
    return { error: 'You can’t review your own listing.' };
  }

  if (existing) {
    const { error } = await supabase
      .from('listing_reviews')
      .update({ rating: parsed.data.rating, body: parsed.data.body })
      .eq('id', existing.id)
      .eq('membership_id', context.membership.id);
    if (error) return { error: friendlyDbError(error) };
    revalidateListing(slug, parsed.data.listing_id);
    return { ...EMPTY_STATE, success: 'Your review is updated.' };
  }

  if (listing.status !== 'active') {
    return { error: 'This listing is not on the board right now, so it can’t be reviewed.' };
  }
  const { error } = await supabase.from('listing_reviews').insert({
    ...parsed.data,
    community_id: context.community.id,
    membership_id: context.membership.id,
  });
  if (error) return { error: friendlyDbError(error) };

  revalidateListing(slug, parsed.data.listing_id);
  return { ...EMPTY_STATE, success: 'Thanks. Your review is up.' };
}

/**
 * Removes a review. The policies decide whose: your own always, anybody's if
 * you are staff or the committee.
 */
export async function deleteReview(formData: FormData): Promise<void> {
  const slug = String(formData.get('slug') ?? '');
  const listingId = String(formData.get('listing_id') ?? '');
  const context = await requireCommunity(slug);

  const supabase = await getSupabase();
  const { error } = await supabase
    .from('listing_reviews')
    .delete()
    .eq('id', String(formData.get('review_id') ?? ''))
    .eq('community_id', context.community.id);
  if (error) console.error('[compences] review was not deleted', error.code, error.message);

  revalidateListing(slug, listingId);
}

/**
 * Names a listing as a vendor for an event: "the snacks stall at the Diwali
 * mela is A-402's". The seller is told by the database.
 */
export async function addEventVendor(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const slug = String(formData.get('slug') ?? '');
  const eventSlug = String(formData.get('event') ?? '');
  const context = await requireCapability(slug, 'events:manage');

  const supabase = await getSupabase();
  const { data: event } = await supabase
    .from('events')
    .select('id')
    .eq('community_id', context.community.id)
    .eq('slug', eventSlug)
    .maybeSingle();
  if (!event) return { error: 'That event no longer exists.' };

  const parsed = eventVendorSchema.safeParse({
    event_id: event.id,
    listing_id: formData.get('listing_id'),
    note: formData.get('note') ?? undefined,
  });
  if (!parsed.success) {
    const errors = fieldErrors(parsed.error);
    if (errors.listing_id) errors.listing_id = 'Pick a listing from the marketplace.';
    return { fieldErrors: errors };
  }

  const { error } = await supabase.from('event_vendors').insert({
    ...parsed.data,
    community_id: context.community.id,
    added_by: context.membership.id,
  });
  if (error) {
    return error.code === '23505'
      ? { fieldErrors: { listing_id: 'That listing is already a vendor for this event.' } }
      : { error: friendlyDbError(error) };
  }

  revalidatePath(`/app/${slug}/events/${eventSlug}`);
  revalidatePath(`/app/${slug}/admin/events/${eventSlug}`);
  revalidateListing(slug, parsed.data.listing_id);
  return { ...EMPTY_STATE, success: 'Added. The seller has been told.' };
}

export async function removeEventVendor(formData: FormData): Promise<void> {
  const slug = String(formData.get('slug') ?? '');
  const eventSlug = String(formData.get('event') ?? '');
  const context = await requireCapability(slug, 'events:manage');

  const supabase = await getSupabase();
  const { data: removed, error } = await supabase
    .from('event_vendors')
    .delete()
    .eq('id', String(formData.get('vendor_id') ?? ''))
    .eq('community_id', context.community.id)
    .select('listing_id');
  if (error) console.error('[compences] vendor was not removed', error.code, error.message);

  revalidatePath(`/app/${slug}/events/${eventSlug}`);
  revalidatePath(`/app/${slug}/admin/events/${eventSlug}`);
  for (const row of removed ?? []) revalidateListing(slug, row.listing_id);
}
