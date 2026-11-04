import type { ReactNode } from 'react';
import Link from 'next/link';
import { Plus, Search, Store } from 'lucide-react';
import {
  LISTING_CATEGORIES,
  LISTING_CATEGORY_LABEL,
  can,
  formatDate,
  isListingCategory,
  isListingCurrent,
  listingScore,
  todayIn,
  type ListingCategory,
} from '@compences/core';
import { requireCommunity } from '@/lib/auth';
import { getListings, type ListingCard } from '@/lib/market';
import { cn } from '@/lib/utils';
import { PageBody, PageHeader } from '@/components/page-header';
import { Card, CardHeader } from '@/components/ui/card';
import { Button, ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/field';
import { SectionLabel } from '@/components/section-label';
import { CategoryIcon, ListingStatusBadge, ListingTile } from '@/components/listing-bits';

export const metadata = { title: 'Marketplace' };

/**
 * What neighbours make, teach and offer: idly batter, Hindi on Saturday
 * mornings, crackers before Diwali, a CA two floors down.
 *
 * The board shows what is on offer today — active, and not past its
 * "available until" — best-rated first, weighed by how many have rated it, and
 * then the newest. Below it the viewer's own listings in whatever state they
 * are, because a seller whose listing was taken down needs to see why
 * somewhere other than a notification they may have swiped away.
 *
 * Filtering is by query string, so a filtered board is a link somebody can
 * send to the society's WhatsApp group.
 */
export default async function MarketPage(props: PageProps<'/app/[community]/market'>) {
  const { community: slug } = await props.params;
  const search = await props.searchParams;
  const { community, viewRole: role, membership } = await requireCommunity(slug);
  const listings = await getListings(community.id);

  const base = `/app/${community.slug}/market`;
  const today = todayIn(community.timezone);
  const canPost = can(role, 'marketplace:post');
  const canModerate = can(role, 'marketplace:moderate');

  const category = one(search.category);
  const chosen: ListingCategory | null = isListingCategory(category) ? category : null;
  const query = (one(search.q) ?? '').trim();

  const current = listings
    .filter((listing) => isListingCurrent(listingLike(listing), today))
    .sort(
      (a, b) =>
        listingScore(b.averageRating, b.reviewCount) -
          listingScore(a.averageRating, a.reviewCount) || b.createdAt.localeCompare(a.createdAt),
    );
  const shown = current.filter(
    (listing) => (!chosen || listing.category === chosen) && matches(listing, query),
  );
  // Only the kinds somebody is offering, so a chip never leads to nothing.
  const offered = LISTING_CATEGORIES.filter((c) => current.some((l) => l.category === c));

  const mine = listings.filter((listing) => listing.membershipId === membership.id);
  const takenDown = canModerate
    ? listings.filter((l) => l.status === 'removed' && l.membershipId !== membership.id)
    : [];

  const hrefFor = (next: { category?: ListingCategory | null; q?: string }) => {
    const params = new URLSearchParams();
    const c = 'category' in next ? next.category : chosen;
    const q = 'q' in next ? next.q : query;
    if (c) params.set('category', c);
    if (q) params.set('q', q);
    const text = params.toString();
    return text ? `${base}?${text}` : base;
  };

  return (
    <>
      <PageHeader
        title="Marketplace"
        description={
          current.length
            ? `${current.length} ${current.length === 1 ? 'thing' : 'things'} neighbours make, teach and offer.`
            : 'What neighbours make, teach and offer.'
        }
        action={
          canPost ? (
            <ButtonLink href={`${base}/new`} size="sm">
              <Plus className="size-4" aria-hidden="true" />
              Post a listing
            </ButtonLink>
          ) : null
        }
      />
      <PageBody>
        <div className="space-y-8">
          {current.length ? (
            <section aria-label="On offer" className="space-y-4">
              <form action={base} className="flex gap-2" role="search">
                {chosen ? <input type="hidden" name="category" value={chosen} /> : null}
                <label htmlFor="market-q" className="sr-only">
                  Search the marketplace
                </label>
                <Input
                  id="market-q"
                  name="q"
                  type="search"
                  defaultValue={query}
                  placeholder="Batter, tuition, mehendi…"
                  className="max-w-md"
                />
                <Button type="submit" variant="secondary" size="md">
                  <Search className="size-4" aria-hidden="true" />
                  <span className="sr-only sm:not-sr-only">Search</span>
                </Button>
              </form>

              {offered.length > 1 ? (
                <nav aria-label="Categories" className="-mx-1 flex flex-wrap gap-2 px-1">
                  <Chip href={hrefFor({ category: null })} active={!chosen}>
                    All
                  </Chip>
                  {offered.map((c) => (
                    <Chip key={c} href={hrefFor({ category: c })} active={chosen === c}>
                      <CategoryIcon category={c} className="size-3.5" />
                      {LISTING_CATEGORY_LABEL[c]}
                    </Chip>
                  ))}
                </nav>
              ) : null}

              {shown.length ? (
                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {shown.map((listing, index) => (
                    <li key={listing.id} className="flex">
                      <ListingTile listing={listing} href={`${base}/${listing.id}`} index={index} />
                    </li>
                  ))}
                </ul>
              ) : (
                <Card>
                  <EmptyState
                    icon={<Search className="size-6" />}
                    title="Nothing matches that"
                    description={
                      query
                        ? `No listing mentions “${query}”${chosen ? ` in ${LISTING_CATEGORY_LABEL[chosen]}` : ''}.`
                        : 'Nobody is offering that right now.'
                    }
                    action={
                      <ButtonLink href={base} size="sm" variant="secondary">
                        Show everything
                      </ButtonLink>
                    }
                  />
                </Card>
              )}
            </section>
          ) : (
            <Card>
              <EmptyState
                icon={<Store className="size-6" />}
                title="Nothing on the marketplace yet"
                description="Idly batter by the kilo, Hindi classes on Saturday mornings, crackers for Diwali: whatever you make, teach or offer, your neighbours are the easiest customers you will find."
                action={
                  canPost ? (
                    <ButtonLink href={`${base}/new`} size="sm">
                      <Plus className="size-4" aria-hidden="true" />
                      Post the first listing
                    </ButtonLink>
                  ) : undefined
                }
              />
            </Card>
          )}

          {mine.length ? (
            <section aria-labelledby="mine-heading" className="space-y-3">
              <SectionLabel id="mine-heading">Your listings</SectionLabel>
              <Card>
                <ul className="divide-border-base divide-y">
                  {mine.map((listing) => (
                    <OwnRow
                      key={listing.id}
                      listing={listing}
                      href={`${base}/${listing.id}`}
                      today={today}
                    />
                  ))}
                </ul>
              </Card>
            </section>
          ) : null}

          {takenDown.length ? (
            <section aria-labelledby="removed-heading" className="space-y-3">
              <SectionLabel id="removed-heading">Taken down</SectionLabel>
              <Card>
                <CardHeader
                  title={`Off the board (${takenDown.length})`}
                  description="Only staff and the committee see these. Open one to put it back."
                />
                <ul className="divide-border-base divide-y">
                  {takenDown.map((listing) => (
                    <OwnRow
                      key={listing.id}
                      listing={listing}
                      href={`${base}/${listing.id}`}
                      today={today}
                      showSeller
                    />
                  ))}
                </ul>
              </Card>
            </section>
          ) : null}
        </div>
      </PageBody>
    </>
  );
}

/** A query parameter may arrive twice; the first one wins. */
function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function listingLike(listing: ListingCard) {
  return { status: listing.status, available_until: listing.availableUntil };
}

/** Every word of the search somewhere in what the listing says about itself. */
function matches(listing: ListingCard, query: string): boolean {
  if (!query) return true;
  const haystack = [
    listing.title,
    listing.description,
    listing.priceNote,
    listing.sellerName,
    listing.flat,
    LISTING_CATEGORY_LABEL[listing.category],
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .every((word) => haystack.includes(word));
}

function Chip({ href, active, children }: { href: string; active: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors pointer-coarse:min-h-11',
        active
          ? 'border-ink bg-ink text-surface'
          : 'border-border-base bg-surface-raised text-ink-muted hover:text-ink hover:border-border-strong',
      )}
    >
      {children}
    </Link>
  );
}

