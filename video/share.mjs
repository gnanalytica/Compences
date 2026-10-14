/**
 * Makes what gets shared: the copies of the two animated cuts that go into
 * WhatsApp, their thumbnails, and the website's link preview.
 *
 * WhatsApp settles two things about a forwarded video before anybody presses
 * play, and the renders got both wrong:
 *
 * - Whether it is a video at all. Past 16 MB WhatsApp will not send a file as
 *   a video; it goes as a document — a file icon and a name, no picture and
 *   no play button. The full renders are 28 MB and 46 MB.
 *
 * - What it looks like. The thumbnail is the first frame, and both cuts open
 *   on the title card fading up out of the ground, so the first frame was an
 *   empty brown rectangle.
 *
 * So each copy opens on its cover (src/cover.tsx) for a moment, dissolves into
 * the cut, and is encoded at 720p to a size WhatsApp takes as a video. H.264
 * Main and AAC, because that is what plays on every phone in a group chat.
 * WhatsApp draws its own play button and the length over the thumbnail, so
 * these covers carry neither; the thumbnails and the link preview, which
 * nothing draws over, carry both.
 *
 *   npm run share        (after npm run render:phone and render:explain)
 */
import { createRequire } from 'node:module';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, rm, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const ffmpeg = createRequire(import.meta.url)('ffmpeg-static');

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'out');
const REMOTION = join(HERE, 'node_modules', '.bin', 'remotion');
/** The headless shell the render scripts use, where there is one. */
const SHELL = '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const BROWSER = existsSync(SHELL) ? [`--browser-executable=${SHELL}`] : [];
/** Served by Next as the og:image of every page; see app/opengraph-image.alt.txt. */
const LINK_PREVIEW = join(HERE, '..', 'apps', 'web', 'src', 'app', 'opengraph-image.jpg');

/**
 * Under WhatsApp's 16 MB with room to spare, whichever way it counts a
 * megabyte, and whatever the encoder's second pass overshoots by.
 */
const MAX_BYTES = 14_500_000;
const AUDIO_KBPS = 96;
/** How long the cover holds, and the dissolve from it into the cut. */
const HOLD = 1.3;
const DISSOLVE = 0.5;

const log = (message) => console.log(`\x1b[36m▸\x1b[0m ${message}`);
const mb = (bytes) => `${(bytes / 1_000_000).toFixed(2)} MB`;

const CUTS = [
  {
    name: 'phone',
    source: 'compences-phone.mp4',
    render: 'render:phone',
    cover: 'CoverPhone',
    size: [720, 1280],
  },
  {
    name: 'explain',
    source: 'compences-explain.mp4',
    render: 'render:explain',
    cover: 'CoverWide',
    size: [1280, 720],
  },
];

async function still(id, file, { play, scale = 1, jpeg = false }) {
  await run(
    REMOTION,
    [
      'still',
      'src/index.ts',
      id,
      file,
      `--props=${JSON.stringify({ play })}`,
      `--scale=${scale}`,
      ...(jpeg ? ['--image-format=jpeg', '--jpeg-quality=88'] : []),
      '--log=error',
      ...BROWSER,
    ],
    { cwd: HERE },
  );
}

/** How long a file runs, from ffmpeg's own header dump (see landing.mjs). */
async function seconds(file) {
  const said = await run(ffmpeg, ['-i', file]).then(
    (ok) => ok.stderr,
    (error) => error.stderr ?? '',
  );
  const found = /Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/.exec(said);
  if (!found) throw new Error(`ffmpeg would not say how long ${file} is`);
  return Number(found[1]) * 3600 + Number(found[2]) * 60 + Number(found[3]);
}

await mkdir(OUT, { recursive: true });
for (const cut of CUTS) {
  await stat(join(OUT, cut.source)).catch(() => {
    throw new Error(`out/${cut.source} is missing — run: npm run ${cut.render}`);
  });
}

