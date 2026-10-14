import type { CSSProperties, ReactNode } from 'react';
import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { formatMoney } from '@compences/core';
import { cn } from '@/lib/utils';

/**
 * The four chapters of the front page's tour, as Remotion compositions played
 * live by @remotion/player (scene-player.tsx) rather than as a rendered file.
 *
 * Live because they are drawn in the page's own CSS variables: when a visitor
 * dresses the page in another festival's colours, the phone in the tour
 * changes with it, and the festival's name comes in through inputProps. A
 * rendered video could not do either.
 *
 * Each is a phone screen playing one step of the product, the same steps the
 * explainer video walks through, and every one of them says only what the app
 * does: a payment is confirmed by somebody other than the payer, a bill is
 * approved by somebody other than the person who filed it, a statement line
 * nobody can account for is flagged, and a leftover is decided with a name on
 * the decision. The people and amounts are invented.
 */

export const SCENE = { width: 360, height: 560, fps: 30, frames: 210 } as const;

export type SceneProps = { festival: string };

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const ease = Easing.bezier(0.2, 0.8, 0.2, 1);

/** 0 → 1 over `length` frames from `at`, eased. */
function rise(frame: number, at: number, length = 14) {
  return interpolate(frame, [at, at + length], [0, 1], { ...clamp, easing: ease });
}

function Screen({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <AbsoluteFill className="bg-surface text-ink">
      <div className="text-ink-muted flex items-center justify-between px-5 pt-3 text-[11px] font-semibold">
        <span>9:41</span>
        <span className="flex items-center gap-1">
          <span className="bg-ink-muted inline-block h-2 w-3 rounded-[1px]" />
          <span className="border-ink-muted inline-block h-2.5 w-5 rounded-[3px] border" />
        </span>
      </div>
      <div className="border-border-base mt-2 border-b bg-[var(--festival-wash)] px-5 pt-2 pb-4">
        <p className="text-accent text-[11px] font-semibold tracking-wider uppercase">{kicker}</p>
        <p className="font-display truncate text-[22px] leading-tight font-semibold">{title}</p>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">{children}</div>
    </AbsoluteFill>
  );
}

function Card({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={cn(
        'border-border-base bg-surface-raised rounded-2xl border p-3.5 shadow-sm',
        className,
      )}
      style={style}
    >
      {children}
    </div>
  );
}

function Bar({
  value,
  tone = 'accent',
  over = 0,
}: {
  value: number;
  tone?: 'accent' | 'success';
  over?: number;
}) {
  const fill = Math.max(0, Math.min(1, value));
  return (
    <div className="bg-surface-sunken mt-2 flex h-2 overflow-hidden rounded-full">
      <div
        className={tone === 'success' ? 'bg-success' : 'bg-accent'}
        style={{ width: `${(fill - over) * 100}%` }}
      />
      {over > 0 ? <div className="bg-danger" style={{ width: `${over * 100}%` }} /> : null}
    </div>
  );
}

/** A button that visibly gets pressed at `at`. Drawn, not clickable. */
function Press({
  at,
  children,
  done,
  primary = false,
}: {
  at: number;
  children: ReactNode;
  done?: ReactNode;
  primary?: boolean;
}) {
  const frame = useCurrentFrame();
  const down = frame >= at && frame < at + 7;
  const ring = interpolate(frame, [at, at + 16], [0, 1], clamp);
  return (
    <span
      className={cn(
        'relative inline-flex h-9 items-center justify-center rounded-lg px-3.5 text-[13px] font-semibold',
        primary
          ? 'bg-accent text-accent-ink'
          : 'border-border-base bg-surface-raised text-ink border',
      )}
      style={{ transform: down ? 'scale(0.94)' : undefined }}
    >
      {done && frame >= at + 4 ? done : children}
      {frame >= at && frame < at + 16 ? (
        <span
          className="border-accent absolute inset-0 rounded-lg border-2"
          style={{ opacity: 1 - ring, transform: `scale(${1 + ring * 0.35})` }}
        />
      ) : null}
    </span>
  );
}

