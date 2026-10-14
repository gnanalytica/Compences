import Link from 'next/link';
import { Lightbulb, ThumbsDown, ThumbsUp, Users } from 'lucide-react';
import { relativeTime } from '@compences/core';
import type { SuggestionRow } from '@/lib/events';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { EmptyState } from '@/components/ui/empty-state';
import { FundBar } from '@/components/badges';
import { CommentThread } from '@/components/comment-thread';
import { decideSuggestion } from '@/app/app/[community]/admin/events/actions';
import { closeSuggestionVote, voteOnSuggestion } from '@/app/app/[community]/events/actions';

/**
 * Who voted, for the people allowed to know.
 *
 * A vote in favour is public to the society: fourteen named neighbours behind
 * an idea is a petition, and that is worth more to the committee than the
 * number fourteen. A vote against is shown to the committee only, because the
 * people a "no" is usually aimed at are the ones who have to weigh it.
 *
 * Nobody is ever listed as not having voted. There is no row for an abstention,
 * so the database cannot leak one, and the counts here are the rows this reader
 * may see — the real tally, which may be larger, stays on the bar above.
 */
function Voters({ row, canApprove }: { row: SuggestionRow; canApprove: boolean }) {
  const supporters = row.voters.filter((vote) => vote.support);
  const opponents = row.voters.filter((vote) => !vote.support);
  const named = canApprove ? supporters.length + opponents.length : supporters.length;
  if (!named) return null;

  return (
    <details className="group mt-3">
      <summary className="text-ink-muted hover:text-ink flex cursor-pointer list-none items-center gap-1.5 text-xs font-medium [&::-webkit-details-marker]:hidden">
        <Users className="size-3.5" aria-hidden="true" />
        Who voted
      </summary>
      <div className="border-border-base mt-2 space-y-2 border-t pt-2">
        {supporters.length ? (
          <div>
            <p className="text-ink-subtle text-xs font-medium">In favour</p>
            <p className="text-ink mt-0.5 text-sm">
              {supporters.map((vote) => vote.name).join(', ')}
            </p>
          </div>
        ) : null}
        {canApprove && opponents.length ? (
          <div>
            <p className="text-ink-subtle text-xs font-medium">Against · committee only</p>
            <p className="text-ink mt-0.5 text-sm">
              {opponents.map((vote) => vote.name).join(', ')}
            </p>
          </div>
        ) : null}
        {!canApprove && row.votesAgainst ? (
          <p className="text-ink-subtle text-xs">
            {row.votesAgainst} {row.votesAgainst === 1 ? 'vote' : 'votes'} against are counted but
            not named.
          </p>
        ) : null}
      </div>
    </details>
  );
}

/**
 * A suggestion's three stages, on one board: open for voting, with the
 * committee, and not taken forward.
 *
 * The middle stage is the point. Before it existed a suggestion vanished the
 * moment it was sent — the person who made it saw "Nothing to vote on yet",
 * and the committee only found it by opening the To do queue. Now everybody
 * sees what is waiting, and whoever may open it for voting can do so here.
 *
 * The same board serves an event's page and the Ideas page. The difference is
 * `showEvent`: an event's page knows what its suggestions are about, the Ideas
 * page mixes both kinds and has to say. Which event a row belongs to is read
 * from the row either way, so a vote cast from Ideas refreshes the event page
 * it also appears on.
 */
