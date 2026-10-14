import { cookies } from 'next/headers';
import { createServerSupabase, createAdminSupabase } from '@compences/supabase/server';

/**
 * Request-scoped Supabase client for Server Components, Server Actions and
 * Route Handlers. `cookies()` is async in Next 16, so this is too.
 */
export async function getSupabase() {
  const cookieStore = await cookies();
  return createServerSupabase({
    getAll: () => cookieStore.getAll(),
    set: (name, value, options) => cookieStore.set(name, value, options),
  });
}

export { createAdminSupabase };
