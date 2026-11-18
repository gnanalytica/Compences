import type { ReactNode } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  CircleCheck,
  MapPin,
  MessageCircle,
  Pause,
  Pencil,
  Phone,
  Play,
  ShieldAlert,
  Star,
  Trash2,
  Undo2,
} from 'lucide-react';
import {
  LISTING_CATEGORY_LABEL,
  LISTING_KIND_LABEL,
  can,
  closedLabel,
  formatDate,
  isListingCurrent,
  isOnceOffKind,
  isReviewedKind,
  listingEnquiryText,
  telLink,
  todayIn,
  uuid,
  whatsappLink,
} from '@compences/core';
import { requireCommunity } from '@/lib/auth';
import { getListing, getListingReviews, getListings, getVendorEvents } from '@/lib/market';
import { PageBody, PageHeader } from '@/components/page-header';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Button, ButtonLink, buttonClass } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import {
  CategoryIcon,
  KindBadge,
  ListingGallery,
  ListingStatusBadge,
  ListingTile,
  RatingSummary,
  Stars,
  priceLine,
  sellerLine,
} from '@/components/listing-bits';
import {
  deleteListing,
  deleteReview,
  restoreListing,
  setListingClosed,
  setListingPaused,
} from '../actions';
import { ReviewForm, TakeDownForm } from './listing-forms';
import { ReportControls } from '@/components/report-forms';

export const metadata = { title: 'Marketplace' };

/**
 * One listing: what it is, who is selling, how to reach them, and what
 * neighbours made of it.
 *
 * Call and WhatsApp are links, not a form: the conversation happens on the
 * phone, as it would have anyway, and nothing about it passes through here.
 * WhatsApp opens with a line saying where they saw it, so a seller with two
 * hundred contacts knows which ad the message is about.
 *
 * Notifications about a listing (a new review, a take-down) land here, so the
 * seller sees the same page a neighbour does, with their own controls on top.
 *
 * Anybody else can report the listing or any review on it, and block whoever
 * wrote it. Nobody is offered either on something of their own.
 *
 * What the page holds depends on the kind (1118.0100). Something for sale or
 * wanted has no reviews, and its seller marks it sold or found. A shop lists
 * everything else its owner has on the board; anything else they post links
 * back to it. An outside business is the committee's recommendation: any of
 * staff or the committee may change or delete it, and it can be reported but
 * not blocked, since blocking whoever typed it in would not hide it.
 */
