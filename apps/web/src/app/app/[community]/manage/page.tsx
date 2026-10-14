import Link from 'next/link';
import {
  ArrowRight,
  CalendarCog,
  ChevronRight,
  ClipboardCheck,
  Library,
  Scale,
  Send,
  Settings2,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { COPY, can } from '@compences/core';
import { requireCapability } from '@/lib/auth';
import { getTodoCount } from '@/lib/todo';
import { PageBody, PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';

export const metadata = { title: COPY.manage };

/**
 * The hub behind the Manage tab on a phone.
 *
 * A desktop shows this list as a sidebar section and never needs the page; a
 * phone has four tabs and a sheet, and the sheet is a drawer you have to know
 * about. So Manage is a tab, and this is where it lands: what is waiting
 * first, then the places staff and the committee actually work.
 *
 * It stays a hub. The event console, the To do queue and Reconcile are whole
 * pages of their own and this does not try to be a smaller copy of any of
 * them — a hub that re-renders its destinations is two things to keep in step.
 */
export default async function ManagePage(props: PageProps<'/app/[community]/manage'>) {
  const { community: slug } = await props.params;
  const { community, role } = await requireCapability(slug, 'events:manage');
  const base = `/app/${community.slug}`;
  const todo = await getTodoCount(community.id, role);
  const committee = can(role, 'roles:manage');

  const rows: { href: string; label: string; detail: string; icon: LucideIcon }[] = [
    {
      href: `${base}/admin`,
      label: 'Events',
      detail: 'Create and run events, and see each one’s money',
      icon: CalendarCog,
    },
    // People has no tab of its own on a phone — Money and Manage took the two
    // middle slots — so every hub that can lead back to it does. This is one
    // of them, and it is the first row of the phone app's Manage tab too.
    {
      href: `${base}/people`,
      label: 'People',
      detail: 'Everyone admitted, by flat',
      icon: Users,
    },
  ];

  // Each row carries the capability its page checks, so it is never an
  // invitation to somewhere that will turn you away.
  if (can(role, 'payments:record')) {
    rows.push({
      href: `${base}/admin/reconcile`,
      label: 'Reconcile',
      detail: 'Match the bank statement to reported payments',
      icon: Scale,
    });
  }
  if (committee) {
    rows.push({
      href: `${base}/admin/settings`,
      label: COPY.societySettings,
      detail: 'Society details, flats, catalogue, UPI ID, society code',
      icon: Settings2,
    });
  } else {
    // Staff cannot open Society settings, so the two things they do reach from
    // inside it get their own rows.
    if (can(role, 'joinrequests:review')) {
      rows.push({
        href: `${base}/admin/invite`,
        label: 'Invite residents',
        detail: 'The society code and the join link',
        icon: Send,
      });
    }
    rows.push({
      href: `${base}/admin/catalogue`,
      label: 'Catalogue',
      detail: 'Event types, venues, budget categories, vendors',
      icon: Library,
    });
  }

  return (
    <>
      <PageHeader title={COPY.manage} description={community.name} />
      <PageBody>
        {todo ? (
          <Link
            href={`${base}/todo`}
            className="border-warning/40 bg-surface-raised hover:bg-surface-sunken mb-5 flex items-center justify-between gap-3 rounded-xl border p-4"
          >
            <span className="text-ink flex items-center gap-2 text-sm font-medium">
              <ClipboardCheck className="text-warning size-5" aria-hidden="true" />
              {todo} {todo === 1 ? 'thing' : 'things'} in {COPY.todo}
            </span>
            <ArrowRight className="text-ink-subtle size-4" aria-hidden="true" />
          </Link>
        ) : (
          // Still a link when it is empty: an empty queue is worth being able
          // to check, and a row that vanishes when there is no work is a row
          // people stop trusting is there.
          <Link
            href={`${base}/todo`}
            className="border-border-base bg-surface-raised hover:bg-surface-sunken mb-5 flex items-center justify-between gap-3 rounded-xl border p-4"
          >
            <span className="text-ink-muted flex items-center gap-2 text-sm">
              <ClipboardCheck className="text-ink-subtle size-5" aria-hidden="true" />
              Nothing waiting in {COPY.todo}
            </span>
            <ArrowRight className="text-ink-subtle size-4" aria-hidden="true" />
          </Link>
        )}

        <Card>
          <ul className="divide-border-base divide-y">
            {rows.map(({ href, label, detail, icon: Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="hover:bg-surface-sunken flex items-start gap-3 px-5 py-4 first:rounded-t-xl last:rounded-b-xl"
                >
                  {/* Aligned to the label, not to the middle of the block: a
                      detail that wraps to two lines would otherwise drag the
                      icon down past the name it belongs to. */}
                  <Icon className="text-accent mt-0.5 size-5 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="text-ink block text-sm font-medium">{label}</span>
                    <span className="text-ink-subtle mt-0.5 block text-xs">{detail}</span>
                  </span>
                  <ChevronRight
                    className="text-ink-subtle mt-0.5 size-4 shrink-0"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </PageBody>
    </>
  );
}
