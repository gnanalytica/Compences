import { timingSafeEqual } from 'node:crypto';
import {
  buildPushMessages,
  chunk,
  type ExpoPushMessage,
  type NotificationData,
} from '@compences/core';
import { createAdminSupabase } from '@compences/supabase/server';

/**
 * Sends push notifications for notification rows the database has written.
 *
 * Called by pg_net after every batch of new notifications, and every five
 * minutes by a pg_cron sweep (see migration 20260913000600). Both send the
 * shared secret in `x-dispatch-secret`; nothing else can trigger a send.
 *
 * Each call claims unsent rows by stamping `pushed_at` first, with a guard on
 * `pushed_at is null`, so two overlapping calls never push the same row twice.
 * A row is pushed at most once: failures are recorded in `push_error` and the
 * in-app notification is still there. Delivery receipts are not polled; for
 * the pilot, the ticket response is enough to prune dead device tokens.
 */

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
// Claimed ids travel in the request URL (`id=in.(…)`); 200 UUIDs keep it well
// under proxy URL limits. The pg_cron sweep picks up anything beyond that.
const CLAIM_LIMIT = 200;

type ExpoTicket =
  | { status: 'ok'; id: string }
  | { status: 'error'; message?: string; details?: { error?: string } };

function secretMatches(given: string | null, expected: string): boolean {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on different lengths; a length check leaks only the
  // length, which is fine for a random secret.
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const expected = process.env.NOTIFICATIONS_DISPATCH_SECRET;
  if (!expected) return new Response('Push dispatch is not configured', { status: 503 });
  if (!secretMatches(request.headers.get('x-dispatch-secret'), expected)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const db = createAdminSupabase();

  // 1. Pick candidates, then claim only those still unsent.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: candidates, error: candidateError } = await db
    .from('notifications')
    .select('id')
    .is('pushed_at', null)
    .gt('created_at', since)
    .order('created_at')
    .limit(CLAIM_LIMIT);
  if (candidateError) {
    console.error('[push] could not read notifications', candidateError);
    return Response.json({ error: 'read_failed' }, { status: 500 });
  }
  if (!candidates?.length) return Response.json({ claimed: 0, sent: 0, errors: 0 });

  const { data: claimed, error: claimError } = await db
    .from('notifications')
    .update({ pushed_at: new Date().toISOString() })
    .in(
      'id',
      candidates.map((row) => row.id),
    )
    .is('pushed_at', null)
    .select('id, user_id, title, body, data');
  if (claimError) {
    console.error('[push] could not claim notifications', claimError);
    return Response.json({ error: 'claim_failed' }, { status: 500 });
  }
  if (!claimed?.length) return Response.json({ claimed: 0, sent: 0, errors: 0 });

  // 2. Devices for everyone we are notifying.
  const userIds = [...new Set(claimed.map((row) => row.user_id))];
  const { data: devices } = await db
    .from('device_push_tokens')
    .select('user_id, token')
    .in('user_id', userIds);
  const tokensByUser = new Map<string, string[]>();
  for (const device of devices ?? []) {
    tokensByUser.set(device.user_id, [...(tokensByUser.get(device.user_id) ?? []), device.token]);
  }

  // 3. Build messages, remembering which notification each came from.
  const messages: ExpoPushMessage[] = [];
  const origin: string[] = [];
  const noDevices: string[] = [];
  for (const row of claimed) {
    const built = buildPushMessages(
      {
        id: row.id,
        title: row.title,
        body: row.body,
        data: (row.data ?? null) as NotificationData | null,
      },
      tokensByUser.get(row.user_id) ?? [],
    );
    if (built.length === 0) noDevices.push(row.id);
    for (const message of built) {
      messages.push(message);
      origin.push(row.id);
    }
  }

  if (noDevices.length) {
    await db.from('notifications').update({ push_error: 'no devices' }).in('id', noDevices);
  }

  // 4. Send in Expo-sized batches.
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  if (process.env.EXPO_ACCESS_TOKEN)
    headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;

  let sent = 0;
  let errors = 0;
  const failures = new Map<string, string>();
  const deadTokens = new Set<string>();
  let offset = 0;

  for (const batch of chunk(messages)) {
    const batchOrigin = origin.slice(offset, offset + batch.length);
    offset += batch.length;
    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(batch),
      });
      const payload = (await response.json().catch(() => null)) as { data?: ExpoTicket[] } | null;
      if (!response.ok || !Array.isArray(payload?.data)) {
        errors += batch.length;
        for (const id of batchOrigin) failures.set(id, `expo ${response.status}`);
        continue;
      }
      payload.data.forEach((ticket, index) => {
        const notificationId = batchOrigin[index]!;
        if (ticket.status === 'ok') {
          sent += 1;
          return;
        }
        errors += 1;
        const code = ticket.details?.error ?? 'error';
        failures.set(notificationId, `${code}: ${ticket.message ?? ''}`.slice(0, 300));
        if (code === 'DeviceNotRegistered') deadTokens.add(batch[index]!.to);
      });
    } catch (error) {
      errors += batch.length;
      for (const id of batchOrigin) failures.set(id, `network: ${String(error)}`.slice(0, 300));
    }
  }

  // 5. Record what went wrong and forget devices that are gone.
  for (const [id, message] of failures) {
    await db.from('notifications').update({ push_error: message }).eq('id', id);
  }
  if (deadTokens.size) {
    await db
      .from('device_push_tokens')
      .delete()
      .in('token', [...deadTokens]);
  }

  return Response.json({ claimed: claimed.length, sent, errors });
}
