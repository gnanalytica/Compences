import { NextResponse, type NextRequest } from 'next/server';
import { normalizeJoinCode } from '@compences/core';
import { getSupabase } from '@/lib/supabase/server';

/**
 * The link committees share: /join/WHITECLIFF.
 *
 * Signed-in visitors go straight to the join form with the code filled in;
 * everyone else signs in first and comes back to it. The code is only put in
 * the form. Checking it, and the brute-force limit, happen when they submit.
 */
export async function GET(request: NextRequest, context: RouteContext<'/join/[code]'>) {
  const { code: raw } = await context.params;
  const code = normalizeJoinCode(decodeURIComponent(raw)).slice(0, 16);
  const onboarding = `/onboarding?mode=join&code=${encodeURIComponent(code)}`;

  const supabase = await getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const target = new URL(
    user ? onboarding : `/login?next=${encodeURIComponent(onboarding)}`,
    request.nextUrl.origin,
  );
  return NextResponse.redirect(target);
}
