import { MessageSquare } from 'lucide-react';
import { relativeTime, startsTurn, summarizeReactions } from '@compences/core';
import { getSupabase } from '@/lib/supabase/server';
import { cn } from '@/lib/utils';
import { CommentForm, CommentReactions, DeleteCommentButton } from './comment-forms';

export type CommentSubject = { eventId: string } | { suggestionId: string };

/**
 * The thread hanging off one event or one suggestion.
 *
 * A vote with no discussion is a poll. This is the other half: the argument
 * that produced the decision, kept next to it and searchable, instead of
 * scrolled away in a WhatsApp group where nobody can find it next year.
 *
 * Drawn as a conversation, because that is how people read it: your messages
 * on the right in the event's colour, everybody else's on the left with their
 * name over each turn, and the faces anyone can put on any message under it.
 */
export async function CommentThread({
  slug,
  subject,
  myMembershipId,
  canModerate,
  /** Folded away until asked for, on a card that is already busy. */
  collapsed = false,
  title = 'Discussion',
  eventSlug,
}: {
  slug: string;
  subject: CommentSubject;
  myMembershipId: string;
  canModerate: boolean;
  collapsed?: boolean;
  title?: string;
  /** So the page this thread is on is the page that gets refreshed. */
  eventSlug?: string;
}) {
  const supabase = await getSupabase();
  const query = supabase
    .from('comments')
    .select(
      'id, body, created_at, membership_id, memberships!comments_membership_id_fkey(profiles(full_name))',
    )
    .order('created_at')
    .limit(200);

  const { data } = await ('eventId' in subject
    ? query.eq('event_id', subject.eventId)
    : query.eq('suggestion_id', subject.suggestionId));

  const comments = data ?? [];
  const { data: reactionRows } = comments.length
    ? await supabase
        .from('comment_reactions')
        .select(
          'comment_id, emoji, membership_id, created_at, memberships!comment_reactions_membership_id_fkey(profiles(full_name))',
        )
        .in(
          'comment_id',
          comments.map((comment) => comment.id),
        )
        .order('created_at')
    : { data: [] };
  const reactions = summarizeReactions(
    (reactionRows ?? []).map((row) => ({
      comment_id: row.comment_id,
      emoji: row.emoji,
      membership_id: row.membership_id,
      name: row.memberships?.profiles?.full_name ?? null,
    })),
    myMembershipId,
  );

  const body = (
    <div className="space-y-4">
      {comments.length ? (
        <ul className="space-y-1.5" aria-label="Messages">
          {comments.map((comment, index) => {
            const mine = comment.membership_id === myMembershipId;
            const name = comment.memberships?.profiles?.full_name ?? 'A resident';
            const turn = startsTurn(comments[index - 1], comment);
            return (
              <li
                key={comment.id}
                className={cn('flex flex-col', mine ? 'items-end' : 'items-start', turn && 'pt-2')}
              >
                <div
                  className={cn('flex max-w-[85%] flex-col sm:max-w-[75%]', mine && 'items-end')}
                >
                  {turn ? (
                    <p className="text-ink-subtle mb-1 px-1 text-xs">
                      {mine ? null : <span className="text-ink font-medium">{name} · </span>}
                      <time dateTime={comment.created_at}>{relativeTime(comment.created_at)}</time>
                    </p>
                  ) : null}
                  <p
                    className={cn(
                      'rounded-2xl px-3.5 py-2 text-sm leading-relaxed break-words whitespace-pre-line',
                      mine
                        ? 'bg-accent text-accent-ink rounded-br-md'
                        : 'bg-ink/[0.06] text-ink rounded-bl-md',
                    )}
                  >
                    <span className="sr-only">{mine ? 'You said: ' : `${name} said: `}</span>
                    {comment.body}
                  </p>
                  <CommentReactions
                    slug={slug}
                    commentId={comment.id}
                    eventSlug={eventSlug}
                    reactions={reactions.get(comment.id) ?? []}
                    align={mine ? 'end' : 'start'}
                  >
                    {mine || canModerate ? (
                      <DeleteCommentButton
                        slug={slug}
                        commentId={comment.id}
                        eventSlug={eventSlug}
                      />
                    ) : null}
                  </CommentReactions>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-ink-subtle text-sm">Nothing said yet. Start the conversation.</p>
      )}
      <CommentForm slug={slug} subject={subject} eventSlug={eventSlug} />
    </div>
  );

  if (!collapsed) return body;

  return (
    <details className="group mt-3">
      <summary className="text-ink-muted hover:text-ink flex cursor-pointer list-none items-center gap-1.5 text-xs font-medium [&::-webkit-details-marker]:hidden">
        <MessageSquare className="size-3.5" aria-hidden="true" />
        {comments.length
          ? `${comments.length} ${comments.length === 1 ? 'comment' : 'comments'}`
          : title}
      </summary>
      <div className="border-border-base mt-3 border-t pt-3">{body}</div>
    </details>
  );
}
