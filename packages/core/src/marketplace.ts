import { z } from 'zod';
import { residentPhoneSchema, uuid } from './schemas';

/**
 * The marketplace: what residents make, teach and offer each other — idly
 * batter, Hindi classes for children, Diwali crackers, tailoring, a lawyer
 * two floors down — and, since 1118.0100, the old cycle sold once, the
 * pressure cooker somebody wants to borrow, a resident's shop, and the
 * outside electrician the committee recommends. Neighbours rate and review
 * what is offered again and again, and the committee can name a listing as a
 * vendor for an event.
 *
 * The database (migrations 1103.0100 and 1118.0100) is the authority on who
 * may post, review and moderate; this file is the shared vocabulary and the
 * form rules every surface validates against before it gets there.
 */

/**
 * What a listing is. Mirrors the listings_kind_known check constraint.
 *
 * Every listing posted before 1118.0100 is an offer, and an app built before
 * then shows every kind as one.
 */
export const LISTING_KINDS = ['offer', 'sale', 'wanted', 'shop', 'business'] as const;

export type ListingKind = (typeof LISTING_KINDS)[number];

export function isListingKind(value: unknown): value is ListingKind {
  return typeof value === 'string' && (LISTING_KINDS as readonly string[]).includes(value);
}

export const listingKindSchema = z.enum(LISTING_KINDS, {
  message: 'Pick what kind of listing it is',
});

/** One of them, on a badge: "For sale". */
export const LISTING_KIND_LABEL: Record<ListingKind, string> = {
  offer: 'Offered',
  sale: 'For sale',
  wanted: 'Wanted',
  shop: 'Shop',
  business: 'Local business',
};

/** All of them, on a filter: "Shops". */
export const LISTING_KIND_PLURAL: Record<ListingKind, string> = {
  offer: 'Offered',
  sale: 'For sale',
  wanted: 'Wanted',
  shop: 'Shops',
  business: 'Local businesses',
};

/** What posting one does, on the button that starts it. */
export const LISTING_KIND_ACTION: Record<ListingKind, string> = {
  offer: 'Offer what you make or teach',
  sale: 'Sell something',
  wanted: 'Ask for something',
  shop: 'Open your shop',
  business: 'Add a local business',
};

/** A line under each, so somebody posting knows which they want. */
export const LISTING_KIND_HINT: Record<ListingKind, string> = {
  offer: 'Food, classes, tailoring: something you do again and again',
  sale: 'One thing, once: an old cycle, a sofa, last year’s books',
  wanted: 'Something you are looking to buy or borrow',
  shop: 'A name and a cover photo, with everything you sell gathered under it',
  business: 'Somebody from outside the society the committee recommends',
};

/** What the title field asks for, and an example of one. */
export const LISTING_KIND_TITLE: Record<ListingKind, { label: string; placeholder: string }> = {
  offer: { label: 'What are you offering?', placeholder: 'Fresh idly & dosa batter' },
  sale: { label: 'What are you selling?', placeholder: 'Kids’ cycle, 20 inch' },
  wanted: {
    label: 'What are you looking for?',
    placeholder: 'Pressure cooker to borrow for a week',
  },
  shop: { label: 'Your shop’s name', placeholder: 'Lakshmi’s Kitchen' },
  business: { label: 'The business’s name', placeholder: 'Ravi Electricals' },
};

/** What the price field is called for each kind, and an example. */
export const LISTING_KIND_PRICE: Record<ListingKind, { label: string; placeholder: string }> = {
  offer: { label: 'Price', placeholder: '₹80 a kg, or On request' },
  sale: { label: 'Asking price', placeholder: '₹2,000, or Free' },
  wanted: { label: 'Budget', placeholder: 'Up to ₹1,500' },
  shop: { label: 'Prices', placeholder: 'From ₹60' },
  business: { label: 'Rates', placeholder: '₹300 a visit' },
};

/**
 * What neighbours rate and review: what is offered again and again. Nobody
 * reviews a second-hand cycle, and a review of a request is a review of a
 * neighbour. Mirrors the listing_reviews policies, and the same kinds are the
 * ones the committee can name as an event's vendor.
 */
export const REVIEWED_KINDS: readonly ListingKind[] = ['offer', 'shop', 'business'];

export function isReviewedKind(kind: ListingKind): boolean {
  return REVIEWED_KINDS.includes(kind);
}

/** Sold once, or found once: these are marked done rather than paused. */
export function isOnceOffKind(kind: ListingKind): boolean {
  return kind === 'sale' || kind === 'wanted';
}

