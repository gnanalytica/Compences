import Link from 'next/link';
import { Bell, ChevronDown, Eye, LogOut, Settings } from 'lucide-react';
import type { ViewMode } from '@compences/core';
import { switchView } from '@/app/app/[community]/view-actions';
import { AppearanceSwitch } from '@/components/appearance-switch';
import { cn } from '@/lib/utils';

/**
 * The signed-in person's menu: notifications, their settings, appearance and
 * sign out. A native <details> keeps it working without client JavaScript.
 */
export function ProfileMenu({
  slug,
  name,
  email,
  unread,
  viewMode = null,
  compact = false,
}: {
  slug: string;
  name: string;
  email?: string | null;
  unread: number;
  /** Set for the committee, who can switch to the resident view and back. */
  viewMode?: ViewMode | null;
  /** The phone header shows an initial instead of the name. */
  compact?: boolean;
}) {
  const item =
    'text-ink-muted hover:bg-surface-sunken hover:text-ink flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm';
  return (
    <details className="group relative" data-menu>
      <summary
        className={cn(
          'hover:bg-surface-sunken flex cursor-pointer list-none items-center gap-2 rounded-lg [&::-webkit-details-marker]:hidden',
          // Compact is a 28px avatar in the phone header; a finger gets 44.
          'pointer-coarse:min-h-11',
          compact ? 'p-1 pointer-coarse:min-w-11 pointer-coarse:justify-center' : 'px-3 py-2',
        )}
        aria-label={compact ? `Account menu for ${name}` : undefined}
      >
        <span className="bg-surface-sunken text-ink relative grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold">
          {name.charAt(0).toUpperCase() || '?'}
          {unread ? (
            <span className="bg-danger absolute -top-0.5 -right-0.5 size-2.5 rounded-full">
              <span className="sr-only">{unread} unread notifications</span>
            </span>
          ) : null}
        </span>
        {compact ? null : (
          <>
            <span className="min-w-0 flex-1">
              <span className="text-ink block truncate text-sm font-medium">{name}</span>
              {email ? (
                <span className="text-ink-subtle block truncate text-xs">{email}</span>
              ) : null}
            </span>
            <ChevronDown
              className="text-ink-subtle size-4 transition-transform group-open:rotate-180"
              aria-hidden="true"
            />
          </>
        )}
      </summary>
      <div
        className={cn(
          'border-border-base bg-surface-raised absolute z-50 w-56 rounded-xl border p-1 shadow-lg',
          compact ? 'top-full right-0 mt-2' : 'bottom-full left-0 mb-2',
        )}
      >
        <Link href={`/app/${slug}/notifications`} className={item}>
          <Bell className="size-4" aria-hidden="true" />
          Notifications
          {unread ? (
            <span className="bg-danger ml-auto rounded-full px-1.5 text-xs font-semibold text-white">
              {unread > 99 ? '99+' : unread}
            </span>
          ) : null}
        </Link>
        {viewMode ? (
          <form action={switchView}>
            <input type="hidden" name="slug" value={slug} />
            <input
              type="hidden"
              name="mode"
              value={viewMode === 'resident' ? 'committee' : 'resident'}
            />
            <button type="submit" className={item}>
              <Eye className="size-4" aria-hidden="true" />
              {viewMode === 'resident' ? 'Switch to committee view' : 'Switch to resident view'}
            </button>
          </form>
        ) : null}
        <Link href={`/app/${slug}/settings`} className={item}>
          <Settings className="size-4" aria-hidden="true" />
          Settings
        </Link>
        <AppearanceSwitch />
        <form action="/auth/signout" method="post">
          <button type="submit" className={item}>
            <LogOut className="size-4" aria-hidden="true" />
            Sign out
          </button>
        </form>
      </div>
    </details>
  );
}
