import type { CSSProperties, ReactNode } from 'react';
import { Easing, interpolate, useCurrentFrame } from 'remotion';
import { color, fontFamily, sec } from './theme';
import { Rangoli, Toran, festive } from './festive';

/**
 * The app, drawn rather than filmed.
 *
 * Earlier cuts played back a screen recording of the real thing. That is the
 * most honest way to show a product and the worst way to show it quickly: a
 * recording moves at the speed a browser navigates, most of every shot is the
 * page sitting still, and the one number the caption is about is nine
 * point-something of a 390-pixel column. Redrawing the same screens means each
 * one can arrive in a third of a second and spend its whole life doing the
 * thing it is there to show.
 *
 * The rule that keeps it from becoming a lie: every figure, label and rule
 * below is the one in `capture/harness/society/demo-data.ts`, which is the
 * data the filmed cut used. ₹32,300 of ₹35,000 here is ₹32,300 of ₹35,000
 * there. The layout is the app's mobile layout — a festival header, a scroll,
 * and the four-tab bar from `apps/web/src/components/sidebar-nav.tsx`. Nothing
 * here is a screen the product does not have or a number it would not show.
 */

/** Logical phone pixels. Everything in this file is written at this scale. */
export const SCREEN = { width: 390, height: 844 };

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
/** Eased 0→1 across a window, clamped at both ends. */
export function ramp(frame: number, from: number, to: number, easing = Easing.out(Easing.cubic)) {
  return interpolate(frame, [from, to], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing,
  });
}

/**
 * A spring, for things that arrive rather than fade.
 *
 * Remotion ships one, but it needs the fps out of context and returns a value
 * that overshoots past 1 — which is the point, and also means it cannot be
 * used as an opacity. This is the same curve written so it can drive a
 * transform while `ramp` drives the opacity beside it.
 */
export function settle(frame: number, at: number, stiffness = 9, damping = 0.62) {
  const t = Math.max(0, (frame - sec(at)) / sec(1));
  if (t <= 0) return 0;
  const decay = Math.exp(-damping * stiffness * t);
  return 1 - decay * Math.cos(stiffness * Math.sqrt(1 - damping * damping) * t);
}

/** A row that rises into place, staggered by its index. */
function rise(frame: number, index: number, at = 0.25, step = 0.07) {
  return ramp(frame, sec(at + index * step), sec(at + index * step + 0.42));
}

/**
 * Indian digit grouping, written out rather than left to `Intl`.
 *
 * The app renders ₹1,46,300, not ₹146,300, and a demo that groups its rupees
 * the American way is a demo made somewhere else.
 */
export function rupees(value: number) {
  const digits = String(Math.round(Math.abs(value)));
  const tail = digits.slice(-3);
  const head = digits.slice(0, -3);
  const grouped = head ? `${head.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${tail}` : tail;
  return `${value < 0 ? '−' : ''}₹${grouped}`;
}

/** A number that counts up to its value, so a total lands rather than appears. */
function counted(frame: number, to: number, from = 0, at = 0.2, over = 1.1) {
  return from + (to - from) * ramp(frame, sec(at), sec(at + over));
}

/**
 * A finger, pressing.
 *
 * Without one, every screen in this cut changes by itself: a bill approves, a
 * payment confirms, a decision records, and nothing visible caused any of it.
 * A demo of a product people use should show it being used, and on a phone
 * that means a thumb rather than a cursor.
 */
