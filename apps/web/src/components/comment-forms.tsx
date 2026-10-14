'use client';

import { useActionState, useEffect, useOptimistic, useRef, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { SendHorizontal, SmilePlus, Trash2 } from 'lucide-react';
import {
  COMMENT_REACTIONS,
  REACTION_LABEL,
  reactedBy,
  withReactionToggled,
  type CommentReaction,
  type ReactionSummary,
} from '@compences/core';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/field';
import { EMPTY_STATE, type ActionState } from '@/lib/action-state';
import { useResetOnSuccess } from '@/lib/use-reset-on-success';
import { cn } from '@/lib/utils';
import { deleteComment, postComment, toggleReaction } from '@/app/app/[community]/events/actions';
import type { CommentSubject } from './comment-thread';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      <SendHorizontal className="size-4" aria-hidden="true" />
      {pending ? 'Sending…' : 'Send'}
    </Button>
  );
}

export function CommentForm({
  slug,
  subject,
  eventSlug,
}: {
  slug: string;
  subject: CommentSubject;
  /** So the page this thread is on is the page that gets refreshed. */
  eventSlug?: string;
}) {
  const [state, action] = useActionState<ActionState, FormData>(postComment, EMPTY_STATE);
  const ref = useResetOnSuccess(state);

  return (
    <form ref={ref} action={action} className="border-border-base space-y-2 border-t pt-4">
      <input type="hidden" name="slug" value={slug} />
      {eventSlug ? <input type="hidden" name="event" value={eventSlug} /> : null}
      {'eventId' in subject ? (
        <input type="hidden" name="event_id" value={subject.eventId} />
      ) : (
        <input type="hidden" name="suggestion_id" value={subject.suggestionId} />
      )}
      <label htmlFor={`comment-${'eventId' in subject ? subject.eventId : subject.suggestionId}`}>
        <span className="sr-only">Your comment</span>
        <Textarea
          id={`comment-${'eventId' in subject ? subject.eventId : subject.suggestionId}`}
          name="body"
          rows={2}
          maxLength={2000}
          placeholder="Write a message…"
          required
        />
      </label>
      {state.error ? (
        <p role="alert" className="text-danger text-sm">
          {state.error}
        </p>
      ) : null}
      <Submit />
    </form>
  );
}

export function DeleteCommentButton({
  slug,
  commentId,
  eventSlug,
}: {
  slug: string;
  commentId: string;
  eventSlug?: string;
}) {
  return (
    <form action={deleteComment}>
      <input type="hidden" name="slug" value={slug} />
      {eventSlug ? <input type="hidden" name="event" value={eventSlug} /> : null}
      <input type="hidden" name="comment_id" value={commentId} />
      <button
        type="submit"
        className="text-ink-subtle hover:text-danger rounded-full p-1.5 pointer-coarse:p-2.5"
        aria-label="Delete this message"
      >
        <Trash2 className="size-3.5" aria-hidden="true" />
      </button>
    </form>
  );
}

/**
 * The faces under one message: a chip per face with how many and who, pressed
 * when one of them is the reader's, and a button that offers the rest.
 * Anybody can react to anything, their own messages included. A tap shows at
 * once; the server's answer replaces it a moment later.
 */
export function CommentReactions({
  slug,
  commentId,
  eventSlug,
  reactions,
  align = 'start',
  children,
}: {
  slug: string;
  commentId: string;
  eventSlug?: string;
  reactions: ReactionSummary[];
  /** Which edge of the thread the message sits on. */
  align?: 'start' | 'end';
  /** Anything else for the same row, such as the delete button. */
  children?: React.ReactNode;
}) {
  const [shown, toggle] = useOptimistic(reactions, withReactionToggled);
  const [, startTransition] = useTransition();
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const picker = useRef<HTMLDivElement>(null);

  // The picker closes the way every other floating thing here does: a tap
  // anywhere else, or Escape.
  useEffect(() => {
    if (!picking) return;
    const away = (event: PointerEvent) => {
      if (!picker.current?.contains(event.target as Node)) setPicking(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPicking(false);
    };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', escape);
    };
  }, [picking]);

  const react = (symbol: CommentReaction) => {
    setPicking(false);
    setError(null);
    startTransition(async () => {
      toggle(symbol);
      const result = await toggleReaction({ slug, commentId, emoji: symbol, eventSlug });
      if (result.error) setError(result.error);
    });
  };

  return (
    <div
      className={cn(
        'mt-1 flex flex-wrap items-center gap-1',
        align === 'end' ? 'justify-end' : 'justify-start',
      )}
    >
      {shown.map((face) => (
        <button
          key={face.symbol}
          type="button"
          onClick={() => react(face.symbol)}
          aria-pressed={face.mine}
          aria-label={`${REACTION_LABEL[face.symbol]}, ${face.count}: ${reactedBy(face.names)}`}
          title={reactedBy(face.names)}
          className={cn(
            'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs tabular-nums transition-colors pointer-coarse:py-1.5',
            face.mine
              ? 'border-accent/40 bg-accent/10 text-ink'
              : 'border-border-base bg-surface-raised text-ink-muted hover:bg-surface-sunken',
          )}
        >
          <span aria-hidden="true" className="text-sm leading-none">
            {face.symbol}
          </span>
          {face.count}
        </button>
      ))}
      <div ref={picker} className="relative">
        <button
          type="button"
          onClick={() => setPicking((open) => !open)}
          aria-label="Add a reaction"
          aria-expanded={picking}
          className="text-ink-subtle hover:text-ink hover:bg-surface-sunken rounded-full p-1.5 pointer-coarse:p-2.5"
        >
          <SmilePlus className="size-4" aria-hidden="true" />
        </button>
        {picking ? (
          <div
            role="menu"
            aria-label="Reactions"
            className={cn(
              'border-border-base bg-surface-raised shadow-card absolute bottom-full z-20 mb-1 flex gap-0.5 rounded-full border p-1',
              align === 'end' ? 'right-0' : 'left-0',
            )}
          >
            {COMMENT_REACTIONS.map((symbol) => (
              <button
                key={symbol}
                type="button"
                role="menuitem"
                onClick={() => react(symbol)}
                aria-label={REACTION_LABEL[symbol]}
                className={cn(
                  'hover:bg-surface-sunken rounded-full px-1.5 py-1 text-lg leading-none transition-transform hover:scale-110',
                  shown.some((face) => face.symbol === symbol && face.mine) && 'bg-accent/10',
                )}
              >
                {symbol}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {children}
      {error ? (
        <p role="alert" className="text-danger basis-full text-xs">
          {error}
        </p>
      ) : null}
    </div>
  );
}
