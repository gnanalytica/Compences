import type { CSSProperties } from 'react';
import Link from 'next/link';
import { CalendarDays, CheckCircle2, Lightbulb, Megaphone, Plus } from 'lucide-react';
import {
  can,
  countdown,
  festivalFor,
  formatDate,
  formatMoney,
  fundBarSegments,
  inTheFund,
} from '@compences/core';
import { requireCommunity } from '@/lib/auth';
import { listEvents, getStatsFor } from '@/lib/events';
import { getCatalogue } from '@/lib/catalogue';
import { FestivalTile, festivalVars } from '@/components/festival';
import { SectionLabel } from '@/components/section-label';
import { PageBody, PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { ButtonLink } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { EventStatusBadge, FundBar, FundKey } from '@/components/badges';

export const metadata = { title: 'Events' };

export default async function EventsPage(props: PageProps<'/app/[community]/events'>) {
  const { community: slug } = await props.params;
  const { proposed: justProposed } = await props.searchParams;
  // Committee in resident view sees exactly what residents see.
  const { community, viewRole: role, user } = await requireCommunity(slug);

  const events = await listEvents(community.id);
  const stats = await getStatsFor(events.map((event) => event.id));
  const staff = can(role, 'events:manage');
  const catalogue = await getCatalogue(community.id);
  const typeLabel = new Map(catalogue.event_type.map((item) => [item.id, item.label]));

  // RLS already hides drafts and other people's proposals from residents.
  const mine = events.filter(
    (event) => event.status === 'proposed' && event.created_by === user.id,
  );
  const live = events.filter(
    (event) => event.status === 'published' || (staff && event.status === 'draft'),
  );
  const past = events
    .filter((event) => event.status === 'completed' || event.status === 'cancelled')
    .filter((event) => event.kind === 'event' || event.status === 'completed');

  const card = (event: (typeof events)[number], index: number) => {
    const s = stats.get(event.id);
    const bar = fundBarSegments(
      s?.fundRaised ?? 0,
      s?.fundPending ?? 0,
      s?.fundTarget ?? 0,
      s?.fundCarriedIn ?? 0,
    );
    const funded = bar.confirmed;
    const held = inTheFund(s?.fundRaised ?? 0, s?.fundCarriedIn ?? 0);
    // A list of events should look like a year, not like a spreadsheet: each
    // card leads with its own festival — its colour and what it is decorated
    // with — the way a calendar marks its days.
    const festival = festivalFor(typeLabel.get(event.event_type_id ?? ''), event.name);
    return (
      <Link
        key={event.id}
        href={`/app/${slug}/events/${event.slug}`}
        style={{ ...festivalVars(festival), '--i': index } as CSSProperties}
        className="rise-in pressable border-border-base bg-surface-raised shadow-card hover:border-border-strong block rounded-2xl border p-4 transition-colors sm:p-5"
      >
        <div className="flex items-start gap-3.5">
          <FestivalTile festival={festival} className="size-12" />
          <div className="min-w-0 flex-1">
            <p className="text-ink truncate font-serif text-lg leading-snug font-medium tracking-tight">
              {event.name}
            </p>
            <p className="text-ink-muted mt-0.5 text-sm">
              {event.kind === 'campaign' ? 'Fundraising campaign · ' : ''}
              {formatDate(event.starts_on)}
              {event.venue ? ` · ${event.venue}` : ''}
              {countdown(event.starts_on) ? ` · ${countdown(event.starts_on)}` : ''}
            </p>
          </div>
          <EventStatusBadge status={event.status} />
        </div>

        {event.status !== 'cancelled' && event.status !== 'proposed' ? (
          <div className="mt-4">
            <div className="text-ink-muted mb-1.5 flex justify-between text-xs font-medium">
              <span>
                {formatMoney(held, community.currency)} of{' '}
                {formatMoney(s?.fundTarget ?? 0, community.currency)} ·{' '}
                {formatMoney(s?.spent ?? 0, community.currency)} spent
              </span>
              <span>{funded}%</span>
            </div>
            <FundBar percent={funded} pendingPercent={bar.pending} />
            <FundKey
              confirmed={held}
              pending={s?.fundPending ?? 0}
              currency={community.currency}
              className="mt-2"
            />
            <p className="text-ink-subtle mt-2 text-xs">
              {s?.contributors ?? 0} households contributed · {s?.participants ?? 0} registered for
              activities
            </p>
          </div>
        ) : null}
      </Link>
    );
  };

  return (
    <>
      <PageHeader
        title="Events"
        action={
          <div className="flex flex-wrap gap-2">
            {/* Ideas live here as well as on their own page: this is where
                people are already thinking about what the society does. */}
            {can(role, 'suggest') ? (
              <ButtonLink href={`/app/${slug}/suggest`} size="sm" variant="secondary">
                <Lightbulb className="size-4" aria-hidden="true" />
                Suggest an idea
              </ButtonLink>
            ) : null}
            {can(role, 'campaigns:propose') ? (
              <ButtonLink href={`/app/${slug}/events/propose`} size="sm" variant="secondary">
                <Megaphone className="size-4" aria-hidden="true" />
                Start a campaign
              </ButtonLink>
            ) : null}
            {staff ? (
              <ButtonLink href={`/app/${slug}/admin/events/new`} size="sm">
                <Plus className="size-4" aria-hidden="true" />
                Create event
              </ButtonLink>
            ) : null}
          </div>
        }
      />
      <PageBody>
        {justProposed ? (
          <div className="border-success/30 bg-success/10 mb-5 flex items-start gap-3 rounded-2xl border p-4 text-sm">
            <CheckCircle2 className="text-success mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <p className="text-ink">
              Campaign sent to the committee. Once approved, every resident can see it and
              contribute.
            </p>
          </div>
        ) : null}

        {mine.length ? (
          <>
            <SectionLabel className="mb-3">
              Proposed by you <Badge tone="warning">Awaiting committee</Badge>
            </SectionLabel>
            <div className="mb-8 space-y-3">{mine.map(card)}</div>
          </>
        ) : null}

        {live.length === 0 && past.length === 0 ? (
          <Card>
            <EmptyState
              icon={<CalendarDays className="size-6" />}
              title="No events yet"
              description={
                staff
                  ? 'Create the first one with its budget, then publish it.'
                  : 'Events the society plans show up here.'
              }
            />
          </Card>
        ) : null}

        {live.length ? (
          <>
            <SectionLabel className="mb-3">Upcoming and open</SectionLabel>
            <div className="space-y-3">
              {live.sort((a, b) => a.starts_on.localeCompare(b.starts_on)).map(card)}
            </div>
          </>
        ) : null}
        {past.length ? (
          <>
            <SectionLabel className="mt-8 mb-3">Past</SectionLabel>
            <div className="space-y-3">{past.map(card)}</div>
          </>
        ) : null}
      </PageBody>
    </>
  );
}