export function Tap({ x, y, at, label }: { x: number; y: number; at: number; label?: string }) {
  const frame = useCurrentFrame();
  const approach = ramp(frame, sec(at - 0.34), sec(at), Easing.out(Easing.quad));
  const press = ramp(frame, sec(at), sec(at + 0.1));
  const lift = ramp(frame, sec(at + 0.16), sec(at + 0.42));
  const ripple = ramp(frame, sec(at), sec(at + 0.55), Easing.out(Easing.quad));
  if (frame < sec(at - 0.34)) return null;
  return (
    <div style={{ position: 'absolute', left: x, top: y, pointerEvents: 'none' }}>
      {/* The ring the press throws off, which is what reads as a tap. */}
      <div
        style={{
          position: 'absolute',
          left: -34,
          top: -34,
          width: 68,
          height: 68,
          borderRadius: 999,
          border: `2px solid ${festive.accent}`,
          opacity: (1 - ripple) * press,
          transform: `scale(${0.35 + ripple * 1.05})`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: -17,
          top: -17,
          width: 34,
          height: 34,
          borderRadius: 999,
          backgroundColor: 'oklch(0.26 0.06 58 / 0.24)',
          border: '2px solid rgba(255,255,255,0.75)',
          opacity: approach * (1 - lift * 0.85),
          transform: `scale(${(0.8 + approach * 0.2) * (1 - press * 0.18)})`,
        }}
      />
      {label ? (
        <div
          style={{
            position: 'absolute',
            left: 26,
            top: -9,
            whiteSpace: 'nowrap',
            fontSize: 12,
            fontWeight: 600,
            color: festive.ribbon,
            opacity: press * (1 - lift),
          }}
        >
          {label}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chrome
// ---------------------------------------------------------------------------
const ink = color.ink;
const muted = color.inkMuted;
const subtle = color.inkSubtle;

/** The status bar and the tab bar do not scroll or slide; see portrait.tsx. */
export const STATUS_H = 44;
export const BAR_H = 62;

export function StatusBar() {
  return (
    <div
      style={{
        height: STATUS_H,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 22px 0 26px',
        fontSize: 13,
        fontWeight: 600,
        color: ink,
      }}
    >
      <span>9:41</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        {[4, 6, 8, 10].map((h) => (
          <span key={h} style={{ width: 3, height: h, borderRadius: 1, backgroundColor: ink }} />
        ))}
        <span
          style={{
            marginLeft: 3,
            width: 22,
            height: 11,
            borderRadius: 3,
            border: `1px solid ${ink}`,
            padding: 1.5,
          }}
        >
          <span style={{ display: 'block', width: '72%', height: '100%', backgroundColor: ink }} />
        </span>
      </span>
    </div>
  );
}

/** The festival header: wash, toran, kolam — the app's own, at phone size. */
function FestivalTop({ title, sub, frame }: { title: string; sub: string; frame: number }) {
  const entered = ramp(frame, 0, sec(0.5));
  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: festive.wash,
        borderBottom: `1px solid ${color.border}`,
        padding: '26px 18px 18px',
      }}
    >
      <div style={{ position: 'absolute', inset: '0 0 auto 0', opacity: 0.7 }}>
        <Toran width={SCREEN.width} scale={0.62} />
      </div>
      <div style={{ position: 'absolute', top: -34, right: -28, opacity: 0.13 }}>
        <Rangoli size={150} spin={frame * 0.12} strokeWidth={1.4} />
      </div>
      <div style={{ position: 'relative', opacity: entered }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.09em', color: muted }}>
          SHANTI NIVAS
        </div>
        <div style={{ fontSize: 21, fontWeight: 600, letterSpacing: '-0.02em', color: ink }}>
          {title}
        </div>
        <div style={{ fontSize: 13, color: muted, marginTop: 2 }}>{sub}</div>
      </div>
    </div>
  );
}

/** Everything that is not an event page: a plain title bar. */
function PlainTop({ title, sub }: { title: string; sub?: string }) {
  return (
    <div
      style={{
        backgroundColor: color.surfaceRaised,
        borderBottom: `1px solid ${color.border}`,
        padding: '18px 18px 16px',
      }}
    >
      <div style={{ fontSize: 21, fontWeight: 600, letterSpacing: '-0.02em', color: ink }}>
        {title}
      </div>
      {sub ? <div style={{ fontSize: 13, color: muted, marginTop: 2 }}>{sub}</div> : null}
    </div>
  );
}

const ICONS: Record<string, string> = {
  // Lucide, the set the app already uses: LayoutDashboard, CalendarDays,
  // Wallet, SquareMenu, UserRound.
  Home: 'M3 3h7v7H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 14h7v7H3z',
  Events: 'M3 5h18v16H3zM3 10h18M8 2v4M16 2v4M8 14h.01M12 14h.01M16 14h.01',
  Money: 'M3 7h15a3 3 0 013 3v7a3 3 0 01-3 3H6a3 3 0 01-3-3zM3 7a3 3 0 013-3h9M17 13h.01',
  Manage: 'M3 4h18v16H3zM7 9h10M7 13h10M7 17h5',
  Me: 'M12 3a4 4 0 110 8 4 4 0 010-8zM4 21a8 8 0 0116 0',
};

/**
 * The four-tab bar.
 *
 * Which four depends on the role, and the app is specific about it: residents
 * get Home, Events, Money, Me; the committee trades Money for Manage, because
 * what is waiting on them is why they opened the app. Passing the set per
 * screen keeps that true instead of drawing one bar everywhere.
 */
export function BottomBar({ tabs, active }: { tabs: string[]; active: string }) {
  return (
    <div
      style={{
        height: BAR_H,
        display: 'grid',
        gridAutoFlow: 'column',
        gridAutoColumns: '1fr',
        borderTop: `1px solid ${color.border}`,
        backgroundColor: color.surfaceRaised,
        paddingBottom: 12,
      }}
    >
      {tabs.map((tab) => {
        const on = tab === active;
        return (
          <div
            key={tab}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              padding: '9px 0 4px',
              fontSize: 10.5,
              fontWeight: on ? 600 : 500,
              color: on ? festive.accent : subtle,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d={ICONS[tab]}
                stroke={on ? festive.accent : subtle}
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {tab}
          </div>
        );
      })}
    </div>
  );
}

export const RESIDENT = ['Home', 'Events', 'Money', 'Me'];
export const COMMITTEE = ['Home', 'Events', 'Manage', 'Me'];

/**
 * A page: its header and its scroll, and nothing else.
 *
 * The status bar and the tab bar are deliberately absent. They are drawn once,
 * over every page, by the reel — because in a real app they are the parts that
 * stay while the page under them changes, and a transition that slides two
 * clocks and two Home tabs past each other is a transition no app makes. The
 * space they occupy is reserved here so nothing is drawn underneath them.
 */
function Page({ top, children }: { top: ReactNode; children: ReactNode }) {
  return (
    <div
      style={{
        position: 'relative',
        width: SCREEN.width,
        height: SCREEN.height,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: color.surface,
        fontFamily,
        color: ink,
        overflow: 'hidden',
      }}
    >
      <div style={{ height: STATUS_H, flexShrink: 0 }} />
      {top}
      <div style={{ flex: 1, overflow: 'hidden', padding: '14px 14px 0' }}>{children}</div>
      <div style={{ height: BAR_H, flexShrink: 0 }} />
    </div>
  );
}

/** The app's card: raised surface, hairline border, soft corner. */
function Card({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        backgroundColor: color.surfaceRaised,
        border: `1px solid ${color.border}`,
        borderRadius: 14,
        padding: 14,
        marginBottom: 10,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/**
 * A progress bar that fills as the shot runs.
 *
 * `blend` is for the festival fund only, where the sweep from ribbon red into
 * marigold is the festival's own gradient. Everywhere else the bar's colour is
 * carrying a meaning — under budget, short of volunteers — and a two-colour
 * bar says a full row is half one thing and half another.
 */
/** The app's striped segment: money reported and not yet confirmed. */
const stripes = (tone: string) =>
  `repeating-linear-gradient(-45deg, ${tone} 0 4px, color-mix(in oklch, ${tone} 30%, transparent) 4px 8px)`;

/** A fund key's swatch, beside its label. */
const KEY_SWATCH: CSSProperties = {
  display: 'inline-block',
  width: 12,
  height: 8,
  borderRadius: 2,
  marginRight: 6,
  verticalAlign: 'middle',
};

function Bar({
  fraction,
  pending = 0,
  tone = festive.accent,
  blend = false,
}: {
  fraction: number;
  /** Striped, after the solid part, as the app's fund bar draws it. */
  pending?: number;
  tone?: string;
  blend?: boolean;
}) {
  const solid = Math.max(0, Math.min(1, fraction));
  const waiting = Math.max(0, Math.min(1 - solid, pending));
  return (
    <div
      style={{
        display: 'flex',
        height: 8,
        borderRadius: 999,
        backgroundColor: color.surfaceSunken,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${solid * 100}%`,
          height: '100%',
          borderRadius: waiting > 0 ? '999px 0 0 999px' : 999,
          background: blend ? `linear-gradient(90deg, ${festive.ribbon}, ${tone})` : tone,
        }}
      />
      {waiting > 0 ? (
        <div
          style={{ width: `${waiting * 100}%`, height: '100%', backgroundImage: stripes(tone) }}
        />
      ) : null}
    </div>
  );
}

function Tick({ on, size = 17 }: { on: number; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <circle
        cx="12"
        cy="12"
        r="10"
        fill={color.accent}
        style={{ opacity: on, transform: `scale(${0.6 + on * 0.4})`, transformOrigin: '12px 12px' }}
      />
      <path
        d="M7.5 12.4l3.1 3.1 6-6.4"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        style={{ opacity: on }}
      />
    </svg>
  );
}

/** The flat chip, which is the whole point of half these rows. */
function Flat({ label }: { label: string | null }) {
  if (!label) {
    return (
      <span style={{ fontSize: 11.5, color: subtle, fontStyle: 'italic' }}>Flat not recorded</span>
    );
  }
  return (
    <span
      style={{
        fontSize: 11.5,
        fontWeight: 600,
        color: festive.ribbon,
        backgroundColor: 'oklch(0.96 0.03 40)',
        border: `1px solid oklch(0.89 0.05 40)`,
        borderRadius: 6,
        padding: '1px 6px',
      }}
    >
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// The screens
// ---------------------------------------------------------------------------

const ACTIVITIES = [
  { name: 'Classical dance', slot: '15 Sept · 6:30 pm', signed: 7, cap: 10 },
  { name: 'Children’s fancy dress', slot: '15 Sept · 5:00 pm', signed: 12, cap: 12 },
  { name: 'Bhajan group', slot: '16 Sept · 7:00 pm', signed: 4, cap: 8 },
];

/** Home: what the society is doing this month, and what it has. */
export function HomeScreen() {
  const frame = useCurrentFrame();
  return (
    <Page
      top={<FestivalTop title="Ganesh Chaturthi 2026" sub="Starts 15 September" frame={frame} />}
    >
      <Card
        style={{ opacity: rise(frame, 0), transform: `translateY(${(1 - rise(frame, 0)) * 12}px)` }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: 13, color: muted }}>In the fund</span>
          <span style={{ fontSize: 12, color: muted }}>of {rupees(35000)}</span>
        </div>
        <div
          style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.03em', margin: '2px 0 10px' }}
        >
          {rupees(counted(frame, 32300))}
        </div>
        {/* The app's card (app/app/[community]/page.tsx): what the fund holds,
            the ₹7,800 the Balance shot moves in from Summer Camp included,
            against the event's own target; striped, what is still to be
            confirmed; a key in place of sentences. */}
        <Bar
          fraction={ramp(frame, sec(0.2), sec(1.3)) * (32300 / 35000)}
          pending={ramp(frame, sec(0.8), sec(1.5)) * (2002 / 35000)}
          blend
        />
        <div style={{ display: 'flex', gap: 12, fontSize: 11.5, color: subtle, marginTop: 9 }}>
          <span>
            <span style={{ ...KEY_SWATCH, background: festive.accent }} />
            {rupees(32300)} confirmed
          </span>
          <span>
            <span style={{ ...KEY_SWATCH, backgroundImage: stripes(festive.accent) }} />
            {rupees(2002)} to be confirmed
          </span>
        </div>
        <div style={{ fontSize: 12.5, color: muted, marginTop: 3 }}>
          {rupees(24500)} from 18 of 24 flats
        </div>
      </Card>
      <div style={{ display: 'flex', gap: 10 }}>
        {[
          { label: 'Kept for the society', value: 4200 },
          { label: 'Spent this year', value: 31200 },
        ].map((tile, index) => (
          <Card
            key={tile.label}
            style={{
              flex: 1,
              opacity: rise(frame, index + 1),
              transform: `translateY(${(1 - rise(frame, index + 1)) * 12}px)`,
            }}
          >
            <div style={{ fontSize: 11.5, color: muted }}>{tile.label}</div>
            <div style={{ fontSize: 20, fontWeight: 650, marginTop: 3 }}>
              {rupees(counted(frame, tile.value, 0, 0.35, 0.9))}
            </div>
          </Card>
        ))}
      </div>
      <Card
        style={{ opacity: rise(frame, 3), transform: `translateY(${(1 - rise(frame, 3)) * 12}px)` }}
      >
        <div style={{ fontSize: 12.5, fontWeight: 600, color: muted, marginBottom: 8 }}>
          COMING UP
        </div>
        {/* After 15 September, in order. Independence Day sat here once: on the
            Home screen of a society in mid-September, that is a month gone. */}
        {[
          { name: 'Deepavali 2026', when: '8 November' },
          { name: 'Christmas 2026', when: '25 December' },
        ].map((event) => (
          <div
            key={event.name}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '7px 0',
              fontSize: 14,
            }}
          >
            <span>{event.name}</span>
            <span style={{ fontSize: 11.5, color: subtle }}>{event.when}</span>
          </div>
        ))}
      </Card>
      <Card
        style={{ opacity: rise(frame, 4), transform: `translateY(${(1 - rise(frame, 4)) * 12}px)` }}
      >
        <div style={{ fontSize: 12.5, fontWeight: 600, color: muted, marginBottom: 8 }}>
          WHAT’S ON
        </div>
        {ACTIVITIES.map((activity) => (
          <div
            key={activity.name}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '7px 0',
            }}
          >
            <div>
              <div style={{ fontSize: 14 }}>{activity.name}</div>
              <div style={{ fontSize: 11.5, color: subtle, marginTop: 1 }}>{activity.slot}</div>
            </div>
            <span
              style={{
                fontSize: 11.5,
                fontWeight: 600,
                color: activity.signed === activity.cap ? subtle : color.accent,
              }}
            >
              {activity.signed === activity.cap
                ? 'Full'
                : `${activity.cap - activity.signed} places left`}
            </span>
          </div>
        ))}
      </Card>
    </Page>
  );
}

const CHECKLIST = [
  { title: 'Book the idol', owner: 'Bala Krishnan', done: true },
  { title: 'Confirm the priest', owner: 'Chitra Rao', done: true },
  { title: 'Sound and lights', owner: 'Bala Krishnan', done: true },
  { title: 'Order prasadam for 180', owner: 'Chitra Rao', done: true },
  { title: 'Print the programme', owner: 'Asha Menon', done: false },
  { title: 'Arrange parking marshals', owner: null, done: false },
];

const VOLUNTEERS = [
  { name: 'Kitchen help', needed: 6, signed: 6 },
  { name: 'Parking marshal', needed: 4, signed: 1 },
  { name: 'Stage and sound', needed: 3, signed: 2 },
];

/** The event page: the checklist, the ring, and who owes what. */
export function EventScreen() {
  const frame = useCurrentFrame();
  const done = CHECKLIST.filter((item) => item.done).length;
  const sweep = ramp(frame, sec(0.25), sec(1.2));
  const percent = Math.round((done / CHECKLIST.length) * 100 * sweep);
  return (
    <Page
      top={
        <FestivalTop title="Ganesh Chaturthi 2026" sub="Collecting · 15 September" frame={frame} />
      }
    >
      <Card style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <svg width="76" height="76" viewBox="0 0 76 76" style={{ flexShrink: 0 }}>
          <circle cx="38" cy="38" r="31" fill="none" stroke={color.surfaceSunken} strokeWidth="9" />
          <circle
            cx="38"
            cy="38"
            r="31"
            fill="none"
            stroke={festive.accent}
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 31}`}
            strokeDashoffset={2 * Math.PI * 31 * (1 - (done / CHECKLIST.length) * sweep)}
            transform="rotate(-90 38 38)"
          />
          <text
            x="38"
            y="43"
            textAnchor="middle"
            fontSize="19"
            fontWeight="700"
            fill={ink}
            fontFamily={fontFamily}
          >
            {percent}%
          </text>
        </svg>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Ready for the 15th</div>
          <div style={{ fontSize: 13, color: muted, marginTop: 2 }}>
            {done} of {CHECKLIST.length} jobs done
          </div>
          <div style={{ fontSize: 12.5, color: festive.ribbon, marginTop: 5, fontWeight: 600 }}>
            1 job still has nobody on it
          </div>
        </div>
      </Card>
      <Card>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: muted, marginBottom: 6 }}>
          CHECKLIST
        </div>
        {CHECKLIST.map((item, index) => {
          const shown = rise(frame, index, 0.3, 0.09);
          return (
            <div
              key={item.title}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '7px 0',
                opacity: shown,
                transform: `translateX(${(1 - shown) * 14}px)`,
              }}
            >
              {item.done ? (
                <Tick on={ramp(frame, sec(0.42 + index * 0.09), sec(0.72 + index * 0.09))} />
              ) : (
                <span
                  style={{
                    width: 17,
                    height: 17,
                    borderRadius: 999,
                    border: `1.8px solid ${color.borderStrong}`,
                    flexShrink: 0,
                  }}
                />
              )}
              <span
                style={{
                  fontSize: 14,
                  flex: 1,
                  color: item.done ? subtle : ink,
                  textDecoration: item.done ? 'line-through' : 'none',
                }}
              >
                {item.title}
              </span>
              <span
                style={{
                  fontSize: 11.5,
                  color: item.owner ? muted : festive.ribbon,
                  fontWeight: item.owner ? 400 : 600,
                }}
              >
                {item.owner ?? 'Unassigned'}
              </span>
            </div>
          );
        })}
      </Card>
      <Card style={{ opacity: rise(frame, 6, 0.3, 0.09) }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: muted, marginBottom: 8 }}>
          VOLUNTEERS
        </div>
        {VOLUNTEERS.map((role, index) => {
          const filled = ramp(frame, sec(0.7 + index * 0.1), sec(1.4 + index * 0.1));
          return (
            <div key={role.name} style={{ padding: '6px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5 }}>
                <span>{role.name}</span>
                <span style={{ color: role.signed < role.needed ? festive.ribbon : subtle }}>
                  {role.signed} of {role.needed}
                </span>
              </div>
              <div style={{ marginTop: 5 }}>
                <Bar
                  fraction={(role.signed / role.needed) * filled}
                  tone={role.signed < role.needed ? festive.accent : color.accent}
                />
              </div>
            </div>
          );
        })}
      </Card>
    </Page>
  );
}

/** Contribute: an amount, a UPI handoff, and a note the committee can read. */
export function PayScreen() {
  const frame = useCurrentFrame();
  const typed = Math.round(counted(frame, 2001, 0, 0.2, 0.7));
  const pressed = ramp(frame, sec(1.35), sec(1.5));
  const sent = ramp(frame, sec(1.6), sec(2.0));
  return (
    <Page top={<PlainTop title="Contribute" sub="Ganesh Chaturthi 2026" />}>
      <Card>
        <div style={{ fontSize: 12.5, color: muted, marginBottom: 6 }}>How much?</div>
        <div
          style={{
            border: `1.5px solid ${festive.accent}`,
            borderRadius: 11,
            padding: '13px 14px',
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: '-0.03em',
            backgroundColor: color.surface,
          }}
        >
          {rupees(typed)}
          <span
            style={{
              display: 'inline-block',
              width: 2,
              height: 26,
              marginLeft: 3,
              verticalAlign: '-4px',
              backgroundColor: festive.accent,
              opacity: pressed > 0 ? 0 : frame % 20 < 10 ? 1 : 0,
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: 7, marginTop: 10 }}>
          {[501, 1001, 2001, 5001].map((amount) => (
            <span
              key={amount}
              style={{
                flex: 1,
                textAlign: 'center',
                fontSize: 12.5,
                fontWeight: 600,
                padding: '6px 0',
                borderRadius: 8,
                border: `1px solid ${amount === 2001 ? festive.accent : color.border}`,
                color: amount === 2001 ? festive.accent : muted,
                backgroundColor: amount === 2001 ? festive.wash : color.surfaceRaised,
              }}
            >
              {rupees(amount)}
            </span>
          ))}
        </div>
      </Card>
      <div
        style={{
          backgroundColor: festive.accent,
          color: 'white',
          borderRadius: 12,
          padding: '15px 0',
          textAlign: 'center',
          fontSize: 16,
          fontWeight: 650,
          transform: `scale(${1 - pressed * 0.03})`,
          boxShadow: `0 6px 18px oklch(0.6 0.17 62 / ${0.3 - pressed * 0.2})`,
        }}
      >
        Pay with UPI
      </div>
      <div
        style={{
          marginTop: 9,
          border: `1px solid ${color.border}`,
          backgroundColor: color.surfaceRaised,
          borderRadius: 11,
          padding: '12px 14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 550 }}>Copy UPI ID</div>
          <div style={{ fontSize: 11.5, color: subtle, marginTop: 1 }}>shantinivas@okaxis</div>
        </div>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
          <rect x="9" y="9" width="11" height="11" rx="2.5" stroke={muted} strokeWidth="1.9" />
          <path d="M5 15V6a2 2 0 012-2h8" stroke={muted} strokeWidth="1.9" strokeLinecap="round" />
        </svg>
      </div>
      <Card
        style={{
          marginTop: 12,
          opacity: sent,
          transform: `translateY(${(1 - sent) * 16}px)`,
          borderColor: color.accent,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Tick on={sent} size={22} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Opening your UPI app</div>
            <div style={{ fontSize: 12.5, color: muted, marginTop: 1 }}>
              The note is filled in already, so the committee can tell your payment apart.
            </div>
          </div>
        </div>
      </Card>
      <div
        style={{
          fontSize: 12.5,
          color: muted,
          lineHeight: 1.45,
          padding: '2px 4px',
          opacity: ramp(frame, sec(2.0), sec(2.4)),
        }}
      >
        It lands on the Money page with your name and your flat against it, for everyone in the
        society to see.
      </div>
    </Page>
  );
}

const INFLOWS = [
  { name: 'Asha Menon', flat: 'A 402', method: 'UPI', amount: 2001 },
  { name: 'Esha Patil', flat: 'B 306', method: 'UPI', amount: 3001 },
  { name: 'Dev Sharma', flat: 'B 1104', method: 'UPI', amount: 1001 },
  { name: 'Pranav Aditya', flat: null, method: 'UPI', amount: 1001 },
  { name: 'Cash at the door', flat: 'A 703', method: 'Cash', amount: 500 },
];

const OUTFLOWS = [
  { name: 'Anand Caterers', detail: 'Prasadam for 180 · bill attached', amount: 16300 },
  { name: 'Paper Glow Decorators', detail: 'Decoration · bill attached', amount: 8400 },
  { name: 'Sri Ganesh Sound Service', detail: 'Sound and lights · bill attached', amount: 6500 },
];

/** Money: every rupee in, with a name and a flat beside it. */
export function MoneyScreen() {
  const frame = useCurrentFrame();
  // The newest row lands last and is the one the previous shot just paid.
  const highlight = ramp(frame, sec(1.5), sec(2.0));
  return (
    <Page top={<PlainTop title="Money" sub="Every rupee, in and out" />}>
      <Card style={{ display: 'flex', justifyContent: 'space-between' }}>
        {[
          { label: 'In', value: 46500, tone: color.accent },
          { label: 'Out', value: -31200, tone: festive.ribbon },
          { label: 'Left', value: 15300, tone: ink },
        ].map((total) => (
          <div key={total.label}>
            <div style={{ fontSize: 11.5, color: muted }}>{total.label}</div>
            <div style={{ fontSize: 17, fontWeight: 650, color: total.tone, marginTop: 2 }}>
              {rupees(counted(frame, total.value, 0, 0.15, 0.85))}
            </div>
          </div>
        ))}
      </Card>
      <Card style={{ padding: '6px 14px' }}>
        {INFLOWS.map((row, index) => {
          const shown = rise(frame, index, 0.3, 0.1);
          const lit = index === 0 ? highlight : 0;
          return (
            <div
              key={row.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '11px 8px',
                margin: '0 -8px',
                borderRadius: 9,
                borderBottom: index < INFLOWS.length - 1 ? `1px solid ${color.border}` : 'none',
                opacity: shown,
                transform: `translateY(${(1 - shown) * 16}px)`,
                backgroundColor: `oklch(0.97 0.05 68 / ${lit})`,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 550 }}>{row.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 4 }}>
                  <Flat label={row.flat} />
                  <span style={{ fontSize: 11.5, color: subtle }}>{row.method}</span>
                </div>
              </div>
              <div style={{ fontSize: 15.5, fontWeight: 650, color: color.accent }}>
                +{rupees(row.amount)}
              </div>
            </div>
          );
        })}
      </Card>
      <div style={{ fontSize: 12, fontWeight: 600, color: muted, margin: '2px 4px 7px' }}>
        MONEY OUT
      </div>
      <Card style={{ padding: '6px 14px' }}>
        {OUTFLOWS.map((row, index) => {
          const shown = rise(frame, index + 5, 0.3, 0.1);
          return (
            <div
              key={row.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 0',
                borderBottom: index < OUTFLOWS.length - 1 ? `1px solid ${color.border}` : 'none',
                opacity: shown,
                transform: `translateY(${(1 - shown) * 16}px)`,
              }}
            >
              <div>
                <div style={{ fontSize: 14.5, fontWeight: 550 }}>{row.name}</div>
                <div style={{ fontSize: 11.5, color: subtle, marginTop: 3 }}>{row.detail}</div>
              </div>
              <div style={{ fontSize: 15.5, fontWeight: 650, color: festive.ribbon }}>
                {rupees(-row.amount)}
              </div>
            </div>
          );
        })}
      </Card>
    </Page>
  );
}

const BILLS = [
  { name: 'Prasadam for 180', vendor: 'Anand Caterers', amount: 16300, by: 'Chitra Rao' },
  { name: 'Decoration', vendor: 'Paper Glow Decorators', amount: 8400, by: 'Bala Krishnan' },
  {
    name: 'Sound and lights',
    vendor: 'Sri Ganesh Sound Service',
    amount: 6500,
    by: 'Bala Krishnan',
  },
];

const BUDGET = [
  { category: 'Food', planned: 18000, spent: 16300 },
  { category: 'Decor', planned: 9000, spent: 8400 },
  { category: 'Production', planned: 6000, spent: 6500 },
  { category: 'Printing', planned: 2000, spent: 0 },
];

/**
 * Bills: three signed off, and the one the person looking at it filed.
 *
 * That last card is the shot. The rule is enforced in the database, not in the
 * interface, and the only way to show a rule is to show it refusing.
 */
export function BillsScreen() {
  const frame = useCurrentFrame();
  const arrives = ramp(frame, sec(0.85), sec(1.3));
  const locks = ramp(frame, sec(1.5), sec(1.95));
  return (
    <Page top={<PlainTop title="Bills" sub="Ganesh Chaturthi 2026" />}>
      {BILLS.map((bill, index) => {
        const shown = rise(frame, index, 0.15, 0.09);
        return (
          <Card
            key={bill.name}
            style={{
              opacity: shown,
              transform: `translateY(${(1 - shown) * 12}px)`,
              padding: 12,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 14.5, fontWeight: 550 }}>{bill.name}</div>
                <div style={{ fontSize: 11.5, color: subtle, marginTop: 2 }}>{bill.vendor}</div>
              </div>
              <div style={{ fontSize: 15, fontWeight: 650 }}>{rupees(bill.amount)}</div>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginTop: 8,
                fontSize: 11.5,
                color: color.accent,
                fontWeight: 600,
              }}
            >
              <Tick on={ramp(frame, sec(0.35 + index * 0.09), sec(0.6 + index * 0.09))} size={14} />
              Approved by {bill.by}
            </div>
          </Card>
        );
      })}
      <Card
        style={{
          opacity: arrives,
          transform: `translateY(${(1 - arrives) * 18}px)`,
          borderColor: festive.accent,
          borderWidth: 1.5,
          backgroundColor: festive.wash,
          padding: 12,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 550 }}>Idol and puja items</div>
            <div style={{ fontSize: 11.5, color: subtle, marginTop: 2 }}>Sri Vinayaka Stores</div>
          </div>
          <div style={{ fontSize: 15, fontWeight: 650 }}>{rupees(9200)}</div>
        </div>
        <div
          style={{
            marginTop: 10,
            borderRadius: 9,
            padding: '9px 11px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            backgroundColor: color.surfaceRaised,
            border: `1px solid ${color.border}`,
            opacity: locks,
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
            <rect x="4" y="10" width="16" height="11" rx="2.5" stroke={muted} strokeWidth="1.9" />
            <path
              d="M8 10V7a4 4 0 018 0v3"
              stroke={muted}
              strokeWidth="1.9"
              strokeLinecap="round"
            />
          </svg>
          <span style={{ fontSize: 12.5, color: muted, lineHeight: 1.35 }}>
            You filed this one. Another committee member has to approve it.
          </span>
        </div>
      </Card>
      <Card style={{ opacity: ramp(frame, sec(1.1), sec(1.6)) }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: muted, marginBottom: 8 }}>
          AGAINST BUDGET
        </div>
        {BUDGET.map((line, index) => {
          const filled = ramp(frame, sec(1.2 + index * 0.08), sec(1.9 + index * 0.08));
          const over = line.spent > line.planned;
          return (
            <div key={line.category} style={{ padding: '5px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span>{line.category}</span>
                <span
                  style={{ color: over ? festive.ribbon : muted, fontWeight: over ? 600 : 400 }}
                >
                  {rupees(line.spent)} of {rupees(line.planned)}
                </span>
              </div>
              <div style={{ marginTop: 4 }}>
                <Bar
                  fraction={Math.min(1, line.spent / line.planned) * filled}
                  tone={over ? festive.ribbon : color.accent}
                />
              </div>
            </div>
          );
        })}
      </Card>
    </Page>
  );
}

const SETTLED = [
  { who: 'Esha Patil · B 306', amount: 3001, matched: true },
  { who: 'Dev Sharma · B 1104', amount: 1001, matched: true },
  { who: 'UPI/9843•••221', amount: 1500, matched: false },
];

/**
 * Reconcile: the bank statement on one side, the ledger on the other.
 *
 * Nothing pairs itself. The page offers the likeliest payment for each line —
 * here the one with the same UTR — and somebody presses Confirm, which is what
 * matchLine does ("Matched and confirmed."). An earlier cut said the statement
 * was auto-matched; it never was.
 */
export function ReconcileScreen() {
  const frame = useCurrentFrame();
  const close = ramp(frame, sec(0.7), sec(1.3), Easing.inOut(Easing.cubic));
  const offered = ramp(frame, sec(1.1), sec(1.35));
  const pressed = ramp(frame, sec(1.55), sec(1.68)) * (1 - ramp(frame, sec(1.68), sec(1.8)));
  const matched = ramp(frame, sec(1.68), sec(1.95));
  const line = (label: string, sub: string, amount: number, side: 1 | -1) => (
    <div
      style={{
        backgroundColor: color.surfaceRaised,
        border: `1px solid ${matched > 0.5 ? color.accent : color.border}`,
        borderRadius: 11,
        padding: '11px 13px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        transform: `translateX(${side * (1 - close) * 120}px)`,
        opacity: ramp(frame, sec(0.2), sec(0.6)),
      }}
    >
      <div>
        <div style={{ fontSize: 11, color: subtle, letterSpacing: '0.06em', fontWeight: 600 }}>
          {label}
        </div>
        <div style={{ fontSize: 13.5, marginTop: 2 }}>{sub}</div>
      </div>
      <div style={{ fontSize: 15, fontWeight: 650 }}>{rupees(amount)}</div>
    </div>
  );
  return (
    <Page top={<PlainTop title="Reconcile" sub="September statement" />}>
      <Card style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 12.5, color: muted }}>Matched against the bank</div>
          <div style={{ fontSize: 22, fontWeight: 700, marginTop: 2 }}>
            {Math.round(counted(frame, 23, 0, 0.15, 0.9))} of 24
          </div>
        </div>
        <div style={{ fontSize: 12.5, color: festive.ribbon, fontWeight: 600, textAlign: 'right' }}>
          1 to look at
        </div>
      </Card>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 4 }}>
        {line('BANK STATEMENT', 'UPI/ASHA MENON/4021', 2001, -1)}
        <div
          style={{
            alignSelf: 'center',
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            backgroundColor: matched > 0.5 ? color.accent : color.surfaceRaised,
            color: matched > 0.5 ? 'white' : color.accent,
            border: `1.5px solid ${color.accent}`,
            borderRadius: 999,
            padding: '5px 13px',
            fontSize: 12.5,
            fontWeight: 650,
            opacity: offered,
            transform: `scale(${(0.8 + offered * 0.2) * (1 - pressed * 0.06)})`,
          }}
        >
          {matched > 0.5 ? <Tick on={matched} size={14} /> : null}
          {matched > 0.5 ? 'Matched and confirmed' : 'Confirm'}
        </div>
        {line('COMPENCES LEDGER', 'Asha Menon · A 402 · same UTR', 2001, 1)}
      </div>
      <div style={{ marginTop: 14, opacity: ramp(frame, sec(1.75), sec(2.15)) }}>
        {SETTLED.map((row, index) => (
          <div
            key={row.who}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '9px 13px',
              marginBottom: 7,
              borderRadius: 10,
              backgroundColor: color.surfaceRaised,
              border: `1px solid ${color.border}`,
              opacity: rise(frame, index, 1.8, 0.07),
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <Tick on={row.matched ? 1 : 0} size={15} />
              <span style={{ fontSize: 13.5 }}>{row.who}</span>
            </div>
            <span
              style={{
                fontSize: 13.5,
                fontWeight: 600,
                color: row.matched ? muted : festive.ribbon,
              }}
            >
              {row.matched ? rupees(row.amount) : 'No ledger row'}
            </span>
          </div>
        ))}
      </div>
    </Page>
  );
}

