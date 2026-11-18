'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import {
  MAX_LISTING_PHOTOS,
  can,
  eventVendorSchema,
  isListingKind,
  isReviewedKind,
  listingReviewSchema,
  listingSchema,
  uuid,
  type ListingKind,
} from '@compences/core';
import { requireCapability, requireCommunity, type CommunityContext } from '@/lib/auth';
import { kindOf } from '@/lib/market';
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
 * in 1103.0100 and 1118.0100 are the boundary. What is here gives a sentence
 * instead of a permission error, and sends people to the right page
 * afterwards.
 *
 * Since 1118.0100 a listing has a kind. Residents and the committee post
 * offers, things for sale, wanted notices and a shop; staff and the committee
 * add outside businesses, and any of them may keep a business up to date or
 * delete it, whoever added it. The kind is chosen when a listing is posted
 * and never sent again: the database refuses to change it.
 */

/** Who may post, or keep up to date, a listing of this kind. Real role, not the view. */
function mayHandle(context: CommunityContext, kind: ListingKind): boolean {
  return kind === 'business'
    ? can(context.role, 'marketplace:business')
    : can(context.role, 'marketplace:post');
}

/**
 * The photos the form sent, cover first, each checked against where it may
 * come from: a resident's own folder, or — for a business, which anyone on
 * staff or the committee may have uploaded to — anywhere in this society.
 * Storage and the row policy say the same; this says it in a sentence.
 */
function photosFrom(
  formData: FormData,
  context: CommunityContext,
  kind: ListingKind,
): { paths: string[] } | { error: string } {
  const paths = [
    ...new Set(
      formData
        .getAll('photo_paths')
        .map((value) => String(value).trim())
        .filter(Boolean),
    ),
  ];
  if (paths.length > MAX_LISTING_PHOTOS) {
    return { error: `A listing can have ${MAX_LISTING_PHOTOS} photos at most.` };
  }
  const folder =
    kind === 'business'
      ? `${context.community.id}/`
      : `${context.community.id}/${context.membership.id}/`;
  if (paths.some((path) => !path.startsWith(folder))) {
    return { error: 'A photo could not be attached. Please upload it again.' };
  }
  return { paths };
}

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
 * Posts a new listing, or saves the changes to one.
 *
 * The flat it is listed under has to be one the seller lives in. Usually there
 * is only one and the form does not ask; when there are two, it does, and the
 * choice is checked here and again by the policy. An outside business is at
 * no flat, and a shop or a business has no last day.
 */
