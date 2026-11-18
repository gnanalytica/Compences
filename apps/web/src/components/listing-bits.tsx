import type { CSSProperties } from 'react';
import Link from 'next/link';
import {
  Baby,
  Bike,
  BookOpen,
  Briefcase,
  CakeSlice,
  CookingPot,
  Dumbbell,
  Flower2,
  Gift,
  Library,
  Microwave,
  Music,
  Scissors,
  Shapes,
  Shirt,
  ShoppingBasket,
  Smartphone,
  Sofa,
  Sparkles,
  Star,
  Stethoscope,
  Truck,
  WashingMachine,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import {
  LISTING_CATEGORY_LABEL,
  LISTING_KIND_LABEL,
  closedLabel,
  formatDate,
  formatRating,
  isReviewedKind,
  reviewCountLabel,
  type ListingCategory,
  type ListingKind,
} from '@compences/core';
import type { ListingCard as Listing } from '@/lib/market';
import { cn } from '@/lib/utils';
import { Badge } from './ui/badge';

/**
 * A line icon for each kind of listing.
 *
 * Not emoji: neither app draws any (see premium-look.test.ts), because every
 * phone draws them differently and a board of them reads as a chat rather
 * than a noticeboard. The mobile app carries the same icons.
 */
export const LISTING_CATEGORY_ICON: Record<ListingCategory, LucideIcon> = {
  home_food: CookingPot,
  bakes: CakeSlice,
  tuition: BookOpen,
  music_dance: Music,
  tailoring: Scissors,
  home_decor: Flower2,
  beauty_wellness: Sparkles,
  professional: Briefcase,
  festive: Gift,
  home_services: Wrench,
  other: Shapes,
  furniture: Sofa,
  electronics: Smartphone,
  appliances: Microwave,
  kids: Baby,
  books: Library,
  vehicles: Bike,
  clothing: Shirt,
  sports: Dumbbell,
  daily_needs: ShoppingBasket,
  laundry: WashingMachine,
  health: Stethoscope,
  transport: Truck,
};

export function CategoryIcon({
  category,
  className,
}: {
  category: ListingCategory;
  className?: string;
}) {
  const Icon = LISTING_CATEGORY_ICON[category];
  return <Icon className={cn('size-4', className)} aria-hidden="true" />;
}

/** Five stars, filled to the nearest whole, with the number for screen readers. */
export function Stars({
  rating,
  className,
  size = 'size-3.5',
}: {
  rating: number;
  className?: string;
  size?: string;
}) {
  const full = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <span
      className={cn('text-gold inline-flex items-center gap-0.5', className)}
      role="img"
      aria-label={`${formatRating(rating) ?? rating} out of 5`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(size, n <= full ? 'fill-current' : 'opacity-40')}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

/** "★★★★☆ 4.2 · 12 reviews", or "No reviews yet". */
export function RatingSummary({
  average,
  count,
  className,
}: {
  average: number | null;
  count: number;
  className?: string;
}) {
  const shown = formatRating(average);
  return (
    <span className={cn('text-ink-muted inline-flex items-center gap-1.5 text-xs', className)}>
      {count && shown ? (
        <>
          <Stars rating={Number(shown)} />
          <span className="text-ink font-medium">{shown}</span>
          <span aria-hidden="true">·</span>
        </>
      ) : null}
      {reviewCountLabel(count)}
    </span>
  );
}

/**
 * Where a listing stands, for whoever can see it off the board. Something
 * sold or found is paused underneath (so apps built before 1118.0100 hide
 * it), and says which.
 */
export function ListingStatusBadge({
  status,
  kind,
  closedAt,
}: {
  status: Listing['status'];
  kind?: ListingKind;
  closedAt?: string | null;
}) {
  if (status === 'removed') return <Badge tone="danger">Taken down</Badge>;
  if (closedAt && kind) return <Badge tone="info">{closedLabel(kind)}</Badge>;
  if (status === 'paused') return <Badge tone="neutral">Paused</Badge>;
  return <Badge tone="success">On the board</Badge>;
}

/**
 * What kind of listing it is, on a card or a page. An offer is what the
 * marketplace has always been, so it goes unmarked.
 */
export function KindBadge({ kind }: { kind: ListingKind }) {
  if (kind === 'offer') return null;
  return (
    <Badge tone={kind === 'business' || kind === 'shop' ? 'brand' : 'neutral'}>
      {LISTING_KIND_LABEL[kind]}
    </Badge>
  );
}

/** The words for an outside business's seller line: nobody's flat, the committee's word. */
export const RECOMMENDED_BY_COMMITTEE = 'Recommended by the committee';

/**
 * Who is selling, and where to find them: "Lakshmi Rao · A-402", or the shop
 * they sell under, "Lakshmi’s Kitchen · A-402". An outside business is the
 * committee's recommendation rather than anybody's post.
 */
export function sellerLine(
  listing: Pick<Listing, 'sellerName' | 'flat'> & {
    kind?: ListingKind;
    shop?: { title: string } | null;
  },
): string {
  if (listing.kind === 'business') return RECOMMENDED_BY_COMMITTEE;
  return [listing.shop?.title ?? listing.sellerName, listing.flat].filter(Boolean).join(' · ');
}

/** The price as a card shows it; a wanted notice's is what they will pay. */
export function priceLine(listing: Pick<Listing, 'kind' | 'priceNote'>): string | null {
  if (!listing.priceNote) return null;
  return listing.kind === 'wanted' ? `Budget: ${listing.priceNote}` : listing.priceNote;
}

/** One listing on the board: its cover if it has one, what, how much, who. */
export function ListingTile({
  listing,
  href,
  index = 0,
}: {
  listing: Listing;
  href: string;
  index?: number;
}) {
  return (
    <Link
      href={href}
      style={{ '--i': index } as CSSProperties}
      className="rise-in pressable border-border-base bg-surface-raised shadow-card hover:border-border-strong flex flex-col overflow-hidden rounded-2xl border transition-colors"
    >
      {listing.photoUrl ? (
        // A signed, short-lived link to a private file: next/image would
        // cache it past its expiry, and there is nothing to optimise.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={listing.photoUrl}
          alt=""
          loading="lazy"
          className="bg-surface-sunken aspect-[4/3] w-full object-cover"
        />
      ) : (
        <div
          aria-hidden="true"
          className="text-accent grid aspect-[4/3] w-full place-items-center bg-[var(--festival-wash)]"
        >
          <CategoryIcon category={listing.category} className="size-9 opacity-80" />
        </div>
      )}
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-ink-muted inline-flex items-center gap-1.5 text-xs">
            <CategoryIcon category={listing.category} className="size-3.5" />
            {LISTING_CATEGORY_LABEL[listing.category]}
          </p>
          <KindBadge kind={listing.kind} />
        </div>
        <p className="text-ink text-[15px] leading-snug font-medium">{listing.title}</p>
        {priceLine(listing) ? (
          <p className="text-ink text-sm font-semibold">{priceLine(listing)}</p>
        ) : null}
        <p className="text-ink-subtle text-xs">{sellerLine(listing)}</p>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
          {isReviewedKind(listing.kind) ? (
            <RatingSummary average={listing.averageRating} count={listing.reviewCount} />
          ) : (
            <span />
          )}
          {listing.availableUntil ? (
            <Badge tone="warning">Until {formatDate(listing.availableUntil)}</Badge>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

/**
 * A smaller card for the strip on Home: the cover, what it is, and the price
 * or the kind. Fixed width, so the row reads as something to scroll.
 */
export function ListingStripCard({
  listing,
  href,
  index = 0,
}: {
  listing: Listing;
  href: string;
  index?: number;
}) {
  const price = priceLine(listing);
  return (
    <Link
      href={href}
      style={{ '--i': index } as CSSProperties}
      className="rise-in pressable border-border-base bg-surface-raised shadow-card hover:border-border-strong flex w-44 shrink-0 snap-start flex-col overflow-hidden rounded-2xl border transition-colors sm:w-48"
    >
      {listing.photoUrl ? (
        // A signed, short-lived link: see ListingTile.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={listing.photoUrl}
          alt=""
          loading="lazy"
          className="bg-surface-sunken aspect-square w-full object-cover"
        />
      ) : (
        <div
          aria-hidden="true"
          className="text-accent grid aspect-square w-full place-items-center bg-[var(--festival-wash)]"
        >
          <CategoryIcon category={listing.category} className="size-8 opacity-80" />
        </div>
      )}
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="text-ink line-clamp-2 text-sm leading-snug font-medium">{listing.title}</p>
        <p className="text-ink-muted mt-auto truncate text-xs">
          {price ??
            (listing.kind === 'offer'
              ? LISTING_CATEGORY_LABEL[listing.category]
              : LISTING_KIND_LABEL[listing.kind])}
        </p>
      </div>
    </Link>
  );
}

/**
 * A listing's photos on its page. One is shown whole; several sit in a row
 * that snaps photo by photo — swiped on a phone, scrolled or arrowed on a
 * computer (the row takes focus) — each a little narrower than the row, so
 * the next one showing at the edge says there is more. No script: the page
 * is rendered on the server, and a carousel is not worth shipping one for.
 */
export function ListingGallery({ title, urls }: { title: string; urls: string[] }) {
  if (!urls.length) return null;
  if (urls.length === 1) {
    return (
      // A signed, short-lived link to a private file: next/image would
      // cache it past its expiry, and there is nothing to optimise.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={urls[0]}
        alt={title}
        className="bg-surface-sunken max-h-[28rem] w-full object-cover"
      />
    );
  }
  return (
    <div className="bg-surface-sunken">
      <ul
        aria-label={`Photos of ${title}`}
        tabIndex={0}
        className="flex snap-x snap-mandatory gap-1 overflow-x-auto overscroll-x-contain focus-visible:outline-2 focus-visible:outline-offset-[-2px]"
      >
        {urls.map((url, index) => (
          <li key={url} className="w-[88%] shrink-0 snap-start sm:w-[80%]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={`${title}, photo ${index + 1} of ${urls.length}`}
              loading={index ? 'lazy' : undefined}
              className="aspect-[4/3] max-h-[28rem] w-full object-cover"
            />
          </li>
        ))}
      </ul>
      <p className="text-ink-subtle px-5 py-2 text-xs">
        {urls.length} photos. Swipe or scroll to see them all.
      </p>
    </div>
  );
}
