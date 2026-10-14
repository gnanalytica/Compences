'use server';

import { revalidatePath } from 'next/cache';
import { coverOverspendSchema, societyExpenseSchema } from '@compences/core';
import { requireCapability } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase/server';
import { EMPTY_STATE, fieldErrors, friendlyDbError, type ActionState } from '@/lib/action-state';

/**
 * Money leaving the society's own balance: spent on something that is no
 * event's, or paid back to somebody who covered an event's overspend.
 *
 * Both need a receipt, and the receipt has to be one of this society's uploads
 * — the database checks it again, with who may do it and whether the balance
 * has the money.
 */

/** A receipt is in this society's folder of the bills bucket, or it is not ours. */
function receiptProblem(communityId: string, path: string, missing: string): ActionState | null {
  if (!path) return { fieldErrors: { proof_path: missing } };
  if (!path.startsWith(`${communityId}/society/`)) {
    return { error: 'That file could not be attached. Please upload it again.' };
  }
  return null;
}

/** Everywhere the society balance or an event's balance is on screen. */
function refreshMoney(communitySlug: string) {
  revalidatePath(`/app/${communitySlug}`, 'layout');
}

/** Staff or the committee record a repair, damage or similar paid from the balance. */
export async function recordSocietyExpense(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const communitySlug = String(formData.get('slug') ?? '');
  const context = await requireCapability(communitySlug, 'expenses:submit');

  const parsed = societyExpenseSchema.safeParse({
    amount: formData.get('amount'),
    reason: formData.get('reason'),
    paid_to: formData.get('paid_to'),
    spent_on: formData.get('spent_on'),
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const proof = String(formData.get('proof_path') ?? '').trim();
  const problem = receiptProblem(
    context.community.id,
    proof,
    'Attach the bill or a screenshot of the payment.',
  );
  if (problem) return problem;

  const supabase = await getSupabase();
  const { error } = await supabase.rpc('record_society_expense', {
    p_community_id: context.community.id,
    p_amount: parsed.data.amount,
    p_reason: parsed.data.reason,
    p_paid_to: parsed.data.paid_to,
    p_proof_path: proof,
    p_spent_on: parsed.data.spent_on,
  });
  if (error) return { error: friendlyDbError(error) };

  refreshMoney(communitySlug);
  return { ...EMPTY_STATE, success: 'Recorded. Every resident can see it, with the receipt.' };
}

/**
 * The committee pays back whoever covered an event's overspend, from the
 * society balance, with the screenshot of the transfer attached.
 */
export async function coverOverspend(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const communitySlug = String(formData.get('slug') ?? '');
  const context = await requireCapability(communitySlug, 'expenses:approve');

  const parsed = coverOverspendSchema.safeParse({
    event_id: formData.get('event_id'),
    amount: formData.get('amount'),
    paid_to: formData.get('paid_to'),
    note: formData.get('note') || undefined,
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const proof = String(formData.get('proof_path') ?? '').trim();
  const problem = receiptProblem(
    context.community.id,
    proof,
    'Attach the screenshot of the transfer.',
  );
  if (problem) return problem;

  const supabase = await getSupabase();
  const { error } = await supabase.rpc('cover_overspend', {
    p_event_id: parsed.data.event_id,
    p_amount: parsed.data.amount,
    p_paid_to: parsed.data.paid_to,
    p_proof_path: proof,
    p_note: parsed.data.note ?? undefined,
  });
  if (error) return { error: friendlyDbError(error) };

  refreshMoney(communitySlug);
  return { ...EMPTY_STATE, success: 'Paid back. Every resident can see it on the Money page.' };
}
