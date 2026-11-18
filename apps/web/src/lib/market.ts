import { cache } from 'react';
import {
  isListingCategory,
  isListingKind,
  unitLabel,
  type ListingCategory,
  type ListingKind,
} from '@compences/core';
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
 *
 * Since 1118.0100 a listing has a kind (an offer, something for sale once,
 * something wanted, a resident's shop, an outside business) and up to five
 * photos, `photo_paths`, the first of which is the cover. `photo_path` is
 * still there, kept equal to that first one by the database for apps built
 * before; it is read only as a fallback.
 */

// Single string literals, so supabase-js can read the row type off them.
const LISTING_FIELDS =
  'id, community_id, membership_id, unit_id, kind, category, title, description, price_note, contact_phone, on_whatsapp, photo_path, photo_paths, available_until, status, closed_at, removed_reason, created_at, updated_at, units(block, number), seller:memberships!listings_membership_id_fkey(profiles(full_name))';

export type ListingCard = {
  id: string;
  membershipId: string;
  unitId: string | null;
  kind: ListingKind;
  category: ListingCategory;
  title: string;
  description: string | null;
  priceNote: string | null;
  contactPhone: string;
  onWhatsapp: boolean;
  /** The cover, or null when there is no photo. */
  photoPath: string | null;
  photoUrl: string | null;
  /** Every photo, cover first. */
  photoPaths: string[];
  /** Signed links to the photos the viewer may open, in the same order. */
  photoUrls: string[];
  /** Each photo with its link, or null where the viewer could not get one. */
  photos: { path: string; url: string | null }[];
  availableUntil: string | null;
  status: 'active' | 'paused' | 'removed';
  /** When something for sale was sold, or something wanted was found. */
  closedAt: string | null;
  removedReason: string | null;
  createdAt: string;
  sellerName: string;
  /** "A-402", or null when the seller has no flat on the listing. */
  flat: string | null;
  reviewCount: number;
  averageRating: number | null;
  /**
   * The seller's shop, when they have one on the board and this is not it:
   * their other listings say whose shop they belong to.
   */
  shop: { id: string; title: string } | null;
};

type ListingRow = {
  id: string;
  membership_id: string;
  unit_id: string | null;
  kind: string;
  category: string;
  title: string;
  description: string | null;
  price_note: string | null;
  contact_phone: string;
  on_whatsapp: boolean;
  photo_path: string | null;
  photo_paths: string[] | null;
  available_until: string | null;
  status: string;
  closed_at: string | null;
  removed_reason: string | null;
  created_at: string;
  units: { block: string | null; number: string | null } | null;
  seller: { profiles: { full_name: string | null } | null } | null;
};

function statusOf(value: string): ListingCard['status'] {
  return value === 'paused' || value === 'removed' ? value : 'active';
}

/** A kind this app does not know yet reads as an offer, as it did before kinds. */
export function kindOf(value: string | null | undefined): ListingKind {
  return isListingKind(value) ? value : 'offer';
}

/** The photos, cover first; a row from before 1118.0100 may have only photo_path. */
function pathsOf(row: Pick<ListingRow, 'photo_path' | 'photo_paths'>): string[] {
  const paths = (row.photo_paths ?? []).filter(Boolean);
  if (paths.length) return paths;
  return row.photo_path ? [row.photo_path] : [];
}

/**
 * Tells each listing whose shop it belongs to: the seller's shop, if it is on
 * the board (a shop has no last day, so that is whether it is active). The
 * shop itself is left alone; its seller line is the person who runs it.
 */
export function attachShops(listings: ListingCard[]): ListingCard[] {
  const shops = new Map<string, { id: string; title: string }>();
  for (const listing of listings) {
    if (listing.kind === 'shop' && listing.status === 'active') {
      shops.set(listing.membershipId, { id: listing.id, title: listing.title });
    }
  }
  return listings.map((listing) =>
    listing.kind === 'shop' || listing.kind === 'business'
      ? listing
      : { ...listing, shop: shops.get(listing.membershipId) ?? null },
  );
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
    fileUrls('listing-photos', rows.flatMap(pathsOf)),
  ]);
  const byListing = new Map(
    rowsOf(ratings, 'listing_ratings').map((rating) => [rating.listing_id, rating]),
  );

  return rows.map((row) => {
    const rating = byListing.get(row.id);
    const paths = pathsOf(row);
    const urls = paths.flatMap((path) => {
      const url = photos.get(path);
      return url ? [url] : [];
    });
    return {
      id: row.id,
      membershipId: row.membership_id,
      unitId: row.unit_id,
      kind: kindOf(row.kind),
      category: isListingCategory(row.category) ? row.category : 'other',
      title: row.title,
      description: row.description,
      priceNote: row.price_note,
      contactPhone: row.contact_phone,
      onWhatsapp: row.on_whatsapp,
      photoPath: paths[0] ?? null,
      photoUrl: paths[0] ? (photos.get(paths[0]) ?? null) : null,
      photoPaths: paths,
      photoUrls: urls,
      photos: paths.map((path) => ({ path, url: photos.get(path) ?? null })),
      availableUntil: row.available_until,
      status: statusOf(row.status),
      closedAt: row.closed_at,
      removedReason: row.removed_reason,
      createdAt: row.created_at,
      sellerName: row.seller?.profiles?.full_name?.trim() || 'A neighbour',
      flat: row.units?.number ? unitLabel(row.units) : null,
      reviewCount: rating?.review_count ?? 0,
      averageRating:
        rating?.average_rating === null || rating?.average_rating === undefined
          ? null
          : Number(rating.average_rating),
      shop: null,
    };
  });
}

/** Every listing the viewer may see in this society, newest first, each told whose shop it is in. */
export const getListings = cache(async (communityId: string): Promise<ListingCard[]> => {
  const supabase = await getSupabase();
  const result = await supabase
    .from('listings')
    .select(LISTING_FIELDS)
    .eq('community_id', communityId)
    .order('created_at', { ascending: false })
    .limit(500);
  return attachShops(await decorate(rowsOf(result, 'listings')));
});

/**
 * The newest few on the board, for the strip on Home. A handful of rows and
 * their covers rather than the whole board: Home is not the place to browse.
 */
export const getNewestOnBoard = cache(
  async (communityId: string, today: string, count = 8): Promise<ListingCard[]> => {
    const supabase = await getSupabase();
    const result = await supabase
      .from('listings')
      .select(LISTING_FIELDS)
      .eq('community_id', communityId)
      .eq('status', 'active')
      .or(`available_until.is.null,available_until.gte.${today}`)
      .order('created_at', { ascending: false })
      .limit(count);
    return decorate(rowsOf(result, 'newest listings'));
  },
);

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
  kind: ListingKind;
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
      'id, note, listing_id, created_at, listings(title, kind, category, status, units(block, number), seller:memberships!listings_membership_id_fkey(profiles(full_name)))',
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
            kind: kindOf(row.listings.kind),
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
