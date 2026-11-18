'use client';

import { useActionState, useId, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Ban, Flag } from 'lucide-react';
import {
  REPORT_PROMISE,
  REPORT_REASONS,
  REPORT_REASON_LABEL,
  REPORT_SUBJECT_NOUN,
  blockExplainer,
  type ReportSubject,
} from '@compences/core';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/field';
import { EMPTY_STATE, type ActionState } from '@/lib/action-state';
import { blockMember, reportContent } from '@/app/app/[community]/report-actions';

/** "Chitra", from "Chitra Rao": a button that says "Block Chitra" reads like a person. */
const firstName = (name: string) => name.trim().split(/\s+/)[0] || 'them';

const QUIET_LINK =
  'text-ink-subtle hover:text-ink inline-flex cursor-pointer list-none items-center gap-1.5 text-xs ' +
  'underline underline-offset-4 pointer-coarse:min-h-11 [&::-webkit-details-marker]:hidden';

function Submit({
  idle,
  busy,
  variant = 'primary',
}: {
  idle: string;
  busy: string;
  variant?: 'primary' | 'danger';
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant={variant} disabled={pending}>
      {pending ? busy : idle}
    </Button>
  );
}

/**
 * The fields of a report: what is wrong with it, anything to add, and whether
 * to stop seeing the person too.
 *
 * The reasons are radio buttons rather than a dropdown: there are six, they
 * are the whole decision, and a list that has to be opened hides the one
 * somebody is looking for.
 */
function ReportFields({
  slug,
  kind,
  subjectId,
  authorName,
  blockNext,
  allowBlock = true,
}: {
  slug: string;
  kind: ReportSubject;
  subjectId: string;
  authorName: string;
  /** Where to go if they also block, when this page will have nothing left on it. */
  blockNext?: string;
  allowBlock?: boolean;
}) {
  const [state, action] = useActionState<ActionState, FormData>(reportContent, EMPTY_STATE);
  const id = useId();

  if (state.success) {
    return (
      <p role="status" className="text-success text-sm">
        {state.success}
      </p>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="subject_kind" value={kind} />
      <input type="hidden" name="subject_id" value={subjectId} />
      {blockNext ? <input type="hidden" name="next" value={blockNext} /> : null}
      <fieldset>
        <legend className="text-ink mb-1.5 text-sm font-medium">
          What is wrong with this {REPORT_SUBJECT_NOUN[kind]}?
        </legend>
        <div className="grid gap-x-4 sm:grid-cols-2">
          {REPORT_REASONS.map((reason) => (
            <label
              key={reason}
              className="text-ink flex cursor-pointer items-center gap-2 py-1 text-sm pointer-coarse:min-h-11"
            >
              <input
                type="radio"
                name="reason"
                value={reason}
                required
                className="accent-ink size-4"
                aria-describedby={state.fieldErrors?.reason ? `${id}-reason-error` : undefined}
              />
              {REPORT_REASON_LABEL[reason]}
            </label>
          ))}
        </div>
        {state.fieldErrors?.reason ? (
          <p id={`${id}-reason-error`} role="alert" className="text-danger mt-1 text-xs">
            {state.fieldErrors.reason}
          </p>
        ) : null}
      </fieldset>
      <label htmlFor={`${id}-details`} className="block space-y-1.5">
        <span className="text-ink block text-sm font-medium">
          Anything the committee should know{' '}
          <span className="text-ink-subtle font-normal">(optional)</span>
        </span>
        <Textarea
          id={`${id}-details`}
          name="details"
          rows={2}
          maxLength={500}
          className="min-h-16"
          aria-invalid={state.fieldErrors?.details ? true : undefined}
        />
        {state.fieldErrors?.details ? (
          <span role="alert" className="text-danger block text-xs">
            {state.fieldErrors.details}
          </span>
        ) : null}
      </label>
      {allowBlock ? (
        <label className="text-ink flex cursor-pointer items-center gap-2 text-sm pointer-coarse:min-h-11">
          <input type="checkbox" name="block" className="accent-ink size-4" />
          Also block {firstName(authorName)}, so I stop seeing what they post
        </label>
      ) : null}
      {state.error ? (
        <p role="alert" className="text-danger text-sm">
          {state.error}
        </p>
      ) : null}
      <Submit idle="Report" busy="Sending…" />
      <p className="text-ink-subtle text-xs">{REPORT_PROMISE}</p>
    </form>
  );
}

/**
 * Blocking, with the second press that says what it does first: a block
 * changes what one person sees from then on, and should not be one stray
 * click away.
 */
function BlockFields({
  slug,
  memberId,
  authorName,
  next,
}: {
  slug: string;
  memberId: string;
  authorName: string;
  /** Where to go afterwards, when this page will have nothing left on it. */
  next?: string;
}) {
  const [state, action] = useActionState<ActionState, FormData>(blockMember, EMPTY_STATE);

  if (state.success) {
    return (
      <p role="status" className="text-success text-sm">
        {state.success}
      </p>
    );
  }

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="member_id" value={memberId} />
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <p className="text-ink-muted max-w-prose text-sm">{blockExplainer(firstName(authorName))}</p>
      {state.error ? (
        <p role="alert" className="text-danger text-sm">
          {state.error}
        </p>
      ) : null}
      <Submit idle={`Block ${firstName(authorName)}`} busy="Blocking…" variant="danger" />
    </form>
  );
}

