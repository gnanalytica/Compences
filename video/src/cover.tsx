import type { CSSProperties } from 'react';
import { AbsoluteFill, Freeze, useVideoConfig } from 'remotion';
import { Diya, Rangoli, Toran, festive } from './festive';
import { BAR_H, BottomBar, MoneyScreen, RESIDENT, SCREEN, STATUS_H, StatusBar } from './screens';
import { timeline } from './story';
import { FPS, color, displayFamily, fontFamily, sec } from './theme';

/**
 * The cover: the frame a video is known by before anybody presses play.
 *
 * WhatsApp makes a forwarded video's thumbnail from its first frame, and so do
 * most places a video gets shared. Both animated cuts open on the title card
 * fading up out of the ground, so that first frame was an empty brown
 * rectangle — a thumbnail that said nothing about what the video was. This is
 * drawn for the job instead: what the product is for in one line, the product
 * itself on a phone, and its name.
 *
 * The phone shows Money rather than Home. "Fully accounted for" is a claim
 * about the ledger, and Money is the ledger: every rupee in with a name and a
 * flat beside it, every rupee out with its bill.
 *
 * `play` adds a play button, for the places that do not draw their own: a link
 * preview, a thumbnail on a page, a poster. WhatsApp draws one over a video's
 * thumbnail itself, so the copies of the videos that open on this cover leave
 * it off — two play buttons on one thumbnail read as a mistake.
 *
 * Every size is written for a 1080-pixel-tall landscape frame or a
 * 1920-pixel-tall portrait one, and scaled by `u` from the frame actually
 * being drawn, so one layout serves a 1920×1080 thumbnail and a 1200×630 link
 * preview alike.
 */

export type CoverProps = { play: boolean };

/** How long the video runs, as the badge under the play button says it. */
function duration() {
  const seconds = Math.round(timeline().length / FPS);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/**
 * The first line white, the second in marigold. The words are the video's
 * own opening statement, so the cover promises what the video then says.
 */
const HEADLINE = ['Festival funds,', 'fully accounted for.'];
const SUB = 'Who paid · who approved · where it went';
const SITE = 'compences.com';

const marigold: CSSProperties = {
  backgroundImage: 'linear-gradient(90deg, oklch(0.88 0.14 88), oklch(0.76 0.17 58))',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
};

// ---------------------------------------------------------------------------
// Parts
// ---------------------------------------------------------------------------

/** The festive ground from the video, with a lamp's glow where the phone is. */
function Ground({ glow, u }: { glow: { x: number; y: number }; u: number }) {
  const { width, height } = useVideoConfig();
  const across = Math.max(width, height);
  return (
    <AbsoluteFill style={{ backgroundColor: festive.deep, overflow: 'hidden' }}>
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(circle at ${glow.x}px ${glow.y}px, oklch(0.62 0.16 58 / 0.42), transparent ${across * 0.42}px)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: glow.x - across * 0.62,
          top: glow.y - across * 0.62,
        }}
      >
        <Rangoli
          size={across * 1.24}
          opacity={0.08}
          accent={festive.accent}
          ribbon={festive.accent}
          strokeWidth={0.6}
          dots={false}
        />
      </div>
      <Petals u={u} />
      <div style={{ position: 'absolute', inset: '0 0 auto 0', opacity: 0.85 }}>
        <Toran width={width} scale={2.4 * u} />
      </div>
    </AbsoluteFill>
  );
}

/**
 * A few marigold petals, placed rather than drifting: the video's petals move,
 * and a still of moving petals is petals in odd places.
 */
const PETALS = [
  { x: 0.05, y: 0.12, size: 22, turn: 20 },
  { x: 0.93, y: 0.16, size: 18, turn: 140 },
  { x: 0.12, y: 0.72, size: 15, turn: 250 },
  { x: 0.88, y: 0.47, size: 24, turn: 75 },
  { x: 0.03, y: 0.93, size: 19, turn: 190 },
  { x: 0.95, y: 0.8, size: 16, turn: 310 },
  { x: 0.3, y: 0.05, size: 13, turn: 45 },
];

