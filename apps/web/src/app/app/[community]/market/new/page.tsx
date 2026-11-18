import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import {
  LISTING_KIND_ACTION,
  LISTING_KIND_HINT,
  LISTING_KINDS,
  isListingKind,
  type ListingKind,
} from '@compences/core';
import { requireCommunity } from '@/lib/auth';
import { getListings, getUnitOptions } from '@/lib/market';
import { PageBody, PageHeader } from '@/components/page-header';
import { Card, CardBody } from '@/components/ui/card';
import { KindIcon, postableKinds } from '../post-menu';
import { ListingForm } from '../listing-form';

export const metadata = { title: 'Post on the marketplace' };

const HEADER: Record<ListingKind, { title: string; description: string }> = {
  offer: {
    title: 'Offer what you make or teach',
    description:
      'It goes on the society’s marketplace straight away. Neighbours call or message you directly.',
  },
  sale: {
    title: 'Sell something',
    description: 'One thing, once. Mark it sold when it goes, and it leaves the board.',
  },
  wanted: {
    title: 'Ask for something',
    description: 'Neighbours who have one, or know who does, call or message you.',
  },
  shop: {
    title: 'Open your shop',
    description:
      'A name, a cover photo and a number. Everything else you post gathers under it, with its reviews.',
  },
  business: {
    title: 'Add a local business',
    description:
      'Somebody from outside the society that the committee recommends. Residents see it as the committee’s word, not yours.',
  },
};

/**
 * Posting starts with what it is, because the form asks different questions
 * of a cycle for sale than of a tiffin service. Without a kind in the address
 * this page is the choice; with one, it is the form for it.
 *
 * Residents and the committee may post the first four; staff and the
 * committee add outside businesses. A shop is one each, so somebody who
 * already has one is taken to change it instead.
 */
export default async function NewListingPage(props: PageProps<'/app/[community]/market/new'>) {
  const { community: slug } = await props.params;
  const search = await props.searchParams;
  const context = await requireCommunity(slug);
  const { community, membership, profile, unitIds, role } = context;
  const board = `/app/${slug}/market`;

  const listings = await getListings(community.id);
  const myShop = listings.find(
    (listing) => listing.kind === 'shop' && listing.membershipId === membership.id,
  );
  const kinds = postableKinds(role, Boolean(myShop));
  if (!kinds.length && !myShop) redirect(board);

  const asked = Array.isArray(search.kind) ? search.kind[0] : search.kind;
  const kind = isListingKind(asked) ? asked : null;

  if (kind === 'shop' && myShop) redirect(`${board}/${myShop.id}/edit`);

  if (!kind || !kinds.includes(kind)) {
    return (
      <>
        <PageHeader
          title="Post on the marketplace"
          description="What would you like to put up? Each goes on the board straight away."
        />
        <PageBody>
          <BackLink href={board} label="Marketplace" />
          <div className="mx-auto max-w-xl">
            <ul className="space-y-2.5">
              {LISTING_KINDS.filter((k) => kinds.includes(k)).map((k) => (
                <li key={k}>
                  <Link
                    href={`${board}/new?kind=${k}`}
                    className="pressable border-border-base bg-surface-raised shadow-card hover:border-border-strong flex items-center gap-3 rounded-2xl border p-4 transition-colors"
                  >
                    <span className="text-accent grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--festival-wash)]">
                      <KindIcon kind={k} className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="text-ink block text-sm font-semibold">
                        {LISTING_KIND_ACTION[k]}
                      </span>
                      <span className="text-ink-muted mt-0.5 block text-xs">
                        {LISTING_KIND_HINT[k]}
                      </span>
                    </span>
                    <ArrowRight className="text-ink-subtle size-4 shrink-0" aria-hidden="true" />
                  </Link>
                </li>
              ))}
              {myShop ? (
                <li>
                  <Link
                    href={`${board}/${myShop.id}`}
                    className="text-ink-muted hover:text-ink block px-1 py-2 text-sm underline underline-offset-4"
                  >
                    Your shop, {myShop.title}, is already open. See it.
                  </Link>
                </li>
              ) : null}
            </ul>
          </div>
        </PageBody>
      </>
    );
  }

  const units = kind === 'business' ? [] : await getUnitOptions(unitIds);

  return (
    <>
      <PageHeader title={HEADER[kind].title} description={HEADER[kind].description} />
      <PageBody>
        <BackLink href={`${board}/new`} label="Something else" />
        <div className="mx-auto max-w-xl">
          <Card>
            <CardBody>
              <ListingForm
                slug={slug}
                kind={kind}
                photoFolder={`${community.id}/${membership.id}`}
                // Your own number, from my_contact() by way of getProfile:
                // a starting point you can see and change, not a default
                // that publishes itself.
                defaultPhone={profile?.phone ?? null}
                units={units}
                cancelHref={board}
              />
            </CardBody>
          </Card>
        </div>
      </PageBody>
    </>
  );
}

function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="text-ink-muted hover:text-ink mb-4 inline-flex items-center gap-1.5 text-sm"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      {label}
    </Link>
  );
}
