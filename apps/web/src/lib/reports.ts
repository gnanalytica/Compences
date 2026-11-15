import { cache } from 'react';
import { can, toReportsToReview, type MemberRole, type ReportToReview } from '@compences/core';
import { getSupabase } from './supabase/server';

/**
 * Reads for reporting and blocking on the web.
 *
 * The database (1115.0100) decides what comes back: reports_to_review() is
 * empty for a resident, never says who reported, and leaves out reports about
 * something the caller posted; member_blocks returns only the caller's own.
 */

/** What neighbours have reported and nobody has decided, oldest first. */
export const getReportsToReview = cache(
  async (communityId: string, role: MemberRole): Promise<ReportToReview[]> => {
    if (!can(role, 'reports:review')) return [];
    const supabase = await getSupabase();
    const { data } = await supabase.rpc('reports_to_review', { p_community_id: communityId });
    return toReportsToReview(data);
  },
);

export type BlockedMember = { id: string; name: string; since: string };

/** Everybody the signed-in member has blocked in this society. */
export const getBlocked = cache(async (communityId: string): Promise<BlockedMember[]> => {
  const supabase = await getSupabase();
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
});
