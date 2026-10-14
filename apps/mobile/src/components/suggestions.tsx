import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { can } from '@compences/core';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import type { Tally } from '../lib/events';
import { Badge, Body, Button, Caption, Card, EmptyState, Heading, Input } from './ui';
import { Chip, ChipRow, ErrorText } from './admin-ui';
import { Meter } from './event-ui';
import { spacing } from '../lib/theme';

/** One row of activity_suggestions, with its votes counted. */
export type SuggestionRow = {
  id: string;
  kind: string;
  name: string;
  description: string | null;
  status: string;
  suggested_by: string | null;
  tally: Tally;
  /** Present on the Ideas screen, where a row may belong to an event. */
  events?: { slug: string; name: string; emoji: string | null } | null;
};

/** Where a new suggestion goes. A null id means the society itself. */
export type SuggestionTarget = { id: string | null; label: string };

/**
 * Suggestions, their votes, and the form for adding one.
 *
 * It was written inside the event screen and lived only there, which is how
 * the phone app ended up with no way to suggest anything about the society
 * itself — the shape existed, it was just nailed to one page. Both screens
 * render this now, so a change to how voting reads happens once.
 *
 * `targets` is what makes it work in both places. The event screen passes the
 * one event, so no picker appears; the Ideas screen passes the society and
 * every event still open, so a resident can say which one they mean.
 */
