import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { readServiceRoleKey, readSupabaseEnv } from './env';

/**
 * The subset of Next's cookie store this package needs. Declared structurally
 * so `@compences/supabase` does not have to depend on `next`.
 */
export type CookieStore = {
  getAll: () => { name: string; value: string }[];
  set: (name: string, value: string, options?: Record<string, unknown>) => void;
};

/**
 * Server-side client bound to the request's cookies, so RLS sees the signed-in
 * user. Pass the store from `await cookies()` — in Next 16 that call is async.
 *
 * A fresh client must be created per request: `@supabase/ssr` emits the
 * no-store cache headers only on the first cookie write, so a client reused
 * across requests would leave later responses cacheable with a session cookie
 * attached.
 */
export function createServerSupabase(cookieStore: CookieStore) {
  const { url, anonKey } = readSupabaseEnv();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookies) => {
        try {
          for (const { name, value, options } of cookies) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot set cookies. Refreshing the session is
          // the proxy's job (see apps/web/src/proxy.ts), which does apply both
          // the cookies and the accompanying cache headers, so swallowing this
          // is safe rather than merely convenient.
        }
      },
    },
  });
}

/**
 * Service-role client. Bypasses RLS completely, so every caller is responsible
 * for its own authorisation checks. Only reach for this where there is no user
 * session to act on behalf of — the WhatsApp webhook and API-key requests.
 */
export function createAdminSupabase() {
  const { url } = readSupabaseEnv();
  return createClient<Database>(url, readServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
