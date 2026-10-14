import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * What a shared link unfurls into.
 *
 * Compences's links travel on WhatsApp, and WhatsApp builds a preview from the
 * page's og:image — the video's cover with its play button, made by
 * `npm run share` in video/. WhatsApp quietly drops a preview whose image is
 * over about 300 KB, so a re-render that grew the file would leave every
 * shared link a bare line of text, and nothing else would notice.
 */
const APP = join(import.meta.dirname, '..', 'src', 'app');
const image = join(APP, 'opengraph-image.jpg');

/** Width and height from a JPEG's start-of-frame marker. */
function jpegSize(file: string) {
  const bytes = readFileSync(file);
  expect(bytes.readUInt16BE(0), `${file} is not a JPEG`).toBe(0xffd8);
  let at = 2;
  while (at < bytes.length) {
    const marker = bytes.readUInt16BE(at);
    const length = bytes.readUInt16BE(at + 2);
    // SOF0 to SOF3: baseline, extended, progressive, lossless.
    if (marker >= 0xffc0 && marker <= 0xffc3) {
      return { height: bytes.readUInt16BE(at + 5), width: bytes.readUInt16BE(at + 7) };
    }
    at += 2 + length;
  }
  throw new Error(`${file} has no frame header`);
}

describe('the link preview', () => {
  it('is an image WhatsApp will show', () => {
    expect(existsSync(image)).toBe(true);
    expect(jpegSize(image)).toEqual({ width: 1200, height: 630 });
    expect(statSync(image).size).toBeLessThan(300 * 1024);
  });

  it('describes itself to somebody who cannot see it', () => {
    const alt = readFileSync(join(APP, 'opengraph-image.alt.txt'), 'utf8').trim();
    expect(alt.length).toBeGreaterThan(20);
    expect(alt).toMatch(/video/);
  });

  it('is served at an absolute URL', () => {
    // An og:image has to be absolute, and without a metadataBase Next guesses
    // one — on a preview deployment, sometimes localhost.
    expect(readFileSync(join(APP, 'layout.tsx'), 'utf8')).toMatch(/metadataBase: new URL\(/);
  });
});
