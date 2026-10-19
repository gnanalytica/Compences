import { cache } from 'react';
import { notFound } from 'next/navigation';
import { budgetLineLabel, festivalFor, normalizeStats, overLineBy } from '@compences/core';
import { getCatalogue } from './catalogue';
import { getSupabase } from './supabase/server';
import { rowsOf } from './rows';

/**
 * Event reads shared by several pages.
 *
 * Every query is scoped by RLS, so a resident asking for an event they have no
 * business seeing gets nothing back rather than an error — which is why the
 * loaders below treat "no row" as a 404.
 *
 * Wrapped in React's `cache()` so a page that asks for the same event in the
 * header and the body makes one round trip.
 */

// Written as single string literals: supabase-js infers the row type from the
// select text, and concatenating with `+` widens it to `string`, which
// collapses the result to an error type.
const EVENT_FIELDS =
  'id, slug, emoji, name, kind, starts_on, ends_on, venue, venue_id, event_type_id, organizer, description, status, expected_attendance, fund_target, suggested_amount, fund_rule, fund_rule_note, whatsapp_group_url, published_at, closed_at, closing_summary, created_by, created_at';

export const getEvent = cache(async (communityId: string, slug: string) => {
  const supabase = await getSupabase();
  const { data } = await supabase
    .from('events')
    .select(EVENT_FIELDS)
    .eq('community_id', communityId)
    .eq('slug', slug)
    .maybeSingle();
  return data;
});

export async function requireEvent(communityId: string, slug: string) {
  const event = await getEvent(communityId, slug);
  if (!event) notFound();
  return event;
}

/** The derived numbers every event screen shows, with nulls filled in. */
export const getEventStats = cache(async (eventId: string) => {
  const supabase = await getSupabase();
  const { data } = await supabase
    .from('event_stats')
    .select('*')
    .eq('event_id', eventId)
    .maybeSingle();
  return normalizeStats(data);
});

export const listEvents = cache(async (communityId: string) => {
  const supabase = await getSupabase();
  const { data } = await supabase
    .from('events')
    .select(EVENT_FIELDS)
    .eq('community_id', communityId)
    .order('starts_on', { ascending: false })
    .limit(100);
  return data ?? [];
});

/**
 * What the society is heading towards: the next published event — the soonest
 * still to come, else any — and the look it wears. The app's shell takes that
 * look, so opening the app in October looks like October, and the home page
 * leads with the event.
 */
export const getSeason = cache(async (communityId: string, today: string) => {
  const published = (await listEvents(communityId)).filter((event) => event.status === 'published');
  const next =
    published
      .filter((event) => event.kind === 'event' && event.starts_on >= today)
      .sort((a, b) => a.starts_on.localeCompare(b.starts_on))[0] ??
    published.find((event) => event.kind === 'event') ??
    published[0] ??
    null;
  const type = next?.event_type_id
    ? (await getCatalogue(communityId)).event_type.find((item) => item.id === next.event_type_id)
    : undefined;
  return { next, published, festival: festivalFor(type?.label, next?.name) };
});

/** Stats for a list of events in one round trip, keyed by event id. */
export const getStatsFor = cache(async (eventIds: string[]) => {
  if (eventIds.length === 0) return new Map<string, ReturnType<typeof normalizeStats>>();
  const supabase = await getSupabase();
  const { data } = await supabase.from('event_stats').select('*').in('event_id', eventIds);
  const map = new Map<string, ReturnType<typeof normalizeStats>>();
  for (const row of data ?? []) {
    if (row.event_id) map.set(row.event_id, normalizeStats(row));
  }
  return map;
});

export const getTasks = cache(async (eventId: string) => {
  const supabase = await getSupabase();
  const { data } = await supabase
    .from('event_tasks')
    .select(
      'id, name, notes, status, due_on, position, completed_at, memberships!event_tasks_assignee_id_fkey(profiles(full_name))',
    )
    .eq('event_id', eventId)
    .order('position')
    .order('created_at');
  return data ?? [];
});

