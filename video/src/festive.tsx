import { interpolate, random, useCurrentFrame, Easing } from 'remotion';
import { sec } from './theme';

/**
 * The app's own festive dressing, redrawn for the video.
 *
 * Compences is not a generic SaaS product with a green accent; it re-points its
 * whole palette per festival and draws a kolam and a toran on every event
 * page. The first cut of this video used plain headers and rendered the entire
 * app in its default green, which is the product with its clothes off.
 *
 * The geometry below is `apps/web/src/components/festival.tsx`, ported rather
 * than reinvented: Tailwind classes become explicit colours, because Remotion
 * renders plain React and has no `--accent` to re-point. Keep the two in step.
 */

/** Ganesh Chaturthi, from packages/core/src/festivals.ts. Light-mode values. */
export const festive = {
  accent: 'oklch(0.6 0.17 62)',
  ribbon: 'oklch(0.52 0.19 20)',
  wash: 'oklch(0.975 0.028 68)',
  deep: 'oklch(0.26 0.06 58)',
  petals: 14,
} as const;

/**
 * A kolam drawn from the festival's petal count: a centre, a ring of petals,
 * an outer ring offset by half a step, and the dots the pattern is laid out
 * around. Turns very slowly, because a still one reads as a watermark.
 */
export function Rangoli({
  petals = festive.petals,
  size,
  accent = festive.accent,
  ribbon = festive.ribbon,
  opacity = 1,
  spin = 0,
  strokeWidth = 1.5,
  dots = true,
}: {
  petals?: number;
  size: number;
  accent?: string;
  ribbon?: string;
  opacity?: number;
  /** Degrees turned over the scene. */
  spin?: number;
  strokeWidth?: number;
  /**
   * The ring of dots the kolam is laid out around. Drawn a frame and a half
   * across, as the covers draw it, each dot is the size of a coin and reads as
   * a smudge rather than as part of a pattern.
   */
  dots?: boolean;
}) {
  const step = (Math.PI * 2) / petals;
  const petal = (index: number, radius: number, length: number, width: number) => {
    const angle = index * step;
    const tip = [
      50 + Math.cos(angle) * (radius + length),
      50 + Math.sin(angle) * (radius + length),
    ];
    const base = [50 + Math.cos(angle) * radius, 50 + Math.sin(angle) * radius];
    const left = angle - width;
    const right = angle + width;
    const mid = radius + length * 0.55;
    return [
      `M ${base[0].toFixed(2)} ${base[1].toFixed(2)}`,
      `Q ${(50 + Math.cos(left) * mid).toFixed(2)} ${(50 + Math.sin(left) * mid).toFixed(2)}`,
      `${tip[0].toFixed(2)} ${tip[1].toFixed(2)}`,
      `Q ${(50 + Math.cos(right) * mid).toFixed(2)} ${(50 + Math.sin(right) * mid).toFixed(2)}`,
      `${base[0].toFixed(2)} ${base[1].toFixed(2)}`,
      'Z',
    ].join(' ');
  };
  const ring = Array.from({ length: petals }, (_, index) => index);

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      fill="none"
      strokeWidth={strokeWidth}
      style={{ opacity, transform: `rotate(${spin}deg)` }}
    >
      <circle cx="50" cy="50" r="7" stroke={accent} />
      <circle cx="50" cy="50" r="2.5" fill={accent} />
      {ring.map((index) => (
        <path key={`i${index}`} d={petal(index, 8, 13, step * 0.34)} stroke={accent} />
      ))}
      {ring.map((index) => (
        <path key={`o${index}`} d={petal(index + 0.5, 23, 17, step * 0.3)} stroke={ribbon} />
      ))}
      {(dots ? ring : []).map((index) => {
        const angle = index * step;
        return (
          <circle
            key={`d${index}`}
            cx={(50 + Math.cos(angle) * 44).toFixed(2)}
            cy={(50 + Math.sin(angle) * 44).toFixed(2)}
            r="1.6"
            fill={ribbon}
          />
        );
      })}
    </svg>
  );
}

