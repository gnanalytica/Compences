import type { QueryClient } from '@tanstack/react-query';
import {
  isListingCategory,
  isListingCurrent,
  listingScore,
  unitLabel,
  type ListingCategory,
  type ListingStatus,
} from '@compences/core';
import { today } from '../components/date-field';
import { storedFileUrls } from './storage';
import { supabase } from './supabase';

/**
 * Marketplace reads for the mobile app: the board, one listing with its
 * reviews, and the listings chosen to supply an event.
 *
 * Row-level security decides what each person gets back. A resident sees
 * what is on the board plus their own listings in any state; staff and the
 * committee also see what has been taken down, so it can be put back. Nothing
 * here filters for access — it only sorts what the database already allowed.
 *
 * The seller's number is the one typed on the listing. The profile's own
 * phone is private (0918.0100) and is never asked for here.
 */

// One string literal, so supabase-js can infer the row type from it. Two
// foreign keys run from listings to memberships (the seller, and whoever took
// it down), so the seller's is named.
const LISTING_FIELDS =
  'id, community_id, membership_id, unit_id, category, title, description, price_note, contact_phone, on_whatsapp, photo_path, available_until, status, removed_reason, created_at, updated_at, seller:memberships!listings_membership_id_fkey(profiles(full_name)), units(block, number)';

/** A listing as every marketplace screen reads it. */
export type Listing = {
  id: string;
  communityId: string;
  membershipId: string;
  unitId: string | null;
  category: ListingCategory;
  title: string;
  description: string | null;
  priceNote: string | null;
  contactPhone: string;
  onWhatsapp: boolean;
  photoPath: string | null;
  /** A signed link to the photo, when there is one the viewer may see. */
  photoUrl: string | null;
  availableUntil: string | null;
  status: ListingStatus;
  removedReason: string | null;
  createdAt: string;
  sellerName: string;
  /** "A-402", or null for a seller nobody has seated at a door yet. */
  flat: string | null;
  reviewCount: number;
  averageRating: number | null;
};

type ListingRow = {
  id: string;
  community_id: string;
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
  seller: { profiles: { full_name: string | null } | null } | null;
  units: { block: string | null; number: string | null } | null;
};

type Rating = { count: number; average: number | null };

function toListing(row: ListingRow, ratings: Map<string, Rating>, urls: Map<string, string>) {
  const rating = ratings.get(row.id);
  const status: ListingStatus =
    row.status === 'paused' || row.status === 'removed' ? row.status : 'active';
  return {
    id: row.id,
    communityId: row.community_id,
    membershipId: row.membership_id,
    unitId: row.unit_id,
    // The database's check constraint keeps this to the known list; the
    // fallback is for a category added there before this app knew of it.
    category: isListingCategory(row.category) ? row.category : 'other',
    title: row.title,
    description: row.description,
    priceNote: row.price_note,
    contactPhone: row.contact_phone,
    onWhatsapp: row.on_whatsapp,
    photoPath: row.photo_path,
    photoUrl: row.photo_path ? (urls.get(row.photo_path) ?? null) : null,
    availableUntil: row.available_until,
    status,
    removedReason: row.removed_reason,
    createdAt: row.created_at,
    sellerName: row.seller?.profiles?.full_name?.trim() || 'A neighbour',
    flat: row.units?.number ? unitLabel(row.units) : null,
    reviewCount: rating?.count ?? 0,
    averageRating: rating?.average ?? null,
  } satisfies Listing;
}

/**
 * The stars for these listings, from the listing_ratings view. It counts only
 * reviews the reader could see; asking by listing is both filter and bound.
 */
async function fetchRatings(
  listingIds: string[],
  communityId?: string,
): Promise<Map<string, Rating>> {
  const ratings = new Map<string, Rating>();
  if (!listingIds.length) return ratings;
  // A long `in` list becomes a long URL. Past a couple of hundred it is
  // cheaper to take the whole society's ratings and pick from them.
  const query = supabase.from('listing_ratings').select('listing_id, review_count, average_rating');
  const { data } = await (listingIds.length <= 150 || !communityId
    ? query.in('listing_id', listingIds)
    : query.eq('community_id', communityId).limit(5000));
  for (const row of data ?? []) {
    if (!row.listing_id) continue;
    ratings.set(row.listing_id, {
      count: Number(row.review_count ?? 0),
      average: row.average_rating === null ? null : Number(row.average_rating),
    });
  }
  return ratings;
}

/** Everything on the board the viewer may see, own listings and taken-down ones included. */
export async function fetchBoard(communityId: string): Promise<Listing[]> {
  const { data } = await supabase
    .from('listings')
    .select(LISTING_FIELDS)
    .eq('community_id', communityId)
    .order('created_at', { ascending: false })
    .limit(500);
  const rows = (data ?? []) as ListingRow[];
  const [ratings, urls] = await Promise.all([
    fetchRatings(
      rows.map((row) => row.id),
      communityId,
    ),
    storedFileUrls(
      'listing-photos',
      rows.flatMap((row) => (row.photo_path ? [row.photo_path] : [])),
    ),
  ]);
  return rows.map((row) => toListing(row, ratings, urls));
}

/** Whether a listing belongs on the board today, by this phone's calendar. */
export const onTheBoard = (listing: Pick<Listing, 'status' | 'availableUntil'>) =>
  isListingCurrent({ status: listing.status, available_until: listing.availableUntil }, today());

