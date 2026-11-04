import type { CSSProperties } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Briefcase,
  CakeSlice,
  CookingPot,
  Flower2,
  Gift,
  Music,
  Scissors,
  Shapes,
  Sparkles,
  Star,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import {
  LISTING_CATEGORY_LABEL,
  formatDate,
  formatRating,
  reviewCountLabel,
  type ListingCategory,
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

export function ListingStatusBadge({ status }: { status: Listing['status'] }) {
  if (status === 'paused') return <Badge tone="neutral">Paused</Badge>;
  if (status === 'removed') return <Badge tone="danger">Taken down</Badge>;
  return <Badge tone="success">On the board</Badge>;
}

/** Who is selling, and where to find them: "Lakshmi Rao · A-402". */
export function sellerLine(listing: Pick<Listing, 'sellerName' | 'flat'>): string {
  return [listing.sellerName, listing.flat].filter(Boolean).join(' · ');
}

/** One listing on the board: its picture if it has one, what, how much, who. */
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
        <p className="text-ink-muted inline-flex items-center gap-1.5 text-xs">
          <CategoryIcon category={listing.category} className="size-3.5" />
          {LISTING_CATEGORY_LABEL[listing.category]}
        </p>
        <p className="text-ink text-[15px] leading-snug font-medium">{listing.title}</p>
        {listing.priceNote ? (
          <p className="text-ink text-sm font-semibold">{listing.priceNote}</p>
        ) : null}
        <p className="text-ink-subtle text-xs">{sellerLine(listing)}</p>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
          <RatingSummary average={listing.averageRating} count={listing.reviewCount} />
          {listing.availableUntil ? (
            <Badge tone="warning">Until {formatDate(listing.availableUntil)}</Badge>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
