import type { ReactNode } from 'react';
import {
  AbsoluteFill,
  Audio,
  Easing,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { Petals, Rangoli, Toran, festive } from './festive';
import { LogoSting } from './logo';
import { Mark } from './mark';
import { BAR_H, BottomBar, RESIDENT, SCREEN, STATUS_H, StatusBar, ramp, settle } from './screens';
import { CHAPTERS, type Chapter, SHOTS, camera, chapterNow, timeline } from './story';
import { color, displayFamily, fontFamily, sec } from './theme';

/**
 * The portrait cut: one phone, one argument, no footage.
 *
 * It is vertical because a residents' society reads its ledger standing in a
 * lift, and drawn rather than recorded because a recording moves at the speed
 * a browser navigates — every shot used to open on a page settling into place.
 *
 * The screens and the words come from story.tsx; this file is only where they
 * sit in a tall frame.
 *
 * Structurally the phone never cuts. The ground, the bezel, the chrome and the
 * camera are rendered once for the whole video and each shot supplies only the
 * page inside them, so pages push through a handset that stays put.
 */

const SIZE = { width: 1080, height: 1920 };

/** Logical phone pixels → canvas pixels. */
const SCALE = 1.72;
const BEZEL = 14;
const TOP = 40;

const SCREEN_W = SCREEN.width * SCALE;
const SCREEN_H = SCREEN.height * SCALE;
const PHONE_W = SCREEN_W + BEZEL * 2;
const PHONE_L = (SIZE.width - PHONE_W) / 2;
/** Where a page sits on the canvas. The shell, every slot and the chrome share it. */
const RECT = { left: PHONE_L + BEZEL, top: TOP + BEZEL, width: SCREEN_W, height: SCREEN_H };
const RADIUS = 44;

// ---------------------------------------------------------------------------
// The parts that never cut
// ---------------------------------------------------------------------------

/** Festive ground: kolam, toran, petals. Rendered once, so it never restarts. */
function Ground({ frame, length }: { frame: number; length: number }) {
  return (
    <AbsoluteFill style={{ backgroundColor: festive.deep }}>
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <Rangoli
          size={1560}
          opacity={0.06}
          spin={-frame * 0.025}
          accent={festive.accent}
          ribbon={festive.accent}
          strokeWidth={0.6}
        />
      </AbsoluteFill>
      <div style={{ position: 'absolute', inset: '0 0 auto 0', opacity: 0.72 }}>
        <Toran width={SIZE.width} />
      </div>
      <Petals hold={length} count={11} />
    </AbsoluteFill>
  );
}

/**
 * The handset. Its screen is filled with the app's own surface colour, which
 * is what shows through in the gap while one page pushes the next along.
 */
function Shell() {
  return (
    <div
      style={{
        position: 'absolute',
        left: PHONE_L,
        top: TOP,
        width: PHONE_W,
        height: SCREEN_H + BEZEL * 2,
        backgroundColor: festive.deep,
        borderRadius: RADIUS + BEZEL,
        padding: BEZEL,
        boxShadow: '0 44px 100px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1)',
      }}
    >
      <div
        style={{
          width: SCREEN_W,
          height: SCREEN_H,
          borderRadius: RADIUS,
          backgroundColor: color.surface,
        }}
      />
    </div>
  );
}

/** Anything drawn at phone scale, clipped to the phone's screen. */
function InScreen({ children, opacity = 1 }: { children: ReactNode; opacity?: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: RECT.left,
        top: RECT.top,
        width: RECT.width,
        height: RECT.height,
        borderRadius: RADIUS,
        overflow: 'hidden',
        opacity,
      }}
    >
      {children}
    </div>
  );
}

/**
 * One page, pushing the last one out of the way.
 *
 * Slots stack at the same rect in shot order, so the arriving page paints over
 * the leaving one. It slides in from the right while the leaving page slides
 * left — a navigation push, which is the transition the app itself makes.
 */