/** "Sold" or "Found", for a once-off listing that has been marked done. */
export function closedLabel(kind: ListingKind): string {
  return kind === 'wanted' ? 'Found' : 'Sold';
}

/** At most five photos a listing (listings_photo_paths_shape); the first is its cover. */
export const MAX_LISTING_PHOTOS = 5;

/**
 * Mirrors the listings_category_known check constraint, in its order: what
 * residents make, teach and offer, then things sold once or looked for, then
 * what outside businesses bring to the gate.
 */
export const LISTING_CATEGORIES = [
  'home_food',
  'bakes',
  'tuition',
  'music_dance',
  'tailoring',
  'home_decor',
  'beauty_wellness',
  'professional',
  'festive',
  'home_services',
  'other',
  'furniture',
  'electronics',
  'appliances',
  'kids',
  'books',
  'vehicles',
  'clothing',
  'sports',
  'daily_needs',
  'laundry',
  'health',
  'transport',
] as const;

export type ListingCategory = (typeof LISTING_CATEGORIES)[number];

export const LISTING_CATEGORY_LABEL: Record<ListingCategory, string> = {
  home_food: 'Home food',
  bakes: 'Cakes & bakes',
  tuition: 'Tuition & classes',
  music_dance: 'Music & dance',
  tailoring: 'Tailoring & embroidery',
  home_decor: 'Home décor',
  beauty_wellness: 'Beauty & wellness',
  professional: 'Professional services',
  festive: 'Festive & seasonal',
  home_services: 'Home services',
  other: 'Something else',
  furniture: 'Furniture',
  electronics: 'Electronics & gadgets',
  appliances: 'Kitchen & appliances',
  kids: 'Kids & baby',
  books: 'Books & study',
  vehicles: 'Cycles & vehicles',
  clothing: 'Clothes & accessories',
  sports: 'Sports & fitness',
  daily_needs: 'Daily needs',
  laundry: 'Laundry & ironing',
  health: 'Health & pharmacy',
  transport: 'Drivers, movers & travel',
};

/** A line under each category in the picker, so a seller knows where they fit. */
export const LISTING_CATEGORY_HINT: Record<ListingCategory, string> = {
  home_food: 'Tiffins, batter, rotis, pickles, podis',
  bakes: 'Birthday cakes, cookies, brownies',
  tuition: 'School subjects, languages, coding',
  music_dance: 'Classes and lessons, any age',
  tailoring: 'Stitching, alterations, embroidery',
  home_decor: 'Décor, crafts, plants, rangoli',
  beauty_wellness: 'Mehendi, yoga, salon at home',
  professional: 'Lawyers, CAs, doctors, consultants',
  festive: 'Crackers, rakhis, diyas, gifts',
  home_services: 'Repairs, cleaning, cooking help',
  other: 'Anything that fits nowhere else',
  furniture: 'Sofas, beds, tables, shelves',
  electronics: 'Phones, laptops, TVs, cameras',
  appliances: 'Cookers, mixers, fridges, ACs',
  kids: 'Toys, prams, cots, school things',
  books: 'Textbooks, novels, exam guides',
  vehicles: 'Cycles, scooters, cars, helmets',
  clothing: 'Sarees, kurtas, shoes, bags',
  sports: 'Bats, rackets, treadmills, yoga mats',
  daily_needs: 'Milk, vegetables, water cans, newspapers',
  laundry: 'Ironing, dry-cleaning, washing',
  health: 'Clinics, pharmacies, physiotherapy',
  transport: 'Drivers, packers and movers, taxis',
};

const OFFERED: readonly ListingCategory[] = [
  'home_food',
  'bakes',
  'tuition',
  'music_dance',
  'tailoring',
  'home_decor',
  'beauty_wellness',
  'professional',
  'festive',
  'home_services',
  'other',
];

const THINGS: readonly ListingCategory[] = [
  'furniture',
  'electronics',
  'appliances',
  'kids',
  'books',
  'vehicles',
  'clothing',
  'sports',
  'home_decor',
  'festive',
  'other',
];

/**
 * The categories each kind's picker offers, so somebody selling a sofa is not
 * asked whether it is tuition. The database accepts any category on any kind;
 * this is about a short list, not a rule. Somebody looking for something may
 * be looking for anything, a tutor as much as a cot.
 */
export const KIND_CATEGORIES: Record<ListingKind, readonly ListingCategory[]> = {
  offer: OFFERED,
  shop: OFFERED,
  sale: THINGS,
  wanted: [...THINGS.filter((category) => !OFFERED.includes(category)), ...OFFERED],
  business: [
    'home_services',
    'daily_needs',
    'laundry',
    'health',
    'transport',
    'professional',
    'beauty_wellness',
    'home_food',
    'bakes',
    'tuition',
    'other',
  ],
};

