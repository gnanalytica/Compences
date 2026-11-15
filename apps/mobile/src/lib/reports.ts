import type { QueryClient } from '@tanstack/react-query';
import {
  blockErrorMessage,
  reportErrorMessage,
  reportSubjectColumns,
  resolveReportMessage,
  toReportsToReview,
  type ReportReason,
  type ReportSubject,
  type ReportToReview,
} from '@compences/core';
import { supabase } from './supabase';

/**
 * Reporting and blocking from the phone: "this should not be here" about a
 * listing or a review, "I would rather not see this person", and the queue of
 * what neighbours reported for staff and the committee to decide.
 *
 * The database (1115.0100) holds every rule — who may report what, that
 * nobody decides a report about their own post, that a block hides what the
 * blocked person posts. These functions only send what was asked and turn a
 * refusal into a sentence; each returns that sentence, or null when it went
 * through.
 */

export async function fileReport(report: {
  communityId: string;
  membershipId: string;
  kind: ReportSubject;
  subjectId: string;
  reason: ReportReason;
  details: string | null;
}): Promise<string | null> {
  // No rows asked for back: a report is readable by whoever filed it, but
  // there is nothing in it the screen needs.
  const { error } = await supabase.from('content_reports').insert({
    community_id: report.communityId,
    reporter_id: report.membershipId,
    subject_kind: report.kind,
    ...reportSubjectColumns(report.kind, report.subjectId),
    reason: report.reason,
    details: report.details,
  });
  return error ? reportErrorMessage(error) : null;
}

export async function blockMember(block: {
  communityId: string;
  membershipId: string;
  blockedId: string;
}): Promise<string | null> {
  const { error } = await supabase.from('member_blocks').insert({
    community_id: block.communityId,
    blocker_id: block.membershipId,
    blocked_id: block.blockedId,
  });
  // Blocking somebody already blocked is the result that was wanted.
  return error && error.code !== '23505' ? blockErrorMessage(error) : null;
}

export async function unblockMember(blockId: string): Promise<string | null> {
  const { error } = await supabase.from('member_blocks').delete().eq('id', blockId);
  return error ? 'That did not go through. Please try again.' : null;
}

export type BlockedMember = { id: string; name: string; since: string };

/** Everybody the viewer has blocked in this society. Row-level security returns only their own. */
export async function fetchBlocked(communityId: string): Promise<BlockedMember[]> {
  const { data } = await supabase
    .from('member_blocks')
    .select(
      'id, created_at, blocked:memberships!member_blocks_blocked_id_fkey(profiles(full_name))',
    )
    .eq('community_id', communityId)
    .order('created_at', { ascending: false })
    .limit(200);
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.blocked?.profiles?.full_name?.trim() || 'A neighbour',
    since: row.created_at,
  }));
}

/** What neighbours have reported and nobody has decided. Empty for a resident. */
export async function fetchReportsToReview(communityId: string): Promise<ReportToReview[]> {
  const { data, error } = await supabase.rpc('reports_to_review', {
    p_community_id: communityId,
  });
  if (error) throw error;
  return toReportsToReview(data);
}

/** Takes the thing down, or leaves it up. The note goes to whoever posted it. */
export async function resolveReport(
  reportId: string,
  remove: boolean,
  note: string,
): Promise<string | null> {
  const { data, error } = await supabase.rpc('resolve_report', {
    p_report_id: reportId,
    p_remove: remove,
    p_note: note.trim() || undefined,
  });
  if (error) return resolveReportMessage('error');
  return data === 'ok' ? null : resolveReportMessage(String(data));
}

/**
 * After a block, an unblock or a decision on a report. What one person posts
 * is on the board, under listings, on event pages and in the To do count, so
 * everything on screen is refreshed rather than guessing which reads moved.
 */
export function invalidateAfterModeration(queryClient: QueryClient) {
  return queryClient.invalidateQueries();
}
