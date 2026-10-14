'use client';

import { useActionState, useRef, useState, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { Check, ChevronDown, Plus, X } from 'lucide-react';
import { COPY, DEFAULT_FUND_RULE, formatMoney, FUND_RULES, FUND_RULE_LABEL } from '@compences/core';
import {
  approximateDateNote,
  FestivalNameField,
  type FestivalDraft,
} from '@/components/festival-name-field';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { EMPTY_STATE } from '@/lib/action-state';
import { CatalogueSelect } from '@/components/catalogue-select';
import { cn } from '@/lib/utils';
import type { Pickers } from '../[event]/forms';
import { createEvent, type EventFormState } from '../actions';

/** What happens to money left over, in plain words shared with the app. */
const FUND_RULE_OPTIONS = FUND_RULES.map((value) => ({ value, label: FUND_RULE_LABEL[value] }));

const STEPS = [
  { title: 'The event', hint: 'Name, date and where.' },
  { title: 'Budget', hint: 'What you plan to spend.' },
  { title: 'Activities', hint: 'What residents can join.' },
  { title: 'Review', hint: 'Check, then publish.' },
] as const;

function Buttons() {
  const { pending, data } = useFormStatus();
  const intent = data?.get('intent');
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {/* Save for later comes first, so pressing Enter in a field never publishes. */}
        <Button type="submit" name="intent" value="draft" variant="secondary" disabled={pending}>
          {pending && intent !== 'publish' ? 'Saving…' : COPY.saveForLater}
        </Button>
        <Button type="submit" name="intent" value="publish" disabled={pending}>
          {pending && intent === 'publish' ? 'Publishing…' : COPY.publish}
        </Button>
      </div>
      <p className="text-ink-subtle text-xs">{COPY.publishHint}</p>
    </div>
  );
}

function MoreOptions({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="group border-border-base rounded-lg border">
      <summary className="text-ink flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown
          className="text-ink-subtle size-4 transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div className="border-border-base space-y-4 border-t px-4 py-4">{children}</div>
    </details>
  );
}

/**
 * The step rail. Steps already done are clickable — going back is always safe.
 * Going forward is not, so it only happens through Next, which checks the step
 * you are leaving.
 */
