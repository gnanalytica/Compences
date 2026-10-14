'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Check, Hourglass, ReceiptIndianRupee, RotateCcw, Users } from 'lucide-react';
import { formatMoney, fundBarSegments } from '@compences/core';
import { FundBar } from '@/components/badges';
import { Motif } from '@/components/motif';
import { buttonClass } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useFestivalTheme } from './theme';

/**
 * A toy festival fund on the front page: tap a flat, and it pays.
 *
 * It plays the product's own loop at the size of one building. A flat paying
 * by UPI is *reported* first — the bar shows it as a faint segment, waiting —
 * and a moment later staff or the committee confirm it, and only then does it
 * land on the ledger, with the neighbour's name, their flat and how they paid.
 * Cash goes straight on: staff record it as they take it (recordPayment writes
 * it confirmed). That is the order the real app keeps — a payment nobody has
 * confirmed is not on the ledger — and the bar is drawn by the same
 * fundBarSegments the app's own fund cards use.
 *
 * Nothing leaves the page: the neighbours are invented, and so is the money.
 */

/** ₹1,001 a flat: the round number with the extra rupee a family would give. */
const SHARE = 1001;
const TARGET = 12_000;
/** How long a UPI payment sits waiting before somebody confirms it. */
const CONFIRM_AFTER = 900;

type Flat = { id: string; name: string; method: 'UPI' | 'Cash' };

/** Top floor first, the way a building is drawn. */
const FLOORS: Flat[][] = [
  [
    { id: 'A-301', name: 'Lakshmi Menon', method: 'UPI' },
    { id: 'A-302', name: 'Imran Khan', method: 'UPI' },
    { id: 'A-303', name: 'Sneha Patil', method: 'Cash' },
    { id: 'A-304', name: 'Vikram Reddy', method: 'UPI' },
  ],
  [
    { id: 'A-201', name: 'Priya Nair', method: 'UPI' },
    { id: 'A-202', name: 'Harpreet Singh', method: 'UPI' },
    { id: 'A-203', name: 'Ananya Das', method: 'UPI' },
    { id: 'A-204', name: 'Rahul Verma', method: 'Cash' },
  ],
  [
    { id: 'A-101', name: 'Meera Iyer', method: 'UPI' },
    { id: 'A-102', name: 'Joseph D’Souza', method: 'Cash' },
    { id: 'A-103', name: 'Fatima Sheikh', method: 'UPI' },
    { id: 'A-104', name: 'Arjun Rao', method: 'UPI' },
  ],
];
const FLATS = FLOORS.flat();

type Stage = 'due' | 'waiting' | 'paid';

/** How a payment got onto the ledger, the way its row says it. */
const settled = (flat: Flat) => (flat.method === 'Cash' ? 'recorded by staff' : 'confirmed');

/** Where each spark of the celebration flies to, evenly round a circle. */
const BURST = Array.from({ length: 18 }, (_, index) => {
  const angle = (index / 18) * Math.PI * 2;
  const reach = 90 + (index % 3) * 30;
  return {
    dx: `${Math.round(Math.cos(angle) * reach)}px`,
    dy: `${Math.round(Math.sin(angle) * reach)}px`,
    delay: `${(index % 4) * 40}ms`,
    tone:
      index % 3 === 0 ? 'var(--ribbon)' : index % 3 === 1 ? 'var(--accent)' : 'oklch(0.82 0.16 80)',
    size: index % 2 ? 8 : 6,
  };
});

