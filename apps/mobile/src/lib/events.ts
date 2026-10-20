import { DEFAULT_FESTIVAL, festivalFor, normalizeStats } from '@compences/core';
import { fetchLineBalances } from '../components/budget-line-ui';
import { today as localToday } from '../components/date-field';
import { supabase } from './supabase';
import { useCommunityData } from './use-community-data';

/**
 * Event reads for the mobile app. Every query goes through row-level security,
 * so a resident, a staff member and the committee each get exactly what the
 * database lets them see: residents never see drafts or other people's
 * proposed campaigns, and only staff and committee see bills under review.
 */

// A single string literal: supabase-js infers the row type from the select
// text, and `+` concatenation widens it to `string`. The type's label comes
// along so an event takes the same festival look as it does on the web, which
// reads the type before the name (festivalFor).
const EVENT_FIELDS =
  'id, slug, emoji, name, starts_on, ends_on, venue, organizer, event_type_id, description, status, kind, fund_target, fund_rule, fund_rule_note, closed_at, created_by, event_type:catalogue_items!event_type_id(label)';

export async function fetchEvents(communityId: string) {
  const { data } = await supabase
    .from('events')
    .select(EVENT_FIELDS)
    .eq('community_id', communityId)
    .order('starts_on', { ascending: true })
    .limit(100);
  return data ?? [];
}

export async function fetchStats(eventIds: string[]) {
  if (eventIds.length === 0) return new Map<string, ReturnType<typeof normalizeStats>>();
  const { data } = await supabase.from('event_stats').select('*').in('event_id', eventIds);
  const map = new Map<string, ReturnType<typeof normalizeStats>>();
  for (const row of data ?? []) if (row.event_id) map.set(row.event_id, normalizeStats(row));
  return map;
}

export async function fetchEventBySlug(communityId: string, slug: string) {
  const { data } = await supabase
    .from('events')
    .select(EVENT_FIELDS)
    .eq('community_id', communityId)
    .eq('slug', slug)
    .maybeSingle();
  return data;
}

export type Tally = { support: number; against: number; mine: boolean | null };

/**
 * suggestion_stats: every ballot counted, none of them named. Nullable because
 * that is how the type generator sees a view's columns, not because a real row
 * is ever missing them.
 */
type VoteTotals = {
  suggestion_id: string | null;
  votes_for: number | null;
  votes_against: number | null;
};
/** suggestion_votes: only the ballots this reader is allowed to see by name. */
type SeenVote = { suggestion_id: string; membership_id: string; support: boolean };