export function Suggestions({
  rows,
  targets,
  open,
  onChange,
  showEvent = false,
  emptyDescription = 'Suggestions the committee opens for voting appear here.',
  suggestLabel = 'SUGGEST AN IDEA',
  suggestHint,
}: {
  rows: SuggestionRow[];
  targets: SuggestionTarget[];
  /** Whether new suggestions are being accepted at all. */
  open: boolean;
  onChange: () => void;
  /** Name the event each suggestion belongs to, and link through to it. */
  showEvent?: boolean;
  emptyDescription?: string;
  /** Over the form: what is being suggested, and for what. */
  suggestLabel?: string;
  /** A line under it, when where the idea goes needs saying. */
  suggestHint?: string;
}) {
  const router = useRouter();
  const { viewRole: role, membershipId, activeCommunity } = useAuth();
  const [kind, setKind] = useState<'activity' | 'idea'>('activity');
  const [target, setTarget] = useState<string | null>(targets[0]?.id ?? null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const mayVote = can(role, 'vote');
  const maySuggest = open && can(role, 'suggest') && targets.length > 0;
  const voting = rows.filter((row) => row.status === 'accepted');
  // A resident sees their own waiting suggestion so it does not look lost;
  // staff and the committee see everyone's, because clearing them is the job.
  const waiting = rows.filter(
    (row) =>
      row.status !== 'accepted' &&
      (row.suggested_by === membershipId || can(role, 'events:manage')),
  );

  const submit = async () => {
    if (!membershipId || !activeCommunity) return;
    if (name.trim().length < 3) {
      setError('Give your suggestion a short title.');
      return;
    }
    setBusy('submit');
    setError(null);
    const { error: insertError } = await supabase.from('activity_suggestions').insert({
      community_id: activeCommunity.id,
      event_id: target,
      kind,
      name: name.trim(),
      description: description.trim() || null,
      suggested_by: membershipId,
      status: 'new',
    });
    setBusy(null);
    if (insertError) {
      setError('That did not go through. Please try again.');
      return;
    }
    setName('');
    setDescription('');
    setSent(true);
    onChange();
  };

  const vote = async (suggestionId: string, support: boolean) => {
    if (!membershipId) return;
    setBusy(suggestionId);
    const { error: voteError } = await supabase
      .from('suggestion_votes')
      .upsert(
        { suggestion_id: suggestionId, membership_id: membershipId, support },
        { onConflict: 'suggestion_id,membership_id' },
      );
    setBusy(null);
    if (voteError) {
      Alert.alert('Your vote did not go through', 'Voting may have closed. Pull down to refresh.');
      return;
    }
    onChange();
  };

  if (!voting.length && !waiting.length && !maySuggest) {
    return (
      <Card>
        <EmptyState title="Nothing to vote on yet" description={emptyDescription} />
      </Card>
    );
  }

  return (
    <Card style={{ gap: spacing.lg }}>
      <View style={{ gap: 2 }}>
        <Heading>Ideas</Heading>
        <Caption>
          The committee reviews each suggestion, then residents vote. One vote per person.
        </Caption>
      </View>

      {voting.map((row) => {
        const total = row.tally.support + row.tally.against;
        const percent = total > 0 ? Math.round((row.tally.support / total) * 100) : 0;
        return (
          <View key={row.id} style={{ gap: spacing.sm }}>
            <View
              style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Body>{row.name}</Body>
                {row.description ? <Caption>{row.description}</Caption> : null}
                <EventLine row={row} show={showEvent} onOpen={openEvent(router)} />
              </View>
              <Badge label={row.kind === 'idea' ? 'Idea' : 'Activity'} />
            </View>
            <Meter percent={percent} tone="success" label={`${row.name}: support`} />
            <Caption>
              {row.tally.support} for · {row.tally.against} against
              {row.tally.mine === null ? '' : ` · you voted ${row.tally.mine ? 'for' : 'against'}`}
            </Caption>
            {mayVote ? (
              <ChipRow>
                <Chip
                  label="For"
                  selected={row.tally.mine === true}
                  onPress={() => void vote(row.id, true)}
                  disabled={busy !== null}
                />
                <Chip
                  label="Against"
                  selected={row.tally.mine === false}
                  onPress={() => void vote(row.id, false)}
                  disabled={busy !== null}
                />
              </ChipRow>
            ) : null}
          </View>
        );
      })}

      {waiting.length ? (
        <View style={{ gap: spacing.xs }}>
          <Caption>WAITING FOR THE COMMITTEE</Caption>
          {waiting.map((row) => (
            <View key={row.id} style={{ gap: 2 }}>
              <Body muted>{row.name}</Body>
              <EventLine row={row} show={showEvent} onOpen={openEvent(router)} />
            </View>
          ))}
        </View>
      ) : null}

      {maySuggest ? (
        <View style={{ gap: spacing.sm }}>
          <Caption>{suggestLabel}</Caption>
          {suggestHint ? <Caption>{suggestHint}</Caption> : null}
          {/* Only worth asking when there is a choice: on an event's own page
              there is exactly one answer and the picker would be furniture. */}
          {targets.length > 1 ? (
            <ChipRow>
              {targets.map((option) => (
                <Chip
                  key={option.id ?? 'society'}
                  label={option.label}
                  selected={target === option.id}
                  onPress={() => setTarget(option.id)}
                />
              ))}
            </ChipRow>
          ) : null}
          <ChipRow>
            <Chip
              label="Activity"
              selected={kind === 'activity'}
              onPress={() => setKind('activity')}
            />
            <Chip label="Idea" selected={kind === 'idea'} onPress={() => setKind('idea')} />
          </ChipRow>
          <Input
            value={name}
            onChangeText={(value) => {
              setName(value);
              setSent(false);
            }}
            placeholder={kind === 'activity' ? 'e.g. Kids’ lantern walk' : 'e.g. Eco-friendly idol'}
          />
          <Input
            value={description}
            onChangeText={setDescription}
            placeholder="A line or two of detail (optional)"
            multiline
          />
          <Button
            label="Send to the committee"
            onPress={() => void submit()}
            loading={busy === 'submit'}
          />
          {sent ? <Caption>Sent to the committee for review.</Caption> : null}
          <ErrorText message={error} />
        </View>
      ) : null}
    </Card>
  );
}

const openEvent = (router: ReturnType<typeof useRouter>) => (slug: string) =>
  router.push({ pathname: '/event/[slug]', params: { slug, tab: 'vote' } });

/**
 * Which event a suggestion is about, on the screen that mixes both kinds.
 *
 * Not a bare label: a suggestion about Dasara is really a question about
 * Dasara, and the page that answers it is one tap away.
 */
function EventLine({
  row,
  show,
  onOpen,
}: {
  row: SuggestionRow;
  show: boolean;
  onOpen: (slug: string) => void;
}) {
  if (!show) return null;
  if (!row.events) return <Caption>For the society</Caption>;
  const { slug, name } = row.events;
  return (
    <Pressable accessibilityRole="link" onPress={() => onOpen(slug)}>
      <Caption>{name} ›</Caption>
    </Pressable>
  );
}