export function isListingCategory(value: unknown): value is ListingCategory {
  return typeof value === 'string' && (LISTING_CATEGORIES as readonly string[]).includes(value);
}

export const listingCategorySchema = z.enum(LISTING_CATEGORIES, {
  message: 'Pick what kind of thing it is',
});

export type ListingStatus = 'active' | 'paused' | 'removed';

/** Empty strings from a form mean "not given". */
const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .optional()
    .transform((value) => (value ? value : null));

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-11-12');

/** The fields a seller fills in, on the web, in the app and over the API. */
export const listingSchema = z.object({
  kind: listingKindSchema.default('offer'),
  category: listingCategorySchema,
  title: z
    .string()
    .trim()
    .min(3, 'Say what you are offering in a few words')
    .max(120, 'Keep the title under 120 characters'),
  description: optionalText(2000, 'Keep the details under 2,000 characters'),
  price_note: optionalText(80, 'Keep the price under 80 characters'),
  contact_phone: residentPhoneSchema,
  on_whatsapp: z
    .union([z.boolean(), z.literal('on'), z.literal('true'), z.literal('false'), z.literal('')])
    .optional()
    .transform((value) => value === true || value === 'on' || value === 'true'),
  available_until: isoDate
    .optional()
    .or(z.literal('').transform(() => undefined))
    .transform((value) => value ?? null),
});

export type ListingInput = z.infer<typeof listingSchema>;

export const listingReviewSchema = z.object({
  listing_id: uuid,
  rating: z.coerce
    .number({ message: 'Choose from one to five stars' })
    .int('Choose from one to five stars')
    .min(1, 'Choose from one to five stars')
    .max(5, 'Choose from one to five stars'),
  body: optionalText(1000, 'Keep the review under 1,000 characters'),
});

export type ListingReviewInput = z.infer<typeof listingReviewSchema>;

export const eventVendorSchema = z.object({
  event_id: uuid,
  listing_id: uuid,
  note: optionalText(120, 'Keep it under 120 characters'),
});

/**
 * Whether a listing is still on offer on a given day. A seasonal listing
 * (crackers before Diwali) carries the last day it applies; after that it
 * leaves the board without its seller having to remember to take it down.
 */
export function isListingCurrent(
  listing: { status: ListingStatus | string; available_until: string | null },
  today: string = new Date().toISOString().slice(0, 10),
): boolean {
  if (listing.status !== 'active') return false;
  return !listing.available_until || listing.available_until >= today;
}

/** "4.5" with one decimal, or null when nobody has rated it yet. */
export function formatRating(average: number | null | undefined): string | null {
  if (average === null || average === undefined || Number.isNaN(average)) return null;
  return (Math.round(average * 10) / 10).toFixed(1);
}

/** Five characters of stars for a 1–5 rating, rounded to the nearest whole. */
export function starString(rating: number): string {
  const full = Math.max(0, Math.min(5, Math.round(rating)));
  return '★'.repeat(full) + '☆'.repeat(5 - full);
}

/** "12 reviews", "1 review", "No reviews yet". */
export function reviewCountLabel(count: number): string {
  if (!count) return 'No reviews yet';
  return `${count} review${count === 1 ? '' : 's'}`;
}

/** The digits wa.me wants: the E.164 number without its plus. */
export function whatsappLink(phone: string, text?: string): string {
  const digits = phone.replace(/[^\d]/g, '');
  const query = text ? `?text=${encodeURIComponent(text)}` : '';
  return `https://wa.me/${digits}${query}`;
}

/** A tel: link for the call button. */
export function telLink(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

/** What a neighbour's WhatsApp opens with, so the seller knows where they saw it. */
export function listingEnquiryText(title: string, society: string, kind?: ListingKind): string {
  if (kind === 'wanted') {
    return `Hi! I saw you are looking for "${title}" on the ${society} marketplace in Compences.`;
  }
  return `Hi! I saw "${title}" on the ${society} marketplace in Compences.`;
}

/**
 * Sorts the board: the best-rated first among those with reviews, then the
 * newest. A listing with one five-star review should not outrank one with
 * thirty reviews averaging 4.8, so ratings are weighed by how many there are
 * (a Bayesian average pulled towards 3.5 with the weight of three reviews).
 */
export function listingScore(average: number | null | undefined, count: number): number {
  if (!count || average === null || average === undefined) return 0;
  const prior = 3.5;
  const weight = 3;
  return (average * count + prior * weight) / (count + weight);
}
