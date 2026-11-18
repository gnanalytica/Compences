import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { LISTING_KIND_LABEL, can, uuid } from '@compences/core';
import { requireCommunity } from '@/lib/auth';
import { getListing, getUnitOptions } from '@/lib/market';
import { PageBody, PageHeader } from '@/components/page-header';
import { Card, CardBody } from '@/components/ui/card';
import { ListingForm } from '../../listing-form';

export const metadata = { title: 'Edit listing' };

/**
 * A listing, to change. A resident's is theirs alone: anybody else — the
 * committee included, who may take a listing down but not rewrite it — goes
 * to its page instead. An outside business is the committee's entry, so
 * anyone on staff or the committee may keep it up to date (1118.0100).
 */
export default async function EditListingPage(
  props: PageProps<'/app/[community]/market/[listing]/edit'>,
) {
  const { community: slug, listing: listingId } = await props.params;
  const { community, membership, profile, unitIds, role } = await requireCommunity(slug);
  if (!uuid.safeParse(listingId).success) notFound();
  const listing = await getListing(community.id, listingId);
  if (!listing) notFound();

  const back = `/app/${slug}/market/${listing.id}`;
  const business = listing.kind === 'business';
  const mayEdit = business
    ? can(role, 'marketplace:business')
    : listing.membershipId === membership.id && can(role, 'marketplace:post');
  // A listing taken down stays down until staff restore it; editing it would
  // only end in the trigger's refusal, so do not offer the form.
  if (!mayEdit || listing.status === 'removed') redirect(back);

  const units = business ? [] : await getUnitOptions(unitIds);

  return (
    <>
      <PageHeader
        title={
          listing.kind === 'shop' ? 'Edit your shop' : `Edit ${business ? 'business' : 'listing'}`
        }
        description={
          listing.kind === 'offer'
            ? listing.title
            : `${LISTING_KIND_LABEL[listing.kind]} · ${listing.title}`
        }
      />
      <PageBody>
        <Link
          href={back}
          className="text-ink-muted hover:text-ink mb-4 inline-flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to the listing
        </Link>
        <div className="mx-auto max-w-xl">
          <Card>
            <CardBody>
              <ListingForm
                slug={slug}
                kind={listing.kind}
                photoFolder={`${community.id}/${membership.id}`}
                defaultPhone={profile?.phone ?? null}
                units={units}
                cancelHref={back}
                listing={{
                  id: listing.id,
                  category: listing.category,
                  title: listing.title,
                  description: listing.description,
                  priceNote: listing.priceNote,
                  contactPhone: listing.contactPhone,
                  onWhatsapp: listing.onWhatsapp,
                  // A photo the viewer could not get a link for still keeps
                  // its place, shown as a numbered square rather than lost.
                  photos: listing.photos,
                  availableUntil: listing.availableUntil,
                  unitId: listing.unitId,
                }}
              />
            </CardBody>
          </Card>
        </div>
      </PageBody>
    </>
  );
}
