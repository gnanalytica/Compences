import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@compences/supabase';
import {
  HELP_TEXT,
  NOT_LINKED_TEXT,
  TASK_STATUS_DOT,
  UNKNOWN_TEXT,
  countdown,
  formatDate,
  formatMoney,
  fundedPercent,
  normalizeInviteCode,
  normalizeStats,
  parseCommand,
  relativeTime,
  type InboundMessage,
  type WhatsAppCommand,
  todayIn,
} from '@compences/core';

/**
 * Turns an inbound WhatsApp message into a reply.
 *
 * Runs with the service role — there is no Supabase session behind a phone
 * number — so every query is scoped explicitly to the society the sender
 * belongs to. `resolveSender` establishes that scope once, and nothing below
 * queries outside it.
 *
 * The bot deliberately cannot spend money or approve anything. It reads, it
 * files a suggestion, and it hands out a link for actions that deserve a
 * screen and a confirm button.
 */

type Db = SupabaseClient<Database>;

type Sender = {
  userId: string;
  communityId: string;
  communitySlug: string;
  membershipId: string;
  currency: string;
};

async function resolveSender(db: Db, phone: string): Promise<Sender | null> {
  const { data: link } = await db
    .from('whatsapp_links')
    .select('user_id, default_community_id, verified_at, opted_out_at')
    .eq('phone', phone)
    .maybeSingle();

  if (!link?.verified_at || link.opted_out_at) return null;

  let query = db
    .from('memberships')
    .select('id, community_id, communities!inner(slug, currency)')
    .eq('user_id', link.user_id)
    .eq('status', 'active');

  if (link.default_community_id) query = query.eq('community_id', link.default_community_id);

  const { data: membership } = await query.limit(1).maybeSingle();
  if (!membership) return null;

  return {
    userId: link.user_id,
    communityId: membership.community_id,
    communitySlug: membership.communities.slug,
    membershipId: membership.id,
    currency: membership.communities.currency,
  };
}

/** The soonest published event that has not happened yet. */
async function nextEvent(db: Db, sender: Sender) {
  const today = todayIn();
  const { data } = await db
    .from('events')
    .select('id, slug, emoji, name, starts_on, venue, fund_target')
    .eq('community_id', sender.communityId)
    .eq('status', 'published')
    .gte('starts_on', today)
    .order('starts_on')
    .limit(1)
    .maybeSingle();
  return data;
}

async function statsFor(db: Db, eventId: string) {
  const { data } = await db.from('event_stats').select('*').eq('event_id', eventId).maybeSingle();
  return normalizeStats(data);
}

function appLink(sender: Sender, path = ''): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? '';
  return `${base}/app/${sender.communitySlug}${path}`;
}

/**
 * Links a phone number to an account using the short code the resident
 * generated in the app. One code, one use, fifteen minutes.
 */
async function handleLink(db: Db, phone: string, code: string): Promise<string> {
  const normalized = normalizeInviteCode(code);

  const { data: linkCode } = await db
    .from('whatsapp_link_codes')
    .select('id, user_id, community_id, expires_at, consumed_at')
    .eq('code', normalized)
    .maybeSingle();

  if (!linkCode) {
    return 'That code isn’t right. Open the app → *More → WhatsApp* for a fresh one.';
  }
  if (linkCode.consumed_at) return 'That code has already been used. Generate a new one.';
  if (new Date(linkCode.expires_at) <= new Date()) {
    return 'That code has expired. Generate a new one in the app.';
  }

  const { error } = await db.from('whatsapp_links').upsert(
    {
      phone,
      user_id: linkCode.user_id,
      default_community_id: linkCode.community_id,
      verified_at: new Date().toISOString(),
      opted_out_at: null,
    },
    { onConflict: 'phone' },
  );

  if (error) return 'Something went wrong linking this number. Please try again.';

  await db
    .from('whatsapp_link_codes')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', linkCode.id);

  return `This number is linked.\n\n${HELP_TEXT}`;
}

