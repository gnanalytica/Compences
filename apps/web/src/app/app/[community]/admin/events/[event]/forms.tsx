'use client';

import {
  COPY,
  NEW_EDITION,
  SURPLUS_ANSWERS,
  SURPLUS_ANSWER_DETAIL,
  SURPLUS_ANSWER_LABEL,
  NO_VENDOR,
  budgetLineLabel,
  formatDate,
  formatMoney,
  overLineBy,
  todayIn,
  vendorGroups,
  type SurplusAnswer,
} from '@compences/core';
import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { EMPTY_STATE, wasAccepted, type ActionState } from '@/lib/action-state';
import { FileUpload } from '@/components/file-upload';
import { CatalogueSelect, type PickerItem } from '@/components/catalogue-select';
import { SuggestionList } from '@/components/suggestion-list';
import {
  addActivity,
  addBudgetLine,
  addVendorServices,
  allocateSurplus,
  closeEvent,
  correctExpense,
  editActivity,
  recordPayment,
  reviewExpense,
  reviewPayment,
  spendSocietyBalance,
  submitExpense,
  updateEventDetails,
  type CloseState,
} from '../actions';

function Submit({
  label,
  busy,
  variant,
  disabled,
}: {
  label: string;
  busy: string;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant={variant} disabled={pending || disabled}>
      {pending ? busy : label}
    </Button>
  );
}

export function Feedback({ state }: { state: ActionState }) {
  if (state.error) {
    return (
      <p role="alert" className="text-danger text-sm">
        {state.error}
      </p>
    );
  }
  if (state.success) {
    return (
      <p role="status" className="text-success text-sm">
        {state.success}
      </p>
    );
  }
  return null;
}

/**
 * Resets itself after each submission so staff can add several in a row.
 * `version` changes too, for controlled pieces a native reset cannot clear
 * (such as an uploaded file's path).
 */
function useResettingAction(fn: (prev: ActionState, formData: FormData) => Promise<ActionState>) {
  const [state, action] = useActionState<ActionState, FormData>(fn, EMPTY_STATE);
  const [seen, setSeen] = useState(state);
  const [version, setVersion] = useState(0);
  const ref = useRef<HTMLFormElement>(null);

  // Only a submit the server accepted clears the form. It used to clear in the
  // wrapper right after awaiting the action, which runs either way — so a
  // rejected budget line or activity was wiped from the fields it would have to
  // be retyped into, with the error sitting above them.
  //
  // The counter advances during render rather than from an effect: bumping a key
  // is adjusting state to new input, not synchronising with the outside world,
  // and doing it in an effect costs a second commit. useActionState returns a
  // fresh object per submit, so a second success still counts.
  if (seen !== state) {
    setSeen(state);
    if (wasAccepted(state)) setVersion((current) => current + 1);
  }

  // Emptying the fields is a DOM change, so that part does belong here.
  useEffect(() => {
    if (wasAccepted(state)) ref.current?.reset();
  }, [state]);

  return { state, action, ref, version };
}

/** The catalogue items a form's pickers offer, and where staff can edit them. */
export type Pickers = {
  event_type: PickerItem[];
  venue: PickerItem[];
  budget_category: PickerItem[];
  activity_type: PickerItem[];
  vendor: PickerItem[];
  manageHref: string;
};

function Hidden({ slug, eventSlug }: { slug: string; eventSlug: string }) {
  return (
    <>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="event" value={eventSlug} />
    </>
  );
}