export async function saveListing(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const slug = String(formData.get('slug') ?? '');
  const context = await requireCommunity(slug);

  const listingId = String(formData.get('listing_id') ?? '').trim() || null;
  if (listingId && !uuid.safeParse(listingId).success) {
    return { error: 'That listing no longer exists.' };
  }

  const supabase = await getSupabase();

  // An edit takes its kind from the listing, never from the form.
  let existing: {
    id: string;
    kind: ListingKind;
    membership_id: string;
    status: string;
    photo_paths: string[];
  } | null = null;
  if (listingId) {
    const { data } = await supabase
      .from('listings')
      .select('id, kind, membership_id, status, photo_path, photo_paths')
      .eq('id', listingId)
      .eq('community_id', context.community.id)
      .maybeSingle();
    if (!data) return { error: 'That listing no longer exists.' };
    existing = {
      id: data.id,
      kind: kindOf(data.kind),
      membership_id: data.membership_id,
      status: data.status,
      photo_paths: data.photo_paths?.length
        ? data.photo_paths
        : data.photo_path
          ? [data.photo_path]
          : [],
    };
  }

  const asked = String(formData.get('kind') ?? '');
  const kind: ListingKind = existing?.kind ?? (isListingKind(asked) ? asked : 'offer');

  if (!mayHandle(context, kind)) {
    return {
      error:
        kind === 'business'
          ? 'Only staff and the committee can add an outside business.'
          : 'You can’t post on this society’s marketplace.',
    };
  }
  // A resident's listing is theirs alone to change; a business is the
  // committee's, so anyone who may add one may keep it up to date.
  if (existing && kind !== 'business' && existing.membership_id !== context.membership.id) {
    return { error: 'That listing no longer exists.' };
  }
  if (existing?.status === 'removed') {
    return {
      error: 'This listing was taken down by the committee. Ask them to restore it.',
    };
  }

  const parsed = listingSchema.safeParse({
    kind,
    category: formData.get('category'),
    title: formData.get('title'),
    description: formData.get('description') ?? undefined,
    price_note: formData.get('price_note') ?? undefined,
    contact_phone: formData.get('contact_phone'),
    on_whatsapp: formData.get('on_whatsapp') ?? '',
    available_until:
      kind === 'shop' || kind === 'business' ? '' : (formData.get('available_until') ?? ''),
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const photos = photosFrom(formData, context, kind);
  if ('error' in photos) return { error: photos.error };

  // Always the seller's flat as it is today, or none: the update policy
  // checks unit_id against the flats they live in now, so carrying over the
  // one saved on a listing from before a move would refuse the whole edit.
  let unitId: string | null = null;
  if (kind !== 'business') {
    const askedUnit = String(formData.get('unit_id') ?? '').trim();
    unitId = askedUnit
      ? context.unitIds.includes(askedUnit)
        ? askedUnit
        : null
      : (context.unitIds[0] ?? null);
    if (askedUnit && !unitId) return { fieldErrors: { unit_id: 'Pick one of your own flats.' } };
  }

  // The kind goes in on the insert only; photo_path follows photo_paths.
  const { kind: _kind, ...rest } = parsed.data;
  const fields = { ...rest, photo_paths: photos.paths, unit_id: unitId };

  if (!existing) {
    if (kind === 'shop') {
      const { data: shop } = await supabase
        .from('listings')
        .select('id')
        .eq('community_id', context.community.id)
        .eq('membership_id', context.membership.id)
        .eq('kind', 'shop')
        .maybeSingle();
      if (shop) {
        return { error: 'You already have a shop here. Edit it rather than opening another.' };
      }
    }
    const { data, error } = await supabase
      .from('listings')
      .insert({
        ...fields,
        kind,
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

  let update = supabase.from('listings').update(fields).eq('id', existing.id);
  update =
    kind === 'business'
      ? update.eq('community_id', context.community.id).eq('kind', 'business')
      : update.eq('membership_id', context.membership.id);
  const { error } = await update;
  if (error) return { error: friendlyDbError(error) };

  // The new photos are saved, so the ones left out are referenced by nothing.
  for (const path of existing.photo_paths) {
    if (!photos.paths.includes(path)) await removeStoredFile('listing-photos', path);
  }

  revalidateListing(slug, existing.id);
  revalidateEvents(slug);
  redirect(`/app/${slug}/market/${existing.id}?saved=1`);
}

/**
 * Something for sale has gone, or something wanted has been found: off the
 * board, kept on the seller's own list, and back on the board with one press
 * if the buyer drops out. The database stamps the time and marks it paused,
 * which is how apps built before 1118.0100 already hide a listing.
 */
export async function setListingClosed(formData: FormData): Promise<void> {
  const slug = String(formData.get('slug') ?? '');
  const listingId = String(formData.get('listing_id') ?? '');
  const context = await requireCommunity(slug);
  const closing = formData.get('closed') === '1';

  const supabase = await getSupabase();
  const query = closing
    ? supabase
        .from('listings')
        .update({ closed_at: new Date().toISOString() })
        .is('closed_at', null)
    : supabase.from('listings').update({ status: 'active' }).not('closed_at', 'is', null);
  const { error } = await query
    .eq('id', listingId)
    .eq('membership_id', context.membership.id)
    .in('kind', ['sale', 'wanted'])
    .neq('status', 'removed');
  if (error) console.error('[compences] listing was not marked', error.code, error.message);

  revalidateListing(slug, listingId);
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

/**
 * The seller deletes their listing, its reviews and its photos with it. A
 * business is deleted by anyone on staff or the committee, whoever added it.
 */
export async function deleteListing(formData: FormData): Promise<void> {
  const slug = String(formData.get('slug') ?? '');
  const listingId = String(formData.get('listing_id') ?? '');
  const context = await requireCommunity(slug);
  const business = formData.get('business') === '1' && can(context.role, 'marketplace:business');

  const supabase = await getSupabase();
  let query = supabase.from('listings').delete().eq('id', listingId);
  query = business
    ? query.eq('community_id', context.community.id).eq('kind', 'business')
    : query.eq('membership_id', context.membership.id);
  const { data: deleted, error } = await query.select('photo_path, photo_paths');
  if (error) {
    console.error('[compences] listing was not deleted', error.code, error.message);
    revalidateListing(slug, listingId);
    return;
  }
  for (const row of deleted ?? []) {
    const paths = new Set([...(row.photo_paths ?? []), row.photo_path].filter(Boolean));
    for (const path of paths) await removeStoredFile('listing-photos', path);
  }

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
      .select('id, membership_id, status, kind')
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
  if (!isReviewedKind(kindOf(listing.kind))) {
    return { error: 'Something sold once, or asked for, isn’t reviewed.' };
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

  const { data: listing } = await supabase
    .from('listings')
    .select('kind')
    .eq('id', parsed.data.listing_id)
    .eq('community_id', context.community.id)
    .maybeSingle();
  if (!listing) return { fieldErrors: { listing_id: 'Pick a listing from the marketplace.' } };
  if (!isReviewedKind(kindOf(listing.kind))) {
    return {
      fieldErrors: {
        listing_id: 'Only somebody who supplies things, not a one-off sale, can be a vendor.',
      },
    };
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
