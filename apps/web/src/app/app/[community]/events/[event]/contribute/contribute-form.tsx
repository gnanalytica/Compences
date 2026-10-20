'use client';

import { useActionState, useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Check, Clock, Copy, ExternalLink, Smartphone } from 'lucide-react';
import {
  COPY,
  contributionPresets,
  formatMoney,
  unitLabel,
  upiNote,
  upiPayUri,
} from '@compences/core';
import { Button, ButtonLink, buttonClass } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { Card, CardBody } from '@/components/ui/card';
import { FileUpload } from '@/components/file-upload';
import { FocusFirstError } from '@/components/focus-first-error';
import { contribute, type ContributeState } from '../../actions';

const initial: ContributeState = {};

/**
 * Copies a short string, and says so for a moment.
 *
 * Not the shared CopyButton: that one swallows a failure, and this is the one
 * place where a copy that quietly failed is how somebody pastes the wrong
 * thing into a payment. Clipboard access can be refused or absent (an insecure
 * origin, an old browser), so the button says so instead.
 */
function CopyButton({ value, label }: { value: string; label: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setState('copied');
        } catch {
          setState('failed');
        }
        setTimeout(() => setState('idle'), 2000);
      }}
      className={buttonClass('secondary', 'sm', 'shrink-0')}
    >
      {state === 'copied' ? (
        <Check className="text-success size-4" aria-hidden="true" />
      ) : (
        <Copy className="size-4" aria-hidden="true" />
      )}
      <span>
        {state === 'copied' ? 'Copied' : state === 'failed' ? 'Press and hold to copy' : 'Copy'}
      </span>
      <span className="sr-only">{` the ${label}`}</span>
    </button>
  );
}

/** A flat the resident can say this payment came from. */
export type FlatChoice = { id: string; block: string | null; number: string };

function Submit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled} className="w-full">
      {pending ? 'Sending…' : 'I’ve paid'}
    </Button>
  );
}

/**
 * Contributing on one screen: pick an amount, pay it from a UPI app, then
 * paste the UPI transaction ID or attach a screenshot. The payment and the
 * report sit side by side on wide screens and stack on phones.
 */
