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
 * The same fourteen beats, in 16:9.
 *
 * A phone held in the middle of a landscape frame wastes two thirds of it, and
 * the portrait cut pays for that width by dropping everything it cannot fit
 * under the handset. Here the handset sits on the right and the space it frees
 * carries what the captions had to leave out: which chapter this is, the
 * sentence itself, and the two supporting points from `story.tsx`.
 *
 * So this is the explanatory cut and `Phone` is the fast one, from one script.
 */

const SIZE = { width: 1920, height: 1080 };

/** The handset, to the right, at a size that leaves the page legible. */
const SCALE = 1.06;
const BEZEL = 12;
const SCREEN_W = SCREEN.width * SCALE;
const SCREEN_H = SCREEN.height * SCALE;
const PHONE_W = SCREEN_W + BEZEL * 2;
const PHONE_H = SCREEN_H + BEZEL * 2;
const PHONE_L = SIZE.width - PHONE_W - 150;
const PHONE_T = (SIZE.height - PHONE_H) / 2;
const RECT = { left: PHONE_L + BEZEL, top: PHONE_T + BEZEL, width: SCREEN_W, height: SCREEN_H };
const RADIUS = 30;

/** The panel, to the left. */
const PANEL = { left: 132, width: PHONE_L - 132 - 96 };

function Ground({ frame, length }: { frame: number; length: number }) {
  return (
    <AbsoluteFill style={{ backgroundColor: festive.deep }}>
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <Rangoli
          size={1500}
          opacity={0.055}
          spin={-frame * 0.025}
          accent={festive.accent}
          ribbon={festive.accent}
          strokeWidth={0.6}
        />
      </AbsoluteFill>
      <div style={{ position: 'absolute', inset: '0 0 auto 0', opacity: 0.7 }}>
        <Toran width={SIZE.width} />
      </div>
      <Petals hold={length} count={10} />
    </AbsoluteFill>
  );
}