export function SuggestionBoard({
  slug,
  eventSlug,
  rows,
  myMembershipId,
  canVote,
  canApprove,
  emptyDescription,
  showEvent = false,
}: {
  slug: string;
  /** The event whose page this board is on. Absent on the Ideas page. */
  eventSlug?: string;
  rows: SuggestionRow[];
  myMembershipId: string;
  canVote: boolean;
  canApprove: boolean;
  /** Shown when nothing is open for voting and nothing is waiting either. */
  emptyDescription: string;
  /** Name the event each row belongs to — for the board that mixes both. */
  showEvent?: boolean;
}) {
  const voting = rows.filter((row) => row.status === 'accepted');
  const waiting = rows.filter((row) => row.status === 'new');
  // What the society actually decided, and when. Before this existed a vote
  // simply ran for ever.
  const decided = rows.filter((row) => row.status === 'adopted' || row.status === 'not_adopted');
  const declined = rows.filter(
    (row) => row.suggested_by === myMembershipId && row.status === 'declined',
  );

  const who = (row: SuggestionRow) =>
    row.suggested_by === myMembershipId
      ? 'you'
      : (row.memberships?.profiles?.full_name ?? 'a resident');

  const kind = (row: SuggestionRow) => (row.kind === 'idea' ? 'Idea' : 'Activity');

  /**
   * Which event a row is about, on the board that mixes both kinds.
   *
   * A link rather than a label: a suggestion about Dasara is really a question
   * about Dasara, and that page is where the rest of the answer is.
   */
  const Where = ({ row, lead = true }: { row: SuggestionRow; lead?: boolean }) => {
    if (!showEvent) return null;
    // The separator belongs to the sentence this joins, not to the phrase, so
    // a row that says nothing else does not open with a stray dot.
    const sep = lead ? '· ' : '';
    if (!row.events) return <span className="text-ink-subtle text-xs">{sep}For the society</span>;
    return (
      <Link
        href={`/app/${slug}/events/${row.events.slug}#vote`}
        className="text-ink-subtle hover:text-ink text-xs underline underline-offset-2"
      >
        {sep}
        {row.events.name}
      </Link>
    );
  };

  // A vote cast here belongs to that event's page as much as to this one, so
  // the action is told which event to refresh — the board itself may be on
  // neither.
  const eventOf = (row: SuggestionRow) => row.events?.slug ?? eventSlug;

  return (
    <div className="space-y-3">
      {voting.length ? (
        voting.map((row) => {
          const total = row.votesFor + row.votesAgainst;
          const forPct = total ? Math.round((row.votesFor / total) * 100) : 0;
          return (
            <Card key={row.id}>
              <CardBody>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-ink text-sm font-semibold">{row.name}</p>
                    <p className="text-ink-subtle mt-0.5 text-xs">
                      {kind(row)} suggested by {who(row)} <Where row={row} />
                    </p>
                    {row.description ? (
                      <p className="text-ink-muted mt-1.5 text-sm">{row.description}</p>
                    ) : null}
                  </div>
                  <Badge tone="success">Voting</Badge>
                </div>
                <div className="mt-3">
                  <div className="text-ink-muted mb-1 flex justify-between text-xs font-medium">
                    <span>
                      {row.votesFor} for · {row.votesAgainst} against
                    </span>
                    <span>{total ? `${forPct}% in favour` : 'No votes yet'}</span>
                  </div>
                  <FundBar percent={forPct} />
                </div>
                {canVote ? (
                  <form
                    action={voteOnSuggestion}
                    className="mt-3 flex flex-wrap items-center gap-2"
                  >
                    <input type="hidden" name="slug" value={slug} />
                    {eventOf(row) ? (
                      <input type="hidden" name="event" value={eventOf(row)} />
                    ) : null}
                    <input type="hidden" name="suggestion_id" value={row.id} />
                    <Button
                      type="submit"
                      name="support"
                      value="1"
                      size="sm"
                      variant={row.myVote === true ? 'primary' : 'secondary'}
                      aria-pressed={row.myVote === true}
                    >
                      <ThumbsUp className="size-4" aria-hidden="true" />
                      For
                    </Button>
                    <Button
                      type="submit"
                      name="support"
                      value="0"
                      size="sm"
                      variant={row.myVote === false ? 'primary' : 'secondary'}
                      aria-pressed={row.myVote === false}
                    >
                      <ThumbsDown className="size-4" aria-hidden="true" />
                      Against
                    </Button>
                    {row.myVote !== null ? (
                      <Button type="submit" name="withdraw" value="1" size="sm" variant="ghost">
                        Withdraw vote
                      </Button>
                    ) : null}
                  </form>
                ) : null}
                <Voters row={row} canApprove={canApprove} />
                <CommentThread
                  slug={slug}
                  subject={{ suggestionId: row.id }}
                  eventSlug={eventSlug}
                  myMembershipId={myMembershipId}
                  canModerate={canApprove}
                  collapsed
                  title="Discuss it"
                />
                {canApprove ? (
                  <form
                    action={closeSuggestionVote}
                    className="border-border-base mt-3 flex flex-wrap items-center gap-2 border-t pt-3"
                  >
                    <input type="hidden" name="slug" value={slug} />
                    {eventOf(row) ? (
                      <input type="hidden" name="event" value={eventOf(row)} />
                    ) : null}
                    <input type="hidden" name="suggestion_id" value={row.id} />
                    <span className="text-ink-subtle text-xs">
                      {total
                        ? `Close it and ${forPct >= 50 ? 'the society adopts this' : 'it is not taken forward'}.`
                        : 'Nobody has voted yet.'}
                    </span>
                    <Button type="submit" size="sm" variant="secondary">
                      Close voting
                    </Button>
                  </form>
                ) : null}
              </CardBody>
            </Card>
          );
        })
      ) : (
        <Card>
          <EmptyState
            icon={<Lightbulb className="size-6" />}
            title="Nothing to vote on yet"
            description={
              waiting.length
                ? canApprove
                  ? `${waiting.length} ${waiting.length === 1 ? 'suggestion is' : 'suggestions are'} waiting on you below.`
                  : `${waiting.length} ${waiting.length === 1 ? 'suggestion is' : 'suggestions are'} with the committee. Once opened, ${waiting.length === 1 ? 'it lands' : 'they land'} here to vote on.`
                : emptyDescription
            }
          />
        </Card>
      )}

      {waiting.length ? (
        <Card>
          <CardHeader
            title="With the committee"
            description={
              canApprove
                ? 'Open one for voting and every resident can have their say on it.'
                : 'Waiting for the committee to open them for voting.'
            }
          />
          <ul className="divide-border-base divide-y">
            {waiting.map((row) => (
              <li key={row.id} className="px-5 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-ink text-sm font-medium">{row.name}</p>
                    <p className="text-ink-subtle mt-0.5 text-xs">
                      {kind(row)} suggested by {who(row)} <Where row={row} />
                    </p>
                    {row.description ? (
                      <p className="text-ink-muted mt-1.5 text-sm">{row.description}</p>
                    ) : null}
                  </div>
                  <Badge tone="warning">Waiting</Badge>
                </div>
                {canApprove ? (
                  <form action={decideSuggestion} className="mt-3 space-y-2">
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="suggestion_id" value={row.id} />
                    <label htmlFor={`sg-note-${row.id}`} className="sr-only">
                      Note for the resident
                    </label>
                    <Input
                      id={`sg-note-${row.id}`}
                      name="note"
                      placeholder="Note for the resident (optional)"
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button type="submit" name="approve" value="1" size="sm">
                        Open for voting
                      </Button>
                      <Button type="submit" name="approve" value="0" size="sm" variant="ghost">
                        Decline
                      </Button>
                    </div>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {decided.length ? (
        <Card>
          <CardHeader
            title="Decided"
            description="Votes the committee has closed, and what the society said."
          />
          <ul className="divide-border-base divide-y">
            {decided.map((row) => {
              const adopted = row.status === 'adopted';
              return (
                <li key={row.id} className="flex items-start justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-ink text-sm font-medium">{row.name}</p>
                    <p className="text-ink-subtle mt-0.5 text-xs">
                      {row.votesFor} for · {row.votesAgainst} against
                      {row.resolved_at ? ` · closed ${relativeTime(row.resolved_at)}` : ''}{' '}
                      <Where row={row} />
                    </p>
                    <Voters row={row} canApprove={canApprove} />
                  </div>
                  <Badge tone={adopted ? 'success' : 'neutral'}>
                    {adopted ? 'Adopted' : 'Not adopted'}
                  </Badge>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

      {declined.length ? (
        <Card>
          <CardHeader title="Not taken forward" />
          <ul className="divide-border-base divide-y">
            {declined.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="text-ink text-sm">{row.name}</p>
                  {row.review_note ? (
                    <p className="text-ink-subtle text-xs">“{row.review_note}”</p>
                  ) : null}
                  <p className="text-xs">
                    <Where row={row} lead={false} />
                  </p>
                </div>
                <Badge tone="neutral">Declined</Badge>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
