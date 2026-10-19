import type { ReactNode } from 'react';
import type { Enums } from '@compences/supabase';
import {
  EVENT_STATUS_LABEL,
  EXPENSE_STATUS_LABEL,
  TASK_STATUS_LABEL,
  formatMoney,
  fundKey,
} from '@compences/core';
import { cn } from '@/lib/utils';
import { Badge, type Tone } from './ui/badge';

const EVENT_TONES: Record<Enums<'event_status'>, Tone> = {
  proposed: 'warning',
  draft: 'neutral',
  published: 'brand',
  completed: 'success',
  cancelled: 'danger',
};

const TASK_TONES: Record<Enums<'task_status'>, Tone> = {
  todo: 'danger',
  in_progress: 'warning',
  done: 'success',
  blocked: 'neutral',
};

const EXPENSE_TONES: Record<Enums<'expense_status'>, Tone> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  changes_requested: 'info',
};

const PAYMENT: Record<Enums<'contribution_status'>, { tone: Tone; label: string }> = {
  pending: { tone: 'warning', label: 'Waiting for confirmation' },
  succeeded: { tone: 'success', label: 'Receipt confirmed' },
  failed: { tone: 'danger', label: 'Not confirmed' },
  refunded: { tone: 'neutral', label: 'Refunded' },
};

/** Where a receipt stands: reported receipts count only once staff confirm them. */
export const PaymentStatusBadge = ({ status }: { status: Enums<'contribution_status'> }) => (
  <Badge tone={PAYMENT[status].tone}>{PAYMENT[status].label}</Badge>
);

export const EventStatusBadge = ({ status }: { status: Enums<'event_status'> }) => (
  <Badge tone={EVENT_TONES[status]}>{EVENT_STATUS_LABEL[status]}</Badge>
);

export const TaskStatusBadge = ({ status }: { status: Enums<'task_status'> }) => (
  <Badge tone={TASK_TONES[status]}>{TASK_STATUS_LABEL[status]}</Badge>
);

export const ExpenseStatusBadge = ({ status }: { status: Enums<'expense_status'> }) => (
  <Badge tone={EXPENSE_TONES[status]}>{EXPENSE_STATUS_LABEL[status]}</Badge>
);

/** The readiness figure that headlines every event card. */
export function ReadinessBar({ percent }: { percent: number }) {
  return (
    <div
      className="bg-surface-sunken h-2 overflow-hidden rounded-full"
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Event readiness"
    >
      <div
        className="bg-accent h-full rounded-full transition-[width]"
        style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
      />
    </div>
  );
}

/**
 * Diagonal stripes in one colour: money residents have reported paying and
 * nobody has confirmed yet. Striped rather than paler, because a paler bar
 * reads as disabled and stripes read as in progress.
 */
export function stripes(color: string): string {
  return `repeating-linear-gradient(-45deg, ${color} 0 4px, color-mix(in oklch, ${color} 30%, transparent) 4px 8px)`;
}

/**
 * Fund progress: what the fund holds, solid, then what is waiting to be
 * confirmed, striped, both as shares of the event's target (fundBarSegments).
 * `aria-valuenow` is the confirmed figure; nothing counts until it is.
 *
 * Also used as a plain progress bar (setup, votes): without pendingPercent it
 * is one solid segment.
 */
export function FundBar({
  percent,
  pendingPercent = 0,
}: {
  percent: number;
  /** Reported and not yet confirmed. Clamped to whatever the bar has left. */
  pendingPercent?: number;
}) {
  const confirmed = Math.min(100, Math.max(0, percent));
  const pending = Math.min(100 - confirmed, Math.max(0, pendingPercent));
  return (
    <div
      className="bg-surface-sunken flex h-[7px] overflow-hidden rounded-full"
      role="progressbar"
      aria-valuenow={confirmed}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Fund progress"
      aria-valuetext={[
        `${confirmed}% confirmed`,
        pending > 0 ? `${pending}% to be confirmed` : null,
      ]
        .filter(Boolean)
        .join(', ')}
    >
      {/* One strip that fills from nothing, so the solid and striped parts
          arrive together rather than one after the other. */}
      <div className="bar-fill flex h-full" style={{ width: `${confirmed + pending}%` }}>
        <div
          className="bg-success h-full rounded-full"
          style={{
            width: confirmed + pending ? `${(confirmed / (confirmed + pending)) * 100}%` : 0,
          }}
        />
        {pending > 0 ? (
          <div
            className="h-full flex-1"
            style={{ backgroundImage: stripes('var(--color-success)') }}
          />
        ) : null}
      </div>
    </div>
  );
}

/**
 * The key under a fund bar, in place of sentences: a solid swatch for what is
 * confirmed and a striped one for what is still to be confirmed (fundKey).
 * `onColor` is for a bar drawn in white on a festival gradient.
 */
export function FundKey({
  confirmed,
  pending,
  currency,
  onColor = false,
  className,
}: {
  confirmed: number;
  pending: number;
  currency: string;
  onColor?: boolean;
  className?: string;
}) {
  const key = fundKey(confirmed, pending, currency);
  const swatch = onColor ? 'rgb(255 255 255 / 0.9)' : 'var(--color-success)';
  return (
    <p
      className={cn(
        'flex flex-wrap gap-x-3 gap-y-1 text-xs',
        onColor ? 'text-white/85' : 'text-ink-muted',
        className,
      )}
    >
      <span className="inline-flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="inline-block h-2 w-3 rounded-sm"
          style={{ backgroundColor: swatch }}
        />
        {key.confirmed}
      </span>
      {key.pending ? (
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block h-2 w-3 rounded-sm"
            style={{ backgroundImage: stripes(swatch) }}
          />
          {key.pending}
        </span>
      ) : null}
    </p>
  );
}

