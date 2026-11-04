#!/usr/bin/env node
/**
 * Renders every icon the apps ship from one drawing, docs/brand/compences-mark.svg:
 *
 *   apps/mobile/assets/icon.png                     1024, on navy (iOS rounds it)
 *   apps/mobile/assets/android-icon-foreground.png  1024, transparent, inside the adaptive safe zone
 *   apps/mobile/assets/android-icon-background.png  1024, navy
 *   apps/mobile/assets/android-icon-monochrome.png   432, white silhouette for themed icons
 *   apps/mobile/assets/splash-icon.png              1024, transparent (app.json paints the navy)
 *   apps/mobile/assets/favicon.png                    48, on navy
 *   apps/web/src/app/favicon.ico                16/32/48, on navy
 *   docs/store/play-icon-512.png                     512, on navy
 *   apps/web/src/app/icon.png                        256, on navy
 *   apps/web/src/app/apple-icon.png                  180, on navy
 *   apps/web/src/components/brand-mark.png           128, on navy (the site's header mark)
 *
 * Change the SVG, run this, commit what it writes. It drives the Chromium that
 * Playwright installs, so it needs `playwright` resolvable (it is not a
 * workspace dependency), and uses the sharp that apps/web already has:
 *
 *   NODE_PATH="$(npm root -g)" node scripts/render-brand.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
// Next.js already installs sharp; borrowed to drop the alpha channel.
const sharp = createRequire(
  join(dirname(fileURLToPath(import.meta.url)), '../apps/web/package.json'),
)('sharp');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = readFileSync(join(ROOT, 'docs/brand/compences-mark.svg'), 'utf8');

/** The navy the mark sits on, a touch lighter in the middle as in the renders. */
const NAVY = { centre: '#16306B', edge: '#0A1736' };

/**
 * The mark's own box is not centred in its 1024 viewBox — the C reaches
 * further left than the wallet tab reaches right — so every render nudges it.
 */
const NUDGE_X = 19;

/** A themed-icon silhouette: every shape white, the rupee cut out of the tab. */
function monochrome(svg) {
  return svg
    .replace(/fill="url\(#[^)]+\)"/g, 'fill="#FFFFFF"')
    .replace('stroke="#FFFFFF"', 'stroke="#000000"');
}

const JOBS = [
  { out: 'apps/mobile/assets/icon.png', size: 1024, scale: 1.0, background: true },
  { out: 'apps/mobile/assets/android-icon-foreground.png', size: 1024, scale: 0.74 },
  { out: 'apps/mobile/assets/android-icon-background.png', size: 1024, scale: 0, background: true },
  { out: 'apps/mobile/assets/android-icon-monochrome.png', size: 432, scale: 0.74, mono: true },
  { out: 'apps/mobile/assets/splash-icon.png', size: 1024, scale: 1.0 },
  { out: 'apps/mobile/assets/favicon.png', size: 48, scale: 1.2, background: true },
  { out: 'docs/store/play-icon-512.png', size: 512, scale: 1.0, background: true },
  { out: 'apps/web/src/app/icon.png', size: 256, scale: 1.0, background: true },
  { out: 'apps/web/src/app/apple-icon.png', size: 180, scale: 1.0, background: true },
  { out: 'apps/web/src/components/brand-mark.png', size: 128, scale: 1.0, background: true },
  { ico: 'apps/web/src/app/favicon.ico', sizes: [16, 32, 48], scale: 1.2, background: true },
];

/**
 * Draws the SVG onto a canvas in the page and hands back PNG bytes. A canvas
 * rather than a screenshot so a transparent icon is really transparent, and so
 * the silhouette's black rupee can be turned into a hole.
 */
async function render(page, { size, scale, background, mono, keepAlpha }) {
  const svg = mono ? monochrome(SOURCE) : SOURCE;
  const dataUrl = await page.evaluate(
    async ({ svg, size, scale, background, mono, navy, nudge }) => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (background) {
        const g = ctx.createRadialGradient(
          size / 2,
          size * 0.45,
          0,
          size / 2,
          size / 2,
          size * 0.75,
        );
        g.addColorStop(0, navy.centre);
        g.addColorStop(1, navy.edge);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, size, size);
      }
      if (scale > 0) {
        const image = new Image();
        image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
        await image.decode();
        const drawn = size * scale;
        const offset = (size - drawn) / 2;
        ctx.drawImage(image, offset + (nudge / 1024) * drawn, offset, drawn, drawn);
      }
      if (mono) {
        // Dark pixels (the rupee) become see-through; the rest stays white.
        const pixels = ctx.getImageData(0, 0, size, size);
        const d = pixels.data;
        for (let i = 0; i < d.length; i += 4) {
          const light = (d[i] + d[i + 1] + d[i + 2]) / 765;
          d[i + 3] = Math.round(d[i + 3] * light);
          d[i] = d[i + 1] = d[i + 2] = 255;
        }
        ctx.putImageData(pixels, 0, 0);
      }
      return canvas.toDataURL('image/png');
    },
    {
      svg,
      size,
      scale,
      background: Boolean(background),
      mono: Boolean(mono),
      navy: NAVY,
      nudge: NUDGE_X,
    },
  );
  const png = Buffer.from(dataUrl.split(',')[1], 'base64');
  // An icon on navy is opaque, and saying so matters: App Store Connect
  // refuses an app icon that carries an alpha channel at all. Inside an .ico
  // the opposite holds: Next.js's decoder accepts only RGBA PNGs there.
  return background && !keepAlpha ? sharp(png).removeAlpha().png().toBuffer() : png;
}

/** An .ico holding PNG images, which every browser since IE has read. */
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const entries = [];
  let offset = 6 + 16 * images.length;
  for (const { size, png } of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += png.length;
  }
  return Buffer.concat([header, ...entries, ...images.map((image) => image.png)]);
}

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (const job of JOBS) {
    if (job.ico) {
      const images = [];
      for (const size of job.sizes)
        images.push({ size, png: await render(page, { ...job, size, keepAlpha: true }) });
      writeFileSync(join(ROOT, job.ico), ico(images));
      console.log(`wrote ${job.ico}`);
    } else {
      writeFileSync(join(ROOT, job.out), await render(page, job));
      console.log(`wrote ${job.out}`);
    }
  }
} finally {
  await browser.close();
}
