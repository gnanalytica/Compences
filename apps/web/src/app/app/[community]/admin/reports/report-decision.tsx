'use client';

import { useActionState, useId } from 'react';
import { useFormStatus } from 'react-dom';
import { REPORT_DECISION, type ReportKind } from '@compences/core';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/field';
import { EMPTY_STATE, type ActionState } from '@/lib/action-state';
import { resolveReport } from './actions';

function Decide({
  value,
  label,
  variant,
}: {
  value: 'remove' | 'keep';
  label: string;
  variant: 'danger' | 'secondary';
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      name="decision"
      value={value}
      size="sm"
      variant={variant}
      disabled={pending}
    >
      {label}
    </Button>
  );
}

/**
 * The two decisions on a report, with the reason beside them.
 *
 * The note is for whoever posted the thing, and is only sent if it comes
 * down: "your review was removed" with no why is the message that starts an
 * argument on WhatsApp. Leaving it up needs no note; the neighbour who
 * reported is simply told it was looked at.
 */
export function ReportDecision({
  slug,
  reportId,
  kind,
}: {
  slug: string;
  reportId: string;
  kind: ReportKind;
}) {
  const [state, action] = useActionState<ActionState, FormData>(resolveReport, EMPTY_STATE);
  const id = useId();
  const words = REPORT_DECISION[kind];

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="report_id" value={reportId} />
      <label htmlFor={`${id}-note`} className="block space-y-1.5">
        <span className="text-ink block text-sm font-medium">{words.noteLabel}</span>
        <Textarea
          id={`${id}-note`}
          name="note"
          rows={2}
          maxLength={500}
          className="min-h-16"
          placeholder={words.notePlaceholder}
          aria-describedby={kind === 'member' ? undefined : `${id}-hint`}
        />
        {kind === 'member' ? null : (
          <span id={`${id}-hint`} className="text-ink-subtle block text-xs">
            Sent to them only if it comes down.
          </span>
        )}
      </label>
      {state.error ? (
        <p role="alert" className="text-danger text-sm">
          {state.error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Decide
          value="remove"
          label={words.remove}
          variant={kind === 'member' ? 'secondary' : 'danger'}
        />
        <Decide value="keep" label={words.keep} variant="secondary" />
      </div>
    </form>
  );
}