export function EventDetailsForm({
  slug,
  event,
  pickers,
}: {
  slug: string;
  pickers: Pickers;
  event: {
    slug: string;
    emoji: string;
    name: string;
    starts_on: string;
    ends_on: string | null;
    venue: string | null;
    venue_id: string | null;
    event_type_id: string | null;
    organizer: string | null;
    description: string | null;
    whatsapp_group_url: string | null;
  };
}) {
  const [state, action] = useActionState<ActionState, FormData>(updateEventDetails, EMPTY_STATE);
  return (
    <form action={action} className="space-y-4">
      <Hidden slug={slug} eventSlug={event.slug} />
      {/* Kept as it was for the WhatsApp bot's messages; the app shows none. */}
      <input type="hidden" name="emoji" value={event.emoji} />
      <Field label="Name" htmlFor="ev-name" error={state.fieldErrors?.name} required>
        {(control) => <Input {...control} name="name" defaultValue={event.name} required />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Starts" htmlFor="ev-start" error={state.fieldErrors?.starts_on} required>
          {(control) => (
            <Input
              {...control}
              name="starts_on"
              type="date"
              defaultValue={event.starts_on}
              required
            />
          )}
        </Field>
        <Field label="Ends" htmlFor="ev-end" error={state.fieldErrors?.ends_on}>
          {(control) => (
            <Input {...control} name="ends_on" type="date" defaultValue={event.ends_on ?? ''} />
          )}
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <CatalogueSelect
          slug={slug}
          kind="event_type"
          name="event_type"
          label="Event type"
          items={pickers.event_type}
          defaultId={event.event_type_id}
          placeholder="Choose a type"
        />
        <CatalogueSelect
          slug={slug}
          kind="venue"
          name="venue"
          label="Venue"
          items={pickers.venue}
          defaultId={event.venue_id}
          defaultLabel={event.venue}
          placeholder="Choose a venue"
          manageHref={pickers.manageHref}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Organised by" htmlFor="ev-org">
          {(control) => (
            <Input {...control} name="organizer" defaultValue={event.organizer ?? ''} />
          )}
        </Field>
      </div>
      <Field
        label="WhatsApp group"
        htmlFor="ev-whatsapp"
        error={state.fieldErrors?.whatsapp_group_url}
        hint="WhatsApp → the group → Group info → Invite via link. Members get a button to join."
      >
        {(control) => (
          <Input
            {...control}
            name="whatsapp_group_url"
            type="url"
            inputMode="url"
            defaultValue={event.whatsapp_group_url ?? ''}
            placeholder="https://chat.whatsapp.com/…"
            maxLength={120}
          />
        )}
      </Field>
      <Field label="Description" htmlFor="ev-desc">
        {(control) => (
          <Textarea {...control} name="description" defaultValue={event.description ?? ''} />
        )}
      </Field>
      <Feedback state={state} />
      <Submit label="Save details" busy="Saving…" />
    </form>
  );
}

/**
 * Adds one more service to a vendor already in the budget: a row in the same
 * columns as the services above it, so it reads as the next line of the list.
 */
export function AddServiceForm({
  slug,
  eventSlug,
  vendor,
  formKey,
  rowClassName,
}: {
  slug: string;
  eventSlug: string;
  /** The vendor's name, or null for the services waiting on a vendor. */
  vendor: string | null;
  /** Unique per vendor, for the fields' ids. */
  formKey: string;
  /** The grid the service rows above use. */
  rowClassName: string;
}) {
  const { state, action, ref } = useResettingAction(addBudgetLine);
  const errors = [state.fieldErrors?.category, state.fieldErrors?.amount].filter(Boolean);
  return (
    <form ref={ref} action={action} className="space-y-1.5">
      <Hidden slug={slug} eventSlug={eventSlug} />
      <input type="hidden" name="vendor" value={vendor ?? ''} />
      <div className={rowClassName}>
        <label className="sr-only" htmlFor={`as-type-${formKey}`}>
          Another service{vendor ? ` from ${vendor}` : ''}
        </label>
        <Input
          id={`as-type-${formKey}`}
          name="category"
          list="budget-types"
          placeholder="Another service"
          maxLength={80}
          autoComplete="off"
          required
        />
        <label className="sr-only" htmlFor={`as-amount-${formKey}`}>
          Its budget
        </label>
        <Input
          id={`as-amount-${formKey}`}
          name="amount"
          type="number"
          min={1}
          step="1"
          placeholder="₹"
          required
        />
        <div className="col-span-2 flex justify-end sm:col-span-1">
          <Submit label="Add service" busy="Adding…" variant="secondary" />
        </div>
      </div>
      {errors.length ? <p className="text-danger text-sm">{errors.join(' ')}</p> : null}
      <Feedback state={state} />
    </form>
  );
}

type ServiceRow = { key: number; type: string; amount: string };

/**
 * A new vendor and the services they provide, each with its own budget. The
 * services post as rows, so a vendor doing the pandal, the stage and the
 * lighting is added in one go.
 */
export function AddVendorForm({
  slug,
  eventSlug,
  pickers,
}: {
  slug: string;
  eventSlug: string;
  pickers: Pickers;
}) {
  const { state, action, ref, version } = useResettingAction(addVendorServices);
  return (
    <form ref={ref} action={action} className="space-y-4">
      <Hidden slug={slug} eventSlug={eventSlug} />
      <SuggestionList id="av-vendors" items={pickers.vendor} />
      <Field
        label="Vendor"
        htmlFor="av-vendor"
        error={state.fieldErrors?.vendor}
        hint="Leave it blank if you haven’t chosen one yet."
      >
        {(control) => (
          <Input
            {...control}
            name="vendor"
            list="av-vendors"
            placeholder="Sri Lakshmi Tents"
            maxLength={80}
            autoComplete="off"
          />
        )}
      </Field>
      <ServiceRows key={version} idPrefix="av" />
      <Feedback state={state} />
      <Submit label="Add vendor" busy="Adding…" />
    </form>
  );
}

/**
 * Service and budget rows for one vendor, posted as `budget_type` and
 * `budget_amount`. One blank row to start; a row left empty is ignored.
 */
export function ServiceRows({
  idPrefix,
  vendor,
}: {
  idPrefix: string;
  /** When set, posted beside every row as `budget_vendor`. */
  vendor?: string;
}) {
  const [rows, setRows] = useState<ServiceRow[]>([{ key: 0, type: '', amount: '' }]);
  const [nextKey, setNextKey] = useState(1);
  const total = rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  const patch = (key: number, change: Partial<ServiceRow>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...change } : row)));

  return (
    <div className="space-y-2">
      <div className="text-ink-muted flex gap-2 text-xs">
        <span className="flex-1">Service</span>
        <span className="w-32">Budget (₹)</span>
        <span className="w-8" aria-hidden="true" />
      </div>
      {rows.map((row, index) => (
        <div key={row.key} className="flex items-center gap-2">
          {vendor !== undefined ? (
            <input type="hidden" name="budget_vendor" value={vendor} />
          ) : null}
          <label className="sr-only" htmlFor={`${idPrefix}-type-${row.key}`}>
            Service {index + 1}
          </label>
          <Input
            id={`${idPrefix}-type-${row.key}`}
            name="budget_type"
            list="budget-types"
            value={row.type}
            onChange={(event) => patch(row.key, { type: event.target.value })}
            placeholder={index === 0 ? 'Pandal and stage' : 'Lighting'}
            maxLength={80}
            autoComplete="off"
            className="min-w-0 flex-1"
          />
          <label className="sr-only" htmlFor={`${idPrefix}-amt-${row.key}`}>
            Budget for service {index + 1}
          </label>
          <Input
            id={`${idPrefix}-amt-${row.key}`}
            name="budget_amount"
            type="number"
            min={0}
            step="1"
            value={row.amount}
            onChange={(event) => patch(row.key, { amount: event.target.value })}
            placeholder="₹"
            required={Boolean(row.type.trim())}
            className="w-32"
          />
          <button
            type="button"
            onClick={() => setRows((current) => current.filter((r) => r.key !== row.key))}
            className="text-ink-subtle hover:text-ink w-8 p-1.5 disabled:opacity-30"
            aria-label={`Remove service ${index + 1}`}
            disabled={rows.length === 1}
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      ))}
      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            setRows((current) => [...current, { key: nextKey, type: '', amount: '' }]);
            setNextKey((key) => key + 1);
          }}
        >
          <Plus className="size-4" aria-hidden="true" />
          Add a service
        </Button>
        {total > 0 ? (
          <span className="text-ink-muted text-sm tabular-nums">{formatMoney(total)} in all</span>
        ) : null}
      </div>
    </div>
  );
}

