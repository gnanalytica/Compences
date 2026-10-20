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
import { SuggestionList } from '@/components/suggestion-list';
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

type Service = { key: number; type: string; amount: string };
type VendorDraft = { key: number; name: string; services: Service[] };
type ActivityRow = { key: number; typeId: string; name: string; emoji: string };

export function CreateEventForm({
  slug,
  pickers,
  societyName,
  today,
}: {
  slug: string;
  pickers: Pickers;
  societyName: string;
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
  // No predefined vendors: one blank vendor with one blank service to type
  // into, ignored if left empty. Every vendor and service keeps a stable key so
  // removing one does not shuffle the others.
  const [vendors, setVendors] = useState<VendorDraft[]>([
    { key: 0, name: '', services: [{ key: 1, type: '', amount: '' }] },
  ]);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [nextKey, setNextKey] = useState(2);
  const services = vendors.flatMap((vendor) => vendor.services);
  const total = services.reduce((sum, service) => sum + Number(service.amount || 0), 0);
  const budgeted = services.filter((service) => Number(service.amount) > 0).length;
  /** Reserves `count` fresh keys and returns the first. */
  const takeKeys = (count: number) => {
    setNextKey((key) => key + count);
    return nextKey;
  };
  const patchVendor = (key: number, change: (vendor: VendorDraft) => VendorDraft) =>
    setVendors((current) =>
      current.map((vendor) => (vendor.key === key ? change(vendor) : vendor)),
    );

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
            description={`Each vendor, the services they provide and what you set aside for each. The total, ${formatMoney(total)}, becomes the fund target.`}
          />
          <CardBody className="space-y-4">
            <SuggestionList id="budget-types" items={pickers.budget_category} />
            <SuggestionList id="budget-vendors" items={pickers.vendor} />
            {vendors.map((vendor, vendorIndex) => (
              <fieldset
                key={vendor.key}
                className="border-border-base space-y-3 rounded-xl border p-4"
              >
                <legend className="sr-only">Vendor {vendorIndex + 1}</legend>
                <div className="flex items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <label
                      className="text-ink-muted mb-1 block text-xs"
                      htmlFor={`bv-name-${vendor.key}`}
                    >
                      Vendor
                    </label>
                    <Input
                      id={`bv-name-${vendor.key}`}
                      list="budget-vendors"
                      value={vendor.name}
                      onChange={(event) =>
                        patchVendor(vendor.key, (v) => ({ ...v, name: event.target.value }))
                      }
                      placeholder="Sri Lakshmi Tents, or leave blank for now"
                      maxLength={80}
                      autoComplete="off"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setVendors((current) => current.filter((v) => v.key !== vendor.key))
                    }
                    className="text-ink-subtle hover:text-ink mb-1 p-1.5"
                    aria-label={`Remove ${vendor.name.trim() || `vendor ${vendorIndex + 1}`}`}
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                </div>
                <div className="border-border-base space-y-2 border-l-2 pl-3">
                  {vendor.services.map((service, serviceIndex) => {
                    const patch = (change: Partial<Service>) =>
                      patchVendor(vendor.key, (v) => ({
                        ...v,
                        services: v.services.map((sv) =>
                          sv.key === service.key ? { ...sv, ...change } : sv,
                        ),
                      }));
                    return (
                      <div key={service.key} className="flex items-end gap-2">
                        {/* Every service posts its vendor beside it, so the rows
                            line up on the server as Type, Vendor, Amount. */}
                        <input type="hidden" name="budget_vendor" value={vendor.name} />
                        <div className="min-w-0 flex-1">
                          <label
                            className="text-ink-muted mb-1 block text-xs"
                            htmlFor={`bl-type-${service.key}`}
                          >
                            Service
                          </label>
                          <Input
                            id={`bl-type-${service.key}`}
                            name="budget_type"
                            list="budget-types"
                            value={service.type}
                            onChange={(event) => patch({ type: event.target.value })}
                            placeholder={serviceIndex === 0 ? 'Pandal and stage' : 'Lighting'}
                            maxLength={80}
                            autoComplete="off"
                          />
                        </div>
                        <div className="w-32">
                          <label
                            className="text-ink-muted mb-1 block text-xs"
                            htmlFor={`bl-amt-${service.key}`}
                          >
                            Budget (₹)
                          </label>
                          <Input
                            id={`bl-amt-${service.key}`}
                            name="budget_amount"
                            type="number"
                            min={0}
                            value={service.amount}
                            onChange={(event) => patch({ amount: event.target.value })}
                            placeholder="₹"
                            required={Boolean(service.type.trim())}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            patchVendor(vendor.key, (v) => ({
                              ...v,
                              services: v.services.filter((sv) => sv.key !== service.key),
                            }))
                          }
                          className="text-ink-subtle hover:text-ink mb-1 p-1.5"
                          aria-label={`Remove service ${serviceIndex + 1}`}
                        >
                          <X className="size-4" aria-hidden="true" />
                        </button>
                      </div>
                    );
                  })}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const key = takeKeys(1);
                      patchVendor(vendor.key, (v) => ({
                        ...v,
                        services: [...v.services, { key, type: '', amount: '' }],
                      }));
                    }}
                  >
                    <Plus className="size-4" aria-hidden="true" />
                    Add a service
                  </Button>
                </div>
              </fieldset>
            ))}
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                const key = takeKeys(2);
                setVendors((current) => [
                  ...current,
                  { key, name: '', services: [{ key: key + 1, type: '', amount: '' }] },
                ]);
              }}
            >
              <Plus className="size-4" aria-hidden="true" />
              Add a vendor
            </Button>
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
              {budgeted
                ? `${formatMoney(total)} across ${budgeted} ${budgeted === 1 ? 'service' : 'services'}`
                : 'Nothing budgeted yet'}
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
