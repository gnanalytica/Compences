import { AbsoluteFill, interpolate, useCurrentFrame, Easing } from 'remotion';
import { Fade } from './components';
import { color, fontFamily, sec } from './theme';

/**
 * The surface that is not a screen.
 *
 * An MCP server has no pixels, so a screen recorder cannot point at it. This
 * is drawn instead, in the app's own palette and from the app's own source:
 * every tool name and scope below is in `apps/web/src/lib/api/mcp-tools.ts`.
 * Nothing here is a capability the product does not have.
 *
 * A WhatsApp scene used to sit above this one. It came out because the bot is
 * still in beta, and a demo that shows a beta surface beside shipped ones is
 * making a promise on its behalf.
 */

/** Eased 0→1 over a window, so nothing snaps into place. */
const ramp = (frame: number, from: number, to: number) =>
  interpolate(frame, [from, to], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

// ---------------------------------------------------------------------------
// MCP
// ---------------------------------------------------------------------------
/**
 * Every name here is a tool the server actually registers. The point of the
 * scene is the last line: `tools/list` is filtered by the key's scopes, so a
 * read-only key is never even shown the tool that would post to the society.
 */
const TOOLS = [
  { name: 'list_events', scope: 'events:read' },
  { name: 'get_event', scope: 'events:read' },
  { name: 'get_ledger', scope: 'expenses:read' },
  { name: 'list_members', scope: 'members:read' },
  { name: 'list_tasks', scope: 'events:read' },
  { name: 'list_activities', scope: 'activities:read' },
  { name: 'list_volunteer_roles', scope: 'activities:read' },
  { name: 'list_announcements', scope: 'announcements:read' },
];

const WITHHELD = [
  { name: 'add_task', scope: 'events:write' },
  { name: 'file_expense', scope: 'expenses:write' },
  { name: 'post_announcement', scope: 'announcements:write' },
];

export function McpScene({ hold }: { hold: number }) {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: color.accentDeeper, fontFamily }}>
      <Fade hold={hold}>
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            paddingBottom: 170,
            gap: 34,
          }}
        >
          <div style={{ display: 'flex', gap: 34, alignItems: 'flex-start' }}>
            {/* The config somebody actually pastes. */}
            <div
              style={{
                width: 620,
                backgroundColor: 'rgba(0,0,0,0.28)',
                border: '1px solid rgba(255,255,255,0.14)',
                borderRadius: 16,
                padding: '24px 28px',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: 23,
                lineHeight: 1.6,
                color: 'rgba(255,255,255,0.92)',
                // HTML collapses leading spaces, so without this the config
                // draws flush left and reads as sloppy JSON rather than JSON.
                whiteSpace: 'pre',
                opacity: ramp(frame, sec(0.3), sec(1.1)),
              }}
            >
              <div style={{ color: 'rgba(255,255,255,0.5)' }}>{'{'}</div>
              <div>{'  "compences": {'}</div>
              <div>{'    "type": "http",'}</div>
              <div>{'    "url": "…/api/mcp",'}</div>
              <div>{'    "headers": {'}</div>
              <div style={{ color: '#7fe3c0' }}>{'      "Authorization":'}</div>
              <div style={{ color: '#7fe3c0' }}>{'        "Bearer sam_live_…"'}</div>
              <div>{'    }'}</div>
              <div>{'  }'}</div>
              <div style={{ color: 'rgba(255,255,255,0.5)' }}>{'}'}</div>
            </div>

            {/* What the key is then allowed to see. */}
            <div style={{ width: 640 }}>
              <div
                style={{
                  color: 'rgba(255,255,255,0.62)',
                  fontSize: 22,
                  letterSpacing: 0.4,
                  textTransform: 'uppercase',
                  marginBottom: 14,
                  opacity: ramp(frame, sec(1.1), sec(1.5)),
                }}
              >
                tools/list · read-only key
              </div>
              {TOOLS.map((tool, index) => {
                const appear = ramp(frame, sec(1.4 + index * 0.16), sec(1.75 + index * 0.16));
                return (
                  <div
                    key={tool.name}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: 'rgba(255,255,255,0.07)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: 10,
                      padding: '11px 18px',
                      marginBottom: 9,
                      opacity: appear,
                      transform: `translateX(${(1 - appear) * 18}px)`,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                        fontSize: 24,
                        color: '#fff',
                      }}
                    >
                      {tool.name}
                    </span>
                    <span style={{ fontSize: 20, color: 'rgba(255,255,255,0.55)' }}>
                      {tool.scope}
                    </span>
                  </div>
                );
              })}

              {WITHHELD.map((tool, index) => {
                const appear = ramp(frame, sec(3.1 + index * 0.14), sec(3.5 + index * 0.14));
                return (
                  <div
                    key={tool.name}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      border: '1px dashed rgba(255,255,255,0.22)',
                      borderRadius: 10,
                      padding: '11px 18px',
                      marginBottom: 9,
                      opacity: appear * 0.5,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                        fontSize: 24,
                        color: 'rgba(255,255,255,0.7)',
                        textDecoration: 'line-through',
                      }}
                    >
                      {tool.name}
                    </span>
                    <span style={{ fontSize: 20, color: 'rgba(255,255,255,0.5)' }}>
                      not in scope
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </AbsoluteFill>
      </Fade>
    </AbsoluteFill>
  );
}