/**
 * The row of three stats that sits above a page.
 *
 * Two across on a phone with the third spanning the row, three across from
 * `sm`. Three across on a phone does not fit and never did: a third of a 360px
 * screen leaves about 77px of text space, and a full rupee amount needs 97px
 * at ₹1,25,000 and 128px at a crore. A digit string has no space or hyphen for
 * the browser to wrap at, so the number ran past its tile and took the whole
 * page sideways with it — every page carrying these tiles scrolled
 * horizontally at 360, 390 and 414px.
 *
 * Callers pass their own gap or border through `className`; twMerge lets those
 * win over the defaults here.
 */
export function StatTiles({
  children,
  className,
  four = false,
}: {
  children: ReactNode;
  className?: string;
  /** Four tiles: two by two on a phone, one row from a tablet up. */
  four?: boolean;
}) {
  return (
    <div
      className={cn(
        four
          ? 'grid grid-cols-2 gap-3 sm:grid-cols-4'
          : [
              'grid grid-cols-2 gap-3 sm:grid-cols-3',
              '[&>*:nth-child(3)]:col-span-2 sm:[&>*:nth-child(3)]:col-span-1',
            ],
        className,
      )}
    >
      {children}
    </div>
  );
}

export function StatTile({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone?: 'success' | 'danger';
  /** A line under the label saying where the number comes from. */
  hint?: string;
}) {
  return (
    <div className="border-border-base bg-surface-raised rounded-2xl border px-3.5 py-3">
      <div
        className={cn(
          // A notch smaller on a phone, where the tile is narrower than the
          // screen it sits on. `break-words` is the backstop: a number too long
          // even for two-up wraps inside its tile instead of pushing the page.
          'font-serif text-lg font-medium tracking-tight break-words sm:text-xl',
          tone === 'success' ? 'text-success' : tone === 'danger' ? 'text-danger' : 'text-ink',
        )}
      >
        {value}
      </div>
      <div className="text-ink-subtle mt-0.5 text-[10.5px] font-medium tracking-[0.08em] uppercase">
        {label}
      </div>
      {hint ? <p className="text-ink-muted mt-1 text-xs leading-snug">{hint}</p> : null}
    </div>
  );
}

/**
 * Spending, in its own colour so it never reads as the fund bar above it:
 * approved bills as a share of what the event collected. A full bar in the
 * danger colour means the bills came to more than that, and somebody paid the
 * difference out of their own pocket.
 *
 * What the event handed on when it closed — kept for the society, or carried
 * to another event — follows in a second colour, so a closed event's bar ends
 * where its money did instead of showing room that is not there.
 */
export function SpendBar({
  percent,
  movedPercent = 0,
  over = false,
}: {
  percent: number;
  movedPercent?: number;
  over?: boolean;
}) {
  const width = Math.min(100, Math.max(0, percent));
  const moved = over ? 0 : Math.min(100 - width, Math.max(0, movedPercent));
  return (
    <div
      className="bg-surface-sunken flex h-[7px] overflow-hidden rounded-full"
      role="progressbar"
      aria-valuenow={width}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Spent"
      aria-valuetext={
        over
          ? 'More than was collected'
          : moved > 0
            ? `${width}% of what was collected spent, ${moved}% moved on when it closed`
            : `${width}% of what was collected`
      }
    >
      <div
        className={cn(
          'bar-fill h-full',
          moved > 0 ? 'rounded-l-full' : 'rounded-full',
          over ? 'bg-danger' : 'bg-warning',
        )}
        style={{ width: `${width}%` }}
      />
      {moved > 0 ? (
        <div
          className={cn('bar-fill bg-info h-full', width > 0 ? 'rounded-r-full' : 'rounded-full')}
          style={{ width: `${moved}%` }}
        />
      ) : null}
    </div>
  );
}

/**
 * The line under the spend bar: what was spent, what was moved on when the
 * event closed, and what is left or owed.
 */
export function SpendKey({
  spent,
  movedOut = 0,
  balance,
  currency,
  className,
}: {
  spent: number;
  movedOut?: number;
  balance: number;
  currency: string;
  className?: string;
}) {
  const over = balance < 0;
  return (
    <p className={cn('text-ink-muted flex flex-wrap gap-x-3 gap-y-1 text-xs', className)}>
      <span className="inline-flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className={cn('inline-block h-2 w-3 rounded-sm', over ? 'bg-danger' : 'bg-warning')}
        />
        {formatMoney(spent, currency)} spent
      </span>
      {movedOut > 0 ? (
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="bg-info inline-block h-2 w-3 rounded-sm" />
          {formatMoney(movedOut, currency)} moved on
        </span>
      ) : null}
      <span className={over ? 'text-danger font-medium' : undefined}>
        {over
          ? `${formatMoney(-balance, currency)} more than was collected`
          : `${formatMoney(balance, currency)} left`}
      </span>
    </p>
  );
}
