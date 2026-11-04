import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireCapability } from '@/lib/auth';
import { getUnitOptions } from '@/lib/market';
import { PageBody, PageHeader } from '@/components/page-header';
import { Card, CardBody } from '@/components/ui/card';
import { ListingForm } from '../listing-form';

export const metadata = { title: 'Post a listing' };

export default async function NewListingPage(props: PageProps<'/app/[community]/market/new'>) {
  const { community: slug } = await props.params;
  const { community, membership, profile, unitIds } = await requireCapability(
    slug,
    'marketplace:post',
  );
  const units = await getUnitOptions(unitIds);

  return (
    <>
      <PageHeader
        title="Post a listing"
        description="It goes on the society’s marketplace straight away. Neighbours call or message you directly."
      />
      <PageBody>
        <Link
          href={`/app/${slug}/market`}
          className="text-ink-muted hover:text-ink mb-4 inline-flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Marketplace
        </Link>
        <div className="mx-auto max-w-xl">
          <Card>
            <CardBody>
              <ListingForm
                slug={slug}
                photoFolder={`${community.id}/${membership.id}`}
                // Your own number, from my_contact() by way of getProfile:
                // a starting point you can see and change, not a default
                // that publishes itself.
                defaultPhone={profile?.phone ?? null}
                units={units}
                cancelHref={`/app/${slug}/market`}
              />
            </CardBody>
          </Card>
        </div>
      </PageBody>
    </>
  );
}