async function handleEvents(db: Db, sender: Sender): Promise<string> {
  const today = todayIn();
  const { data } = await db
    .from('events')
    .select('id, emoji, name, starts_on, venue')
    .eq('community_id', sender.communityId)
    .eq('status', 'published')
    .gte('starts_on', today)
    .order('starts_on')
    .limit(4);

  if (!data?.length) return 'Nothing planned just now.';

  const lines = await Promise.all(
    data.map(async (event) => {
      const stats = await statsFor(db, event.id);
      return [
        `${event.emoji} *${event.name}*`,
        `${formatDate(event.starts_on)}${event.venue ? ` · ${event.venue}` : ''}${
          countdown(event.starts_on) ? ` · ${countdown(event.starts_on)}` : ''
        }`,
        `${stats.readiness}% ready · ${formatMoney(stats.fundRaised, sender.currency)} raised`,
      ].join('\n');
    }),
  );

  return `*Coming up*\n\n${lines.join('\n\n')}\n\n${appLink(sender, '/events')}`;
}

async function handleFund(db: Db, sender: Sender): Promise<string> {
  const event = await nextEvent(db, sender);
  if (!event) return 'No event is collecting contributions right now.';

  const stats = await statsFor(db, event.id);
  const funded = fundedPercent(stats.fundRaised, stats.fundTarget);

  return [
    `${event.emoji} *${event.name}*`,
    '',
    `Raised: *${formatMoney(stats.fundRaised, sender.currency)}* of ${formatMoney(stats.fundTarget, sender.currency)} (${funded}%)`,
    `Spent: ${formatMoney(stats.spent, sender.currency)}`,
    `Available: ${formatMoney(stats.available, sender.currency)}`,
    `${stats.contributors} households have contributed.`,
    '',
    `Full ledger, with every bill: ${appLink(sender, `/events/${event.slug}?tab=money`)}`,
  ].join('\n');
}

/**
 * Contributing means money, so the bot hands over a link rather than taking
 * the instruction itself. A mistyped amount in a chat window is not a good
 * place to move rupees.
 */
async function handleContribute(db: Db, sender: Sender, amount: number | null): Promise<string> {
  const event = await nextEvent(db, sender);
  if (!event) return 'No event is collecting contributions right now.';

  const link = appLink(
    sender,
    `/events/${event.slug}/contribute${amount ? `?amount=${amount}` : ''}`,
  );

  return [
    amount
      ? `To contribute *${formatMoney(amount, sender.currency)}* to ${event.name}:`
      : `To contribute to *${event.name}*:`,
    link,
    '',
    'You’ll confirm the amount and payment method there.',
  ].join('\n');
}

async function handleNotices(db: Db, sender: Sender): Promise<string> {
  const now = new Date().toISOString();
  const { data } = await db
    .from('announcements')
    .select('title, body, published_at')
    .eq('community_id', sender.communityId)
    .lte('published_at', now)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order('is_pinned', { ascending: false })
    .order('published_at', { ascending: false })
    .limit(3);

  if (!data?.length) return 'No notices right now.';

  return data
    .map(
      (notice) =>
        `*${notice.title}*\n${notice.body.slice(0, 400)}\n_${relativeTime(notice.published_at)}_`,
    )
    .join('\n\n');
}

async function handleActivities(db: Db, sender: Sender): Promise<string> {
  const event = await nextEvent(db, sender);
  if (!event) return 'Nothing to sign up for just now.';

  const [{ data: activities }, { data: stats }] = await Promise.all([
    db
      .from('event_activities')
      .select('id, name, emoji')
      .eq('event_id', event.id)
      .eq('is_open', true)
      .order('position')
      .limit(8),
    db.from('activity_stats').select('activity_id, interested').eq('event_id', event.id),
  ]);

  if (!activities?.length) return `No performances are open for ${event.name} yet.`;

  const counts = new Map((stats ?? []).map((row) => [row.activity_id, row.interested ?? 0]));

  return [
    `*${event.name}* — you can perform in:`,
    '',
    ...activities.map(
      (activity) =>
        `${activity.emoji} *${activity.name}* — ${counts.get(activity.id) ?? 0} interested`,
    ),
    '',
    `Sign up: ${appLink(sender, `/events/${event.slug}?tab=activities`)}`,
  ].join('\n');
}

