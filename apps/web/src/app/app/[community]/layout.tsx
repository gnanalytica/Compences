import { getMemberships, requireCommunity } from '@/lib/auth';
import { CommunitySwitcher } from '@/components/community-switcher';
import { DismissMenus } from '@/components/dismiss-menus';
import { MobileNavSheet } from '@/components/mobile-nav-sheet';
import { BottomNav, SidebarNav } from '@/components/sidebar-nav';
import { NotificationBell } from '@/components/notification-bell';
import { ProfileMenu } from '@/components/profile-menu';
import { ResidentViewBanner, ViewSwitch } from '@/components/view-switch';
import { getSupabase } from '@/lib/supabase/server';
import { getTodoCount } from '@/lib/todo';
import { getSeason } from '@/lib/events';
import { festivalVars } from '@/components/festival';
import { todayIn } from '@compences/core';

export default async function CommunityLayout(props: LayoutProps<'/app/[community]'>) {
  const { community: slug } = await props.params;
  // Membership list for the switcher starts alongside the community check;
  // both are cached per request, so the redirect path reuses it too.
  const membershipsPromise = getMemberships();
  // Redirects to onboarding or another community if this one is not theirs.
  const { community, role, viewRole, viewMode, profile } = await requireCommunity(slug);
  const supabase = await getSupabase();

  // RLS limits this to the member's own notifications. The badge only needs a
  // number, so it asks todo_count() rather than building the whole queue.
  const [memberships, { count: unread }, todoCount, season] = await Promise.all([
    membershipsPromise,
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('community_id', community.id)
      .is('read_at', null),
    getTodoCount(community.id, viewRole),
    getSeason(community.id, todayIn(community.timezone)),
  ]);
  const counts = { todo: todoCount };
  const name = profile?.full_name ?? 'You';

  // The sidebar's contents, built once and rendered twice: as the sidebar on a
  // desktop and inside the sheet on a phone. Two lists would drift, and the
  // half that drifted last time was the half only phones could see.
  const switcher = (
    <CommunitySwitcher
      current={{ name: community.name, slug: community.slug }}
      role={role}
      memberships={memberships}
    />
  );
  const nav = <SidebarNav slug={community.slug} role={viewRole} counts={counts} />;
  const viewSwitch = viewMode ? <ViewSwitch slug={community.slug} mode={viewMode} /> : null;

  return (
    // The whole app wears whatever the society is heading towards next — the
    // Contribute button, the links, the focus rings — and an event's own page
    // wears its own festival on top.
    <div className="flex min-h-dvh" style={festivalVars(season.festival)}>
      <DismissMenus />
      <aside className="border-border-base bg-surface sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r px-3 py-4 md:flex">
        {switcher}
        {viewSwitch ? <div className="mt-3 px-1">{viewSwitch}</div> : null}

        <div className="mt-4 flex-1 overflow-y-auto">{nav}</div>

        <div className="border-border-base mt-4 border-t pt-3">
          <ProfileMenu
            slug={community.slug}
            name={name}
            email={profile?.email}
            unread={unread ?? 0}
          />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          id="app-header"
          className="border-border-base/70 bg-surface/85 sticky top-0 z-30 flex items-center justify-between gap-3 border-b px-4 py-3 backdrop-blur-xl md:hidden"
        >
          {/* The society name used to link to Home, which the bottom bar
              already reaches. It opens the rest of the app instead. */}
          <MobileNavSheet societyName={community.name}>
            {switcher}
            {viewSwitch ? <div className="px-1">{viewSwitch}</div> : null}
            {nav}
          </MobileNavSheet>
          <div className="flex items-center gap-1">
            <NotificationBell slug={community.slug} unread={unread ?? 0} className="p-1.5" />
            <ProfileMenu slug={community.slug} name={name} unread={0} viewMode={viewMode} compact />
          </div>
        </header>

        {/* Bottom padding clears the mobile nav bar and its raised button. */}
        <main id="main" className="min-w-0 flex-1 pb-24 md:pb-0">
          {viewMode === 'resident' ? <ResidentViewBanner slug={community.slug} /> : null}
          {props.children}
        </main>

        <BottomNav slug={community.slug} role={viewRole} counts={counts} />
      </div>
    </div>
  );
}
