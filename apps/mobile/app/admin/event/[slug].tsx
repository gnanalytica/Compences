import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  COPY,
  EVENT_STATUS_LABEL,
  NEW_EDITION,
  SURPLUS_ANSWERS,
  SURPLUS_ANSWER_DETAIL,
  SURPLUS_ANSWER_LABEL,
  NO_VENDOR,
  can,
  createActivitySchema,
  eventMoney,
  eventSlug as makeEventSlug,
  formatDate,
  formatMoney,
  nextEditionDate,
  nextEditionName,
  normalizeStats,
  placesProblem,
  practiceDatesLine,
  type FundRule,
  surplusKindFor,
  type SurplusAnswer,
  updateActivitySchema,
  vendorGroups,
} from '@compences/core';
import { useAuth } from '../../../src/lib/auth';
import { EventBalanceCard } from '../../../src/components/event-ui';
import { supabase } from '../../../src/lib/supabase';
import { useCommunityData } from '../../../src/lib/use-community-data';
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
} from '../../../src/components/ui';
import { Chip, ChipRow, ErrorText } from '../../../src/components/admin-ui';
import { DateField } from '../../../src/components/date-field';
import {
  ActivityTypeChips,
  BudgetLinesEditor,
  budgetLineRows,
  budgetProblem,
  DetailsFields,
  filledBudgetLines,
  newBudgetLine,
  validateDetails,
  type DraftBudgetLine,
  type EventDetails,
} from '../../../src/components/event-form';
import { spacing } from '../../../src/lib/theme';

async function loadEvent(communityId: string, slug: string) {
  const { data: event } = await supabase
    .from('events')
    .select(
      'id, community_id, slug, emoji, name, kind, status, starts_on, ends_on, venue, venue_id, event_type_id, organizer, description, expected_attendance, fund_target, fund_rule, fund_rule_note, created_by',
    )
    .eq('community_id', communityId)
    .eq('slug', slug)
    .maybeSingle();
  if (!event) return null;
  const [budget, activities, openBills, stats, eventType, openEvents, society] = await Promise.all([
    supabase
      .from('budget_lines')
      .select('id, category, category_id, vendor, vendor_id, amount, position')
      .eq('event_id', event.id)
      .order('position'),
    // Who registered, and who registered them, as the web's organiser page lists them.
    supabase
      .from('event_activities')
      .select(
        'id, name, emoji, description, capacity, is_open, coordinator_id, practice_dates, memberships!event_activities_coordinator_id_fkey(profiles(full_name)), activity_participants(id, participant_name, memberships!activity_participants_membership_id_fkey(profiles(full_name)))',
      )
      .eq('event_id', event.id)
      .order('position')
      .order('joined_at', { referencedTable: 'activity_participants' }),
    supabase
      .from('expenses')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', event.id)
      .in('status', ['pending', 'changes_requested']),
    supabase.from('event_stats').select('*').eq('event_id', event.id).maybeSingle(),
    event.event_type_id
      ? supabase.from('catalogue_items').select('label').eq('id', event.event_type_id).maybeSingle()
      : Promise.resolve({ data: null }),
    // Events a surplus can be carried into: still open, and not this one.
    supabase
      .from('events')
      .select('id, name, emoji, starts_on')
      .eq('community_id', event.community_id)
      .in('status', ['draft', 'published'])
      .neq('id', event.id)
      .order('starts_on', { ascending: true })
      .limit(100),
    supabase
      .from('society_balance')
      .select('balance')
      .eq('community_id', event.community_id)
      .maybeSingle(),
  ]);
  return {
    event,
    eventTypeLabel: eventType.data?.label ?? null,
    budget: budget.data ?? [],
    activities: (activities.data ?? []).map(({ activity_participants: people, ...activity }) => ({
      ...activity,
      people,
      registrations: people.length,
    })),
    openBills: openBills.count ?? 0,
    stats: stats.data,
    openEvents: openEvents.data ?? [],
    societyBalance: Number(society.data?.balance ?? 0),
  };
}

type Loaded = NonNullable<Awaited<ReturnType<typeof loadEvent>>>;