function Rail({
  step,
  furthest,
  onPick,
}: {
  step: number;
  furthest: number;
  onPick: (index: number) => void;
}) {
  return (
    <ol className="mb-5 flex items-center gap-1" aria-label="Progress">
      {STEPS.map((item, index) => {
        const done = index < furthest;
        const here = index === step;
        return (
          <li
            key={item.title}
            // The step you are on takes the room its name needs; the others
            // shrink to their number, so nothing truncates to "The…".
            className={cn('flex min-w-0 items-center gap-2', here ? 'flex-1' : 'flex-none')}
          >
            <button
              type="button"
              onClick={() => (index <= furthest ? onPick(index) : undefined)}
              disabled={index > furthest}
              aria-current={here ? 'step' : undefined}
              className={cn(
                'flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors',
                index <= furthest ? 'hover:bg-surface-sunken' : 'cursor-default',
              )}
            >
              <span
                className={cn(
                  'grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold',
                  here
                    ? 'bg-accent text-accent-ink'
                    : done
                      ? 'bg-accent/15 text-accent'
                      : 'bg-surface-sunken text-ink-subtle',
                )}
              >
                {done && !here ? <Check className="size-3.5" aria-hidden="true" /> : index + 1}
              </span>
              <span
                className={cn(
                  'truncate text-sm',
                  // Only the step you are on is named on a phone; there is no
                  // room for four, and the numbers carry the rest.
                  here ? 'text-ink font-medium' : 'text-ink-muted hidden sm:block',
                )}
              >
                {item.title}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

type Line = { key: number; categoryId: string | null; amount: string };
type ActivityRow = { key: number; typeId: string; name: string; emoji: string };

export function CreateEventForm({
  slug,
  pickers,
  societyName,
  flatCount,
  today,
}: {
  slug: string;
  pickers: Pickers;
  societyName: string;
  /** How many flats the society has, for the per-flat hint. Zero if none yet. */
  flatCount: number;
  /** The society's own today, so a December wizard offers January's Sankranti. */
  today: string;
}) {
  const [state, action] = useActionState<EventFormState, FormData>(createEvent, EMPTY_STATE);
  const [emoji, setEmoji] = useState('');
  // Name and date are controlled because picking a festival fills both, and an
  // uncontrolled field cannot be filled from anywhere but the keyboard.
  const [name, setName] = useState('');
  const [startsOn, setStartsOn] = useState('');
  // Kept only to warn under the date. Cleared the moment somebody edits either
  // field, because the warning is about the date we filled in, not theirs.
  const [picked, setPicked] = useState<FestivalDraft | null>(null);
  // Start with the society's first three budget categories; each row keeps a
  // stable key so removing one does not shuffle the others' choices.
  const [lines, setLines] = useState<Line[]>(() =>
    pickers.budget_category
      .slice(0, 3)
      .map((item, key) => ({ key, categoryId: item.id, amount: '' })),
  );
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [nextKey, setNextKey] = useState(3);
  const total = lines.reduce((sum, line) => sum + Number(line.amount || 0), 0);

  const form = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState(0);
  const [furthest, setFurthest] = useState(0);
  // Read off the form when Review opens, so the summary is the real answers
  // without having to make every field controlled.
  const [summary, setSummary] = useState<Record<string, string>>({});

  const last = STEPS.length - 1;

  // Every field the server validates lives on step 1.
  const rejected = Boolean(state.fieldErrors && Object.keys(state.fieldErrors).length);

  /**
   * Only the first step has required fields, so this is what keeps a hidden
   * empty one from reaching the browser's own check — which would refuse to
   * submit and have nothing it could focus.
   */
  const stepIsValid = (index: number) => {
    const panel = form.current?.querySelector(`[data-step="${index}"]`);
    if (!panel) return true;
    const controls = panel.querySelectorAll<HTMLInputElement>('input, select, textarea');
    for (const control of controls) {
      if (!control.checkValidity()) {
        control.reportValidity();
        return false;
      }
    }
    return true;
  };

  const goTo = (index: number) => {
    setStep(index);
    setFurthest((far) => Math.max(far, index));
    form.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  const next = () => {
    if (!stepIsValid(step)) return;
    const going = Math.min(step + 1, last);
    if (going === last && form.current) {
      const data = new FormData(form.current);
      const read = (name: string) => String(data.get(name) ?? '').trim();
      // CatalogueSelect posts an id; the label lives in the picker it came from.
      const labelOf = (items: typeof pickers.venue, id: string) =>
        items.find((item) => item.id === id)?.label ?? '';
      setSummary({
        name: read('name'),
        starts_on: read('starts_on'),
        ends_on: read('ends_on'),
        venue: labelOf(pickers.venue, read('venue_id')),
        event_type: labelOf(pickers.event_type, read('event_type_id')),
        description: read('description'),
        organizer: read('organizer') || societyName,
        suggested_amount: read('suggested_amount'),
        fund_rule: read('fund_rule') || DEFAULT_FUND_RULE,
      });
    }
    goTo(going);
  };

  const updateActivity = (key: number, patch: Partial<ActivityRow>) =>
    setActivities((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );

  // Every step stays mounted: one submit has to carry the whole form, and a
  // step that unmounted would take its answers with it.
  const panel = (index: number) => ({
    'data-step': index,
    hidden: step !== index,
    className: step === index ? 'space-y-5' : 'hidden',
  });

  return (
    <form ref={form} action={action} className="space-y-5">
      <input type="hidden" name="slug" value={slug} />
      {/* The type's emoji still goes with the event for the WhatsApp bot's
          messages. The app itself shows none. */}
      <input type="hidden" name="emoji" value={emoji} />

      <Rail step={step} furthest={furthest} onPick={goTo} />

      {/* ------------------------------------------------------ 1 · event */}
      <div {...panel(0)}>
        <Card>
          <CardHeader title={STEPS[0].title} description={STEPS[0].hint} />
          <CardBody className="space-y-4">
            <FestivalNameField
              value={name}
              onChange={(next) => {
                setName(next);
                setPicked(null);
              }}
              onPick={(draft) => {
                setStartsOn(draft.startsOn);
                setPicked(draft);
                setEmoji(draft.emoji);
              }}
              error={state.fieldErrors?.name}
              today={today}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Date"
                htmlFor="ne-start"
                error={state.fieldErrors?.starts_on}
                hint={approximateDateNote(picked)}
                required
              >
                {(control) => (
                  <Input
                    {...control}
                    name="starts_on"
                    type="date"
                    required
                    value={startsOn}
                    onChange={(event) => {
                      setStartsOn(event.target.value);
                      setPicked(null);
                    }}
                  />
                )}
              </Field>
              <CatalogueSelect
                slug={slug}
                kind="event_type"
                name="event_type"
                label="Event type"
                items={pickers.event_type}
                placeholder="Choose a type"
                onPick={(item) => {
                  if (item?.emoji) setEmoji(item.emoji);
                }}
              />
            </div>
            <CatalogueSelect
              slug={slug}
              kind="venue"
              name="venue"
              label="Venue"
              items={pickers.venue}
              placeholder="Choose a venue"
              manageHref={pickers.manageHref}
            />
            <Field label="Description" htmlFor="ne-desc">
              {(control) => <Textarea {...control} name="description" rows={3} />}
            </Field>

            <MoreOptions title={COPY.moreOptions}>
              <Field label="Organised by" htmlFor="ne-org">
                {(control) => (
                  <Input {...control} name="organizer" defaultValue={societyName} maxLength={140} />
                )}
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Ends"
                  htmlFor="ne-end"
                  error={state.fieldErrors?.ends_on}
                  hint="For events longer than a day."
                >
                  {(control) => <Input {...control} name="ends_on" type="date" />}
                </Field>
                <Field
                  label="Expected attendance"
                  htmlFor="ne-attendance"
                  error={state.fieldErrors?.expected_attendance}
                >
                  {(control) => (
                    <Input {...control} name="expected_attendance" type="number" min={0} />
                  )}
                </Field>
              </div>
              <Field
                label="WhatsApp group"
                htmlFor="ne-whatsapp"
                error={state.fieldErrors?.whatsapp_group_url}
                hint="WhatsApp → the group → Group info → Invite via link. Members get a button to join."
              >
                {(control) => (
                  <Input
                    {...control}
                    name="whatsapp_group_url"
                    type="url"
                    inputMode="url"
                    placeholder="https://chat.whatsapp.com/…"
                    maxLength={120}
                  />
                )}
              </Field>
              <Field
                label="If money is left over"
                htmlFor="ne-fund-rule"
                hint="Residents see this on the event. It can’t be changed once the event is created."
              >
                {(control) => (
                  <Select {...control} name="fund_rule" defaultValue={DEFAULT_FUND_RULE}>
                    {FUND_RULE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </MoreOptions>
          </CardBody>
        </Card>
      </div>

      {/* ----------------------------------------------------- 2 · budget */}
      <div {...panel(1)}>
        <Card>
          <CardHeader
            title={STEPS[1].title}
            description={`What you plan to spend. The total, ${formatMoney(total)}, becomes the fund target.`}
          />
          <CardBody className="space-y-2">
            {lines.map((line) => (
              <div key={line.key} className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <CatalogueSelect
                    slug={slug}
                    kind="budget_category"
                    name="budget_category"
                    label="Budget category"
                    items={pickers.budget_category}
                    defaultId={line.categoryId}
                    placeholder="Choose a category"
                    hideLabel
                  />
                </div>
                <label className="sr-only" htmlFor={`bl-amt-${line.key}`}>
                  Amount
                </label>
                <Input
                  id={`bl-amt-${line.key}`}
                  name="budget_amount"
                  type="number"
                  min={0}
                  value={line.amount}
                  onChange={(event) =>
                    setLines((current) =>
                      current.map((l) =>
                        l.key === line.key ? { ...l, amount: event.target.value } : l,
                      ),
                    )
                  }
                  placeholder="₹"
                  className="w-32"
                />
                <button
                  type="button"
                  onClick={() => setLines((current) => current.filter((l) => l.key !== line.key))}
                  className="text-ink-subtle hover:text-ink p-1.5"
                  aria-label="Remove this budget line"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </div>
            ))}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setLines((current) => [...current, { key: nextKey, categoryId: null, amount: '' }]);
                setNextKey((key) => key + 1);
              }}
            >
              <Plus className="size-4" aria-hidden="true" />
              Add a line
            </Button>

            <div className="border-border-base mt-4 border-t pt-4">
              <Field
                label="Suggested per flat"
                htmlFor="suggested_amount"
                error={state.fieldErrors?.suggested_amount}
                hint={
                  flatCount > 0 && total > 0
                    ? `${formatMoney(total)} across ${flatCount} flats is about ${formatMoney(Math.ceil(total / flatCount))} each. Leave empty to take whatever people give.`
                    : 'Pre-filled on the contribute screen. Leave empty to take whatever people give.'
                }
              >
                {(control) => (
                  <Input
                    {...control}
                    name="suggested_amount"
                    type="number"
                    min={1}
                    step="1"
                    placeholder="₹"
                    className="w-40"
                  />
                )}
              </Field>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* ------------------------------------------------- 3 · activities */}
      <div {...panel(2)}>
        <Card>
          <CardHeader
            title={STEPS[2].title}
            description="Things residents can register for. Add more later."
          />
          <CardBody className="space-y-3">
            {activities.map((row) => (
              <div key={row.key} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="new_activity_emoji" value={row.emoji} />
                <div className="min-w-40 flex-1">
                  <Field label="Type" htmlFor={`na-type-${row.key}`}>
                    {(control) => (
                      <Select
                        {...control}
                        name="new_activity_type_id"
                        value={row.typeId}
                        onChange={(event) => {
                          const item = pickers.activity_type.find(
                            (entry) => entry.id === event.target.value,
                          );
                          updateActivity(row.key, {
                            typeId: event.target.value,
                            name: item?.label ?? row.name,
                            emoji: item?.emoji ?? row.emoji,
                          });
                        }}
                      >
                        <option value="">Other</option>
                        {pickers.activity_type.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.label}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                </div>
                <div className="min-w-40 flex-1">
                  <Field label="Name" htmlFor={`na-name-${row.key}`}>
                    {(control) => (
                      <Input
                        {...control}
                        name="new_activity_name"
                        value={row.name}
                        onChange={(event) => updateActivity(row.key, { name: event.target.value })}
                        placeholder="Kids’ rangoli contest"
                        maxLength={140}
                      />
                    )}
                  </Field>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setActivities((current) => current.filter((item) => item.key !== row.key))
                  }
                  className="text-ink-subtle hover:text-ink mb-1.5 p-1.5"
                  aria-label="Remove this activity"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </div>
            ))}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setActivities((current) => [
                  ...current,
                  { key: nextKey, typeId: '', name: '', emoji: '' },
                ]);
                setNextKey((key) => key + 1);
              }}
            >
              <Plus className="size-4" aria-hidden="true" />
              Add an activity
            </Button>
          </CardBody>
        </Card>
      </div>

      {/* ----------------------------------------------------- 4 · review */}
      <div {...panel(3)}>
        <Card>
          <CardHeader title={summary.name || 'Your event'} description={STEPS[3].hint} />
          <dl className="divide-border-base divide-y text-sm">
            <Row label="Date">
              {summary.ends_on ? `${summary.starts_on} → ${summary.ends_on}` : summary.starts_on}
            </Row>
            {summary.event_type ? <Row label="Type">{summary.event_type}</Row> : null}
            {summary.venue ? <Row label="Venue">{summary.venue}</Row> : null}
            <Row label="Organised by">{summary.organizer}</Row>
            <Row label="Budget">
              {lines.filter((line) => Number(line.amount) > 0).length
                ? `${formatMoney(total)} across ${lines.filter((line) => Number(line.amount) > 0).length} lines`
                : 'Nothing budgeted yet'}
            </Row>
            <Row label="Suggested per flat">
              {Number(summary.suggested_amount) > 0
                ? formatMoney(Number(summary.suggested_amount))
                : 'Whatever people give'}
            </Row>
            <Row label="Activities">
              {activities.filter((row) => row.name.trim()).length
                ? activities
                    .filter((row) => row.name.trim())
                    .map((row) => row.name.trim())
                    .join(', ')
                : 'None yet'}
            </Row>
            <Row label="Left-over money">
              {FUND_RULE_LABEL[summary.fund_rule as keyof typeof FUND_RULE_LABEL] ??
                FUND_RULE_LABEL[DEFAULT_FUND_RULE]}
            </Row>
          </dl>
        </Card>
      </div>

      {state.error ? (
        <p role="alert" className="text-danger text-sm">
          {state.error}
        </p>
      ) : null}
      {rejected && step !== 0 ? (
        <p role="alert" className="text-danger flex flex-wrap items-center gap-2 text-sm">
          Something on {STEPS[0].title.toLowerCase()} needs fixing.
          <Button type="button" size="sm" variant="secondary" onClick={() => goTo(0)}>
            Take me there
          </Button>
        </p>
      ) : null}
      {rejected &&
      step === 0 &&
      (state.fieldErrors?.ends_on || state.fieldErrors?.expected_attendance) ? (
        <p role="alert" className="text-danger text-sm">
          Check the fields under {COPY.moreOptions}.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        {step > 0 ? (
          <Button type="button" variant="ghost" onClick={() => goTo(step - 1)}>
            Back
          </Button>
        ) : (
          <span />
        )}
        {step < last ? (
          <Button type="button" onClick={next}>
            Next
          </Button>
        ) : (
          <Buttons />
        )}
      </div>
    </form>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-3">
      <dt className="text-ink-muted shrink-0">{label}</dt>
      <dd className="text-ink min-w-0 text-right">{children}</dd>
    </div>
  );
}
