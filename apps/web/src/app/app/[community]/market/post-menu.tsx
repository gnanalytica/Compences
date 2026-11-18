import Link from 'next/link';
import { BadgeCheck, HandHelping, Search, Store, Tag, type LucideIcon } from 'lucide-react';
import {
  LISTING_KIND_ACTION,
  LISTING_KIND_HINT,
  can,
  type ListingKind,
  type MemberRole,
} from '@compences/core';
import { cn } from '@/lib/utils';

/** A line drawing for each kind of listing, beside the words that start one. */
export const LISTING_KIND_ICON: Record<ListingKind, LucideIcon> = {
  sale: Tag,
  offer: HandHelping,
  wanted: Search,
  shop: Store,
  business: BadgeCheck,
};

export function KindIcon({ kind, className }: { kind: ListingKind; className?: string }) {
  const Icon = LISTING_KIND_ICON[kind];
  return <Icon className={cn('size-4', className)} aria-hidden="true" />;
}

/**
 * What this person may put on the board, most common first. Residents and
 * the committee sell, offer, ask and open a shop (one each); staff and the
 * committee add outside businesses.
 */
export function postableKinds(
  role: MemberRole | null | undefined,
  hasShop: boolean,
): ListingKind[] {
  const kinds: ListingKind[] = [];
  if (can(role, 'marketplace:post')) {
    kinds.push('sale', 'offer', 'wanted');
    if (!hasShop) kinds.push('shop');
  }
  if (can(role, 'marketplace:business')) kinds.push('business');
  return kinds;
}

/**
 * Every way onto the board, as a row of buttons under the heading, so that
 * selling a cycle is one press from the marketplace rather than a form that
 * first asks what you meant.
 */
export function PostMenu({ base, kinds }: { base: string; kinds: ListingKind[] }) {
  if (!kinds.length) return null;
  return (
    <nav aria-label="Post on the marketplace">
      <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {kinds.map((kind) => (
          <li key={kind} className="flex">
            <Link
              href={`${base}/new?kind=${kind}`}
              className="pressable border-border-base bg-surface-raised hover:border-border-strong flex flex-1 items-start gap-3 rounded-2xl border p-3.5 transition-colors"
            >
              <span className="text-accent grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--festival-wash)]">
                <KindIcon kind={kind} className="size-[18px]" />
              </span>
              <span className="min-w-0">
                <span className="text-ink block text-sm font-semibold">
                  {LISTING_KIND_ACTION[kind]}
                </span>
                <span className="text-ink-muted mt-0.5 block text-xs">
                  {LISTING_KIND_HINT[kind]}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