export function FundToy() {
  const { wearing } = useFestivalTheme();
  const [stage, setStage] = useState<Record<string, Stage>>({});
  const [ledger, setLedger] = useState<Flat[]>([]);
  const [said, setSaid] = useState('');
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => window.clearTimeout(timer));
  }, []);

  const later = (ms: number, then: () => void) => {
    timers.current.push(window.setTimeout(then, ms));
  };

  const land = (flat: Flat) => {
    setStage((now) => ({ ...now, [flat.id]: 'paid' }));
    setLedger((rows) => [flat, ...rows.filter((row) => row.id !== flat.id)]);
    setSaid(
      `${flat.name}, flat ${flat.id}: ${formatMoney(SHARE)} by ${flat.method}, ${settled(flat)}.`,
    );
  };

  const pay = (flat: Flat, delay = 0) => {
    later(delay, () => {
      if (flat.method === 'Cash') return land(flat);
      setStage((now) => ({ ...now, [flat.id]: 'waiting' }));
      later(CONFIRM_AFTER, () => land(flat));
    });
  };

  const due = FLATS.filter((flat) => (stage[flat.id] ?? 'due') === 'due');
  const paid = FLATS.filter((flat) => stage[flat.id] === 'paid').length;
  const waiting = FLATS.filter((flat) => stage[flat.id] === 'waiting').length;
  const raised = paid * SHARE;
  const bar = fundBarSegments(raised, waiting * SHARE, TARGET);
  const reached = raised >= TARGET;

  const everyone = () => due.forEach((flat, index) => pay(flat, index * 140));
  const reset = () => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
    setStage({});
    setLedger([]);
    setSaid('The fund is empty again.');
  };

  const name = wearing?.name ?? 'Festival';

  return (
    <div
      id="try"
      className="border-border-base bg-surface-raised relative scroll-mt-24 overflow-hidden rounded-3xl border shadow-2xl shadow-[color-mix(in_oklch,var(--accent)_22%,transparent)]"
    >
      <div className="from-accent to-ribbon text-accent-ink flex items-center justify-between gap-3 bg-linear-to-r px-5 py-3">
        <p className="font-display truncate text-lg leading-tight font-semibold">
          {wearing ? (
            <Motif
              id={wearing.palette.motif}
              compact
              className="mr-2 inline-block size-5 align-[-4px]"
            />
          ) : null}
          {name} fund
        </p>
        <span className="shrink-0 rounded-full bg-black/15 px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase">
          Try it
        </span>
      </div>

      <div className="p-5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="font-display text-ink text-4xl leading-none font-bold tabular-nums">
              {formatMoney(raised)}
            </p>
            <p className="text-ink-muted mt-1 text-sm">raised of {formatMoney(TARGET)}</p>
          </div>
          <p className="text-ink-muted text-right text-sm">
            <span className="text-ink font-semibold">{paid}</span> of {FLATS.length} flats paid
            <span className="block text-xs">
              {waiting ? `${waiting} waiting to be confirmed` : ' '}
            </span>
          </p>
        </div>
        <div className="mt-3">
          <FundBar percent={bar.confirmed} pendingPercent={bar.pending} />
        </div>

        {reached ? (
          <p className="landing-pop text-ink mt-4 rounded-xl bg-[var(--festival-wash)] px-3 py-2 text-sm font-medium">
            Target reached. Every rupee has a name and a flat beside it.
          </p>
        ) : (
          <p className="text-ink-muted mt-4 text-xs font-medium">
            Tap a flat to pay {formatMoney(SHARE)}
          </p>
        )}

        <div className="border-border-base bg-surface-sunken mt-2 space-y-2 rounded-2xl border p-2">
          {FLOORS.map((floor) => (
            <div key={floor[0]!.id} className="grid grid-cols-4 gap-2">
              {floor.map((flat) => {
                const now = stage[flat.id] ?? 'due';
                return (
                  <button
                    key={flat.id}
                    type="button"
                    disabled={now !== 'due'}
                    onClick={() => pay(flat)}
                    aria-label={`Flat ${flat.id}, ${flat.name}: ${
                      now === 'due'
                        ? `pay ${formatMoney(SHARE)}`
                        : now === 'waiting'
                          ? 'waiting to be confirmed'
                          : 'paid'
                    }`}
                    className={cn(
                      'flex min-h-12 flex-col items-center justify-center rounded-xl border text-xs font-semibold',
                      'transition-[transform,background-color,border-color,color,box-shadow] duration-300',
                      now === 'due' &&
                        'border-border-base bg-surface-raised text-ink-muted hover:border-accent hover:text-accent cursor-pointer hover:-translate-y-0.5 hover:shadow-md motion-reduce:hover:translate-y-0',
                      now === 'waiting' &&
                        'border-accent bg-surface-raised text-accent border-dashed',
                      now === 'paid' &&
                        'border-accent bg-accent text-accent-ink landing-pop shadow-sm',
                    )}
                  >
                    <span>{flat.id}</span>
                    <span className="mt-0.5 flex h-4 items-center" aria-hidden="true">
                      {now === 'due' ? (
                        <span className="text-[10px] font-medium opacity-75">Pay</span>
                      ) : now === 'waiting' ? (
                        <Hourglass className="size-3.5 motion-safe:animate-pulse" />
                      ) : (
                        <Check className="size-4" strokeWidth={3} />
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="mt-5 flex items-baseline justify-between gap-3">
          <p className="text-ink text-sm font-semibold">The ledger</p>
          <p className="text-ink-subtle text-xs">every resident can see it</p>
        </div>
        <ul className="mt-2 min-h-[9.75rem] space-y-1.5">
          {ledger.length === 0 ? (
            <li className="border-border-base text-ink-subtle grid min-h-[9.75rem] place-items-center rounded-xl border border-dashed px-6 text-center text-xs">
              <span>
                <ReceiptIndianRupee className="mx-auto mb-2 size-6 opacity-60" aria-hidden="true" />
                Nothing here yet. Payments appear once staff or the committee confirm them.
              </span>
            </li>
          ) : (
            ledger.slice(0, 3).map((flat) => (
              <li
                key={flat.id}
                className="landing-slide-in bg-surface-sunken flex items-center justify-between gap-3 rounded-xl px-3 py-2"
              >
                <span className="min-w-0">
                  <span className="text-ink block truncate text-sm font-medium">{flat.name}</span>
                  <span className="text-ink-muted block text-xs">
                    Flat {flat.id} · {flat.method} · {settled(flat)}
                  </span>
                </span>
                <span className="text-success shrink-0 text-sm font-semibold tabular-nums">
                  +{formatMoney(SHARE)}
                </span>
              </li>
            ))
          )}
          {ledger.length > 3 ? (
            <li className="text-ink-subtle px-1 text-xs">and {ledger.length - 3} more</li>
          ) : null}
        </ul>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={everyone}
            disabled={due.length === 0}
            className={buttonClass('secondary', 'sm')}
          >
            <Users className="size-4" aria-hidden="true" />
            Everyone pays
          </button>
          <button
            type="button"
            onClick={reset}
            disabled={due.length === FLATS.length}
            className={buttonClass('ghost', 'sm')}
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            Start again
          </button>
        </div>
        <p className="text-ink-subtle mt-3 text-[11px]">
          A toy fund with invented neighbours. No money moves.
        </p>
      </div>

      {reached ? (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          {BURST.map((spark) => (
            <span
              key={`${spark.dx}${spark.dy}`}
              className="landing-burst absolute top-[42%] left-1/2 rounded-full"
              style={
                {
                  '--dx': spark.dx,
                  '--dy': spark.dy,
                  width: spark.size,
                  height: spark.size,
                  background: spark.tone,
                  animationDelay: spark.delay,
                } as CSSProperties
              }
            />
          ))}
        </div>
      ) : null}

      <p aria-live="polite" className="sr-only">
        {reached ? 'Target reached. Every rupee has a name and a flat beside it.' : said}
      </p>
    </div>
  );
}
