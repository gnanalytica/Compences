import Link from 'next/link';
import {
  ArrowRight,
  CalendarDays,
  ClipboardCheck,
  Library,
  Plus,
  Send,
  Settings2,
  Users,
} from 'lucide-react';
import {
  COPY,
  can,
  festivalFor,
  formatDate,
  formatMoney,
  fundBarSegments,
  inTheFund,
} from '@compences/core';
import { requireCapability } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase/server';
import { listEvents, getStatsFor } from '@/lib/events';
import { getCatalogue } from '@/lib/catalogue';
import { FestivalTile } from '@/components/festival';
import { getTodoItems } from '@/lib/todo';
import { PageBody, PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { ButtonLink } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { EventStatusBadge, FundBar, FundKey, StatTile, StatTiles } from '@/components/badges';
import { SetupChecklist } from './setup-checklist';

export const metadata = { title: 'Manage events' };

export default async function ConsolePage(props: PageProps<'/app/[community]/admin'>) {
  const { community: slug } = await props.params;
  const { community, role } = await requireCapability(slug, 'events:manage');
  const supabase = await getSupabase();
  const committee = can(role, 'roles:manage');

  const events = (await listEvents(community.id)).filter((event) => event.status !== 'proposed');
  const base = `/app/${community.slug}`;

  const [stats, todo, catalogue, members] = await Promise.all([
    getStatsFor(events.map((event) => event.id)),
    getTodoItems(community.id, role),
    getCatalogue(community.id),
    supabase
      .from('memberships')
      .select('id', { count: 'exact', head: true })
      .eq('community_id', community.id)
      .eq('status', 'active'),
  ]);

  const typeLabel = new Map(catalogue.event_type.map((item) => [item.id, item.label]));

  const links = [
    { href: `${base}/people`, label: 'People', icon: Users, show: true },
    { href: `${base}/admin/invite`, label: 'Invite residents', icon: Send, show: !committee },
    { href: `${base}/admin/catalogue`, label: 'Catalogue', icon: Library, show: !committee },
    {
      href: `${base}/admin/settings`,
      label: COPY.societySettings,
      icon: Settings2,
      show: committee,
    },
  ].filter((item) => item.show);

  return (
    <>
      <PageHeader
        title="Manage events"
        description={community.name}
        action={
          <ButtonLink href={`${base}/admin/events/new`} size="sm">
            <Plus className="size-4" aria-hidden="true" />
            Create event
          </ButtonLink>
        }
      />
      <PageBody>
        {committee && !community.setup_completed_at ? (
          <SetupChecklist community={community} />
        ) : null}

        {todo.length ? (
          <Link
            href={`${base}/todo`}
            className="border-warning/40 bg-surface-raised hover:bg-surface-sunken mb-5 flex items-center justify-between gap-3 rounded-xl border p-4"
          >
            <span className="text-ink flex items-center gap-2 text-sm font-medium">
              <ClipboardCheck className="text-warning size-5" aria-hidden="true" />
              {todo.length} {todo.length === 1 ? 'thing' : 'things'} in {COPY.todo}
            </span>
            <ArrowRight className="text-ink-subtle size-4" aria-hidden="true" />
          </Link>
        ) : null}

        <StatTiles>
          <StatTile
            label="Live"
            value={String(events.filter((event) => event.status === 'published').length)}
          />
          <StatTile
            label="Saved for later"
            value={String(events.filter((event) => event.status === 'draft').length)}
          />
          <StatTile label="Members" value={String(members.count ?? 0)} />
        </StatTiles>

        <h2 className="text-ink-soft mt-8 mb-3 text-sm font-semibold">Events and campaigns</h2>
        {events.length ? (
          <div className="space-y-3">
            {events.map((event) => {
              const s = stats.get(event.id);
              const bar = fundBarSegments(
                s?.fundRaised ?? 0,
                s?.fundPending ?? 0,
                s?.fundTarget ?? 0,
                s?.fundCarriedIn ?? 0,
              );
              const funded = bar.confirmed;
              return (
                <Link
                  key={event.id}
                  href={`${base}/admin/events/${event.slug}`}
                  className="border-border-base bg-surface-raised hover:bg-surface-sunken block rounded-xl border p-5 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <FestivalTile
                      festival={festivalFor(typeLabel.get(event.event_type_id ?? ''), event.name)}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-ink truncate font-serif text-[17px] font-medium tracking-tight">
                        {event.name}
                      </p>
                      <p className="text-ink-muted mt-0.5 text-sm">
                        {event.kind === 'campaign' ? 'Campaign · ' : ''}
                        {formatDate(event.starts_on)}
                        {event.venue ? ` · ${event.venue}` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {(s?.pendingExpenses ?? 0) > 0 ? (
                        <Badge tone="warning">
                          {s?.pendingExpenses} {s?.pendingExpenses === 1 ? 'bill' : 'bills'} pending
                        </Badge>
                      ) : null}
                      <EventStatusBadge status={event.status} />
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="text-ink-muted mb-1.5 flex justify-between text-xs font-medium">
                      <span>
                        {formatMoney(
                          inTheFund(s?.fundRaised ?? 0, s?.fundCarriedIn ?? 0),
                          community.currency,
                        )}{' '}
                        of {formatMoney(s?.fundTarget ?? 0, community.currency)} ·{' '}
                        {formatMoney(s?.spent ?? 0, community.currency)} spent
                      </span>
                      <span>{funded}%</span>
                    </div>
                    <FundBar percent={funded} pendingPercent={bar.pending} />
                    <FundKey
                      confirmed={inTheFund(s?.fundRaised ?? 0, s?.fundCarriedIn ?? 0)}
                      pending={s?.fundPending ?? 0}
                      currency={community.currency}
                      className="mt-2"
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <Card>
            <EmptyState
              icon={<CalendarDays className="size-6" />}
              title="No events yet"
              description="Give it a name, a date and a budget, then publish it."
              action={
                <ButtonLink href={`${base}/admin/events/new`} size="sm">
                  Create your first event
                </ButtonLink>
              }
            />
          </Card>
        )}

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="border-border-base bg-surface-raised hover:bg-surface-sunken rounded-xl border p-4 transition-colors"
            >
              <Icon className="text-accent size-5" aria-hidden="true" />
              <p className="text-ink mt-2 text-sm font-medium">{label}</p>
            </Link>
          ))}
        </div>
      </PageBody>
    </>
  );
}
