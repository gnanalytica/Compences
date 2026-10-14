'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { CalendarClock, DoorOpen, Home, ShieldCheck } from 'lucide-react';
import { ROLE_LABEL, formatDate, formatInviteCode, type Role } from '@compences/core';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/field';
import { checkInviteCode, redeemInvite, type InviteState } from './actions';

function Submit({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? busy : label}
    </Button>
  );
}

const initial: InviteState = {};

/**
 * An invite code, what it turns out to be for, and a button that uses it.
 *
 * Two steps on purpose. A society code files a request somebody reviews; this
 * one seats you the moment it is redeemed, with a role and often a flat already
 * decided. Showing which society, which role and which flat before the button
 * is the difference between joining and guessing — and a code has no owner's
 * name on it, so the screen is the only chance to notice it is the wrong one.
 */
export function InviteFlow({ initialCode = '' }: { initialCode?: string }) {
  const [checked, checkAction] = useActionState(checkInviteCode, initial);
  const [redeemed, redeemAction] = useActionState(redeemInvite, initial);
  const [code, setCode] = useState(initialCode);

  const preview = checked.preview;
  // The redeem step can reject a code the preview accepted — it expires, is
  // revoked or runs out between the two — so its error wins where it exists.
  const codeError = redeemed.fieldErrors?.invite_code ?? checked.fieldErrors?.invite_code;

  if (preview) {
    return (
      <form action={redeemAction} className="space-y-4">
        <input type="hidden" name="invite_code" value={checked.code ?? code} />
        <Card>
          <CardBody className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="bg-accent/10 text-accent grid size-10 shrink-0 place-items-center rounded-lg">
                <DoorOpen className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-ink font-semibold">{preview.communityName}</p>
                <p className="text-ink-muted text-sm">
                  Joining as {ROLE_LABEL[preview.role as Role] ?? 'Resident'}
                </p>
              </div>
            </div>

            {preview.unitLabel ? (
              <p className="text-ink-muted flex items-center gap-2 text-sm">
                <Home className="size-4 shrink-0" aria-hidden="true" />
                Flat {preview.unitLabel} will be yours
              </p>
            ) : null}

            {preview.expiresAt ? (
              <p className="text-ink-subtle flex items-center gap-2 text-xs">
                <CalendarClock className="size-3.5 shrink-0" aria-hidden="true" />
                Valid until {formatDate(preview.expiresAt.slice(0, 10))}
              </p>
            ) : null}
          </CardBody>
        </Card>

        {codeError ? (
          <p role="alert" className="text-danger text-sm">
            {codeError}
          </p>
        ) : null}
        {redeemed.error ? (
          <p role="alert" className="text-danger text-sm">
            {redeemed.error}
          </p>
        ) : null}

        <Submit label={`Join ${preview.communityName}`} busy="Joining…" />
        <p className="text-ink-subtle flex items-start gap-2 text-xs">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>Joining is immediate. If the society above isn’t yours, don’t use this code.</span>
        </p>
      </form>
    );
  }

  return (
    <form action={checkAction} className="space-y-4">
      <Field label="Invite code" htmlFor="invite-code" error={codeError} required>
        {(control) => (
          <Input
            {...control}
            name="invite_code"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder="K7MQ-3XPB"
            autoComplete="one-time-code"
            autoCapitalize="characters"
            spellCheck={false}
            inputMode="text"
            required
          />
        )}
      </Field>
      {code && formatInviteCode(code) !== code ? (
        <p className="text-ink-subtle text-xs">Reads as {formatInviteCode(code)}</p>
      ) : null}
      <Submit label="Check this code" busy="Checking…" />
    </form>
  );
}
