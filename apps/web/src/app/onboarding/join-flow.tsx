'use client';

import { useActionState, useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { ShieldCheck } from 'lucide-react';
import { COPY } from '@compences/core';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { Field, Input, Select } from '@/components/ui/field';
import { checkJoinCode, submitJoin, type CodeState, type JoinState } from './actions';

function Submit({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? busy : label}
    </Button>
  );
}

const initialCode: CodeState = {};
const initialJoin: JoinState = {};

/**
 * The society code, then one form with who you are and your flat. Checking the
 * code files nothing; the request is sent once, from the second form.
 */
export function JoinFlow({
  initialCode: prefilledCode = '',
  initialName = '',
}: {
  /** From a shared join link. */
  initialCode?: string;
  /** From the Google account, so most people only add their mobile number. */
  initialName?: string;
}) {
  const [checked, checkAction] = useActionState(checkJoinCode, initialCode);
  const [joined, joinAction] = useActionState(submitJoin, initialJoin);
  const [code, setCode] = useState(prefilledCode);
  const [editingCode, setEditingCode] = useState(false);

  const units = useMemo(() => checked.units ?? [], [checked.units]);
  const blocks = useMemo(() => {
    const names = new Set(units.map((unit) => unit.block ?? ''));
    return [...names].sort();
  }, [units]);
  const [block, setBlock] = useState<string | null>(null);
  const [relation, setRelation] = useState('owner');
  const worksHere = relation === 'other';
  const activeBlock = block && blocks.includes(block) ? block : (blocks[0] ?? '');
  const flats = units.filter((unit) => (unit.block ?? '') === activeBlock);

  const codeRejected = Boolean(checked.code) && joined.badCode === checked.code;

  if (checked.code && !editingCode && !codeRejected) {
    return (
      <Card>
        <CardBody>
          <form action={joinAction} className="space-y-4">
            <input type="hidden" name="join_code" value={checked.code} />

            <div className="border-border-base bg-surface-sunken flex items-center justify-between gap-3 rounded-xl border px-4 py-3">
              <div>
                <p className="text-ink-subtle text-xs tracking-wide uppercase">
                  {COPY.societyCode}
                </p>
                <p className="text-ink font-mono text-lg font-semibold tracking-[0.2em]">
                  {checked.code}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingCode(true)}
                className="text-accent text-sm hover:underline"
              >
                Change
              </button>
            </div>

            <Field label="Your name" htmlFor="jr-name" error={joined.fieldErrors?.name} required>
              {(control) => (
                <Input
                  {...control}
                  name="name"
                  autoComplete="name"
                  defaultValue={initialName}
                  required
                />
              )}
            </Field>
            <Field
              label="Mobile number"
              htmlFor="jr-phone"
              error={joined.fieldErrors?.phone}
              hint="So staff can confirm it’s you."
              required
            >
              {(control) => (
                <Input
                  {...control}
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="98450 12345"
                  autoFocus={Boolean(initialName)}
                  required
                />
              )}
            </Field>

            <Field label="You are" htmlFor="jr-relation">
              {(control) => (
                <Select
                  {...control}
                  name="relation"
                  value={relation}
                  onChange={(event) => setRelation(event.target.value)}
                >
                  <option value="owner">Owner of a flat</option>
                  <option value="tenant">Tenant</option>
                  <option value="family">Family member of an owner or tenant</option>
                  <option value="other">I work for the society</option>
                </Select>
              )}
            </Field>

            {worksHere ? (
              <p className="text-ink-muted text-sm">
                No flat needed. The committee sets your role when they approve you.
              </p>
            ) : units.length ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {blocks.length > 1 ? (
                  <Field label="Tower" htmlFor="jr-block">
                    {(control) => (
                      <Select
                        {...control}
                        value={activeBlock}
                        onChange={(event) => setBlock(event.target.value)}
                      >
                        {blocks.map((name) => (
                          <option key={name} value={name}>
                            {name ? `Tower ${name}` : 'No tower'}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                ) : null}
                <Field label="Flat" htmlFor="jr-unit" error={joined.fieldErrors?.unit_id} required>
                  {(control) => (
                    <Select {...control} name="unit_id" required defaultValue="">
                      <option value="" disabled>
                        Pick your flat
                      </option>
                      {flats.map((unit) => (
                        <option key={unit.id} value={unit.id}>
                          {unit.block ? `${unit.block}-${unit.number}` : unit.number}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              </div>
            ) : (
              <p className="text-ink-muted text-sm">
                No flats are listed for this code yet. Send your request anyway; staff will confirm
                your flat.
              </p>
            )}

            {joined.error && !joined.badCode ? (
              <p role="alert" className="text-danger text-sm">
                {joined.error}
              </p>
            ) : null}

            <Submit label="Send for approval" busy="Sending…" />
          </form>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody>
        <form
          action={async (formData) => {
            setEditingCode(false);
            await checkAction(formData);
          }}
          className="space-y-4"
        >
          <Field
            label={COPY.societyCode}
            htmlFor="join-code"
            error={
              checked.fieldErrors?.join_code ??
              (codeRejected && !editingCode ? joined.error : undefined)
            }
            hint={
              prefilledCode
                ? 'Filled in from your join link.'
                : 'Your committee shares one code with every resident.'
            }
            required
          >
            {(control) => (
              <Input
                {...control}
                name="join_code"
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                placeholder="VJ4FQW"
                autoCapitalize="characters"
                spellCheck={false}
                autoFocus={!prefilledCode}
                required
                className="text-center font-mono text-lg tracking-[0.2em]"
              />
            )}
          </Field>

          {checked.error ? (
            <p role="alert" className="text-danger text-sm">
              {checked.error}
            </p>
          ) : null}

          <Submit label="Continue" busy="Checking…" />
          <p className="text-ink-subtle flex items-start gap-2 text-xs">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            Staff or the committee approve who gets in.
          </p>
        </form>
      </CardBody>
    </Card>
  );
}
