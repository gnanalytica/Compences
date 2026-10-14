import { describe, expect, it } from 'vitest';
import { FESTIVAL_CALENDAR, nextFestivalDate } from '@compences/core';
import { season } from '@/lib/season';
import { contrast, WHITE } from '@/lib/contrast';

describe('the season the landing page is dressed for', () => {
  it('wears the colours of the next festival, not the default green', () => {
    // 23 September: Gandhi Jayanti (a national day) is sooner, but the page
    // should already be getting ready for Navratri.
    const { next, palette } = season('2026-09-23');
    expect(next?.name).toBe('Navratri');
    expect(palette.id).toBe('dasara');
  });

  it('turns to Deepavali once Dasara has passed', () => {
    expect(season('2026-10-20').palette.id).toBe('deepavali');
  });

  it('never wears the plain society palette or a national day', () => {
    // Every day of a year: whatever comes up, the page is dressed for a festival.
    for (let day = 0; day < 366; day += 1) {
      const date = new Date(Date.UTC(2026, 0, 1 + day)).toISOString().slice(0, 10);
      const { palette } = season(date);
      expect(['community', 'national'], `${date} wore ${palette.id}`).not.toContain(palette.id);
    }
  });

  it('never prints an estimated date as if it were exact', () => {
    // The calendar stores moving festivals as the middle of their usual window.
    // A front page that says "1 Nov 2026" for Diwali is making that up.
    for (let day = 0; day < 366; day += 7) {
      const date = new Date(Date.UTC(2026, 0, 1 + day)).toISOString().slice(0, 10);
      for (const entry of season(date).upcoming) {
        const source = FESTIVAL_CALENDAR.find((festival) => festival.id === entry.id)!;
        const when = nextFestivalDate(source, date);
        if (when.exact) {
          expect(entry.when, `${entry.name} on ${date}`).toMatch(/\d{4}$/);
        } else {
          expect(entry.when, `${entry.name} on ${date}`).toBe(when.window);
          expect(entry.when).not.toMatch(/\d{4}/);
        }
      }
    }
  });

  it('lists what is coming up, soonest first', () => {
    const { upcoming } = season('2026-09-23', 5);
    expect(upcoming).toHaveLength(5);
    expect(upcoming[0]?.name).toBe('Gandhi Jayanti');
    expect(upcoming.map((entry) => entry.name)).toContain('Diwali');
  });

  it('hands back colours its sign-up button can be read on', () => {
    // Ganesh Chaturthi's saffron is 4.1:1 under white text as core has it; the
    // page wears it for a month, so what it wears has to be the deepened one.
    const { palette, upcoming } = season('2026-08-28');
    expect(palette.id).toBe('ganesh');
    for (const worn of [palette, ...upcoming.map((entry) => entry.palette)]) {
      expect(contrast(WHITE, worn.accent[0])).toBeGreaterThanOrEqual(4.5);
    }
  });
});
