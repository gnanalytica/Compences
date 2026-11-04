import { cache } from 'react';
import { isListingCategory, unitLabel, type ListingCategory } from '@compences/core';
import { fileUrls } from './storage';
import { getSupabase } from './supabase/server';
import { rowsOf } from './rows';

/**
 * Marketplace reads shared by the board, a listing's page and the two event
 * pages.
 *
 * RLS decides what comes back: a resident sees what is on the board and their
 * own whatever its state, staff see everything, so a paused listing simply
 * is not there for a neighbour. The loaders never filter by status for
 * safety, only for presentation.
 *
 * `seller` and `remover` are named embeds because listings points at
 * memberships twice (membership_id and removed_by), and PostgREST refuses an
 * ambiguous one rather than guessing.
 */

// Single string literals, so supabase-js can read the row type off them.
const LISTING_FIELDS =
  'id, community_id, membership_id, unit_id, category, title, description, price_note, contact_phone, on_whatsapp, photo_path, available_until, status, removed_reason, created_at, updated_at, units(block, number), seller:memberships!listings_membership_id_fkey(profiles(full_name))';

export type ListingCard = {
  id: string;
  membershipId: string;
  unitId: string | null;
  category: ListingCategory;
  title: string;
  description: string | null;
  priceNote: string | null;
  contactPhone: string;
  onWhatsapp: boolean;
  photoPath: string | null;
  photoUrl: string | null;
  availableUntil: string | null;
  status: 'active' | 'paused' | 'removed';
  removedReason: string | null;
  createdAt: string;
  sellerName: string;
  /** "A-402", or null when the seller has no flat on the listing. */
  flat: string | null;
  reviewCount: number;
  averageRating: number | null;
};

type ListingRow = {
  id: string;
  membership_id: string;
  unit_id: string | null;
  category: string;
  title: string;
  description: string | null;
  price_note: string | null;
  contact_phone: string;
  on_whatsapp: boolean;
  photo_path: string | null;
  available_until: string | null;
  status: string;
  removed_reason: string | null;
  created_at: string;
  units: { block: string | null; number: string | null } | null;
  seller: { profiles: { full_name: string | null } | null } | null;
};

function statusOf(value: string): ListingCard['status'] {
  return value === 'paused' || value === 'removed' ? value : 'active';
}

/** Ratings and photo links for a set of listings, in two round trips not 2n. */
async function decorate(rows: ListingRow[]): Promise<ListingCard[]> {
  if (!rows.length) return [];
  const supabase = await getSupabase();
  const [ratings, photos] = await Promise.all([
    supabase
      .from('listing_ratings')
      .select('listing_id, review_count, average_rating')
      .in(
        'listing_id',
        rows.map((row) => row.id),
      ),
    fileUrls(
      'listing-photos',
      rows.map((row) => row.photo_path),
    ),
  ]);
  const byListing = new Map(
    rowsOf(ratings, 'listing_ratings').map((rating) => [rating.listing_id, rating]),
  );

  return rows.map((row) => {
    const rating = byListing.get(row.id);
    return {
      id: row.id,
      membershipId: row.membership_id,
      unitId: row.unit_id,
      category: isListingCategory(row.category) ? row.category : 'other',
      title: row.title,
      description: row.description,
      priceNote: row.price_note,
      contactPhone: row.contact_phone,
      onWhatsapp: row.on_whatsapp,
      photoPath: row.photo_path,
      photoUrl: row.photo_path ? (photos.get(row.photo_path) ?? null) : null,
      availableUntil: row.available_until,
      status: statusOf(row.status),
      removedReason: row.removed_reason,
      createdAt: row.created_at,
      sellerName: row.seller?.profiles?.full_name?.trim() || 'A neighbour',
      flat: row.units?.number ? unitLabel(row.units) : null,
      reviewCount: rating?.review_count ?? 0,
      averageRating: rating?.average_rating === null ? null : Number(rating?.average_rating),
    };
  });
}

