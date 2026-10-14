import type { Festival } from '@compences/core';

/**
 * Just enough colour science to keep a festival's colours readable.
 *
 * The palettes in core were chosen by eye, and a few are pale in light mode:
 * Pongal's turmeric under white button text is 3.5:1 and Ganesh Chaturthi's
 * saffron is 4.1:1, against the 4.5:1 that text needs. Inside an event that
 * is one screen for one fortnight. On the front page, which wears whichever
 * festival is next, it would be the sign-up button for weeks at a time.
 *
 * So the page deepens a colour until it passes — same hue and chroma, lower
 * lightness — and leaves every colour that already passes exactly as it was.
 * Only the light-mode half changes; the dark-mode colours are all light enough
 * against the dark ink the app puts on them.
 */

type Oklch = readonly [lightness: number, chroma: number, hue: number];

function parse(color: string): Oklch {
  const match = /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/.exec(color);
  if (!match) throw new Error(`Expected an oklch() colour, got ${color}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

const format = ([lightness, chroma, hue]: Oklch) => `oklch(${lightness} ${chroma} ${hue})`;

/** WCAG relative luminance, by way of OKLab and linear sRGB. */
function luminance([lightness, chroma, hue]: Oklch) {
  const a = chroma * Math.cos((hue * Math.PI) / 180);
  const b = chroma * Math.sin((hue * Math.PI) / 180);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  // Out-of-gamut colours are clipped, as a screen would show them.
  const clip = (value: number) => Math.min(1, Math.max(0, value));
  const red = clip(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s);
  const green = clip(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s);
  const blue = clip(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

/** The WCAG contrast ratio between two oklch() colours, from 1 to 21. */
export function contrast(one: string, other: string) {
  const [light, dark] = [luminance(parse(one)), luminance(parse(other))].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/** Lower the lightness a hundredth at a time until `color` passes against all of `against`. */
function deepen(color: string, against: string[], ratio: number) {
  const [start, chroma, hue] = parse(color);
  let lightness = start;
  const fails = () =>
    against.some((other) => contrast(format([lightness, chroma, hue]), other) < ratio);
  while (lightness > 0.2 && fails()) lightness = Math.round(lightness * 100 - 1) / 100;
  return format([lightness, chroma, hue]);
}

export const WHITE = 'oklch(1 0 0)';

/**
 * The festival, with its light-mode colours deepened just enough to carry text.
 *
 * - The accent is button fill under white text, and link and heading colour on
 *   the festival's wash: 4.5:1 against both.
 * - The ribbon is the far end of a gradient headline and the outer petals:
 *   3:1 against the wash, which is what large text and graphics need.
 */
export function legible(festival: Festival): Festival {
  const [accent, accentDark] = festival.accent;
  const [ribbon, ribbonDark] = festival.ribbon;
  const wash = festival.wash[0];
  return {
    ...festival,
    accent: [deepen(accent, [WHITE, wash], 4.5), accentDark],
    ribbon: [deepen(ribbon, [wash], 3), ribbonDark],
  };
}
