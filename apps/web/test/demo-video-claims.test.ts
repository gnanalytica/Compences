import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The demo video may not claim a capability the product does not have.
 *
 * A recording of the app cannot lie. A drawing can say anything, and the
 * video has a lot of drawing in it now — the MCP scene, because an MCP server
 * has no pixels to film, and the whole portrait cut. The first draft of the
 * MCP scene invented four scope names that read perfectly and matched
 * nothing.
 *
 * So every tool name and scope it shows is checked against the source it came
 * from, and the drawn screens are checked against the demo data the filmed
 * cuts use. A tool renamed in `mcp-tools.ts`, or a figure that drifts between
 * two screens, fails here rather than shipping as a promise the product does
 * not keep.
 */
const ROOT = join(import.meta.dirname, '..', '..', '..');
const surfaces = () => readFileSync(join(ROOT, 'video', 'src', 'surfaces.tsx'), 'utf8');
const screens = () => readFileSync(join(ROOT, 'video', 'src', 'screens.tsx'), 'utf8');
const scenes = () => readFileSync(join(ROOT, 'video', 'src', 'scenes.tsx'), 'utf8');
const logo = () => readFileSync(join(ROOT, 'video', 'src', 'logo.tsx'), 'utf8');
const story = () => readFileSync(join(ROOT, 'video', 'src', 'story.tsx'), 'utf8');
const mobileSite = () =>
  readFileSync(join(ROOT, 'apps', 'mobile', 'src', 'lib', 'site.ts'), 'utf8');
const demoData = () =>
  readFileSync(join(ROOT, 'video', 'capture', 'harness', 'society', 'demo-data.ts'), 'utf8');
const mcpTools = () =>
  readFileSync(join(ROOT, 'apps', 'web', 'src', 'lib', 'api', 'mcp-tools.ts'), 'utf8');

/** `{ name: 'x', scope: 'y' }` as the scene lists them. */
function scenePairs() {
  return [...surfaces().matchAll(/\{ name: '([a-z_]+)', scope: '([a-z:]+)' \}/g)].map((match) => ({
    name: match[1],
    scope: match[2],
  }));
}

/** The real registry: a `name:` and the `scope:` that follows it. */
function realScopes() {
  const source = mcpTools();
  const found = new Map<string, string>();
  for (const match of source.matchAll(/name: '([a-z_]+)',[\s\S]{0,700}?scope: '([a-z:]+)'/g)) {
    if (!found.has(match[1])) found.set(match[1], match[2]);
  }
  return found;
}

describe('what the drawn scenes claim', () => {
  it('shows enough MCP tools to be worth checking', () => {
    // Guards the regex above: if it stops matching, every assertion below
    // passes over an empty list and the test becomes decoration.
    expect(scenePairs().length).toBeGreaterThanOrEqual(10);
    expect(realScopes().size).toBeGreaterThanOrEqual(12);
  });

  it('names only tools the MCP server actually registers', () => {
    const real = realScopes();
    for (const { name } of scenePairs()) {
      expect(real.has(name), `${name} is in the video but not in mcp-tools.ts`).toBe(true);
    }
  });

  it('gives each tool the scope the server gives it', () => {
    const real = realScopes();
    for (const { name, scope } of scenePairs()) {
      expect(scope, `${name} is shown under the wrong scope`).toBe(real.get(name));
    }
  });

  it('withholds a write tool from the read-only key, which is the point', () => {
    // The scene's argument is that tools/list is filtered by scope. If every
    // tool it struck through were a read tool, it would be arguing nothing.
    const source = surfaces();
    const withheld = source.slice(source.indexOf('const WITHHELD'));
    expect(withheld).toContain(':write');
    expect(withheld).toContain('not in scope');
  });

  it('draws the same figures the filmed cuts show', () => {
    // The portrait cut is drawn from memory of the harness rather than from an
    // import — video/ is outside the workspace graph, so it cannot import the
    // harness module. That makes drift silent: a figure changed in one place
    // and not the other is a video whose two halves disagree about the same
    // society, which is a demo of a bug.
    const drawn = screens();
    const data = demoData();
    const figures = [
      [24500, 'raised for Ganesh Chaturthi'],
      [35000, 'the target'],
      [7800, 'carried in from Summer Camp'],
      [31200, 'spent'],
      [46500, 'collected across the year'],
      [15300, 'what that leaves'],
      [4200, 'the society balance'],
      [16300, 'the caterer'],
      [8400, 'the decorator'],
      [6500, 'sound and lights'],
      [9200, 'the bill nobody may approve'],
    ] as const;
    for (const [amount, what] of figures) {
      expect(drawn, `the drawn screens do not show ${amount} (${what})`).toContain(String(amount));
      expect(data, `the harness no longer has ${amount} (${what})`).toContain(String(amount));
    }
  });

  it('sends viewers to the address the product actually lives at', () => {
    // The first closing card said compences.app. That is the app's bundle
    // identifier (com.compences.app), not a site — a video that tells a society
    // to go somewhere that is not ours is worse than one that says nothing.
    const site = /'(https:\/\/[^']+)'/.exec(mobileSite());
    expect(site, 'apps/mobile/src/lib/site.ts has no default site URL').not.toBeNull();
    const host = new URL(site![1]).host;
    expect(logo(), `the closing sting does not show ${host}`).toContain(host);
    for (const [name, source] of [
      ['logo.tsx', logo()],
      ['story.tsx', story()],
      ['screens.tsx', screens()],
    ] as const) {
      expect(source, `${name} shows compences.app as if it were a site`).not.toMatch(
        /['">]compences\.app\b/,
      );
    }
  });

  it('draws no WhatsApp surface, because the bot is still in beta', () => {
    // The bot works, but it is not shipped, and a demo that puts a beta
    // surface beside finished ones is making a promise on its behalf.
    //
    // Checked by looking for what it takes to *draw* WhatsApp rather than for
    // the word: the comments that say why the scene was removed mention it by
    // name, and a test that forbade the name would forbid its own explanation.
    // These four are WhatsApp's brand colours and its component, and none of
    // them has another reason to appear in this project.
    const evidence = ['#075e54', '#d9fdd3', '#ece5dd', '#00a884', 'WhatsAppScene', 'ChatScreen'];
    for (const [name, source] of [
      ['surfaces.tsx', surfaces()],
      ['screens.tsx', screens()],
      ['scenes.tsx', scenes()],
    ] as const) {
      for (const mark of evidence) {
        expect(source, `${name} still draws a WhatsApp surface (${mark})`).not.toContain(mark);
      }
    }
  });
});