export const getActivities = cache(async (eventId: string) => {
  const supabase = await getSupabase();
  const [activities, stats] = await Promise.all([
    supabase
      .from('event_activities')
      .select(
        'id, name, emoji, description, capacity, is_open, practice_dates, coordinator_id, memberships!event_activities_coordinator_id_fkey(profiles(full_name))',
      )
      .eq('event_id', eventId)
      .order('position')
      .order('name'),
    supabase.from('activity_stats').select('activity_id, interested').eq('event_id', eventId),
  ]);

  const counts = new Map((stats.data ?? []).map((row) => [row.activity_id, row.interested ?? 0]));
  return rowsOf(activities, "an event's activities").map((activity) => ({
    ...activity,
    interested: counts.get(activity.id) ?? 0,
  }));
});

export const getVolunteerRoles = cache(async (eventId: string) => {
  const supabase = await getSupabase();
  const [roles, stats] = await Promise.all([
    supabase
      .from('volunteer_roles')
      .select(
        'id, name, emoji, description, target_count, memberships!volunteer_roles_coordinator_id_fkey(profiles(full_name))',
      )
      .eq('event_id', eventId)
      .order('position')
      .order('name'),
    supabase
      .from('volunteer_role_stats')
      .select('role_id, signed_up, still_needed')
      .eq('event_id', eventId),
  ]);

  const counts = new Map((stats.data ?? []).map((row) => [row.role_id, row]));
  return rowsOf(roles, "an event's volunteer roles").map((role) => ({
    ...role,
    signedUp: counts.get(role.id)?.signed_up ?? 0,
    stillNeeded: counts.get(role.id)?.still_needed ?? role.target_count,
  }));
});

/**
 * The ledger. RLS decides what comes back: a resident sees approved spending
 * only, the committee sees everything including what is still under review.
 */
export const getExpenses = cache(async (eventId: string) => {
  const supabase = await getSupabase();
  const { data } = await supabase
    .from('expenses')
    .select(
      'id, name, category, category_id, budget_line_id, amount, vendor, vendor_id, paid_by, method, status, bill_url, spent_on, review_note, created_at, approved_at, updated_at, requested_by, revised_by, revised_at, requester:memberships!expenses_requested_by_fkey(profiles(full_name)), approver:memberships!expenses_approved_by_fkey(profiles(full_name)), editor:memberships!expenses_updated_by_fkey(profiles(full_name)), reviser:memberships!expenses_revised_by_fkey(profiles(full_name))',
    )
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });
  return data ?? [];
});

/**
 * How many people can approve a bill or confirm somebody else's payment.
 *
 * One is the case every separation-of-duties rule has to answer for: the
 * database lets the sole committee member sign off their own, so the screens
 * must not tell them somebody else will.
 */
export const getCommitteeCount = cache(async (communityId: string) => {
  const supabase = await getSupabase();
  const { count } = await supabase
    .from('memberships')
    .select('id', { count: 'exact', head: true })
    .eq('community_id', communityId)
    .eq('role', 'committee')
    .eq('status', 'active');
  return count ?? 0;
});

/**
 * What the society is holding that is not assigned to any event, and how it
 * got there.
 *
 * A society that has never closed an event with money left has no row in the
 * view, which reads as zero rather than as an error.
 */
export const getSocietyBalance = cache(async (communityId: string) => {
  const supabase = await getSupabase();
  const { data } = await supabase
    .from('society_balance')
    .select('balance, movements_in, last_decided_at')
    .eq('community_id', communityId)
    .maybeSingle();
  return {
    balance: Number(data?.balance ?? 0),
    movements: data?.movements_in ?? 0,
    lastDecidedAt: data?.last_decided_at ?? null,
  };
});

/** Every decision the committee made about a surplus, newest first. */
export const getFundMovements = cache(async (communityId: string) => {
  const supabase = await getSupabase();
  const { data } = await supabase
    .from('fund_movements')
    .select(
      'id, kind, amount, note, decided_at, paid_to, proof_path, from_event:events!fund_movements_from_event_id_fkey(name, slug), to_event:events!fund_movements_to_event_id_fkey(name, slug), decider:memberships!fund_movements_decided_by_fkey(profiles(full_name))',
    )
    .eq('community_id', communityId)
    .order('decided_at', { ascending: false })
    .limit(100);
  return data ?? [];
});

