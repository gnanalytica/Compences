import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import type { User } from '@supabase/supabase-js';
import type { Tables } from '@compences/supabase';
import {
  can,
  canSwitchView,
  parseViewMode,
  roleForView,
  type Capability,
  type MemberRole,
  type ViewMode,
} from '@compences/core';
import { getSupabase } from './supabase/server';

/**
 * Server-side session and membership helpers.
 *
 * These are the *convenience* layer — they decide what to render and where to
 * redirect. They are not the security boundary: every table is protected by
 * row-level security, so a user who gets past a check here still cannot read
 * or write anything the database does not allow.
 *
 * Wrapped in React's `cache()` so a page that asks for the current user in
 * three places still makes one round trip per request.
 */

export type Community = Tables<'communities'>;
export type Membership = Tables<'memberships'>;
export type Profile = Tables<'profiles'>;

export type MembershipWithCommunity = Membership & { communities: Community | null };

export const getCurrentUser = cache(async (): Promise<User | null> => {
  const supabase = await getSupabase();
  // getUser() verifies the JWT with Supabase. getSession() only decodes the
  // cookie, which the client controls, so it must never gate access.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

/**
 * Your own profile, contact details included.
 *
 * `select('*')` stopped working when 0918.0100 took email and phone away from
 * `authenticated`: a row policy cannot say "these two columns are different",
 * so column privileges do it instead. my_contact() hands back your own two,
 * and only ever your own, which is why this still returns a whole Profile.
 */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await getSupabase();
  const [{ data: profile }, { data: contact }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, avatar_url, locale, is_platform_admin, created_at, updated_at')
      .eq('id', user.id)
      .maybeSingle(),
    supabase.rpc('my_contact'),
  ]);
  if (!profile) return null;
  const mine = contact?.[0];
  return { ...profile, email: mine?.email ?? null, phone: mine?.phone ?? null };
});

/** Every community the signed-in user belongs to, newest membership first. */
export const getMemberships = cache(async (): Promise<MembershipWithCommunity[]> => {
  const user = await getCurrentUser();
  if (!user) return [];
  const supabase = await getSupabase();
  const { data } = await supabase
    .from('memberships')
    .select('*, communities(*)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('joined_at', { ascending: false });
  return (data ?? []) as MembershipWithCommunity[];
});

export type CommunityContext = {
  user: User;
  profile: Profile | null;
  community: Community;
  membership: Membership;
  /** The member's real role. Decides access, actions and admin pages. */
  role: MemberRole;
  /**
   * What resident-facing screens render for: the real role, or 'resident'
   * when a committee member has switched to the resident view.
   */
  viewRole: MemberRole;
  /** The committee's current view; null for anyone who cannot switch. */
  viewMode: ViewMode | null;
  /** Units the user currently occupies here. Empty for staff and admins. */
  unitIds: string[];
};

/** Remembers a committee member's chosen view across visits and societies. */
export const VIEW_COOKIE = 'compences_view';

const getViewMode = cache(async (): Promise<ViewMode> => {
  const store = await cookies();
  return parseViewMode(store.get(VIEW_COOKIE)?.value);
});

/**
 * Resolves the community in the URL and the caller's standing in it.
 *
 * Returns null rather than redirecting so callers can choose between "send
 * them to onboarding" and "render a 404".
 */
export const getCommunityContext = cache(async (slug: string): Promise<CommunityContext | null> => {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await getSupabase();

  // One round trip for the community and the caller's membership in it. RLS
  // already restricts `communities` to ones the caller belongs to, so an
  // unknown slug and a slug they have no business seeing look identical here.
  const { data: row } = await supabase
    .from('memberships')
    .select('*, communities!inner(*)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .eq('communities.slug', slug)
    .maybeSingle();
  if (!row?.communities) return null;
  const { communities: community, ...membership } = row;

  const [{ data: occupancies }, profile, mode] = await Promise.all([
    supabase
      .from('unit_occupants')
      .select('unit_id, units!inner(community_id)')
      .eq('membership_id', membership.id)
      .is('moved_out_on', null),
    getProfile(),
    getViewMode(),
  ]);

  const unitIds = (occupancies ?? [])
    .filter((row) => row.units?.community_id === community.id)
    .map((row) => row.unit_id);

  return {
    user,
    profile,
    community,
    membership,
    role: membership.role,
    viewRole: roleForView(membership.role, mode),
    viewMode: canSwitchView(membership.role) ? mode : null,
    unitIds,
  };
});

/**
 * Like getCommunityContext, but sends the user somewhere sensible instead of
 * returning null: to onboarding if they belong to nothing, to their first
 * community if they simply took a wrong turn.
 */
export async function requireCommunity(slug: string): Promise<CommunityContext> {
  await requireUser();
  const context = await getCommunityContext(slug);
  if (context) return context;

  const memberships = await getMemberships();
  const fallback = memberships[0]?.communities?.slug;
  redirect(fallback ? `/app/${fallback}` : '/onboarding');
}

/** Guards a page behind a capability. Redirects rather than showing an error. */
export async function requireCapability(
  slug: string,
  capability: Capability,
): Promise<CommunityContext> {
  const context = await requireCommunity(slug);
  if (!can(context.role, capability)) redirect(`/app/${slug}`);
  return context;
}
