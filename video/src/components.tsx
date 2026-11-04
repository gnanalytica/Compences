import type { ReactNode } from 'react';
import {
  AbsoluteFill,
  Img,
  OffthreadVideo,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  Easing,
} from 'remotion';
import { color, fontFamily, sec } from './theme';
import { Petals, Rangoli, Toran, festive } from './festive';
import { Mark } from './mark';

/**
 * The parts every scene is built from.
 *
 * Two rules hold the whole video together. Nothing moves faster than a reader
 * can follow — a ledger is text, and text that slides past is decoration
 * rather than evidence. And nothing here invents a colour: everything comes
 * from theme.ts, which is the app's own palette, so a title card and a
 * screenshot are the same product rather than two designs that nearly agree.
 */

/** Eased 0→1 over a window, for fades that do not snap. */
function ramp(frame: number, from: number, to: number) {
  return interpolate(frame, [from, to], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });
}

/** Fade in at the head of a scene, out at its tail. */
export function Fade({ children, hold }: { children: ReactNode; hold: number }) {
  const frame = useCurrentFrame();
  const edge = sec(0.45);
  const opacity = Math.min(ramp(frame, 0, edge), 1 - ramp(frame, hold - edge, hold));
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
}

/**
 * A full-bleed statement, in the app's deepest green.
 *
 * Used for the sentences the product is an argument about, which are the ones
 * no screenshot can make on its own.
 */
export function Statement({
  lines,
  sub,
  hold,
  size = 84,
}: {
  lines: string[];
  sub?: string;
  hold: number;
  size?: number;
}) {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: festive.deep }}>
      <Fade hold={hold}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
          <Rangoli
            size={1250}
            opacity={0.075}
            spin={-frame * 0.04}
            accent={festive.accent}
            ribbon={festive.accent}
            strokeWidth={0.6}
          />
        </AbsoluteFill>
        <Petals hold={hold} count={10} />
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            padding: '0 180px',
            fontFamily,
          }}
        >
          <div style={{ textAlign: 'center', maxWidth: 1400 }}>
            {lines.map((line, index) => {
              // Lines arrive one after another, so a two-part sentence reads as
              // two beats instead of a wall that appears all at once.
              const entered = ramp(frame, sec(0.2 + index * 0.45), sec(0.9 + index * 0.45));
              return (
                <div
                  key={line}
                  style={{
                    color: 'white',
                    fontSize: size,
                    lineHeight: 1.18,
                    fontWeight: 600,
                    letterSpacing: '-0.02em',
                    opacity: entered,
                    transform: `translateY(${(1 - entered) * 18}px)`,
                  }}
                >
                  {line}
                </div>
              );
            })}
            {sub ? (
              <div
                style={{
                  color: 'rgba(255,255,255,0.72)',
                  fontSize: 38,
                  lineHeight: 1.45,
                  marginTop: 34,
                  fontWeight: 400,
                  opacity: ramp(
                    frame,
                    sec(0.6 + lines.length * 0.45),
                    sec(1.4 + lines.length * 0.45),
                  ),
                }}
              >
                {sub}
              </div>
            ) : null}
          </div>
        </AbsoluteFill>
      </Fade>
    </AbsoluteFill>
  );
}

/** The chrome around a desktop shot: a window, not a floating rectangle. */
function WindowFrame({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div
      style={{
        borderRadius: 18,
        overflow: 'hidden',
        backgroundColor: color.surfaceRaised,
        boxShadow: '0 40px 90px rgba(22,33,30,0.20), 0 4px 12px rgba(22,33,30,0.08)',
        border: `1px solid ${color.border}`,
      }}
    >
      <div
        style={{
          height: 46,
          backgroundColor: color.surfaceSunken,
          borderBottom: `1px solid ${color.border}`,
          display: 'flex',
          alignItems: 'center',
          padding: '0 18px',
          gap: 9,
        }}
      >
        {[0, 1, 2].map((dot) => (
          <div
            key={dot}
            style={{ width: 11, height: 11, borderRadius: 999, backgroundColor: color.border }}
          />
        ))}
        <div
          style={{
            marginLeft: 14,
            padding: '5px 16px',
            borderRadius: 999,
            backgroundColor: color.surfaceRaised,
            border: `1px solid ${color.border}`,
            color: color.inkSubtle,
            fontSize: 16,
            fontFamily,
          }}
        >
          {label}
        </div>
      </div>
      {children}
    </div>
  );
}

type Move = { scale: number; x: number; y: number };

/**
 * A still, moved across the frame.
 *
 * `from` and `to` are in the screenshot's own CSS pixels, so a move is written
 * as "start at the top, end 700px down" rather than as a transform nobody can
 * picture.
 */
