'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Textarea } from '@/components/ui/field';
import { FocusFirstError } from '@/components/focus-first-error';
import { EMPTY_STATE, type ActionState } from '@/lib/action-state';
import { useResetOnSuccess } from '@/lib/use-reset-on-success';
import { cn } from '@/lib/utils';
import { saveReview, takeDownListing } from '../actions';

function Submit({
  idle,
  busy,
  variant = 'primary',
}: {
  idle: string;
  busy: string;
  variant?: 'primary' | 'danger';
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant={variant} disabled={pending}>
      {pending ? busy : idle}
    </Button>
  );
}

const STAR_WORDS = ['', 'Poor', 'Could be better', 'Good', 'Very good', 'Excellent'];

/**
 * Stars and a few words. Writing again replaces your review rather than
 * adding another, so the form opens with what you said last time.
 *
 * The stars are five radio buttons under the paint: a keyboard moves through
 * them with the arrow keys and a screen reader hears "4 stars, Very good",
 * which a row of clickable icons would not give either of them.
 */
export function ReviewForm({
  slug,
  listingId,
  rating,
  body,
}: {
  slug: string;
  listingId: string;
  rating?: number;
  body?: string | null;
}) {
  const [state, action] = useActionState<ActionState, FormData>(saveReview, EMPTY_STATE);
  const [chosen, setChosen] = useState(rating ?? 0);
  const [hover, setHover] = useState(0);
  const lit = hover || chosen;
  const editing = rating !== undefined;

  return (
    <form action={action} className="space-y-3">
      <FocusFirstError signal={state} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="listing_id" value={listingId} />
      <fieldset>
        <legend className="text-ink mb-1.5 text-sm font-medium">
          Your rating
          <span className="text-danger ml-0.5" aria-hidden="true">
            *
          </span>
        </legend>
        <div className="flex items-center gap-3">
          <div className="flex items-center" onPointerLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((n) => (
              <label
                key={n}
                className="text-gold has-[:focus-visible]:ring-border-strong grid size-9 cursor-pointer place-items-center rounded-lg has-[:focus-visible]:ring-2 pointer-coarse:size-11"
                onPointerEnter={() => setHover(n)}
              >
                <input
                  type="radio"
                  name="rating"
                  value={n}
                  checked={chosen === n}
                  onChange={() => setChosen(n)}
                  className="sr-only"
                  aria-invalid={state.fieldErrors?.rating ? true : undefined}
                />
                <Star
                  className={cn(
                    'size-6 transition-transform',
                    n <= lit ? 'fill-current' : 'opacity-40',
                  )}
                  aria-hidden="true"
                />
                <span className="sr-only">
                  {n} {n === 1 ? 'star' : 'stars'}, {STAR_WORDS[n]}
                </span>
              </label>
            ))}
          </div>
          {lit ? <span className="text-ink-muted text-sm">{STAR_WORDS[lit]}</span> : null}
        </div>
        {state.fieldErrors?.rating ? (
          <p role="alert" className="text-danger mt-1 text-xs">
            {state.fieldErrors.rating}
          </p>
        ) : null}
      </fieldset>
      <Field
        label="A few words"
        htmlFor={`review-body-${listingId}`}
        error={state.fieldErrors?.body}
        hint="Optional. What you bought, and how it was."
      >
        {(control) => (
          <Textarea
            {...control}
            name="body"
            rows={3}
            maxLength={1000}
            defaultValue={body ?? ''}
            placeholder="Ordered batter twice; soft idlis both times."
          />
        )}
      </Field>
      {state.error ? (
        <p role="alert" className="text-danger text-sm">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="text-success text-sm">
          {state.success}
        </p>
      ) : null}
      <Submit idle={editing ? 'Update review' : 'Post review'} busy="Saving…" />
    </form>
  );
}

/**
 * Staff or the committee take a listing off the board, saying why. The seller
 * is told the reason, so the box is required.
 */
export function TakeDownForm({ slug, listingId }: { slug: string; listingId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(takeDownListing, EMPTY_STATE);
  const ref = useResetOnSuccess(state);

  return (
    <form ref={ref} action={action} className="space-y-3">
      <FocusFirstError signal={state} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="listing_id" value={listingId} />
      <Field
        label="Why it is coming down"
        htmlFor="takedown-reason"
        error={state.fieldErrors?.reason}
        hint="The seller is sent this."
        required
      >
        {(control) => (
          <Textarea
            {...control}
            name="reason"
            rows={2}
            maxLength={500}
            placeholder="Selling things the society does not allow on its premises."
          />
        )}
      </Field>
      {state.error ? (
        <p role="alert" className="text-danger text-sm">
          {state.error}
        </p>
      ) : null}
      <Submit idle="Take down" busy="Taking down…" variant="danger" />
    </form>
  );
}
