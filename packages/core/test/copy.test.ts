import { describe, expect, it } from 'vitest';
import { EVENT_TABS, TODO_KIND, TODO_ORDER, eventSlug, societySlug } from '../src/copy';

describe('shared copy', () => {
  it('covers every to-do kind in the display order', () => {
    expect(new Set(TODO_ORDER)).toEqual(new Set(Object.keys(TODO_KIND)));
  });

  it('calls money in a receipt, keeping the kind identifier', () => {
    expect(TODO_KIND.payment_to_confirm.section).toBe('Receipts to confirm');
  });

  it('has four event tabs', () => {
    expect(EVENT_TABS.map((tab) => tab.id)).toEqual(['about', 'money', 'activities', 'vote']);
  });

  it('generates a valid event web address from the name', () => {
    expect(eventSlug('Deepavali Habba 2026!')).toBe('deepavali-habba-2026');
    expect(eventSlug('ಗಣೇಶ')).toBe('event');
    expect(eventSlug('Ganesh Chaturthi', '2')).toBe('ganesh-chaturthi-2');
    expect(eventSlug('Ganesh Chaturthi')).toMatch(/^[a-z0-9][a-z0-9-]{1,60}$/);
  });

  it('generates a society web address the database constraint accepts', () => {
    // communities_slug_format: 3–50 characters, starting and ending with a
    // letter or digit. app.society_slug() derives the same value.
    const valid = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/;

    expect(societySlug('Shraddha Whitecliff')).toBe('shraddha-whitecliff');
    expect(societySlug('  My Home Residency!  ')).toBe('my-home-residency');

    // Too short, or nothing left at all, still has to clear the constraint.
    expect(societySlug('AB')).toBe('ab-society');
    expect(societySlug('ಗಣೇಶ')).toBe('society');
    expect(societySlug('!!!')).toBe('society');

    for (const name of ['AB', 'ಗಣೇಶ', '!!!', 'A'.repeat(120), 'Lake View - Phase 2']) {
      expect(societySlug(name)).toMatch(valid);
    }
  });

  it('never ends a society web address on the hyphen it cut at', () => {
    // 40 characters lands mid-separator, which would fail the constraint.
    expect(societySlug('a'.repeat(39) + ' bravo')).toBe('a'.repeat(39));
  });
});