export function Shot({
  src,
  width,
  height,
  viewport,
  from,
  to,
  hold,
  label,
  zoom = 1,
}: {
  src: string;
  /** The screenshot's CSS size, which is half its pixel size at 2× capture. */
  width: number;
  height: number;
  /** How much of it the window shows at once. */
  viewport: { width: number; height: number };
  from: Move;
  to: Move;
  hold: number;
  label: string;
  /** Scales the whole window, for a shot narrower than the frame. */
  zoom?: number;
}) {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [0, hold], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.quad),
  });
  const at = (key: keyof Move) => from[key] + (to[key] - from[key]) * progress;
  const scale = at('scale');

  return (
    <AbsoluteFill style={{ backgroundColor: color.surface }}>
      <Fade hold={hold}>
        <AbsoluteFill
          style={{ justifyContent: 'center', alignItems: 'center', paddingBottom: 170 }}
        >
          <div style={{ transform: `scale(${zoom})` }}>
            <WindowFrame label={label}>
              <div
                style={{
                  width: viewport.width,
                  height: viewport.height,
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                <Img
                  src={staticFile(src)}
                  style={{
                    position: 'absolute',
                    width,
                    height,
                    top: 0,
                    left: 0,
                    transformOrigin: 'top left',
                    transform: `scale(${scale}) translate(${-at('x')}px, ${-at('y')}px)`,
                  }}
                />
              </div>
            </WindowFrame>
          </div>
        </AbsoluteFill>
      </Fade>
    </AbsoluteFill>
  );
}

/** A recorded interaction, in the same window chrome. */
/**
 * Where a shot is looking.
 *
 * `zoom` of 1 is the whole window; 2 is half of it, twice the size. `x` and
 * `y` are in the recording's own pixels, measured from its centre, so a
 * framing can be written down by reading coordinates off a frame rather than
 * by guessing percentages.
 */
export type Framing = { zoom: number; x: number; y: number };

const WHOLE: Framing = { zoom: 1, x: 0, y: 0 };

/**
 * Something worth pointing at, in the recording's own pixels from its
 * top-left. A ring rather than a dimming mask: a ledger is evidence, and
 * greying out the rows around a row makes the evidence look edited.
 */
export type Marker = { x: number; y: number; width: number; height: number; at?: number };

function Highlight({ marker, hold }: { marker: Marker; hold: number }) {
  const frame = useCurrentFrame();
  const from = sec(marker.at ?? 0.9);
  const appear = interpolate(frame, [from, from + sec(0.5)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const leaving = interpolate(frame, [hold - sec(0.5), hold], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const pad = 10;
  return (
    <div
      style={{
        position: 'absolute',
        left: marker.x - pad,
        top: marker.y - pad,
        width: marker.width + pad * 2,
        height: marker.height + pad * 2,
        border: `3px solid ${festive.accent}`,
        borderRadius: 12,
        boxShadow: `0 0 0 6px ${festive.accent}22`,
        opacity: Math.min(appear, leaving),
        // Draws itself on rather than snapping into place.
        transform: `scale(${0.96 + appear * 0.04})`,
      }}
    />
  );
}

export function Clip({
  src,
  width,
  height,
  scale,
  hold,
  label,
  startFrom = 0,
  from = WHOLE,
  to,
  marker,
}: {
  src: string;
  width: number;
  height: number;
  scale: number;
  hold: number;
  label: string;
  startFrom?: number;
  /** Where the shot opens. Defaults to the whole window. */
  from?: Framing;
  /** Where it ends up, if it moves. */
  to?: Framing;
  marker?: Marker;
}) {
  const frame = useCurrentFrame();
  const end = to ?? from;
  // Eased both ends: a push that starts and stops abruptly reads as a jump
  // cut, and the whole point of moving is that the eye follows.
  const progress = interpolate(frame, [0, hold], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.quad),
  });
  const at = (key: keyof Framing) => from[key] + (end[key] - from[key]) * progress;
  const zoom = at('zoom');

  return (
    <AbsoluteFill style={{ backgroundColor: color.surface }}>
      <Fade hold={hold}>
        <AbsoluteFill
          style={{ justifyContent: 'center', alignItems: 'center', paddingBottom: 170 }}
        >
          <div style={{ transform: `scale(${scale})` }}>
            <WindowFrame label={label}>
              {/* The window keeps its size; the recording moves inside it, so
                  a push-in never changes the shape of the frame around it. */}
              <div style={{ width, height, overflow: 'hidden', position: 'relative' }}>
                <div
                  style={{
                    width,
                    height,
                    position: 'relative',
                    transform: `scale(${zoom}) translate(${-at('x')}px, ${-at('y')}px)`,
                    transformOrigin: 'center center',
                  }}
                >
                  <OffthreadVideo
                    src={staticFile(src)}
                    startFrom={startFrom}
                    muted
                    style={{ width, height, display: 'block' }}
                  />
                  {marker ? <Highlight marker={marker} hold={hold} /> : null}
                </div>
              </div>
            </WindowFrame>
          </div>
        </AbsoluteFill>
      </Fade>
    </AbsoluteFill>
  );
}

/**
 * The line under a shot.
 *
 * A caption rather than a voiceover, because this gets forwarded into
 * WhatsApp groups and watched on mute in a lift.
 */
export function Caption({ text, hold }: { text: string; hold: number }) {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const entered = ramp(frame, sec(0.25), sec(0.95));
  const leaving = 1 - ramp(frame, hold - sec(0.4), hold);

  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 54 }}>
      <div
        style={{
          maxWidth: width - 420,
          padding: '18px 34px',
          borderRadius: 16,
          backgroundColor: festive.deep,
          color: 'white',
          fontFamily,
          fontSize: 34,
          lineHeight: 1.35,
          textAlign: 'center',
          fontWeight: 500,
          opacity: Math.min(entered, leaving),
          transform: `translateY(${(1 - entered) * 14}px)`,
          boxShadow: '0 18px 44px rgba(22,33,30,0.22)',
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
}

/** The opening and closing card: the name, and what it is for. */
export function Bookend({ headline, sub, hold }: { headline: string; sub: string; hold: number }) {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const entered = ramp(frame, sec(0.2), sec(1.2));
  return (
    <AbsoluteFill style={{ backgroundColor: festive.deep }}>
      <Fade hold={hold}>
        {/* The kolam from the app's own event header, turning slowly enough
            that you notice it only if you look for it. */}
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
          <Rangoli
            size={1500}
            opacity={0.1 * entered}
            spin={frame * 0.05}
            accent={festive.accent}
            ribbon={festive.accent}
            strokeWidth={0.55}
          />
        </AbsoluteFill>
        <Petals hold={hold} count={14} />
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, opacity: 0.85 }}>
          <Toran width={width} />
        </div>

        <AbsoluteFill
          style={{ justifyContent: 'center', alignItems: 'center', fontFamily, padding: 120 }}
        >
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                marginBottom: 30,
                opacity: entered,
                transform: `scale(${0.965 + entered * 0.035})`,
              }}
            >
              <Mark size={124} />
            </div>
            <div
              style={{
                color: 'white',
                fontSize: 132,
                fontWeight: 600,
                letterSpacing: '-0.035em',
                opacity: entered,
                transform: `scale(${0.965 + entered * 0.035})`,
              }}
            >
              {headline}
            </div>
            <div
              style={{
                color: 'rgba(255,255,255,0.8)',
                fontSize: 44,
                marginTop: 22,
                opacity: ramp(frame, sec(0.9), sec(1.8)),
              }}
            >
              {sub}
            </div>
          </div>
        </AbsoluteFill>
      </Fade>
    </AbsoluteFill>
  );
}

