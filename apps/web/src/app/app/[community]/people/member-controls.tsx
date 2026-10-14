'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { ROLE_LABEL, ASSIGNABLE_ROLES, type Role } from '@compences/core';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/field';
import { EMPTY_STATE, type ActionState } from '@/lib/action-state';
import { changeMemberRole, removeMember, setMemberFlat } from './actions';

function Submit({
  label,
  variant,
  disabled,
}: {
  label: string;
  variant?: 'secondary' | 'ghost';
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant={variant} disabled={pending || disabled}>
      {pending ? '…' : label}
    </Button>
  );
}

function Message({ state }: { state: ActionState }) {
  if (state.error) {
    return (
      <p role="alert" className="text-danger mt-1 text-xs">
        {state.error}
      </p>
    );
  }
  if (state.success) {
    return (
      <p role="status" className="text-success mt-1 text-xs">
        {state.success}
      </p>
    );
  }
  return null;
}

export function RoleForm({
  slug,
  membershipId,
  role,
  name,
}: {
  slug: string;
  membershipId: string;
  role: Role;
  name: string;
}) {
  const [state, action] = useActionState<ActionState, FormData>(changeMemberRole, EMPTY_STATE);
  // Save stays inert until the dropdown actually moves. Sitting live next to
  // every name in a scrollable table, it was one stray click from a role change
  // nobody meant to make — and a no-op save that still said "saved" taught you
  // the button was harmless.
  const [choice, setChoice] = useState<Role>(role);

  return (
    <form action={action}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="membership_id" value={membershipId} />
      <div className="flex items-center gap-2">
        <label htmlFor={`role-${membershipId}`} className="sr-only">
          Role for {name}
        </label>
        <Select
          id={`role-${membershipId}`}
          name="role"
          value={choice}
          onChange={(event) => setChoice(event.target.value as Role)}
          className="h-8 w-32 py-1 text-xs"
        >
          {ASSIGNABLE_ROLES.map((option) => (
            <option key={option} value={option}>
              {ROLE_LABEL[option]}
            </option>
          ))}
        </Select>
        <Submit label="Save" variant="secondary" disabled={choice === role} />
      </div>
      <Message state={state} />
    </form>
  );
}

export function RemoveForm({
  slug,
  membershipId,
  name,
}: {
  slug: string;
  membershipId: string;
  name: string;
}) {
  const [state, action] = useActionState<ActionState, FormData>(removeMember, EMPTY_STATE);
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(`Remove ${name} from the society?`)) event.preventDefault();
      }}
    >
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="membership_id" value={membershipId} />
      <Submit label="Remove" variant="ghost" />
      <Message state={state} />
    </form>
  );
}

export type FlatOption = { id: string; block: string | null; number: string };

/**
 * Which flat a member lives in.
 *
 * There was no way to answer this after somebody joined: the join form and a
 * unit-bound invite code both ask once, the Flats page counts occupants
 * without being able to add one, and Settings edits a name and a phone. So a
 * founder — who was never asked at all — stayed flatless for good, and their
 * payments reached the ledger with no flat beside them.
 *
 * Offered on your own row too, unlike the role control. The founder is usually
 * the person who needs it, and the database gates it on being committee rather
 * than on whose row it is.
 */
export function FlatForm({
  slug,
  membershipId,
  unitId,
  units,
  name,
}: {
  slug: string;
  membershipId: string;
  unitId: string | null;
  units: FlatOption[];
  name: string;
}) {
  const [state, action] = useActionState<ActionState, FormData>(setMemberFlat, EMPTY_STATE);
  // Same reason as the role control: a live Save beside every name in a long
  // table is one stray click from a change nobody meant to make.
  const [choice, setChoice] = useState(unitId ?? '');

  const towers = [...new Set(units.map((unit) => unit.block ?? ''))];

  return (
    <form action={action}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="membership_id" value={membershipId} />
      <div className="flex items-center gap-2">
        <label htmlFor={`flat-${membershipId}`} className="sr-only">
          Flat for {name}
        </label>
        <Select
          id={`flat-${membershipId}`}
          name="unit_id"
          value={choice}
          onChange={(event) => setChoice(event.target.value)}
          className="h-8 w-32 py-1 text-xs"
        >
          <option value="">No flat</option>
          {towers.map((tower) =>
            tower ? (
              <optgroup key={tower} label={`Tower ${tower}`}>
                {units
                  .filter((unit) => (unit.block ?? '') === tower)
                  .map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.block} {unit.number}
                    </option>
                  ))}
              </optgroup>
            ) : (
              units
                .filter((unit) => !unit.block)
                .map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.number}
                  </option>
                ))
            ),
          )}
        </Select>
        <Submit label="Save" variant="secondary" disabled={choice === (unitId ?? '')} />
      </div>
      <Message state={state} />
    </form>
  );
}