function Tick({ on }: { on: number }) {
  return (
    <span
      className="border-accent grid size-[18px] shrink-0 place-items-center rounded-full border-2"
      style={{ background: `color-mix(in oklch, var(--accent) ${on * 100}%, transparent)` }}
    >
      <svg viewBox="0 0 12 12" className="size-2.5" style={{ opacity: on }} aria-hidden="true">
        <path
          d="M2.5 6.2 5 8.6 9.6 3.6"
          fill="none"
          className="stroke-accent-ink"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Plan
// ---------------------------------------------------------------------------

const JOBS: { label: string; owner: string | null; at: number | null }[] = [
  { label: 'Book the tent', owner: 'Ravi', at: -1 },
  { label: 'Order 200 diyas', owner: 'Priya', at: -1 },
  { label: 'Sound check', owner: 'Imran', at: 30 },
  { label: 'Rangoli colours', owner: 'Sneha', at: 70 },
  { label: 'Sweets for 60 flats', owner: 'Meera', at: 110 },
  { label: 'Clean-up crew', owner: null, at: null },
];

export function PlanScene({ festival }: SceneProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const done = JOBS.map((job) =>
    job.at === null
      ? 0
      : job.at < 0
        ? 1
        : spring({ frame: frame - job.at, fps, config: { damping: 200 } }),
  );
  const readiness = done.reduce((sum, value) => sum + value, 0) / JOBS.length;
  const rangoliTeam = 2 + (frame >= 60 ? 1 : 0) + (frame >= 140 ? 1 : 0);

  return (
    <Screen kicker="Plan" title={festival}>
      <Card>
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-semibold">Ready for the day</span>
          <span className="text-ink-muted text-xs tabular-nums">
            {done.filter((value) => value > 0.5).length} of {JOBS.length} jobs done
          </span>
        </div>
        <Bar value={readiness} />
        <ul className="mt-3 space-y-2">
          {JOBS.map((job, index) => (
            <li key={job.label} className="flex items-center gap-2.5 text-[13px]">
              <Tick on={done[index] ?? 0} />
              <span
                className={(done[index] ?? 0) > 0.5 ? 'text-ink-muted line-through' : 'text-ink'}
              >
                {job.label}
              </span>
              <span className="ml-auto text-[11px]">
                {job.owner ? (
                  <span className="text-ink-subtle">{job.owner}</span>
                ) : (
                  <span className="text-warning font-semibold">No owner yet</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <p className="text-sm font-semibold">Volunteers</p>
        {[
          { label: 'Rangoli team', filled: rangoliTeam, of: 4 },
          { label: 'Food counter', filled: 1, of: 5 },
        ].map((role) => (
          <div key={role.label} className="mt-2.5">
            <div className="flex items-baseline justify-between text-[13px]">
              <span>{role.label}</span>
              <span
                className={cn(
                  'text-[11px] font-semibold',
                  role.filled < role.of ? 'text-warning' : 'text-success',
                )}
              >
                {role.filled < role.of ? `${role.of - role.filled} short` : 'Full'}
              </span>
            </div>
            <div className="mt-1.5 flex gap-1.5">
              {Array.from({ length: role.of }, (_, slot) => (
                <span
                  key={slot}
                  className={cn(
                    'h-6 flex-1 rounded-md border',
                    slot < role.filled
                      ? 'border-accent bg-accent'
                      : 'border-border-strong border-dashed',
                  )}
                />
              ))}
            </div>
          </div>
        ))}
      </Card>
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Collect
// ---------------------------------------------------------------------------

function LedgerLine({
  name,
  meta,
  amount,
  fresh = false,
}: {
  name: string;
  meta: string;
  amount: string;
  fresh?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 rounded-xl px-3 py-2',
        fresh ? 'bg-[var(--festival-wash)]' : 'bg-surface-sunken',
      )}
    >
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-medium">{name}</span>
        <span className="text-ink-muted block text-[11px]">{meta}</span>
      </span>
      <span className="text-success shrink-0 text-[13px] font-semibold tabular-nums">{amount}</span>
    </div>
  );
}

export function CollectScene({ festival }: SceneProps) {
  const frame = useCurrentFrame();
  const settled = rise(frame, 62, 16);
  const raised = interpolate(frame, [74, 112], [24500, 26501], { ...clamp, easing: ease });
  const arrived = rise(frame, 90, 18);

  return (
    <Screen kicker="Collect" title={`${festival} fund`}>
      <Card>
        <p className="text-ink-muted text-[11px] font-semibold tracking-wider uppercase">
          Payment to confirm
        </p>
        <div className="relative mt-2 overflow-hidden" style={{ height: 96 - settled * 60 }}>
          <div style={{ opacity: 1 - settled }}>
            <div className="flex items-start justify-between gap-3">
              <span>
                <span className="block text-sm font-semibold">Ananya Das</span>
                <span className="text-ink-muted block text-[11px]">
                  Flat A-203 · UPI · screenshot attached
                </span>
              </span>
              <span className="text-sm font-semibold tabular-nums">₹2,001</span>
            </div>
            <div className="mt-2.5 flex gap-2">
              <Press at={44} primary done="Confirmed">
                Confirm
              </Press>
              <Press at={999}>Not received</Press>
            </div>
          </div>
          <p
            className="text-success absolute inset-x-0 top-0 text-sm font-semibold"
            style={{ opacity: settled }}
          >
            ✓ Confirmed by Meera Iyer
          </p>
        </div>
        <p className="text-ink-subtle text-[11px]">Ananya paid it, so Ananya can’t confirm it.</p>
      </Card>

      <Card>
        <div className="flex items-baseline justify-between">
          <span className="font-display text-[26px] leading-none font-bold tabular-nums">
            {formatMoney(Math.round(raised))}
          </span>
          <span className="text-ink-muted text-xs">raised of ₹30,000</span>
        </div>
        <Bar value={raised / 30000} tone="success" />
      </Card>

      <Card className="space-y-1.5">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-semibold">The ledger</span>
          <span className="text-ink-subtle text-[11px]">every resident can see it</span>
        </div>
        <div style={{ height: arrived * 46, opacity: arrived, overflow: 'hidden' }}>
          <LedgerLine name="Ananya Das" meta="Flat A-203 · UPI" amount="+₹2,001" fresh />
        </div>
        <LedgerLine name="Meera Iyer" meta="Flat A-101 · UPI" amount="+₹1,001" />
        <LedgerLine name="Joseph D’Souza" meta="Flat A-102 · Cash" amount="+₹1,001" />
      </Card>
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Spend
// ---------------------------------------------------------------------------

const LINES = [
  { label: 'Decoration', spent: 5200, planned: 6000, at: 64 },
  { label: 'Tent and lights', spent: 8400, planned: 8000, at: 78 },
  { label: 'Food', spent: 9600, planned: 12000, at: 92 },
];

export function SpendScene({ festival }: SceneProps) {
  const frame = useCurrentFrame();
  const approved = rise(frame, 46, 12);

  return (
    <Screen kicker="Spend" title={`${festival} budget`}>
      <Card>
        <div className="flex items-start justify-between gap-3">
          <span>
            <span className="block text-sm font-semibold">Shree Tent House</span>
            <span className="text-ink-muted block text-[11px]">
              Tent and lights · filed by Ravi
            </span>
          </span>
          <span className="text-sm font-semibold tabular-nums">₹8,400</span>
        </div>
        <div className="border-border-base bg-surface-sunken mt-2.5 flex items-center gap-2 rounded-lg border px-2.5 py-2 text-[12px]">
          <span className="bg-danger/15 text-danger rounded px-1.5 py-0.5 text-[10px] font-bold">
            PDF
          </span>
          <span className="text-ink-muted">tent-invoice.pdf · the bill, attached</span>
        </div>
        <div className="mt-2.5 flex items-center gap-2">
          <Press at={38} primary done="Approved">
            Approve
          </Press>
          <span className="text-success text-[12px] font-semibold" style={{ opacity: approved }}>
            ✓ by Meera Iyer
          </span>
        </div>
        <p className="text-ink-subtle mt-2 text-[11px]">Ravi filed it, so Ravi can’t approve it.</p>
      </Card>

      <Card>
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-semibold">Spend against the plan</span>
          <span className="text-ink-subtle text-[11px]">line by line</span>
        </div>
        {LINES.map((line) => {
          const grow = rise(frame, line.at, 22);
          const share = (line.spent / line.planned) * grow;
          const over = Math.max(0, share - 1) / Math.max(1, share);
          const overBy = line.spent - line.planned;
          return (
            <div key={line.label} className="mt-3">
              <div className="flex items-baseline justify-between text-[13px]">
                <span>{line.label}</span>
                <span className="text-ink-muted text-[11px] tabular-nums">
                  {formatMoney(Math.round(line.spent * grow))} of {formatMoney(line.planned)}
                </span>
              </div>
              <Bar value={Math.min(share, 1)} over={over} />
              {overBy > 0 ? (
                <p
                  className="text-danger mt-1 text-[11px] font-semibold"
                  style={{ opacity: rise(frame, line.at + 22, 10) }}
                >
                  {formatMoney(overBy)} over budget
                </p>
              ) : null}
            </div>
          );
        })}
      </Card>
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Prove
// ---------------------------------------------------------------------------

const STATEMENT = [
  { line: 'UPI · Ananya Das', amount: 2001, at: 12 },
  { line: 'UPI · Meera Iyer', amount: 1001, at: 24 },
  { line: 'Cash deposit · A-102', amount: 1001, at: 36 },
  { line: 'UPI · Vikram Reddy', amount: 1001, at: 48 },
  { line: 'UPI · unknown sender', amount: 500, at: 66, flag: true },
];

export function ProveScene({ festival }: SceneProps) {
  const frame = useCurrentFrame();
  const closing = rise(frame, 98, 16);
  const kept = rise(frame, 128, 10);
  const signed = rise(frame, 142, 12);

  return (
    <Screen kicker="Prove" title={`${festival}, closed`}>
      <Card>
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-semibold">Bank statement</span>
          <span className="text-ink-subtle text-[11px]">paired with payments</span>
        </div>
        <ul className="mt-2 space-y-1.5">
          {STATEMENT.map((row) => {
            const shown = rise(frame, row.at, 10);
            return (
              <li key={row.line} className="flex items-center gap-2 text-[12.5px]">
                <span className="min-w-0 flex-1 truncate">{row.line}</span>
                <span className="tabular-nums">{formatMoney(row.amount)}</span>
                <span
                  className={cn(
                    'w-[92px] rounded-full px-2 py-0.5 text-center text-[10.5px] font-semibold',
                    row.flag ? 'bg-warning/20 text-ink' : 'bg-success/15 text-success',
                  )}
                  style={{ opacity: shown, transform: `scale(${0.8 + shown * 0.2})` }}
                >
                  {row.flag ? 'Unexplained' : '✓ Matched'}
                </span>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card style={{ opacity: closing, transform: `translateY(${(1 - closing) * 16}px)` }}>
        <p className="text-sm font-semibold">₹3,301 left when it closed</p>
        <div className="mt-2 space-y-1.5 text-[13px]">
          {['Keep it for the society', 'Put it behind another event'].map((choice, index) => {
            const on = index === 0 ? kept : 0;
            return (
              <div
                key={choice}
                className="border-border-base flex items-center gap-2.5 rounded-xl border px-3 py-2"
                style={{
                  borderColor: on > 0.5 ? 'var(--accent)' : undefined,
                  background: on > 0.5 ? 'var(--festival-wash)' : undefined,
                }}
              >
                <span className="border-accent grid size-4 place-items-center rounded-full border-2">
                  <span className="bg-accent size-2 rounded-full" style={{ opacity: on }} />
                </span>
                {choice}
              </div>
            );
          })}
        </div>
        <p className="text-ink-muted mt-2 text-[11px]" style={{ opacity: signed }}>
          Decided by Chitra Rao · every resident can see it
        </p>
      </Card>
    </Screen>
  );
}
