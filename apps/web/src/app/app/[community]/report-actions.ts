'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  REPORT_SENT,
  blockErrorMessage,
  contentReportSchema,
  reportErrorMessage,
  reportSubjectColumns,
  uuid,
  type ReportSubject,
} from '@compences/core';
import { requireCommunity } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase/server';
import { EMPTY_STATE, fieldErrors, type ActionState } from '@/lib/action-state';

/**
 * Reporting and blocking from the web: a resident saying a listing, a review
 * or a comment should not be there, and choosing not to see what one
 * neighbour posts.
 *
 * Who the caller is comes from the session, never the form, and the database
 * (1115.0100) checks everything again: that the thing exists and is theirs to
 * see, that it is not their own, that nobody is blocked twice. What is here
 * turns a refusal into a sentence.
 */

/**
 * What one person posts is on the board, under listings, in event threads and
 * in the committee's queue, so a report or a block refreshes the society's
 * pages rather than guessing which ones moved.
 */
function revalidateSociety(slug: string) {
  revalidatePath(`/app/${slug}`, 'layout');
}

/**
 * Where a form asked to go afterwards, if that is a plain path inside this
 * society. The field comes from a form, so anything else is ignored.
 */
function safeNext(formData: FormData, communitySlug: string): string | null {
  const next = String(formData.get('next') ?? '');
  return next.startsWith(`/app/${communitySlug}/`) && /^[\w/-]+$/.test(next) ? next : null;
}

type Supabase = Awaited<ReturnType<typeof getSupabase>>;

/** Whoever posted the thing, read the way the caller would read it. */
async function authorOf(supabase: Supabase, kind: ReportSubject, id: string) {
  const table =
    kind === 'listing' ? 'listings' : kind === 'review' ? 'listing_reviews' : 'comments';
  const { data } = await supabase.from(table).select('membership_id').eq('id', id).maybeSingle();
  return data?.membership_id ?? null;
}

export async function reportContent(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const slug = String(formData.get('slug') ?? '');
  const context = await requireCommunity(slug);

  const parsed = contentReportSchema.safeParse({
    subject_kind: formData.get('subject_kind'),
    subject_id: formData.get('subject_id'),
    reason: formData.get('reason') ?? undefined,
    details: formData.get('details') ?? undefined,
    block: formData.get('block') ?? '',
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const { subject_kind: kind, subject_id: subjectId, reason, details, block } = parsed.data;

  const supabase = await getSupabase();
  // Before the report, and before any block: afterwards the caller may no
  // longer be able to see the thing they just blocked the author of.
  const authorId = block ? await authorOf(supabase, kind, subjectId) : null;

  const { error } = await supabase.from('content_reports').insert({
    community_id: context.community.id,
    reporter_id: context.membership.id,
    subject_kind: kind,
    ...reportSubjectColumns(kind, subjectId),
    reason,
    details,
  });
  if (error) return { error: reportErrorMessage(error) };

  let blocked = false;
  if (authorId && authorId !== context.membership.id) {
    const { error: blockError } = await supabase.from('member_blocks').insert({
      community_id: context.community.id,
      blocker_id: context.membership.id,
      blocked_id: authorId,
    });
    blocked = !blockError || blockError.code === '23505';
  }

  revalidateSociety(slug);
  // Reporting a listing and blocking its seller leaves this page with nothing
  // on it, so go where the form says to instead of to a "not found".
  if (blocked) {
    const next = safeNext(formData, context.community.slug);
    if (next) redirect(`${next}?reported=1&blocked=1`);
  }
  return {
    ...EMPTY_STATE,
    success: blocked
      ? `${REPORT_SENT} You will not see what they post any more; undo that in Settings.`
      : REPORT_SENT,
  };
}

/**
 * Stops showing the caller what one neighbour posts. `next` is where to go
 * afterwards when the page they are on is about to have nothing on it —
 * blocking a seller from their own listing, say.
 */
export async function blockMember(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const slug = String(formData.get('slug') ?? '');
  const context = await requireCommunity(slug);

  const blockedId = uuid.safeParse(formData.get('member_id'));
  if (!blockedId.success) return { error: 'That person is no longer in this society.' };

  const supabase = await getSupabase();
  const { error } = await supabase.from('member_blocks').insert({
    community_id: context.community.id,
    blocker_id: context.membership.id,
    blocked_id: blockedId.data,
  });
  // Already blocked is the result that was asked for.
  if (error && error.code !== '23505') return { error: blockErrorMessage(error) };

  revalidateSociety(slug);
  const next = safeNext(formData, context.community.slug);
  if (next) redirect(`${next}?blocked=1`);
  return { ...EMPTY_STATE, success: 'Blocked. Undo it any time in Settings.' };
}

/** Takes a block back. Only the caller's own: the policy returns no others. */
export async function unblockMember(formData: FormData): Promise<void> {
  const slug = String(formData.get('slug') ?? '');
  const context = await requireCommunity(slug);

  const supabase = await getSupabase();
  const { error } = await supabase
    .from('member_blocks')
    .delete()
    .eq('id', String(formData.get('block_id') ?? ''))
    .eq('blocker_id', context.membership.id);
  if (error) console.error('[compences] block was not removed', error.code, error.message);

  revalidateSociety(slug);
}