export function ContributeForm({
  slug,
  eventSlug,
  eventName,
  currency,
  suggested,
  upi,
  flatLabel,
  flats,
  proofFolder,
}: {
  slug: string;
  eventSlug: string;
  eventName: string;
  currency: string;
  /** Pre-filled from a link like ?amount=2000. */
  suggested: number | null;
  upi: { vpa: string; payeeName: string };
  flatLabel: string | null;
  /**
   * Every flat in the society, and only when nobody has listed this member at
   * one. Null is "the society already knows", which is the usual case and
   * renders no picker at all.
   */
  flats: FlatChoice[] | null;
  /** `{community_id}/{membership_id}`, where this resident's screenshots go. */
  proofFolder: string;
}) {
  const [state, action] = useActionState(contribute, initial);
  // A link's ?amount= lands on the screen already chosen; otherwise nothing is,
  // and the resident gives what they choose.
  const presets = contributionPresets(null);
  const opening = suggested;
  const [amount, setAmount] = useState<number | null>(opening);
  const [custom, setCustom] = useState(
    opening && !presets.includes(opening) ? String(opening) : '',
  );
  const [uploading, setUploading] = useState(false);

  /**
   * What gets recorded, which is not always what step 1 asked for. The payment
   * link carries an amount, but a UPI app lets you change it, and people do:
   * they round up, they add a neighbour's share, they pay half now. The
   * society's books should say what left the bank, so this field is the one
   * that counts and the resident can overwrite it.
   *
   * It follows step 1 while they are still choosing — picking ₹1,001 and then
   * typing it again would be silly — and stops following the moment they edit
   * it, unless they go back and pick a different amount.
   */
  const [reported, setReported] = useState(opening ? String(opening) : '');
  const [followed, setFollowed] = useState(amount);
  if (followed !== amount) {
    setFollowed(amount);
    setReported(amount === null ? '' : String(amount));
  }

  // Which flat the money is for. Asked only when the society has none on
  // record: it goes onto the payment, so the ledger can name the flat beside
  // the name, and into the note, so the bank line can be matched to it too.
  const [flatId, setFlatId] = useState('');
  const chosen = flats?.find((unit) => unit.id === flatId) ?? null;
  const towers = [...new Set((flats ?? []).map((unit) => unit.block ?? ''))];
  const flatNeeded = Boolean(flats?.length);
  const note = upiNote(flatLabel ?? (chosen ? unitLabel(chosen) : null), eventName);
  // No link until the note is final. A deep link built before they picked a
  // flat would carry a note with no flat in it, which is the whole problem
  // this screen exists to stop.
  const ready = Boolean(amount) && (!flatNeeded || Boolean(flatId));
  const uri = useMemo(
    () =>
      ready && amount ? upiPayUri({ vpa: upi.vpa, payeeName: upi.payeeName, amount, note }) : null,
    [ready, amount, note, upi.vpa, upi.payeeName],
  );

  if (state.reported) {
    return (
      <Card>
        <CardBody className="py-10 text-center">
          <Clock className="text-warning mx-auto size-12" aria-hidden="true" />
          <h2 className="text-ink mt-4 text-xl font-semibold tracking-tight">
            Sent for confirmation
          </h2>
          <p className="text-ink-muted mx-auto mt-1 max-w-sm text-sm">
            {state.reported.reference ? (
              <>
                Staff will match UPI transaction ID{' '}
                <span className="text-ink font-mono">{state.reported.reference}</span> with the bank
                statement.
              </>
            ) : (
              <>Staff will match your screenshot against the bank statement.</>
            )}{' '}
            Your {formatMoney(state.reported.amount, currency)} counts towards {eventName} once it
            is confirmed.
          </p>
          <div className="mt-7 flex justify-center gap-3">
            <ButtonLink href={`/app/${slug}/money?view=mine`} variant="secondary" size="sm">
              My contributions
            </ButtonLink>
            <ButtonLink href={`/app/${slug}/events/${eventSlug}#money`} size="sm">
              Back to the event
            </ButtonLink>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody className="space-y-6">
        {/* Before anything else, and only when nobody has listed this member
            at a door. It has to be settled here rather than beside the rest
            of step 3: the note in step 2 carries the flat into their UPI app,
            and by the time they are telling us they have paid, that note has
            already gone. Unnumbered because it is not a step everybody has —
            most residents never see this at all. */}
        {flatNeeded ? (
          <div className="border-border-base bg-surface-sunken space-y-1 rounded-lg border p-4">
            <Field
              label="Which flat is this payment for?"
              htmlFor="pay-flat"
              error={state.fieldErrors?.unit_id}
              hint="Your society hasn’t recorded a flat for you. The committee will be asked to list you here."
              required
            >
              {(control) => (
                <Select
                  {...control}
                  value={flatId}
                  onChange={(event) => setFlatId(event.target.value)}
                >
                  <option value="" disabled>
                    Choose your flat
                  </option>
                  {towers.map((tower) =>
                    tower ? (
                      <optgroup key={tower} label={`Tower ${tower}`}>
                        {(flats ?? [])
                          .filter((unit) => (unit.block ?? '') === tower)
                          .map((unit) => (
                            <option key={unit.id} value={unit.id}>
                              {unitLabel(unit)}
                            </option>
                          ))}
                      </optgroup>
                    ) : (
                      (flats ?? [])
                        .filter((unit) => !unit.block)
                        .map((unit) => (
                          <option key={unit.id} value={unit.id}>
                            {unitLabel(unit)}
                          </option>
                        ))
                    ),
                  )}
                </Select>
              )}
            </Field>
          </div>
        ) : null}

        <fieldset>
          <legend className="text-ink mb-2 block text-sm font-semibold">1. Amount</legend>
          <div
            className={
              presets.length > 2
                ? 'grid grid-cols-2 gap-2 sm:grid-cols-5'
                : 'grid grid-cols-2 gap-2 sm:grid-cols-3'
            }
          >
            {presets.map((preset) => (
              <button
                key={preset}
                type="button"
                aria-pressed={amount === preset && custom === ''}
                onClick={() => {
                  setAmount(preset);
                  setCustom('');
                }}
                className={
                  amount === preset && custom === ''
                    ? 'border-accent bg-surface-raised text-ink rounded-lg border-2 py-2.5 text-sm font-semibold'
                    : 'border-border-base bg-surface-raised text-ink-muted hover:bg-surface-sunken rounded-lg border py-2.5 text-sm font-medium'
                }
              >
                {formatMoney(preset, currency)}
              </button>
            ))}
            <div className="col-span-2 sm:col-span-1">
              <label htmlFor="custom-amount" className="sr-only">
                Another amount
              </label>
              <Input
                id="custom-amount"
                type="number"
                min={1}
                step="1"
                inputMode="numeric"
                placeholder="Other ₹"
                value={custom}
                onChange={(event) => {
                  setCustom(event.target.value);
                  const parsed = Number.parseInt(event.target.value, 10);
                  setAmount(Number.isFinite(parsed) && parsed > 0 ? parsed : null);
                }}
                className="h-full text-center"
              />
            </div>
          </div>
        </fieldset>

        <div className="grid gap-6 md:grid-cols-2">
          <section className="space-y-3" aria-labelledby="pay-heading">
            <h2 id="pay-heading" className="text-ink text-sm font-semibold">
              2. Pay {amount ? formatMoney(amount, currency) : ''} to {upi.payeeName}
            </h2>
            {/* There used to be a QR code here. It confused people: on the
                phone most residents read this on there is nothing to scan it
                with, and it left the two things they actually need to carry
                into their UPI app — the ID to pay and the note to type — as
                small print underneath. Copying is the whole of step 2 now. */}
            <dl className="border-border-base bg-surface-sunken divide-border-base divide-y rounded-lg border">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                <dt className="text-ink-muted w-full text-xs font-medium sm:w-auto">UPI ID</dt>
                <dd className="text-ink min-w-0 flex-1 font-mono text-sm break-all">{upi.vpa}</dd>
                <CopyButton value={upi.vpa} label="UPI ID" />
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                <dt className="text-ink-muted w-full text-xs font-medium sm:w-auto">Note</dt>
                {/* Not offered until the flat is in it. A half-built note is
                    worse than none: it copies cleanly, reads fine, and lands
                    on the statement as one more line nobody can place. */}
                {flatNeeded && !flatId ? (
                  <dd className="text-ink-subtle min-w-0 flex-1 text-sm">
                    Pick your flat above and the note will say which one paid.
                  </dd>
                ) : (
                  <>
                    <dd className="text-ink min-w-0 flex-1 font-mono text-sm break-all">{note}</dd>
                    <CopyButton value={note} label="note" />
                  </>
                )}
              </div>
            </dl>
            {uri ? (
              <a
                href={uri}
                className="bg-accent text-accent-ink inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold"
              >
                <Smartphone className="size-4" aria-hidden="true" />
                Open UPI app
                <ExternalLink className="size-3.5" aria-hidden="true" />
              </a>
            ) : (
              <p className="border-border-base text-ink-muted rounded-lg border border-dashed px-4 py-3 text-center text-sm">
                {flatNeeded && !flatId
                  ? 'Choose your flat and an amount above to open your UPI app.'
                  : 'Choose an amount above to open your UPI app.'}
              </p>
            )}
            {/* Most residents pay from the phone they are reading this on.
                Branched with CSS rather than a viewport check, so the server and
                the client render the same markup. */}
            <p className="text-ink-subtle text-xs">
              <span className="sm:hidden">
                Tap Open UPI app, or paste the UPI ID into the app you already use.
              </span>
              <span className="hidden sm:inline">
                Copy the UPI ID and the note, and pay from your phone.
              </span>{' '}
              Put the note in the payment&rsquo;s remark. You pay {upi.payeeName} directly;
              Compences never handles the money.
            </p>
          </section>

          <form action={action} className="space-y-4" aria-labelledby="report-heading">
            <FocusFirstError signal={state} />
            <h2 id="report-heading" className="text-ink text-sm font-semibold">
              3. Tell us it’s done
            </h2>
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="event" value={eventSlug} />

            {/* The choice is made above, before the note is copied; this is
                what carries it into the form. */}
            {flatNeeded ? <input type="hidden" name="unit_id" value={flatId} /> : null}

            <Field
              label="Amount you actually paid"
              htmlFor="paid-amount"
              error={state.fieldErrors?.amount}
              hint={
                amount && reported !== String(amount)
                  ? `Step 1 asked for ${formatMoney(amount, currency)}. This is what will be recorded.`
                  : 'Change it if your UPI app sent a different amount.'
              }
              required
            >
              {(control) => (
                <Input
                  {...control}
                  name="amount"
                  type="number"
                  min={1}
                  step="1"
                  inputMode="numeric"
                  autoComplete="off"
                  value={reported}
                  onChange={(event) => setReported(event.target.value)}
                />
              )}
            </Field>

            <Field
              label={COPY.upiReference}
              htmlFor="upi-reference"
              error={state.fieldErrors?.reference}
              hint="Optional if you attach a screenshot below."
            >
              {(control) => (
                <Input
                  {...control}
                  name="reference"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="612345678901"
                />
              )}
            </Field>

            <FileUpload
              bucket="payment-proofs"
              folder={proofFolder}
              name="proof_path"
              label="Payment screenshot"
              hint="The success screen from your UPI app. Only you and staff can see it."
              maxBytes={5 * 1_048_576}
              onUploadingChange={setUploading}
            />

            {state.error ? (
              <p role="alert" className="text-danger text-sm">
                {state.error}
              </p>
            ) : null}

            {/* Only the upload blocks the button. Missing an amount used to
                disable it too, which said nothing about why — the action
                answers that in the same branded style as every other error. */}
            <Submit disabled={uploading || (flatNeeded && !flatId)} />
            <p className="text-ink-subtle text-center text-xs">
              It shows as waiting until staff confirm it.
            </p>
          </form>
        </div>
      </CardBody>
    </Card>
  );
}
