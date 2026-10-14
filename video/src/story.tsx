import type { ReactNode } from 'react';
import { Easing, interpolate } from 'remotion';
import {
  BalanceScreen,
  BillsScreen,
  BudgetScreen,
  COMMITTEE,
  ClosureScreen,
  ConfirmScreen,
  EventScreen,
  HomeScreen,
  MoneyScreen,
  PayScreen,
  ReconcileScreen,
  TodoScreen,
} from './screens';
import { STING_SECONDS } from './logo';
import { sec } from './theme';

/**
 * The script, once, for both shapes it is cut into.
 *
 * `Phone` is portrait and `Explain` is landscape, and they are the same
 * fourteen beats in the same order carrying the same captions — only the
 * layout around the handset differs. Keeping the list here rather than in
 * either composition is what stops the two drifting into two different
 * arguments about the same product, which is what happened when the portrait
 * and landscape cuts each owned their own scene list.
 *
 * The screens follow the money in order — plan, collect, spend, prove — so the
 * same ₹2,001 payment turns up on four of them. The words over them are not a
 * story about it: each shot is a headline and two specifics, a figure off the
 * screen or the rule it shows, because what a committee wants from this is
 * facts it can check rather than a character to follow.
 */

// ---------------------------------------------------------------------------
// Chapters
// ---------------------------------------------------------------------------
/**
 * Four of them, because the product is a sequence and a tour is not.
 *
 * The rail under the phone says which one is running. Without it a viewer
 * eleven screens in has no idea whether they are near the end, and every
 * screen looks like another feature rather than the next step.
 */
export const CHAPTERS = ['Plan', 'Collect', 'Spend', 'Prove'] as const;
export type Chapter = (typeof CHAPTERS)[number];

export type Shot = {
  id: string;
  chapter?: Chapter;
  /**
   * What the shot is for, in a few words. Not a sentence about a person: the
   * copy is the product's specifics, not a story told over the screens.
   */
  headline?: string;
  screen?: ReactNode;
  bookend?: { headline: string; sub: string; opening?: boolean };
  statement?: { lines: string[]; sub?: string };
  /** The close: Compences's mark flowing into Gnanalytica's. See logo.tsx. */
  sting?: boolean;
  /** `zoom` runs from its first value to its second; `origin` is what it pushes towards. */
  zoom?: [number, number];
  origin?: number;
  tabs?: string[];
  active?: string;
  /**
   * The specifics under the headline — numbers off the screen, or the rule it
   * shows. Both cuts carry them. Every one has to be true of the product as
   * shipped: they are the part of the video most likely to age into a lie.
   */
  points?: string[];
};

export const SHOTS: Shot[] = [
  {
    id: 'open',
    bookend: {
      headline: 'Compences',
      // The landing page's own line, rather than one written for the video.
      sub: 'Plan together. Participate together. Spend transparently.',
      opening: true,
    },
  },
  {
    id: 'problem',
    statement: {
      lines: ['Festival funds,', 'fully accounted for.'],
      sub: 'Who paid · who approved · where it went',
    },
  },
  {
    id: 'home',
    chapter: 'Plan',
    headline: 'Every festival, one screen',
    // What the fund holds against the event's own target, the ₹7,800 the
    // Balance shot moves in from Summer Camp included. Same length as the old
    // pair, so the shot holds as long as it did.
    points: ['₹32,300 of ₹35,000', '₹7,800 from Summer Camp'],
    screen: <HomeScreen />,
    active: 'Home',
    zoom: [1.0, 1.05],
    origin: 0.34,
  },
  {
    id: 'event',
    chapter: 'Plan',
    headline: 'Readiness you can see',
    points: ['4 of 6 jobs done · 1 unassigned', 'Volunteer shortfalls shown'],
    screen: <EventScreen />,
    active: 'Events',
    zoom: [1.02, 1.09],
    origin: 0.5,
  },
  {
    id: 'pay',
    chapter: 'Collect',
    headline: 'Pay in two taps',
    points: ['Opens your UPI app', 'Amount and note filled in'],
    screen: <PayScreen />,
    active: 'Events',
    zoom: [1.02, 1.08],
    origin: 0.34,
  },
  {
    id: 'todo',
    chapter: 'Collect',
    headline: 'One queue for the committee',
    points: ['Payments · bills · residents · ideas', 'Most costly delays first'],
    screen: <TodoScreen />,
    tabs: COMMITTEE,
    active: 'Manage',
    zoom: [1.0, 1.07],
    origin: 0.34,
  },
  {
    // The rule has exactly one hatch in the database: a committee of one, where
    // there is nobody else to ask (app.sole_committee_member). It is stated
    // here as a specific rather than left out, because "someone else confirms
    // it" alone is not true for every society.
    id: 'confirm',
    chapter: 'Collect',
    headline: 'Someone else confirms it',
    points: ['Checked against the UPI screenshot', 'Only a one-person committee self-confirms'],
    screen: <ConfirmScreen />,
    tabs: COMMITTEE,
    active: 'Manage',
    zoom: [1.02, 1.1],
    origin: 0.42,
  },
  {
    id: 'money',
    chapter: 'Collect',
    headline: 'A public ledger',
    points: ['Name · flat · method on every row', 'Open to every resident'],
    screen: <MoneyScreen />,
    active: 'Money',
    zoom: [1.0, 1.09],
    origin: 0.4,
  },
  {
    // "Same rule" points back at the confirm shot, which carries the exception.
    id: 'bills',
    chapter: 'Spend',
    headline: 'Every rupee out, on record',
    points: ['Bill attached · approver named', 'Same rule: the filer can’t approve'],
    screen: <BillsScreen />,
    tabs: COMMITTEE,
    active: 'Events',
    zoom: [1.0, 1.1],
    origin: 0.68,
  },
  {
    id: 'budget',
    chapter: 'Spend',
    headline: 'Spend vs plan, per line',
    points: ['₹31,200 of ₹35,000 used', 'Any overspend is flagged'],
    screen: <BudgetScreen />,
    tabs: COMMITTEE,
    active: 'Events',
    zoom: [1.02, 1.09],
    origin: 0.46,
  },
  {
    id: 'reconcile',
    chapter: 'Prove',
    headline: 'Bank statement reconciled',
    points: ['Best match suggested, you confirm', 'Unmatched credits flagged'],
    screen: <ReconcileScreen />,
    tabs: COMMITTEE,
    active: 'Manage',
    zoom: [1.03, 1.09],
    origin: 0.42,
  },
  {
    id: 'closure',
    chapter: 'Prove',
    headline: 'Leftovers, decided openly',
    points: ['Keep it, or fund another event', 'Decision recorded with a name'],
    screen: <ClosureScreen />,
    tabs: COMMITTEE,
    active: 'Events',
    zoom: [1.0, 1.08],
    origin: 0.46,
  },
  {
    id: 'balance',
    chapter: 'Prove',
    headline: 'Balance on every home screen',
    points: ['₹5,300 held between events', 'Every move: amount, reason, author'],
    screen: <BalanceScreen />,
    active: 'Home',
    zoom: [1.02, 1.08],
    origin: 0.3,
  },
  {
    // This used to be a card that said compences.app — the app's bundle
    // identifier, not a site anybody can visit. The sting ends on the real
    // address, compences.com.
    id: 'close',
    sting: true,
  },
];

