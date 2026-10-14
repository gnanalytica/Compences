import { can } from '@compences/core';
import { requireCommunity } from '@/lib/auth';
import { getIdeas } from '@/lib/events';
import { PageBody, PageHeader } from '@/components/page-header';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { SuggestionBoard } from '@/components/suggestion-board';
import { SocietySuggestionForm } from './suggest-form';

export const metadata = { title: 'Ideas' };

/**
 * Everything the society has been asked for, in one place.
 *
 * Fundraising was the only thing a resident could start from Home, which left
 * everything that costs nothing — a weekly badminton hour, a rule about the
 * terrace, a thank-you for the security staff — with nowhere to go. This was
 * that page, and for a while it was only that: suggestions about an event
 * stayed on the event, so somebody wondering whether a thing had already been
 * suggested had to know which kind it was to know where to look. Both kinds
 * are here now, each saying which event it belongs to, and an event's page
 * still shows its own.
 */
export default async function SuggestPage(props: PageProps<'/app/[community]/suggest'>) {
  const { community: slug } = await props.params;
  const { community, viewRole: role, membership } = await requireCommunity(slug);
  const rows = await getIdeas(community.id, membership.id);

  const open = rows.filter((row) => row.status === 'accepted').length;
  const waiting = rows.filter((row) => row.status === 'new').length;

  return (
    <>
      <PageHeader
        title="Ideas"
        description={
          open || waiting
            ? [
                open ? `${open} open for voting` : null,
                waiting ? `${waiting} with the committee` : null,
              ]
                .filter(Boolean)
                .join(' · ')
            : 'Ideas for the society and its events.'
        }
      />
      <PageBody>
        {can(role, 'suggest') ? (
          <Card className="mb-3">
            <CardHeader
              title="Suggest an idea"
              description="For the society. To suggest one for an event, use the event’s page."
            />
            <CardBody>
              <SocietySuggestionForm slug={community.slug} />
            </CardBody>
          </Card>
        ) : null}

        <SuggestionBoard
          slug={community.slug}
          rows={rows}
          myMembershipId={membership.id}
          canVote={can(role, 'vote')}
          canApprove={can(role, 'suggestions:approve')}
          emptyDescription="Suggestions the committee approves go to a vote here."
          showEvent
        />
      </PageBody>
    </>
  );
}