function Petals({ u }: { u: number }) {
  return (
    <>
      {PETALS.map((petal) => (
        <div
          key={`${petal.x}-${petal.y}`}
          style={{
            position: 'absolute',
            left: `${petal.x * 100}%`,
            top: `${petal.y * 100}%`,
            width: petal.size * u,
            height: petal.size * u,
            opacity: 0.55,
            transform: `rotate(${petal.turn}deg)`,
            borderRadius: '50% 50% 50% 0',
            background: `linear-gradient(140deg, ${festive.accent}, ${festive.ribbon})`,
          }}
        />
      ))}
    </>
  );
}

/**
 * The lamp and the name, as the video's title card has them: side by side
 * beside the words of a wide cover, stacked above them on a tall one.
 */
function Brand({ u, stacked = false }: { u: number; stacked?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: stacked ? 'column' : 'row',
        alignItems: 'center',
        gap: stacked ? 0 : 10 * u,
        marginLeft: stacked ? 0 : -18 * u,
      }}
    >
      <Diya size={(stacked ? 150 : 104) * u} lit={-sec(2)} />
      <span
        style={{
          fontFamily: displayFamily,
          fontSize: 60 * u,
          fontWeight: 600,
          letterSpacing: '-0.025em',
          color: 'white',
          transform: `translateY(${(stacked ? -6 : 8) * u}px)`,
        }}
      >
        Compences
      </span>
    </div>
  );
}

/**
 * The handset with the Money screen in it, settled: the rows risen and the
 * totals counted up, as they are three seconds into the shot.
 */
function Handset({
  left,
  top,
  scale,
  u,
}: {
  left: number;
  top: number;
  /** Logical phone pixels → frame pixels. */
  scale: number;
  u: number;
}) {
  const bezel = 16 * u;
  const radius = 26 * scale;
  return (
    <div
      style={{
        position: 'absolute',
        left,
        top,
        width: SCREEN.width * scale + bezel * 2,
        height: SCREEN.height * scale + bezel * 2,
        padding: bezel,
        borderRadius: radius + bezel,
        backgroundColor: 'oklch(0.17 0.03 55)',
        boxShadow: [
          `0 ${40 * u}px ${110 * u}px rgba(0,0,0,0.55)`,
          '0 0 0 1px rgba(255,255,255,0.14)',
          `inset 0 0 0 ${2 * u}px rgba(255,255,255,0.06)`,
        ].join(', '),
      }}
    >
      <div
        style={{
          width: SCREEN.width * scale,
          height: SCREEN.height * scale,
          borderRadius: radius,
          overflow: 'hidden',
          backgroundColor: color.surface,
        }}
      >
        <div
          style={{
            position: 'relative',
            width: SCREEN.width,
            height: SCREEN.height,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        >
          <Freeze frame={sec(3)}>
            <MoneyScreen />
          </Freeze>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              fontFamily,
            }}
          >
            <div style={{ height: STATUS_H }}>
              <StatusBar />
            </div>
            <div style={{ height: BAR_H }}>
              <BottomBar tabs={RESIDENT} active="Money" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * A play button that reads on anything behind it: marigold into vermilion
 * with a white ring, so it holds on the phone's light screen and on the dark
 * ground alike. The length sits under it.
 */
function PlayButton({ x, y, size, u }: { x: number; y: number; size: number; u: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          backgroundImage: `linear-gradient(150deg, ${festive.accent}, ${festive.ribbon})`,
          border: `${size * 0.045}px solid white`,
          boxShadow: [
            `0 ${size * 0.1}px ${size * 0.34}px rgba(0,0,0,0.5)`,
            `0 0 0 ${size * 0.09}px rgba(255,255,255,0.22)`,
          ].join(', '),
        }}
      >
        {/* Nudged right: a triangle centred by its box looks left of centre. */}
        <svg
          width={size * 0.4}
          height={size * 0.4}
          viewBox="0 0 100 100"
          style={{ marginLeft: size * 0.07 }}
        >
          <path
            d="M20 10 L 90 50 L 20 90 Z"
            fill="white"
            stroke="white"
            strokeWidth="12"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div
        style={{
          marginTop: size * 0.2,
          padding: `${6 * u}px ${18 * u}px`,
          borderRadius: 999,
          backgroundColor: 'rgba(12, 6, 2, 0.78)',
          border: '1px solid rgba(255,255,255,0.16)',
          color: 'white',
          fontFamily,
          fontSize: 30 * u,
          fontWeight: 600,
          letterSpacing: '0.02em',
        }}
      >
        {duration()}
      </div>
    </div>
  );
}