// ---------------------------------------------------------------------------
// Covers and thumbnails
// ---------------------------------------------------------------------------
for (const cut of CUTS) {
  await still(cut.cover, join(OUT, `cover-${cut.name}.png`), { play: false });
}
await still('CoverPhone', join(OUT, 'compences-thumbnail-portrait.jpg'), {
  play: true,
  jpeg: true,
});
// 1280×720, the size YouTube and most players ask a thumbnail to be.
await still('CoverWide', join(OUT, 'compences-thumbnail.jpg'), {
  play: true,
  scale: 2 / 3,
  jpeg: true,
});
await still('CoverLink', LINK_PREVIEW, { play: true, jpeg: true });
log(`thumbnails → out/compences-thumbnail.jpg, out/compences-thumbnail-portrait.jpg`);
log(`link preview → apps/web/src/app/opengraph-image.jpg (${mb((await stat(LINK_PREVIEW)).size)})`);

// ---------------------------------------------------------------------------
// The WhatsApp copies
// ---------------------------------------------------------------------------
for (const cut of CUTS) {
  const source = join(OUT, cut.source);
  const cover = join(OUT, `cover-${cut.name}.png`);
  const target = join(OUT, `compences-${cut.name}-whatsapp.mp4`);
  const [width, height] = cut.size;

  const start = HOLD - DISSOLVE;
  const length = HOLD + (await seconds(source));
  // Leave a tenth for the container and for the second pass overshooting.
  const videoKbps = Math.floor(((MAX_BYTES * 8) / 1000 / length - AUDIO_KBPS) * 0.9);
  log(`${cut.name}: ${videoKbps}k video + ${AUDIO_KBPS}k audio over ${length.toFixed(1)}s`);

  // The cover and the cut meet as the same size, rate and pixel format, both
  // converted to BT.709 at TV range — the cut from the full-range BT.601 that
  // Remotion encodes, the cover from RGB — so the dissolve does not shift.
  const fit = `scale=${width}:${height}:flags=lanczos`;
  const picture = [
    `[0:v]${fit}:out_color_matrix=bt709:out_range=tv,format=yuv420p,setsar=1,fps=30,settb=AVTB[cover]`,
    // The dissolve lands on the cut's first frame, held for as long as the
    // dissolve takes: the bare ground the title then rises out of. Landing on
    // the title already rising crossed two sets of words for half a second.
    `[1:v]tpad=start_duration=${DISSOLVE}:start_mode=clone,${fit}:in_color_matrix=bt601:in_range=pc:out_color_matrix=bt709:out_range=tv,format=yuv420p,setsar=1,fps=30,settb=AVTB[cut]`,
    `[cover][cut]xfade=transition=fade:duration=${DISSOLVE}:offset=${start}[v]`,
  ];
  // The sound starts with the cut, once the cover has gone. The first pass has
  // no sound, and a graph with an output nothing takes is an error, so only the
  // second pass carries this part.
  const sound = `[1:a]adelay=${Math.round(HOLD * 1000)}:all=1[a]`;

  const inputs = [
    '-loglevel',
    'error',
    '-loop',
    '1',
    '-framerate',
    '30',
    '-t',
    String(HOLD),
    '-i',
    cover,
    '-i',
    source,
  ];
  const video = [
    '-map',
    '[v]',
    '-c:v',
    'libx264',
    '-profile:v',
    'main',
    '-pix_fmt',
    'yuv420p',
    '-colorspace',
    'bt709',
    '-color_primaries',
    'bt709',
    '-color_trc',
    'bt709',
    '-color_range',
    'tv',
    '-b:v',
    `${videoKbps}k`,
    '-preset',
    'slow',
  ];
  const passLog = join(OUT, `share-${cut.name}-pass`);
  await run(ffmpeg, [
    ...inputs,
    '-filter_complex',
    picture.join(';'),
    ...video,
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
    ...inputs,
    '-filter_complex',
    [...picture, sound].join(';'),
    ...video,
    '-map',
    '[a]',
    '-pass',
    '2',
    '-passlogfile',
    passLog,
    '-c:a',
    'aac',
    '-b:a',
    `${AUDIO_KBPS}k`,
    '-ac',
    '2',
    '-movflags',
    '+faststart',
    '-y',
    target,
  ]);
  await rm(`${passLog}-0.log`, { force: true });
  await rm(`${passLog}-0.log.mbtree`, { force: true });

  const bytes = (await stat(target)).size;
  if (bytes >= 16_000_000) {
    throw new Error(
      `out/compences-${cut.name}-whatsapp.mp4 is ${mb(bytes)}; WhatsApp sends that as a document`,
    );
  }
  log(`${cut.name} → out/compences-${cut.name}-whatsapp.mp4 (${mb(bytes)})`);
}