export function AddActivityForm({
  slug,
  eventSlug,
  pickers,
}: {
  slug: string;
  eventSlug: string;
  pickers: Pickers;
}) {
  const { state, action, ref, version } = useResettingAction(addActivity);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('');
  return (
    <form
      ref={ref}
      action={async (formData) => {
        await action(formData);
        setName('');
        setEmoji('');
      }}
      className="space-y-3"
    >
      <Hidden slug={slug} eventSlug={eventSlug} />
      <CatalogueSelect
        key={version}
        slug={slug}
        kind="activity_type"
        name="activity_type"
        label="Type"
        items={pickers.activity_type}
        placeholder="Choose a type (optional)"
        hint="Fills in the name."
        manageHref={pickers.manageHref}
        onPick={(item) => {
          if (!item) return;
          setName(item.label);
          if (item.emoji) setEmoji(item.emoji);
        }}
      />
      <input type="hidden" name="emoji" value={emoji} />
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-40 flex-1">
          <Field label="Activity" htmlFor="act-name" error={state.fieldErrors?.name}>
            {(control) => (
              <Input
                {...control}
                name="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Kids’ rangoli contest"
                required
              />
            )}
          </Field>
        </div>
        <div className="w-28">
          <Field
            label="Places"
            htmlFor="act-capacity"
            hint="Blank = no limit"
            error={state.fieldErrors?.capacity}
          >
            {(control) => <Input {...control} name="capacity" type="number" min={1} />}
          </Field>
        </div>
      </div>
      <Field label="Description" htmlFor="act-desc">
        {(control) => <Textarea {...control} name="description" rows={2} />}
      </Field>
      <Feedback state={state} />
      <Submit label="Add activity" busy="Adding…" />
    </form>
  );
}

/** A date added to the list, which stays in date order and holds each day once. */
const withDate = (dates: string[], date: string) =>
  dates.includes(date) ? dates : [...dates, date].sort();

/**
 * Everything about an activity once it is added, including what adding leaves
 * out to stay short: who coordinates it, and when it practises.
 */
