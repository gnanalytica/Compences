import { useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { relativeTime } from '@compences/core';
import { useAuth } from '../../src/lib/auth';
import { supabase } from '../../src/lib/supabase';
import { useCommunityData } from '../../src/lib/use-community-data';
import {
  Badge,
  Body,
  Button,
  Caption,
  Card,
  EmptyState,
  Heading,
  Input,
  Loading,
  Screen,
  Title,
} from '../../src/components/ui';
import { Meter } from '../../src/components/event-ui';
import { spacing } from '../../src/lib/theme';

export default function Community() {
  const router = useRouter();
  const { membershipId, activeCommunity } = useAuth();
  const [idea, setIdea] = useState('');
  const [busy, setBusy] = useState(false);

  const { data, loading, refreshing, refresh } = useCommunityData(
    'community',
    async (communityId) => {
      const [suggestions, stats, mine, polls] = await Promise.all([
        supabase
          .from('activity_suggestions')
          // Named on purpose: suggestion_votes, suggestion_interests and
          // comments all look like junction tables between activity_suggestions
          // and memberships, so a bare embed is ambiguous and PostgREST answers
          // 300 Multiple Choices instead of rows.
          .select(
            'id, name, description, created_at, memberships!activity_suggestions_suggested_by_fkey(profiles(full_name))',
          )
          .eq('community_id', communityId)
          .in('status', ['new', 'reviewing', 'accepted'])
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('suggestion_stats')
          .select('suggestion_id, interested')
          .eq('community_id', communityId),
        supabase
          .from('suggestion_interests')
          .select('suggestion_id')
          .eq('membership_id', membershipId ?? ''),
        supabase
          .from('polls')
          .select('id, question')
          .eq('community_id', communityId)
          .eq('status', 'voting')
          .limit(5),
      ]);

      const pollIds = (polls.data ?? []).map((poll) => poll.id);
      const [results, votes] = await Promise.all([
        pollIds.length
          ? supabase
              .from('poll_results')
              .select('poll_id, option_id, label, emoji, votes, total_votes, position')
              .in('poll_id', pollIds)
              .order('position')
          : Promise.resolve({ data: [] as never[] }),
        pollIds.length
          ? supabase
              .from('poll_votes')
              .select('poll_id, option_id')
              .eq('membership_id', membershipId ?? '')
              .in('poll_id', pollIds)
          : Promise.resolve({ data: [] as never[] }),
      ]);

      return {
        suggestions: suggestions.data ?? [],
        counts: new Map((stats.data ?? []).map((row) => [row.suggestion_id, row.interested ?? 0])),
        mine: new Set((mine.data ?? []).map((row) => row.suggestion_id)),
        polls: polls.data ?? [],
        results: results.data ?? [],
        myVotes: new Map((votes.data ?? []).map((row) => [row.poll_id, row.option_id])),
      };
    },
  );

  if (loading && !data) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  const toggleInterest = async (suggestionId: string, interested: boolean) => {
    if (!membershipId) return;
    const query = interested
      ? supabase
          .from('suggestion_interests')
          .delete()
          .eq('suggestion_id', suggestionId)
          .eq('membership_id', membershipId)
      : supabase
          .from('suggestion_interests')
          .upsert({ suggestion_id: suggestionId, membership_id: membershipId });
    await query;
    refresh();
  };

  const vote = async (pollId: string, optionId: string) => {
    if (!membershipId) return;
    // Changing your mind is allowed while a poll is open; voting twice is not.
    await supabase
      .from('poll_votes')
      .upsert(
        { poll_id: pollId, option_id: optionId, membership_id: membershipId, channel: 'mobile' },
        { onConflict: 'poll_id,membership_id' },
      );
    refresh();
  };

  const submitIdea = async () => {
    if (!membershipId || !activeCommunity || idea.trim().length < 3) return;
    setBusy(true);
    const { error } = await supabase.from('activity_suggestions').insert({
      community_id: activeCommunity.id,
      name: idea.trim().slice(0, 120),
      suggested_by: membershipId,
      status: 'new',
    });
    setBusy(false);
    if (error) {
      Alert.alert('That did not send', 'Please try again in a moment.');
      return;
    }
    setIdea('');
    refresh();
  };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        keyboardShouldPersistTaps="handled"
      >
        <Title>Community</Title>

        <Button
          label="See everyone in the society"
          variant="secondary"
          onPress={() => router.push('/people')}
        />

        {data?.polls.length ? (
          <Card style={{ gap: spacing.md }}>
            <Heading>Polls</Heading>
            {data.polls.map((poll) => {
              const options = data.results.filter((row) => row.poll_id === poll.id);
              const total = options[0]?.total_votes ?? 0;
              const myOption = data.myVotes.get(poll.id);
              return (
                <View key={poll.id} style={{ gap: spacing.sm }}>
                  <Body>{poll.question}</Body>
                  {options.map((option) => {
                    const share = total > 0 ? Math.round(((option.votes ?? 0) / total) * 100) : 0;
                    const mine = option.option_id === myOption;
                    return (
                      <Pressable
                        key={option.option_id}
                        accessibilityRole="button"
                        accessibilityState={{ selected: mine }}
                        onPress={() => vote(poll.id, option.option_id ?? '')}
                        style={{ gap: 4 }}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Caption>
                            {option.label}
                            {mine ? ' · your vote' : ''}
                          </Caption>
                          <Caption>{share}%</Caption>
                        </View>
                        <Meter percent={share} label={option.label ?? 'Option'} />
                      </Pressable>
                    );
                  })}
                  <Caption>
                    {total} {total === 1 ? 'vote' : 'votes'} · your ballot is private
                  </Caption>
                </View>
              );
            })}
          </Card>
        ) : null}

        <Card style={{ gap: spacing.md }}>
          <Heading>Suggest something</Heading>
          <Input
            value={idea}
            onChangeText={setIdea}
            placeholder="Weekend badminton tournament"
            label="Your idea"
          />
          <Button label="Send to the committee" onPress={submitIdea} loading={busy} />
        </Card>

        <View style={{ gap: spacing.md }}>
          <Heading>Ideas from residents</Heading>
          {data?.suggestions.length ? (
            data.suggestions.map((suggestion) => {
              const interested = data.mine.has(suggestion.id);
              return (
                <Card key={suggestion.id} style={{ gap: spacing.sm }}>
                  <Body>{suggestion.name}</Body>
                  {suggestion.description ? <Caption>{suggestion.description}</Caption> : null}
                  <Caption>
                    {suggestion.memberships?.profiles?.full_name ?? 'A resident'} ·{' '}
                    {relativeTime(suggestion.created_at)}
                  </Caption>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: interested }}
                    onPress={() => toggleInterest(suggestion.id, interested)}
                    style={{ alignSelf: 'flex-start' }}
                  >
                    <Badge
                      label={`${interested ? '✓ ' : ''}${data.counts.get(suggestion.id) ?? 0} interested`}
                      tone={interested ? 'success' : 'neutral'}
                    />
                  </Pressable>
                </Card>
              );
            })
          ) : (
            <Card>
              <EmptyState title="No ideas yet" description="Suggest something above." />
            </Card>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}
