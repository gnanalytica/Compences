import type { ZodError } from 'zod';
import {
  contributeSchema,
  createActivitySchema,
  createAnnouncementSchema,
  createEventSchema,
  createExpenseSchema,
  createTaskSchema,
  normalizeStats,
  suggestActivitySchema,
  updateTaskSchema,
} from '@compences/core';
import type { ApiPrincipal } from './auth';

/**
 * Every query the public API makes, in one file.
 *
 * The rule this module exists to enforce: **an API-key principal runs with the
 * service role, which bypasses row-level security.** Its community boundary is
 * therefore only as good as the `.eq('community_id', …)` on each query. Rather
 * than trust each route handler to remember, all of them live here and every
 * one applies the filter — including for user principals, where it is
 * redundant but harmless.
 *
 * If you add a query, add it here, and filter by `principal.communityId`.
 */

/**
 * Explicitly discriminated on `ok`. Returning bare `{ error }` / `{ data }`
 * object literals looks tidier but TypeScript merges them into one shape with
 * both keys optional, and `'error' in result` then narrows nothing.
 */
export type Outcome<T> =
  | { ok: true; data: T }
  | { ok: false; reason: 'invalid'; error: ZodError }
  | { ok: false; reason: 'not_found' };

const invalid = (error: ZodError): Outcome<never> => ({ ok: false, reason: 'invalid', error });
const notFound = (): Outcome<never> => ({ ok: false, reason: 'not_found' });

const withCommunity = (principal: ApiPrincipal) => principal.communityId;

// Single string literals: supabase-js infers the row type from the select
// text, and `+` concatenation widens it to `string`, collapsing the result.
const EVENT_FIELDS =
  'id, slug, emoji, name, starts_on, ends_on, venue, organizer, description, status, fund_target, suggested_amount, fund_rule, fund_rule_note, published_at, closed_at';