function Slot({ hold, children }: { hold: number; children: ReactNode }) {
  const frame = useCurrentFrame();
  const enter = ramp(frame, 0, sec(0.36), Easing.out(Easing.cubic));
  const leave = ramp(frame, hold - sec(0.32), hold, Easing.in(Easing.cubic));
  return (
    <InScreen>
      <div
        style={{
          width: SCREEN.width,
          height: SCREEN.height,
          transform: `scale(${SCALE}) translateX(${(1 - enter) * SCREEN.width - leave * SCREEN.width * 0.34}px)`,
          transformOrigin: 'top left',
        }}
      >
        {children}
      </div>
    </InScreen>
  );
}

/**
 * The chrome that does not move: the clock at the top, the tabs at the bottom.
 *
 * Drawn per shot rather than once, because which four tabs there are depends on
 * who is holding the phone — residents get Money, the committee trades it for
 * Manage. Where two shots agree, which is most of them, the cross-fade is
 * between two identical bars and invisible.
 */
function Chrome({ tabs, active }: { tabs: string[]; active: string }) {
  const frame = useCurrentFrame();
  return (
    <InScreen opacity={ramp(frame, 0, sec(0.25))}>
      <div
        style={{
          width: SCREEN.width,
          height: SCREEN.height,
          transform: `scale(${SCALE})`,
          transformOrigin: 'top left',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          pointerEvents: 'none',
        }}
      >
        <div style={{ height: STATUS_H }}>
          <StatusBar />
        </div>
        <div style={{ height: BAR_H }}>
          <BottomBar tabs={tabs} active={active} />
        </div>
      </div>
    </InScreen>
  );
}

// ---------------------------------------------------------------------------
// Captions, chapters and bookends
// ---------------------------------------------------------------------------

/**
 * Where the caption and the rail live.
 *
 * Fixed rather than derived from the phone, because the camera pushes in and
 * the phone's drawn bottom moves with it — at the deepest zoom it reaches
 * about 1595. Anything laid out flush against the phone's resting edge ends up
 * behind it, which is how the rail spent its first render hidden by a tab bar.
 */
const CAPTION_TOP = 1606;
const RAIL_TOP = 1852;

