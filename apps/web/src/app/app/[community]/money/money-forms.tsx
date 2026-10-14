'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { formatMoney } from '@compences/core';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { FileUpload } from '@/components/file-upload';
import { EMPTY_STATE, wasAccepted, type ActionState } from '@/lib/action-state';
import { coverOverspend, recordSocietyExpense } from './actions';

function Submit({ label, busy, disabled }: { label: string; busy: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending || disabled}>
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

/** Clears the form, uploaded receipt included, once the server accepts it. */
function useResetOnSuccess(state: ActionState) {
  const ref = useRef<HTMLFormElement>(null);
  const [version, setVersion] = useState(0);
  const [seen, setSeen] = useState(state);
  if (seen !== state) {
    setSeen(state);
    if (wasAccepted(state)) setVersion((current) => current + 1);
  }
  useEffect(() => {
    if (wasAccepted(state)) ref.current?.reset();
  }, [state]);
  return { ref, version };
}

/**
 * Staff and the committee record money the society spent from its own
 * balance: a repair, damage, anything that is not an event's. Every field is
 * required, the receipt included, and every resident sees the entry.
 */
export function SocietyExpenseForm({
  slug,
  communityId,
  balance,
  currency,
  today,
}: {
  slug: string;
  communityId: string;
  balance: number;
  currency: string;
  today: string;
}) {
  const [state, action] = useActionState<ActionState, FormData>(recordSocietyExpense, EMPTY_STATE);
  const { ref, version } = useResetOnSuccess(state);
  const [uploading, setUploading] = useState(false);
  const empty = balance <= 0;

  return (
    <form ref={ref} action={action} className="space-y-4">
      <input type="hidden" name="slug" value={slug} />
      <p className="text-ink-muted text-sm">
        {empty
          ? 'The society balance is empty, so there is nothing to spend from yet.'
          : `The society balance holds ${formatMoney(balance, currency)}. Every resident sees what is spent from it, with the receipt.`}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="What for" htmlFor="sx-reason" error={state.fieldErrors?.reason} required>
          {(control) => (
            <Input {...control} name="reason" placeholder="Gate motor repair" required />
          )}
        </Field>
        <Field label="Paid to" htmlFor="sx-paid-to" error={state.fieldErrors?.paid_to} required>
          {(control) => (
            <Input {...control} name="paid_to" placeholder="Sri Ram Electricals" required />
          )}
        </Field>
        <Field label="Amount (₹)" htmlFor="sx-amount" error={state.fieldErrors?.amount} required>
          {(control) => (
            <Input
              {...control}
              name="amount"
              type="number"
              min={1}
              max={Math.max(1, Math.floor(balance))}
              step="1"
              required
            />
          )}
        </Field>
        <Field label="Paid on" htmlFor="sx-date" error={state.fieldErrors?.spent_on} required>
          {(control) => (
            <Input {...control} name="spent_on" type="date" defaultValue={today} required />
          )}
        </Field>
      </div>
      <div className="space-y-1.5">
        <FileUpload
          key={`receipt-${version}`}
          bucket="bills"
          folder={`${communityId}/society`}
          name="proof_path"
          label="Bill or payment screenshot (required)"
          hint="A photo or PDF, up to 10 MB. Every resident can open it."
          maxBytes={10 * 1_048_576}
          onUploadingChange={setUploading}
        />
        {state.fieldErrors?.proof_path ? (
          <p className="text-danger text-sm">{state.fieldErrors.proof_path}</p>
        ) : null}
      </div>
      <Feedback state={state} />
      <Submit label="Record spending" busy="Recording…" disabled={uploading || empty} />
    </form>
  );
}

/**
 * The committee pays back somebody who covered an event's overspend, from the
 * society balance, and attaches the screenshot of the transfer. What the
 * balance cannot cover stays in To do until it can.
 */
export function CoverOverspendForm({
  slug,
  communityId,
  eventId,
  overBy,
  balance,
  payer,
  currency,
}: {
  slug: string;
  communityId: string;
  eventId: string;
  overBy: number;
  balance: number;
  /** Who paid the last bill, as a starting point for "Paid back to". */
  payer: string | null;
  currency: string;
}) {
  const [state, action] = useActionState<ActionState, FormData>(coverOverspend, EMPTY_STATE);
  const [uploading, setUploading] = useState(false);
  const canCover = Math.min(overBy, balance);

  if (canCover <= 0) {
    return (
      <p className="text-ink-muted text-sm">
        The society balance is empty, so this waits here. Once an event&rsquo;s leftover is kept for
        the society, pay it back from here.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="event_id" value={eventId} />
      <p className="text-ink-muted text-sm">
        {canCover < overBy
          ? `The society balance holds ${formatMoney(balance, currency)}, so you can pay back that much now. The rest stays here until it can be paid.`
          : `The society balance holds ${formatMoney(balance, currency)}, enough to pay it all back.`}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Paid back to"
          htmlFor={`cover-to-${eventId}`}
          error={state.fieldErrors?.paid_to}
          required
        >
          {(control) => <Input {...control} name="paid_to" defaultValue={payer ?? ''} required />}
        </Field>
        <Field
          label="Amount (₹)"
          htmlFor={`cover-amount-${eventId}`}
          error={state.fieldErrors?.amount}
          required
        >
          {(control) => (
            <Input
              {...control}
              name="amount"
              type="number"
              min={1}
              max={Math.floor(canCover)}
              step="1"
              defaultValue={Math.floor(canCover)}
              required
            />
          )}
        </Field>
      </div>
      <Field label="Note" htmlFor={`cover-note-${eventId}`} error={state.fieldErrors?.note}>
        {(control) => <Input {...control} name="note" placeholder="Sound system, paid by UPI" />}
      </Field>
      <div className="space-y-1.5">
        <FileUpload
          bucket="bills"
          folder={`${communityId}/society`}
          name="proof_path"
          label="Screenshot of the transfer (required)"
          hint="Residents can open it, so they know the committee pays people back."
          maxBytes={10 * 1_048_576}
          onUploadingChange={setUploading}
        />
        {state.fieldErrors?.proof_path ? (
          <p className="text-danger text-sm">{state.fieldErrors.proof_path}</p>
        ) : null}
      </div>
      <Feedback state={state} />
      <Submit label="Pay back" busy="Recording…" disabled={uploading} />
    </form>
  );
}