// ---------------------------------------------------------------------------
// The committee's half
// ---------------------------------------------------------------------------
// Everything above is what a resident sees. The product's actual argument is
// about what happens next — somebody has to confirm the payment, somebody
// else has to approve the bill, and the rules about who may do which are the
// reason a society would move its money here rather than keep a notebook. A
// cut that stops at "you can see the ledger" is a cut about a spreadsheet.

/** The queue, exactly as `TODO_ORDER` in packages/core/src/copy.ts orders it. */
const QUEUE = [
  { emoji: '💰', section: 'Payments to confirm', count: 1, action: 'Confirm' },
  { emoji: '🙋', section: 'New residents', count: 2, action: 'Review' },
  { emoji: '🧾', section: 'Bills to approve', count: 1, action: 'Approve' },
  { emoji: '💡', section: 'Suggestions to review', count: 1, action: 'Review' },
  { emoji: '🏠', section: 'Residents who moved', count: 1, action: 'Approve' },
];

/**
 * To do: everything waiting on the committee, in one list.
 *
 * The payment made two screens earlier lands at the top of it while the shot
 * runs — which is the only way to show that the two things are the same event
 * seen from two sides.
 */
export function TodoScreen() {
  const frame = useCurrentFrame();
  const lands = ramp(frame, sec(0.9), sec(1.3));
  return (
    <Page top={<PlainTop title="To do" sub="Waiting on the committee" />}>
      <Card style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 13, color: muted }}>Waiting on you</div>
        <div style={{ fontSize: 26, fontWeight: 700 }}>
          {Math.round(counted(frame, 6, 5, 0.9, 0.4))}
        </div>
      </Card>
      {QUEUE.map((row, index) => {
        const shown = rise(frame, index, 0.2, 0.08);
        const first = index === 0;
        return (
          <Card
            key={row.section}
            style={{
              opacity: shown,
              transform: `translateY(${(1 - shown) * 12}px)`,
              padding: 12,
              borderColor: first && lands > 0.4 ? festive.accent : color.border,
              backgroundColor: first ? `oklch(0.97 0.05 68 / ${lands})` : color.surfaceRaised,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <span style={{ fontSize: 20 }}>{row.emoji}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 550 }}>{row.section}</div>
                <div style={{ fontSize: 11.5, color: subtle, marginTop: 2 }}>
                  {first ? (
                    <span style={{ opacity: lands }}>Asha Menon · A 402 · {rupees(2001)}</span>
                  ) : (
                    `${row.count} waiting`
                  )}
                </div>
              </div>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 650,
                  color: festive.accent,
                  border: `1px solid ${festive.accent}`,
                  borderRadius: 7,
                  padding: '4px 10px',
                }}
              >
                {row.action}
              </span>
            </div>
          </Card>
        );
      })}
      <div
        style={{
          marginTop: 6,
          padding: '0 4px',
          fontSize: 12.5,
          color: subtle,
          lineHeight: 1.45,
          opacity: ramp(frame, sec(1.6), sec(2.1)),
        }}
      >
        Payments to confirm, new residents, bills and suggestions show up here when they need you.
      </div>
      {/* On the Confirm pill of the top row: page padding 14, card padding 12,
          and the pill is about 74 wide, so its centre sits at 390-14-12-37. */}
      <Tap x={327} y={236} at={2.0} />
    </Page>
  );
}

