'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { formatMoney, MATCH_CONFIDENCE } from '@compences/core';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { EMPTY_STATE, type ActionState } from '@/lib/action-state';
import { FocusFirstError } from '@/components/focus-first-error';
import {
  addBankAccount,
  importStatement,
  matchLine,
  setLineAside,
  undoMatch,
  type ImportState,
} from './actions';

function Submit({
  label,
  busy,
  variant,
  disabled,
}: {
  label: string;
  busy: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant={variant} disabled={pending || disabled}>
      {pending ? busy : label}
    </Button>
  );
}

function Feedback({ state }: { state: ActionState }) {
  if (state.error) {
    return (
      <p role="alert" className="text-danger text-sm">
        {state.error}
      </p>
    );
  }
  if (state.success) {
    return (
      <p role="status" className="text-success text-sm">
        {state.success}
      </p>
    );
  }
  return null;
}

export function AddAccountForm({ slug }: { slug: string }) {
  const [state, action] = useActionState<ActionState, FormData>(addBankAccount, EMPTY_STATE);

  return (
    <form action={action} className="space-y-3">
      <FocusFirstError signal={state} />
      <input type="hidden" name="slug" value={slug} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Name" htmlFor="acct-label" error={state.fieldErrors?.label} required>
          {(control) => <Input {...control} name="label" placeholder="Current account" />}
        </Field>
        <Field label="Bank" htmlFor="acct-bank" error={state.fieldErrors?.bank_name}>
          {(control) => <Input {...control} name="bank_name" placeholder="Axis" />}
        </Field>
        <Field
          label="Last four digits"
          htmlFor="acct-last4"
          error={state.fieldErrors?.last4}
          hint="The full number is never stored."
        >
          {(control) => (
            <Input {...control} name="last4" inputMode="numeric" maxLength={4} placeholder="4417" />
          )}
        </Field>
      </div>
      <Feedback state={state} />
      <Submit label="Add account" busy="Adding…" />
    </form>
  );
}

/**
 * Importing a statement: paste it, or pick the CSV the bank gave you.
 *
 * Both end in the same place. Pasting is there because half the treasurers who
 * will use this are looking at a statement in a browser tab on a laptop they
 * cannot download to, and telling them to find the CSV first is how a feature
 * goes unused.
 */
export function ImportStatementForm({
  slug,
  accounts,
}: {
  slug: string;
  accounts: { id: string; label: string; last4: string | null }[];
}) {
  const [state, action] = useActionState<ImportState, FormData>(importStatement, EMPTY_STATE);
  const [mode, setMode] = useState<'paste' | 'file'>('paste');

  return (
    <form action={action} className="space-y-3">
      <FocusFirstError signal={state} />
      <input type="hidden" name="slug" value={slug} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Account" htmlFor="account_id" error={state.fieldErrors?.account_id} required>
          {(control) => (
            <Select {...control} name="account_id" defaultValue={accounts[0]?.id}>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.label}
                  {account.last4 ? ` ····${account.last4}` : ''}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div>
          <span className="text-ink mb-1.5 block text-sm font-medium">How</span>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={mode === 'paste' ? 'primary' : 'secondary'}
              aria-pressed={mode === 'paste'}
              onClick={() => setMode('paste')}
            >
              Paste it
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === 'file' ? 'primary' : 'secondary'}
              aria-pressed={mode === 'file'}
              onClick={() => setMode('file')}
            >
              Choose a CSV
            </Button>
          </div>
        </div>
      </div>

      {/* The statement box is monospace so pasted columns line up, but 16px on
          a phone: below that, Safari zooms the page in the moment it is
          tapped. */}
      {mode === 'paste' ? (
        <Field
          label="Statement"
          htmlFor="csv"
          error={state.fieldErrors?.csv}
          hint="Include the row with the column names. Anything above it is ignored."
        >
          {(control) => (
            <textarea
              {...control}
              name="csv"
              rows={8}
              spellCheck={false}
              className="border-border-base bg-surface-raised text-ink placeholder:text-ink-subtle aria-[invalid=true]:border-danger w-full resize-y rounded-lg border px-3 py-2 font-mono text-base sm:text-xs"
              placeholder={
                'Date,Narration,Withdrawal Amt.,Deposit Amt.,Closing Balance\n16/09/26,UPI/612345678901/RIA MENON,,2001.00,124551.00'
              }
            />
          )}
        </Field>
      ) : (
        <Field label="Statement file" htmlFor="file" error={state.fieldErrors?.csv}>
          {(control) => (
            <input
              {...control}
              type="file"
              name="file"
              accept=".csv,.txt,text/csv,text/plain"
              className="text-ink-muted file:bg-surface-sunken file:text-ink file:border-border-base w-full text-sm file:mr-3 file:rounded-lg file:border file:px-3 file:py-1.5 file:text-sm"
            />
          )}
        </Field>
      )}

      <Feedback state={state} />
      {state.imported ? (
        <div role="status" className="text-ink-muted space-y-1 text-sm">
          <p className="text-success">
            {state.imported.added} new {state.imported.added === 1 ? 'line' : 'lines'} from{' '}
            {state.imported.read} read
            {state.imported.skipped ? `, ${state.imported.skipped} already imported` : ''}.
          </p>
          {state.imported.problems.map((problem) => (
            <p key={problem} className="text-warning text-xs">
              {problem}
            </p>
          ))}
        </div>
      ) : null}
      <Submit label="Import" busy="Reading…" disabled={accounts.length === 0} />
    </form>
  );
}

