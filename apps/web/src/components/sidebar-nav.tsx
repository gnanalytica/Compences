'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Plus } from 'lucide-react';
import { can, type MemberRole } from '@compences/core';
import { cn } from '@/lib/utils';
import { bottomNavItems, contributeButton, visibleNav, type NavItem } from './nav-items';

export type NavCounts = { todo?: number };

/** A nav link is active on its exact route, or on any child of a section root. */
function useIsActive(slug: string) {
  const pathname = usePathname();
  const roots = new Set([`/app/${slug}`, `/app/${slug}/admin`]);
  const under = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  return ({ href, covers }: NavItem) => {
    // The Manage tab stands in for a whole group of routes, so it lights up
    // across all of them — plainly, without the root rule below, which exists
    // to stop a link lighting for pages it does not own.
    if (covers?.some(under)) return true;
    if (pathname === href) return true;
    if (!pathname.startsWith(`${href}/`)) return false;
    // Home and the events console own their exact page, not everything below
    // them, so /admin/units does not light up "Events" as well. People is not a
    // root, so its Requests tab keeps the People item lit.
    if (!roots.has(href)) return true;
    return href === `/app/${slug}/admin` && pathname.startsWith(`${href}/events`);
  };
}

function Count({ item, counts }: { item: NavItem; counts: NavCounts }) {
  const value = item.badge ? (counts[item.badge] ?? 0) : 0;
  if (!value) return null;
  return (
    <span className="bg-warning/20 text-warning ml-auto rounded-full px-1.5 text-xs font-semibold">
      {value > 99 ? '99+' : value}
      <span className="sr-only"> waiting</span>
    </span>
  );
}

export function SidebarNav({
  slug,
  role,
  counts = {},
}: {
  slug: string;
  role: MemberRole;
  counts?: NavCounts;
}) {
  const isActive = useIsActive(slug);
  const groups = visibleNav(slug, role);

  return (
    <nav aria-label="Main" className="space-y-6">
      {/* The bottom bar's raised button, as the sidebar draws it. */}
      {can(role, 'contribute') ? (
        <Link
          href={contributeButton(slug).href}
          className="bg-accent text-accent-ink shadow-card flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-[opacity,transform] hover:opacity-90 active:scale-[0.98] pointer-coarse:min-h-11"
        >
          <Plus className="size-4" aria-hidden="true" />
          Contribute
        </Link>
      ) : null}
      {groups.map((group, index) => (
        <div key={group.section || `group-${index}`}>
          {group.section ? (
            <p className="text-gold mb-1.5 px-3 text-[10.5px] font-semibold tracking-[0.14em] uppercase">
              {group.section}
            </p>
          ) : null}
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const { href, label, icon: Icon } = item;
              const active = isActive(item);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors',
                      // The sidebar is desktop-only by width, which is not the
                      // same as mouse-only: a tablet in landscape is both.
                      'pointer-coarse:min-h-11',
                      active
                        ? 'bg-surface-raised text-ink shadow-card ring-border-base font-medium ring-1'
                        : 'text-ink-muted hover:bg-surface-raised/70 hover:text-ink',
                    )}
                  >
                    <Icon className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                    {label}
                    <Count item={item} counts={counts} />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/**
 * Compact bar for phones — the handful of things a member opens daily, which
 * for staff and the committee means Manage rather than People.
 */
export function BottomNav({
  slug,
  role,
  counts = {},
}: {
  slug: string;
  role: MemberRole;
  counts?: NavCounts;
}) {
  const isActive = useIsActive(slug);
  const items = bottomNavItems(slug, role);

  return (
    <nav
      aria-label="Main"
      className="border-border-base/70 bg-surface-raised/80 fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur-xl md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="grid auto-cols-fr grid-flow-col">
        {items.map((item) => {
          const { href, label, icon: Icon } = item;
          const active = isActive(item);
          const count = item.badge ? (counts[item.badge] ?? 0) : 0;
          if (item.action) {
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className="text-ink-subtle flex flex-col items-center gap-0.5 pb-2.5 text-[11px] font-medium"
                >
                  {/* Raised out of the bar in the season's colour, ringed in
                      the page's ivory and a hairline of gold. */}
                  <span className="bg-accent text-accent-ink -mt-6 grid size-[52px] place-items-center rounded-full shadow-[0_0_0_4px_var(--surface-raised),0_0_0_5px_color-mix(in_oklch,var(--gold)_55%,transparent),0_12px_24px_-8px_color-mix(in_oklch,var(--accent)_65%,transparent)] transition-transform active:scale-95">
                    <Icon className="size-6" strokeWidth={2.2} aria-hidden="true" />
                  </span>
                  {label}
                </Link>
              </li>
            );
          }
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors',
                  active ? 'text-ink' : 'text-ink-subtle',
                )}
              >
                <span className="relative">
                  <Icon className="size-[22px]" strokeWidth={active ? 2 : 1.6} aria-hidden="true" />
                  {count ? (
                    <span className="bg-warning absolute -top-1.5 -right-2.5 min-w-4 rounded-full px-1 text-center text-[10px] leading-4 font-semibold text-white">
                      {count > 99 ? '99+' : count}
                      <span className="sr-only"> waiting</span>
                    </span>
                  ) : null}
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
