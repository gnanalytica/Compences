import { revokeAppleToken } from '@/lib/apple';
import { userFromBearer } from '@/lib/bearer-user';

/**
 * Called by the phone just before `delete_my_account()`. The answer is
 * informational: the phone deletes the account whatever it says.
 */
export async function POST(request: Request) {
  const user = await userFromBearer(request);
  if (!user) return new Response('Unauthorized', { status: 401 });

  const result = await revokeAppleToken(user.id);
  if (result === 'failed') console.error('Apple token revocation failed for a user being deleted');
  return Response.json({ result });
}
