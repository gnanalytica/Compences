import Link from 'next/link';
import { Building2, CalendarDays, ChevronRight, Lightbulb, Megaphone, Plus } from 'lucide-react';
import {
  EVENT_STATUS_LABEL,
  ROLE_LABEL,
  canParticipate,
  formatMoney,
  normalizeRole,
  unitLabel,
} from '@compences/core';
import { getMemberships, requireCommunity } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase/server';
import { PageBody, PageHeader } from '@/components/page-header';
import { Card, CardHeader, CardBody } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { StatTile, StatTiles } from '@/components/badges';

export const metadata = { title: 'Me' };

const SUGGESTION_STATUS = {
  new: 'With the committee',
  reviewing: 'With the committee',
  accepted: 'Open for voting',
  declined: 'Declined',
  adopted: 'Adopted',
  not_adopted: 'Not adopted',
} as const;

export default async function MyActivityPage(props: PageProps<'/app/[community]/me'>) {
  const { community: slug } = await props.params;
  const { community, role, profile, membership, unitIds, user } = await requireCommunity(slug);
  const supabase = await getSupabase();
  const base = `/app/${slug}`;

  // Started alongside the rest and cached per request, so this is the same
  // list the layout already fetched for the switcher, not a second round trip.
  const membershipsPromise = getMemberships();

  // Payments are under Money → My contributions, beside the rest of the money.
  const [registrations, suggestions, campaigns, units] = await Promise.all([
    supabase
      .from('activity_participants')
      .select('id, participant_name, joined_at, event_activities(name, emoji, events(slug, name))')
      .eq('membership_id', membership.id)
      .order('joined_at', { ascending: false }),
    supabase
      .from('activity_suggestions')
      .select('id, kind, name, status, review_note, created_at, events(slug, name)')
      .eq('suggested_by', membership.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('events')
      .select('id, slug, emoji, name, status, fund_target, created_at')
      .eq('community_id', community.id)
      .eq('kind', 'campaign')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false }),
    unitIds.length
      ? supabase.from('units').select('block, number').in('id', unitIds)
      : Promise.resolve({ data: [] as { block: string | null; number: string }[] }),
  ]);

  const otherSocieties = (await membershipsPromise).filter(
    (m) => m.communities && m.communities.slug !== community.slug,
  );

  const myUnits = (units.data ?? []).map((unit) => unitLabel(unit)).join(', ');
  const roleLabel = ROLE_LABEL[normalizeRole(role) ?? 'resident'];

  return (
    <>
      <PageHeader
        title={profile?.full_name ?? 'Me'}
        description={[community.name, roleLabel, myUnits].filter(Boolean).join(' · ')}
      />
      <PageBody>
        {!canParticipate(role) ? (
          <Card className="mb-5">
            <CardBody className="text-ink-muted text-sm">
              Contributing, voting and suggesting are for residents and the committee.
            </CardBody>
          </Card>
        ) : null}

        <StatTiles>
          <StatTile label="Registrations" value={String(registrations.data?.length ?? 0)} />
          <StatTile label="Suggestions" value={String(suggestions.data?.length ?? 0)} />
        </StatTiles>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader title="Activity registrations" />
            {registrations.data?.length ? (
              <ul className="divide-border-base divide-y">
                {registrations.data.map((row) => (
                  <li key={row.id} className="px-5 py-3">
                    <p className="text-ink text-sm font-medium">
                      {row.event_activities?.name}
                      {row.participant_name ? (
                        <span className="text-ink-muted font-normal">
                          {' '}
                          · {row.participant_name}
                        </span>
                      ) : null}
                    </p>
                    {row.event_activities?.events?.slug ? (
                      <Link
                        href={`${base}/events/${row.event_activities.events.slug}#activities`}
                        className="text-ink-subtle mt-0.5 text-xs hover:underline"
                      >
                        {row.event_activities.events.name}
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<CalendarDays className="size-6" />}
                title="No registrations yet"
                description="Register yourself or your family for an event’s activities."
              />
            )}
          </Card>

          <Card>
            <CardHeader title="Your suggestions" />
            {suggestions.data?.length ? (
              <ul className="divide-border-base divide-y">
                {suggestions.data.map((row) => (
                  <li key={row.id} className="flex items-start justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="text-ink text-sm font-medium">{row.name}</p>
                      <p className="text-ink-subtle mt-0.5 text-xs">
                        {row.kind === 'idea' ? 'Idea' : 'Activity'}
                        {row.events?.name ? ` · ${row.events.name}` : ''}
                        {row.review_note ? ` · “${row.review_note}”` : ''}
                      </p>
                    </div>
                    <Badge
                      tone={
                        row.status === 'accepted' || row.status === 'adopted'
                          ? 'success'
                          : row.status === 'declined' || row.status === 'not_adopted'
                            ? 'neutral'
                            : 'warning'
                      }
                    >
                      {SUGGESTION_STATUS[row.status]}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<Lightbulb className="size-6" />}
                title="No suggestions yet"
                description="Suggest an idea or activity from any event page."
              />
            )}
          </Card>
        </div>

        {campaigns.data?.length ? (
          <Card className="mt-5">
            <CardHeader title="Campaigns you proposed" />
            <ul className="divide-border-base divide-y">
              {campaigns.data.map((campaign) => (
                <li key={campaign.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <Link
                    href={`${base}/events/${campaign.slug}`}
                    className="min-w-0 hover:underline"
                  >
                    <p className="text-ink flex items-center gap-2 text-sm font-medium">
                      <Megaphone className="text-ink-muted size-4" aria-hidden="true" />
                      {campaign.name}
                    </p>
                    <p className="text-ink-subtle mt-0.5 text-xs">
                      Target {formatMoney(campaign.fund_target, community.currency)}
                    </p>
                  </Link>
                  <Badge
                    tone={
                      campaign.status === 'published'
                        ? 'success'
                        : campaign.status === 'proposed'
                          ? 'warning'
                          : 'neutral'
                    }
                  >
                    {campaign.status === 'cancelled'
                      ? 'Turned down'
                      : EVENT_STATUS_LABEL[campaign.status]}
                  </Badge>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        {/* Joining a second society and founding one were only ever in the
            switcher, which on a phone means inside the sheet behind the
            society name — a drawer you have to know about. They are a fact
            about you, not about this society, so Me is where they belong; the
            phone app has had them here all along. The switcher keeps them
            too: this is a second door, not a move. */}
        <Card className="mt-5">
          <CardHeader
            title="Your societies"
            description={
              otherSocieties.length
                ? 'Switch between them, or add another.'
                : 'You can belong to more than one.'
            }
          />
          <ul className="divide-border-base divide-y">
            {otherSocieties.map((membership) => (
              <li key={membership.id}>
                <Link
                  href={`/app/${membership.communities!.slug}`}
                  className="hover:bg-surface-sunken flex items-center gap-3 px-5 py-3"
                >
                  <span className="bg-accent text-accent-ink grid size-8 shrink-0 place-items-center rounded-lg text-sm font-bold">
                    {membership.communities!.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="text-ink block truncate text-sm font-medium">
                      {membership.communities!.name}
                    </span>
                    <span className="text-ink-subtle block truncate text-xs">
                      {ROLE_LABEL[normalizeRole(membership.role) ?? 'resident']}
                    </span>
                  </span>
                  <ChevronRight className="text-ink-subtle size-4 shrink-0" aria-hidden="true" />
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/onboarding?mode=join"
                className="hover:bg-surface-sunken flex items-center gap-3 px-5 py-3"
              >
                <Plus className="text-accent size-5 shrink-0" aria-hidden="true" />
                <span className="text-ink flex-1 text-sm font-medium">Join another society</span>
                <ChevronRight className="text-ink-subtle size-4 shrink-0" aria-hidden="true" />
              </Link>
            </li>
            <li>
              <Link
                href="/onboarding?mode=create"
                className="hover:bg-surface-sunken flex items-center gap-3 px-5 py-3"
              >
                <Building2 className="text-accent size-5 shrink-0" aria-hidden="true" />
                <span className="text-ink flex-1 text-sm font-medium">Start a new society</span>
                <ChevronRight className="text-ink-subtle size-4 shrink-0" aria-hidden="true" />
              </Link>
            </li>
          </ul>
        </Card>
      </PageBody>
    </>
  );
}
