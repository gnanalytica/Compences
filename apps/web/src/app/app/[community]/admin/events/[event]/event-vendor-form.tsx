'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { FocusFirstError } from '@/components/focus-first-error';
import { EMPTY_STATE, type ActionState } from '@/lib/action-state';
import { useResetOnSuccess } from '@/lib/use-reset-on-success';
import { addEventVendor } from '../../../market/actions';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? 'Adding…' : 'Add vendor'}
    </Button>
  );
}

/**
 * Names a marketplace listing as a vendor for this event. The choice is of
 * what is on the board today; the seller is told by the database.
 */
export function AddEventVendorForm({
  slug,
  eventSlug,
  options,
}: {
  slug: string;
  eventSlug: string;
  options: { id: string; label: string }[];
}) {
  const [state, action] = useActionState<ActionState, FormData>(addEventVendor, EMPTY_STATE);
  const ref = useResetOnSuccess(state);

  return (
    <form ref={ref} action={action} className="space-y-3">
      <FocusFirstError signal={state} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="event" value={eventSlug} />
      <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
        <Field
          label="Listing"
          htmlFor="vendor-listing"
          error={state.fieldErrors?.listing_id}
          required
        >
          {(control) => (
            <Select {...control} name="listing_id" defaultValue="">
              <option value="" disabled>
                Choose from the marketplace
              </option>
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="For" htmlFor="vendor-note" error={state.fieldErrors?.note} hint="Optional.">
          {(control) => (
            <Input {...control} name="note" maxLength={120} placeholder="Snacks stall" />
          )}
        </Field>
      </div>
      {state.error ? (
        <p role="alert" className="text-danger text-sm">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="text-success text-sm">
          {state.success}
        </p>
      ) : null}
      <Submit />
    </form>
  );
}
