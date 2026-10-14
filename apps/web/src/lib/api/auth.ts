import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@compences/supabase';
import { readSupabaseEnv } from '@compences/supabase';
import { createAdminSupabase } from '@compences/supabase/server';
import {
  hasScope,
  keyPrefixOf,
  looksLikeApiKey,
  parseBearerToken,
  sha256Hex,
  type MemberRole,
} from '@compences/core';
import { getSupabase } from '@/lib/supabase/server';

/**
 * Who is calling /api/v1, and what they may see.
 *
 * There are two doors:
 *
 *  - A **user token** (or a browser session cookie). The client is created with
 *    that token, so PostgreSQL row-level security applies exactly as it does in
 *    the web app. This is what the mobile app uses.
 *
 *  - An **API key** — for AI agents, scripts and server integrations. There is
 *    no Supabase user behind it, so the client runs with the service role and
 *    RLS does *not* apply. Every query made on its behalf must therefore be
 *    filtered by `communityId` explicitly. Nothing outside this module is
 *    allowed to touch that client directly: `lib/api/resources.ts` owns all of
 *    the queries and applies the filter in one place.
 */
export type ApiPrincipal = {
  kind: 'user' | 'api_key';
  communityId: string;
  communitySlug: string;
  /** Membership to attribute writes to. Null for a key with no `acts_as`. */
  membershipId: string | null;
  role: MemberRole | null;
  /** Null for user tokens, where RLS decides instead of scopes. */
  scopes: string[] | null;
  apiKeyId: string | null;
  userId: string | null;
  db: SupabaseClient<Database>;
  /** True when the client bypasses RLS and needs explicit scoping. */
  bypassesRls: boolean;
};

export type AuthFailure = { error: 'unauthorized' | 'forbidden'; message: string };
export type AuthResult = { principal: ApiPrincipal } | AuthFailure;

export const isFailure = (result: AuthResult): result is AuthFailure => 'error' in result;

function userScopedClient(accessToken: string): SupabaseClient<Database> {
  const { url, anonKey } = readSupabaseEnv();
  return createClient<Database>(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Resolves the caller.
 *
 * `communityParam` is the slug from `?community=`. An API key ignores it — the
 * key is bound to one community and cannot reach past it.
 */
export async function authenticate(
  request: Request,
  communityParam?: string | null,
): Promise<AuthResult> {
  const token = parseBearerToken(request.headers.get('authorization'));

  if (token && looksLikeApiKey(token)) {
    return authenticateApiKey(token);
  }

  return authenticateUser(token, communityParam ?? null);
}

async function authenticateApiKey(token: string): Promise<AuthResult> {
  const admin = createAdminSupabase();

  // The digest is compared inside the database, in constant time; the stored
  // hash never crosses the wire.
  const { data, error } = await admin.rpc('verify_api_key', {
    p_prefix: keyPrefixOf(token),
    p_hash: await sha256Hex(token),
  });

  const row = data?.[0];
  if (error || !row?.api_key_id || !row.community_id) {
    return { error: 'unauthorized', message: 'That API key is not valid.' };
  }

  const { data: community } = await admin
    .from('communities')
    .select('slug')
    .eq('id', row.community_id)
    .maybeSingle();

  let role: MemberRole | null = null;
  if (row.acts_as) {
    const { data: membership } = await admin
      .from('memberships')
      .select('role')
      .eq('id', row.acts_as)
      .maybeSingle();
    role = membership?.role ?? null;
  }

  return {
    principal: {
      kind: 'api_key',
      communityId: row.community_id,
      communitySlug: community?.slug ?? '',
      membershipId: row.acts_as,
      role,
      scopes: row.scopes ?? [],
      apiKeyId: row.api_key_id,
      userId: null,
      db: admin,
      bypassesRls: true,
    },
  };
}

async function authenticateUser(
  token: string | null,
  communitySlug: string | null,
): Promise<AuthResult> {
  // A bearer token is how the mobile app calls in; the cookie session is how
  // the web app does. Either resolves to the same user-scoped client.
  const db = token ? userScopedClient(token) : await getSupabase();

  const {
    data: { user },
  } = await db.auth.getUser(token ?? undefined);

  if (!user) {
    return { error: 'unauthorized', message: 'Sign in, or send an API key.' };
  }

  let query = db
    .from('memberships')
    .select('id, role, community_id, communities!inner(slug)')
    .eq('user_id', user.id)
    .eq('status', 'active');

  if (communitySlug) query = query.eq('communities.slug', communitySlug);

  const { data: memberships } = await query.limit(2);
  const membership = memberships?.[0];

  if (!membership) {
    return {
      error: 'forbidden',
      message: communitySlug
        ? `You are not a member of “${communitySlug}”.`
        : 'You do not belong to any community yet.',
    };
  }

  // Being a member of several communities without saying which one is
  // ambiguous, and guessing would silently act on the wrong society.
  if (!communitySlug && (memberships?.length ?? 0) > 1) {
    return {
      error: 'forbidden',
      message: 'You belong to more than one community. Add ?community=<slug>.',
    };
  }

  return {
    principal: {
      kind: 'user',
      communityId: membership.community_id,
      communitySlug: membership.communities.slug,
      membershipId: membership.id,
      role: membership.role,
      scopes: null,
      apiKeyId: null,
      userId: user.id,
      db,
      bypassesRls: false,
    },
  };
}

/**
 * Scope gate for API keys. User tokens return true here because RLS has
 * already decided what they can reach — scopes only describe key permissions.
 */
export function allows(principal: ApiPrincipal, scope: string): boolean {
  if (principal.scopes === null) return true;
  return hasScope(principal.scopes, scope);
}