/**
 * Report and Block, under a listing or a review somebody else wrote.
 *
 * Both app stores expect these wherever residents post. They open in place,
 * not in a floating menu: the thing being reported stays on screen above the
 * form, which is what somebody needs to look at while saying what is wrong
 * with it. Nobody is offered either on something of their own — the page
 * leaves this out, and the database refuses it regardless.
 */
export function ReportControls({
  slug,
  kind,
  subjectId,
  authorId,
  authorName,
  blockNext,
  allowBlock = true,
}: {
  slug: string;
  kind: ReportSubject;
  subjectId: string;
  /** The membership of whoever posted it; who Block blocks. */
  authorId: string;
  authorName: string;
  blockNext?: string;
  /**
   * False for an outside business: it is the committee's entry rather than
   * anybody's post, and blocking whoever typed it in would not hide it
   * (1118.0100). It can still be reported.
   */
  allowBlock?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-start gap-x-5 gap-y-1">
      <details className="group max-w-full">
        <summary className={QUIET_LINK}>
          <Flag className="size-3.5" aria-hidden="true" />
          Report this {REPORT_SUBJECT_NOUN[kind]}
        </summary>
        <div className="border-border-base bg-surface-sunken mt-2 rounded-xl border p-4">
          <ReportFields
            slug={slug}
            kind={kind}
            subjectId={subjectId}
            authorName={authorName}
            blockNext={blockNext}
            allowBlock={allowBlock}
          />
        </div>
      </details>
      {allowBlock ? (
        <details className="group max-w-full">
          <summary className={QUIET_LINK}>
            <Ban className="size-3.5" aria-hidden="true" />
            Block {firstName(authorName)}
          </summary>
          <div className="border-border-base bg-surface-sunken mt-2 rounded-xl border p-4">
            <BlockFields slug={slug} memberId={authorId} authorName={authorName} next={blockNext} />
          </div>
        </details>
      ) : null}
    </div>
  );
}

/**
 * The same two things for a message in a thread, where there is room for one
 * small button: a flag beside the reactions that opens the form underneath.
 * Its parent is a wrapping row, so the form takes the whole next line.
 */
export function CommentReport({
  slug,
  commentId,
  authorId,
  authorName,
}: {
  slug: string;
  commentId: string;
  authorId: string;
  authorName: string;
}) {
  const [open, setOpen] = useState(false);
  const panel = useId();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls={panel}
        aria-label={`Report or block: message from ${authorName}`}
        title="Report or block"
        className="text-ink-subtle hover:text-ink hover:bg-surface-sunken rounded-full p-1.5 pointer-coarse:p-2.5"
      >
        <Flag className="size-3.5" aria-hidden="true" />
      </button>
      {open ? (
        <div
          id={panel}
          className="border-border-base bg-surface-raised mt-1 basis-full space-y-4 rounded-xl border p-4 text-left"
        >
          <ReportFields slug={slug} kind="comment" subjectId={commentId} authorName={authorName} />
          <details className="group">
            <summary className={QUIET_LINK}>
              <Ban className="size-3.5" aria-hidden="true" />
              Just block {firstName(authorName)}
            </summary>
            <div className="mt-2">
              <BlockFields slug={slug} memberId={authorId} authorName={authorName} />
            </div>
          </details>
        </div>
      ) : null}
    </>
  );
}