export async function whoami(principal: ApiPrincipal) {
  const { data: community } = await principal.db
    .from('communities')
    .select('id, name, slug, city, timezone, currency')
    .eq('id', withCommunity(principal))
    .maybeSingle();

  return {
    kind: principal.kind,
    community,
    role: principal.role,
    scopes: principal.scopes,
  };
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export async function listEvents(
  principal: ApiPrincipal,
  options: { limit: number; status?: string | null },
) {
  let query = principal.db
    .from('events')
    .select(EVENT_FIELDS)
    .eq('community_id', withCommunity(principal))
    .order('starts_on', { ascending: false })
    .limit(options.limit);

  const statuses = (options.status ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter((part): part is 'draft' | 'published' | 'completed' | 'cancelled' =>
      ['draft', 'published', 'completed', 'cancelled'].includes(part),
    );
  if (statuses.length > 0) query = query.in('status', statuses);

  const { data, error } = await query;
  if (error) throw error;

  // The derived numbers are what an agent actually wants; fetching them
  // separately would make every caller do the join by hand.
  const stats = await statsFor(
    principal,
    (data ?? []).map((event) => event.id),
  );
  return (data ?? []).map((event) => ({ ...event, stats: stats.get(event.id) ?? null }));
}

async function statsFor(principal: ApiPrincipal, eventIds: string[]) {
  if (eventIds.length === 0) return new Map<string, ReturnType<typeof normalizeStats>>();
  const { data } = await principal.db
    .from('event_stats')
    .select('*')
    .eq('community_id', withCommunity(principal))
    .in('event_id', eventIds);
  const map = new Map<string, ReturnType<typeof normalizeStats>>();
  for (const row of data ?? []) if (row.event_id) map.set(row.event_id, normalizeStats(row));
  return map;
}

export async function getEvent(principal: ApiPrincipal, slugOrId: string) {
  const isUuid = /^[0-9a-f-]{36}$/i.test(slugOrId);
  const { data, error } = await principal.db
    .from('events')
    .select(EVENT_FIELDS)
    .eq('community_id', withCommunity(principal))
    .eq(isUuid ? 'id' : 'slug', slugOrId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const stats = await statsFor(principal, [data.id]);
  return { ...data, stats: stats.get(data.id) ?? null };
}

export async function createEvent(
  principal: ApiPrincipal,
  body: unknown,
): Promise<Outcome<unknown>> {
  const parsed = createEventSchema.safeParse({
    ...(body as Record<string, unknown>),
    community_id: withCommunity(principal),
  });
  if (!parsed.success) return invalid(parsed.error);

  const { data, error } = await principal.db
    .from('events')
    // Always a draft. Publishing is an admin decision made in the app, not
    // something an integration should be able to do in one call.
    .insert({ ...parsed.data, status: 'draft', created_by: principal.userId })
    .select(EVENT_FIELDS)
    .single();

  if (error) throw error;
  return { ok: true as const, data };
}

// ---------------------------------------------------------------------------
// Checklist
// ---------------------------------------------------------------------------

export async function listTasks(principal: ApiPrincipal, eventId: string) {
  const { data, error } = await principal.db
    .from('event_tasks')
    .select(
      'id, name, notes, status, due_on, completed_at, memberships!event_tasks_assignee_id_fkey(profiles(full_name))',
    )
    .eq('community_id', withCommunity(principal))
    .eq('event_id', eventId)
    .order('position');

  if (error) throw error;
  return data;
}

export async function createTask(
  principal: ApiPrincipal,
  eventId: string,
  body: unknown,
): Promise<Outcome<unknown>> {
  const event = await getEvent(principal, eventId);
  if (!event) return notFound();

  const parsed = createTaskSchema.safeParse({
    ...(body as Record<string, unknown>),
    event_id: event.id,
  });
  if (!parsed.success) return invalid(parsed.error);

  const { data, error } = await principal.db
    .from('event_tasks')
    .insert({ ...parsed.data, community_id: withCommunity(principal) })
    .select('id, name, status, due_on')
    .single();

  if (error) throw error;
  return { ok: true as const, data };
}

export async function updateTask(
  principal: ApiPrincipal,
  taskId: string,
  body: unknown,
): Promise<Outcome<unknown>> {
  const parsed = updateTaskSchema.safeParse({ ...(body as Record<string, unknown>), id: taskId });
  if (!parsed.success) return invalid(parsed.error);

  const { id: _id, ...changes } = parsed.data;
  const { data, error } = await principal.db
    .from('event_tasks')
    .update(changes)
    .eq('id', taskId)
    .eq('community_id', withCommunity(principal))
    .select('id, name, status, due_on, completed_at')
    .maybeSingle();

  if (error) throw error;
  return data ? { ok: true as const, data } : notFound();
}

// ---------------------------------------------------------------------------
// Fund
// ---------------------------------------------------------------------------

export async function getLedger(principal: ApiPrincipal, eventId: string) {
  const event = await getEvent(principal, eventId);
  if (!event) return null;

  const [expenses, moved] = await Promise.all([
    principal.db
      .from('expenses')
      .select(
        'id, name, category, amount, vendor, paid_by, method, status, bill_url, spent_on, requester:memberships!expenses_requested_by_fkey(profiles(full_name)), approver:memberships!expenses_approved_by_fkey(profiles(full_name))',
      )
      .eq('community_id', withCommunity(principal))
      .eq('event_id', event.id)
      .order('spent_on', { ascending: false }),
    // Money the committee moved into the event (a closed event's leftover,
    // the society balance, an overspend paid back) or out of it when it
    // closed. With these the ledger adds up to what the event holds.
    principal.db
      .from('fund_movements')
      .select(
        'id, kind, amount, note, decided_at, paid_to, from_event_id, to_event_id, from_event:events!fund_movements_from_event_id_fkey(slug, name), to_event:events!fund_movements_to_event_id_fkey(slug, name)',
      )
      .eq('community_id', withCommunity(principal))
      .or(`from_event_id.eq.${event.id},to_event_id.eq.${event.id}`)
      .order('decided_at', { ascending: false }),
  ]);

  if (expenses.error) throw expenses.error;
  if (moved.error) throw moved.error;
  return {
    event: { id: event.id, slug: event.slug, name: event.name },
    stats: event.stats,
    expenses: expenses.data,
    movements: (moved.data ?? []).map(({ from_event_id: _from, to_event_id, ...movement }) => ({
      ...movement,
      direction: to_event_id === event.id ? ('in' as const) : ('out' as const),
    })),
  };
}

export async function createExpense(
  principal: ApiPrincipal,
  body: unknown,
): Promise<Outcome<unknown>> {
  const raw = body as Record<string, unknown>;
  const event = await getEvent(principal, String(raw.event_id ?? ''));
  if (!event) return notFound();

  const parsed = createExpenseSchema.safeParse({ ...raw, event_id: event.id });
  if (!parsed.success) return invalid(parsed.error);

  const { data, error } = await principal.db
    .from('expenses')
    .insert({
      ...parsed.data,
      community_id: withCommunity(principal),
      requested_by: principal.membershipId,
      // Always pending. Approval goes through review_expense, which refuses
      // self-approval — an integration cannot bypass that by asking nicely.
      status: 'pending',
    })
    .select('id, name, amount, vendor, status')
    .single();

  if (error) throw error;
  return { ok: true as const, data };
}

export async function contribute(
  principal: ApiPrincipal,
  body: unknown,
): Promise<Outcome<unknown>> {
  const raw = body as Record<string, unknown>;
  const event = await getEvent(principal, String(raw.event_id ?? ''));
  if (!event) return notFound();

  const parsed = contributeSchema.safeParse({ ...raw, event_id: event.id, channel: 'api' });
  if (!parsed.success) return invalid(parsed.error);

  const { data, error } = await principal.db
    .from('contributions')
    .insert({
      event_id: event.id,
      community_id: withCommunity(principal),
      membership_id: principal.membershipId,
      amount: parsed.data.amount,
      method: parsed.data.method,
      // A payment reported through an integration waits for staff to confirm
      // it against the bank statement, like one reported in the app.
      status: 'pending',
      channel: 'api',
    })
    .select('id, amount, status, receipt_no, paid_at')
    .single();

  if (error) throw error;
  return { ok: true as const, data };
}

// ---------------------------------------------------------------------------
// Taking part
// ---------------------------------------------------------------------------

export async function listActivities(principal: ApiPrincipal, eventId: string) {
  const event = await getEvent(principal, eventId);
  if (!event) return null;

  const [activities, stats] = await Promise.all([
    principal.db
      .from('event_activities')
      .select('id, name, emoji, description, capacity, is_open, practice_dates')
      .eq('community_id', withCommunity(principal))
      .eq('event_id', event.id)
      .order('position'),
    principal.db
      .from('activity_stats')
      .select('activity_id, interested')
      .eq('community_id', withCommunity(principal))
      .eq('event_id', event.id),
  ]);

  const counts = new Map((stats.data ?? []).map((row) => [row.activity_id, row.interested ?? 0]));
  return (activities.data ?? []).map((activity) => ({
    ...activity,
    interested: counts.get(activity.id) ?? 0,
  }));
}

export async function createActivity(
  principal: ApiPrincipal,
  body: unknown,
): Promise<Outcome<unknown>> {
  const raw = body as Record<string, unknown>;
  const event = await getEvent(principal, String(raw.event_id ?? ''));
  if (!event) return notFound();

  const parsed = createActivitySchema.safeParse({ ...raw, event_id: event.id });
  if (!parsed.success) return invalid(parsed.error);

  const { data, error } = await principal.db
    .from('event_activities')
    .insert({ ...parsed.data, community_id: withCommunity(principal) })
    .select('id, name, emoji, description')
    .single();

  if (error) throw error;
  return { ok: true as const, data };
}

export async function listVolunteerRoles(principal: ApiPrincipal, eventId: string) {
  const event = await getEvent(principal, eventId);
  if (!event) return null;

  const { data, error } = await principal.db
    .from('volunteer_role_stats')
    .select('role_id, target_count, signed_up, still_needed')
    .eq('community_id', withCommunity(principal))
    .eq('event_id', event.id);

  if (error) throw error;

  const { data: roles } = await principal.db
    .from('volunteer_roles')
    .select('id, name, emoji, description, target_count')
    .eq('community_id', withCommunity(principal))
    .eq('event_id', event.id)
    .order('position');

  const counts = new Map((data ?? []).map((row) => [row.role_id, row]));
  return (roles ?? []).map((role) => ({
    ...role,
    signed_up: counts.get(role.id)?.signed_up ?? 0,
    still_needed: counts.get(role.id)?.still_needed ?? role.target_count,
  }));
}

// ---------------------------------------------------------------------------
// Community voice
// ---------------------------------------------------------------------------

export async function listAnnouncements(principal: ApiPrincipal, limit: number) {
  const now = new Date().toISOString();
  const { data, error } = await principal.db
    .from('announcements')
    .select('id, title, body, audience, is_pinned, published_at, expires_at, event_id')
    .eq('community_id', withCommunity(principal))
    .lte('published_at', now)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order('is_pinned', { ascending: false })
    .order('published_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}

export async function createAnnouncement(
  principal: ApiPrincipal,
  body: unknown,
): Promise<Outcome<unknown>> {
  const parsed = createAnnouncementSchema.safeParse({
    ...(body as Record<string, unknown>),
    community_id: withCommunity(principal),
  });
  if (!parsed.success) return invalid(parsed.error);

  const { data, error } = await principal.db
    .from('announcements')
    .insert({ ...parsed.data, author_id: principal.membershipId })
    .select('id, title, body, audience, is_pinned, published_at')
    .single();

  if (error) throw error;
  return { ok: true as const, data };
}

export async function suggestActivity(
  principal: ApiPrincipal,
  body: unknown,
): Promise<Outcome<unknown>> {
  const parsed = suggestActivitySchema.safeParse({
    ...(body as Record<string, unknown>),
    community_id: withCommunity(principal),
  });
  if (!parsed.success) return invalid(parsed.error);

  const { data, error } = await principal.db
    .from('activity_suggestions')
    .insert({ ...parsed.data, suggested_by: principal.membershipId, status: 'new' })
    .select('id, name, description, status')
    .single();

  if (error) throw error;
  return { ok: true as const, data };
}

export async function listPolls(principal: ApiPrincipal, limit: number) {
  const { data: polls, error } = await principal.db
    .from('polls')
    .select('id, question, detail, status, closes_at, event_id')
    .eq('community_id', withCommunity(principal))
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  if (!polls?.length) return [];

  const { data: results } = await principal.db
    .from('poll_results')
    .select('poll_id, option_id, label, emoji, votes, total_votes')
    .in(
      'poll_id',
      polls.map((poll) => poll.id),
    );

  return polls.map((poll) => ({
    ...poll,
    options: (results ?? []).filter((row) => row.poll_id === poll.id),
  }));
}

export async function listMembers(principal: ApiPrincipal, limit: number) {
  const { data, error } = await principal.db
    .from('memberships')
    .select('id, role, status, joined_at, profiles(full_name)')
    .eq('community_id', withCommunity(principal))
    .eq('status', 'active')
    .order('joined_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}