/** Active, but past the last day it said it was on offer. */
export const hasEnded = (listing: Pick<Listing, 'status' | 'availableUntil'>) =>
  listing.status === 'active' && !onTheBoard(listing);

/** Best-rated first, weighed by how many reviews there are, then the newest. */
export function sortBoard(listings: Listing[]): Listing[] {
  return [...listings].sort(
    (a, b) =>
      listingScore(b.averageRating, b.reviewCount) - listingScore(a.averageRating, a.reviewCount) ||
      b.createdAt.localeCompare(a.createdAt),
  );
}

/** Whether a listing matches what somebody typed in the search box. */
export function matchesSearch(listing: Listing, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [listing.title, listing.description, listing.priceNote, listing.sellerName, listing.flat]
    .filter(Boolean)
    .some((field) => String(field).toLowerCase().includes(needle));
}

export type ListingReview = {
  id: string;
  membershipId: string;
  rating: number;
  body: string | null;
  createdAt: string;
  updatedAt: string;
  reviewerName: string;
};

export type VendorFor = {
  id: string;
  note: string | null;
  event: { slug: string; name: string; emoji: string | null; startsOn: string } | null;
};

/** One listing, its reviews, and the events it has been chosen to supply. */
export async function fetchListing(communityId: string, listingId: string) {
  const { data } = await supabase
    .from('listings')
    .select(LISTING_FIELDS)
    .eq('community_id', communityId)
    .eq('id', listingId)
    .maybeSingle();
  if (!data) return null;
  const row = data as ListingRow;

  const [ratings, urls, reviews, vendors] = await Promise.all([
    fetchRatings([row.id]),
    storedFileUrls('listing-photos', row.photo_path ? [row.photo_path] : []),
    supabase
      .from('listing_reviews')
      .select(
        'id, membership_id, rating, body, created_at, updated_at, reviewer:memberships!listing_reviews_membership_id_fkey(profiles(full_name))',
      )
      .eq('listing_id', row.id)
      .order('updated_at', { ascending: false })
      .limit(200),
    supabase
      .from('event_vendors')
      .select('id, note, events(slug, name, emoji, starts_on)')
      .eq('listing_id', row.id)
      .limit(50),
  ]);

  return {
    listing: toListing(row, ratings, urls),
    reviews: (reviews.data ?? []).map((review): ListingReview => ({
      id: review.id,
      membershipId: review.membership_id,
      rating: review.rating,
      body: review.body,
      createdAt: review.created_at,
      updatedAt: review.updated_at,
      reviewerName: review.reviewer?.profiles?.full_name?.trim() || 'A neighbour',
    })),
    vendorFor: (vendors.data ?? [])
      .map((vendor): VendorFor => ({
        id: vendor.id,
        note: vendor.note,
        event: vendor.events
          ? {
              slug: vendor.events.slug,
              name: vendor.events.name,
              emoji: vendor.events.emoji,
              startsOn: vendor.events.starts_on,
            }
          : null,
      }))
      // An event the viewer may not see (a draft, for a resident) is not
      // theirs to be told about.
      .filter((vendor) => vendor.event !== null)
      .sort((a, b) => (b.event?.startsOn ?? '').localeCompare(a.event?.startsOn ?? '')),
  };
}

export type ListingDetail = NonNullable<Awaited<ReturnType<typeof fetchListing>>>;

export type EventVendor = {
  id: string;
  note: string | null;
  listing: Listing;
};

/**
 * The listings chosen to supply an event. A vendor whose listing has since
 * been paused or taken down drops out for residents, because RLS no longer
 * returns the listing; staff still see it, so they can tidy it away.
 */
export async function fetchEventVendors(eventId: string): Promise<EventVendor[]> {
  const { data } = await supabase
    .from('event_vendors')
    .select('id, note, created_at, listing_id')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true })
    .limit(100);
  const rows = data ?? [];
  if (!rows.length) return [];

  const { data: listingRows } = await supabase
    .from('listings')
    .select(LISTING_FIELDS)
    .in(
      'id',
      rows.map((row) => row.listing_id),
    );
  const listings = (listingRows ?? []) as ListingRow[];
  const ratings = await fetchRatings(listings.map((row) => row.id));
  const byId = new Map(listings.map((row) => [row.id, toListing(row, ratings, new Map())]));

  return rows.flatMap((row) => {
    const listing = byId.get(row.listing_id);
    return listing ? [{ id: row.id, note: row.note, listing }] : [];
  });
}

/**
 * What the seller's form starts from: the number they gave the society (which
 * only they can read, through my_contact) and the flat they live in, so a
 * neighbour knows where to collect from.
 */
export async function fetchSellerDefaults(membershipId: string) {
  const [contact, flat] = await Promise.all([
    supabase.rpc('my_contact'),
    supabase
      .from('unit_occupants')
      .select('is_primary, units(id, block, number)')
      .eq('membership_id', membershipId)
      .is('moved_out_on', null)
      .order('is_primary', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const unit = flat.data?.units ?? null;
  return {
    phone: contact.data?.[0]?.phone ?? null,
    unit: unit ? { id: unit.id, label: unitLabel(unit) } : null,
  };
}

/**
 * Refreshes every marketplace read after a change, wherever it is shown: the
 * board, a listing, an event's vendors, the teaser on Home.
 */
export function invalidateMarket(queryClient: QueryClient) {
  void queryClient.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey[0];
      return (
        typeof key === 'string' &&
        (key === 'market' ||
          key.startsWith('market:') ||
          key.startsWith('listing:') ||
          key.startsWith('event-vendors:'))
      );
    },
  });
}
