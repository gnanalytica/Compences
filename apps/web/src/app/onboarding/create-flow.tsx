'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Sparkles } from 'lucide-react';
import { isFlatLabel, societySlug, splitFlat } from '@compences/core';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/field';
import { createSociety } from './actions';
import type { ActionState } from '@/lib/action-state';

const initial: ActionState = {};

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? 'Creating…' : 'Create the society'}
    </Button>
  );
}

/**
 * Founding a society: the name, the city, the founder's phone, and nothing
 * else that can wait.
 *
 * Flats, the catalogue and the UPI ID are the setup checklist's job — asking
 * for them here would turn "start your society" into a form nobody finishes on
 * a phone. The address is offered because it is the one checklist step whose
 * answer the founder already has in their head.
 *
 * The phone is not optional. The founder is the committee, and until this was
 * asked for they were the one member of a society nobody could reach — the
 * join form has always asked every resident for theirs.
 */
export function CreateFlow({ initialCity = '' }: { initialCity?: string }) {
  const [state, action] = useActionState(createSociety, initial);
  const [name, setName] = useState('');
  const [flat, setFlat] = useState('');

  // What the web address will look like. create_society() derives the real one
  // the same way, and adds a suffix if another society got there first.
  const preview = name.trim() ? societySlug(name) : '';

  // How the flat was read, shown back. "G01" and "B G01" are the same letters
  // and different flats, and the only way the founder can tell which one they
  // got is to be shown it while they can still add a space.
  const read = flat.trim() && isFlatLabel(flat) ? splitFlat(flat) : null;

  return (
    <Card>
      <CardBody>
        <form action={action} className="space-y-4">
          <Field
            label="Society name"
            htmlFor="cs-name"
            error={state.fieldErrors?.name}
            hint={
              preview ? (
                <>
                  Residents will find it at <span className="font-mono">/app/{preview}</span>
                </>
              ) : (
                'As written on the gate.'
              )
            }
            required
          >
            {(control) => (
              <Input
                {...control}
                name="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Shraddha Whitecliff"
                autoComplete="organization"
                autoFocus
                maxLength={120}
                required
              />
            )}
          </Field>

          <Field label="City" htmlFor="cs-city" error={state.fieldErrors?.city} required>
            {(control) => (
              <Input
                {...control}
                name="city"
                defaultValue={initialCity}
                placeholder="Bengaluru"
                autoComplete="address-level2"
                maxLength={80}
                required
              />
            )}
          </Field>

          <Field
            label="Your phone number"
            htmlFor="cs-phone"
            error={state.fieldErrors?.phone}
            hint="Only staff and the committee see it."
            required
          >
            {(control) => (
              <Input
                {...control}
                name="phone"
                type="tel"
                inputMode="tel"
                placeholder="98450 10101"
                autoComplete="tel"
                maxLength={20}
                required
              />
            )}
          </Field>

          {/* Every resident is asked which flat they live in. The founder
              never was, and ended up the one member of a society who lived
              nowhere — which is why their own payments showed up in the ledger
              with no flat beside them. */}
          <Field
            label="Your flat"
            htmlFor="cs-flat"
            error={state.fieldErrors?.flat}
            hint={
              read ? (
                read.block ? (
                  <>
                    Tower {read.block}, flat {read.number}
                  </>
                ) : (
                  <>Flat {read.number}, no tower</>
                )
              ) : (
                'As written on your door. Leave blank if you don’t live in the society.'
              )
            }
          >
            {(control) => (
              <Input
                {...control}
                name="flat"
                value={flat}
                onChange={(event) => setFlat(event.target.value)}
                placeholder="A 703"
                maxLength={24}
              />
            )}
          </Field>

          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <Field
              label="Address"
              htmlFor="cs-address"
              error={state.fieldErrors?.address}
              hint="Optional."
            >
              {(control) => (
                <Input
                  {...control}
                  name="address"
                  placeholder="Seegehalli, Whitefield"
                  autoComplete="street-address"
                  maxLength={300}
                />
              )}
            </Field>
            <Field label="PIN code" htmlFor="cs-pincode" error={state.fieldErrors?.pincode}>
              {(control) => (
                <Input
                  {...control}
                  name="pincode"
                  inputMode="numeric"
                  placeholder="560067"
                  autoComplete="postal-code"
                  maxLength={6}
                  className="sm:w-28"
                />
              )}
            </Field>
          </div>

          {state.error ? (
            <p role="alert" className="text-danger text-sm">
              {state.error}
            </p>
          ) : null}

          <Submit />
          <p className="text-ink-subtle flex items-start gap-2 text-xs">
            <Sparkles className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            You become the first committee member and get a society code for residents.
          </p>
        </form>
      </CardBody>
    </Card>
  );
}
