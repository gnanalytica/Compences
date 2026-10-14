import { TOKENS, heroGradient, oklchToHex, type Festival, type Tokens } from '@compences/core';

/**
 * The web app's tokens (core/design.ts), converted to the hex React Native can
 * read, so the two surfaces look like one product by construction rather than
 * by two people keeping two lists in step. Resolved per colour scheme, since
 * React Native has no CSS variables.
 */
export type Palette = { [Key in keyof Tokens]: string };

const toHex = (tokens: Tokens) =>
  Object.fromEntries(
    Object.entries(tokens).map(([key, value]) => [key, oklchToHex(value)]),
  ) as Palette;

export const palette: Record<'light' | 'dark', Palette> = {
  light: toHex(TOKENS.light),
  dark: toHex(TOKENS.dark),
};

/**
 * A festival's colours for one scheme, as hex: its accent and ribbon, the
 * wash to read text on, and the banner behind an event's title, glow to
 * deepest — the same banner in both schemes, like a printed one.
 */
export type LookColours = {
  accent: string;
  ribbon: string;
  wash: string;
  hero: readonly [string, string, string];
};

export function lookColours(festival: Festival, isDark: boolean): LookColours {
  const index = isDark ? 1 : 0;
  const [glow, middle, deep] = heroGradient(festival);
  return {
    accent: oklchToHex(festival.accent[index]),
    ribbon: oklchToHex(festival.ribbon[index]),
    wash: oklchToHex(festival.wash[index]),
    hero: [oklchToHex(glow), oklchToHex(middle), oklchToHex(deep)],
  };
}

/**
 * Fraunces, a soft serif, for what should feel like an occasion — a screen's
 * title, an event's name, an amount — and the platform's own face for
 * everything read at a glance. Loaded in the root layout; each weight is a
 * family of its own on a phone.
 */
export const fonts = {
  serif: 'Fraunces_500Medium',
  serifStrong: 'Fraunces_600SemiBold',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 10, md: 14, lg: 18, pill: 999 } as const;

/**
 * A card's lift off the page: a hairline and a long, soft shadow, warm in the
 * light and nearly black in the dark.
 */
export function cardShadow(isDark: boolean) {
  return {
    shadowColor: isDark ? '#000000' : '#3a2a14',
    shadowOpacity: isDark ? 0.5 : 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  } as const;
}

/**
 * The smallest a tappable thing may be, in points.
 *
 * Apple asks for 44, Android for 48dp, and WCAG 2.5.5 for 44 — so 44 is the
 * floor everything must clear, not the size everything should be. Button and
 * Input already sit above it at 48 and are left alone; this is for the smaller
 * controls, where a pill sized to its text ends up around 30 and a row around
 * 36. The pill keeps its looks: it is the target that grows, not the type.
 */
export const minTapTarget = 44;

/**
 * Extra touch area for a small inline link, without moving anything.
 *
 * A 13–14px link is about 16–18 points tall, and `hitSlop={8}` — the habit in
 * this codebase — only lifts it to the low thirties. Fourteen top and bottom
 * clears 44. Horizontal stays at 8: these links sit beside other controls, and
 * a wide slop would start swallowing taps meant for the neighbour.
 */
export const tapSlop = { top: 14, bottom: 14, left: 8, right: 8 } as const;
