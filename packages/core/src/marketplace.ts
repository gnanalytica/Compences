import { z } from 'zod';
import { residentPhoneSchema, uuid } from './schemas';

/**
 * The marketplace: what residents make, teach and offer each other — idly
 * batter, Hindi classes for children, Diwali crackers, tailoring, a lawyer
 * two floors down. Neighbours rate and review what they have bought, and the
 * committee can name a listing as a vendor for an event.
 *
 * The database (migration 1103.0100) is the authority on who may post,
 * review and moderate; this file is the shared vocabulary and the form rules
 * every surface validates against before it gets there.
 */

/** Mirrors the listings_category_known check constraint. */
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
export function listingEnquiryText(title: string, society: string): string {
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
