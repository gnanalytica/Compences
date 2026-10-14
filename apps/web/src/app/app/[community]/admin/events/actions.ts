'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import {
  DEFAULT_FUND_RULE,
  allocateSurplusSchema,
  NEW_EDITION,
  surplusKindFor,
  can,
  closeEventSchema,
  createActivitySchema,
  createEventSchema,
  createExpenseSchema,
  eventSlug as makeEventSlug,
  nextEditionDate,
  nextEditionName,
  optionalUpiReference,
  optionalWhatsappGroup,
  paymentMethodSchema,
  placesProblem,
  recordedPaymentEvidenceProblem,
  reviewExpenseSchema,
  spendBalanceSchema,
  updateActivitySchema,
  uuid,
} from '@compences/core';
import { requireCapability } from '@/lib/auth';
import { getCatalogue, resolveCatalogueChoice } from '@/lib/catalogue';
import { getSupabase } from '@/lib/supabase/server';
import { removeStoredFile } from '@/lib/storage';
import { EMPTY_STATE, fieldErrors, friendlyDbError, type ActionState } from '@/lib/action-state';

/**
 * Staff and committee actions on events.
 *
 * The line that matters: staff run events (create, edit, publish, budgets,
 * activities, bills, payments, join requests); the committee has the final say
 * (approving bills, campaigns and suggestions, closing an event). Each action
 * asks for the capability it needs, and the database enforces the same line.
 */

/** Paths that show an event's numbers; refreshed after anything changes them. */
function refreshEvent(communitySlug: string, eventSlug: string) {
  revalidatePath(`/app/${communitySlug}/admin/events/${eventSlug}`);
  revalidatePath(`/app/${communitySlug}/events/${eventSlug}`);
  revalidatePath(`/app/${communitySlug}/todo`);
  revalidatePath(`/app/${communitySlug}/events`);
  revalidatePath(`/app/${communitySlug}/admin`);
}

async function billChoices(communityId: string, formData: FormData) {
  const [category, vendor] = await Promise.all([
    resolveCatalogueChoice(communityId, 'budget_category', formData, 'category'),
    resolveCatalogueChoice(communityId, 'vendor', formData, 'vendor'),
  ]);
  return { category, vendor };
}

