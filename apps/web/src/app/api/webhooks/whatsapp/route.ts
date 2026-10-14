import { extractInboundMessages, verifyWebhookSignature } from '@compences/core';
import type { Json } from '@compences/supabase';
import { createAdminSupabase } from '@compences/supabase/server';
import { readWhatsAppConfig, sendText } from '@/lib/whatsapp/client';
import { replyTo, resolveSender } from '@/lib/whatsapp/bot';

/**
 * Meta WhatsApp Cloud API webhook.
 *
 * Two rules shape everything here:
 *
 *  1. **Always answer 200, quickly.** Meta retries anything else, and a retry
 *     storm on a handler that is already failing helps nobody. Errors are
 *     logged, not returned.
 *
 *  2. **Process each message exactly once.** Retries and duplicate deliveries
 *     are normal. `whatsapp_messages.wa_message_id` is unique, so the insert
 *     itself is the de-duplication: if it conflicts, another delivery already
 *     handled this message and we stop.
 */

// Meta's verification handshake, done once when the webhook is registered.
export async function GET(request: Request) {
  const config = readWhatsAppConfig();
  if (!config) return new Response('WhatsApp is not configured', { status: 503 });

  const params = new URL(request.url).searchParams;
  const mode = params.get('hub.mode');
  const token = params.get('hub.verify_token');
  const challenge = params.get('hub.challenge');

  if (mode === 'subscribe' && token === config.verifyToken && challenge) {
    return new Response(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  return new Response('Verification failed', { status: 403 });
}

export async function POST(request: Request) {
  const config = readWhatsAppConfig();
  if (!config) return new Response('WhatsApp is not configured', { status: 503 });

  // The signature covers the exact bytes received. Re-serialising parsed JSON
  // would change whitespace and key order, and the HMAC would never match.
  const rawBody = await request.text();
  const signature = request.headers.get('x-hub-signature-256');

  const authentic = await verifyWebhookSignature(rawBody, signature, config.appSecret);
  if (!authentic) {
    // 403 here is deliberate: an unsigned request is not ours to retry.
    return new Response('Invalid signature', { status: 403 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response('ok', { status: 200 });
  }

  const messages = extractInboundMessages(payload);
  if (messages.length === 0) {
    // Status callbacks (delivered / read) land here. Nothing to do.
    return new Response('ok', { status: 200 });
  }

  const db = createAdminSupabase();

  for (const message of messages) {
    try {
      // The unique constraint is the lock: a duplicate delivery loses here and
      // exits without acting twice.
      const { error: insertError } = await db.from('whatsapp_messages').insert({
        wa_message_id: message.waMessageId,
        direction: 'inbound',
        phone: message.from,
        body: message.text,
        // The column is jsonb; InboundMessage is a plain object of scalars.
        payload: { ...message } as unknown as Json,
        status: 'received',
      });

      if (insertError) {
        if (insertError.code === '23505') continue; // already handled
        console.error('[whatsapp] could not log inbound message', insertError);
        continue;
      }

      const reply = await replyTo(db, message);
      const sent = await sendText(config, message.from, reply);

      // Attribute the exchange to a community where we can, so admins can see
      // their own traffic without exposing anyone else's.
      const sender = await resolveSender(db, message.from);

      await db
        .from('whatsapp_messages')
        .update({
          status: sent.ok ? 'replied' : 'reply_failed',
          error: sent.ok ? null : sent.error,
          community_id: sender?.communityId ?? null,
          user_id: sender?.userId ?? null,
        })
        .eq('wa_message_id', message.waMessageId);

      if (sent.ok) {
        await db.from('whatsapp_messages').insert({
          wa_message_id: sent.id ?? null,
          direction: 'outbound',
          phone: message.from,
          body: reply,
          community_id: sender?.communityId ?? null,
          user_id: sender?.userId ?? null,
          status: 'sent',
        });
      }
    } catch (error) {
      // One bad message must not stop the others in the same delivery.
      console.error('[whatsapp] failed handling message', message.waMessageId, error);
    }
  }

  return new Response('ok', { status: 200 });
}
