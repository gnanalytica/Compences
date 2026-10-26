import { createAdminSupabase } from '@compences/supabase/server';

/**
 * The signed-in user behind an `Authorization: Bearer <access token>` header,
 * for the few routes the phone calls directly. getUser(token) asks Supabase to
 * verify the token rather than trusting its contents.
 */
export async function userFromBearer(request: Request) {
  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return null;
  const { data, error } = await createAdminSupabase().auth.getUser(token);
  return error ? null : data.user;
}