export async function fetchEventDetail(communityId: string, slug: string, membershipId: string) {
  const event = await fetchEventBySlug(communityId, slug);
  if (!event) return null;

  const [
    stats,
    budget,
    expenses,
    activities,
    activityStats,
    registrations,
    suggestions,
    payments,
    eventType,
    carriedIn,
    movedFrom,
  ] = await Promise.all([
    supabase.from('event_stats').select('*').eq('event_id', event.id).maybeSingle(),
    // Each budget line with what it has left; a resident's pending is 0.
    fetchLineBalances(event.id),
    // Residents only ever get approved rows back; that is the public ledger.
    supabase
      .from('expenses')
      .select('id, budget_line_id, name, category, amount, vendor, bill_url, spent_on, status')
      .eq('event_id', event.id)
      .eq('status', 'approved')
      .order('spent_on', { ascending: false }),
    supabase
      .from('event_activities')
      .select(
        'id, name, emoji, description, is_open, capacity, practice_dates, memberships!event_activities_coordinator_id_fkey(profiles(full_name))',
      )
      .eq('event_id', event.id)
      .order('position'),
    supabase.from('activity_stats').select('activity_id, interested').eq('event_id', event.id),
    supabase
      .from('activity_participants')
      .select('id, activity_id, participant_name, event_activities!inner(event_id)')
      .eq('membership_id', membershipId)
      .eq('event_activities.event_id', event.id),
    supabase
      .from('activity_suggestions')
      .select('id, kind, name, description, status, suggested_by, created_at')
      .eq('event_id', event.id)
      .in('status', ['new', 'reviewing', 'accepted'])
      .order('created_at', { ascending: false }),
    // The viewer's own payments for this event, confirmed or not.
    supabase
      .from('contributions')
      .select('id, amount, reported_amount, status, reference, review_note, paid_at')
      .eq('event_id', event.id)
      .eq('membership_id', membershipId)
      .order('paid_at', { ascending: false }),
    event.event_type_id
      ? supabase
          .from('catalogue_items')
          .select('label, emoji')
          .eq('id', event.event_type_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    fetchCarriedInto(event.id),
    fetchMovedFrom(event.id),
  ]);

  const counts = new Map(
    (activityStats.data ?? []).map((row) => [row.activity_id, row.interested ?? 0]),
  );

  return {
    event,
    eventType: eventType.data?.label ?? null,
    stats: normalizeStats(stats.data),
    lines: budget,
    expenses: expenses.data ?? [],
    activities: (activities.data ?? []).map((activity) => ({
      ...activity,
      registered: counts.get(activity.id) ?? 0,
    })),
    registrations: registrations.data ?? [],
    myPayments: payments.data ?? [],
    // Every sum the committee moved behind this event, and who moved it.
    carriedIn,
    // And what the event handed on when it closed: kept for the society, or
    // carried to another event.
    movedFrom,
    // Residents see suggestions open for voting, plus their own awaiting the
    // committee. Staff and committee see everything still in play.
    suggestions: await withTallies(suggestions.data ?? [], membershipId),
  };
}

/**
 * Attaches each suggestion's vote tally, and the reader's own ballot.
 *
 * Counting the rows suggestion_votes hands back would under-count, because it
 * hands back only what this reader may see by name: their own ballot, every
 * vote in favour, and — for the committee — the votes against. The totals come
 * from suggestion_stats, which counts every ballot without naming any of them.
 *
 * Shared by the event screen and the Ideas screen, because two copies of this
 * would be two different answers to "how many voted for it".
 */
export async function withTallies<T extends { id: string }>(rows: T[], membershipId: string) {
  const ids = rows.map((row) => row.id);
  const [voteTotals, votes] = ids.length
    ? await Promise.all([
        supabase
          .from('suggestion_stats')
          .select('suggestion_id, votes_for, votes_against')
          .in('suggestion_id', ids),
        supabase
          .from('suggestion_votes')
          .select('suggestion_id, membership_id, support')
          .in('suggestion_id', ids),
      ])
    : [{ data: [] as VoteTotals[] }, { data: [] as SeenVote[] }];

  const tallies = new Map<string, Tally>();
  for (const row of voteTotals.data ?? []) {
    // A view's columns are all nullable to the type generator; a row without a
    // suggestion cannot be matched to one either way.
    if (!row.suggestion_id) continue;
    tallies.set(row.suggestion_id, {
      support: row.votes_for ?? 0,
      against: row.votes_against ?? 0,
      mine: null,
    });
  }
  for (const vote of votes.data ?? []) {
    if (vote.membership_id !== membershipId) continue;
    const tally = tallies.get(vote.suggestion_id) ?? { support: 0, against: 0, mine: null };
    tally.mine = vote.support;
    tallies.set(vote.suggestion_id, tally);
  }

  return rows.map((row) => ({
    ...row,
    tally: tallies.get(row.id) ?? { support: 0, against: 0, mine: null },
  }));
}

/**
 * Every suggestion still in play across the society — the ones about an event
 * and the ones about nothing in particular, in one list.
 *
 * The split exists in the database because an event's suggestions belong to
 * that event's page, but a resident thinking "didn't someone suggest that?"
 * does not know or care which kind theirs was. So this screen asks for both
 * and says which event each one belongs to.
 */
export async function fetchIdeas(communityId: string, membershipId: string) {
  const { data } = await supabase
    .from('activity_suggestions')
    .select(
      'id, kind, name, description, status, suggested_by, created_at, event_id, events(slug, name, emoji)',
    )
    .eq('community_id', communityId)
    .in('status', ['new', 'reviewing', 'accepted'])
    .order('created_at', { ascending: false })
    .limit(100);

  return withTallies(data ?? [], membershipId);
}

/** The soonest published event that has not happened yet. */
export function pickNextEvent<T extends { status: string; starts_on: string }>(events: T[]) {
  const today = localToday();
  const published = events.filter((event) => event.status === 'published');
  return (
    published
      .filter((event) => event.starts_on >= today)
      .sort((a, b) => a.starts_on.localeCompare(b.starts_on))[0] ?? published[0]
  );
}

/** A URL-safe slug that is unlikely to collide with another event's. */
export function makeSlug(name: string) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base || 'campaign'}-${suffix}`;
}

/**
 * Every sum carried into one event, oldest first, with where it came from and
 * the committee member who moved it — the same rows the web event page names.
 */
export async function fetchCarriedInto(eventId: string) {
  const { data } = await supabase
    .from('fund_movements')
    .select(
      'id, kind, amount, decided_at, paid_to, proof_path, from_event:events!fund_movements_from_event_id_fkey(name), decider:memberships!fund_movements_decided_by_fkey(profiles(full_name))',
    )
    .eq('to_event_id', eventId)
    .order('decided_at', { ascending: true });
  return data ?? [];
}

/**
 * What one event handed on after it closed, newest first, with where it went
 * and who decided it: the closed event's own record of its leftover.
 */
export async function fetchMovedFrom(eventId: string) {
  const { data } = await supabase
    .from('fund_movements')
    .select(
      'id, kind, amount, note, decided_at, to_event:events!fund_movements_to_event_id_fkey(name, slug), decider:memberships!fund_movements_decided_by_fkey(profiles(full_name))',
    )
    .eq('from_event_id', eventId)
    .order('decided_at', { ascending: false });
  return data ?? [];
}

/**
 * What the society is holding that is not behind any event, and how many
 * decisions put it there.
 *
 * A society that has never closed an event with money left has no row in the
 * view, which reads as zero rather than as an error.
 */
export async function fetchSocietyBalance(communityId: string) {
  const { data } = await supabase
    .from('society_balance')
    .select('balance, movements_in')
    .eq('community_id', communityId)
    .maybeSingle();
  return { balance: Number(data?.balance ?? 0), movements: data?.movements_in ?? 0 };
}

/**
 * The look an event wears (core/festivals.ts): its type first, as the society
 * filed it, then its name.
 */
export function lookOf(event: { name: string; event_type?: { label: string } | null }) {
  return festivalFor(event.event_type?.label, event.name);
}

/**
 * What the society is heading towards next, and the look it wears. The tab
 * bar's Contribute button takes its colour, as the web's shell does.
 */
export function useSeason() {
  const { data } = useCommunityData('season', async (communityId) => {
    const next = pickNextEvent(await fetchEvents(communityId));
    return next ? lookOf(next) : DEFAULT_FESTIVAL;
  });
  return data ?? DEFAULT_FESTIVAL;
}
