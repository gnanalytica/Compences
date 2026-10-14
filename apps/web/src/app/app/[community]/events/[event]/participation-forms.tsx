'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { UserPlus } from 'lucide-react';
import { AGE_GROUPS } from '@compences/core';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { EMPTY_STATE, type ActionState } from '@/lib/action-state';
import { useResetOnSuccess } from '@/lib/use-reset-on-success';
import { registerForActivity, suggestForEvent } from '../actions';

function Submit({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? busy : label}
    </Button>
  );
}

function Feedback({ state }: { state: ActionState }) {
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
 * Registers the resident or someone from their flat. "Me" is one tap; adding a
 * child or relative takes their name.
 */
export function RegisterForm({
  slug,
  eventSlug,
  activityId,
  activityName,
  selfRegistered,
}: {
  slug: string;
  eventSlug: string;
  activityId: string;
  activityName: string;
  selfRegistered: boolean;
}) {
  const [state, action] = useActionState<ActionState, FormData>(registerForActivity, EMPTY_STATE);
  const [forFamily, setForFamily] = useState(selfRegistered);
  const ref = useResetOnSuccess(state);

  return (
    <form ref={ref} action={action} className="space-y-3">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="event" value={eventSlug} />
      <input type="hidden" name="activity_id" value={activityId} />

      {forFamily ? (
        <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
          <Field
            label="Name of family member"
            htmlFor={`fam-${activityId}`}
            error={state.fieldErrors?.participant_name}
          >
            {(control) => (
              <Input {...control} name="participant_name" placeholder="Aarav" required />
            )}
          </Field>
          <Field label="Age group" htmlFor={`age-${activityId}`}>
            {(control) => (
              <Select {...control} name="age_group" defaultValue="">
                <option value="">—</option>
                {AGE_GROUPS.map((group) => (
                  <option key={group}>{group}</option>
                ))}
              </Select>
            )}
          </Field>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Submit
          label={forFamily ? 'Register them' : `Register for ${activityName}`}
          busy="Registering…"
        />
        {!selfRegistered || !forFamily ? (
          <button
            type="button"
            onClick={() => setForFamily((value) => !value)}
            className="text-ink-muted hover:text-ink inline-flex items-center gap-1 text-sm"
          >
            <UserPlus className="size-3.5" aria-hidden="true" />
            {forFamily ? 'Register myself instead' : 'Add a family member'}
          </button>
        ) : null}
      </div>
      <Feedback state={state} />
    </form>
  );
}

export function SuggestionForm({
  slug,
  eventSlug,
  eventId,
}: {
  slug: string;
  eventSlug: string;
  eventId: string;
}) {
  const [state, action] = useActionState<ActionState, FormData>(suggestForEvent, EMPTY_STATE);
  const ref = useResetOnSuccess(state);
  return (
    <form ref={ref} action={action} className="space-y-3">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="event" value={eventSlug} />
      <input type="hidden" name="event_id" value={eventId} />
      <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
        <Field label="Type" htmlFor="sg-kind">
          {(control) => (
            <Select {...control} name="kind" defaultValue="activity">
              <option value="activity">An activity</option>
              <option value="idea">An idea</option>
            </Select>
          )}
        </Field>
        <Field label="Suggestion" htmlFor="sg-name" error={state.fieldErrors?.name} required>
          {(control) => (
            <Input {...control} name="name" placeholder="Lantern walk around the towers" required />
          )}
        </Field>
      </div>
      <Field label="Details" htmlFor="sg-desc">
        {(control) => <Textarea {...control} name="description" rows={2} />}
      </Field>
      <Feedback state={state} />
      <Submit label="Send to the committee" busy="Sending…" />
    </form>
  );
}
