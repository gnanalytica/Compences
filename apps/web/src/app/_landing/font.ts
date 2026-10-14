import { Baloo_2 } from 'next/font/google';

/**
 * The front page's display face: Baloo 2, round and warm, for headlines and the
 * big numbers only — the app's own text stays in the system face. It carries
 * Devanagari as well as Latin, so "समुदाय" is drawn in the same hand as
 * "Compences" rather than falling back to whatever the phone has.
 *
 * Self-hosted by next/font at build time, so a visitor's browser never asks
 * Google for it. Exposed as --font-baloo, which `font-display` reads
 * (globals.css), on the landing page's root element only.
 */
export const display = Baloo_2({
  subsets: ['latin', 'devanagari'],
  variable: '--font-baloo',
  display: 'swap',
});