/**
 * How long a shot stays up: long enough to read what it says.
 *
 * The first timing was by eye, and it was too fast — a viewer could watch the
 * phone or read the text, not both. Every hold is now derived from the text
 * the shot actually shows, at a pace set for somebody reading in a second
 * language while something moves beside the words:
 *
 *   lead   the page settles and the eye finds the caption
 *   cps    characters read per second. Subtitle guidance for native readers
 *          watching nothing else is 15–17; this audience is doing more.
 *   tail   a moment to look back at the screen before it goes
 *
 * The text simply stays up that long. An earlier version lit each word as a
 * reading cursor reached it; people can read, and being shown where to look
 * was not what they asked for.
 */
export const READING = { lead: 0.9, cps: 14, tail: 1.4 } as const;

/** Everything a shot puts on screen to be read, in reading order. */
export function readingOf(shot: Shot): string[] {
  if (shot.statement)
    return [...shot.statement.lines, ...(shot.statement.sub ? [shot.statement.sub] : [])];
  if (shot.bookend) return [shot.bookend.headline, shot.bookend.sub];
  return [...(shot.headline ? [shot.headline] : []), ...(shot.points ?? [])];
}

export function holdOf(shot: Shot) {
  if (shot.sting) return sec(STING_SECONDS);
  const characters = readingOf(shot).reduce((total, line) => total + line.length, 0);
  const seconds = READING.lead + characters / READING.cps + READING.tail;
  // A screen also needs long enough for its own animation to finish.
  return sec(Math.max(shot.screen ? 4.6 : 3.2, seconds));
}

/** Shots overlap by this much, which is what makes the push a push. */
export const OVERLAP = sec(0.28);

let built: { holds: number[]; starts: number[]; length: number } | undefined;

/**
 * Every shot's length and start. Both cuts show the same words, so they share
 * one timeline, and one score length.
 */
export function timeline() {
  if (built) return built;
  const holds = SHOTS.map(holdOf);
  const starts: number[] = [];
  let at = 0;
  for (const hold of holds) {
    starts.push(at);
    at += hold - OVERLAP;
  }
  built = { holds, starts, length: at + OVERLAP };
  return built;
}

/** Which shot is on screen, and how far through it we are. */
export function at(frame: number) {
  const { holds, starts } = timeline();
  let index = 0;
  for (let i = 0; i < SHOTS.length; i += 1) if (frame >= starts[i]) index = i;
  const through = interpolate(frame, [starts[index], starts[index] + holds[index]], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return { shot: SHOTS[index], index, through };
}

/**
 * The camera, for the whole video.
 *
 * It lives out here rather than inside a shot because the bezel and the page
 * have to move together — a zoom applied to the page alone is a phone whose
 * display grows out of its case.
 */
export function camera(frame: number) {
  const { shot, through } = at(frame);
  const [from, to] = shot.zoom ?? [1, 1.04];
  const eased = interpolate(through, [0, 1], [0, 1], { easing: Easing.inOut(Easing.quad) });
  return { zoom: from + (to - from) * eased, origin: (shot.origin ?? 0.45) * 100 };
}

/** The rail needs the chapter of whichever shot has one, and its progress. */
export function chapterNow(frame: number) {
  const { shot, index, through } = at(frame);
  if (!shot.chapter) return null;
  const within = SHOTS.filter((entry) => entry.chapter === shot.chapter);
  const place = within.indexOf(SHOTS[index]);
  return { chapter: shot.chapter, progress: (place + through) / within.length };
}
