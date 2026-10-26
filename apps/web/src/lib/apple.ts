import { createSign } from 'node:crypto';
import { createAdminSupabase } from '@compences/supabase/server';

/**
 * Sign in with Apple, the server half.
 *
 * Apple's guideline 5.1.1(v) asks an app that offers it to revoke the person's
 * token when they delete their account. That takes the refresh token Apple
 * issues for the authorization code the sign-in sheet returns, so the phone
 * posts the code here at sign-in, we exchange and keep the token (see
 * migration 20261026000100), and deletion revokes it first.
 *
 * Configured by four variables; with any missing every function here is a
 * no-op that says so, so a build without Apple credentials behaves as before.
 */

const APPLE_AUDIENCE = 'https://appleid.apple.com';

type AppleConfig = { teamId: string; keyId: string; privateKey: string; clientId: string };

export function readAppleConfig(): AppleConfig | null {
  const teamId = process.env.APPLE_TEAM_ID;
  const keyId = process.env.APPLE_KEY_ID;
  const privateKey = process.env.APPLE_PRIVATE_KEY;
  if (!teamId || !keyId || !privateKey) return null;
  return {
    teamId,
    keyId,
    // Hosts store a .p8 on one line with literal \n.
    privateKey: privateKey.replace(/\\n/g, '\n'),
    // The native sheet issues codes to the app's bundle id, not a Services ID.
    clientId: process.env.APPLE_CLIENT_ID || 'com.compences.app',
  };
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

/** The short-lived ES256 JWT Apple wants in place of a client secret. */
export function appleClientSecret(config: AppleConfig, now = Math.floor(Date.now() / 1000)) {
  const header = base64url(JSON.stringify({ alg: 'ES256', kid: config.keyId, typ: 'JWT' }));
  const payload = base64url(
    JSON.stringify({
      iss: config.teamId,
      iat: now,
      exp: now + 300,
      aud: APPLE_AUDIENCE,
      sub: config.clientId,
    }),
  );
  const signature = createSign('SHA256')
    .update(`${header}.${payload}`)
    // Apple wants the raw r||s form, not Node's default DER.
    .sign({ key: config.privateKey, dsaEncoding: 'ieee-p1363' });
  return `${header}.${payload}.${base64url(signature)}`;
}

async function appleForm(path: string, config: AppleConfig, fields: Record<string, string>) {
  return fetch(`${APPLE_AUDIENCE}/auth/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: appleClientSecret(config),
      ...fields,
    }),
    signal: AbortSignal.timeout(8000),
  });
}

export type AppleLinkResult = 'stored' | 'not_configured' | 'exchange_failed';

/** Trades the sign-in sheet's one-use code for a refresh token and keeps it. */
export async function storeAppleRefreshToken(
  userId: string,
  authorizationCode: string,
): Promise<AppleLinkResult> {
  const config = readAppleConfig();
  if (!config) return 'not_configured';

  const response = await appleForm('token', config, {
    grant_type: 'authorization_code',
    code: authorizationCode,
  });
  if (!response.ok) return 'exchange_failed';
  const body = (await response.json()) as { refresh_token?: string };
  if (!body.refresh_token) return 'exchange_failed';

  const db = createAdminSupabase();
  const { error } = await db.from('apple_refresh_tokens').upsert(
    {
      user_id: userId,
      refresh_token: body.refresh_token,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );
  return error ? 'exchange_failed' : 'stored';
}

export type AppleRevokeResult = 'revoked' | 'nothing_to_revoke' | 'not_configured' | 'failed';

/**
 * Revokes the person's Apple token, if we hold one. Called before the account
 * is deleted, because the row cascades away with it. A failure is reported,
 * not thrown: nobody's deletion should hang on Apple being reachable.
 */
export async function revokeAppleToken(userId: string): Promise<AppleRevokeResult> {
  const db = createAdminSupabase();
  const { data: row } = await db
    .from('apple_refresh_tokens')
    .select('refresh_token')
    .eq('user_id', userId)
    .maybeSingle();
  if (!row) return 'nothing_to_revoke';

  const config = readAppleConfig();
  if (!config) return 'not_configured';

  try {
    const response = await appleForm('revoke', config, {
      token: row.refresh_token,
      token_type_hint: 'refresh_token',
    });
    if (!response.ok) return 'failed';
  } catch {
    return 'failed';
  }
  await db.from('apple_refresh_tokens').delete().eq('user_id', userId);
  return 'revoked';
}
