import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { makeRedirectUri } from 'expo-auth-session';
import type { Session, User } from '@supabase/supabase-js';
import type { Tables } from '@compences/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  canSwitchView,
  parseViewMode,
  roleForView,
  type MemberRole,
  type ViewMode,
} from '@compences/core';
import { supabase } from './supabase';
import { SITE_URL } from './site';

/**
 * Session and community context for the whole app.
 *
 * Google sign-in runs through the system's in-app browser rather than a native
 * SDK: it needs no per-platform client IDs, works identically on iOS, Android
 * and web, and the PKCE exchange happens here when the browser hands back a
 * code. `detectSessionInUrl` is off in the client, so nothing else will pick
 * that code up.
 */

// Lets the auth browser close itself when it redirects back.
WebBrowser.maybeCompleteAuthSession();

/** The path the OAuth and magic-link redirects come back to; see app/auth-callback.tsx. */
export const authRedirectUri = () =>
  makeRedirectUri({ scheme: 'compences', path: 'auth-callback' });

const exchanges = new Map<string, Promise<{ error?: string }>>();

/**
 * Trades an auth code for a session. On Android the same code can arrive twice:
 * as the in-app browser's result and as a deep link the router opens at
 * /auth-callback. A code is single-use, so both paths share the first attempt.
 */
export function completeSignIn(code: string) {
  let pending = exchanges.get(code);
  if (!pending) {
    pending = supabase.auth
      .exchangeCodeForSession(code)
      .then(({ error }) => (error ? { error: error.message } : {}));
    exchanges.set(code, pending);
  }
  return pending;
}

export type Membership = Tables<'memberships'> & { communities: Tables<'communities'> | null };

type PublicProfile = Pick<
  Tables<'profiles'>,
  'id' | 'full_name' | 'avatar_url' | 'locale' | 'is_platform_admin' | 'created_at' | 'updated_at'
>;

