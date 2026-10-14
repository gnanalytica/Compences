import { NextResponse, type NextRequest } from 'next/server';
import { normalizeInviteCode } from '@compences/core';
import { getSupabase } from '@/lib/supabase/server';

/**
 * The link a committee member sends one resident: /invite/K7MQ3XPB.
 *
 * Mirrors /join/CODE deliberately, including signing in first: redeeming seats
 * a membership against `auth.uid()`, so there is nobody to seat until then. The
 * code is only carried into the form — checking it, and the brute-force limit,
 * happen when it is looked up.
 */
export async function GET(request: NextRequest, context: RouteContext<'/invite/[code]'>) {
  const { code: raw } = await context.params;
  const code = normalizeInviteCode(decodeURIComponent(raw)).slice(0, 16);
  const onboarding = `/onboarding?mode=invite&invite=${encodeURIComponent(code)}`;

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
