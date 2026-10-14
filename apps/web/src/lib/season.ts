import {
  DEFAULT_FESTIVAL,
  FESTIVAL_CALENDAR,
  type Festival,
  formatDate,
  nextFestivalDate,
  paletteFor,
  searchFestivals,
  todayIn,
} from '@compences/core';
import { legible } from '@/lib/contrast';

/**
 * What the front page is dressed as, and what it lists as coming up.
 *
 * Inside the app every event takes its festival's colours — marigold for
 * Deepavali, vermilion and indigo for Dasara — and the landing page was the
 * one screen left in the default green. So it now does the same thing the
 * product does, with the calendar the event wizard already uses: it wears the
 * colours of the next festival a society will be planning for, and names the
 * few after it.
 *
 * Two rules come from the calendar rather than from taste:
 *
 * - A date the calendar only estimates is never shown as a date. Diwali is
 *   stored as the middle of the window it usually falls in; printing
 *   "1 Nov 2026" on the front page would be exactly the false precision the
 *   calendar's own notes warn against. Those festivals show their window.
 *
 * - The page's colours skip everything that is not a festival: the national
 *   days, Children's Day, Yoga Day. They belong on the list; they are not what
 *   anybody means by making the page festive.
 *
 * Every palette handed back has been through `legible`, because this page
 * wears whichever one is next and its sign-up button is white text on it.
 */

export type Upcoming = {
  id: string;
  name: string;
  palette: Festival;
  /** A real date for a fixed festival; the usual window for one that moves. */
  when: string;
};

export function season(today: string = todayIn(), count = 5) {
  // Every festival, soonest first — the page colour may need to look past the
  // first few to find one that is a festival rather than a day.
  const all = searchFestivals('', today, FESTIVAL_CALENDAR.length).map((entry): Upcoming => {
    const when = nextFestivalDate(entry, today);
    return {
      id: entry.id,
      name: entry.name,
      palette: legible(paletteFor(entry) ?? DEFAULT_FESTIVAL),
      when: when.exact ? formatDate(when.startsOn) : (when.window ?? 'date varies'),
    };
  });
  const next = all.find((entry) => entry.palette.kind === 'festival') ?? null;
  return {
    /** The festival whose colours the page wears. */
    next,
    palette: next?.palette ?? legible(DEFAULT_FESTIVAL),
    upcoming: all.slice(0, count),
  };
}
