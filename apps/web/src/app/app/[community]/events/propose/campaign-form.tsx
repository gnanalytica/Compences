'use client';

import { todayIn } from '@compences/core';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { EMPTY_STATE } from '@/lib/action-state';
import { proposeCampaign, type CampaignState } from '../actions';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Sending…' : 'Send to the committee'}
    </Button>
  );
}

export function CampaignForm({ slug }: { slug: string }) {
  const [state, action] = useActionState<CampaignState, FormData>(proposeCampaign, EMPTY_STATE);
  const today = todayIn();
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="slug" value={slug} />
      <Field
        label="What are you raising money for?"
        htmlFor="cp-name"
        error={state.fieldErrors?.name}
        required
      >
        {(control) => (
          <Input {...control} name="name" placeholder="New benches for the park" required />
        )}
      </Field>
      <Field
        label="Why it matters"
        htmlFor="cp-desc"
        error={state.fieldErrors?.description}
        hint="The committee and every resident will read this."
        required
      >
        {(control) => (
          <Textarea
            {...control}
            name="description"
            placeholder="Who it helps, what it will cost, and how the money will be spent."
            required
          />
        )}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Target (₹)"
          htmlFor="cp-target"
          error={state.fieldErrors?.fund_target}
          required
        >
          {(control) => (
            <Input {...control} name="fund_target" type="number" min={1} step="1" required />
          )}
        </Field>
        <Field
          label="Start collecting from"
          htmlFor="cp-date"
          error={state.fieldErrors?.starts_on}
          required
        >
          {(control) => (
            <Input {...control} name="starts_on" type="date" defaultValue={today} required />
          )}
        </Field>
      </div>
      {state.error ? (
        <p role="alert" className="text-danger text-sm">
          {state.error}
        </p>
      ) : null}
      <Submit />
    </form>
  );
}