/** Every listing the viewer may see in this society, newest first. */
export const getListings = cache(async (communityId: string): Promise<ListingCard[]> => {
  const supabase = await getSupabase();
  const result = await supabase
    .from('listings')
    .select(LISTING_FIELDS)
    .eq('community_id', communityId)
    .order('created_at', { ascending: false })
    .limit(500);
  return decorate(rowsOf(result, 'listings'));
});

/** One listing, or null when it does not exist or the viewer may not see it. */
export const getListing = cache(
  async (communityId: string, listingId: string): Promise<ListingCard | null> => {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('listings')
      .select(LISTING_FIELDS)
      .eq('community_id', communityId)
      .eq('id', listingId)
      .maybeSingle();
    if (error) console.error('[compences] read failed: listing', error.code, error.message);
    if (!data) return null;
    const [card] = await decorate([data]);
    return card ?? null;
  },
);

export type ListingReview = {
  id: string;
  membershipId: string;
  rating: number;
  body: string | null;
  createdAt: string;
  updatedAt: string;
  name: string;
};

export const getListingReviews = cache(async (listingId: string): Promise<ListingReview[]> => {
  const supabase = await getSupabase();
  const result = await supabase
    .from('listing_reviews')
    .select(
      'id, membership_id, rating, body, created_at, updated_at, memberships!listing_reviews_membership_id_fkey(profiles(full_name))',
    )
    .eq('listing_id', listingId)
    .order('updated_at', { ascending: false });
  return rowsOf(result, 'listing_reviews').map((row) => ({
    id: row.id,
    membershipId: row.membership_id,
    rating: row.rating,
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    name: row.memberships?.profiles?.full_name?.trim() || 'A neighbour',
  }));
});

/** The events a listing has been chosen to supply, soonest first. */
export const getVendorEvents = cache(async (listingId: string) => {
  const supabase = await getSupabase();
  const result = await supabase
    .from('event_vendors')
    .select('id, note, events(name, slug, starts_on, status)')
    .eq('listing_id', listingId);
  // An event the viewer may not see (a draft, to a resident) comes back
  // without its embed; leave it out rather than show a nameless one.
  return rowsOf(result, 'event_vendors by listing')
    .flatMap((row) => (row.events ? [{ id: row.id, note: row.note, ...row.events }] : []))
    .sort((a, b) => a.starts_on.localeCompare(b.starts_on));
});

export type EventVendor = {
  id: string;
  note: string | null;
  listingId: string;
  title: string;
  category: ListingCategory;
  status: ListingCard['status'];
  sellerName: string;
  flat: string | null;
};

/** The listings chosen to supply one event, in the order they were added. */
export const getEventVendors = cache(async (eventId: string): Promise<EventVendor[]> => {
  const supabase = await getSupabase();
  const result = await supabase
    .from('event_vendors')
    .select(
      'id, note, listing_id, created_at, listings(title, category, status, units(block, number), seller:memberships!listings_membership_id_fkey(profiles(full_name)))',
    )
    .eq('event_id', eventId)
    .order('created_at');
  // A listing its seller has paused is not readable by a neighbour, and its
  // row comes back without one. It is still a vendor; it is just not on the
  // board to link to, so it stays off a resident's list until it returns.
  return rowsOf(result, 'event_vendors by event').flatMap((row) =>
    row.listings
      ? [
          {
            id: row.id,
            note: row.note,
            listingId: row.listing_id,
            title: row.listings.title,
            category: isListingCategory(row.listings.category) ? row.listings.category : 'other',
            status: statusOf(row.listings.status),
            sellerName: row.listings.seller?.profiles?.full_name?.trim() || 'A neighbour',
            flat: row.listings.units?.number ? unitLabel(row.listings.units) : null,
          },
        ]
      : [],
  );
});

/** The seller's own flats, labelled, for the form's "Your flat" picker. */
export async function getUnitOptions(unitIds: string[]) {
  if (!unitIds.length) return [];
  const supabase = await getSupabase();
  const result = await supabase.from('units').select('id, block, number').in('id', unitIds);
  return rowsOf(result, 'units for a listing')
    .map((unit) => ({ id: unit.id, label: unitLabel(unit) }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
