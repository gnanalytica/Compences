/**
 * Gnanalytica's mark, split into the two layers the closing sting animates.
 *
 * The logo arrives as one flat PNG on white — `brand/gnanalytica-logo.png`,
 * exactly as supplied, and the only source of truth here. The sting needs it
 * as two separate pieces: the navy loop, which is what the Compences mark flows
 * into, and the red rise, which grows out of it afterwards. It also needs both
 * on transparent ground, because the sting begins on the festive dark and a
 * white rectangle would show.
 *
 * Every pixel is some coverage of one of two inks over white, so its alpha is
 * that coverage, read on the channel where that ink sits furthest from white:
 * red for the navy (255 → 12), green for the red (255 → 39). The colour is
 * then the ink itself. That keeps the interior fully opaque, which a generic
 * colour-to-alpha does not — it would leave the navy at 95%, and the festive
 * ground would show faintly through the logo.
 *
 * Both layers are cropped to the same box, so stacked they are the original.
 *
 *   npm run brand
 */
import { createRequire } from 'node:module';
import { execFile } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const ffmpeg = createRequire(import.meta.url)('ffmpeg-static');
const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = join(HERE, 'gnanalytica-logo.png');
const OUT = join(HERE, '..', 'public', 'brand');

/** The two inks, measured as the median of their unambiguous pixels. */
export const INK = { navy: [12, 56, 82], red: [216, 39, 43] };

async function decode(file) {
  const said = await run(ffmpeg, ['-i', file]).then(
    (ok) => ok.stderr,
    (error) => error.stderr ?? '',
  );
  const size = /, (\d+)x(\d+)[, ]/.exec(said);
  if (!size) throw new Error(`ffmpeg would not say how big ${file} is`);
  const width = Number(size[1]);
  const height = Number(size[2]);
  const { stdout } = await run(
    ffmpeg,
    ['-loglevel', 'error', '-i', file, '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'],
    { encoding: 'buffer', maxBuffer: width * height * 4 + 1024 },
  );
  return { width, height, pixels: stdout };
}

async function encode(file, width, height, pixels) {
  await new Promise((resolve, reject) => {
    const child = execFile(
      ffmpeg,
      [
        '-loglevel',
        'error',
        '-f',
        'rawvideo',
        '-pix_fmt',
        'rgba',
        '-s',
        `${width}x${height}`,
        '-i',
        '-',
        '-frames:v',
        '1',
        '-y',
        file,
      ],
      (error) => (error ? reject(error) : resolve()),
    );
    child.stdin.end(pixels);
  });
}

const { width, height, pixels } = await decode(SOURCE);
const loop = Buffer.alloc(width * height * 4);
const rise = Buffer.alloc(width * height * 4);
const box = { left: width, top: height, right: 0, bottom: 0 };

for (let i = 0; i < width * height; i += 1) {
  const r = pixels[i * 4];
  const g = pixels[i * 4 + 1];
  const b = pixels[i * 4 + 2];
  // Which ink this pixel is a coverage of. Red is the only warm one.
  const reddish = r - b > 40 && r - g > 40;
  const coverage = reddish ? (255 - g) / (255 - INK.red[1]) : (255 - r) / (255 - INK.navy[0]);
  const alpha = Math.max(0, Math.min(1, coverage));
  // Below this it is compression noise in the white, not ink.
  if (alpha < 0.03) continue;
  const into = reddish ? rise : loop;
  const ink = reddish ? INK.red : INK.navy;
  into[i * 4] = ink[0];
  into[i * 4 + 1] = ink[1];
  into[i * 4 + 2] = ink[2];
  into[i * 4 + 3] = Math.round(alpha * 255);
  const x = i % width;
  const y = Math.floor(i / width);
  box.left = Math.min(box.left, x);
  box.top = Math.min(box.top, y);
  box.right = Math.max(box.right, x);
  box.bottom = Math.max(box.bottom, y);
}

const PAD = 12;
const left = Math.max(0, box.left - PAD);
const top = Math.max(0, box.top - PAD);
const cropW = Math.min(width, box.right + PAD + 1) - left;
const cropH = Math.min(height, box.bottom + PAD + 1) - top;

function crop(layer) {
  const out = Buffer.alloc(cropW * cropH * 4);
  for (let y = 0; y < cropH; y += 1) {
    layer.copy(
      out,
      y * cropW * 4,
      ((top + y) * width + left) * 4,
      ((top + y) * width + left + cropW) * 4,
    );
  }
  return out;
}

await encode(join(OUT, 'gnanalytica-loop.png'), cropW, cropH, crop(loop));
await encode(join(OUT, 'gnanalytica-rise.png'), cropW, cropH, crop(rise));
console.log(
  `\x1b[36m▸\x1b[0m split ${width}x${height} → ${cropW}x${cropH} at (${left}, ${top}) → public/brand/gnanalytica-{loop,rise}.png`,
);