function Headline({ size, align }: { size: number; align: 'center' | 'left' }) {
  return (
    <div
      style={{
        textAlign: align,
        fontFamily: displayFamily,
        fontSize: size,
        fontWeight: 700,
        lineHeight: 1.08,
        letterSpacing: '-0.025em',
        color: 'white',
      }}
    >
      <div>{HEADLINE[0]}</div>
      <div style={marigold}>{HEADLINE[1]}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The two shapes
// ---------------------------------------------------------------------------

/**
 * Portrait, 1080×1920: the words above, the phone rising out of the bottom.
 *
 * WhatsApp shows a tall video's thumbnail cropped towards its middle, so the
 * name, the headline and the top of the phone all sit inside the middle 4:5
 * of the frame, y 285 to 1635. Only the lamp above them may be cropped.
 */
export function PortraitCover({ play }: CoverProps) {
  const { width, height } = useVideoConfig();
  const u = height / 1920;
  const scale = 1.98 * u;
  const phoneWidth = SCREEN.width * scale + 32 * u;
  const phoneLeft = (width - phoneWidth) / 2;
  const phoneTop = 810 * u;
  return (
    <AbsoluteFill style={{ fontFamily }}>
      <Ground glow={{ x: width / 2, y: 1230 * u }} u={u} />
      <div
        style={{ position: 'absolute', left: 0, right: 0, top: 168 * u, padding: `0 ${64 * u}px` }}
      >
        <Brand u={u} stacked />
        <div style={{ marginTop: 34 * u }}>
          <Headline size={84 * u} align="center" />
        </div>
        <div
          style={{
            marginTop: 26 * u,
            textAlign: 'center',
            fontSize: 38 * u,
            fontWeight: 500,
            color: 'rgba(255,255,255,0.84)',
          }}
        >
          {SUB}
        </div>
      </div>
      <Handset left={phoneLeft} top={phoneTop} scale={scale} u={u} />
      {/* A little of the ground over the phone's foot, so it rises out of the
          frame rather than being cut off by it. */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 260 * u,
          backgroundImage: `linear-gradient(to bottom, transparent, ${festive.deep})`,
        }}
      />
      {play ? <PlayButton x={width / 2} y={1230 * u} size={188 * u} u={u} /> : null}
    </AbsoluteFill>
  );
}

/** Landscape, 16:9 or the 1.91:1 of a link preview: words left, phone right. */
export function LandscapeCover({ play }: CoverProps) {
  const { width, height } = useVideoConfig();
  const u = height / 1080;
  const scale = 1.52 * u;
  const phoneWidth = SCREEN.width * scale + 32 * u;
  const phoneLeft = width - phoneWidth - 150 * u;
  const phoneTop = 120 * u;
  const phoneCentre = phoneLeft + phoneWidth / 2;
  return (
    <AbsoluteFill style={{ fontFamily }}>
      <Ground glow={{ x: phoneCentre, y: 560 * u }} u={u} />
      <div
        style={{
          position: 'absolute',
          left: 112 * u,
          top: 236 * u,
          width: phoneLeft - 160 * u,
        }}
      >
        <Brand u={u} />
        <div style={{ marginTop: 40 * u }}>
          <Headline size={86 * u} align="left" />
        </div>
        <div
          style={{
            marginTop: 30 * u,
            fontSize: 38 * u,
            fontWeight: 500,
            lineHeight: 1.3,
            color: 'rgba(255,255,255,0.84)',
          }}
        >
          {SUB}
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 112 * u,
          bottom: 92 * u,
          fontSize: 30 * u,
          fontWeight: 500,
          letterSpacing: '0.01em',
          color: 'rgba(255,255,255,0.66)',
        }}
      >
        {SITE}
      </div>
      <Handset left={phoneLeft} top={phoneTop} scale={scale} u={u} />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 200 * u,
          backgroundImage: `linear-gradient(to bottom, transparent, ${festive.deep})`,
        }}
      />
      {play ? <PlayButton x={phoneCentre} y={500 * u} size={176 * u} u={u} /> : null}
    </AbsoluteFill>
  );
}