async function handleVolunteer(db: Db, sender: Sender): Promise<string> {
  const event = await nextEvent(db, sender);
  if (!event) return 'Nothing needs hands just now.';

  const { data } = await db
    .from('volunteer_role_stats')
    .select('role_id, still_needed')
    .eq('event_id', event.id)
    .gt('still_needed', 0);

  if (!data?.length) return `Every role for ${event.name} is fully staffed. Thank you!`;

  const { data: roles } = await db
    .from('volunteer_roles')
    .select('id, name, emoji')
    .in(
      'id',
      data.map((row) => row.role_id).filter((id): id is string => Boolean(id)),
    );

  const needed = new Map(data.map((row) => [row.role_id, row.still_needed ?? 0]));

  return [
    `*${event.name}* still needs help with:`,
    '',
    ...(roles ?? []).map(
      (role) => `${role.emoji} *${role.name}* — ${needed.get(role.id) ?? 0} more needed`,
    ),
    '',
    `Sign up: ${appLink(sender, `/events/${event.slug}#volunteer`)}`,
  ].join('\n');
}

async function handleTasks(db: Db, sender: Sender): Promise<string> {
  const { data } = await db
    .from('event_tasks')
    .select('name, status, due_on, events(name)')
    .eq('community_id', sender.communityId)
    .eq('assignee_id', sender.membershipId)
    .neq('status', 'done')
    .order('due_on', { nullsFirst: false })
    .limit(6);

  if (!data?.length) return 'Nothing is assigned to you right now.';

  return [
    '*Assigned to you*',
    '',
    ...data.map(
      (task) =>
        `${TASK_STATUS_DOT[task.status]} ${task.name}` +
        `${task.events?.name ? `\n_${task.events.name}` : ''}` +
        `${task.due_on ? ` · due ${formatDate(task.due_on)}` : ''}${task.events?.name ? '_' : ''}`,
    ),
  ].join('\n');
}

async function handleSuggest(db: Db, sender: Sender, text: string): Promise<string> {
  const name = text.split('\n')[0]!.slice(0, 120);

  const { error } = await db.from('activity_suggestions').insert({
    community_id: sender.communityId,
    name,
    description: text.length > name.length ? text : null,
    suggested_by: sender.membershipId,
    status: 'new',
  });

  if (error) return 'I couldn’t send that just now. Please try again.';

  return `Sent to the committee: *${name}*\n\nThanks for the idea. Your neighbours can back it in the app.`;
}

async function handleStop(db: Db, phone: string): Promise<string> {
  await db
    .from('whatsapp_links')
    .update({ opted_out_at: new Date().toISOString() })
    .eq('phone', phone);

  return 'Done. I won’t message this number again. Send *start* to turn it back on.';
}

/**
 * Decides the reply for one inbound message. Pure dispatch: the caller owns
 * logging and sending.
 */
export async function replyTo(db: Db, message: InboundMessage): Promise<string> {
  const command: WhatsAppCommand = parseCommand(message.text);
  const phone = message.from;

  // Linking and opting out are the only things an unlinked number may do.
  if (command.kind === 'link') return handleLink(db, phone, command.code);
  if (command.kind === 'stop') return handleStop(db, phone);

  const sender = await resolveSender(db, phone);
  if (!sender) return NOT_LINKED_TEXT;

  switch (command.kind) {
    case 'help':
    case 'empty':
      return HELP_TEXT;
    case 'events':
      return handleEvents(db, sender);
    case 'fund':
      return handleFund(db, sender);
    case 'contribute':
      return handleContribute(db, sender, command.amount);
    case 'notices':
      return handleNotices(db, sender);
    case 'activities':
      return handleActivities(db, sender);
    case 'volunteer':
      return handleVolunteer(db, sender);
    case 'tasks':
      return handleTasks(db, sender);
    case 'suggest':
      return handleSuggest(db, sender, command.text);
    default:
      return UNKNOWN_TEXT;
  }
}

export { resolveSender };