async function findEvent(communityId: string, eventSlug: string) {
  const supabase = await getSupabase();
  const { data } = await supabase
    .from('events')
    .select('id, name, status, kind, slug')
    .eq('community_id', communityId)
    .eq('slug', eventSlug)
    .maybeSingle();
  return data;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export type EventFormState = ActionState;

function eventFields(formData: FormData) {
  return {
    emoji: formData.get('emoji') || '🎉',
    name: formData.get('name'),
    starts_on: formData.get('starts_on'),
    ends_on: formData.get('ends_on') || null,
    organizer: formData.get('organizer') || undefined,
    description: formData.get('description') || undefined,
    expected_attendance: formData.get('expected_attendance') || undefined,
    suggested_amount: formData.get('suggested_amount') || null,
    fund_rule: formData.get('fund_rule') || DEFAULT_FUND_RULE,
    fund_rule_note: formData.get('fund_rule_note') || undefined,
    whatsapp_group_url: formData.get('whatsapp_group_url') ?? '',
  };
}

/** Web addresses to try for a new event: its name, then with the year, then a random tail. */
function slugCandidates(name: string, startsOn: string) {
  const year = startsOn.slice(0, 4);
  const base = makeEventSlug(name);
  const random = () => Math.random().toString(36).slice(2, 6);
  return [
    base,
    base.endsWith(year) ? makeEventSlug(name, random()) : makeEventSlug(name, year),
    makeEventSlug(name, random()),
    makeEventSlug(name, random()),
  ];
}

/**
 * Creates an event with its first budget lines (their sum is the fund target)
 * and activities. The web address comes from the name. "Save for later" keeps
 * it a draft; "Publish" shows it to residents straight away.
 */
export async function createEvent(
  _prev: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  const communitySlug = String(formData.get('slug') ?? '');
  const context = await requireCapability(communitySlug, 'events:manage');
  const publish = formData.get('intent') === 'publish';

  // Budget lines pick a category from the catalogue; the label stored on the
  // line comes from the catalogue, not the form.
  const catalogue = await getCatalogue(context.community.id);
  const categoryIds = formData.getAll('budget_category_id').map((value) => String(value).trim());
  const amounts = formData.getAll('budget_amount').map((value) => Number(value || 0));
  const lines = categoryIds
    .map((id, index) => ({
      item: catalogue.budget_category.find((entry) => entry.id === id) ?? null,
      amount: amounts[index] ?? 0,
    }))
    .filter((line) => line.item || line.amount > 0);
  if (lines.some((line) => !line.item)) {
    return { error: 'Pick a category for every budget line that has an amount.' };
  }
  if (lines.some((line) => !Number.isFinite(line.amount) || line.amount < 0)) {
    return { error: 'Budget amounts must be numbers.' };
  }
  const fundTarget = lines.reduce((sum, line) => sum + line.amount, 0);

  const [eventType, venue] = await Promise.all([
    resolveCatalogueChoice(context.community.id, 'event_type', formData, 'event_type'),
    resolveCatalogueChoice(context.community.id, 'venue', formData, 'venue'),
  ]);

  // Activities added while creating: a name (usually from the picked type) and
  // an optional type from the catalogue.
  const activityTypeIds = formData.getAll('new_activity_type_id').map((value) => String(value));
  const activityNames = formData.getAll('new_activity_name').map((value) => String(value).trim());
  const activityEmojis = formData.getAll('new_activity_emoji').map((value) => String(value));
  const newActivities = activityNames
    .map((name, index) => ({
      name,
      emoji: activityEmojis[index] || '🎭',
      type: catalogue.activity_type.find((entry) => entry.id === activityTypeIds[index]) ?? null,
    }))
    .filter((activity) => activity.name);
  if (activityNames.some((name, index) => !name && activityTypeIds[index])) {
    return { error: 'Give every activity a name.' };
  }

  const fields = eventFields(formData);
  const candidates = slugCandidates(String(fields.name ?? ''), String(fields.starts_on ?? ''));
  const parsed = createEventSchema.safeParse({
    community_id: context.community.id,
    ...fields,
    slug: candidates[0],
    venue: venue.label ?? undefined,
    fund_target: fundTarget,
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await getSupabase();
  let created: { id: string; slug: string } | null = null;
  for (const candidate of candidates) {
    const { data, error } = await supabase
      .from('events')
      .insert({
        ...parsed.data,
        slug: candidate,
        event_type_id: eventType.id,
        venue_id: venue.id,
        kind: 'event',
        status: 'draft',
        created_by: context.user.id,
      })
      .select('id, slug')
      .single();
    if (!error) {
      created = data;
      break;
    }
    // Another event already has this web address; try the next one.
    if (error.code !== '23505') return { error: friendlyDbError(error) };
  }
  const event = created;
  if (!event) return { error: 'Could not create the event. Try a slightly different name.' };

  if (newActivities.length) {
    await supabase.from('event_activities').insert(
      newActivities.map((activity, position) => ({
        event_id: event.id,
        community_id: context.community.id,
        name: activity.name.slice(0, 140),
        emoji: activity.emoji,
        activity_type_id: activity.type?.id ?? null,
        position,
      })),
    );
  }

  if (lines.length) {
    await supabase.from('budget_lines').insert(
      lines.map((line, position) => ({
        event_id: event.id,
        community_id: context.community.id,
        category: line.item!.label,
        category_id: line.item!.id,
        amount: line.amount,
        position,
      })),
    );
  }

  if (publish) {
    await supabase.from('events').update({ status: 'published' }).eq('id', event.id);
  }

  revalidatePath(`/app/${communitySlug}/events`);
  revalidatePath(`/app/${communitySlug}/admin`);
  redirect(`/app/${communitySlug}/admin/events/${event.slug}`);
}

const updateEventSchema = z.object({
  emoji: z.string().trim().min(1).max(8),
  name: z.string().trim().min(3, 'Give the event a name').max(140),
  starts_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date'),
  ends_on: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  venue: z.string().trim().max(140).nullable(),
  organizer: z.string().trim().max(140).nullable(),
  description: z.string().trim().max(5000).nullable(),
  // Null is a real answer: plenty of events take whatever people give.
  suggested_amount: z.coerce
    .number()
    .positive('Enter an amount greater than zero, or leave it blank')
    .max(10_000_000)
    .nullable(),
  whatsapp_group_url: optionalWhatsappGroup,
});

export async function updateEventDetails(
  _prev: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  const communitySlug = String(formData.get('slug') ?? '');
  const eventSlug = String(formData.get('event') ?? '');
  const context = await requireCapability(communitySlug, 'events:manage');

  const [eventType, venue] = await Promise.all([
    resolveCatalogueChoice(context.community.id, 'event_type', formData, 'event_type'),
    resolveCatalogueChoice(context.community.id, 'venue', formData, 'venue'),
  ]);

  const parsed = updateEventSchema.safeParse({
    emoji: formData.get('emoji') || '🎉',
    name: formData.get('name'),
    starts_on: formData.get('starts_on'),
    ends_on: String(formData.get('ends_on') ?? '') || null,
    venue: venue.label,
    organizer: String(formData.get('organizer') ?? '').trim() || null,
    description: String(formData.get('description') ?? '').trim() || null,
    suggested_amount: String(formData.get('suggested_amount') ?? '').trim() || null,
    whatsapp_group_url: formData.get('whatsapp_group_url') ?? '',
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  if (parsed.data.ends_on && parsed.data.ends_on < parsed.data.starts_on) {
    return { fieldErrors: { ends_on: 'The event cannot end before it starts' } };
  }

  const supabase = await getSupabase();
  const { error } = await supabase
    .from('events')
    .update({ ...parsed.data, venue_id: venue.id, event_type_id: eventType.id })
    .eq('community_id', context.community.id)
    .eq('slug', eventSlug);
  if (error) return { error: friendlyDbError(error) };

  refreshEvent(communitySlug, eventSlug);
  return { ...EMPTY_STATE, success: 'Saved.' };
}

/** Staff publish, cancel or return an event to draft. Closing is separate. */
export async function setEventStatus(formData: FormData): Promise<void> {
  const communitySlug = String(formData.get('slug') ?? '');
  const eventSlug = String(formData.get('event') ?? '');
  const status = String(formData.get('status') ?? '');
  const context = await requireCapability(communitySlug, 'events:manage');

  if (!['draft', 'published', 'cancelled'].includes(status)) return;

  const supabase = await getSupabase();
  await supabase
    .from('events')
    .update({ status: status as 'draft' | 'published' | 'cancelled' })
    .eq('community_id', context.community.id)
    .eq('slug', eventSlug)
    .neq('status', 'proposed');

  refreshEvent(communitySlug, eventSlug);
}

// ---------------------------------------------------------------------------
// Budget
// ---------------------------------------------------------------------------

/** Keeps the event's fund target equal to the sum of its budget lines. */
async function syncFundTarget(eventId: string) {
  const supabase = await getSupabase();
  const { data } = await supabase.from('budget_lines').select('amount').eq('event_id', eventId);
  const total = (data ?? []).reduce((sum, line) => sum + Number(line.amount), 0);
  await supabase.from('events').update({ fund_target: total }).eq('id', eventId);
}

const budgetLineInput = z.object({
  category: z.string().trim().min(1, 'Pick a category').max(80),
  amount: z.coerce.number().min(0, 'Enter an amount').max(100_000_000),
  notes: z.string().trim().max(300).optional(),
});

export async function addBudgetLine(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const communitySlug = String(formData.get('slug') ?? '');
  const eventSlug = String(formData.get('event') ?? '');
  const context = await requireCapability(communitySlug, 'budget:manage');
  const event = await findEvent(context.community.id, eventSlug);
  if (!event) return { error: 'That event no longer exists.' };
  if (event.kind === 'campaign') return { error: 'Campaigns have a single target, not a budget.' };

  const category = await resolveCatalogueChoice(
    context.community.id,
    'budget_category',
    formData,
    'category',
  );
  const parsed = budgetLineInput.safeParse({
    category: category.label ?? '',
    amount: formData.get('amount'),
    notes: formData.get('notes') || undefined,
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await getSupabase();
  const { count } = await supabase
    .from('budget_lines')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', event.id);
  const { error } = await supabase.from('budget_lines').insert({
    ...parsed.data,
    category_id: category.id,
    event_id: event.id,
    community_id: context.community.id,
    position: count ?? 0,
  });
  if (error) return { error: friendlyDbError(error) };

  await syncFundTarget(event.id);
  refreshEvent(communitySlug, eventSlug);
  return { ...EMPTY_STATE, success: 'Budget line added.' };
}

export async function updateBudgetLine(formData: FormData): Promise<void> {
  const communitySlug = String(formData.get('slug') ?? '');
  const eventSlug = String(formData.get('event') ?? '');
  const context = await requireCapability(communitySlug, 'budget:manage');
  const event = await findEvent(context.community.id, eventSlug);
  if (!event) return;

  const id = uuid.safeParse(formData.get('line_id'));
  const category = await resolveCatalogueChoice(
    context.community.id,
    'budget_category',
    formData,
    'category',
  );
  const parsed = budgetLineInput.safeParse({
    category: category.label ?? '',
    amount: formData.get('amount'),
  });
  if (!id.success || !parsed.success) return;

  const supabase = await getSupabase();
  await supabase
    .from('budget_lines')
    .update({
      category: parsed.data.category,
      category_id: category.id,
      amount: parsed.data.amount,
    })
    .eq('id', id.data)
    .eq('event_id', event.id);

  await syncFundTarget(event.id);
  refreshEvent(communitySlug, eventSlug);
}

export async function removeBudgetLine(formData: FormData): Promise<void> {
  const communitySlug = String(formData.get('slug') ?? '');
  const eventSlug = String(formData.get('event') ?? '');
  const context = await requireCapability(communitySlug, 'budget:manage');
  const event = await findEvent(context.community.id, eventSlug);
  if (!event) return;

  const supabase = await getSupabase();
  await supabase
    .from('budget_lines')
    .delete()
    .eq('id', String(formData.get('line_id') ?? ''))
    .eq('event_id', event.id);

  await syncFundTarget(event.id);
  refreshEvent(communitySlug, eventSlug);
}

// ---------------------------------------------------------------------------
// Activities
// ---------------------------------------------------------------------------

export async function addActivity(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const communitySlug = String(formData.get('slug') ?? '');
  const eventSlug = String(formData.get('event') ?? '');
  const context = await requireCapability(communitySlug, 'activities:manage');
  const event = await findEvent(context.community.id, eventSlug);
  if (!event) return { error: 'That event no longer exists.' };
  if (event.status === 'completed' || event.status === 'cancelled') {
    return { error: 'This event is closed or cancelled, so its activities can’t be changed.' };
  }

  const parsed = createActivitySchema.safeParse({
    event_id: event.id,
    name: formData.get('name'),
    emoji: formData.get('emoji') || '🎭',
    description: formData.get('description') || undefined,
    capacity: String(formData.get('capacity') ?? '') || null,
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await getSupabase();
  const activityType = await resolveCatalogueChoice(
    context.community.id,
    'activity_type',
    formData,
    'activity_type',
  );
  const { error } = await supabase.from('event_activities').insert({
    ...parsed.data,
    activity_type_id: activityType.id,
    community_id: context.community.id,
  });
  if (error) {
    return {
      error:
        error.code === '23505'
          ? 'This event already has an activity with that name.'
          : friendlyDbError(error),
    };
  }

  refreshEvent(communitySlug, eventSlug);
  return { ...EMPTY_STATE, success: 'Activity added.' };
}

/** Opens or closes registrations, or removes an activity with no registrations. */
export async function updateActivity(formData: FormData): Promise<void> {
  const communitySlug = String(formData.get('slug') ?? '');
  const eventSlug = String(formData.get('event') ?? '');
  const context = await requireCapability(communitySlug, 'activities:manage');
  const activityId = String(formData.get('activity_id') ?? '');
  const intent = String(formData.get('intent') ?? '');

  const supabase = await getSupabase();
  // Whatever the page offered: nothing changes on an event that is over or
  // called off, and nobody is dropped from an activity by deleting it.
  const [{ data: activity }, { count: registered }] = await Promise.all([
    supabase
      .from('event_activities')
      .select('id, events!inner(status)')
      .eq('id', activityId)
      .eq('community_id', context.community.id)
      .maybeSingle(),
    supabase
      .from('activity_participants')
      .select('id', { count: 'exact', head: true })
      .eq('activity_id', activityId),
  ]);
  const status = activity?.events.status;
  if (!activity || status === 'completed' || status === 'cancelled') return;

  if (intent === 'open' || intent === 'close') {
    await supabase
      .from('event_activities')
      .update({ is_open: intent === 'open' })
      .eq('id', activityId)
      .eq('community_id', context.community.id);
  } else if (intent === 'remove' && !registered) {
    await supabase
      .from('event_activities')
      .delete()
      .eq('id', activityId)
      .eq('community_id', context.community.id);
  }

  refreshEvent(communitySlug, eventSlug);
}

/**
 * Everything about an activity after it is added: name, places, description,
 * who coordinates it and when it practises. Not once its event is over or
 * called off, the same rule the phone follows.
 */
export async function editActivity(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const communitySlug = String(formData.get('slug') ?? '');
  const eventSlug = String(formData.get('event') ?? '');
  const context = await requireCapability(communitySlug, 'activities:manage');
  const event = await findEvent(context.community.id, eventSlug);
  if (!event) return { error: 'That event no longer exists.' };
  if (event.status === 'completed' || event.status === 'cancelled') {
    return { error: 'This event is closed or cancelled, so its activities can’t be changed.' };
  }

  const parsed = updateActivitySchema.safeParse({
    id: formData.get('activity_id'),
    name: formData.get('name'),
    emoji: formData.get('emoji') || '🎭',
    description: formData.get('description') ?? '',
    capacity: String(formData.get('capacity') ?? '').trim() || null,
    coordinator_id: String(formData.get('coordinator_id') ?? '') || null,
    practice_dates: formData.getAll('practice_date').map(String).filter(Boolean),
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const { id, ...changes } = parsed.data;

  const supabase = await getSupabase();
  const [current, registered, coordinator] = await Promise.all([
    supabase
      .from('event_activities')
      .select('capacity')
      .eq('id', id)
      .eq('event_id', event.id)
      .maybeSingle(),
    supabase
      .from('activity_participants')
      .select('id', { count: 'exact', head: true })
      .eq('activity_id', id),
    // The column only knows it points at a membership, not whose.
    changes.coordinator_id
      ? supabase
          .from('memberships')
          .select('id')
          .eq('id', changes.coordinator_id)
          .eq('community_id', context.community.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (!current.data) return { error: 'That activity no longer exists.' };
  if (registered.error) return { error: friendlyDbError(registered.error) };
  if (changes.coordinator_id && !coordinator.data) {
    return { fieldErrors: { coordinator_id: 'Pick someone from this society.' } };
  }
  // Only a change is checked. Nothing caps registrations in the database, so an
  // activity can already hold more people than places, and that must not stop
  // anyone fixing its name.
  const tooFew =
    changes.capacity === current.data.capacity
      ? null
      : placesProblem(changes.capacity, registered.count ?? 0);
  if (tooFew) return { fieldErrors: { capacity: tooFew } };

  // Scoped to the event checked above, not only the society, so an activity in
  // a finished event cannot be reached through an open event's form.
  const { data, error } = await supabase
    .from('event_activities')
    .update(changes)
    .eq('id', id)
    .eq('event_id', event.id)
    .eq('community_id', context.community.id)
    .select('id')
    .maybeSingle();
  if (error) {
    return {
      error:
        error.code === '23505'
          ? 'This event already has an activity with that name.'
          : friendlyDbError(error),
    };
  }
  if (!data) return { error: 'That activity no longer exists.' };

  refreshEvent(communitySlug, eventSlug);
  return { ...EMPTY_STATE, success: 'Saved.' };
}

// ---------------------------------------------------------------------------
// Bills
// ---------------------------------------------------------------------------

/** Bill fields; category and vendor are resolved from the catalogue by the caller. */
function expenseFields(
  formData: FormData,
  category: { label: string | null },
  vendor: { label: string | null },
) {
  return {
    name: formData.get('name'),
    category: category.label ?? undefined,
    amount: formData.get('amount'),
    vendor: vendor.label ?? undefined,
    paid_by: formData.get('paid_by') || undefined,
    method: formData.get('method') || 'upi',
    bill_url: formData.get('bill_url') || undefined,
    spent_on: formData.get('spent_on') || undefined,
  };
}

/** Staff upload a bill; it waits for the committee before residents see it. */
export async function submitExpense(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const communitySlug = String(formData.get('slug') ?? '');
  const eventSlug = String(formData.get('event') ?? '');
  const context = await requireCapability(communitySlug, 'expenses:submit');
  const event = await findEvent(context.community.id, eventSlug);
  if (!event) return { error: 'That event no longer exists.' };
  if (event.status === 'completed') {
    return { error: 'This event is closed; its ledger cannot be changed.' };
  }

  const { category, vendor } = await billChoices(context.community.id, formData);
  const parsed = createExpenseSchema.safeParse({
    event_id: event.id,
    ...expenseFields(formData, category, vendor),
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await getSupabase();
  const { error } = await supabase.from('expenses').insert({
    ...parsed.data,
    category_id: category.id,
    vendor_id: vendor.id,
    community_id: context.community.id,
    requested_by: context.membership.id,
    status: 'pending',
  });
  if (error) return { error: friendlyDbError(error) };

  refreshEvent(communitySlug, eventSlug);
  revalidatePath(`/app/${communitySlug}/todo`);
  return { ...EMPTY_STATE, success: 'Bill uploaded. It now waits for the committee.' };
}

/**
 * Corrects a bill, including attaching a new copy. A corrected bill goes back
 * to the committee as pending — including one that had already been approved,
 * where the database resets the approval whatever this function asks for.
 */
export async function correctExpense(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const communitySlug = String(formData.get('slug') ?? '');
  const eventSlug = String(formData.get('event') ?? '');
  const context = await requireCapability(communitySlug, 'expenses:submit');
  const event = await findEvent(context.community.id, eventSlug);
  if (!event) return { error: 'That event no longer exists.' };

  const expenseId = uuid.safeParse(formData.get('expense_id'));
  if (!expenseId.success) return { error: 'That bill no longer exists.' };

  const { category, vendor } = await billChoices(context.community.id, formData);
  const parsed = createExpenseSchema.safeParse({
    event_id: event.id,
    ...expenseFields(formData, category, vendor),
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await getSupabase();
  // Remember the file this bill pointed at, and whether it had been approved.
  const { data: previous } = await supabase
    .from('expenses')
    .select('bill_url, status')
    .eq('id', expenseId.data)
    .eq('event_id', event.id)
    .maybeSingle();
  if (!previous) return { error: 'That bill no longer exists.' };
  const wasDecided = previous.status !== 'pending' && previous.status !== 'changes_requested';
  if (wasDecided && !can(context.role, 'expenses:approve')) {
    return { error: 'Only the committee can revise a bill that has already been decided.' };
  }

  const { data, error } = await supabase
    .from('expenses')
    .update({
      name: parsed.data.name,
      category: parsed.data.category ?? null,
      category_id: category.id,
      vendor_id: vendor.id,
      amount: parsed.data.amount,
      vendor: parsed.data.vendor ?? null,
      paid_by: parsed.data.paid_by ?? null,
      method: parsed.data.method,
      bill_url: parsed.data.bill_url ?? null,
      spent_on: parsed.data.spent_on,
      status: 'pending',
      review_note: null,
    })
    .eq('id', expenseId.data)
    .eq('event_id', event.id)
    .select('id');
  if (error) return { error: friendlyDbError(error) };
  if (!data?.length) return { error: 'That bill could not be corrected.' };

  // The corrected bill now points at a new copy, so the old one is orphaned —
  // unless it had been approved, in which case residents have already seen it
  // and it is the record of what was signed off. A revision supersedes that
  // record; deleting it would destroy the thing the revision is answerable to.
  const oldBill = previous.bill_url ?? null;
  if (!wasDecided && oldBill && oldBill !== (parsed.data.bill_url ?? null)) {
    await removeStoredFile('bills', oldBill);
  }

  refreshEvent(communitySlug, eventSlug);
  revalidatePath(`/app/${communitySlug}/todo`);
  return {
    ...EMPTY_STATE,
    success: wasDecided
      ? 'Revised. It needs approving again before the new figure counts.'
      : 'Corrected and sent back to the committee.',
  };
}

/** The committee approves, rejects or sends back a bill. */
export async function reviewExpense(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const communitySlug = String(formData.get('slug') ?? '');
  const eventSlug = String(formData.get('event') ?? '');
  await requireCapability(communitySlug, 'expenses:approve');

  const parsed = reviewExpenseSchema.safeParse({
    expense_id: formData.get('expense_id'),
    decision: formData.get('decision'),
    note: formData.get('note') || undefined,
  });
  if (!parsed.success) return { error: 'That decision could not be recorded.' };

  const supabase = await getSupabase();
  const { error } = await supabase.rpc('review_expense', {
    p_expense_id: parsed.data.expense_id,
    p_decision: parsed.data.decision,
    p_note: parsed.data.note ?? undefined,
  });
  if (error) return { error: friendlyDbError(error) };

  if (eventSlug) refreshEvent(communitySlug, eventSlug);
  revalidatePath(`/app/${communitySlug}/todo`);
  return {
    ...EMPTY_STATE,
    success:
      parsed.data.decision === 'approved'
        ? 'Approved. Residents can see it now.'
        : parsed.data.decision === 'rejected'
          ? 'Rejected.'
          : 'Sent back for changes.',
  };
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

const recordPaymentSchema = z.object({
  unit_id: uuid,
  amount: z.coerce
    .number()
    .positive('Enter an amount greater than zero')
    .max(10_000_000, 'That amount is too large'),
  method: paymentMethodSchema,
  reference: z.string().trim().max(120).optional(),
  paid_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date'),
});

/** Staff record money collected from a flat (cash, UPI to the society, cheque). */
export async function recordPayment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const communitySlug = String(formData.get('slug') ?? '');
  const eventSlug = String(formData.get('event') ?? '');
  const context = await requireCapability(communitySlug, 'payments:record');
  const event = await findEvent(context.community.id, eventSlug);
  if (!event) return { error: 'That event no longer exists.' };
  if (event.status !== 'published') {
    return { error: 'Payments can only be recorded while the event is open.' };
  }

  const parsed = recordPaymentSchema.safeParse({
    unit_id: formData.get('unit_id'),
    amount: formData.get('amount'),
    method: formData.get('method') || 'cash',
    reference: formData.get('reference') || undefined,
    paid_on: formData.get('paid_on'),
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  // A screenshot staff attached lives in the society's payment-proofs folder;
  // anything pointing elsewhere is not one this form uploaded.
  const proof = String(formData.get('proof_path') ?? '').trim();
  if (proof && !proof.startsWith(`${context.community.id}/`)) {
    return { error: 'That screenshot could not be attached. Please upload it again.' };
  }
  // Cash is the one kind of payment with nothing to show for it. Anything else
  // carries its transaction ID or a screenshot, the same rule residents meet.
  const missing = recordedPaymentEvidenceProblem(
    parsed.data.method,
    parsed.data.reference,
    Boolean(proof),
  );
  if (missing) return { fieldErrors: { reference: missing } };

  const supabase = await getSupabase();
  const { error } = await supabase.from('contributions').insert({
    event_id: event.id,
    community_id: context.community.id,
    unit_id: parsed.data.unit_id,
    amount: parsed.data.amount,
    method: parsed.data.method,
    reference: parsed.data.reference ?? null,
    proof_path: proof || null,
    status: 'succeeded',
    channel: 'system',
    paid_at: new Date(`${parsed.data.paid_on}T12:00:00+05:30`).toISOString(),
  });
  if (error) return { error: friendlyDbError(error) };

  refreshEvent(communitySlug, eventSlug);
  return { ...EMPTY_STATE, success: 'Payment recorded.' };
}

const reviewPaymentSchema = z
  .object({
    contribution_id: uuid,
    decision: z.enum(['confirm', 'reject']),
    note: z.string().trim().max(300).optional(),
    // Read off the resident's screenshot by whoever is confirming.
    reference: optionalUpiReference,
    // What the bank actually shows, when that is not what was reported. Blank
    // is the normal case and means "leave it alone".
    amount: z.preprocess(
      (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
      z.coerce
        .number()
        .positive('Enter an amount greater than zero')
        .max(10_000_000, 'That amount is too large')
        .optional(),
    ),
  })
  .refine((value) => value.decision === 'confirm' || Boolean(value.note), {
    message: 'Say why it could not be confirmed',
    path: ['note'],
  });

/**
 * Staff confirm a payment a resident reported against the bank statement, or
 * turn it down with a reason. Only confirmed payments count towards the fund.
 */
export async function reviewPayment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const communitySlug = String(formData.get('slug') ?? '');
  const eventSlug = String(formData.get('event') ?? '');
  await requireCapability(communitySlug, 'payments:record');

  const parsed = reviewPaymentSchema.safeParse({
    contribution_id: formData.get('contribution_id'),
    decision: formData.get('decision'),
    note: formData.get('note') || undefined,
    reference: formData.get('reference'),
    amount: formData.get('amount'),
  });
  if (!parsed.success) {
    const problems = fieldErrors(parsed.error);
    return { error: problems.note ?? problems.amount ?? 'That decision could not be recorded.' };
  }

  const supabase = await getSupabase();
  const { data, error } = await supabase.rpc('review_contribution', {
    p_contribution_id: parsed.data.contribution_id,
    p_confirm: parsed.data.decision === 'confirm',
    p_note: parsed.data.note ?? undefined,
    p_reference: parsed.data.reference ?? undefined,
    p_amount: parsed.data.amount ?? undefined,
  });
  if (error) return { error: friendlyDbError(error) };

  refreshEvent(communitySlug, eventSlug);
  revalidatePath(`/app/${communitySlug}`);
  // The database decides whether the figure moved: it ignores an amount equal
  // to the one already recorded, so this reads the row it returns rather than
  // comparing what was typed.
  const corrected = data?.reported_amount != null;
  return {
    ...EMPTY_STATE,
    success:
      parsed.data.decision !== 'confirm'
        ? 'Turned down.'
        : corrected
          ? 'Confirmed at the corrected amount. The resident has been told.'
          : 'Confirmed. It now counts.',
  };
}

// ---------------------------------------------------------------------------
// Join requests
// ---------------------------------------------------------------------------

export async function reviewJoinRequest(formData: FormData): Promise<void> {
  const communitySlug = String(formData.get('slug') ?? '');
  const context = await requireCapability(communitySlug, 'joinrequests:review');

  const requested = String(formData.get('role') ?? 'resident');
  // Staff admit residents; only the committee can admit someone as staff.
  const role = requested === 'staff' && context.role === 'committee' ? 'staff' : 'resident';

  const supabase = await getSupabase();
  await supabase.rpc('review_join_request', {
    p_request_id: String(formData.get('request_id') ?? ''),
    p_approve: formData.get('approve') === '1',
    p_role: role,
    p_reason: String(formData.get('reason') ?? '').trim() || undefined,
  });

  revalidatePath(`/app/${communitySlug}/people/requests`);
  revalidatePath(`/app/${communitySlug}/todo`);
  revalidatePath(`/app/${communitySlug}/admin`);
}

// ---------------------------------------------------------------------------
// Committee decisions
// ---------------------------------------------------------------------------

/** Approves a proposed campaign (it goes live) or turns it down. */
export async function decideCampaign(formData: FormData): Promise<void> {
  const communitySlug = String(formData.get('slug') ?? '');
  const context = await requireCapability(communitySlug, 'campaigns:approve');
  const approve = formData.get('approve') === '1';

  const supabase = await getSupabase();
  await supabase
    .from('events')
    .update({ status: approve ? 'published' : 'cancelled' })
    .eq('id', String(formData.get('event_id') ?? ''))
    .eq('community_id', context.community.id)
    .eq('status', 'proposed');

  revalidatePath(`/app/${communitySlug}/todo`);
  revalidatePath(`/app/${communitySlug}/events`);
  revalidatePath(`/app/${communitySlug}`);
}

/** Opens a suggestion for voting, or declines it with an optional note. */
export async function decideSuggestion(formData: FormData): Promise<void> {
  const communitySlug = String(formData.get('slug') ?? '');
  const context = await requireCapability(communitySlug, 'suggestions:approve');
  const approve = formData.get('approve') === '1';
  const note = String(formData.get('note') ?? '').trim();

  const supabase = await getSupabase();
  const { data } = await supabase
    .from('activity_suggestions')
    .update({ status: approve ? 'accepted' : 'declined', review_note: note || null })
    .eq('id', String(formData.get('suggestion_id') ?? ''))
    .eq('community_id', context.community.id)
    .select('events(slug)')
    .maybeSingle();

  revalidatePath(`/app/${communitySlug}/todo`);
  // An event's suggestion goes back to that event; the society's own go to the
  // page that holds them.
  if (data?.events?.slug) revalidatePath(`/app/${communitySlug}/events/${data.events.slug}`);
  else revalidatePath(`/app/${communitySlug}/suggest`);
}

export type CloseState = ActionState & { closed?: boolean };

/**
 * Closing an event publishes its final accounts and freezes the ledger. The
 * summary is written into the event row so the report cannot drift later.
 */
export async function closeEvent(_prev: CloseState, formData: FormData): Promise<CloseState> {
  const communitySlug = String(formData.get('slug') ?? '');
  const eventSlug = String(formData.get('event') ?? '');
  const context = await requireCapability(communitySlug, 'events:close');
  const event = await findEvent(context.community.id, eventSlug);
  if (!event) return { error: 'That event no longer exists.' };

  const parsed = closeEventSchema.safeParse({
    event_id: event.id,
    confirm_name: formData.get('confirm_name'),
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  if (parsed.data.confirm_name.trim().toLowerCase() !== event.name.trim().toLowerCase()) {
    return { fieldErrors: { confirm_name: 'That does not match the event name.' } };
  }

  const supabase = await getSupabase();
  const [{ data: stats }, { data: open }] = await Promise.all([
    supabase.from('event_stats').select('*').eq('event_id', event.id).maybeSingle(),
    supabase
      .from('expenses')
      .select('id')
      .eq('event_id', event.id)
      .in('status', ['pending', 'changes_requested']),
  ]);

  if (open?.length) {
    return {
      error: `${open.length} bill${open.length === 1 ? '' : 's'} still awaiting a decision. Decide on them before closing.`,
    };
  }

  const { error } = await supabase
    .from('events')
    .update({
      status: 'completed',
      closing_summary: {
        closed_at: new Date().toISOString(),
        closed_by: context.membership.id,
        raised: stats?.fund_raised ?? 0,
        spent: stats?.spent ?? 0,
        surplus: Number(stats?.fund_raised ?? 0) - Number(stats?.spent ?? 0),
        contributors: stats?.contributors ?? 0,
        participants: stats?.participants ?? 0,
      },
    })
    .eq('id', event.id);
  if (error) return { error: friendlyDbError(error) };

  refreshEvent(communitySlug, eventSlug);
  return { ...EMPTY_STATE, closed: true, success: 'Event closed and its accounts published.' };
}

// ---------------------------------------------------------------------------
// Where the leftover goes
// ---------------------------------------------------------------------------

/**
 * The committee decides where a closed event's surplus goes.
 *
 * Two answers, not three: the society keeps it, or it goes behind another
 * event. Which movement that becomes — a carry to an event already on the
 * calendar, or to next year's edition — is worked out from the target rather
 * than asked, because that is a fact about the calendar and not a decision
 * about money.
 *
 * The amount is not sent: the database takes the whole of what is left, which
 * is what the ledger says rather than what somebody typed into a box.
 */
export async function allocateSurplus(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const communitySlug = String(formData.get('slug') ?? '');
  const eventSlug = String(formData.get('event') ?? '');
  const context = await requireCapability(communitySlug, 'events:close');
  const event = await findEvent(context.community.id, eventSlug);
  if (!event) return { error: 'That event no longer exists.' };

  const parsed = allocateSurplusSchema.safeParse({
    event_id: event.id,
    answer: formData.get('answer'),
    to_event: formData.get('to_event') || undefined,
    note: formData.get('note') || undefined,
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const kind = surplusKindFor(parsed.data.answer, parsed.data.to_event);
  const supabase = await getSupabase();
  let target = parsed.data.to_event === NEW_EDITION ? null : (parsed.data.to_event ?? null);

  if (kind === 'next_edition') {
    // "Keep it for next year" is useless if next year's event has to exist
    // before you can say it, so the draft is made here and the committee fills
    // it in whenever they get to planning.
    const { data: previous } = await supabase
      .from('events')
      .select('emoji, event_type_id, venue, venue_id, organizer, starts_on')
      .eq('id', event.id)
      .single();
    const name = nextEditionName(event.name, previous?.starts_on);
    const { data: created, error: createError } = await supabase
      .from('events')
      .insert({
        community_id: context.community.id,
        slug: makeEventSlug(name),
        name,
        emoji: previous?.emoji ?? '🎉',
        event_type_id: previous?.event_type_id ?? null,
        venue: previous?.venue ?? null,
        venue_id: previous?.venue_id ?? null,
        organizer: previous?.organizer ?? null,
        starts_on: nextEditionDate(previous?.starts_on),
        fund_target: 0,
        status: 'draft',
        created_by: context.user.id,
      })
      .select('id, slug')
      .single();
    if (createError) return { error: friendlyDbError(createError) };
    target = created.id;
  }

  const { error } = await supabase.rpc('allocate_surplus', {
    p_event_id: event.id,
    p_kind: kind,
    p_to_event_id: target ?? undefined,
    p_note: parsed.data.note ?? undefined,
  });
  if (error) return { error: friendlyDbError(error) };

  refreshEvent(communitySlug, eventSlug);
  revalidatePath(`/app/${communitySlug}`);
  revalidatePath(`/app/${communitySlug}/money`);
  revalidatePath(`/app/${communitySlug}/events`);
  return {
    ...EMPTY_STATE,
    success:
      kind === 'society_balance'
        ? 'Kept for the society. Everybody can see it on their home screen.'
        : 'Carried across. It now counts towards that event.',
  };
}

/** The way back out: society funds put behind an event that is still collecting. */
export async function spendSocietyBalance(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const communitySlug = String(formData.get('slug') ?? '');
  const eventSlug = String(formData.get('event') ?? '');
  const context = await requireCapability(communitySlug, 'events:close');
  const event = await findEvent(context.community.id, eventSlug);
  if (!event) return { error: 'That event no longer exists.' };

  const parsed = spendBalanceSchema.safeParse({
    to_event_id: event.id,
    amount: formData.get('amount'),
    note: formData.get('note') || undefined,
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await getSupabase();
  const { error } = await supabase.rpc('spend_society_balance', {
    p_to_event_id: event.id,
    p_amount: parsed.data.amount,
    p_note: parsed.data.note ?? undefined,
  });
  if (error) return { error: friendlyDbError(error) };

  refreshEvent(communitySlug, eventSlug);
  revalidatePath(`/app/${communitySlug}`);
  revalidatePath(`/app/${communitySlug}/money`);
  return { ...EMPTY_STATE, success: 'Society funds are now behind this event.' };
}

/**
 * The committee answers a resident who says they have moved.
 *
 * Seating somebody decides who the ledger names against their money, so the
 * database gates this on being committee rather than staff — same as the
 * control on the People page, which calls the same seating code underneath.
 */
export async function reviewFlatChange(formData: FormData): Promise<void> {
  const communitySlug = String(formData.get('slug') ?? '');
  await requireCapability(communitySlug, 'roles:manage');

  const supabase = await getSupabase();
  await supabase.rpc('review_unit_change', {
    p_request_id: String(formData.get('request_id') ?? ''),
    p_approve: formData.get('approve') === '1',
    p_reason: String(formData.get('reason') ?? '').trim() || undefined,
  });

  revalidatePath(`/app/${communitySlug}/todo`);
  revalidatePath(`/app/${communitySlug}/people`);
  // Their payments in the ledger are labelled from where they live.
  revalidatePath(`/app/${communitySlug}/money`);
}