/**
 * Confirming a payment — and the one nobody may confirm.
 *
 * The rule is enforced in the database, and the only way to show a rule is to
 * show it refusing. Same shape as the bill that cannot be approved by the
 * person who filed it, deliberately: it is one principle, applied twice.
 */
export function ConfirmScreen() {
  const frame = useCurrentFrame();
  const tapped = ramp(frame, sec(1.15), sec(1.35));
  const confirmed = ramp(frame, sec(1.35), sec(1.8));
  return (
    <Page top={<PlainTop title="Payments" sub="Ganesh Chaturthi 2026" />}>
      <Card
        style={{ borderColor: confirmed > 0.5 ? color.accent : festive.accent, borderWidth: 1.5 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Asha Menon</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 5 }}>
              <Flat label="A 402" />
              <span style={{ fontSize: 11.5, color: subtle }}>UPI · reported 2 min ago</span>
            </div>
          </div>
          <div style={{ fontSize: 19, fontWeight: 700 }}>{rupees(2001)}</div>
        </div>
        <div
          style={{
            marginTop: 11,
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            border: `1px solid ${color.border}`,
            borderRadius: 9,
            padding: '9px 11px',
            fontSize: 12.5,
            color: muted,
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="4" width="18" height="16" rx="2.5" stroke={muted} strokeWidth="1.9" />
            <path
              d="M3 16l5-5 4 4 3-3 6 6"
              stroke={muted}
              strokeWidth="1.9"
              strokeLinecap="round"
            />
          </svg>
          View the screenshot they sent
        </div>
        {/* The button becomes the receipt, in place, rather than vanishing. */}
        <div
          style={{
            marginTop: 10,
            borderRadius: 10,
            padding: '12px 0',
            textAlign: 'center',
            fontSize: 15,
            fontWeight: 650,
            color: 'white',
            backgroundColor: confirmed > 0.5 ? color.accent : festive.accent,
            transform: `scale(${1 - tapped * 0.03 + confirmed * 0.03})`,
          }}
        >
          {confirmed > 0.5 ? 'Confirmed by you · on the ledger' : 'Confirm'}
        </div>
        <div style={{ fontSize: 11.5, color: subtle, marginTop: 8, lineHeight: 1.4 }}>
          They reported {rupees(2001)}. If the screenshot says otherwise, correct it here — the
          corrected figure is the one the ledger keeps.
        </div>
      </Card>
      <Card style={{ backgroundColor: color.surfaceSunken }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Chitra Rao</div>
            <div style={{ fontSize: 11.5, color: subtle, marginTop: 4 }}>you · UPI · yesterday</div>
          </div>
          <div style={{ fontSize: 19, fontWeight: 700 }}>{rupees(1001)}</div>
        </div>
        <div
          style={{
            marginTop: 11,
            borderRadius: 9,
            padding: '9px 11px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            backgroundColor: color.surfaceRaised,
            border: `1px solid ${color.border}`,
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
            <rect x="4" y="10" width="16" height="11" rx="2.5" stroke={muted} strokeWidth="1.9" />
            <path
              d="M8 10V7a4 4 0 018 0v3"
              stroke={muted}
              strokeWidth="1.9"
              strokeLinecap="round"
            />
          </svg>
          <span style={{ fontSize: 12.5, color: muted, lineHeight: 1.35 }}>
            Your own payment. Another committee member confirms it.
          </span>
        </div>
      </Card>
      <div style={{ fontSize: 12, fontWeight: 600, color: muted, margin: '4px 4px 8px' }}>
        ALREADY CONFIRMED
      </div>
      <Card style={{ padding: '6px 14px' }}>
        {[
          { who: 'Dev Sharma', flat: 'B 1104', amount: 1001, by: 'Bala Krishnan' },
          { who: 'Esha Patil', flat: 'B 306', amount: 3001, by: 'Bala Krishnan' },
        ].map((row, index) => (
          <div
            key={row.who}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 0',
              borderBottom: index === 0 ? `1px solid ${color.border}` : 'none',
              opacity: rise(frame, index, 0.5, 0.1),
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <Tick on={1} size={15} />
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 550 }}>{row.who}</div>
                <div style={{ fontSize: 11, color: subtle, marginTop: 2 }}>
                  {row.flat} · by {row.by}
                </div>
              </div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 650 }}>{rupees(row.amount)}</div>
          </div>
        ))}
      </Card>
      {/* The Confirm button sits below the screenshot row; see the card above. */}
      <Tap x={195} y={300} at={1.15} />
    </Page>
  );
}

/** What the bills were spent against. Production is over, and says so. */
export function BudgetScreen() {
  const frame = useCurrentFrame();
  return (
    <Page top={<PlainTop title="Budget" sub="Ganesh Chaturthi 2026" />}>
      <Card>
        <div style={{ fontSize: 13, color: muted }}>Planned</div>
        <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.03em', marginTop: 2 }}>
          {rupees(counted(frame, 35000))}
        </div>
        <div style={{ fontSize: 12.5, color: muted, marginTop: 7 }}>
          {rupees(31200)} spent · {rupees(3800)} still to go
        </div>
      </Card>
      <Card>
        {BUDGET.map((line, index) => {
          const filled = ramp(frame, sec(0.3 + index * 0.1), sec(1.1 + index * 0.1));
          const over = line.spent > line.planned;
          return (
            <div key={line.category} style={{ padding: '8px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <span style={{ fontWeight: 550 }}>{line.category}</span>
                <span
                  style={{ color: over ? festive.ribbon : muted, fontWeight: over ? 650 : 400 }}
                >
                  {rupees(line.spent)} of {rupees(line.planned)}
                </span>
              </div>
              <div style={{ marginTop: 6 }}>
                <Bar
                  fraction={Math.min(1, line.spent / line.planned) * filled}
                  tone={over ? festive.ribbon : color.accent}
                />
              </div>
              {over ? (
                <div
                  style={{
                    fontSize: 11.5,
                    color: festive.ribbon,
                    marginTop: 5,
                    fontWeight: 600,
                    opacity: ramp(frame, sec(1.3), sec(1.7)),
                  }}
                >
                  {rupees(line.spent - line.planned)} over budget
                </div>
              ) : null}
            </div>
          );
        })}
      </Card>
      <Card style={{ opacity: ramp(frame, sec(1.6), sec(2.1)) }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: muted, marginBottom: 6 }}>
          NOT BILLED YET
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
          <span>Printing — the programme</span>
          <span style={{ color: muted }}>{rupees(2000)} set aside</span>
        </div>
        <div style={{ fontSize: 11.5, color: subtle, marginTop: 5, lineHeight: 1.4 }}>
          Still on the checklist, still unspent, and already visible to everyone.
        </div>
      </Card>
    </Page>
  );
}

/**
 * Closure: the two answers, from `SURPLUS_ANSWER_LABEL` in core.
 *
 * There are exactly two, and the copy under each is the app's own. This is
 * the beat the rest of the video exists for: the money left at the end is
 * still residents' money, and where it goes is a decision somebody signs.
 */
export function ClosureScreen() {
  const frame = useCurrentFrame();
  const picked = ramp(frame, sec(1.2), sec(1.45));
  const recorded = ramp(frame, sec(2.0), sec(2.4));
  const answers = [
    {
      label: 'Keep it for the society',
      detail:
        'It sits with the society, on everybody’s home screen, until the committee puts it behind an event.',
    },
    {
      label: 'Put it behind another event',
      detail:
        'It shows on that event’s bar as money already received, so residents are asked only for the difference.',
    },
  ];
  return (
    <Page top={<PlainTop title="Closing the event" sub="Ganesh Chaturthi 2026" />}>
      <Card
        style={{ borderColor: festive.accent, borderWidth: 1.5, backgroundColor: festive.wash }}
      >
        <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em' }}>
          {rupees(counted(frame, 1100))} left over
        </div>
        <div style={{ fontSize: 12.5, color: muted, marginTop: 5, lineHeight: 1.4 }}>
          Residents’ money the event did not spend. The committee decides where it goes, and
          everybody sees the decision.
        </div>
      </Card>
      {answers.map((answer, index) => {
        const chosen = index === 0 ? picked : 0;
        const shown = rise(frame, index, 0.35, 0.12);
        return (
          <Card
            key={answer.label}
            style={{
              opacity: shown,
              transform: `translateY(${(1 - shown) * 12}px)`,
              display: 'flex',
              gap: 11,
              padding: 12,
              borderWidth: chosen > 0.5 ? 2 : 1,
              borderColor: chosen > 0.5 ? festive.accent : color.border,
            }}
          >
            <span
              style={{
                width: 18,
                height: 18,
                borderRadius: 999,
                flexShrink: 0,
                marginTop: 2,
                border: `2px solid ${chosen > 0.5 ? festive.accent : color.borderStrong}`,
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: 999,
                  backgroundColor: festive.accent,
                  transform: `scale(${chosen})`,
                }}
              />
            </span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 14, fontWeight: 600 }}>
                {answer.label}
              </span>
              <span
                style={{
                  display: 'block',
                  fontSize: 11.5,
                  color: subtle,
                  marginTop: 3,
                  lineHeight: 1.4,
                }}
              >
                {answer.detail}
              </span>
            </span>
          </Card>
        );
      })}
      <div
        style={{
          marginTop: 2,
          borderRadius: 11,
          padding: '13px 0',
          textAlign: 'center',
          fontSize: 15,
          fontWeight: 650,
          color: 'white',
          backgroundColor: recorded > 0.5 ? color.accent : festive.accent,
          opacity: 0.45 + picked * 0.55,
        }}
      >
        {recorded > 0.5 ? 'Decision recorded' : 'Record the decision'}
      </div>
      <Card
        style={{
          marginTop: 12,
          opacity: recorded,
          transform: `translateY(${(1 - recorded) * 14}px)`,
          borderColor: color.accent,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Tick on={recorded} size={20} />
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>{rupees(1100)} → the society</div>
            <div style={{ fontSize: 11.5, color: muted, marginTop: 1 }}>
              Recorded by Chitra Rao · visible to all 24 flats
            </div>
          </div>
        </div>
      </Card>
      <Tap x={40} y={186} at={1.2} />
      <Tap x={195} y={470} at={2.0} />
    </Page>
  );
}

/** Where the leftover went, and every move before it. */
export function BalanceScreen() {
  const frame = useCurrentFrame();
  const arrives = ramp(frame, sec(0.55), sec(1.05));
  const moves = [
    {
      from: 'Ganesh Chaturthi 2026',
      to: 'the society',
      amount: 1100,
      who: 'Chitra Rao',
      when: 'just now',
      fresh: true,
    },
    {
      from: 'Independence Day 2026',
      to: 'the society',
      amount: 4200,
      who: 'Bala Krishnan',
      when: '20 Aug',
    },
    {
      from: 'Summer Camp 2026',
      to: 'Ganesh Chaturthi 2026',
      amount: 7800,
      who: 'Chitra Rao',
      when: '2 Jul',
    },
  ];
  return (
    <Page top={<PlainTop title="Kept for the society" sub="Every move, and who made it" />}>
      <Card style={{ borderColor: color.accent }}>
        <div style={{ fontSize: 13, color: muted }}>Held by the society</div>
        <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-0.03em', marginTop: 2 }}>
          {rupees(4200 + 1100 * arrives)}
        </div>
        <div style={{ fontSize: 12.5, color: muted, marginTop: 6 }}>
          Not in anybody’s account. On everybody’s home screen.
        </div>
      </Card>
      <Card style={{ padding: '6px 14px' }}>
        {moves.map((move, index) => {
          const shown = move.fresh ? arrives : rise(frame, index, 0.25, 0.09);
          return (
            <div
              key={move.from}
              style={{
                padding: '11px 8px',
                margin: '0 -8px',
                borderRadius: 9,
                borderBottom: index < moves.length - 1 ? `1px solid ${color.border}` : 'none',
                opacity: shown,
                transform: `translateY(${(1 - shown) * 14}px)`,
                backgroundColor: move.fresh ? `oklch(0.97 0.05 68 / ${arrives})` : 'transparent',
              }}
            >
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <div style={{ fontSize: 13.5, minWidth: 0 }}>
                  {move.from}
                  <span style={{ color: subtle }}> → </span>
                  {move.to}
                </div>
                <div style={{ fontSize: 15, fontWeight: 650, marginLeft: 8 }}>
                  {rupees(move.amount)}
                </div>
              </div>
              <div style={{ fontSize: 11.5, color: subtle, marginTop: 3 }}>
                {move.who} · {move.when}
              </div>
            </div>
          );
        })}
      </Card>
      <div
        style={{
          padding: '2px 4px',
          fontSize: 12.5,
          color: subtle,
          lineHeight: 1.45,
          opacity: ramp(frame, sec(1.3), sec(1.8)),
        }}
      >
        Money only moves between an event and the society, and every move keeps the name of whoever
        decided it.
      </div>
    </Page>
  );
}
