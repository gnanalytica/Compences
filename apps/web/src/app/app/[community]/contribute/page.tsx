import type { CSSProperties } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { HandCoins } from 'lucide-react';
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
import { getStatsFor, listEvents } from '@/lib/events';
import { PageBody, PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { FundBar } from '@/components/badges';
import { FestivalTile, festivalVars } from '@/components/festival';
import { getCatalogue } from '@/lib/catalogue';

export const metadata = { title: 'Contribute' };

/**
 * Where the Contribute button lands: everything collecting money right now.
 * With only one, there is nothing to ask, so it goes straight to that one.
 */
export default async function ChooseWhatToSupport(props: PageProps<'/app/[community]/contribute'>) {
  const { community: slug } = await props.params;
  const { community, role } = await requireCommunity(slug);
  const base = `/app/${slug}`;

  if (!can(role, 'contribute')) {
    return (
      <>
        <PageHeader title="Contribute" />
        <PageBody>
          <Card>
            <EmptyState
              icon={<HandCoins className="size-6" />}
              title="Staff don’t contribute"
              description="Record a flat’s payment from the event’s Receipts tab."
            />
          </Card>
        </PageBody>
      </>
    );
  }

  const open = (await listEvents(community.id))
    .filter((event) => event.status === 'published')
    .sort((a, b) => a.starts_on.localeCompare(b.starts_on));
  if (open.length === 1) redirect(`${base}/events/${open[0].slug}/contribute`);
  const stats = await getStatsFor(open.map((event) => event.id));
  const types = new Map(
    (await getCatalogue(community.id)).event_type.map((item) => [item.id, item.label]),
  );

  return (
    <>
      <PageHeader title="Contribute" description="Pick what you’re paying for." />
      <PageBody>
        {open.length ? (
          <ul className="space-y-3">
            {open.map((event, index) => {
              const s = stats.get(event.id);
              const held = inTheFund(s?.fundRaised ?? 0, s?.fundCarriedIn ?? 0);
              const target = s?.fundTarget ?? 0;
              const bar = fundBarSegments(
                s?.fundRaised ?? 0,
                s?.fundPending ?? 0,
                target,
                s?.fundCarriedIn ?? 0,
              );
              const festival = festivalFor(types.get(event.event_type_id ?? ''), event.name);
              return (
                <li key={event.id}>
                  <Link
                    href={`${base}/events/${event.slug}/contribute`}
                    style={{ ...festivalVars(festival), '--i': index } as CSSProperties}
                    className="rise-in pressable border-border-base bg-surface-raised shadow-card hover:border-border-strong block rounded-2xl border p-4 transition-colors sm:p-5"
                  >
                    <div className="flex items-center gap-3.5">
                      <FestivalTile festival={festival} className="size-12" />
                      <div className="min-w-0">
                        <p className="text-ink truncate font-serif text-lg leading-snug font-medium tracking-tight">
                          {event.name}
                        </p>
                        <p className="text-ink-muted mt-0.5 text-sm">
                          {event.kind === 'campaign' ? 'Fundraising campaign · ' : ''}
                          {formatDate(event.starts_on)}
                          {countdown(event.starts_on) ? ` · ${countdown(event.starts_on)}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="text-ink-muted mt-4 mb-1.5 flex justify-between text-xs font-medium">
                      <span>
                        {formatMoney(held, community.currency)} of{' '}
                        {formatMoney(target, community.currency)}
                      </span>
                      <span>{bar.confirmed}%</span>
                    </div>
                    <FundBar percent={bar.confirmed} pendingPercent={bar.pending} />
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <Card>
            <EmptyState
              icon={<HandCoins className="size-6" />}
              title="Nothing is collecting money right now"
              description="When the committee opens an event or a campaign, it shows up here."
              action={
                <ButtonLink href={`${base}/events`} variant="secondary" size="sm">
                  See events
                </ButtonLink>
              }
            />
          </Card>
        )}
      </PageBody>
    </>
  );
}