/** The toran over a doorway: mango leaves on a string, a marigold between. */
export function Toran({
  width,
  accent = festive.accent,
  ribbon = festive.ribbon,
  opacity = 1,
  scale = 2.4,
}: {
  width: number;
  accent?: string;
  ribbon?: string;
  opacity?: number;
  /**
   * The app draws this tile at 48px across a phone. At 1920 that is forty
   * repeats of a 3px marigold, which reads as a dotted line rather than as a
   * toran — so the video draws the same tile larger.
   */
  scale?: number;
}) {
  const tile = 48 * scale;
  const count = Math.ceil(width / tile) + 1;
  return (
    <svg width={width} height={16 * scale} style={{ opacity }}>
      {Array.from({ length: count }, (_, index) => (
        <g key={index} transform={`translate(${index * tile} 0) scale(${scale} ${scale * 1.15})`}>
          <path d="M0 2 Q 12 6 24 2 Q 36 6 48 2" stroke={ribbon} fill="none" strokeWidth="1" />
          <path d="M8 3 Q 5 8 8 12 Q 11 8 8 3 Z" fill={accent} />
          <path d="M40 3 Q 37 8 40 12 Q 43 8 40 3 Z" fill={accent} />
          <circle cx="24" cy="6.5" r="3" fill={ribbon} />
          <circle cx="24" cy="6.5" r="1.2" fill={accent} />
        </g>
      ))}
    </svg>
  );
}

/**
 * Marigold petals drifting down, the way they do off a toran all day.
 *
 * Seeded from `random()` so every render of a frame is identical — Remotion
 * renders frames out of order and across processes, and `Math.random()` would
 * make the petals jump.
 */
export function Petals({ hold, count = 18 }: { hold: number; count?: number }) {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {Array.from({ length: count }, (_, index) => {
        const seed = `petal-${index}`;
        const x = random(`${seed}-x`) * 100;
        const drift = (random(`${seed}-d`) - 0.5) * 140;
        const size = 9 + random(`${seed}-s`) * 13;
        const delay = random(`${seed}-t`) * hold;
        const life = sec(5) + random(`${seed}-l`) * sec(4);
        const spin = random(`${seed}-r`) * 360;
        const progress = ((frame - delay) % life) / life;
        if (frame < delay) return null;
        const y = interpolate(progress, [0, 1], [-12, 112]);
        // Fade in and out at the ends so nothing pops into or out of existence.
        const fade = Math.min(1, progress / 0.12, (1 - progress) / 0.18);
        return (
          <div
            key={seed}
            style={{
              position: 'absolute',
              left: `${x}%`,
              top: `${y}%`,
              width: size,
              height: size,
              opacity: fade * 0.5,
              transform: `translateX(${drift * progress}px) rotate(${spin + progress * 260}deg)`,
              borderRadius: '50% 50% 50% 0',
              background: `linear-gradient(140deg, ${festive.accent}, ${festive.ribbon})`,
            }}
          />
        );
      })}
    </div>
  );
}

/** A lamp that catches, then settles into a slow flicker. */
export function Diya({ size = 120, lit = 0 }: { size?: number; lit?: number }) {
  const frame = useCurrentFrame();
  const flicker = 0.88 + Math.sin(frame / 5.5) * 0.06 + Math.sin(frame / 2.3) * 0.04;
  const glow = interpolate(frame, [lit, lit + sec(0.8)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <defs>
        <radialGradient id="diya-glow">
          <stop offset="0%" stopColor={festive.accent} stopOpacity="0.55" />
          <stop offset="100%" stopColor={festive.accent} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="42" r={34 * glow * flicker} fill="url(#diya-glow)" />
      {/* The flame, drawn as a teardrop rather than a triangle. */}
      <path
        d="M50 22 Q 58 34 57 41 Q 56 50 50 50 Q 44 50 43 41 Q 42 34 50 22 Z"
        fill={festive.accent}
        style={{ opacity: glow, transform: `scaleY(${flicker})`, transformOrigin: '50px 50px' }}
      />
      <path
        d="M50 33 Q 54 40 53 44 Q 52 48 50 48 Q 48 48 47 44 Q 46 40 50 33 Z"
        fill="oklch(0.95 0.11 92)"
        style={{ opacity: glow }}
      />
      {/* The lamp itself. */}
      <path d="M26 52 Q 50 76 74 52 Q 50 60 26 52 Z" fill={festive.ribbon} />
      <path d="M26 52 Q 50 58 74 52" stroke={festive.deep} strokeWidth="1.5" fill="none" />
    </svg>
  );
}