/**
 * Every sum carried into one event, oldest first, with where it came from and
 * the committee member who moved it: the event names them beside its fund, as
 * the Money page does in its history.
 */
export const getCarriedInto = cache(async (eventId: string) => {
  const supabase = await getSupabase();
  const { data } = await supabase
    .from('fund_movements')
    .select(
      'id, kind, amount, decided_at, paid_to, proof_path, from_event:events!fund_movements_from_event_id_fkey(name), decider:memberships!fund_movements_decided_by_fkey(profiles(full_name))',
    )
    .eq('to_event_id', eventId)
    .order('decided_at', { ascending: true });
  return data ?? [];
});

/**
 * What one event handed on after it closed — kept for the society or carried
 * to another event — newest first, with who decided it: the closed event's
 * own record of where its leftover went.
 */
export const getMovedFrom = cache(async (eventId: string) => {
  const supabase = await getSupabase();
  const { data } = await supabase
    .from('fund_movements')
    .select(
      'id, kind, amount, note, decided_at, to_event:events!fund_movements_to_event_id_fkey(name, slug), decider:memberships!fund_movements_decided_by_fkey(profiles(full_name))',
    )
    .eq('from_event_id', eventId)
    .order('decided_at', { ascending: false });
  return data ?? [];
});

/** Events a surplus can be carried into: still open, and not the one it came from. */
export const getOpenEvents = cache(async (communityId: string, exceptId: string) => {
  const supabase = await getSupabase();
  const { data } = await supabase
    .from('events')
    .select('id, name, emoji, starts_on, status')
    .eq('community_id', communityId)
    .in('status', ['draft', 'published'])
    .neq('id', exceptId)
    .order('starts_on', { ascending: true })
    .limit(100);
  return data ?? [];
});

/** What the signed-in member has personally done for this event. */
export const getMyParticipation = cache(async (eventId: string, membershipId: string | null) => {
  if (!membershipId) return { activities: [], roles: [], contributed: 0 };
  const supabase = await getSupabase();

  const [activities, volunteers, contributions] = await Promise.all([
    supabase
      .from('activity_participants')
      .select('activity_id, event_activities!inner(event_id)')
      .eq('membership_id', membershipId)
      .eq('event_activities.event_id', eventId),
    supabase
      .from('event_volunteers')
      .select('role_id, volunteer_roles!inner(event_id)')
      .eq('membership_id', membershipId)
      .eq('volunteer_roles.event_id', eventId),
    supabase
      .from('contributions')
      .select('amount')
      .eq('membership_id', membershipId)
      .eq('event_id', eventId)
      .eq('status', 'succeeded'),
  ]);

  return {
    activities: (activities.data ?? []).map((row) => row.activity_id),
    roles: (volunteers.data ?? []).map((row) => row.role_id),
    contributed: (contributions.data ?? []).reduce((sum, row) => sum + Number(row.amount), 0),
  };
});

/**
 * Planned spend for an event, line by line, with what each line has left. Their
 * planned amounts sum to the fund target. `approved`, `pending` and `remaining`
 * come from budget_line_balances: only an approved bill takes anything off a
 * line, and a resident (who cannot see pending bills) always sees `pending` 0.
 */
export const getBudgetLines = cache(async (eventId: string) => {
  const supabase = await getSupabase();
  const [lines, balances] = await Promise.all([
    supabase
      .from('budget_lines')
      .select('id, category, category_id, vendor, vendor_id, amount, notes, position')
      .eq('event_id', eventId)
      .order('position')
      .order('created_at'),
    supabase
      .from('budget_line_balances')
      .select('id, approved, pending, remaining')
      .eq('event_id', eventId),
  ]);
  const byId = new Map((balances.data ?? []).map((row) => [row.id, row]));
  return (lines.data ?? []).map((line) => {
    const balance = byId.get(line.id);
    const planned = Number(line.amount);
    const approved = Number(balance?.approved ?? 0);
    return {
      ...line,
      planned,
      approved,
      pending: Number(balance?.pending ?? 0),
      remaining: balance?.remaining == null ? planned - approved : Number(balance.remaining),
    };
  });
});

