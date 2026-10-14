/**
 * Makes the copy of the video that the landing page serves.
 *
 * The render is 1920×1080 at CRF 18, which is right for anything anybody
 * downloads and wrong for a hero that autoplays. This is the same cut at 720p,
 * encoded to a fixed bitrate rather than to a quality target.
 *
 * The bitrate is the point, and it used to be a total size. The page streams
 * this file as it plays — faststart puts the index up front, and preload is
 * "metadata" — so what decides whether a phone on mobile data can keep up is
 * how many bytes arrive per second of playback, not how many there are in all.
 * A two-megabyte cap stood in for that while the cut was twenty-five seconds.
 * Once every shot was paced to be readable, `Explain` ran past two minutes, and
 * two megabytes over two minutes is about thirty kilobits a second of video:
 * the captions the pacing exists for would have smeared into illegibility.
 *
 * So the rate is fixed and the size follows the length.
 * `apps/web/test/landing-demo.test.ts` caps the rate, and caps the size too,
 * loosely, so a cut that doubled again would still be a decision.
 *
 * The poster matters as much as the video. Without one the hero is a black
 * rectangle until enough has buffered to paint, which on a phone on mobile
 * data is most of the time somebody spends on the page.
 *
 *   npm run landing
 */
import { createRequire } from 'node:module';
import { execFile } from 'node:child_process';
import { mkdir, rm, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const ffmpeg = createRequire(import.meta.url)('ffmpeg-static');

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = join(HERE, 'out', 'compences-explain.mp4');
const PUBLIC = join(HERE, '..', 'apps', 'web', 'public');
const VIDEO = join(PUBLIC, 'compences-demo.mp4');
const POSTER = join(PUBLIC, 'compences-demo-poster.jpg');

/**
 * Home, with the fund counted up and the panel beside it filled in.
 *
 * The poster is what most visitors actually see — on a slow connection, and
 * for anybody who has asked their system for less motion, it is the whole
 * video — so it wants a frame that is both inviting and legible. The opening
 * card and the statement after it are neither: one is a logo and the other is
 * a sentence about a problem, and a still of either says nothing about what
 * the product is.
 */
const POSTER_AT = '6.2';

const log = (message) => console.log(`\x1b[36m▸\x1b[0m ${message}`);
const mb = (bytes) => `${(bytes / 1_048_576).toFixed(2)} MB`;

await stat(SOURCE).catch(() => {
  throw new Error(`${SOURCE} is missing — run: npm run render:explain`);
});
await mkdir(PUBLIC, { recursive: true });

/**
 * How long the source runs, read from ffmpeg itself.
 *
 * `ffmpeg -i` with no output writes the header to stderr and exits non-zero,
 * which execFile reports as an error carrying the output — so the rejection is
 * the success path here, and only a missing Duration line is a real failure.
 */
async function seconds(file) {
  const said = await run(ffmpeg, ['-i', file]).then(
    (ok) => ok.stderr,
    (error) => error.stderr ?? '',
  );
  const found = /Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/.exec(said);
  if (!found) throw new Error(`ffmpeg would not say how long ${file} is`);
  return Number(found[1]) * 3600 + Number(found[2]) * 60 + Number(found[3]);
}

/**
 * Legible at this rate: at forty seconds, 316k kept every amount on the ledger
 * readable, and the paced cut is mostly still frames, which cost almost
 * nothing. The test allows 450k in all.
 */
const VIDEO_KBPS = 300;
const AUDIO_KBPS = 64;

const length = await seconds(SOURCE);
log(`rate → ${VIDEO_KBPS}k video + ${AUDIO_KBPS}k audio over ${length.toFixed(1)}s`);

const shared = [
  '-loglevel',
  'error',
  '-i',
  SOURCE,
  '-vf',
  'scale=1280:720:flags=lanczos',
  '-c:v',
  'libx264',
  // Main profile and yuv420p, because High or yuv444 will not play on older
  // Android browsers, which is a large share of who this is for.
  '-profile:v',
  'main',
  '-pix_fmt',
  'yuv420p',
  '-b:v',
  `${VIDEO_KBPS}k`,
  '-preset',
  'slow',
];

// Two passes: the first learns where the bits are needed, the second spends
// them. One pass at this bitrate wastes most of it on the opening title card.
const passLog = join(HERE, 'out', 'landing-pass');
await run(ffmpeg, [
  ...shared,
  '-pass',
  '1',
  '-passlogfile',
  passLog,
  '-an',
  '-f',
  'mp4',
  '-y',
  '/dev/null',
]);
await run(ffmpeg, [
  ...shared,
  '-pass',
  '2',
  '-passlogfile',
  passLog,
  // Puts the index at the front, so the browser can start playing before the
  // whole file has arrived instead of after.
  '-movflags',
  '+faststart',
  '-c:a',
  'aac',
  '-b:a',
  `${AUDIO_KBPS}k`,
  '-ac',
  '2',
  '-y',
  VIDEO,
]);
await rm(`${passLog}-0.log`, { force: true });
await rm(`${passLog}-0.log.mbtree`, { force: true });
log(`video  → apps/web/public/compences-demo.mp4 (${mb((await stat(VIDEO)).size)})`);

await run(ffmpeg, [
  '-loglevel',
  'error',
  '-ss',
  POSTER_AT,
  '-i',
  SOURCE,
  '-frames:v',
  '1',
  '-vf',
  'scale=1280:720:flags=lanczos',
  '-q:v',
  '5',
  '-y',
  POSTER,
]);
log(`poster → apps/web/public/compences-demo-poster.jpg (${mb((await stat(POSTER)).size)})`);
