'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { parseStatement, uuid } from '@compences/core';
import { requireCapability } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase/server';
import { EMPTY_STATE, fieldErrors, friendlyDbError, type ActionState } from '@/lib/action-state';

/**
 * Reconciliation: pairing what the bank says happened with what the app
 * believes. Staff do the pairing; the committee alone can unpick one, because
 * undoing a confirmation moves money out of a fund that residents have already
 * been shown.
 */

function refresh(slug: string) {
  revalidatePath(`/app/${slug}/admin/reconcile`);
  revalidatePath(`/app/${slug}/money`);
  revalidatePath(`/app/${slug}/admin`);
}

const accountSchema = z.object({
  label: z.string().trim().min(1, 'Give the account a name').max(80),
  bank_name: z.string().trim().max(80).optional(),
  last4: z
    .string()
    .trim()
    .regex(/^\d{4}$/, 'The last four digits, or leave it blank')
    .optional(),
});

/** The committee names the account a statement will be imported against. */
export async function addBankAccount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const slug = String(formData.get('slug') ?? '');
  const context = await requireCapability(slug, 'roles:manage');

  const parsed = accountSchema.safeParse({
    label: formData.get('label'),
    bank_name: formData.get('bank_name') || undefined,
    last4: formData.get('last4') || undefined,
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await getSupabase();
  const { error } = await supabase.from('bank_accounts').insert({
    community_id: context.community.id,
    label: parsed.data.label,
    bank_name: parsed.data.bank_name ?? null,
    last4: parsed.data.last4 ?? null,
    created_by: context.membership.id,
  });
  if (error) return { error: friendlyDbError(error) };

  refresh(slug);
  return { ...EMPTY_STATE, success: 'Account added.' };
}

export type ImportState = ActionState & {
  /** Set on a successful import, so the screen can say what it actually did. */
  imported?: { added: number; read: number; skipped: number; problems: string[] };
};

/**
 * Reads a pasted or uploaded statement and files the lines it can read.
 *
 * Parsing happens here rather than in the browser so that the rules have one
 * home and real tests; the database deduplicates, so pasting an overlapping
 * month is safe and says "0 new" rather than doubling the money.
 *
 * Lines it cannot read are reported back with their row numbers instead of
 * being dropped. A statement that quietly loses three rows is worse than one
 * that refuses to import, because the totals still look about right.
 */
export async function importStatement(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const slug = String(formData.get('slug') ?? '');
  await requireCapability(slug, 'payments:record');

  const accountId = String(formData.get('account_id') ?? '');
  if (!uuid.safeParse(accountId).success) {
    return { fieldErrors: { account_id: 'Pick the account this statement is for' } };
  }

  const file = formData.get('file');
  const pasted = String(formData.get('csv') ?? '');
  const text = file instanceof File && file.size > 0 ? await file.text() : pasted;
  if (!text.trim()) {
    return { fieldErrors: { csv: 'Paste the statement, or choose a CSV file' } };
  }
  if (text.length > 4_000_000) {
    return { fieldErrors: { csv: 'That statement is too large. Import one month at a time.' } };
  }

  const { lines, problems } = parseStatement(text);
  if (!lines.length) {
    return {
      fieldErrors: {
        csv: problems[0]?.reason ?? 'Nothing in that looked like a statement line.',
      },
    };
  }

  const supabase = await getSupabase();
  const { data, error } = await supabase.rpc('import_bank_lines', {
    p_account_id: accountId,
    p_lines: lines,
  });
  if (error) return { error: friendlyDbError(error) };

  const added = Number(data ?? 0);
  refresh(slug);
  return {
    ...EMPTY_STATE,
    imported: {
      added,
      read: lines.length,
      skipped: lines.length - added,
      problems: problems.slice(0, 5).map((problem) => `Line ${problem.row}: ${problem.reason}`),
    },
  };
}

/** Pairs a statement line with the payment it turned out to be. */
export async function matchLine(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const slug = String(formData.get('slug') ?? '');
  await requireCapability(slug, 'payments:record');

  const parsed = z
    .object({
      transaction_id: uuid,
      contribution_id: uuid,
      take_bank_amount: z.coerce.boolean(),
    })
    .safeParse({
      transaction_id: formData.get('transaction_id'),
      contribution_id: formData.get('contribution_id'),
      take_bank_amount: formData.get('take_bank_amount') === '1',
    });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await getSupabase();
  const { error } = await supabase.rpc('reconcile_bank_line', {
    p_transaction_id: parsed.data.transaction_id,
    p_contribution_id: parsed.data.contribution_id,
    p_take_bank_amount: parsed.data.take_bank_amount,
  });
  if (error) return { error: friendlyDbError(error) };

  refresh(slug);
  return { ...EMPTY_STATE, success: 'Matched and confirmed.' };
}

/** Sets a line aside: a bank charge, interest, a transfer between own accounts. */
export async function setLineAside(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const slug = String(formData.get('slug') ?? '');
  await requireCapability(slug, 'payments:record');

  const transactionId = String(formData.get('transaction_id') ?? '');
  const reason = String(formData.get('reason') ?? '').trim();
  if (!uuid.safeParse(transactionId).success) return { error: 'That line no longer exists.' };
  if (!reason) return { fieldErrors: { reason: 'Say what this line was' } };

  const supabase = await getSupabase();
  const { error } = await supabase.rpc('ignore_bank_line', {
    p_transaction_id: transactionId,
    p_reason: reason.slice(0, 200),
  });
  if (error) return { error: friendlyDbError(error) };

  refresh(slug);
  return { ...EMPTY_STATE, success: 'Set aside.' };
}

/**
 * Undoes a match, which puts the payment back to waiting.
 *
 * Committee only, and the database says so too. A confirmation that rested on
 * the wrong line was not a confirmation, but residents have already seen the
 * fund total move, so taking it back should need the people whose names are on
 * the accounts.
 */
export async function undoMatch(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const slug = String(formData.get('slug') ?? '');
  await requireCapability(slug, 'roles:manage');

  const transactionId = String(formData.get('transaction_id') ?? '');
  if (!uuid.safeParse(transactionId).success) return { error: 'That line no longer exists.' };

  const supabase = await getSupabase();
  const { error } = await supabase.rpc('unreconcile_bank_line', {
    p_transaction_id: transactionId,
  });
  if (error) return { error: friendlyDbError(error) };

  refresh(slug);
  return { ...EMPTY_STATE, success: 'Match undone; the receipt is waiting again.' };
}
