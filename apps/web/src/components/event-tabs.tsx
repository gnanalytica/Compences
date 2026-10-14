import Link from 'next/link';
import { can, type MemberRole } from '@compences/core';
import { cn } from '@/lib/utils';
import { ScrollActiveIntoView } from './scroll-active-into-view';

/**
 * One tab strip across both event routes.
 *
 * An event lives on two pages — what a resident reads, and the console whoever
 * runs it works from — and each used to carry its own tab bar. A committee
 * member who opened Vote, then tapped Manage to file a bill, landed somewhere
 * with a different set of tabs and had to go back the way they came.
 *
 * Merging the pages would have meant ten tabs on one screen, which is worse.
 * So the bar is continuous instead: every tab an event has, in one strip, with
 * the ones you may not use simply absent. Crossing between the two routes stops
 * feeling like leaving.
 */
export type EventTabId =
  | 'about'
  | 'money'
  | 'activities'
  | 'vote'
  | 'overview'
  | 'budget'
  | 'bills'
  | 'payments'
  | 'close';

type Tab = {
  id: EventTabId;
  label: string;
  admin: boolean;
  capability?: Parameters<typeof can>[1];
};

const TABS: Tab[] = [
  { id: 'about', label: 'About', admin: false },
  { id: 'money', label: 'Money', admin: false },
  { id: 'activities', label: 'Activities', admin: false },
  { id: 'vote', label: 'Ideas', admin: false },
  { id: 'overview', label: 'Overview', admin: true, capability: 'events:manage' },
  { id: 'budget', label: 'Budget', admin: true, capability: 'events:manage' },
  { id: 'bills', label: 'Bills', admin: true, capability: 'events:manage' },
  { id: 'payments', label: 'Payments', admin: true, capability: 'events:manage' },
  { id: 'close', label: 'Close', admin: true, capability: 'events:close' },
];

export function eventTabsFor({
  role,
  kind,
  status,
}: {
  role: MemberRole;
  kind: string;
  status: string;
}) {
  const isCampaign = kind === 'campaign';
  return (
    TABS.filter((tab) => !tab.capability || can(role, tab.capability))
      // A campaign has no activities to run, and a proposed one nothing to vote on.
      .filter((tab) => !(isCampaign && (tab.id === 'activities' || tab.id === 'budget')))
      .filter((tab) => !(tab.id === 'vote' && status === 'proposed'))
  );
}

export function EventTabs({
  base,
  eventSlug,
  active,
  role,
  kind,
  status,
  /** Small counts next to a tab: votes waiting on you, bills waiting on the committee. */
  counts,
}: {
  base: string;
  eventSlug: string;
  active: EventTabId;
  role: MemberRole;
  kind: string;
  status: string;
  counts?: Partial<Record<EventTabId, number>>;
}) {
  const tabs = eventTabsFor({ role, kind, status });

  const href = (tab: Tab) =>
    tab.admin
      ? `${base}/admin/events/${eventSlug}${tab.id === 'overview' ? '' : `?tab=${tab.id}`}`
      : `${base}/events/${eventSlug}${tab.id === 'about' ? '' : `#${tab.id}`}`;

  return (
    <nav
      aria-label="Event sections"
      className="border-border-base bg-surface-raised mb-5 flex gap-1 overflow-x-auto rounded-lg border p-1 text-sm"
    >
      {tabs.map((tab, index) => {
        const count = counts?.[tab.id];
        const firstAdmin = tab.admin && !tabs[index - 1]?.admin;
        return (
          <span key={tab.id} className="flex items-center">
            {/* A hairline where the reader's tabs end and the organiser's begin. */}
            {firstAdmin && index > 0 ? (
              <span className="bg-border-base mr-1 h-5 w-px shrink-0" aria-hidden="true" />
            ) : null}
            <Link
              href={href(tab)}
              aria-current={active === tab.id ? 'page' : undefined}
              className={cn(
                'rounded-md px-3 py-1.5 whitespace-nowrap',
                active === tab.id
                  ? 'bg-surface-sunken text-ink font-medium'
                  : 'text-ink-muted hover:text-ink',
              )}
            >
              {tab.label}
              {count ? (
                <span
                  className={cn(
                    'ml-1.5 rounded-full px-1.5 text-xs',
                    tab.admin ? 'bg-warning/20 text-warning' : 'bg-accent/15 text-accent',
                  )}
                >
                  {count}
                </span>
              ) : null}
            </Link>
          </span>
        );
      })}
      <ScrollActiveIntoView />
    </nav>
  );
}
