'use client';

import { useId, useState, useTransition } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import type { CatalogueKind } from '@compences/core';
import { Field, Input, Select } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { quickAddCatalogueItem } from '@/app/app/[community]/admin/catalogue/actions';

export type PickerItem = { id: string; label: string; emoji: string | null };

/**
 * A select over one kind of catalogue item, posting `<name>_id`. The server
 * resolves the label from the society's catalogue, so the form never decides
 * the words that end up in a ledger.
 *
 * A row filed before its label was in the catalogue (or whose item was later
 * archived) keeps that label: it shows as an extra option and posts it as
 * `<name>_legacy` until someone picks a catalogue item instead.
 */
export function CatalogueSelect({
  slug,
  kind,
  name,
  label,
  items,
  defaultId,
  defaultLabel,
  required,
  placeholder = 'Choose…',
  hint,
  error,
  allowQuickAdd = false,
  manageHref,
  onPick,
  disabled,
  hideLabel = false,
}: {
  slug: string;
  kind: CatalogueKind;
  name: string;
  label: string;
  items: PickerItem[];
  defaultId?: string | null;
  defaultLabel?: string | null;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  error?: string;
  /** Lets staff add a missing item without leaving the form. */
  allowQuickAdd?: boolean;
  /** Link to the catalogue page, shown to people who can edit it. */
  manageHref?: string;
  onPick?: (item: PickerItem | null) => void;
  disabled?: boolean;
  hideLabel?: boolean;
}) {
  const id = useId();
  const [options, setOptions] = useState(items);
  const knownDefault = defaultId ? options.some((item) => item.id === defaultId) : false;
  const legacy =
    !knownDefault && defaultLabel
      ? (options.find((item) => item.label.toLowerCase() === defaultLabel.trim().toLowerCase()) ??
        null)
      : null;
  // An old free-text label that matches a catalogue item is simply that item.
  const initial = knownDefault ? defaultId! : legacy ? legacy.id : defaultLabel ? '__legacy' : '';
  const [value, setValue] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const pick = (next: string) => {
    setValue(next);
    onPick?.(options.find((item) => item.id === next) ?? null);
  };

  const add = () => {
    setAddError(null);
    startTransition(async () => {
      const result = await quickAddCatalogueItem(slug, kind, draft);
      if ('error' in result) {
        setAddError(result.error);
        return;
      }
      setOptions((current) => [...current, result.item]);
      setValue(result.item.id);
      onPick?.(result.item);
      setDraft('');
      setAdding(false);
    });
  };

  const control = (
    <>
      <input type="hidden" name={`${name}_id`} value={value === '__legacy' ? '' : value} />
      {value === '__legacy' && defaultLabel ? (
        <input type="hidden" name={`${name}_legacy`} value={defaultLabel} />
      ) : null}
      <Select
        id={id}
        value={value}
        onChange={(event) => pick(event.target.value)}
        required={required}
        disabled={disabled}
        aria-label={hideLabel ? label : undefined}
      >
        <option value="" disabled={required}>
          {placeholder}
        </option>
        {defaultLabel && !knownDefault && !legacy ? (
          <option value="__legacy">{defaultLabel} (kept from before)</option>
        ) : null}
        {options.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </Select>
    </>
  );

  return (
    <div className="space-y-1.5">
      {hideLabel ? (
        control
      ) : (
        <Field label={label} htmlFor={id} hint={hint} error={error} required={required}>
          {control}
        </Field>
      )}
      {/* "(not in the catalogue)" read like a complaint about the committee's own
          data. It is just a value typed before the catalogue had this entry, and
          it keeps working — so say that, next to the button that files it. */}
      {value === '__legacy' && defaultLabel ? (
        <p className="text-ink-subtle text-xs">
          Typed in before this was in the catalogue. It still works
          {allowQuickAdd ? ', or add it below to reuse it next time' : ''}.
        </p>
      ) : null}
      {allowQuickAdd || manageHref ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {allowQuickAdd && !adding ? (
            <button
              type="button"
              className="text-accent inline-flex items-center gap-1 hover:underline"
              onClick={() => setAdding(true)}
              disabled={disabled}
            >
              <Plus className="size-3.5" aria-hidden="true" />
              Add new
            </button>
          ) : null}
          {manageHref ? (
            <Link
              href={manageHref}
              className="text-ink-subtle hover:text-ink underline-offset-4 hover:underline"
            >
              Manage catalogue
            </Link>
          ) : null}
        </div>
      ) : null}
      {adding ? (
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor={`${id}-new`}>
            New {label.toLowerCase()}
          </label>
          <Input
            id={`${id}-new`}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              // Enter here would submit the surrounding form instead.
              if (event.key === 'Enter') {
                event.preventDefault();
                add();
              }
            }}
            placeholder={`New ${label.toLowerCase()}`}
            className="min-w-40 flex-1"
            maxLength={80}
          />
          <Button type="button" size="sm" onClick={add} disabled={pending || !draft.trim()}>
            {pending ? 'Adding…' : 'Add'}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>
            Cancel
          </Button>
          {addError ? (
            <p role="alert" className="text-danger basis-full text-xs">
              {addError}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
