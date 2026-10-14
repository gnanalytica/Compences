import { describe, expect, it } from 'vitest';
import { FESTIVALS } from '@compences/core';
import { contrast, legible, WHITE } from '@/lib/contrast';

/** The ink globals.css puts on the accent in dark mode (`--accent-ink`). */
const DARK_ACCENT_INK = 'oklch(0.18 0.03 168)';

describe('festival colours the landing page can put text on', () => {
  it('measures contrast the way WCAG does', () => {
    expect(contrast(WHITE, 'oklch(0 0 0)')).toBeCloseTo(21, 1);
    expect(contrast(WHITE, WHITE)).toBeCloseTo(1, 5);
    // Symmetric: which one is the text does not matter.
    expect(contrast(WHITE, 'oklch(0.55 0.2 35)')).toBeCloseTo(
      contrast('oklch(0.55 0.2 35)', WHITE),
      10,
    );
  });

  it('knows the pale palettes are pale', () => {
    // Pongal's turmeric under white text, before anything is done to it.
    const pongal = FESTIVALS.find((festival) => festival.id === 'pongal')!;
    expect(contrast(WHITE, pongal.accent[0])).toBeLessThan(4.5);
  });

  for (const festival of FESTIVALS) {
    describe(festival.label, () => {
      const safe = legible(festival);

      it('carries white button text, and reads as a link on its wash, in light mode', () => {
        expect(contrast(WHITE, safe.accent[0])).toBeGreaterThanOrEqual(4.5);
        expect(contrast(safe.accent[0], safe.wash[0])).toBeGreaterThanOrEqual(4.5);
        expect(contrast(safe.ribbon[0], safe.wash[0])).toBeGreaterThanOrEqual(3);
      });

      it('needs nothing done to it in dark mode', () => {
        expect(safe.accent[1]).toBe(festival.accent[1]);
        expect(safe.ribbon[1]).toBe(festival.ribbon[1]);
        expect(contrast(DARK_ACCENT_INK, safe.accent[1])).toBeGreaterThanOrEqual(4.5);
        expect(contrast(safe.accent[1], safe.wash[1])).toBeGreaterThanOrEqual(4.5);
        expect(contrast(safe.ribbon[1], safe.wash[1])).toBeGreaterThanOrEqual(3);
      });

      it('keeps its hue: only the lightness moves', () => {
        const hueAndChroma = (color: string) => color.replace(/oklch\([\d.]+ /, '');
        expect(hueAndChroma(safe.accent[0])).toBe(hueAndChroma(festival.accent[0]));
        expect(hueAndChroma(safe.ribbon[0])).toBe(hueAndChroma(festival.ribbon[0]));
        expect(safe.wash).toEqual(festival.wash);
      });
    });
  }

  it('leaves a palette that already passes exactly as it was', () => {
    const christmas = FESTIVALS.find((festival) => festival.id === 'christmas')!;
    expect(legible(christmas).accent).toEqual(christmas.accent);
  });
});
