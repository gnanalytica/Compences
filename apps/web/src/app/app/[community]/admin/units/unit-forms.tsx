'use client';

import { useActionState, useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { flatGeneratorSchema, generateFlats, parseFlatsCsv } from '@compences/core';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { EMPTY_STATE, type ActionState } from '@/lib/action-state';
import { generateUnits, importUnits, updateUnit } from './actions';

function Submit({ label, busy, disabled }: { label: string; busy: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending || disabled}>
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

/** Towers × floors × flats per floor, with a live count before anything is saved. */
export function GenerateFlatsForm({ slug }: { slug: string }) {
  const [state, action] = useActionState<ActionState, FormData>(generateUnits, EMPTY_STATE);
  const [towers, setTowers] = useState('A, B');
  const [floors, setFloors] = useState('10');
  const [perFloor, setPerFloor] = useState('8');
  const [ground, setGround] = useState(false);

  const preview = useMemo(() => {
    const parsed = flatGeneratorSchema.safeParse({
      towers,
      floors,
      flats_per_floor: perFloor,
      include_ground_floor: ground,
    });
    if (!parsed.success) return null;
    const rows = generateFlats(parsed.data);
    return { count: rows.length, first: rows[0], last: rows.at(-1) };
  }, [towers, floors, perFloor, ground]);

  const label = (row: { block: string | null; number: string } | undefined) =>
    row ? (row.block ? `${row.block}-${row.number}` : row.number) : '';

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="slug" value={slug} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          label="Towers"
          htmlFor="gen-towers"
          hint="Comma-separated, e.g. A, B, C"
          error={state.fieldErrors?.towers}
          required
        >
          {(control) => (
            <Input
              {...control}
              name="towers"
              value={towers}
              onChange={(event) => setTowers(event.target.value)}
              required
            />
          )}
        </Field>
        <Field
          label="Floors per tower"
          htmlFor="gen-floors"
          error={state.fieldErrors?.floors}
          required
        >
          {(control) => (
            <Input
              {...control}
              name="floors"
              type="number"
              min={1}
              max={80}
              value={floors}
              onChange={(event) => setFloors(event.target.value)}
              required
            />
          )}
        </Field>
        <Field
          label="Flats per floor"
          htmlFor="gen-per-floor"
          error={state.fieldErrors?.flats_per_floor}
          required
        >
          {(control) => (
            <Input
              {...control}
              name="flats_per_floor"
              type="number"
              min={1}
              max={40}
              value={perFloor}
              onChange={(event) => setPerFloor(event.target.value)}
              required
            />
          )}
        </Field>
      </div>
      <label className="text-ink flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="include_ground_floor"
          checked={ground}
          onChange={(event) => setGround(event.target.checked)}
          className="size-4"
        />
        Flats on the ground floor too (numbered G01, G02…)
      </label>
      <p className="text-ink-muted text-sm">
        {preview
          ? `${preview.count} flats, numbered ${label(preview.first)} to ${label(preview.last)}. Existing flats are skipped.`
          : 'Fill in all three to see how many flats this makes.'}
      </p>
      <Feedback state={state} />
      <Submit
        label={preview ? `Add ${preview.count} flats` : 'Add flats'}
        busy="Adding…"
        disabled={!preview}
      />
    </form>
  );
}

/** Reads the CSV in the browser for a preview; the server parses it again before saving. */
export function ImportFlatsForm({ slug }: { slug: string }) {
  const [state, action] = useActionState<ActionState, FormData>(importUnits, EMPTY_STATE);
  const [csv, setCsv] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const parsed = useMemo(() => (csv ? parseFlatsCsv(csv) : null), [csv]);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="csv" value={csv} />
      <Field
        label="Spreadsheet (CSV)"
        htmlFor="flats-csv"
        hint="One row per flat. Columns: flat (required), tower, floor, bhk and sqft. Export from Excel or Google Sheets as CSV."
      >
        {(control) => (
          <Input
            {...control}
            type="file"
            accept=".csv,text/csv"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              setFileName(file?.name ?? null);
              setCsv(file ? await file.text() : '');
            }}
          />
        )}
      </Field>
      {parsed ? (
        <div className="border-border-base bg-surface-sunken rounded-lg border p-3 text-sm">
          <p className="text-ink font-medium">
            {fileName}: {parsed.rows.length} flat{parsed.rows.length === 1 ? '' : 's'} found
          </p>
          {parsed.rows.length ? (
            <p className="text-ink-muted mt-1">
              e.g.{' '}
              {parsed.rows
                .slice(0, 5)
                .map((row) => (row.block ? `${row.block}-${row.number}` : row.number))
                .join(', ')}
              {parsed.rows.length > 5 ? '…' : ''}
            </p>
          ) : null}
          {parsed.errors.length ? (
            <ul className="text-danger mt-2 list-disc space-y-0.5 pl-5">
              {parsed.errors.slice(0, 8).map((error) => (
                <li key={error}>{error}</li>
              ))}
              {parsed.errors.length > 8 ? <li>…and {parsed.errors.length - 8} more</li> : null}
            </ul>
          ) : null}
        </div>
      ) : null}
      <Feedback state={state} />
      <Submit
        label={parsed?.rows.length ? `Import ${parsed.rows.length} flats` : 'Import'}
        busy="Importing…"
        disabled={!parsed || parsed.rows.length === 0 || parsed.errors.length > 0}
      />
    </form>
  );
}

export function EditUnitForm({
  slug,
  unit,
}: {
  slug: string;
  unit: {
    id: string;
    block: string | null;
    number: string;
    floor: number | null;
    bedrooms: number | null;
    area_sqft: number | null;
  };
}) {
  const [state, action] = useActionState<ActionState, FormData>(updateUnit, EMPTY_STATE);
  const fields = [
    ['block', 'Tower', unit.block ?? '', 'text'],
    ['number', 'Flat', unit.number, 'text'],
    ['floor', 'Floor', unit.floor ?? '', 'number'],
    ['bedrooms', 'BHK', unit.bedrooms ?? '', 'number'],
    ['area_sqft', 'Area (sq ft)', unit.area_sqft ?? '', 'number'],
  ] as const;
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="id" value={unit.id} />
      <div className="grid gap-3 sm:grid-cols-5">
        {fields.map(([name, label, value, type]) => (
          <Field
            key={name}
            label={label}
            htmlFor={`unit-${name}`}
            error={state.fieldErrors?.[name]}
          >
            {(control) => (
              <Input
                {...control}
                name={name}
                type={type}
                defaultValue={String(value)}
                required={name === 'number'}
              />
            )}
          </Field>
        ))}
      </div>
      <Feedback state={state} />
      <Submit label="Save flat" busy="Saving…" />
    </form>
  );
}
