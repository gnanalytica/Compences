import { todayIn } from '@compences/core';
import { requireCapability } from '@/lib/auth';
import { activeItems, getCatalogue } from '@/lib/catalogue';
import { getSupabase } from '@/lib/supabase/server';
import { PageBody, PageHeader } from '@/components/page-header';
import { CreateEventForm } from './create-event-form';

export const metadata = { title: 'Create event' };

export default async function NewEventPage(props: PageProps<'/app/[community]/admin/events/new'>) {
  const { community: slug } = await props.params;
  const { community } = await requireCapability(slug, 'events:manage');
  const catalogue = await getCatalogue(community.id);
  // Only to divide the budget by, in the hint beside "Suggested per flat" —
  // which is the arithmetic a committee does on paper anyway.
  const supabase = await getSupabase();
  const { count } = await supabase
    .from('units')
    .select('id', { count: 'exact', head: true })
    .eq('community_id', community.id);
  const pick = (kind: keyof typeof catalogue) =>
    activeItems(catalogue, kind).map(({ id, label, emoji }) => ({ id, label, emoji }));

  return (
    <>
      <PageHeader
        title="Create an event"
        description="Start with a name, date and budget. Add bills and activities later."
      />
      <PageBody>
        <div className="mx-auto max-w-2xl">
          <CreateEventForm
            slug={slug}
            societyName={community.name}
            flatCount={count ?? 0}
            today={todayIn(community.timezone)}
            pickers={{
              event_type: pick('event_type'),
              venue: pick('venue'),
              budget_category: pick('budget_category'),
              activity_type: pick('activity_type'),
              vendor: pick('vendor'),
              manageHref: `/app/${community.slug}/admin/catalogue`,
            }}
          />
        </div>
      </PageBody>
    </>
  );
}