/** A listing the viewer owns (or moderates), with where it stands. */
function OwnRow({
  listing,
  href,
  today,
  showSeller = false,
}: {
  listing: ListingCard;
  href: string;
  today: string;
  showSeller?: boolean;
}) {
  const expired = listing.status === 'active' && !isListingCurrent(listingLike(listing), today);
  return (
    <li>
      <Link
        href={href}
        className="hover:bg-surface-sunken flex items-start justify-between gap-3 px-5 py-3 transition-colors"
      >
        <div className="min-w-0">
          <p className="text-ink text-sm font-medium">{listing.title}</p>
          <p className="text-ink-subtle mt-0.5 text-xs">
            {[
              LISTING_CATEGORY_LABEL[listing.category],
              showSeller ? [listing.sellerName, listing.flat].filter(Boolean).join(' · ') : null,
              listing.availableUntil ? `Until ${formatDate(listing.availableUntil)}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {listing.status === 'removed' ? (
            <p className="text-danger mt-1 text-xs">
              {listing.removedReason
                ? `Why: ${listing.removedReason}`
                : showSeller
                  ? 'No reason was given.'
                  : 'Ask the committee if you would like it back.'}
            </p>
          ) : expired ? (
            <p className="text-warning mt-1 text-xs">
              Its date has passed, so it is off the board. Edit it to offer it again.
            </p>
          ) : null}
        </div>
        {expired ? (
          <span className="text-ink-muted shrink-0 text-xs font-medium">Ended</span>
        ) : (
          <ListingStatusBadge status={listing.status} />
        )}
      </Link>
    </li>
  );
}
