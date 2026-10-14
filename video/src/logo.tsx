import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { Petals, Rangoli, Toran, festive } from './festive';
import { displayFamily, fontFamily, sec } from './theme';

/**
 * The close: Compences's mark flows into Gnanalytica's.
 *
 * Gnanalytica's logo is an infinity — a navy loop with a red arrow and three
 * bars rising out of its right-hand lobe (`brand/gnanalytica-logo.png`, as
 * supplied). Compences had no logo at all, so its mark here is built from the
 * product's own motif: a kolam, a single line drawn around dots. The simplest
 * kolam is one line looped around two dots, and half of that loop, stood on
 * end, is an S.
 *
 * So the sting is one line doing three things. It is drawn as Compences's S,
 * around two dots, on the festive ground. It turns flat and closes, and the
 * two dots it was drawn around become the two lobes of an infinity. Then it is
 * Gnanalytica's loop — the ground has gone to white, because the navy was
 * designed for white and all but vanishes on the festive dark — and the red
 * rise grows out of it.
 *
 * The drawn loop has to land on the supplied artwork, not near it, or the
 * crossfade shows two loops. It is Bernoulli's lemniscate, scaled in y, fitted
 * to seventeen centreline points measured off the logo: 4.2 px RMS and 8.6 px
 * at worst, on a stroke 33 px wide, so the line never leaves the stroke it is
 * about to become.
 */

/** The supplied logo's crop, as `brand/split.mjs` writes it. Stage units are its pixels. */
const STAGE = { width: 564, height: 322 };
/** The fitted loop, in stage units. */
const LOOP = { cx: 281.25, cy: 187, a: 252.25, ys: 289.914, stroke: 33 };
/** The two inks, from brand/split.mjs. */
const NAVY = '#0c3852';

function lemniscate(t: number) {
  const d = 1 + Math.sin(t) ** 2;
  return {
    x: LOOP.cx + (LOOP.a * Math.cos(t)) / d,
    y: LOOP.cy - (LOOP.ys * Math.sin(t) * Math.cos(t)) / d,
  };
}

/**
 * The loop as one path, starting at its right-hand end.
 *
 * The first half by length — t from 0 to π — runs up over the right lobe,
 * through the crossing and down under the left one: turned a quarter clockwise
 * it is an S. That is why the S can simply keep drawing into the infinity.
 */
