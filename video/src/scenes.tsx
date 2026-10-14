import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useVideoConfig } from 'remotion';
import { Bookend, Caption, Clip, PhoneClip, Shot, Statement } from './components';
import type { Framing, Marker } from './components';
import { McpScene } from './surfaces';
import { sec } from './theme';
import clips from './clips.json';
import shots from './shots.json';
import take from './beats.json';
import phoneTake from './phone-beats.json';

/**
 * The script.
 *
 * One argument, told in the order a committee meets it: the problem everybody
 * already has, then the product answering it, then what is left when the event
 * is over. Each scene knows its own length, so the two cuts are the same scenes
 * picked differently rather than two timelines to keep in step.
 *
 * Most of it is one continuous recording of somebody using the app — landing
 * page, home, the ledger, an event, paying for it — cut into scenes by the
 * beats the recorder timestamped. A few shots are stills, where the scene wants
 * a slow pan across something taller than a screen, or a phone.
 */

/**
 * Every still's real size, measured when it was taken.
 *
 * Shots are captured fullPage, so their height is whatever the content needed
 * that day. Remotion pans by subtracting the viewport from that height, so a
 * number typed in here by hand goes wrong the first time a ledger row is added:
 * the pan stops early, or runs off the image into background. Imported instead.
 */
const SHOTS = shots;

const WINDOW = { width: 1200, height: 700 };

/** The continuous take, and where in it each moment happened. */
const TAKE = { src: 'captures/take.webm', width: 1440, height: 900, scale: 0.94 };

function beatAt(name: string) {
  const found = take.beats.find((entry) => entry.name === name);
  // Better to fail the render than to publish a cut that silently opens on the
  // wrong page because a beat was renamed in the recorder and not here.
  if (!found) throw new Error(`beats.json has no beat named "${name}"`);
  return found.at;
}

/**
 * A slice of the take.
 *
 * `lead` is how long before the beat to start, because a beat marks the moment
 * something arrived — the Money page, the chosen flat — and a scene that opens
 * there has already missed the click that caused it.
 */
function Take({
  at,
  lead = 1.8,
  hold,
  label,
  from,
  to,
  marker,
}: {
  at: string;
  lead?: number;
  hold: number;
  label: string;
  /** Where the shot opens and where it ends up; see Framing in components. */
  from?: Framing;
  to?: Framing;
  marker?: Marker;
}) {
  return (
    <Clip
      {...TAKE}
      hold={hold}
      label={label}
      startFrom={sec(Math.max(0, beatAt(at) - lead))}
      from={from}
      to={to}
      marker={marker}
    />
  );
}

/**
 * Where to look, in the take's own 1440x900 pixels.
 *
 * A framing is written as the point to centre on and how close to get, because
 * that is what you can read off a paused frame. `look` turns it into the
 * offsets Clip wants, so nobody has to do the subtraction in their head and
 * get it wrong by half a window.
 */
function look(centreX: number, centreY: number, zoom: number): Framing {
  // Past this the framed region would show outside the recording, which draws
  // the window's background where the app should be. Clamping is what lets a
  // measured coordinate be used raw: the ledger row the edit points at had
  // scrolled to y = -17 at the moment it was measured, and this is the
  // difference between that being fine and being a grey band across the shot.
  const limitX = (TAKE.width / 2) * (1 - 1 / zoom);
  const limitY = (TAKE.height / 2) * (1 - 1 / zoom);
  const clamp = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value));
  return {
    zoom,
    x: clamp(centreX - TAKE.width / 2, limitX),
    y: clamp(centreY - TAKE.height / 2, limitY),
  };
}

/** Where the recorder found something, turned into a framing centred on it. */
function onto(name: keyof typeof take.boxes, zoom: number): Framing {
  const box = take.boxes[name];
  // A beat whose element moved out of the page is better shown whole than
  // shown somewhere arbitrary.
  if (!box) return WHOLE_WINDOW;
  return look(box.x + box.width / 2, box.y + box.height / 2, zoom);
}

/** The same box, as something to draw a ring around. */
function ring(name: keyof typeof take.boxes, at?: number): Marker | undefined {
  const box = take.boxes[name];
  return box ? { ...box, at } : undefined;
}

const WHOLE_WINDOW: Framing = { zoom: 1, x: 0, y: 0 };

/**
 * Where to start each of the short recordings.
 *
 * A Playwright recording opens on a blank page and a navigation — a couple of
 * seconds of nothing before a key is pressed. The capture measures it rather
 * than anybody eyeballing it, so re-recording on a slower day cannot quietly
 * push the interaction past the end of its scene.
 */
const startOf = (name: keyof typeof clips) => sec(clips[name].startSeconds);

/** A framed shot with its caption, which is how every screen scene is built. */
function Scene({
  children,
  caption,
  hold,
}: {
  children: React.ReactNode;
  caption?: string;
  hold: number;
}) {
  return (
    <AbsoluteFill>
      {children}
      {caption ? <Caption text={caption} hold={hold} /> : null}
    </AbsoluteFill>
  );
}

