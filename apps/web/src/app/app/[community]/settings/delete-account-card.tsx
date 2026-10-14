'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  DELETE_ACCOUNT_CONFIRMATION,
  DELETE_ACCOUNT_EFFECTS,
  DELETE_ACCOUNT_KEPT,
  isDeleteConfirmed,
} from '@compences/core';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/field';
import { EMPTY_STATE, type ActionState } from '@/lib/action-state';
import { deleteAccount } from './actions';

function Submit({ armed }: { armed: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="danger" size="sm" disabled={pending || !armed}>
      {pending ? 'Deleting…' : 'Delete my account'}
    </Button>
  );
}

/**
 * The way out, which both stores require an app with accounts to have.
 *
 * Deliberately a form rather than a button: this is the only irreversible
 * thing a resident can do to themselves, and the typed word is what separates
 * meaning it from a mis-tap on a phone. The list above it is not decoration
 * either — telling somebody what survives *before* they do it is the whole
 * difference between a deletion and a nasty surprise about the ledger.
 */
export function DeleteAccountCard() {
  const [state, action] = useActionState<ActionState, FormData>(deleteAccount, EMPTY_STATE);
  const [typed, setTyped] = useState('');

  return (
    <Card>
      <CardHeader title="Delete your account" description="This can’t be undone." />
      <CardBody>
        <p className="text-ink-muted text-sm">This deletes:</p>
        <ul className="text-ink-muted mt-2 list-disc space-y-1 pl-5 text-sm">
          {DELETE_ACCOUNT_EFFECTS.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className="text-ink-muted mt-4 text-sm">What stays:</p>
        <ul className="text-ink-muted mt-2 list-disc space-y-1 pl-5 text-sm">
          {DELETE_ACCOUNT_KEPT.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>

        <form action={action} className="mt-5 space-y-4">
          <Field
            label={`Type ${DELETE_ACCOUNT_CONFIRMATION} to confirm`}
            htmlFor="confirm"
            error={state.fieldErrors?.confirm}
          >
            {(control) => (
              <Input
                {...control}
                name="confirm"
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                className="max-w-xs"
              />
            )}
          </Field>
          {state.error ? (
            <p role="alert" className="text-danger text-sm">
              {state.error}
            </p>
          ) : null}
          <Submit armed={isDeleteConfirmed(typed)} />
        </form>
      </CardBody>
    </Card>
  );
}