/**
 * For bills waiting on the committee, how far approving each would take its
 * budget line below zero. A bill that fits, or has no line, is left out. The
 * view's `remaining` counts approved bills only, so each bill is weighed
 * against what is genuinely left, whatever else is waiting.
 */
export async function getBillOverruns(expenseIds: string[]): Promise<Map<string, number>> {
  const overruns = new Map<string, number>();
  if (!expenseIds.length) return overruns;
  const supabase = await getSupabase();
  const { data: bills } = await supabase
    .from('expenses')
    .select('id, amount, budget_line_id')
    .in('id', expenseIds)
    .not('budget_line_id', 'is', null);
  const lineIds = [...new Set((bills ?? []).map((bill) => bill.budget_line_id!))];
  if (!lineIds.length) return overruns;
  const { data: balances } = await supabase
    .from('budget_line_balances')
    .select('id, remaining')
    .in('id', lineIds);
  const remaining = new Map((balances ?? []).map((row) => [row.id, Number(row.remaining ?? 0)]));
  for (const bill of bills ?? []) {
    const left = remaining.get(bill.budget_line_id!);
    if (left === undefined) continue;
    const over = overLineBy(left, Number(bill.amount));
    if (over > 0) overruns.set(bill.id, over);
  }
  return overruns;
}

/** Normalises a budget or expense category so "Decoration" and "decoration" line up. */
export function categoryKey(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase() || 'other';
}

/**
 * Planned against actually spent, one row per budget line. Only approved
 * expenses count as spent. A bill with no line behind it (one filed before
 * bills drew on a line, or whose line was removed) still appears, grouped by
 * its category and marked as not in the budget.
 */
export function budgetVsSpent(
  lines: { id: string; category: string; vendor?: string | null; amount: number | string }[],
  expenses: {
    budget_line_id?: string | null;
    category: string | null;
    amount: number | string;
    status: string;
  }[],
) {
  const rows = new Map<string, { key: string; label: string; planned: number; spent: number }>();
  for (const line of lines) {
    rows.set(line.id, {
      key: line.id,
      label: budgetLineLabel(line),
      planned: Number(line.amount),
      spent: 0,
    });
  }
  for (const expense of expenses) {
    if (expense.status !== 'approved') continue;
    const line = expense.budget_line_id ? rows.get(expense.budget_line_id) : undefined;
    if (line) {
      line.spent += Number(expense.amount);
      continue;
    }
    const key = `unplanned:${categoryKey(expense.category)}`;
    const row = rows.get(key) ?? {
      key,
      label: expense.category?.trim() || 'Other',
      planned: 0,
      spent: 0,
    };
    row.spent += Number(expense.amount);
    rows.set(key, row);
  }
  return [...rows.values()];
}

/** Who has registered for each activity, and the signed-in member's own registrations. */
export const getRegistrations = cache(async (eventId: string) => {
  const supabase = await getSupabase();
  const { data } = await supabase
    .from('activity_participants')
    .select(
      'id, activity_id, membership_id, participant_name, joined_at, event_activities!inner(event_id), memberships!activity_participants_membership_id_fkey(profiles(full_name))',
    )
    .eq('event_activities.event_id', eventId)
    .order('joined_at');
  return data ?? [];
});

const SUGGESTION_COLUMNS =
  'id, kind, name, description, status, review_note, resolved_at, created_at, suggested_by, memberships!activity_suggestions_suggested_by_fkey(profiles(full_name)), events(slug, name, emoji)';

