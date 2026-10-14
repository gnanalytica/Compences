import {
  CalendarCog,
  CalendarDays,
  ClipboardCheck,
  LayoutDashboard,
  Lightbulb,
  Plus,
  Scale,
  Settings2,
  SquareMenu,
  UserRound,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { COPY, can, type Capability, type MemberRole } from '@compences/core';

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Omitted when everyone in a community may see the page. */
  capability?: Capability;
  /** Shown in the compact bottom bar on small screens. */
  primary?: boolean;
  /** Shows a count next to the label. */
  badge?: 'todo';
  /** Other section roots this item stands for, so it stays lit inside them. */
  covers?: string[];
  /** Drawn as the raised button in the middle of the bottom bar. */
  action?: boolean;
};

/**
 * Residents see Home, Events, People, Money, Ideas and Me. Staff add a Manage
 * group with their To do queue, events and the bank reconciliation; the
 * committee also gets Society settings. Notifications and personal settings
 * live in the profile menu.
 *
 * People and Money are deliberately outside Manage: everybody may see who is in
 * the society and what it did with its money, and only what they may *do* there
 * changes with the role.
 */
export function navItems(slug: string): { section: string; items: NavItem[] }[] {
  const base = `/app/${slug}`;
  return [
    {
      section: '',
      items: [
        { href: base, label: 'Home', icon: LayoutDashboard, primary: true },
        { href: `${base}/events`, label: 'Events', icon: CalendarDays, primary: true },
        // Not primary: the bar has four slots and Money wants one of them more.
        // People is a directory you consult now and then; the ledger is the
        // thing the society publishes.
        { href: `${base}/people`, label: 'People', icon: Users },
        { href: `${base}/money`, label: 'Money', icon: Wallet, primary: true },
        { href: `${base}/suggest`, label: 'Ideas', icon: Lightbulb },
        { href: `${base}/me`, label: 'Me', icon: UserRound, primary: true },
      ],
    },
    {
      section: COPY.manage,
      items: [
        {
          href: `${base}/todo`,
          label: COPY.todo,
          icon: ClipboardCheck,
          capability: 'events:manage',
          badge: 'todo',
        },
        {
          href: `${base}/admin`,
          label: 'Events',
          icon: CalendarCog,
          capability: 'events:manage',
        },
        {
          href: `${base}/admin/reconcile`,
          label: 'Reconcile',
          icon: Scale,
          capability: 'payments:record',
        },
        {
          href: `${base}/admin/settings`,
          label: COPY.societySettings,
          icon: Settings2,
          capability: 'roles:manage',
        },
      ],
    },
  ];
}

/** Drops sections the role cannot see anything in. */
export function visibleNav(slug: string, role: MemberRole) {
  return navItems(slug)
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.capability || can(role, item.capability)),
    }))
    .filter((group) => group.items.length > 0);
}

/**
 * The Manage hub, for the bottom bar only.
 *
 * It is deliberately not in navItems(): a desktop sidebar already lists the
 * Manage section row by row, and a link above those rows to a page listing the
 * same rows is the sidebar pointing at a copy of itself.
 */
function manageTab(slug: string): NavItem {
  const base = `/app/${slug}`;
  return {
    href: `${base}/manage`,
    label: COPY.manage,
    icon: SquareMenu,
    capability: 'events:manage',
    badge: 'todo',
    // Where the hub leads. Without these, walking from Manage into Reconcile
    // puts out every light on the bar and the app reads as nowhere.
    covers: [`${base}/todo`, `${base}/admin`, `${base}/people`],
  };
}

/**
 * Four tabs — and which four depends on whether you run the society — with
 * Contribute raised in the middle for everyone who contributes.
 *
 * Residents get Home, Events, Money, Me. Staff and the committee get Home,
 * Events, Manage, Me, with the To do count riding on the tab.
 *
 * Both of those middle slots were won the same way. Manage took one because
 * the work waiting on the committee is why they open the app at all, and it
 * used to live in the sheet behind the society name — a drawer you have to
 * know about. Money took the other because the ledger is the thing this app
 * exists to publish, and asking a resident to open Home first to read it is
 * the same mistake one step smaller.
 *
 * What gives way both times is People. It is a directory you consult now and
 * then rather than daily, and it keeps its place in the sidebar, in the sheet,
 * as the second row of the Manage hub, and under "More in this society" on
 * Home — which is built by subtracting this bar from the list, so the two
 * cannot drift.
 *
 * Contribute is the one thing a resident most often opens the app to do, so it
 * is a button rather than a tab. Staff don't contribute and don't get it.
 */
export function bottomNavItems(slug: string, role: MemberRole): NavItem[] {
  const primary = visibleNav(slug, role)
    .flatMap((group) => group.items)
    .filter((item) => item.primary);

  // Money gives up the slot rather than Manage taking a fifth: five labels
  // across a 360px phone is where they wrap. Staff read the ledger from Home,
  // which lists whatever their bar left out.
  const rest = primary.filter((item) => item.href !== `/app/${slug}/money`);
  const tabs = can(role, 'events:manage')
    ? [...rest.slice(0, 2), manageTab(slug), ...rest.slice(2)]
    : primary;

  if (!can(role, 'contribute')) return tabs;
  return [...tabs.slice(0, 2), contributeButton(slug), ...tabs.slice(2)];
}

/**
 * Opens what is collecting money, or goes straight to the one event that is.
 * Not in navItems(): the desktop sidebar draws it as a button of its own.
 */
export function contributeButton(slug: string): NavItem {
  return { href: `/app/${slug}/contribute`, label: 'Contribute', icon: Plus, action: true };
}
