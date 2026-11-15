'use server';

import { revalidatePath } from 'next/cache';
import { resolveReportMessage, uuid } from '@compences/core';
import { requireCapability } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase/server';
import { EMPTY_STATE, friendlyDbError, type ActionState } from '@/lib/action-state';

/**
 * Staff or the committee decide a report: take the thing down, or leave it
 * up. resolve_report() does both halves in one transaction — the listing off
 * the board or the review or comment deleted, and every report about it
 * closed — tells whoever reported, and tells whoever posted it when it comes
 * down. It also refuses a report about something the caller posted.
 */
export async function resolveReport(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const slug = String(formData.get('slug') ?? '');
  await requireCapability(slug, 'reports:review');

  const reportId = uuid.safeParse(formData.get('report_id'));
  if (!reportId.success) return { error: resolveReportMessage('no_report') };
  const remove = formData.get('decision') === 'remove';
  const note = String(formData.get('note') ?? '').trim();

  const supabase = await getSupabase();
  const { data, error } = await supabase.rpc('resolve_report', {
    p_report_id: reportId.data,
    p_remove: remove,
    p_note: remove && note ? note.slice(0, 500) : undefined,
  });
  if (error) return { error: friendlyDbError(error) };

  // Whatever the answer, the queue on screen is out of date: somebody else
  // deciding it first is one of the answers.
  revalidatePath(`/app/${slug}`, 'layout');
  if (data !== 'ok') return { error: resolveReportMessage(String(data)) };
  return { ...EMPTY_STATE, success: resolveReportMessage('ok') };
}