type AuthValue = {
  session: Session | null;
  user: User | null;
  profile: PublicProfile | null;
  memberships: Membership[];
  activeCommunity: Tables<'communities'> | null;
  /** The member's real role. Decides access and admin screens. */
  role: MemberRole | null;
  /**
   * What resident-facing screens render for: the real role, or 'resident'
   * while a committee member uses the resident view.
   */
  viewRole: MemberRole | null;
  /** The committee's current view; null for anyone who cannot switch. */
  viewMode: ViewMode | null;
  setViewMode: (mode: ViewMode) => void;
  membershipId: string | null;
  /** When the active member saw their first-run welcome; null means not yet. */
  welcomedAt: string | null;
  /** False once the stored session has been read from disk. */
  loading: boolean;
  signInWithGoogle: () => Promise<{ error?: string }>;
  /** iOS only: Apple's native sheet, exchanged for a session with a nonce. */
  signInWithApple: () => Promise<{ error?: string }>;
  signInWithEmail: (email: string) => Promise<{ error?: string; sent?: boolean }>;
  signOut: () => Promise<void>;
  setActiveCommunity: (communityId: string) => void;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

const VIEW_MODE_STORAGE_KEY = 'compences:view-mode';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  // Only the columns a client may read: 0918.0100 took email and phone away
  // from `authenticated`, and nothing on this app needs them.
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewModeState] = useState<ViewMode>('committee');

  // The committee's last chosen view survives restarts. A failed read just
  // means the full committee view, which is the safe default.
  useEffect(() => {
    AsyncStorage.getItem(VIEW_MODE_STORAGE_KEY)
      .then((stored) => setViewModeState(parseViewMode(stored)))
      .catch(() => {});
  }, []);

  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeState(mode);
    void AsyncStorage.setItem(VIEW_MODE_STORAGE_KEY, mode).catch(() => {});
  }, []);

  const loadMemberships = useCallback(async (userId: string) => {
    const [{ data: profileRow }, { data: membershipRows }] = await Promise.all([
      supabase
        .from('profiles')
        // Not `*`: email and phone are no longer granted to clients, and asking
        // for them is an error rather than a null. Nothing here needs them.
        .select('id, full_name, avatar_url, locale, is_platform_admin, created_at, updated_at')
        .eq('id', userId)
        .maybeSingle(),
      supabase
        .from('memberships')
        .select('*, communities(*)')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('joined_at', { ascending: false }),
    ]);

    setProfile(profileRow ?? null);
    const rows = (membershipRows ?? []) as Membership[];
    setMemberships(rows);
    // Keep whatever the user had selected if it is still valid.
    setActiveId((current) =>
      current && rows.some((row) => row.community_id === current)
        ? current
        : (rows[0]?.community_id ?? null),
    );
  }, []);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session?.user) await loadMemberships(data.session.user.id);
      if (active) setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (next?.user && event === 'SIGNED_IN') {
        // Hold routing until memberships are known, or a member who just
        // signed in would be sent to /join for a moment.
        setLoading(true);
        void loadMemberships(next.user.id).finally(() => {
          if (active) setLoading(false);
        });
      } else if (next?.user) {
        void loadMemberships(next.user.id);
      } else {
        setProfile(null);
        setMemberships([]);
        setActiveId(null);
      }
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [loadMemberships]);

  const signInWithGoogle = useCallback(async () => {
    const redirectTo = authRedirectUri();

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true },
    });

    if (error || !data.url) return { error: error?.message ?? 'Could not start Google sign-in.' };

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

    // "cancel" and "dismiss" both mean the user backed out; that is not an error.
    if (result.type !== 'success') return {};

    const { queryParams } = Linking.parse(result.url);
    const code = typeof queryParams?.code === 'string' ? queryParams.code : null;
    if (!code) return { error: 'Google did not return a sign-in code.' };

    return completeSignIn(code);
  }, []);

  const signInWithApple = useCallback(async () => {
    try {
      // Apple hashes nothing for us: it gets the SHA-256 of a random nonce and
      // Supabase gets the raw one, so a stolen identity token cannot be replayed.
      const rawNonce = Crypto.randomUUID();
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce,
      );
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });
      if (!credential.identityToken) return { error: 'Apple did not return a sign-in token.' };

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
        nonce: rawNonce,
      });
      if (error) return { error: error.message };

      // Apple shares the name once, on the first sign-in only, and not through
      // the token. The profile trigger already ran with no name, so write it
      // here while it is still available.
      const name = [credential.fullName?.givenName, credential.fullName?.familyName]
        .filter(Boolean)
        .join(' ')
        .trim();
      if (name && data.user) {
        await supabase.from('profiles').update({ full_name: name }).eq('id', data.user.id);
      }
      // Let the server keep Apple's refresh token so deleting the account can
      // revoke it. Best-effort: the person is already signed in.
      if (credential.authorizationCode && data.session) {
        void fetch(`${SITE_URL}/api/account/apple/link`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${data.session.access_token}`,
          },
          body: JSON.stringify({ authorizationCode: credential.authorizationCode }),
        }).catch(() => {});
      }
      return {};
    } catch (error) {
      // Dismissing the Apple sheet is a choice, not a failure.
      if ((error as { code?: string }).code === 'ERR_REQUEST_CANCELED') return {};
      return { error: 'Could not sign in with Apple.' };
    }
  }, []);

  const signInWithEmail = useCallback(async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: authRedirectUri(),
      },
    });
    return error ? { error: error.message } : { sent: true };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  // Pulled out so the declared dependency matches what the compiler infers:
  // depending on `session?.user` while reading `session.user.id` reads as a
  // narrower dependency than it really is.
  const userId = session?.user?.id ?? null;

  const refresh = useCallback(async () => {
    if (userId) await loadMemberships(userId);
  }, [userId, loadMemberships]);

  const value = useMemo<AuthValue>(() => {
    const active = memberships.find((row) => row.community_id === activeId) ?? null;
    return {
      session,
      user: session?.user ?? null,
      profile,
      memberships,
      activeCommunity: active?.communities ?? null,
      role: active?.role ?? null,
      viewRole: roleForView(active?.role ?? null, viewMode),
      viewMode: canSwitchView(active?.role) ? viewMode : null,
      setViewMode,
      membershipId: active?.id ?? null,
      welcomedAt: active ? (active.welcomed_at ?? null) : null,
      loading,
      signInWithGoogle,
      signInWithApple,
      signInWithEmail,
      signOut,
      setActiveCommunity: setActiveId,
      refresh,
    };
  }, [
    session,
    profile,
    memberships,
    activeId,
    viewMode,
    setViewMode,
    loading,
    signInWithGoogle,
    signInWithApple,
    signInWithEmail,
    signOut,
    refresh,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}