/**
 * Attaches each suggestion's tally, the caller's own vote, and the ballots the
 * caller is allowed to see by name.
 *
 * Two queries, because they answer to different rules. The totals come from
 * suggestion_stats, a view that counts without handing over the rows it counts;
 * it is the only honest source for "14 against" when the reader may see none of
 * the fourteen. The second reads suggestion_votes, whose policy decides who is
 * named: your own ballot always, every vote in favour to any member, and votes
 * against to the committee. So `ballots` below is already filtered by the
 * database — this function sorts it, it does not censor it.
 */
async function withVotes<T extends { id: string }>(suggestions: T[], membershipId: string | null) {
  const ids = suggestions.map((row) => row.id);
  if (!ids.length) return [];

  const supabase = await getSupabase();
  const [{ data: tallies }, votes] = await Promise.all([
    supabase
      .from('suggestion_stats')
      .select('suggestion_id, votes_for, votes_against')
      .in('suggestion_id', ids),
    supabase
      .from('suggestion_votes')
      .select(
        'suggestion_id, membership_id, support, voted_at, memberships!suggestion_votes_membership_id_fkey(profiles(full_name))',
      )
      .in('suggestion_id', ids)
      .order('voted_at'),
  ]);

  const tallyFor = new Map((tallies ?? []).map((row) => [row.suggestion_id, row]));
  const ballots = rowsOf(votes, 'who voted on a suggestion');

  return suggestions.map((suggestion) => {
    const tally = tallyFor.get(suggestion.id);
    const cast = ballots.filter((vote) => vote.suggestion_id === suggestion.id);
    const ballot = cast.find((vote) => vote.membership_id === membershipId);
    return {
      ...suggestion,
      votesFor: tally?.votes_for ?? 0,
      votesAgainst: tally?.votes_against ?? 0,
      myVote: membershipId === null ? null : (ballot?.support ?? null),
      voters: cast.map((vote) => ({
        membershipId: vote.membership_id,
        name: vote.memberships?.profiles?.full_name ?? 'A resident',
        support: vote.support,
      })),
    };
  });
}

/** One suggestion with its tally — the shape both suggestion boards render. */
export type SuggestionRow = Awaited<ReturnType<typeof getSuggestions>>[number];

/** Suggestions for one event, with their vote tally. */
export const getSuggestions = cache(async (eventId: string, membershipId: string | null) => {
  const supabase = await getSupabase();
  const result = await supabase
    .from('activity_suggestions')
    .select(SUGGESTION_COLUMNS)
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });

  return withVotes(rowsOf(result, 'suggestions for an event'), membershipId);
});

/**
 * Every suggestion in the society, about an event or about nothing in
 * particular. Same three stages either way: a resident suggests, the committee
 * opens it, everybody votes — which is why `event_id is null` was only ever a
 * column and not a second table.
 *
 * It used to filter on that column, so the Ideas page was the society's own
 * suggestions and an event's lived only on its own page. A resident thinking
 * "didn't somebody already suggest that?" does not know which kind theirs was,
 * and a vote they have not cast is a vote either way; the board names the
 * event on each row instead of hiding the row.
 */
export const getIdeas = cache(async (communityId: string, membershipId: string | null) => {
  const supabase = await getSupabase();
  const result = await supabase
    .from('activity_suggestions')
    .select(SUGGESTION_COLUMNS)
    .eq('community_id', communityId)
    .order('created_at', { ascending: false })
    .limit(200);

  return withVotes(rowsOf(result, "the society's suggestions"), membershipId);
});

/**
 * Every payment for an event with the flat and payer. RLS returns all rows to
 * staff and committee, and only the caller's own to a resident.
 */
export const getPayments = cache(async (eventId: string) => {
  const supabase = await getSupabase();
  const { data } = await supabase
    .from('contributions')
    .select(
      'id, amount, reported_amount, method, status, reference, receipt_no, channel, paid_at, proof_path, review_note, verified_at, updated_at, gateway_payload, membership_id, units(block, number), memberships!contributions_membership_id_fkey(profiles(full_name)), verifier:memberships!contributions_verified_by_fkey(profiles(full_name)), editor:memberships!contributions_updated_by_fkey(profiles(full_name))',
    )
    .eq('event_id', eventId)
    .order('paid_at', { ascending: false });
  return data ?? [];
});