export function EditActivityForm({
  slug,
  eventSlug,
  activity,
  members,
}: {
  slug: string;
  eventSlug: string;
  activity: {
    id: string;
    name: string;
    emoji: string;
    description: string | null;
    capacity: number | null;
    coordinator_id: string | null;
    coordinator_name: string | null;
    practice_dates: string[];
  };
  /** Everyone in the society who could coordinate it. */
  members: { id: string; label: string }[];
}) {
  const [state, action] = useActionState<ActionState, FormData>(editActivity, EMPTY_STATE);
  const [dates, setDates] = useState(activity.practice_dates);
  const [draft, setDraft] = useState('');
  const id = activity.id;
  // A coordinator who has since left the list is still offered, so saving a
  // new name doesn't quietly take them off the activity.
  const coordinatorGone =
    activity.coordinator_id !== null &&
    !members.some((member) => member.id === activity.coordinator_id);

  return (
    <form
      action={(formData) => {
        // The picker is named too, so a date picked and never added is still
        // saved; the list catches up to show it.
        if (draft) {
          setDates((current) => withDate(current, draft));
          setDraft('');
        }
        action(formData);
      }}
      className="space-y-3"
    >
      <Hidden slug={slug} eventSlug={eventSlug} />
      <input type="hidden" name="activity_id" value={id} />
      <input type="hidden" name="emoji" value={activity.emoji} />
      <Field label="Activity" htmlFor={`act-name-${id}`} error={state.fieldErrors?.name}>
        {(control) => <Input {...control} name="name" defaultValue={activity.name} required />}
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Places"
          htmlFor={`act-capacity-${id}`}
          hint="Blank = no limit"
          error={state.fieldErrors?.capacity}
        >
          {(control) => (
            <Input
              {...control}
              name="capacity"
              type="number"
              min={1}
              defaultValue={activity.capacity ?? ''}
            />
          )}
        </Field>
        <Field
          label="Coordinator"
          htmlFor={`act-coordinator-${id}`}
          error={state.fieldErrors?.coordinator_id}
        >
          {(control) => (
            <Select {...control} name="coordinator_id" defaultValue={activity.coordinator_id ?? ''}>
              <option value="">No coordinator</option>
              {coordinatorGone ? (
                <option value={activity.coordinator_id ?? ''}>
                  {activity.coordinator_name ?? 'Current coordinator'}
                </option>
              ) : null}
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <Field label="Description" htmlFor={`act-desc-${id}`} error={state.fieldErrors?.description}>
        {(control) => (
          <Textarea
            {...control}
            name="description"
            rows={2}
            defaultValue={activity.description ?? ''}
          />
        )}
      </Field>
      <fieldset className="space-y-2">
        <legend className="text-ink text-sm font-medium">Practice dates</legend>
        {dates.length ? (
          <ul className="space-y-1">
            {dates.map((date) => (
              <li key={date} className="flex items-center justify-between gap-3 text-sm">
                <input type="hidden" name="practice_date" value={date} />
                <span className="text-ink">{formatDate(date)}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setDates((current) => current.filter((day) => day !== date))}
                >
                  Remove<span className="sr-only"> {formatDate(date)}</span>
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={`act-practice-${id}`} className="sr-only">
            Practice date to add
          </label>
          <Input
            id={`act-practice-${id}`}
            name="practice_date"
            type="date"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className="w-44"
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={!draft}
            onClick={() => {
              setDates((current) => withDate(current, draft));
              setDraft('');
            }}
          >
            Add date
          </Button>
        </div>
        {state.fieldErrors?.practice_dates ? (
          <p role="alert" className="text-danger text-xs">
            {state.fieldErrors.practice_dates}
          </p>
        ) : null}
      </fieldset>
      <Feedback state={state} />
      <Submit label="Save changes" busy="Saving…" />
    </form>
  );
}

type ExpenseDraft = {
  id: string;
  name: string;
  category: string | null;
  category_id: string | null;
  budget_line_id: string | null;
  status: string;
  amount: number;
  vendor: string | null;
  vendor_id: string | null;
  paid_by: string | null;
  method: string;
  bill_url: string | null;
  spent_on: string;
};

/** A budget line a bill can be paid out of, with what it has left. */
export type BillLine = {
  id: string;
  category: string;
  vendor: string | null;
  planned: number;
  remaining: number;
  pending: number;
};

/** "₹6L total · ₹6L remaining", plus "· ₹1L pending" when bills are waiting. */
export function lineFigures(
  line: { planned: number; remaining: number; pending: number },
  currency: string,
) {
  return [
    `${formatMoney(line.planned, currency)} total`,
    `${formatMoney(line.remaining, currency)} remaining`,
    line.pending > 0 ? `${formatMoney(line.pending, currency)} pending` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/**
 * The first half of the bill form: the vendor, then which of their services
 * the bill is for (one budget line each), what that service has left, and how
 * much this bill is for. A vendor with one service has it chosen for you. The
 * amount starts empty — the line's balance is information, not a suggestion.
 * Going past what is left warns but does not stop the bill, since real
 * spending runs over and the committee decides.
 */
function BillLineFields({
  lines,
  currency,
  expense,
  errors,
}: {
  lines: BillLine[];
  currency: string;
  expense?: ExpenseDraft;
  errors: Record<string, string> | undefined;
}) {
  const id = expense?.id ?? 'new';
  const vendors = vendorGroups(lines);
  const startingLine = lines.find((entry) => entry.id === expense?.budget_line_id);
  const [vendorKey, setVendorKey] = useState(
    startingLine ? (vendors.find((v) => v.lines.includes(startingLine))?.key ?? null) : null,
  );
  const [lineId, setLineId] = useState(expense?.budget_line_id ?? '');
  const [amount, setAmount] = useState(expense ? String(expense.amount) : '');
  const vendor = vendors.find((entry) => entry.key === vendorKey);
  const line = lines.find((entry) => entry.id === lineId);
  // A bill already approved against this line is counted in what the line has
  // spent; the correction replaces it, so it is not held against itself.
  const own =
    expense?.status === 'approved' && expense.budget_line_id === lineId ? expense.amount : 0;
  const over = line ? overLineBy(line.remaining + own, Number(amount) || 0) : 0;
  // A bill from before bills drew on a line has none, and may stay without.
  const legacy = Boolean(expense) && !expense?.budget_line_id;

  const chooseVendor = (key: string) => {
    const next = vendors.find((entry) => entry.key === key);
    setVendorKey(next ? key : null);
    // One service: nothing to choose.
    setLineId(next?.lines.length === 1 ? next.lines[0]!.id : '');
  };

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Vendor"
          htmlFor={`ex-vendor-pick-${id}`}
          error={errors?.budget_line_id}
          hint={
            lines.length
              ? undefined
              : 'This event has no budget yet. Add a vendor on the Budget tab first.'
          }
          required={!legacy}
        >
          {(control) => (
            <Select
              {...control}
              value={vendorKey ?? ''}
              onChange={(event) => chooseVendor(event.target.value)}
              required={!legacy}
            >
              <option value="">{legacy ? 'Not in the budget' : 'Choose a vendor'}</option>
              {vendors.map((entry) => (
                <option key={entry.key || 'none'} value={entry.key}>
                  {entry.vendor ?? NO_VENDOR}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Service" htmlFor={`ex-line-${id}`} required={!legacy}>
          {(control) => (
            <Select
              {...control}
              name="budget_line_id"
              value={lineId}
              onChange={(event) => setLineId(event.target.value)}
              disabled={!vendor}
              required={!legacy}
            >
              <option value="">{vendor ? 'Choose a service' : 'Choose a vendor first'}</option>
              {vendor?.lines.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.category}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      {line ? (
        <div className="bg-surface-sunken space-y-2 rounded-lg px-4 py-3 text-sm">
          {line.vendor ? null : (
            <Field
              label="Who was paid"
              htmlFor={`ex-vendor-${id}`}
              error={errors?.vendor}
              hint="No vendor has been chosen for this service yet, so say who was paid."
              required
            >
              {(control) => (
                <Input
                  {...control}
                  name="vendor"
                  defaultValue={expense?.vendor ?? ''}
                  maxLength={80}
                  required
                />
              )}
            </Field>
          )}
          <p className="text-ink-muted">
            <span className="text-ink font-medium">{budgetLineLabel(line)}</span> ·{' '}
            {lineFigures(line, currency)}
          </p>
        </div>
      ) : legacy && !vendor ? (
        <Field
          label="Who was paid"
          htmlFor={`ex-vendor-${id}`}
          error={errors?.vendor}
          hint="Not in the budget."
          required
        >
          {(control) => (
            <Input
              {...control}
              name="vendor"
              defaultValue={expense?.vendor ?? ''}
              maxLength={140}
              required
            />
          )}
        </Field>
      ) : null}
      <Field label="Amount billed (₹)" htmlFor={`ex-amount-${id}`} error={errors?.amount} required>
        {(control) => (
          <Input
            {...control}
            name="amount"
            type="number"
            min={1}
            step="1"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
          />
        )}
      </Field>
      {over > 0 ? (
        <p role="status" className="text-warning text-sm">
          {formatMoney(over, currency)} over what’s left on this line. You can still upload it; the
          committee will see the difference.
        </p>
      ) : null}
    </>
  );
}

const METHODS = [
  ['upi', 'UPI'],
  ['cash', 'Cash'],
  ['bank_transfer', 'Bank transfer'],
  ['cheque', 'Cheque'],
  ['card', 'Card'],
  ['netbanking', 'Net banking'],
  ['other', 'Other'],
] as const;

/**
 * Upload a new bill, or correct and re-upload one that is pending or sent back.
 * The budget line, amount and the photo come first, then remarks; the vendor
 * comes with the line. The committee approves a bill on everybody's behalf, and
 * cannot without knowing who was paid and seeing the bill. The rest has
 * sensible defaults (today, UPI, paid by the society) under "More details".
 */
export function ExpenseForm({
  slug,
  eventSlug,
  communityId,
  eventId,
  expense,
  lines,
  currency,
  today,
}: {
  slug: string;
  eventSlug: string;
  communityId: string;
  eventId: string;
  expense?: ExpenseDraft;
  /** The event's budget lines, with what each has left. */
  lines: BillLine[];
  currency: string;
  /** Today in the society's timezone, the default bill date. */
  today: string;
}) {
  const [uploading, setUploading] = useState(false);
  const creating = !expense;
  const created = useResettingAction(submitExpense);
  const [corrected, correctAction] = useActionState<ActionState, FormData>(
    correctExpense,
    EMPTY_STATE,
  );
  const state = creating ? created.state : corrected;
  const id = expense?.id ?? 'new';
  const detailErrors = state.fieldErrors?.spent_on || state.fieldErrors?.paid_by;

  return (
    <form
      ref={creating ? created.ref : undefined}
      action={creating ? created.action : correctAction}
      className="space-y-4"
    >
      <Hidden slug={slug} eventSlug={eventSlug} />
      {expense ? <input type="hidden" name="expense_id" value={expense.id} /> : null}

      <BillLineFields
        key={creating ? `line-${created.version}` : `line-${expense.id}`}
        lines={lines}
        currency={currency}
        expense={expense}
        errors={state.fieldErrors}
      />
      <div className="space-y-1.5">
        <FileUpload
          key={creating ? `new-${created.version}` : expense.id}
          bucket="bills"
          folder={`${communityId}/${eventId}`}
          name="bill_url"
          label="Photo of the bill (required)"
          hint="A photo or PDF, up to 10 MB. Residents see it once the committee approves."
          maxBytes={10 * 1_048_576}
          defaultPath={expense?.bill_url}
          onUploadingChange={setUploading}
        />
        {state.fieldErrors?.bill_url ? (
          <p className="text-danger text-sm">{state.fieldErrors.bill_url}</p>
        ) : null}
      </div>
      <Field
        label="Remarks"
        htmlFor={`ex-name-${id}`}
        error={state.fieldErrors?.name}
        hint="What the money was for. Residents see this beside the bill."
        required
      >
        {(control) => (
          <Input
            {...control}
            name="name"
            placeholder="Pandal and stage, advance"
            defaultValue={expense?.name}
            maxLength={140}
            required
          />
        )}
      </Field>

      <details className="group border-border-base rounded-lg border" open={!creating}>
        <summary className="text-ink flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
          {COPY.moreDetails}
          <span className="text-ink-subtle text-xs font-normal group-open:hidden">
            Paid by, method, date
          </span>
        </summary>
        <div className="border-border-base space-y-4 border-t px-4 py-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              label="Paid by"
              htmlFor={`ex-paid-${id}`}
              error={state.fieldErrors?.paid_by}
              hint="Blank if the society paid."
            >
              {(control) => (
                <Input {...control} name="paid_by" defaultValue={expense?.paid_by ?? ''} />
              )}
            </Field>
            <Field label="Method" htmlFor={`ex-method-${id}`}>
              {(control) => (
                <Select {...control} name="method" defaultValue={expense?.method ?? 'upi'}>
                  {METHODS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Date" htmlFor={`ex-date-${id}`} error={state.fieldErrors?.spent_on}>
              {(control) => (
                <Input
                  {...control}
                  name="spent_on"
                  type="date"
                  defaultValue={expense?.spent_on ?? today}
                />
              )}
            </Field>
          </div>
        </div>
      </details>
      {detailErrors ? (
        <p role="alert" className="text-danger text-sm">
          Check the fields under {COPY.moreDetails}.
        </p>
      ) : null}
      <Feedback state={state} />
      <Submit
        label={creating ? 'Upload bill' : 'Save correction'}
        busy={creating ? 'Uploading…' : 'Saving…'}
        disabled={uploading}
      />
    </form>
  );
}

/** What the committee is told when approving a bill would overdraw its line. */
export function OverBudgetFlag({ overBy, currency }: { overBy: number; currency: string }) {
  return (
    <p role="status" className="text-warning text-xs font-medium">
      Over budget by {formatMoney(overBy, currency)}: approving takes this line below zero.
    </p>
  );
}

export function ReviewExpenseForm({
  slug,
  eventSlug,
  expenseId,
  mayApprove,
  overBy = 0,
  currency = 'INR',
}: {
  slug: string;
  eventSlug: string;
  expenseId: string;
  /** False when the viewer wrote the version waiting to be approved. */
  mayApprove: boolean;
  /** How far approving would take its budget line below zero. Warns; never blocks. */
  overBy?: number;
  currency?: string;
}) {
  const [state, action] = useActionState<ActionState, FormData>(reviewExpense, EMPTY_STATE);
  return (
    <form action={action} className="space-y-2">
      <Hidden slug={slug} eventSlug={eventSlug} />
      <input type="hidden" name="expense_id" value={expenseId} />
      <label htmlFor={`note-${expenseId}`} className="sr-only">
        Note for staff
      </label>
      <Input
        id={`note-${expenseId}`}
        name="note"
        placeholder="Note for staff, if sending back or rejecting"
      />
      {overBy > 0 ? <OverBudgetFlag overBy={overBy} currency={currency} /> : null}
      <div className="flex flex-wrap gap-2">
        {mayApprove ? (
          <Button type="submit" name="decision" value="approved" size="sm">
            Approve
          </Button>
        ) : (
          <p className="text-ink-muted self-center text-xs">
            You wrote this version, so another committee member approves it.
          </p>
        )}
        <Button
          type="submit"
          name="decision"
          value="changes_requested"
          size="sm"
          variant="secondary"
        >
          Send back
        </Button>
        <Button type="submit" name="decision" value="rejected" size="sm" variant="ghost">
          Reject
        </Button>
      </div>
      <Feedback state={state} />
    </form>
  );
}

/** Staff confirm a reported UPI receipt, or turn it down with a reason. */
export function ReviewPaymentForm({
  slug,
  eventSlug,
  contributionId,
  showReferenceField,
  reportedAmount,
  currency,
  mayCorrect,
}: {
  slug: string;
  eventSlug: string;
  contributionId: string;
  /** True when the row has no reference yet, or the caller cannot tell. */
  showReferenceField: boolean;
  /** What the resident says they paid, to correct against the statement. */
  reportedAmount: number | null;
  currency: string;
  /** Rewriting a recorded amount is a ledger correction: committee only. */
  mayCorrect: boolean;
}) {
  const [state, action] = useActionState<ActionState, FormData>(reviewPayment, EMPTY_STATE);
  return (
    <form action={action} className="space-y-2">
      <Hidden slug={slug} eventSlug={eventSlug} />
      <input type="hidden" name="contribution_id" value={contributionId} />
      {/* Only when it is missing. Whoever is confirming has the statement open
          and the screenshot in front of them, so this is the cheapest moment
          in the whole flow to capture the one thing reconciliation needs — and
          asking for it again on rows that already have it would be noise. */}
      {showReferenceField ? (
        <>
          <label htmlFor={`pay-ref-${contributionId}`} className="sr-only">
            UPI transaction ID from the screenshot
          </label>
          <Input
            id={`pay-ref-${contributionId}`}
            name="reference"
            inputMode="numeric"
            autoComplete="off"
            placeholder="UPI transaction ID from the screenshot (optional)"
          />
        </>
      ) : null}
      {/* Pre-filled with what the resident reported, so confirming an
          accurate report is still one tap. A resident who typed ₹1,000 and
          sent ₹10 is a digit, not a fraud, and rejecting the whole receipt
          over it makes them report it all over again. */}
      {mayCorrect && reportedAmount ? (
        <>
          <label htmlFor={`pay-amount-${contributionId}`} className="sr-only">
            Amount the bank shows
          </label>
          <Input
            id={`pay-amount-${contributionId}`}
            name="amount"
            type="number"
            min={1}
            step="1"
            inputMode="numeric"
            autoComplete="off"
            defaultValue={reportedAmount}
            aria-describedby={`pay-amount-hint-${contributionId}`}
          />
          <p id={`pay-amount-hint-${contributionId}`} className="text-ink-subtle text-xs">
            Reported as {formatMoney(reportedAmount, currency)}. Change it only to what the
            statement shows; the resident is told either way.
          </p>
        </>
      ) : null}
      <label htmlFor={`pay-note-${contributionId}`} className="sr-only">
        Reason, if turning it down
      </label>
      <Input
        id={`pay-note-${contributionId}`}
        name="note"
        placeholder="Reason, if it is not on the bank statement"
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" name="decision" value="confirm" size="sm">
          Confirm
        </Button>
        <Button type="submit" name="decision" value="reject" size="sm" variant="ghost">
          Turn down
        </Button>
      </div>
      <Feedback state={state} />
    </form>
  );
}

export function RecordPaymentForm({
  slug,
  eventSlug,
  units,
  communityId,
  membershipId,
}: {
  slug: string;
  eventSlug: string;
  units: { id: string; label: string }[];
  communityId: string;
  /** Whoever is recording it: screenshots go in their own folder. */
  membershipId: string;
}) {
  const { state, action, ref, version } = useResettingAction(recordPayment);
  const [uploading, setUploading] = useState(false);
  const today = todayIn();
  return (
    <form ref={ref} action={action} className="space-y-4">
      <Hidden slug={slug} eventSlug={eventSlug} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Flat" htmlFor="pay-unit" error={state.fieldErrors?.unit_id} required>
          {(control) => (
            <Select {...control} name="unit_id" defaultValue="" required>
              <option value="" disabled>
                Pick a flat
              </option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Amount (₹)" htmlFor="pay-amount" error={state.fieldErrors?.amount} required>
          {(control) => (
            <Input {...control} name="amount" type="number" min={1} step="1" required />
          )}
        </Field>
        <Field label="Received on" htmlFor="pay-date" error={state.fieldErrors?.paid_on}>
          {(control) => <Input {...control} name="paid_on" type="date" defaultValue={today} />}
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Method" htmlFor="pay-method">
          {(control) => (
            <Select {...control} name="method" defaultValue="cash">
              {METHODS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field
          label="Reference"
          htmlFor="pay-ref"
          error={state.fieldErrors?.reference}
          hint="UPI transaction ID or cheque number. Needed for anything but cash, unless you attach a screenshot."
        >
          {(control) => <Input {...control} name="reference" />}
        </Field>
      </div>
      <FileUpload
        key={`proof-${version}`}
        bucket="payment-proofs"
        folder={`${communityId}/${membershipId}`}
        name="proof_path"
        label="Screenshot of the receipt"
        hint="For UPI, bank transfer or cheque, if there is no reference to type. Not needed for cash."
        maxBytes={5 * 1_048_576}
        onUploadingChange={setUploading}
      />
      <Feedback state={state} />
      <Submit label="Record receipt" busy="Recording…" disabled={uploading} />
    </form>
  );
}

const closeInitial: CloseState = {};

export function CloseEventForm({
  slug,
  eventSlug,
  eventName,
  openBills,
}: {
  slug: string;
  eventSlug: string;
  eventName: string;
  openBills: number;
}) {
  const [state, action] = useActionState(closeEvent, closeInitial);
  return (
    <Card className="border-danger/40">
      <CardHeader
        title="Close the event"
        description="Publishes the final accounts and freezes the ledger. This cannot be undone."
      />
      <CardBody>
        {openBills > 0 ? (
          <p className="bg-warning/10 text-warning mb-3 rounded-lg px-4 py-3 text-sm">
            {openBills} bill{openBills === 1 ? '' : 's'} still awaiting a decision. Decide on them
            first.
          </p>
        ) : null}
        <form action={action} className="space-y-3">
          <Hidden slug={slug} eventSlug={eventSlug} />
          <Field
            label={`Type “${eventName}” to confirm`}
            htmlFor="close-confirm"
            error={state.fieldErrors?.confirm_name}
          >
            {(control) => <Input {...control} name="confirm_name" autoComplete="off" />}
          </Field>
          <Feedback state={state} />
          <Submit label="Close and publish accounts" busy="Closing…" variant="danger" />
        </form>
      </CardBody>
    </Card>
  );
}

/**
 * What happens to the money left in a closed event.
 *
 * Offered after closing rather than as part of it: closing is a speed bump
 * with a typed confirmation, and burying a second decision inside it is how
 * somebody picks the first radio button to get past the form. It stays on the
 * tab until it is answered, so a committee that wants to talk about it first
 * can come back.
 *
 * No amount field. The figure is what the ledger says, and letting the
 * committee type it would invite a typo into the one number nobody is
 * checking.
 */
export function AllocateSurplusForm({
  slug,
  eventSlug,
  surplus,
  currency,
  openEvents,
  nextEdition,
}: {
  slug: string;
  eventSlug: string;
  surplus: number;
  currency: string;
  openEvents: { id: string; name: string; emoji: string | null; starts_on: string }[];
  /** What next year's edition would be called, if it has to be created. */
  nextEdition: string;
}) {
  const [state, action] = useActionState<ActionState, FormData>(allocateSurplus, EMPTY_STATE);
  const [answer, setAnswer] = useState<SurplusAnswer>('society_balance');

  return (
    <Card className="border-accent/40">
      <CardHeader
        title={`${formatMoney(surplus, currency)} left over`}
        description="Residents’ money the event didn’t spend. Everyone will see what you decide."
      />
      <CardBody>
        <form action={action} className="space-y-4">
          <Hidden slug={slug} eventSlug={eventSlug} />
          <fieldset className="space-y-2">
            <legend className="sr-only">Where the leftover goes</legend>
            {SURPLUS_ANSWERS.map((choice) => (
              <label
                key={choice}
                className={
                  answer === choice
                    ? 'border-accent bg-surface-raised flex cursor-pointer gap-3 rounded-lg border-2 p-3'
                    : 'border-border-base bg-surface-raised hover:bg-surface-sunken flex cursor-pointer gap-3 rounded-lg border p-3'
                }
              >
                <input
                  type="radio"
                  name="answer"
                  value={choice}
                  checked={answer === choice}
                  onChange={() => setAnswer(choice)}
                  className="mt-1"
                />
                <span className="min-w-0">
                  <span className="text-ink block text-sm font-medium">
                    {SURPLUS_ANSWER_LABEL[choice]}
                  </span>
                  <span className="text-ink-subtle block text-xs">
                    {SURPLUS_ANSWER_DETAIL[choice]}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>

          {/* Which event, asked only once they have said it goes behind one.
              Nothing is preselected: a default here either creates a draft
              event nobody asked for, or quietly picks the wrong fund. */}
          {answer === 'another_event' ? (
            <Field label="Which event" htmlFor="surplus-target" error={state.fieldErrors?.to_event}>
              {(control) => (
                <Select {...control} name="to_event" defaultValue="">
                  <option value="" disabled>
                    Choose where it goes
                  </option>
                  {openEvents.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name} · {formatDate(option.starts_on)}
                    </option>
                  ))}
                  <option value={NEW_EDITION}>Create {nextEdition} as a draft</option>
                </Select>
              )}
            </Field>
          ) : null}

          <Field label="Note (optional)" htmlFor="surplus-note">
            {(control) => (
              <Input {...control} name="note" placeholder="Agreed at the October meeting" />
            )}
          </Field>

          <Feedback state={state} />
          <Submit label="Record the decision" busy="Recording…" />
        </form>
      </CardBody>
    </Card>
  );
}

/** Society funds put behind an event that is still collecting. */
export function SpendBalanceForm({
  slug,
  eventSlug,
  balance,
  currency,
}: {
  slug: string;
  eventSlug: string;
  balance: number;
  currency: string;
}) {
  const [state, action] = useActionState<ActionState, FormData>(spendSocietyBalance, EMPTY_STATE);
  return (
    <form action={action} className="space-y-3">
      <Hidden slug={slug} eventSlug={eventSlug} />
      <Field
        label="Amount from what the society kept (₹)"
        htmlFor="balance-amount"
        error={state.fieldErrors?.amount}
        hint={`${formatMoney(balance, currency)} available`}
        required
      >
        {(control) => (
          <Input
            {...control}
            name="amount"
            type="number"
            min={1}
            step="1"
            inputMode="numeric"
            autoComplete="off"
          />
        )}
      </Field>
      <Field label="Note (optional)" htmlFor="balance-note">
        {(control) => <Input {...control} name="note" placeholder="Towards the pandal" />}
      </Field>
      <Feedback state={state} />
      <Submit label="Put it behind this event" busy="Saving…" />
    </form>
  );
}