/**
 * One unexplained line, and what it might be.
 *
 * The amount question is the one reconciliation exists to ask. A resident said
 * they paid ₹2,001; the account received ₹2,000. Somebody has to choose which
 * number the books keep, and it should be a person looking at both, which is
 * why the two buttons say what they will do rather than hiding it behind a
 * checkbox nobody reads.
 */
export function MatchForm({
  slug,
  transactionId,
  lineAmount,
  currency,
  candidates,
}: {
  slug: string;
  transactionId: string;
  lineAmount: number;
  currency: string;
  candidates: {
    contribution_id: string;
    payer: string;
    amount: number;
    reference: string | null;
    confidence: string;
  }[];
}) {
  const [state, action] = useActionState<ActionState, FormData>(matchLine, EMPTY_STATE);
  const [chosen, setChosen] = useState(candidates[0]?.contribution_id ?? '');
  const candidate = candidates.find((row) => row.contribution_id === chosen);
  const differs = candidate ? Number(candidate.amount) !== lineAmount : false;

  if (!candidates.length) return null;

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="transaction_id" value={transactionId} />
      <label htmlFor={`match-${transactionId}`} className="sr-only">
        Which receipt this line is
      </label>
      <Select
        id={`match-${transactionId}`}
        name="contribution_id"
        value={chosen}
        onChange={(event) => setChosen(event.target.value)}
      >
        {candidates.map((row) => (
          <option key={row.contribution_id} value={row.contribution_id}>
            {row.payer} · {formatMoney(Number(row.amount), currency)}
            {row.reference ? ` · ${row.reference}` : ''}
            {MATCH_CONFIDENCE[row.confidence] ? ` · ${MATCH_CONFIDENCE[row.confidence]}` : ''}
          </option>
        ))}
      </Select>

      <div className="flex flex-wrap gap-2">
        <Submit label="Confirm" busy="Confirming…" />
        {differs && candidate ? (
          <Button type="submit" name="take_bank_amount" value="1" size="sm" variant="secondary">
            Confirm as {formatMoney(lineAmount, currency)}
          </Button>
        ) : null}
      </div>
      {differs && candidate ? (
        <p className="text-warning text-xs">
          They reported {formatMoney(Number(candidate.amount), currency)}; the bank shows{' '}
          {formatMoney(lineAmount, currency)}. Confirming keeps their figure and notes the gap.
        </p>
      ) : null}
      <Feedback state={state} />
    </form>
  );
}

export function SetAsideForm({ slug, transactionId }: { slug: string; transactionId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(setLineAside, EMPTY_STATE);

  return (
    <form action={action} className="flex flex-wrap items-start gap-2">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="transaction_id" value={transactionId} />
      <div className="min-w-48 flex-1">
        <label htmlFor={`aside-${transactionId}`} className="sr-only">
          What this line was
        </label>
        <Input
          id={`aside-${transactionId}`}
          name="reason"
          placeholder="Bank charge, interest, own transfer…"
          aria-invalid={state.fieldErrors?.reason ? true : undefined}
        />
        {state.fieldErrors?.reason ? (
          <p role="alert" className="text-danger mt-1 text-xs">
            {state.fieldErrors.reason}
          </p>
        ) : null}
      </div>
      <Submit label="Set aside" busy="Saving…" variant="ghost" />
      <Feedback state={state} />
    </form>
  );
}

export function UndoMatchForm({ slug, transactionId }: { slug: string; transactionId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(undoMatch, EMPTY_STATE);

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="transaction_id" value={transactionId} />
      <Submit label="Undo" busy="Undoing…" variant="ghost" />
      <Feedback state={state} />
    </form>
  );
}
