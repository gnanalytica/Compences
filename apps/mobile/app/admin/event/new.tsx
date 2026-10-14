import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { COPY, can, createActivitySchema, eventSlug } from '@compences/core';
import { useAuth } from '../../../src/lib/auth';
import { supabase } from '../../../src/lib/supabase';
import {
  Body,
  Button,
  Caption,
  Card,
  EmptyState,
  Heading,
  Input,
  Screen,
  Title,
} from '../../../src/components/ui';
import { ErrorText } from '../../../src/components/admin-ui';
import {
  ActivityTypeChips,
  BudgetLinesEditor,
  DetailsFields,
  budgetProblem,
  emptyDetails,
  lineAmount,
  newBudgetLine,
  validateDetails,
  type DraftActivity,
  type DraftBudgetLine,
  type EventDetails,
} from '../../../src/components/event-form';
import { spacing } from '../../../src/lib/theme';

/**
 * Staff and the committee create an event on the phone: details, budget and
 * activities in one go, saved as a draft or published straight away.
 */
export default function NewEvent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { role, user, activeCommunity } = useAuth();
  const currency = activeCommunity?.currency ?? 'INR';

  const [details, setDetails] = useState<EventDetails>(() =>
    emptyDetails(activeCommunity?.name ?? ''),
  );
  const [lines, setLines] = useState<DraftBudgetLine[]>(() => [newBudgetLine()]);
  const [activities, setActivities] = useState<DraftActivity[]>([]);
  const [busy, setBusy] = useState<'draft' | 'published' | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!can(role, 'events:manage')) {
    return (
      <Screen>
        <EmptyState title="Staff and committee only" />
      </Screen>
    );
  }

  const save = async (status: 'draft' | 'published') => {
    if (!activeCommunity || !user) return;
    const problem = budgetProblem(lines);
    if (problem) {
      setError(problem);
      return;
    }
    const budget = lines.filter((line) => line.category.label && lineAmount(line) > 0);
    const fundTarget = budget.reduce((sum, line) => sum + lineAmount(line), 0);
    const checked = validateDetails(details, activeCommunity.id, fundTarget);
    if ('error' in checked) {
      setError(checked.error);
      return;
    }
    for (const activity of activities) {
      const parsed = createActivitySchema.safeParse({
        event_id: activeCommunity.id,
        name: activity.name,
        emoji: activity.emoji || undefined,
      });
      if (!parsed.success) {
        setError(`Activity “${activity.name || 'untitled'}”: ${parsed.error.issues[0]?.message}`);
        return;
      }
    }
    const names = activities.map((activity) => activity.name.trim().toLowerCase());
    if (new Set(names).size !== names.length) {
      setError('Two activities have the same name.');
      return;
    }

    setBusy(status);
    setError(null);

    const { slug: _placeholder, ...values } = checked.values;
    // The web address comes from the name ("Deepavali 2026" → deepavali-2026).
    // If another event already has it, add a short random suffix and retry.
    let created: { id: string; slug: string } | null = null;
    for (let attempt = 0; attempt < 4 && !created; attempt += 1) {
      const { data, error: insertError } = await supabase
        .from('events')
        .insert({
          ...values,
          slug: eventSlug(
            details.name,
            attempt === 0 ? undefined : Math.random().toString(36).slice(2, 6),
          ),
          event_type_id: details.eventType.id,
          venue_id: details.venue.id,
          kind: 'event',
          status,
          created_by: user.id,
        })
        .select('id, slug')
        .single();
      if (insertError && insertError.code !== '23505') {
        setBusy(null);
        setError(insertError.message);
        return;
      }
      created = data;
    }
    if (!created) {
      setBusy(null);
      setError('Could not save the event. Please try again.');
      return;
    }

    const problems: string[] = [];
    if (budget.length) {
      const { error: budgetError } = await supabase.from('budget_lines').insert(
        budget.map((line, position) => ({
          event_id: created.id,
          community_id: activeCommunity.id,
          category: line.category.label as string,
          category_id: line.category.id,
          amount: lineAmount(line),
          position,
        })),
      );
      if (budgetError) problems.push('the budget');
    }
    if (activities.length) {
      const { error: activityError } = await supabase.from('event_activities').insert(
        activities.map((activity, position) => ({
          event_id: created.id,
          community_id: activeCommunity.id,
          name: activity.name.trim(),
          emoji: activity.emoji || undefined,
          activity_type_id: activity.typeId,
          position,
        })),
      );
      if (activityError) problems.push('the activities');
    }

    setBusy(null);
    await queryClient.invalidateQueries();
    const createdSlug = created.slug;
    const open = () =>
      router.replace({ pathname: '/admin/event/[slug]', params: { slug: createdSlug } });
    if (problems.length) {
      Alert.alert(
        'Event saved',
        `But ${problems.join(' and ')} didn’t save. Add them on the next screen.`,
        [{ text: 'OK', onPress: open }],
      );
      return;
    }
    open();
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ gap: 2 }}>
            <Title>New event</Title>
            <Caption>Only a name and date are required.</Caption>
          </View>

          <Card style={{ gap: spacing.lg }}>
            <Heading>Details</Heading>
            <DetailsFields details={details} onChange={setDetails} />
          </Card>

          <Card style={{ gap: spacing.lg }}>
            <Heading>Budget</Heading>
            <BudgetLinesEditor lines={lines} onChange={setLines} currency={currency} />
          </Card>

          <Card style={{ gap: spacing.md }}>
            <Heading>Activities</Heading>
            <ActivityTypeChips
              onPick={(item) =>
                setActivities((current) => [
                  ...current,
                  {
                    key: Math.random().toString(36).slice(2),
                    typeId: item.id,
                    name: item.label,
                    emoji: item.emoji ?? '',
                  },
                ])
              }
            />
            {activities.map((activity) => (
              <View
                key={activity.key}
                style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-end' }}
              >
                <View style={{ flex: 1 }}>
                  <Input
                    label="Activity name"
                    value={activity.name}
                    onChangeText={(name) =>
                      setActivities((current) =>
                        current.map((item) =>
                          item.key === activity.key ? { ...item, name } : item,
                        ),
                      )
                    }
                  />
                </View>
                <View style={{ width: 96 }}>
                  <Button
                    label="Remove"
                    variant="secondary"
                    onPress={() =>
                      setActivities((current) =>
                        current.filter((item) => item.key !== activity.key),
                      )
                    }
                  />
                </View>
              </View>
            ))}
            {!activities.length ? <Body muted>No activities yet.</Body> : null}
          </Card>

          <ErrorText message={error} />
          <Button
            label={COPY.publish}
            onPress={() => void save('published')}
            loading={busy === 'published'}
            disabled={busy !== null}
          />
          <Button
            label={COPY.saveForLater}
            variant="secondary"
            onPress={() => void save('draft')}
            loading={busy === 'draft'}
            disabled={busy !== null}
          />
          <Caption>{COPY.publishHint}</Caption>
          <View style={{ height: spacing.xl }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
