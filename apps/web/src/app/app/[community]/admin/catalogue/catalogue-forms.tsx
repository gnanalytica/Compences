'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import type { CatalogueKind } from '@compences/core';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { EMPTY_STATE, type ActionState } from '@/lib/action-state';
import { addCatalogueItem, updateCatalogueItem } from './actions';

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
      <p role="alert" className="text-danger basis-full text-xs">
        {state.error}
      </p>
    );
  }
  if (state.success) {
    return (
      <p role="status" className="text-success basis-full text-xs">
        {state.success}
      </p>
    );
  }
  return null;
}

type ItemDraft = {
  id: string;
  label: string;
  emoji: string | null;
  details: Record<string, unknown>;
};

const str = (value: unknown) =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : '';

/** A label for every kind; phone and UPI ID for vendors; capacity for venues. */
function ItemFields({
  kind,
  item,
  state,
  prefix,
}: {
  kind: CatalogueKind;
  item?: ItemDraft;
  state: ActionState;
  prefix: string;
}) {
  return (
    <>
      {/* An item's emoji only reaches the WhatsApp bot's messages now, so it
          is kept as it was rather than asked for. */}
      <input type="hidden" name="emoji" value={item?.emoji ?? ''} />
      <div className="min-w-44 flex-1">
        <Field label="Name" htmlFor={`${prefix}-label`} error={state.fieldErrors?.label} required>
          {(control) => (
            <Input
              {...control}
              name="label"
              defaultValue={item?.label ?? ''}
              maxLength={80}
              required
            />
          )}
        </Field>
      </div>
      {kind === 'vendor' ? (
        <>
          <div className="w-40">
            <Field label="Phone" htmlFor={`${prefix}-phone`} error={state.fieldErrors?.phone}>
              {(control) => (
                <Input
                  {...control}
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  defaultValue={str(item?.details.phone)}
                  maxLength={20}
                />
              )}
            </Field>
          </div>
          <div className="w-48">
            <Field label="UPI ID" htmlFor={`${prefix}-upi`} error={state.fieldErrors?.upi_vpa}>
              {(control) => (
                <Input
                  {...control}
                  name="upi_vpa"
                  defaultValue={str(item?.details.upi_vpa)}
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={120}
                />
              )}
            </Field>
          </div>
        </>
      ) : null}
      {kind === 'venue' ? (
        <div className="w-28">
          <Field
            label="Capacity"
            htmlFor={`${prefix}-capacity`}
            error={state.fieldErrors?.capacity}
          >
            {(control) => (
              <Input
                {...control}
                name="capacity"
                type="number"
                min={1}
                defaultValue={str(item?.details.capacity)}
              />
            )}
          </Field>
        </div>
      ) : null}
    </>
  );
}

export function AddCatalogueItemForm({ slug, kind }: { slug: string; kind: CatalogueKind }) {
  const [state, action] = useActionState<ActionState, FormData>(addCatalogueItem, EMPTY_STATE);
  const ref = useRef<HTMLFormElement>(null);
  // Clear the fields only once the item is saved, so a typo in a duplicate name
  // can be fixed without retyping.
  useEffect(() => {
    if (state.success) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="kind" value={kind} />
      <ItemFields kind={kind} state={state} prefix={`add-${kind}`} />
      <Submit label="Add" busy="Adding…" />
      <Feedback state={state} />
    </form>
  );
}

export function EditCatalogueItemForm({
  slug,
  kind,
  item,
}: {
  slug: string;
  kind: CatalogueKind;
  item: ItemDraft;
}) {
  const [state, action] = useActionState<ActionState, FormData>(updateCatalogueItem, EMPTY_STATE);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="item_id" value={item.id} />
      <ItemFields kind={kind} item={item} state={state} prefix={`edit-${item.id}`} />
      <Submit label="Save" busy="Saving…" />
      <Feedback state={state} />
    </form>
  );
}