export default async function ListingPage(props: PageProps<'/app/[community]/market/[listing]'>) {
  const { community: slug, listing: listingId } = await props.params;
  const search = await props.searchParams;
  const { community, viewRole: role, membership } = await requireCommunity(slug);
  if (!uuid.safeParse(listingId).success) notFound();

  const listing = await getListing(community.id, listingId);
  if (!listing) notFound();
  const reviewed = isReviewedKind(listing.kind);
  const [reviews, vendorFor, everything] = await Promise.all([
    reviewed ? getListingReviews(listing.id) : [],
    getVendorEvents(listing.id),
    // The seller's shop and the rest of what they sell: the board is read
    // once per request (cached), so this costs no more than the board does.
    listing.kind === 'business' ? [] : getListings(community.id),
  ]);

  const base = `/app/${community.slug}`;
  const board = `${base}/market`;
  const today = todayIn(community.timezone);
  const isMine = listing.membershipId === membership.id;
  const canModerate = can(role, 'marketplace:moderate');
  const business = listing.kind === 'business';
  const onceOff = isOnceOffKind(listing.kind);
  // Who keeps it up to date: its seller, or for a business anyone on staff
  // or the committee.
  const mayManage = isMine || (business && can(role, 'marketplace:business'));
  const closed = Boolean(listing.closedAt) && listing.status !== 'removed';
  const current = isListingCurrent(
    { status: listing.status, available_until: listing.availableUntil },
    today,
  );
  const expired = listing.status === 'active' && !current;
  const mine = reviews.find((review) => review.membershipId === membership.id);
  const canReview =
    reviewed && can(role, 'marketplace:review') && !isMine && listing.status === 'active';

  const sellerShop =
    listing.kind === 'shop'
      ? null
      : everything.find(
          (other) =>
            other.kind === 'shop' &&
            other.membershipId === listing.membershipId &&
            other.status === 'active',
        );
  const shopListings =
    listing.kind === 'shop'
      ? everything.filter(
          (other) =>
            other.membershipId === listing.membershipId &&
            other.id !== listing.id &&
            isListingCurrent(
              { status: other.status, available_until: other.availableUntil },
              today,
            ),
        )
      : [];
  const seller = sellerLine({ ...listing, shop: sellerShop ?? null });

  return (
    <>
      <PageHeader
        title={listing.title}
        description={[
          listing.kind === 'offer' ? null : LISTING_KIND_LABEL[listing.kind],
          LISTING_CATEGORY_LABEL[listing.category],
          seller,
        ]
          .filter(Boolean)
          .join(' · ')}
        action={
          mayManage || canModerate ? (
            <ListingStatusBadge
              status={listing.status}
              kind={listing.kind}
              closedAt={listing.closedAt}
            />
          ) : undefined
        }
      />
      <PageBody>
        <Link
          href={board}
          className="text-ink-muted hover:text-ink mb-4 inline-flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Marketplace
        </Link>

        <div className="mx-auto max-w-3xl space-y-5">
          {/* Only while it is still up: once marked sold or paused, the line
              below says what happened instead. */}
          {(search.posted || search.saved) && listing.status === 'active' ? (
            <Notice tone="success">
              {search.posted
                ? business
                  ? 'The business is on the board, as the committee’s recommendation.'
                  : listing.kind === 'shop'
                    ? 'Your shop is open. Everything else you post shows under it.'
                    : 'Your listing is on the board. Neighbours can call or message you from here.'
                : 'Saved.'}
            </Notice>
          ) : null}
          {listing.status === 'removed' ? (
            <Notice tone="danger">
              {isMine ? 'The committee took this listing down' : 'Taken down'}
              {listing.removedReason ? `: ${listing.removedReason}` : '.'}{' '}
              {isMine
                ? 'Neighbours cannot see it. Ask the committee if you would like it back.'
                : null}
            </Notice>
          ) : closed ? (
            <Notice tone="neutral">
              {`Marked ${closedLabel(listing.kind).toLowerCase()}, so it is off the board.`}
              {isMine
                ? listing.kind === 'wanted'
                  ? ' Put it back on the board if you are still looking.'
                  : ' Put it back on the board if the sale falls through.'
                : null}
            </Notice>
          ) : listing.status === 'paused' ? (
            <Notice tone="neutral">
              Paused. Neighbours cannot see it until you put it back on the board.
            </Notice>
          ) : expired ? (
            <Notice tone="neutral">
              {`It was available until ${formatDate(listing.availableUntil)}, so it is off the board.`}
              {isMine ? ' Change or clear the date to offer it again.' : null}
            </Notice>
          ) : null}

          <Card className="overflow-hidden">
            <ListingGallery title={listing.title} urls={listing.photoUrls} />
            <CardBody className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="text-ink-muted inline-flex flex-wrap items-center gap-1.5 text-sm">
                  <CategoryIcon category={listing.category} />
                  {LISTING_CATEGORY_LABEL[listing.category]}
                  <KindBadge kind={listing.kind} />
                </p>
                {reviewed ? (
                  <RatingSummary average={listing.averageRating} count={listing.reviewCount} />
                ) : null}
              </div>
              {priceLine(listing) ? (
                <p className="text-ink font-serif text-2xl font-medium tracking-tight">
                  {priceLine(listing)}
                </p>
              ) : null}
              {listing.description ? (
                <p className="text-ink max-w-2xl text-sm leading-relaxed whitespace-pre-line">
                  {listing.description}
                </p>
              ) : null}
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div className="flex items-start gap-2.5">
                  {business ? (
                    <BadgeCheck className="text-ink-subtle mt-0.5 size-4" aria-hidden="true" />
                  ) : (
                    <MapPin className="text-ink-subtle mt-0.5 size-4" aria-hidden="true" />
                  )}
                  <div>
                    <dt className="sr-only">{business ? 'Who recommends it' : 'Seller'}</dt>
                    <dd className="text-ink">
                      {listing.kind === 'shop' ? `Run by ${seller}` : seller}
                    </dd>
                  </div>
                </div>
                {listing.availableUntil ? (
                  <div className="flex items-start gap-2.5">
                    <CalendarDays className="text-ink-subtle mt-0.5 size-4" aria-hidden="true" />
                    <div>
                      <dt className="sr-only">Available until</dt>
                      <dd className="text-ink">Until {formatDate(listing.availableUntil)}</dd>
                    </div>
                  </div>
                ) : null}
              </dl>

              {sellerShop ? (
                <Link
                  href={`${board}/${sellerShop.id}`}
                  className="text-ink hover:border-border-strong border-border-base bg-surface-sunken inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors"
                >
                  From {sellerShop.title}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              ) : null}

              {vendorFor.length ? (
                <p className="text-ink-muted text-sm">
                  Vendor for{' '}
                  {vendorFor.map((event, index) => (
                    <span key={event.id}>
                      {index ? ', ' : ''}
                      <Link
                        href={`${base}/events/${event.slug}`}
                        className="text-ink underline underline-offset-2"
                      >
                        {event.name}
                      </Link>
                      {event.note ? ` (${event.note})` : ''}
                    </span>
                  ))}
                </p>
              ) : null}

              {!isMine && current ? (
                <div className="border-border-base flex flex-wrap items-center gap-2 border-t pt-4">
                  <a href={telLink(listing.contactPhone)} className={buttonClass('primary', 'md')}>
                    <Phone className="size-4" aria-hidden="true" />
                    Call
                  </a>
                  {listing.onWhatsapp ? (
                    <a
                      href={whatsappLink(
                        listing.contactPhone,
                        listingEnquiryText(listing.title, community.name, listing.kind),
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={buttonClass('secondary', 'md')}
                    >
                      <MessageCircle className="size-4" aria-hidden="true" />
                      WhatsApp
                    </a>
                  ) : null}
                  <span className="text-ink-subtle font-mono text-xs">{listing.contactPhone}</span>
                </div>
              ) : null}
            </CardBody>
          </Card>

          {mayManage ? (
            <Card>
              <CardHeader
                title={
                  listing.kind === 'shop'
                    ? 'Your shop'
                    : business && !isMine
                      ? 'This business'
                      : 'Your listing'
                }
                description={
                  listing.status === 'removed'
                    ? 'Taken down listings cannot be edited until the committee restores them.'
                    : business
                      ? 'Anyone on staff or the committee can keep it up to date, or remove it.'
                      : onceOff
                        ? `Change it, mark it ${closedLabel(listing.kind).toLowerCase()} when it is done, or remove it for good.`
                        : 'Change it, pause it while you are away, or remove it for good.'
                }
              />
              <CardBody className="flex flex-wrap items-center gap-2">
                {listing.status !== 'removed' ? (
                  <ButtonLink href={`${board}/${listing.id}/edit`} size="sm" variant="secondary">
                    <Pencil className="size-4" aria-hidden="true" />
                    Edit
                  </ButtonLink>
                ) : null}
                {isMine && onceOff && listing.status !== 'removed' ? (
                  <form action={setListingClosed}>
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="listing_id" value={listing.id} />
                    <input type="hidden" name="closed" value={closed ? '0' : '1'} />
                    <Button type="submit" size="sm" variant={closed ? 'secondary' : 'primary'}>
                      {closed ? (
                        <>
                          <Play className="size-4" aria-hidden="true" />
                          Put back on the board
                        </>
                      ) : (
                        <>
                          <CircleCheck className="size-4" aria-hidden="true" />
                          Mark as {closedLabel(listing.kind).toLowerCase()}
                        </>
                      )}
                    </Button>
                  </form>
                ) : null}
                {isMine && !closed && listing.status !== 'removed' ? (
                  <>
                    <form action={setListingPaused}>
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="listing_id" value={listing.id} />
                      <input
                        type="hidden"
                        name="paused"
                        value={listing.status === 'paused' ? '0' : '1'}
                      />
                      <Button type="submit" size="sm" variant="secondary">
                        {listing.status === 'paused' ? (
                          <>
                            <Play className="size-4" aria-hidden="true" />
                            Put back on the board
                          </>
                        ) : (
                          <>
                            <Pause className="size-4" aria-hidden="true" />
                            Pause
                          </>
                        )}
                      </Button>
                    </form>
                  </>
                ) : null}
                {/* Inline, not a floating menu: a second press to confirm,
                    because a deleted listing takes its reviews with it. */}
                <details className="group">
                  <summary className={buttonClass('ghost', 'sm', 'cursor-pointer list-none')}>
                    <Trash2 className="size-4" aria-hidden="true" />
                    Delete
                  </summary>
                  <form action={deleteListing} className="mt-2 flex flex-wrap items-center gap-2">
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="listing_id" value={listing.id} />
                    {business ? <input type="hidden" name="business" value="1" /> : null}
                    <span className="text-ink-muted text-sm">
                      {reviewed
                        ? 'Its reviews go with it. This cannot be undone.'
                        : 'This cannot be undone.'}
                    </span>
                    <Button type="submit" size="sm" variant="danger">
                      Delete listing
                    </Button>
                  </form>
                </details>
              </CardBody>
            </Card>
          ) : null}

          {canModerate && (!isMine || listing.status === 'removed') ? (
            <Card>
              <CardHeader
                title={
                  <span className="inline-flex items-center gap-2">
                    <ShieldAlert className="text-ink-subtle size-4" aria-hidden="true" />
                    Moderation
                  </span>
                }
                description={
                  listing.status === 'removed'
                    ? 'Off the board. Restoring it puts it back where neighbours can see it.'
                    : 'Only staff and the committee see this. The seller is told it came down, and why.'
                }
              />
              <CardBody>
                {listing.status === 'removed' ? (
                  <form action={restoreListing}>
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="listing_id" value={listing.id} />
                    <Button type="submit" size="sm" variant="secondary">
                      <Undo2 className="size-4" aria-hidden="true" />
                      Restore
                    </Button>
                  </form>
                ) : (
                  <TakeDownForm slug={slug} listingId={listing.id} />
                )}
              </CardBody>
            </Card>
          ) : null}

          {reviewed ? (
            <Card id="reviews">
              <CardHeader
                title={`Reviews${reviews.length ? ` (${reviews.length})` : ''}`}
                action={
                  <RatingSummary average={listing.averageRating} count={listing.reviewCount} />
                }
              />
              {canReview ? (
                <CardBody className="border-border-base border-b">
                  <p className="text-ink mb-3 text-sm font-medium">
                    {mine ? 'Your review' : 'Bought from them? Tell your neighbours.'}
                  </p>
                  <ReviewForm
                    // A fresh form once the review it was showing is deleted,
                    // rather than stars still lit for a review that is gone.
                    key={mine?.id ?? 'new'}
                    slug={slug}
                    listingId={listing.id}
                    rating={mine?.rating}
                    body={mine?.body}
                  />
                  {mine ? (
                    <form action={deleteReview} className="mt-2">
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="listing_id" value={listing.id} />
                      <input type="hidden" name="review_id" value={mine.id} />
                      <button
                        type="submit"
                        className="text-ink-muted hover:text-ink text-xs underline underline-offset-4 pointer-coarse:min-h-11"
                      >
                        Delete my review
                      </button>
                    </form>
                  ) : null}
                </CardBody>
              ) : null}
              {reviews.length ? (
                <ul className="divide-border-base divide-y">
                  {reviews.map((review) => (
                    <li key={review.id} className="px-5 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-ink inline-flex items-center gap-2 text-sm font-medium">
                          {review.membershipId === membership.id ? 'You' : review.name}
                          <Stars rating={review.rating} />
                        </p>
                        <span className="text-ink-subtle text-xs">
                          {formatDate(review.updatedAt.slice(0, 10))}
                        </span>
                      </div>
                      {review.body ? (
                        <p className="text-ink-muted mt-1 text-sm whitespace-pre-line">
                          {review.body}
                        </p>
                      ) : null}
                      {canModerate && review.membershipId !== membership.id ? (
                        <form action={deleteReview} className="mt-1">
                          <input type="hidden" name="slug" value={slug} />
                          <input type="hidden" name="listing_id" value={listing.id} />
                          <input type="hidden" name="review_id" value={review.id} />
                          <button
                            type="submit"
                            className="text-ink-subtle hover:text-danger text-xs underline underline-offset-4 pointer-coarse:min-h-11"
                          >
                            Remove review
                          </button>
                        </form>
                      ) : null}
                      {review.membershipId !== membership.id ? (
                        <div className="mt-2">
                          <ReportControls
                            slug={slug}
                            kind="review"
                            subjectId={review.id}
                            authorId={review.membershipId}
                            authorName={review.name}
                          />
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : !canReview ? (
                <EmptyState
                  icon={<Star className="size-6" />}
                  title="No reviews yet"
                  description="Neighbours who have bought from this listing can rate it here."
                />
              ) : null}
            </Card>
          ) : null}

          {shopListings.length ? (
            <section aria-labelledby="shop-more" className="space-y-3">
              <h2 id="shop-more" className="text-ink font-serif text-lg font-medium">
                More from {listing.title}
              </h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {shopListings.map((other, index) => (
                  <li key={other.id} className="flex">
                    <ListingTile listing={other} href={`${board}/${other.id}`} index={index} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* Under everything else, where somebody who has read the listing
              and does not like it will be. Blocking the seller leaves nothing
              on this page, so that goes back to the board. */}
          {isMine ? null : (
            <div className="px-1">
              <ReportControls
                slug={slug}
                kind="listing"
                subjectId={listing.id}
                authorId={listing.membershipId}
                authorName={listing.sellerName}
                blockNext={board}
                allowBlock={!business}
              />
            </div>
          )}
        </div>
      </PageBody>
    </>
  );
}

function Notice({
  tone,
  children,
}: {
  tone: 'success' | 'danger' | 'neutral';
  children: ReactNode;
}) {
  return (
    <div
      role={tone === 'success' ? 'status' : undefined}
      className={
        tone === 'success'
          ? 'border-success/40 bg-success/10 text-ink flex items-start gap-3 rounded-2xl border p-4 text-sm'
          : tone === 'danger'
            ? 'border-danger/40 bg-danger/10 text-ink flex items-start gap-3 rounded-2xl border p-4 text-sm'
            : 'border-border-base bg-surface-sunken text-ink flex items-start gap-3 rounded-2xl border p-4 text-sm'
      }
    >
      {tone === 'success' ? (
        <CheckCircle2 className="text-success mt-0.5 size-4 shrink-0" aria-hidden="true" />
      ) : tone === 'danger' ? (
        <ShieldAlert className="text-danger mt-0.5 size-4 shrink-0" aria-hidden="true" />
      ) : (
        <Pause className="text-ink-subtle mt-0.5 size-4 shrink-0" aria-hidden="true" />
      )}
      <p>{children}</p>
    </div>
  );
}