export type SceneSpec = { id: string; hold: number; node: (hold: number) => React.ReactNode };

/**
 * Every scene the video can draw on, written once.
 *
 * `hold` on each entry is the length it wants in the long cut; the short cut
 * overrides it, because a shot that earns twelve seconds in a walkthrough
 * earns half that in something posted to a group chat.
 */
export const SCENES: Record<string, SceneSpec> = {
  open: {
    id: 'open',
    hold: sec(3.5),
    node: (hold) => (
      <Bookend headline="Compences" sub="Your society's festivals, in the open." hold={hold} />
    ),
  },

  problem: {
    id: 'problem',
    hold: sec(4.5),
    node: (hold) => (
      <Statement
        lines={['₹40,000 collected for Diwali.', 'Four people know where it went.']}
        sub="Every society has this problem, and it was never really about the money."
        hold={hold}
      />
    ),
  },

  startEvent: {
    id: 'startEvent',
    hold: sec(2.5),
    node: (hold) => <Statement lines={['Every festival starts the same way.']} hold={hold} />,
  },

  festival: {
    id: 'festival',
    hold: sec(6.5),
    node: (hold) => (
      <Scene hold={hold} caption="Type three letters. It already knows the date.">
        <Clip
          src="captures/festival.webm"
          width={900}
          height={620}
          scale={1.18}
          hold={hold}
          label="Create an event"
          startFrom={startOf('festival')}
        />
      </Scene>
    ),
  },

  residentsPay: {
    id: 'residentsPay',
    hold: sec(2.5),
    node: (hold) => <Statement lines={['Then the whole building chips in.']} hold={hold} />,
  },

  openApp: {
    id: 'openApp',
    hold: sec(4),
    node: (hold) => (
      <Scene hold={hold} caption="Open it in September and it looks like September.">
        <Take at="app:home" lead={2} hold={hold} label="Shanti Nivas · Home" />
      </Scene>
    ),
  },

  oneLedger: {
    id: 'oneLedger',
    hold: sec(2.5),
    node: (hold) => <Statement lines={['And every rupee lands in one place.']} hold={hold} />,
  },

  ledgerLive: {
    id: 'ledgerLive',
    hold: sec(6.5),
    node: (hold) => (
      <Scene hold={hold} caption="Every rupee in, with a name and a flat beside it.">
        <Take
          at="app:money"
          lead={2.2}
          hold={hold}
          label="Shanti Nivas · Money"
          // Opens on the whole page and settles into the rows, so the ledger
          // arrives as a page and then becomes readable.
          from={WHOLE_WINDOW}
          to={look(760, 520, 1.3)}
        />
      </Scene>
    ),
  },

  flatGap: {
    id: 'flatGap',
    hold: sec(4),
    node: (hold) => (
      <Scene hold={hold} caption="Nothing quietly goes missing.">
        <Take
          at="app:flat-gap"
          lead={1}
          hold={hold}
          label="Shanti Nivas · Money"
          from={onto('flatGap', 1.5)}
          to={onto('flatGap', 2.4)}
          marker={ring('flatGap', 1.1)}
        />
      </Scene>
    ),
  },

  contributeLive: {
    id: 'contributeLive',
    hold: sec(6.5),
    node: (hold) => (
      <Scene hold={hold} caption="Two taps to pay, straight into the society's own account.">
        <Take
          at="app:contribute"
          lead={2.6}
          hold={hold}
          label="Shanti Nivas · Contribute"
          // Ends on the note, because the note carrying the flat is the point.
          from={WHOLE_WINDOW}
          to={onto('note', 1.9)}
          marker={ring('note', 4.2)}
        />
      </Scene>
    ),
  },

  eventLive: {
    id: 'eventLive',
    hold: sec(5.5),
    node: (hold) => (
      <Scene
        hold={hold}
        caption="One page for the whole festival — and everyone can see how ready you are."
      >
        <Take at="app:event" lead={1.8} hold={hold} label="Ganesh Chaturthi 2026" />
      </Scene>
    ),
  },

  readiness: {
    id: 'readiness',
    hold: sec(4),
    node: (hold) => (
      <Scene hold={hold} caption="Everyone can see how ready you are.">
        <Take
          at="app:readiness"
          lead={1.4}
          hold={hold}
          label="Ganesh Chaturthi 2026"
          from={WHOLE_WINDOW}
          to={onto('readiness', 1.75)}
        />
      </Scene>
    ),
  },

  billTrail: {
    id: 'billTrail',
    hold: sec(5),
    node: (hold) => (
      <Scene hold={hold} caption="Every rupee out, with the bill attached.">
        <Take
          at="app:bills"
          lead={1.8}
          hold={hold}
          label="Ganesh Chaturthi 2026"
          from={WHOLE_WINDOW}
          to={onto('bills', 1.7)}
        />
      </Scene>
    ),
  },

  ownMoney: {
    id: 'ownMoney',
    hold: sec(4.5),
    node: (hold) => (
      <Scene hold={hold} caption="And nobody signs off their own money.">
        <Take
          at="app:ownMoney"
          lead={1.8}
          hold={hold}
          label="Ganesh Chaturthi 2026"
          from={onto('ownMoney', 1.4)}
          to={onto('ownMoney', 1.95)}
          marker={ring('ownMoney', 1.3)}
        />
      </Scene>
    ),
  },

  reconcileLive: {
    id: 'reconcileLive',
    hold: sec(4.5),
    node: (hold) => (
      <Scene hold={hold} caption="Checked against the bank, line by line.">
        <Take
          at="app:reconcile"
          lead={2}
          hold={hold}
          label="Shanti Nivas · Reconcile"
          from={WHOLE_WINDOW}
          to={onto('matched', 1.55)}
          marker={ring('matched', 2.4)}
        />
      </Scene>
    ),
  },

  fourSurfaces: {
    id: 'fourSurfaces',
    hold: sec(3),
    node: (hold) => (
      <Statement
        lines={['A ledger nobody can read is not a ledger.']}
        sub="So it is open to whatever the society already uses."
        hold={hold}
      />
    ),
  },

  mcp: {
    id: 'mcp',
    hold: sec(4.5),
    node: (hold) => (
      <Scene hold={hold} caption="Your AI assistant can read it too.">
        <McpScene hold={hold} />
      </Scene>
    ),
  },

  whenItCloses: {
    id: 'whenItCloses',
    hold: sec(2.5),
    node: (hold) => <Statement lines={['And when it is all over?']} hold={hold} />,
  },

  closure: {
    id: 'closure',
    hold: sec(4),
    node: (hold) => (
      <Scene hold={hold} caption="Money left over? The society decides where it goes.">
        <Shot
          {...SHOTS.closure}
          viewport={{ width: 900, height: 700 }}
          from={{ scale: 1, x: 0, y: 0 }}
          to={{ scale: 1, x: 0, y: 0 }}
          hold={hold}
          label="Close the event"
          zoom={1.12}
        />
      </Scene>
    ),
  },

  closureChosen: {
    id: 'closureChosen',
    hold: sec(4),
    node: (hold) => (
      <Scene hold={hold} caption="Kept for the society, or saved for next year.">
        <Shot
          {...SHOTS['closure-chosen']}
          viewport={{ width: 900, height: 700 }}
          from={{ scale: 1, x: 0, y: 0 }}
          to={{ scale: 1, x: 0, y: 0 }}
          hold={hold}
          label="Close the event"
          zoom={1.12}
        />
      </Scene>
    ),
  },

  phone: {
    id: 'phone',
    hold: sec(5),
    node: (hold) => {
      // The ledger, on the phone recording rather than a screenshot of one.
      const beat = phoneTake.beats.find((entry) => entry.name === 'money:ledger');
      if (!beat) throw new Error('phone-beats.json has no beat named "money:ledger"');
      return (
        <Scene hold={hold} caption="All of it, in everybody's pocket.">
          <PhoneClip
            src="captures/phone.webm"
            startFrom={sec(Math.max(0, beat.at - 2.2))}
            hold={hold}
          />
        </Scene>
      );
    },
  },

  close: {
    id: 'close',
    hold: sec(4.5),
    node: (hold) => (
      <Bookend headline="Compences" sub="Nothing hidden. Nothing to chase." hold={hold} />
    ),
  },
};

