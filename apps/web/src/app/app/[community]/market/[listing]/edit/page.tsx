import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { uuid } from '@compences/core';
import { requireCapability } from '@/lib/auth';
import { getListing, getUnitOptions } from '@/lib/market';
import { PageBody, PageHeader } from '@/components/page-header';
import { Card, CardBody } from '@/components/ui/card';
import { ListingForm } from '../../listing-form';

export const metadata = { title: 'Edit listing' };

/**
 * The seller's own listing, to change. Anybody else — the committee included,
 * who may take a listing down but not rewrite it — goes to its page instead.
 */
export default async function EditListingPage(
  props: PageProps<'/app/[community]/market/[listing]/edit'>,
) {
  const { community: slug, listing: listingId } = await props.params;
  const { community, membership, profile, unitIds } = await requireCapability(
    slug,
    'marketplace:post',
  );
  if (!uuid.safeParse(listingId).success) notFound();
  const [listing, units] = await Promise.all([
    getListing(community.id, listingId),
    getUnitOptions(unitIds),
  ]);
  if (!listing) notFound();

  const back = `/app/${slug}/market/${listing.id}`;
  // A listing taken down stays down until staff restore it; editing it would
  // only end in the trigger's refusal, so do not offer the form.
  if (listing.membershipId !== membership.id || listing.status === 'removed') redirect(back);

  return (
    <>
      <PageHeader title="Edit listing" description={listing.title} />
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
                  photoPath: listing.photoPath,
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