/** Staff and the committee run an event from the phone. */
export default function ManageEvent() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { role, activeCommunity } = useAuth();
  const router = useRouter();
  const { data, loading, refreshing, refresh } = useCommunityData(
    `admin:event:${slug}`,
    (communityId) => loadEvent(communityId, String(slug)),
  );

  if (!can(role, 'events:manage')) {
    return (
      <Screen>
        <EmptyState title="Staff and committee only" />
      </Screen>
    );
  }
  if (loading && !data) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }
  if (!data) {
    return (
      <Screen>
        <EmptyState title="Event not found" />
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        >
          <StatusCard data={data} onChange={refresh} />
          {/* What is left to spend, where nobody can miss it: nobody should
              commit to a bill without knowing whether the event can pay it. */}
          {data.event.status !== 'proposed' ? (
            <EventBalanceCard
              money={eventMoney(normalizeStats(data.stats))}
              currency={activeCommunity?.currency ?? 'INR'}
              onPayBack={can(role, 'expenses:approve') ? () => router.push('/manage') : undefined}
            />
          ) : null}
          <SurplusCard data={data} onChange={refresh} />
          <BringInBalanceCard data={data} onChange={refresh} />
          <DetailsCard key={`details:${data.event.id}`} data={data} onChange={refresh} />
          <BudgetCard data={data} onChange={refresh} />
          <ActivitiesCard data={data} onChange={refresh} />
          <View style={{ height: spacing.xl }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function useInvalidate(onChange: () => void) {
  const queryClient = useQueryClient();
  return async () => {
    onChange();
    await queryClient.invalidateQueries();
  };
}

function StatusCard({ data, onChange }: { data: Loaded; onChange: () => void }) {
  const router = useRouter();
  const { role, activeCommunity, membershipId } = useAuth();
  const invalidate = useInvalidate(onChange);
  const { event } = data;
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const currency = activeCommunity?.currency ?? 'INR';

  const setStatus = async (status: 'draft' | 'published' | 'cancelled') => {
    setBusy(status);
    setError(null);
    const { error: updateError } = await supabase
      .from('events')
      .update({ status })
      .eq('id', event.id)
      .neq('status', 'proposed');
    setBusy(null);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    await invalidate();
  };

  const confirmCancel = () =>
    Alert.alert('Cancel this event?', 'Residents will see it as cancelled.', [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Cancel event', style: 'destructive', onPress: () => void setStatus('cancelled') },
    ]);

  const close = async () => {
    if (confirmName.trim().toLowerCase() !== event.name.trim().toLowerCase()) {
      setError('Type the event name exactly to close it.');
      return;
    }
    if (data.openBills > 0) {
      setError(
        `${data.openBills} bill${data.openBills === 1 ? '' : 's'} still waiting for a decision. Decide on them before closing.`,
      );
      return;
    }
    setBusy('completed');
    setError(null);
    const stats = data.stats;
    const { error: updateError } = await supabase
      .from('events')
      .update({
        status: 'completed',
        closing_summary: {
          closed_at: new Date().toISOString(),
          closed_by: membershipId,
          raised: stats?.fund_raised ?? 0,
          spent: stats?.spent ?? 0,
          surplus: Number(stats?.fund_raised ?? 0) - Number(stats?.spent ?? 0),
          contributors: stats?.contributors ?? 0,
          participants: stats?.participants ?? 0,
        },
      })
      .eq('id', event.id);
    setBusy(null);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setClosing(false);
    await invalidate();
  };

  const proposed = event.status === 'proposed';
  const finished = event.status === 'completed' || event.status === 'cancelled';

  return (
    <Card style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Title>{event.name}</Title>
          <Caption>
            {formatMoney(Number(data.stats?.fund_raised ?? 0), currency)} raised ·{' '}
            {formatMoney(Number(data.stats?.spent ?? 0), currency)} spent ·{' '}
            {data.stats?.contributors ?? 0} households
          </Caption>
        </View>
        <Badge label={EVENT_STATUS_LABEL[event.status]} tone={proposed ? 'warning' : 'neutral'} />
      </View>

      {proposed ? (
        <Caption>A resident’s campaign. The committee approves it from To do.</Caption>
      ) : null}

      {!proposed && !finished ? (
        <View style={{ gap: spacing.sm }}>
          {event.status === 'draft' ? (
            <>
              <Button
                label={COPY.publish}
                onPress={() => void setStatus('published')}
                loading={busy === 'published'}
              />
              <Caption>{COPY.publishHint}</Caption>
            </>
          ) : (
            <Button
              label="Hide from residents"
              variant="secondary"
              onPress={() => void setStatus('draft')}
              loading={busy === 'draft'}
            />
          )}
          <Button
            label="Cancel event"
            variant="secondary"
            onPress={confirmCancel}
            loading={busy === 'cancelled'}
          />
          {can(role, 'events:close') && event.status === 'published' ? (
            closing ? (
              <View style={{ gap: spacing.sm }}>
                <Caption>
                  Closing publishes the final accounts and locks the ledger. Type “{event.name}” to
                  confirm.
                </Caption>
                <Input value={confirmName} onChangeText={setConfirmName} placeholder={event.name} />
                <Button
                  label="Close and publish accounts"
                  onPress={() => void close()}
                  loading={busy === 'completed'}
                />
                <Button label="Not yet" variant="secondary" onPress={() => setClosing(false)} />
              </View>
            ) : data.openBills > 0 ? (
              <Caption>
                {data.openBills} bill{data.openBills === 1 ? '' : 's'} still waiting for a decision;
                close the event once they’re decided.
              </Caption>
            ) : (
              <Button label="Close event" variant="secondary" onPress={() => setClosing(true)} />
            )
          ) : null}
        </View>
      ) : null}

      <ErrorText message={error} />
      <Button
        label="Open the event page"
        variant="secondary"
        onPress={() => router.push(`/event/${event.slug}`)}
      />
    </Card>
  );
}

function DetailsCard({ data, onChange }: { data: Loaded; onChange: () => void }) {
  const { activeCommunity } = useAuth();
  const invalidate = useInvalidate(onChange);
  const { event } = data;
  const [details, setDetails] = useState<EventDetails>(() => ({
    emoji: event.emoji,
    name: event.name,
    eventType: { id: event.event_type_id, label: data.eventTypeLabel },
    venue: { id: event.venue_id, label: event.venue },
    startsOn: event.starts_on,
    endsOn: event.ends_on ?? '',
    description: event.description ?? '',
    organizer: event.organizer ?? '',
    attendance: event.expected_attendance ? String(event.expected_attendance) : '',
    fundRule: event.fund_rule as FundRule,
    fundRuleNote: event.fund_rule_note ?? '',
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const locked = event.status === 'completed' || event.status === 'cancelled';

  const save = async () => {
    if (!activeCommunity) return;
    const checked = validateDetails(details, activeCommunity.id, Number(event.fund_target));
    if ('error' in checked) {
      setError(checked.error);
      return;
    }
    setBusy(true);
    setError(null);
    const values = checked.values;
    const { error: updateError } = await supabase
      .from('events')
      .update({
        emoji: values.emoji,
        name: values.name,
        starts_on: values.starts_on,
        ends_on: values.ends_on ?? null,
        venue: values.venue ?? null,
        venue_id: details.venue.id,
        event_type_id: details.eventType.id,
        organizer: values.organizer ?? null,
        description: values.description ?? null,
        expected_attendance: values.expected_attendance ?? null,
        // No fund_rule here: it is fixed when the event is created.
      })
      .eq('id', event.id);
    setBusy(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setSaved(true);
    await invalidate();
  };

  if (locked) return null;

  return (
    <Card style={{ gap: spacing.lg }}>
      <Heading>Details</Heading>
      <DetailsFields
        details={details}
        onChange={(next) => {
          setDetails(next);
          setSaved(false);
        }}
        fundRuleLocked
      />
      <ErrorText message={error} />
      {saved ? <Caption>Saved.</Caption> : null}
      <Button label="Save details" onPress={() => void save()} loading={busy} />
    </Card>
  );
}

/** Keeps the event's fund target equal to the sum of its budget lines. */
async function syncFundTarget(eventId: string) {
  const { data } = await supabase.from('budget_lines').select('amount').eq('event_id', eventId);
  const total = (data ?? []).reduce((sum, line) => sum + Number(line.amount), 0);
  await supabase.from('events').update({ fund_target: total }).eq('id', eventId);
}

/**
 * The budget as vendors and their services, each with what is set aside for
 * it. New vendors and services are typed below, in the same editor as a new
 * event's, and saved together; "Add a service" on a vendor starts one there
 * with the vendor already named.
 */
function BudgetCard({ data, onChange }: { data: Loaded; onChange: () => void }) {
  const { activeCommunity, user } = useAuth();
  const invalidate = useInvalidate(onChange);
  const currency = activeCommunity?.currency ?? 'INR';
  const { event } = data;
  const [drafts, setDrafts] = useState<DraftBudgetLine[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const locked = event.status === 'completed' || event.status === 'cancelled';
  const total = data.budget.reduce((sum, line) => sum + Number(line.amount), 0);

  const save = async () => {
    const problem = budgetProblem(drafts);
    if (problem) {
      setError(problem);
      return;
    }
    const filled = filledBudgetLines(drafts);
    if (!filled.length) {
      setError('Add a service and its budget.');
      return;
    }
    if (!activeCommunity) return;
    setBusy('add');
    setError(null);
    const rows = await budgetLineRows(
      filled,
      event.id,
      activeCommunity.id,
      user?.id ?? null,
      data.budget.length,
    );
    const { error: insertError } = await supabase.from('budget_lines').insert(rows);
    if (insertError) {
      setBusy(null);
      setError(insertError.message);
      return;
    }
    await syncFundTarget(event.id);
    setBusy(null);
    setDrafts([]);
    await invalidate();
  };

  const remove = async (id: string) => {
    setBusy(id);
    const { error: deleteError } = await supabase.from('budget_lines').delete().eq('id', id);
    if (!deleteError) await syncFundTarget(event.id);
    setBusy(null);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    await invalidate();
  };

  return (
    <Card style={{ gap: spacing.md }}>
      <Heading>Budget · {formatMoney(total, currency)}</Heading>
      {data.budget.length ? (
        vendorGroups(data.budget).map((group) => (
          <View key={group.key || 'none'} style={{ gap: spacing.sm }}>
            <View>
              <Body>{group.vendor ?? NO_VENDOR}</Body>
              <Caption>
                {group.lines.length} {group.lines.length === 1 ? 'service' : 'services'} ·{' '}
                {formatMoney(
                  group.lines.reduce((sum, line) => sum + Number(line.amount), 0),
                  currency,
                )}
              </Caption>
            </View>
            {group.lines.map((line) => (
              <View
                key={line.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  paddingLeft: spacing.md,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Body muted>{line.category}</Body>
                  <Caption>{formatMoney(Number(line.amount), currency)}</Caption>
                </View>
                {!locked ? (
                  <View style={{ width: 100 }}>
                    <Button
                      label="Remove"
                      variant="secondary"
                      onPress={() => void remove(line.id)}
                      loading={busy === line.id}
                    />
                  </View>
                ) : null}
              </View>
            ))}
            {!locked ? (
              <Button
                label={`+ Add a service${group.vendor ? ` from ${group.vendor}` : ''}`}
                variant="secondary"
                onPress={() =>
                  setDrafts((current) => [
                    ...current,
                    newBudgetLine({ group: `vendor:${group.key}`, vendor: group.vendor ?? '' }),
                  ])
                }
              />
            ) : null}
          </View>
        ))
      ) : (
        <Body muted>No vendors in the budget yet.</Body>
      )}
      {!locked ? (
        <View style={{ gap: spacing.sm }}>
          {drafts.length ? (
            <>
              <BudgetLinesEditor lines={drafts} onChange={setDrafts} currency={currency} />
              <ErrorText message={error} />
              <Button
                label="Save to the budget"
                onPress={() => void save()}
                loading={busy === 'add'}
              />
            </>
          ) : (
            <Button
              label="+ Add a vendor"
              variant="secondary"
              onPress={() => setDrafts([newBudgetLine()])}
            />
          )}
          <Caption>The overall budget is the sum of the services.</Caption>
        </View>
      ) : null}
    </Card>
  );
}

type Activity = Loaded['activities'][number];

/** "Aarav · registered by Priya Sharma" for a family member, as the web lists them. */
function registrantLine(row: Activity['people'][number]) {
  const by = row.memberships?.profiles?.full_name;
  if (!row.participant_name) return by ?? 'Resident';
  return by ? `${row.participant_name} · registered by ${by}` : row.participant_name;
}

type ActivityDraft = {
  typeId: string | null;
  name: string;
  emoji: string;
  places: string;
  description: string;
};

function ActivitiesCard({ data, onChange }: { data: Loaded; onChange: () => void }) {
  const { activeCommunity } = useAuth();
  const invalidate = useInvalidate(onChange);
  const { event } = data;
  const [draft, setDraft] = useState<ActivityDraft | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const locked = event.status === 'completed' || event.status === 'cancelled';

  const add = async () => {
    if (!draft || !activeCommunity) return;
    const parsed = createActivitySchema.safeParse({
      event_id: event.id,
      name: draft.name,
      emoji: draft.emoji || undefined,
      description: draft.description.trim() || undefined,
      capacity: draft.places.trim() || null,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the activity.');
      return;
    }
    setBusy('add');
    setError(null);
    const { error: insertError } = await supabase.from('event_activities').insert({
      event_id: event.id,
      community_id: activeCommunity.id,
      name: parsed.data.name,
      emoji: parsed.data.emoji,
      description: parsed.data.description ?? null,
      capacity: parsed.data.capacity ?? null,
      activity_type_id: draft.typeId,
      position: data.activities.length,
    });
    setBusy(null);
    if (insertError) {
      setError(
        insertError.code === '23505'
          ? 'This event already has an activity with that name.'
          : insertError.message,
      );
      return;
    }
    setDraft(null);
    await invalidate();
  };

  const update = async (id: string, intent: 'open' | 'close' | 'remove') => {
    setBusy(id);
    setError(null);
    const result =
      intent === 'remove'
        ? await supabase.from('event_activities').delete().eq('id', id)
        : await supabase
            .from('event_activities')
            .update({ is_open: intent === 'open' })
            .eq('id', id);
    setBusy(null);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    await invalidate();
  };

  return (
    <Card style={{ gap: spacing.md }}>
      <Heading>Activities</Heading>
      {data.activities.length ? (
        data.activities.map((activity) =>
          editing === activity.id && !locked ? (
            <ActivityEditor
              key={activity.id}
              eventId={event.id}
              activity={activity}
              onCancel={() => setEditing(null)}
              onSaved={async () => {
                setEditing(null);
                await invalidate();
              }}
            />
          ) : (
            <View key={activity.id} style={{ gap: spacing.xs }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <Body>{activity.name}</Body>
                </View>
                {!locked ? <Chip label="Edit" onPress={() => setEditing(activity.id)} /> : null}
              </View>
              <Caption>
                {activity.registrations} registered
                {activity.capacity ? ` of ${activity.capacity} places` : ''} ·{' '}
                {activity.is_open ? 'Open' : 'Closed'}
              </Caption>
              {activity.memberships?.profiles?.full_name ? (
                <Caption>Coordinator: {activity.memberships.profiles.full_name}</Caption>
              ) : null}
              {activity.practice_dates.length ? (
                <Caption>Practice: {practiceDatesLine(activity.practice_dates)}</Caption>
              ) : null}
              {activity.people.map((row) => (
                <Body key={row.id} muted>
                  {registrantLine(row)}
                </Body>
              ))}
              {!locked ? (
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <Button
                      label={activity.is_open ? 'Close registrations' : 'Reopen'}
                      variant="secondary"
                      onPress={() => void update(activity.id, activity.is_open ? 'close' : 'open')}
                      loading={busy === activity.id}
                    />
                  </View>
                  {activity.registrations === 0 ? (
                    <View style={{ width: 100 }}>
                      <Button
                        label="Remove"
                        variant="secondary"
                        onPress={() => void update(activity.id, 'remove')}
                      />
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          ),
        )
      ) : (
        <Body muted>No activities yet.</Body>
      )}

      {!locked ? (
        draft ? (
          <View style={{ gap: spacing.sm }}>
            <Input
              label="Activity name"
              value={draft.name}
              onChangeText={(name) => setDraft({ ...draft, name })}
            />
            <Input
              label="Places"
              value={draft.places}
              onChangeText={(places) =>
                setDraft({ ...draft, places: places.replace(/[^0-9]/g, '') })
              }
              keyboardType="number-pad"
              placeholder="No limit"
            />
            <Input
              label="Description"
              value={draft.description}
              onChangeText={(description) => setDraft({ ...draft, description })}
              multiline
              style={{ minHeight: 72, textAlignVertical: 'top' }}
            />
            <Button label="Add activity" onPress={() => void add()} loading={busy === 'add'} />
            <Button label="Cancel" variant="secondary" onPress={() => setDraft(null)} />
          </View>
        ) : (
          <ActivityTypeChips
            onPick={(item) =>
              setDraft({
                typeId: item.id,
                name: item.label,
                emoji: item.emoji ?? '',
                places: '',
                description: '',
              })
            }
          />
        )
      ) : null}
      <ErrorText message={error} />
    </Card>
  );
}

/** A day added to the list, which stays in date order and holds each day once. */
const withDay = (days: string[], day: string) =>
  days.includes(day) ? days : [...days, day].sort();

/**
 * Everything about an activity once it is added, as the web's Edit has it:
 * places, description, who coordinates it and when it practises.
 */
function ActivityEditor({
  eventId,
  activity,
  onCancel,
  onSaved,
}: {
  eventId: string;
  activity: Activity;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(() => ({
    emoji: activity.emoji,
    name: activity.name,
    places: activity.capacity ? String(activity.capacity) : '',
    description: activity.description ?? '',
    coordinatorId: activity.coordinator_id,
    days: activity.practice_dates,
  }));
  const [day, setDay] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const dropDay = (gone: string) =>
    set(
      'days',
      form.days.filter((other) => other !== gone),
    );

  // Names and flats only; a coordinator is anyone in the society.
  const { data: members, loading: loadingMembers } = useCommunityData(
    'activity-coordinators',
    async (communityId) => {
      const { data: people } = await supabase.rpc('society_people', {
        p_community_id: communityId,
      });
      return (people ?? [])
        .flatMap((person) =>
          person.membership_id
            ? [
                {
                  id: person.membership_id,
                  label: [person.full_name ?? 'Unnamed', person.flat].filter(Boolean).join(' · '),
                },
              ]
            : [],
        )
        .sort((a, b) => a.label.localeCompare(b.label));
    },
  );

  const query = search.trim().toLowerCase();
  const matches = query
    ? (members ?? []).filter((member) => member.label.toLowerCase().includes(query)).slice(0, 8)
    : [];
  const coordinator =
    members?.find((member) => member.id === form.coordinatorId)?.label ??
    (form.coordinatorId === activity.coordinator_id
      ? activity.memberships?.profiles?.full_name
      : null) ??
    'Current coordinator';

  const save = async () => {
    const parsed = updateActivitySchema.safeParse({
      id: activity.id,
      name: form.name,
      emoji: form.emoji || undefined,
      description: form.description,
      capacity: form.places.trim() || null,
      coordinator_id: form.coordinatorId,
      // A day picked and never added is still meant.
      practice_dates: day ? withDay(form.days, day) : form.days,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the activity.');
      return;
    }
    const { id, ...changes } = parsed.data;
    setBusy(true);
    setError(null);
    // Only a change is checked, against a fresh count. Nothing caps
    // registrations in the database, so an activity can already hold more
    // people than places, and that must not stop anyone fixing its name.
    if (changes.capacity !== null && changes.capacity !== activity.capacity) {
      const { count } = await supabase
        .from('activity_participants')
        .select('id', { count: 'exact', head: true })
        .eq('activity_id', id);
      const tooFew = placesProblem(changes.capacity, count ?? activity.registrations);
      if (tooFew) {
        setBusy(false);
        setError(tooFew);
        return;
      }
    }
    const { error: updateError } = await supabase
      .from('event_activities')
      .update(changes)
      .eq('id', id)
      .eq('event_id', eventId);
    setBusy(false);
    if (updateError) {
      setError(
        updateError.code === '23505'
          ? 'This event already has an activity with that name.'
          : updateError.message,
      );
      return;
    }
    onSaved();
  };

  return (
    <View style={{ gap: spacing.md }}>
      <Input label="Activity name" value={form.name} onChangeText={(value) => set('name', value)} />
      <Input
        label="Places"
        value={form.places}
        onChangeText={(value) => set('places', value.replace(/[^0-9]/g, ''))}
        keyboardType="number-pad"
        placeholder="No limit"
      />
      <Input
        label="Description"
        value={form.description}
        onChangeText={(value) => set('description', value)}
        multiline
        style={{ minHeight: 72, textAlignVertical: 'top' }}
      />

      <View style={{ gap: spacing.sm }}>
        <Body>Coordinator</Body>
        <ChipRow>
          <Chip
            label="None"
            selected={!form.coordinatorId}
            onPress={() => set('coordinatorId', null)}
          />
          {form.coordinatorId ? (
            <Chip label={coordinator} selected onPress={() => set('coordinatorId', null)} />
          ) : null}
        </ChipRow>
        <Input
          value={search}
          onChangeText={setSearch}
          placeholder="Find someone by name or flat"
          accessibilityLabel="Find a coordinator by name or flat"
        />
        {query ? (
          loadingMembers ? (
            <Caption>Loading…</Caption>
          ) : matches.length ? (
            <ChipRow>
              {matches.map((member) => (
                <Chip
                  key={member.id}
                  label={member.label}
                  selected={member.id === form.coordinatorId}
                  onPress={() => {
                    set('coordinatorId', member.id);
                    setSearch('');
                  }}
                />
              ))}
            </ChipRow>
          ) : (
            <Caption>Nobody matches.</Caption>
          )
        ) : null}
      </View>

      <View style={{ gap: spacing.sm }}>
        <Body>Practice dates</Body>
        {form.days.length ? (
          <ChipRow>
            {form.days.map((practice) => (
              <Chip
                key={practice}
                label={`${formatDate(practice)}  ✕`}
                onPress={() => dropDay(practice)}
              />
            ))}
          </ChipRow>
        ) : null}
        <DateField label="Add a date" value={day} onChange={setDay} />
        <Button
          label="Add date"
          variant="secondary"
          disabled={!day}
          onPress={() => {
            if (day) set('days', withDay(form.days, day));
            setDay(null);
          }}
        />
      </View>

      <ErrorText message={error} />
      <Button label="Save changes" onPress={() => void save()} loading={busy} />
      <Button label="Cancel" variant="secondary" onPress={onCancel} />
    </View>
  );
}

/**
 * What happens to the money left in a closed event.
 *
 * Offered after closing rather than as part of it: closing is a speed bump
 * with a typed confirmation, and burying a second decision inside it is how
 * somebody taps the first option to get past the form. It stays on the screen
 * until it is answered, so a committee that wants to talk about it first can
 * come back.
 *
 * No amount field: the figure is what the ledger says, and letting the
 * committee type it would invite a typo into the one number nobody is
 * checking.
 */
function SurplusCard({ data, onChange }: { data: Loaded; onChange: () => void }) {
  const { activeCommunity, role } = useAuth();
  const invalidate = useInvalidate(onChange);
  const currency = activeCommunity?.currency ?? 'INR';
  const { event } = data;
  const surplus = Number(data.stats?.available ?? 0);
  const [answer, setAnswer] = useState<SurplusAnswer>('society_balance');
  // Nothing preselected: a default either creates a draft event nobody asked
  // for, or quietly picks the wrong fund.
  const [target, setTarget] = useState<string>('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const closed = event.status === 'completed';
  if (!closed || surplus <= 0 || !can(role, 'events:close')) return null;

  const nextEdition = nextEditionName(event.name, event.starts_on);

  const decide = async () => {
    if (answer === 'another_event' && !target) {
      setError('Choose which event it goes behind.');
      return;
    }
    setBusy(true);
    setError(null);
    const kind = surplusKindFor(answer, target);
    let carryTo: string | undefined =
      kind === 'society_balance' || target === NEW_EDITION ? undefined : target;

    // "Next year's edition" is useless if next year's event has to exist
    // before you can say it, so the draft is made here.
    if (kind === 'next_edition') {
      const { data: created, error: createError } = await supabase
        .from('events')
        .insert({
          community_id: event.community_id,
          slug: makeEventSlug(nextEdition),
          name: nextEdition,
          emoji: event.emoji,
          event_type_id: event.event_type_id,
          venue: event.venue,
          venue_id: event.venue_id,
          organizer: event.organizer,
          starts_on: nextEditionDate(event.starts_on),
          fund_target: 0,
          status: 'draft',
        })
        .select('id')
        .single();
      if (createError) {
        setBusy(false);
        setError(createError.message);
        return;
      }
      carryTo = created.id;
    }

    const { error: rpcError } = await supabase.rpc('allocate_surplus', {
      p_event_id: event.id,
      p_kind: kind,
      p_to_event_id: carryTo,
      p_note: note.trim() || undefined,
    });
    setBusy(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    await invalidate();
  };

  return (
    <Card style={{ gap: spacing.md }}>
      <View style={{ gap: 2 }}>
        <Title>{formatMoney(surplus, currency)} left over</Title>
        <Caption>Residents’ money this event didn’t spend. Everyone sees what you decide.</Caption>
      </View>

      <View style={{ gap: spacing.sm }}>
        {SURPLUS_ANSWERS.map((choice) => (
          <Pressable key={choice} onPress={() => setAnswer(choice)}>
            <View style={{ gap: 2 }}>
              <Body>
                {answer === choice ? '◉' : '○'} {SURPLUS_ANSWER_LABEL[choice]}
              </Body>
              <Caption>{SURPLUS_ANSWER_DETAIL[choice]}</Caption>
            </View>
          </Pressable>
        ))}
      </View>

      {/* Which event, asked only once they have said it goes behind one. */}
      {answer === 'another_event' ? (
        <View style={{ gap: spacing.xs }}>
          <Body>Which event</Body>
          <ChipRow>
            {data.openEvents.map((option) => (
              <Chip
                key={option.id}
                label={option.name}
                selected={target === option.id}
                onPress={() => setTarget(option.id)}
              />
            ))}
            <Chip
              label={`+ Create ${nextEdition}`}
              selected={target === NEW_EDITION}
              onPress={() => setTarget(NEW_EDITION)}
            />
          </ChipRow>
        </View>
      ) : null}

      <Input
        label="Note (optional)"
        value={note}
        onChangeText={setNote}
        placeholder="Agreed at the October meeting"
      />
      <ErrorText message={error} />
      <Button label="Record the decision" onPress={() => void decide()} loading={busy} />
    </Card>
  );
}

/**
 * The way back out of the society balance, so keeping a surplus is not a
 * one-way door.
 */
function BringInBalanceCard({ data, onChange }: { data: Loaded; onChange: () => void }) {
  const { activeCommunity, role } = useAuth();
  const invalidate = useInvalidate(onChange);
  const currency = activeCommunity?.currency ?? 'INR';
  const { event } = data;
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = event.status === 'draft' || event.status === 'published';
  if (!open || data.societyBalance <= 0 || !can(role, 'events:close')) return null;

  const bringIn = async () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError('Enter an amount greater than zero.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc('spend_society_balance', {
      p_to_event_id: event.id,
      p_amount: value,
      p_note: note.trim() || undefined,
    });
    setBusy(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setAmount('');
    setNote('');
    await invalidate();
  };

  return (
    <Card style={{ gap: spacing.md }}>
      <View style={{ gap: 2 }}>
        <Heading>Bring in society funds</Heading>
        <Caption>Kept for the society: {formatMoney(data.societyBalance, currency)}</Caption>
      </View>
      <Input
        label="Amount (₹)"
        value={amount}
        onChangeText={setAmount}
        keyboardType="number-pad"
        placeholder="5000"
      />
      <Input
        label="Note (optional)"
        value={note}
        onChangeText={setNote}
        placeholder="Towards the pandal"
      />
      <ErrorText message={error} />
      <Button label="Put it behind this event" onPress={() => void bringIn()} loading={busy} />
    </Card>
  );
}
