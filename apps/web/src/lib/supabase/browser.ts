'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@compences/supabase/types';

let cached: ReturnType<typeof createBrowserClient<Database>> | undefined;

/**
 * Browser client bound to the signed-in user's session cookie, used only for
 * direct uploads to Storage so files never pass through a server action.
 *
 * The env vars are referenced literally: Next only inlines `NEXT_PUBLIC_*`
 * values it can see statically, so the shared `readSupabaseEnv()` (which looks
 * keys up dynamically) would read undefined in the browser.
 */
export function getBrowserSupabase() {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error('Supabase is not configured.');
  cached = createBrowserClient<Database>(url, anonKey);
  return cached;
}