/**
 * The phone recording, in a phone, on the festive ground.
 *
 * This used to be a tall screenshot scrolled inside a drawn handset, on white,
 * which made the one scene about the phone the only scene that did not look
 * like the rest of the video — and the only one where the product was not
 * moving. `capture/record-phone.mjs` films the real mobile layout, so the
 * landscape cuts show the same footage the portrait cut is built from.
 */
export function PhoneClip({
  src,
  startFrom,
  hold,
  scale = 0.82,
}: {
  src: string;
  startFrom: number;
  hold: number;
  /** The recording is 390x844; this is how much of the frame it fills. */
  scale?: number;
}) {
  const frame = useCurrentFrame();
  const width = 390 * (scale * 2.1);
  const height = 844 * (scale * 2.1);
  // A slow drift in, so a static phone does not sit dead in the middle of a
  // video that moves everywhere else.
  const drift = interpolate(frame, [0, hold], [1, 1.045], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.quad),
  });

  return (
    <AbsoluteFill style={{ backgroundColor: festive.deep }}>
      <Fade hold={hold}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
          <Rangoli
            size={1400}
            opacity={0.07}
            spin={frame * 0.04}
            accent={festive.accent}
            ribbon={festive.accent}
            strokeWidth={0.6}
          />
        </AbsoluteFill>
        <AbsoluteFill
          style={{ justifyContent: 'center', alignItems: 'center', paddingBottom: 150 }}
        >
          <div
            style={{
              width: width + 22,
              height: height + 22,
              padding: 11,
              borderRadius: 46,
              backgroundColor: 'oklch(0.18 0.02 60)',
              boxShadow: '0 40px 90px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)',
              transform: `scale(${drift})`,
            }}
          >
            <div style={{ width, height, borderRadius: 36, overflow: 'hidden' }}>
              <OffthreadVideo
                src={staticFile(src)}
                startFrom={startFrom}
                muted
                style={{ width, height, display: 'block' }}
              />
            </div>
          </div>
        </AbsoluteFill>
      </Fade>
    </AbsoluteFill>
  );
}
