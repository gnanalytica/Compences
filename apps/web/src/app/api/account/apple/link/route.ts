import { z } from 'zod';
import { storeAppleRefreshToken } from '@/lib/apple';
import { userFromBearer } from '@/lib/bearer-user';

/**
 * The phone posts the authorization code from Apple's sign-in sheet right
 * after signing in, so a later account deletion can revoke the token. It is
 * best-effort from the phone's side: sign-in has already succeeded.
 */
const body = z.object({ authorizationCode: z.string().min(1).max(2000) });

export async function POST(request: Request) {
  const user = await userFromBearer(request);
  if (!user) return new Response('Unauthorized', { status: 401 });

  // Only a person who really signed in with Apple has anything to link.
  const viaApple = user.identities?.some((identity) => identity.provider === 'apple');
  if (!viaApple) return new Response('Not an Apple account', { status: 400 });

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new Response('Bad request', { status: 400 });

  const result = await storeAppleRefreshToken(user.id, parsed.data.authorizationCode);
  return Response.json({ result }, { status: result === 'exchange_failed' ? 502 : 200 });
}