/** The rail: where in the argument this shot sits. */
function Rail({ chapter, progress }: { chapter: Chapter; progress: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: 96,
        right: 96,
        top: RAIL_TOP,
        display: 'flex',
        gap: 12,
        fontFamily,
      }}
    >
      {CHAPTERS.map((name) => {
        const index = CHAPTERS.indexOf(name);
        const here = CHAPTERS.indexOf(chapter);
        const done = index < here;
        const now = index === here;
        return (
          <div key={name} style={{ flex: 1 }}>
            <div
              style={{
                marginBottom: 10,
                fontSize: 23,
                fontWeight: 600,
                letterSpacing: '0.07em',
                textTransform: 'uppercase',
                textAlign: 'center',
                color: now ? 'white' : 'rgba(255,255,255,0.38)',
              }}
            >
              {name}
            </div>
            <div
              style={{
                height: 5,
                borderRadius: 999,
                backgroundColor: 'rgba(255,255,255,0.16)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${done ? 100 : now ? progress * 100 : 0}%`,
                  height: '100%',
                  backgroundColor: festive.accent,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * The text: a headline and its specifics, on a card under the phone.
 *
 * Everything appears at once and stays up for as long as `holdOf()` in
 * story.tsx says it takes to read. It used to be a sentence lit word by word
 * as a reading cursor reached it; people can read, and what they asked for was
 * time and clarity, not to be shown where to look. The card is for contrast:
 * bare type straight on the festive ground was tiring to read, and at its
 * worst where a petal drifted behind a letter.
 */
function Caption({ headline, points, hold }: { headline: string; points: string[]; hold: number }) {
  const frame = useCurrentFrame();
  const entered = ramp(frame, sec(0.12), sec(0.5));
  const leaving = 1 - ramp(frame, hold - sec(0.3), hold);
  return (
    <div
      style={{
        position: 'absolute',
        left: 44,
        right: 44,
        top: CAPTION_TOP,
        height: RAIL_TOP - CAPTION_TOP - 18,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: '100%',
          padding: '24px 36px 26px',
          borderRadius: 30,
          backgroundColor: 'rgba(16, 8, 2, 0.78)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 18px 44px rgba(0,0,0,0.35)',
          fontFamily,
          color: 'white',
          opacity: Math.min(entered, leaving),
          transform: `translateY(${(1 - entered) * 14}px)`,
        }}
      >
        <div
          style={{
            fontFamily: displayFamily,
            fontSize: 46,
            fontWeight: 700,
            lineHeight: 1.12,
            letterSpacing: '-0.02em',
          }}
        >
          {headline}
        </div>
        {points.map((point) => (
          <div
            key={point}
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 16,
              marginTop: 12,
              fontSize: 32,
              fontWeight: 500,
              lineHeight: 1.3,
              color: 'rgba(255,255,255,0.86)',
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                flexShrink: 0,
                backgroundColor: festive.accent,
                transform: 'translateY(-5px)',
              }}
            />
            {point}
          </div>
        ))}
      </div>
    </div>
  );
}

/** A full-frame statement, for what no single screen can say. */
function Statement({ lines, sub, hold }: { lines: string[]; sub?: string; hold: number }) {
  const frame = useCurrentFrame();
  const edge = sec(0.4);
  const cover = Math.min(ramp(frame, 0, edge), 1 - ramp(frame, hold - edge, hold));
  const shown = ramp(frame, sec(0.2), sec(0.7));
  return (
    <AbsoluteFill style={{ backgroundColor: festive.deep, opacity: cover }}>
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <Rangoli
          size={1400}
          opacity={0.08}
          spin={-frame * 0.04}
          accent={festive.accent}
          ribbon={festive.accent}
          strokeWidth={0.6}
        />
      </AbsoluteFill>
      <Petals hold={hold} count={9} />
      <div style={{ position: 'absolute', inset: '0 0 auto 0', opacity: 0.8 }}>
        <Toran width={SIZE.width} />
      </div>
      <AbsoluteFill
        style={{ justifyContent: 'center', alignItems: 'center', fontFamily, padding: '0 84px' }}
      >
        <div
          style={{
            textAlign: 'center',
            color: 'white',
            opacity: shown,
            transform: `translateY(${(1 - shown) * 16}px)`,
          }}
        >
          {lines.map((line) => (
            <div
              key={line}
              style={{
                fontFamily: displayFamily,
                fontSize: 76,
                fontWeight: 700,
                lineHeight: 1.12,
                letterSpacing: '-0.02em',
              }}
            >
              {line}
            </div>
          ))}
          {sub ? (
            <div
              style={{
                fontSize: 42,
                marginTop: 34,
                lineHeight: 1.3,
                fontWeight: 500,
                color: 'rgba(255,255,255,0.84)',
              }}
            >
              {sub}
            </div>
          ) : null}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

/** A full-frame card, over the phone. `opening` dissolves off it; else onto. */
function Bookend({
  headline,
  sub,
  hold,
  opening,
}: {
  headline: string;
  sub: string;
  hold: number;
  opening?: boolean;
}) {
  const frame = useCurrentFrame();
  const cover = opening ? 1 - ramp(frame, hold - sec(0.42), hold) : ramp(frame, 0, sec(0.42));
  const entered = ramp(frame, sec(opening ? 0.1 : 0.3), sec(opening ? 0.9 : 1.1));
  return (
    <AbsoluteFill style={{ backgroundColor: festive.deep, opacity: cover }}>
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <Rangoli
          size={1320}
          opacity={0.11}
          spin={frame * 0.05}
          accent={festive.accent}
          ribbon={festive.accent}
          strokeWidth={0.6}
        />
      </AbsoluteFill>
      <Petals hold={hold} count={12} />
      <div style={{ position: 'absolute', inset: '0 0 auto 0', opacity: 0.85 }}>
        <Toran width={SIZE.width} />
      </div>
      <AbsoluteFill
        style={{ justifyContent: 'center', alignItems: 'center', fontFamily, padding: 86 }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              marginBottom: 36,
              opacity: entered,
              transform: `scale(${0.94 + settle(frame, opening ? 0.1 : 0.3) * 0.06})`,
            }}
          >
            <Mark size={148} />
          </div>
          <div
            style={{
              color: 'white',
              fontFamily: displayFamily,
              fontSize: 112,
              fontWeight: 600,
              letterSpacing: '-0.025em',
              opacity: entered,
              transform: `scale(${0.94 + settle(frame, opening ? 0.1 : 0.3) * 0.06})`,
            }}
          >
            {headline}
          </div>
          <div
            style={{
              color: 'rgba(255,255,255,0.82)',
              fontFamily: displayFamily,
              fontSize: 45,
              fontWeight: 500,
              marginTop: 22,
              lineHeight: 1.25,
              opacity: ramp(frame, sec(0.6), sec(1.4)),
            }}
          >
            {sub}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------
// The cut
// ---------------------------------------------------------------------------

export function PortraitReel({ score }: { score?: string }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const { holds, starts: marks } = timeline();
  const { zoom, origin } = camera(frame);
  const rail = chapterNow(frame);

  return (
    <AbsoluteFill style={{ backgroundColor: festive.deep }}>
      {score ? (
        <Audio
          src={staticFile(score)}
          volume={(f) =>
            Math.min(
              interpolate(f, [0, sec(0.5)], [0, 1], { extrapolateRight: 'clamp' }),
              interpolate(f, [durationInFrames - sec(1.8), durationInFrames], [1, 0], {
                extrapolateLeft: 'clamp',
              }),
            )
          }
        />
      ) : null}

      <Ground frame={frame} length={durationInFrames} />

      {/* Shell, pages and chrome under one transform, so they move as one. */}
      <AbsoluteFill style={{ transform: `scale(${zoom})`, transformOrigin: `50% ${origin}%` }}>
        <Shell />
        {SHOTS.map((shot, index) =>
          shot.screen ? (
            <Sequence key={shot.id} from={marks[index]} durationInFrames={holds[index]}>
              <Slot hold={holds[index]}>{shot.screen}</Slot>
              <Chrome tabs={shot.tabs ?? RESIDENT} active={shot.active ?? 'Home'} />
            </Sequence>
          ) : null,
        )}
      </AbsoluteFill>

      {/* The rail and the captions stay put while the camera moves. */}
      {rail ? <Rail chapter={rail.chapter} progress={rail.progress} /> : null}
      {SHOTS.map((shot, index) =>
        shot.headline ? (
          <Sequence key={`${shot.id}-cap`} from={marks[index]} durationInFrames={holds[index]}>
            <Caption headline={shot.headline} points={shot.points ?? []} hold={holds[index]} />
          </Sequence>
        ) : null,
      )}

      {SHOTS.map((shot, index) =>
        shot.statement ? (
          <Sequence key={`${shot.id}-say`} from={marks[index]} durationInFrames={holds[index]}>
            <Statement {...shot.statement} hold={holds[index]} />
          </Sequence>
        ) : null,
      )}
      {SHOTS.map((shot, index) =>
        shot.bookend ? (
          <Sequence key={`${shot.id}-end`} from={marks[index]} durationInFrames={holds[index]}>
            <Bookend {...shot.bookend} hold={holds[index]} />
          </Sequence>
        ) : null,
      )}
      {SHOTS.map((shot, index) =>
        shot.sting ? (
          <Sequence key={`${shot.id}-sting`} from={marks[index]} durationInFrames={holds[index]}>
            <LogoSting layout="portrait" />
          </Sequence>
        ) : null,
      )}
    </AbsoluteFill>
  );
}

export const PORTRAIT_SIZE = SIZE;

export const portraitLength = () => timeline().length;
