'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { EMPTY_STATE, type ActionState } from '@/lib/action-state';
import { updateSocietyDetails } from '../actions';

function Save() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? 'Saving…' : 'Save details'}
    </Button>
  );
}

export function SocietyDetailsForm({
  slug,
  name,
  address,
  pincode,
  city,
  whatsappGroupUrl,
}: {
  slug: string;
  name: string;
  address: string | null;
  pincode: string | null;
  city: string | null;
  whatsappGroupUrl: string | null;
}) {
  const [state, action] = useActionState<ActionState, FormData>(updateSocietyDetails, EMPTY_STATE);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="slug" value={slug} />
      <Field label="Society name" htmlFor="soc-name" hint="To change it, ask the Compences team.">
        {(control) => <Input {...control} value={name} readOnly disabled />}
      </Field>
      <Field label="Address" htmlFor="soc-address" error={state.fieldErrors?.address} required>
        {(control) => (
          <Textarea
            {...control}
            name="address"
            defaultValue={address ?? ''}
            placeholder="Seegehalli Main Road, near Kadugodi, Whitefield"
            rows={3}
            maxLength={300}
            required
          />
        )}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="City" htmlFor="soc-city" error={state.fieldErrors?.city} required>
          {(control) => <Input {...control} name="city" defaultValue={city ?? ''} required />}
        </Field>
        <Field label="PIN code" htmlFor="soc-pin" error={state.fieldErrors?.pincode}>
          {(control) => (
            <Input
              {...control}
              name="pincode"
              inputMode="numeric"
              defaultValue={pincode ?? ''}
              maxLength={6}
              placeholder="560067"
            />
          )}
        </Field>
      </div>
      <Field
        label="WhatsApp group"
        htmlFor="soc-whatsapp"
        error={state.fieldErrors?.whatsapp_group_url}
        hint="WhatsApp → the group → Group info → Invite via link. Members get a button to join."
      >
        {(control) => (
          <Input
            {...control}
            name="whatsapp_group_url"
            type="url"
            inputMode="url"
            defaultValue={whatsappGroupUrl ?? ''}
            placeholder="https://chat.whatsapp.com/…"
            maxLength={120}
          />
        )}
      </Field>
      {state.error ? (
        <p role="alert" className="text-danger text-sm">
          {state.error}
        </p>
      ) : state.success ? (
        <p role="status" className="text-success text-sm">
          {state.success}
        </p>
      ) : null}
      <Save />
    </form>
  );
}