function Shell() {
  return (
    <div
      style={{
        position: 'absolute',
        left: PHONE_L,
        top: PHONE_T,
        width: PHONE_W,
        height: PHONE_H,
        backgroundColor: festive.deep,
        borderRadius: RADIUS + BEZEL,
        padding: BEZEL,
        boxShadow: '0 38px 90px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1)',
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
// The panel
// ---------------------------------------------------------------------------

/**
 * Chapter, headline, specifics — all at once, held for as long as they take
 * to read. No cursor and no lit words: people can read, and what they needed
 * was the time to.
 */
function Panel({
  chapter,
  step,
  of,
  headline,
  points,
  hold,
}: {
  chapter: Chapter;
  step: number;
  of: number;
  headline: string;
  points: string[];
  hold: number;
}) {
  const frame = useCurrentFrame();
  const leaving = 1 - ramp(frame, hold - sec(0.3), hold);
  const head = ramp(frame, sec(0.1), sec(0.5));
  const body = ramp(frame, sec(0.25), sec(0.65));
  return (
    <div
      style={{
        position: 'absolute',
        left: PANEL.left,
        top: 0,
        bottom: 0,
        width: PANEL.width,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        fontFamily,
        color: 'white',
        opacity: leaving,
      }}
    >
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28, opacity: head }}
      >
        <span
          style={{
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: festive.accent,
          }}
        >
          {chapter}
        </span>
        <span style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.18)' }} />
        <span
          style={{
            fontSize: 20,
            color: 'rgba(255,255,255,0.45)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {String(step).padStart(2, '0')} / {String(of).padStart(2, '0')}
        </span>
      </div>
      <div
        style={{
          fontFamily: displayFamily,
          fontSize: 72,
          lineHeight: 1.08,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          opacity: head,
          transform: `translateY(${(1 - settle(frame, 0.1)) * 14}px)`,
        }}
      >
        {headline}
      </div>
      <div style={{ marginTop: 42, opacity: body, transform: `translateY(${(1 - body) * 10}px)` }}>
        {points.map((point) => (
          <div
            key={point}
            style={{ display: 'flex', gap: 20, alignItems: 'baseline', marginBottom: 18 }}
          >
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: 999,
                flexShrink: 0,
                backgroundColor: festive.accent,
                transform: 'translateY(-6px)',
              }}
            />
            <span
              style={{
                fontSize: 38,
                fontWeight: 500,
                lineHeight: 1.3,
                color: 'rgba(255,255,255,0.88)',
              }}
            >
              {point}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** The rail, along the foot of the panel rather than the foot of the frame. */
function Rail({ chapter, progress }: { chapter: Chapter; progress: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: PANEL.left,
        width: PANEL.width,
        bottom: 74,
        display: 'flex',
        gap: 14,
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
                marginBottom: 9,
                fontSize: 17,
                fontWeight: 600,
                letterSpacing: '0.09em',
                textTransform: 'uppercase',
                color: now ? 'white' : 'rgba(255,255,255,0.34)',
              }}
            >
              {name}
            </div>
            <div
              style={{
                height: 4,
                borderRadius: 999,
                backgroundColor: 'rgba(255,255,255,0.15)',
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

function Statement({ lines, sub, hold }: { lines: string[]; sub?: string; hold: number }) {
  const frame = useCurrentFrame();
  const edge = sec(0.4);
  const cover = Math.min(ramp(frame, 0, edge), 1 - ramp(frame, hold - edge, hold));
  const shown = ramp(frame, sec(0.2), sec(0.7));
  return (
    <AbsoluteFill style={{ backgroundColor: festive.deep, opacity: cover }}>
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <Rangoli
          size={1180}
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
        style={{ justifyContent: 'center', alignItems: 'center', fontFamily, padding: '0 180px' }}
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
                fontSize: 96,
                fontWeight: 700,
                lineHeight: 1.1,
                letterSpacing: '-0.02em',
              }}
            >
              {line}
            </div>
          ))}
          {sub ? (
            <div
              style={{
                fontSize: 48,
                marginTop: 36,
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
          size={1080}
          opacity={0.11}
          spin={frame * 0.05}
          accent={festive.accent}
          ribbon={festive.accent}
          strokeWidth={0.6}
        />
      </AbsoluteFill>
      <Petals hold={hold} count={11} />
      <div style={{ position: 'absolute', inset: '0 0 auto 0', opacity: 0.85 }}>
        <Toran width={SIZE.width} />
      </div>
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', fontFamily }}>
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              marginBottom: 30,
              opacity: entered,
              transform: `scale(${0.94 + settle(frame, opening ? 0.1 : 0.3) * 0.06})`,
            }}
          >
            <Mark size={120} />
          </div>
          <div
            style={{
              color: 'white',
              fontFamily: displayFamily,
              fontSize: 120,
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
              fontSize: 46,
              fontWeight: 500,
              marginTop: 20,
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

export function ExplainReel({ score }: { score?: string }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const { holds, starts: marks } = timeline();
  const { zoom } = camera(frame);
  const rail = chapterNow(frame);
  const numbered = SHOTS.filter((shot) => shot.screen);

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

      {/* Far less push than the portrait cut: here the panel carries the
          emphasis, and a phone that grows while text sits beside it wobbles. */}
      <AbsoluteFill
        style={{
          transform: `scale(${1 + (zoom - 1) * 0.45})`,
          transformOrigin: `${((PHONE_L + PHONE_W / 2) / SIZE.width) * 100}% 50%`,
        }}
      >
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

      {SHOTS.map((shot, index) =>
        shot.headline && shot.chapter ? (
          <Sequence key={`${shot.id}-panel`} from={marks[index]} durationInFrames={holds[index]}>
            <Panel
              chapter={shot.chapter}
              step={numbered.indexOf(shot) + 1}
              of={numbered.length}
              headline={shot.headline}
              points={shot.points ?? []}
              hold={holds[index]}
            />
          </Sequence>
        ) : null,
      )}
      {rail ? <Rail chapter={rail.chapter} progress={rail.progress} /> : null}

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
            <LogoSting layout="landscape" />
          </Sequence>
        ) : null,
      )}
    </AbsoluteFill>
  );
}

export const EXPLAIN_SIZE = SIZE;
export const explainLength = () => timeline().length;
