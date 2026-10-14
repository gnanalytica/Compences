import Link from 'next/link';
import { Building2, ChevronsUpDown, Plus } from 'lucide-react';
import { ROLE_LABEL, normalizeRole, type MemberRole } from '@compences/core';
import type { MembershipWithCommunity } from '@/lib/auth';

/**
 * The current society, the others this person belongs to, and the two ways to
 * add one more.
 *
 * The menu opens even for someone with a single society: it is the only route
 * in the app to joining a second or founding one, and hiding it behind "you
 * already belong to two" meant almost nobody could find it. Each row carries
 * its own role, because a person is often committee in the society they run
 * and a plain resident in the one they moved to.
 *
 * Uses <details> so it works without client JavaScript.
 */
export function CommunitySwitcher({
  current,
  role,
  memberships,
}: {
  current: { name: string; slug: string };
  role: MemberRole;
  memberships: MembershipWithCommunity[];
}) {
  const others = memberships.filter((m) => m.communities && m.communities.slug !== current.slug);
  const item =
    'text-ink-muted hover:bg-surface-sunken hover:text-ink flex items-center gap-2 px-3 py-2 text-sm';

  return (
    <details className="group relative" data-menu>
      <summary className="hover:bg-surface-sunken flex cursor-pointer list-none items-center gap-2.5 rounded-lg px-2 py-1.5 pointer-coarse:min-h-11">
        <span className="bg-accent text-accent-ink grid size-8 shrink-0 place-items-center rounded-lg text-sm font-bold">
          {current.name.charAt(0).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1 text-left">
          <span className="text-ink block truncate text-sm font-medium">{current.name}</span>
          <span className="text-ink-subtle block truncate text-xs">
            {ROLE_LABEL[normalizeRole(role) ?? 'resident']}
          </span>
        </span>
        <ChevronsUpDown className="text-ink-subtle size-4 shrink-0" aria-hidden="true" />
      </summary>

      <div className="border-border-base bg-surface-raised absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-lg border shadow-lg">
        <ul className="py-1">
          {others.map((membership) => (
            <li key={membership.id}>
              <Link
                href={`/app/${membership.communities!.slug}`}
                className="hover:bg-surface-sunken block px-3 py-2"
              >
                <span className="text-ink block truncate text-sm">
                  {membership.communities!.name}
                </span>
                <span className="text-ink-subtle block truncate text-xs">
                  {ROLE_LABEL[normalizeRole(membership.role) ?? 'resident']}
                </span>
              </Link>
            </li>
          ))}
          <li className={others.length ? 'border-border-base border-t' : undefined}>
            <Link href="/onboarding?mode=join" className={item}>
              <Plus className="size-3.5" aria-hidden="true" />
              Join another society
            </Link>
          </li>
          <li>
            <Link href="/onboarding?mode=create" className={item}>
              <Building2 className="size-3.5" aria-hidden="true" />
              Start a new society
            </Link>
          </li>
        </ul>
      </div>
    </details>
  );
}
