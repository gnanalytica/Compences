import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { can } from '../src/roles';
import { notificationAppRoute, notificationWebPath } from '../src/notifications';
import {
  LISTING_CATEGORIES,
  LISTING_CATEGORY_HINT,
  LISTING_CATEGORY_LABEL,
  formatRating,
  isListingCategory,
  isListingCurrent,
  listingReviewSchema,
  listingSchema,
  listingScore,
  reviewCountLabel,
  starString,
  telLink,
  whatsappLink,
} from '../src/marketplace';

const MIGRATION = join(
  __dirname,
  '../../../supabase/migrations/20261103000100_a_neighbour_can_sell_to_a_neighbour.sql',
);

describe('marketplace categories', () => {
  it('each have a label and a hint', () => {
    for (const category of LISTING_CATEGORIES) {
      expect(LISTING_CATEGORY_LABEL[category]).toBeTruthy();
      expect(LISTING_CATEGORY_HINT[category]).toBeTruthy();
    }
  });

  it('match the set the database accepts', () => {
    const sql = readFileSync(MIGRATION, 'utf8');
    const block = sql.match(/listings_category_known check \(category in \(([^)]*)\)/);
    expect(block).not.toBeNull();
    const inDb = [...block![1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
    expect(inDb).toEqual([...LISTING_CATEGORIES]);
  });

  it('rejects one it does not know', () => {
    expect(isListingCategory('home_food')).toBe(true);
    expect(isListingCategory('weapons')).toBe(false);
    expect(isListingCategory(undefined)).toBe(false);
  });
});

describe('a listing form', () => {
  const base = {
    category: 'home_food',
    title: '  Jonna rotis  ',
    description: '',
    price_note: '₹15 each',
    contact_phone: '98450 10303',
    on_whatsapp: 'on',
    available_until: '',
  };

  it('normalises what a seller types', () => {
    const parsed = listingSchema.parse(base);
    expect(parsed).toEqual({
      category: 'home_food',
      title: 'Jonna rotis',
      description: null,
      price_note: '₹15 each',
      contact_phone: '+919845010303',
      on_whatsapp: true,
      available_until: null,
    });
  });

  it('reads an unticked WhatsApp box as no', () => {
    const { on_whatsapp: _drop, ...rest } = base;
    expect(listingSchema.parse(rest).on_whatsapp).toBe(false);
  });

  it('keeps a last day for a seasonal offer', () => {
    expect(listingSchema.parse({ ...base, available_until: '2026-11-12' }).available_until).toBe(
      '2026-11-12',
    );
  });

  it('needs a title, a known category and a phone that works', () => {
    expect(listingSchema.safeParse({ ...base, title: 'ab' }).success).toBe(false);
    expect(listingSchema.safeParse({ ...base, category: 'weapons' }).success).toBe(false);
    expect(listingSchema.safeParse({ ...base, contact_phone: 'call me' }).success).toBe(false);
  });
});

describe('a review', () => {
  const id = '6f1d3c3e-1b7a-4c1e-9a55-1b2c3d4e5f60';
  it('is one to five whole stars', () => {
    expect(listingReviewSchema.parse({ listing_id: id, rating: '4', body: '' })).toEqual({
      listing_id: id,
      rating: 4,
      body: null,
    });
    expect(listingReviewSchema.safeParse({ listing_id: id, rating: 0 }).success).toBe(false);
    expect(listingReviewSchema.safeParse({ listing_id: id, rating: 6 }).success).toBe(false);
    expect(listingReviewSchema.safeParse({ listing_id: id, rating: 3.5 }).success).toBe(false);
  });
});

describe('what the board shows', () => {
  it('drops a seasonal listing after its last day', () => {
    const crackers = { status: 'active', available_until: '2026-11-08' };
    expect(isListingCurrent(crackers, '2026-11-08')).toBe(true);
    expect(isListingCurrent(crackers, '2026-11-09')).toBe(false);
    expect(isListingCurrent({ status: 'active', available_until: null }, '2030-01-01')).toBe(true);
    expect(isListingCurrent({ status: 'paused', available_until: null })).toBe(false);
  });

  it('writes ratings and counts plainly', () => {
    expect(formatRating(4.25)).toBe('4.3');
    expect(formatRating(null)).toBeNull();
    expect(starString(4)).toBe('★★★★☆');
    expect(starString(4.6)).toBe('★★★★★');
    expect(reviewCountLabel(0)).toBe('No reviews yet');
    expect(reviewCountLabel(1)).toBe('1 review');
    expect(reviewCountLabel(12)).toBe('12 reviews');
  });

  it('does not let one five-star review outrank thirty good ones', () => {
    expect(listingScore(4.8, 30)).toBeGreaterThan(listingScore(5, 1));
    expect(listingScore(null, 0)).toBe(0);
  });

  it('links to a call and a WhatsApp chat', () => {
    expect(telLink('+91 98450 10303')).toBe('tel:+919845010303');
    expect(whatsappLink('+919845010303', 'Hi there')).toBe(
      'https://wa.me/919845010303?text=Hi%20there',
    );
  });
});

describe('who takes part in the marketplace', () => {
  it('residents and the committee post and review; staff do neither', () => {
    for (const capability of ['marketplace:post', 'marketplace:review'] as const) {
      expect(can('resident', capability)).toBe(true);
      expect(can('committee', capability)).toBe(true);
      expect(can('staff', capability)).toBe(false);
    }
  });

  it('staff and the committee can take a listing down', () => {
    expect(can('staff', 'marketplace:moderate')).toBe(true);
    expect(can('committee', 'marketplace:moderate')).toBe(true);
    expect(can('resident', 'marketplace:moderate')).toBe(false);
  });
});

describe('marketplace notifications', () => {
  const data = { screen: 'listing', community_slug: 'green-valley', listing_id: 'abc' };
  it('open the listing on the web and in the app', () => {
    expect(notificationWebPath(data)).toBe('/app/green-valley/market/abc');
    expect(notificationAppRoute(data)).toBe('/listing/abc');
    expect(notificationWebPath({ screen: 'market', community_slug: 'green-valley' })).toBe(
      '/app/green-valley/market',
    );
  });
});