/** Lays a list of scenes end to end, each overlapping the last as it fades. */
export function Reel({
  order,
  score,
}: {
  order: { id: keyof typeof SCENES; hold?: number }[];
  /** The bed under the whole cut, sized to it by score/compose.mjs. */
  score?: string;
}) {
  const { durationInFrames } = useVideoConfig();
  let at = 0;
  const overlap = sec(0.3);

  return (
    <AbsoluteFill>
      {score ? (
        <Audio
          src={staticFile(score)}
          // Up over half a second so it does not begin mid-note, and away over
          // the last two so the end is a decision rather than a power cut.
          volume={(frame) =>
            Math.min(
              interpolate(frame, [0, sec(0.5)], [0, 1], { extrapolateRight: 'clamp' }),
              interpolate(frame, [durationInFrames - sec(2), durationInFrames], [1, 0], {
                extrapolateLeft: 'clamp',
              }),
            )
          }
        />
      ) : null}
      {order.map(({ id, hold }) => {
        const scene = SCENES[id];
        const length = hold ?? scene.hold;
        const from = at;
        at += length - overlap;
        return (
          <Sequence key={`${id}-${from}`} from={from} durationInFrames={length}>
            {scene.node(length)}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}

/** Total frames a running order takes, once the cross-fades are counted. */
export function reelLength(order: { id: keyof typeof SCENES; hold?: number }[]) {
  const overlap = sec(0.3);
  return order.reduce(
    (total, { id, hold }) => total + (hold ?? SCENES[id].hold) - overlap,
    overlap,
  );
}
