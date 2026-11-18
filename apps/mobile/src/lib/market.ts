import type { QueryClient } from '@tanstack/react-query';
import {
  isListingCategory,
  isListingCurrent,
  isListingKind,
  listingScore,
  unitLabel,
  type ListingCategory,
  type ListingKind,
  type ListingStatus,
} from '@compences/core';
import { today } from '../components/date-field';
import { storedFileUrls } from './storage';
import { supabase } from './supabase';

/**
 * Marketplace reads for the mobile app: the board, one listing with its
 * reviews, and the listings chosen to supply an event.
 *
 * Since 1118.0100 a listing has a kind — an offer, one thing for sale,
 * something wanted, a resident's shop, or an outside business — and up to
 * five photos, of which the first is the cover. The board signs only the
 * covers, which is all a card shows; one listing's page signs all of them.
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
  'id, community_id, membership_id, unit_id, kind, category, title, description, price_note, contact_phone, on_whatsapp, photo_path, photo_paths, available_until, status, closed_at, removed_reason, created_at, updated_at, seller:memberships!listings_membership_id_fkey(profiles(full_name)), units(block, number)';

/** A listing as every marketplace screen reads it. */
export type Listing = {
  id: string;
  communityId: string;
  membershipId: string;
  unitId: string | null;
  kind: ListingKind;
  category: ListingCategory;
  title: string;
  description: string | null;
  priceNote: string | null;
  contactPhone: string;
  onWhatsapp: boolean;
  /** The cover: the first of photoPaths. */
  photoPath: string | null;
  /** A signed link to the cover, when there is one the viewer may see. */
  photoUrl: string | null;
  /** Every photo, in order, the cover first. */
  photoPaths: string[];
  /**
   * A signed link for each of photoPaths, in the same order, or null where
   * there is none. The board signs only the cover; one listing's page signs
   * all of them.
   */
  photoUrls: (string | null)[];
  availableUntil: string | null;
  status: ListingStatus;
  /** When a sale was marked sold, or a wanted notice found. It is paused then too. */
  closedAt: string | null;
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
  seller: { profiles: { full_name: string | null } | null } | null;
  units: { block: string | null; number: string | null } | null;
};

type Rating = { count: number; average: number | null };

/**
 * A row's photos, cover first. A listing an older app last saved may have
 * only photo_path; the database keeps the two in step, but reading both
 * costs nothing.
 */
function photoPathsOf(row: Pick<ListingRow, 'photo_path' | 'photo_paths'>): string[] {
  const paths = (row.photo_paths ?? []).filter(Boolean);
  if (paths.length) return paths;
  return row.photo_path ? [row.photo_path] : [];
}

function toListing(row: ListingRow, ratings: Map<string, Rating>, urls: Map<string, string>) {
  const rating = ratings.get(row.id);
  const photos = photoPathsOf(row);
  const status: ListingStatus =
    row.status === 'paused' || row.status === 'removed' ? row.status : 'active';
  return {
    id: row.id,
    communityId: row.community_id,
    membershipId: row.membership_id,
    unitId: row.unit_id,
    // As for categories: a kind added to the database after this build was
    // made reads as the plainest one there is.
    kind: isListingKind(row.kind) ? row.kind : 'offer',
    // The database's check constraint keeps this to the known list; the
    // fallback is for a category added there before this app knew of it.
    category: isListingCategory(row.category) ? row.category : 'other',
    title: row.title,
    description: row.description,
    priceNote: row.price_note,
    contactPhone: row.contact_phone,
    onWhatsapp: row.on_whatsapp,
    photoPath: photos[0] ?? null,
    photoUrl: photos[0] ? (urls.get(photos[0]) ?? null) : null,
    photoPaths: photos,
    photoUrls: photos.map((path) => urls.get(path) ?? null),
    availableUntil: row.available_until,
    status,
    closedAt: row.closed_at,
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
    // The covers only: a card shows one picture.
    storedFileUrls(
      'listing-photos',
      rows.flatMap((row) => photoPathsOf(row).slice(0, 1)),
    ),
  ]);
  return rows.map((row) => toListing(row, ratings, urls));
}

/**
 * Each seller's shop that is on the board, by membership, so a card can say
 * "Lakshmi's Kitchen" rather than "Lakshmi" for everything she sells.
 */
export function shopsBySeller(listings: Listing[]): Map<string, Listing> {
  const shops = new Map<string, Listing>();
  for (const listing of listings) {
    if (listing.kind === 'shop' && onTheBoard(listing)) shops.set(listing.membershipId, listing);
  }
  return shops;
}

/**
 * Who a listing is from, in one line. An outside business is the committee's
 * recommendation, not any one person's post; a resident with a shop sells
 * under its name; anybody else is their name and flat.
 */
export function sellerLine(listing: Listing, shops?: Map<string, Listing>): string {
  if (listing.kind === 'business') return 'Recommended by the committee';
  const shop = listing.kind === 'shop' ? null : shops?.get(listing.membershipId);
  return [shop ? shop.title : listing.sellerName, listing.flat].filter(Boolean).join(' · ');
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

  const [ratings, urls, reviews, vendors, sellers] = await Promise.all([
    fetchRatings([row.id]),
    storedFileUrls('listing-photos', photoPathsOf(row)),
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
    // The seller's other listings on the board, for a shop's page ("More
    // from") and for a link from anything else they sell to their shop. An
    // outside business has no seller in that sense.
    row.kind === 'business'
      ? Promise.resolve({ data: [] as ListingRow[] })
      : supabase
          .from('listings')
          .select(LISTING_FIELDS)
          .eq('community_id', communityId)
          .eq('membership_id', row.membership_id)
          .eq('status', 'active')
          .neq('id', row.id)
          .order('created_at', { ascending: false })
          .limit(50),
  ]);

  const sellerRows = (sellers.data ?? []) as ListingRow[];
  const [sellerRatings, sellerUrls] = sellerRows.length
    ? await Promise.all([
        fetchRatings(sellerRows.map((seller) => seller.id)),
        storedFileUrls(
          'listing-photos',
          sellerRows.flatMap((seller) => photoPathsOf(seller).slice(0, 1)),
        ),
      ])
    : [new Map<string, Rating>(), new Map<string, string>()];
  const fromSeller = sellerRows
    .map((seller) => toListing(seller, sellerRatings, sellerUrls))
    .filter(onTheBoard);

  return {
    listing: toListing(row, ratings, urls),
    /** The seller's shop, when this is something else they sell and they have one. */
    shop: row.kind === 'shop' ? null : (fromSeller.find((other) => other.kind === 'shop') ?? null),
    /** Everything else the seller has on the board, for a shop's page. */
    moreFromSeller: fromSeller.filter((other) => other.kind !== 'shop'),
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
