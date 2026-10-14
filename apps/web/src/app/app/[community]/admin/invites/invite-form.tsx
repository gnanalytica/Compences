'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  ASSIGNABLE_ROLES,
  ROLE_DESCRIPTION,
  ROLE_LABEL,
  formatInviteCode,
  unitLabel,
} from '@compences/core';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { createInviteCode, type InviteState } from './actions';
import { CopyCode } from './copy-code';

type Unit = { id: string; block: string | null; number: string };

const initial: InviteState = {};

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? 'Creating…' : 'Create code'}
    </Button>
  );
}

export function InviteForm({ slug, units }: { slug: string; units: Unit[] }) {
  const [state, action] = useActionState(createInviteCode, initial);

  return (
    <Card className="h-fit">
      <CardHeader
        title="Create an invite code"
        description="The resident enters it once, after signing in."
      />
      <CardBody className="space-y-4">
        {state.createdCode ? <CopyCode code={state.createdCode} /> : null}

        <form action={action} className="space-y-4">
          <input type="hidden" name="slug" value={slug} />

          <Field
            label="Role"
            htmlFor="role"
            error={state.fieldErrors?.role}
            hint={ROLE_DESCRIPTION.resident}
          >
            {(control) => (
              <Select {...control} name="role" defaultValue="resident">
                {ASSIGNABLE_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABEL[role]}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field
            label="Attach to a unit"
            htmlFor="unit_id"
            error={state.fieldErrors?.unit_id}
            hint="Optional. Whoever uses the code joins this flat."
          >
            {(control) => (
              <Select {...control} name="unit_id" defaultValue="">
                <option value="">No specific unit</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unitLabel(unit)}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Uses" htmlFor="max_uses" error={state.fieldErrors?.max_uses}>
              {(control) => (
                <Select {...control} name="max_uses" defaultValue="1">
                  <option value="1">Once</option>
                  <option value="2">2 people</option>
                  <option value="5">5 people</option>
                  <option value="25">25 people</option>
                  <option value="100">100 people</option>
                  <option value="unlimited">Unlimited</option>
                </Select>
              )}
            </Field>

            <Field
              label="Expires"
              htmlFor="expires_at"
              error={state.fieldErrors?.expires_at}
              hint="Optional."
            >
              {(control) => <Input {...control} name="expires_at" type="datetime-local" />}
            </Field>
          </div>

          <Field
            label="Label"
            htmlFor="label"
            error={state.fieldErrors?.label}
            hint="For your reference, e.g. “Tower B move-ins”."
          >
            {(control) => <Input {...control} name="label" placeholder="Flat A-101" />}
          </Field>

          {state.error ? (
            <p role="alert" className="text-danger text-sm">
              {state.error}
            </p>
          ) : null}

          <Submit />
        </form>
      </CardBody>
    </Card>
  );
}

export { formatInviteCode };