const PATH = (() => {
  const steps = 360;
  const points = Array.from({ length: steps + 1 }, (_, i) => lemniscate((i / steps) * Math.PI * 2));
  return points.map((p, i) => `${i ? 'L' : 'M'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
})();

/** Where the two kolam dots sit: the middles of the two lobes. */
const DOTS = [
  { x: LOOP.cx - LOOP.a * 0.56, y: LOOP.cy },
  { x: LOOP.cx + LOOP.a * 0.56, y: LOOP.cy },
];

type Layout = {
  /** Frame size. */
  width: number;
  height: number;
  /** Where the loop's crossing lands, and how big the finished mark is. */
  at: { x: number; y: number };
  scale: number;
  /** Where the S stands while it is still Compences's, and its wordmark. */
  sAt: { x: number; y: number };
  word: { x: number; y: number; align: 'center' | 'left'; size: number };
  /** The type under Gnanalytica's mark. */
  endType: { by: number; name: number; url: number; size: number };
};

export const STING_LAYOUT: Record<'portrait' | 'landscape', Layout> = {
  portrait: {
    width: 1080,
    height: 1920,
    at: { x: 540, y: 860 },
    scale: 1.55,
    sAt: { x: 540, y: 700 },
    word: { x: 540, y: 1060, align: 'center', size: 112 },
    endType: { by: 470, name: 1112, url: 1250, size: 96 },
  },
  landscape: {
    width: 1920,
    height: 1080,
    at: { x: 960, y: 452 },
    scale: 1.34,
    sAt: { x: 700, y: 520 },
    word: { x: 900, y: 520, align: 'left', size: 120 },
    endType: { by: 128, name: 668, url: 792, size: 88 },
  },
};

/** Durations, in seconds, from the start of the sting. */
const T = {
  draw: [0.15, 1.0],
  wordIn: [0.55, 1.15],
  wordOut: [2.05, 2.35],
  turn: [2.1, 3.3],
  dawn: [2.25, 3.35],
  dotsOut: [2.7, 3.2],
  comet: [3.3, 4.35],
  settle: [4.35, 4.7],
  rise: [4.55, 5.3],
  endIn: [5.1, 5.8],
} as const;

export const STING_SECONDS = 7.6;

export function LogoSting({ layout }: { layout: 'portrait' | 'landscape' }) {
  const frame = useCurrentFrame();
  const L = STING_LAYOUT[layout];
  const span = (window: readonly [number, number], easing = Easing.inOut(Easing.cubic)) =>
    interpolate(frame, [sec(window[0]), sec(window[1])], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing,
    });

  // --- the line -------------------------------------------------------------
  const drawn = 0.5 * span(T.draw, Easing.out(Easing.cubic)) + 0.5 * span(T.turn);
  const turn = span(T.turn);
  const rotation = 90 * (1 - turn);
  const scale = L.scale * (0.62 + 0.38 * turn);
  const x = L.sAt.x + (L.at.x - L.sAt.x) * turn;
  const y = L.sAt.y + (L.at.y - L.sAt.y) * turn;
  const navy = span([T.turn[0] + 0.1, T.turn[1] - 0.15]);
  const stroke = `color-mix(in oklab, ${NAVY} ${Math.round(navy * 100)}%, ${festive.accent})`;
  const dots = 1 - span(T.dotsOut);
  const comet = span(T.comet, Easing.inOut(Easing.sin));
  const cometOn = Math.min(
    span([T.comet[0], T.comet[0] + 0.15]),
    1 - span([T.comet[1] - 0.15, T.comet[1]]),
  );
  const settle = span(T.settle);
  const rise = span(T.rise, Easing.out(Easing.cubic));

  // --- the ground -------------------------------------------------------------
  const cover = interpolate(frame, [0, sec(0.42)], [0, 1], { extrapolateRight: 'clamp' });
  const dawn = span(T.dawn, Easing.inOut(Easing.quad));
  const reach = Math.hypot(L.width, L.height);

  // --- type ---------------------------------------------------------------------
  const word = Math.min(span(T.wordIn, Easing.out(Easing.cubic)), 1 - span(T.wordOut));
  const end = span(T.endIn, Easing.out(Easing.cubic));

  return (
    <AbsoluteFill style={{ opacity: cover, fontFamily }}>
      <AbsoluteFill style={{ backgroundColor: festive.deep }}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
          <Rangoli
            size={Math.max(L.width, L.height) * 0.72}
            opacity={0.1}
            spin={frame * 0.05}
            accent={festive.accent}
            ribbon={festive.accent}
            strokeWidth={0.6}
          />
        </AbsoluteFill>
        <Petals hold={sec(STING_SECONDS)} count={11} />
        <div style={{ position: 'absolute', inset: '0 0 auto 0', opacity: 0.85 }}>
          <Toran width={L.width} />
        </div>
      </AbsoluteFill>

      {/* Dawn: white, opening out from the loop's crossing with a soft
          leading edge — a hard one reads as a hole cut in the frame. */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at ${L.at.x}px ${L.at.y}px, #ffffff ${Math.max(0, reach * dawn - 220)}px, rgba(255,255,255,0) ${reach * dawn}px)`,
          opacity: dawn > 0 ? 1 : 0,
        }}
      />

      {/* Compences's wordmark, while the line is still an S. */}
      <div
        style={{
          position: 'absolute',
          left: L.word.align === 'center' ? 0 : L.word.x,
          right: L.word.align === 'center' ? 0 : undefined,
          top: L.word.y,
          textAlign: L.word.align,
          transform: `translateY(${L.word.align === 'center' ? '0' : '-50%'}) translateY(${(1 - word) * 14}px)`,
          opacity: word,
          color: 'white',
        }}
      >
        <div
          style={{
            fontFamily: displayFamily,
            fontSize: L.word.size,
            fontWeight: 600,
            letterSpacing: '-0.025em',
            lineHeight: 1,
          }}
        >
          Compences
        </div>
        <div
          style={{ fontSize: L.word.size * 0.36, marginTop: 22, color: 'rgba(255,255,255,0.82)' }}
        >
          Nothing hidden. Nothing to chase.
        </div>
      </div>

      {/* The stage: the line, the dots, and Gnanalytica's two layers, all in
          the supplied logo's own pixel space so they cannot drift apart. */}
      <div
        style={{
          position: 'absolute',
          left: x - LOOP.cx,
          top: y - LOOP.cy,
          width: STAGE.width,
          height: STAGE.height,
          transformOrigin: `${LOOP.cx}px ${LOOP.cy}px`,
          transform: `scale(${scale}) rotate(${rotation}deg)`,
        }}
      >
        <svg
          width={STAGE.width}
          height={STAGE.height}
          viewBox={`0 0 ${STAGE.width} ${STAGE.height}`}
          style={{ position: 'absolute', inset: 0, overflow: 'visible', opacity: 1 - settle }}
        >
          <path
            d={PATH}
            pathLength={1000}
            fill="none"
            stroke={stroke}
            strokeWidth={LOOP.stroke}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={`${drawn * 1000} 1000`}
          />
          {DOTS.map((dot) => (
            <circle
              key={dot.x}
              cx={dot.x}
              cy={dot.y}
              r={15}
              fill={festive.accent}
              opacity={dots * span(T.draw)}
              transform={`translate(${dot.x} ${dot.y}) scale(${0.4 + 0.6 * dots}) translate(${-dot.x} ${-dot.y})`}
            />
          ))}
          {/* Compences's marigold, flowing once round Gnanalytica's loop. */}
          <path
            d={PATH}
            pathLength={1000}
            fill="none"
            stroke={festive.accent}
            strokeWidth={LOOP.stroke * 0.62}
            strokeLinecap="round"
            strokeDasharray="90 910"
            strokeDashoffset={-comet * 1000}
            opacity={cometOn}
            style={{ filter: `drop-shadow(0 0 8px ${festive.accent})` }}
          />
        </svg>
        <Img
          src={staticFile('brand/gnanalytica-loop.png')}
          style={{
            position: 'absolute',
            inset: 0,
            width: STAGE.width,
            height: STAGE.height,
            opacity: settle,
          }}
        />
        {/* The rise grows from the crossing out to the arrow's tip. */}
        <Img
          src={staticFile('brand/gnanalytica-rise.png')}
          style={{
            position: 'absolute',
            inset: 0,
            width: STAGE.width,
            height: STAGE.height,
            maskImage: `linear-gradient(45deg, #000 ${rise * 112 - 6}%, transparent ${rise * 112}%)`,
            WebkitMaskImage: `linear-gradient(45deg, #000 ${rise * 112 - 6}%, transparent ${rise * 112}%)`,
          }}
        />
      </div>

      {/* Who made it, and where to find it. */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: L.endType.by,
          textAlign: 'center',
          fontSize: L.endType.size * 0.36,
          fontWeight: 600,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: 'rgba(12, 56, 82, 0.55)',
          opacity: end,
        }}
      >
        Compences is built by
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: L.endType.name,
          textAlign: 'center',
          fontSize: L.endType.size,
          fontWeight: 650,
          letterSpacing: '-0.03em',
          color: NAVY,
          opacity: end,
          transform: `translateY(${(1 - end) * 16}px)`,
        }}
      >
        Gnanalytica
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: L.endType.url,
          textAlign: 'center',
          fontSize: L.endType.size * 0.38,
          fontWeight: 600,
          color: '#d8272b',
          opacity: span([T.endIn[0] + 0.3, T.endIn[1] + 0.3]),
        }}
      >
        compences.com
      </div>
    </AbsoluteFill>
  );
}
