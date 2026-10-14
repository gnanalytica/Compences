import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The app's look, pinned so it cannot drift back: ivory and ink with the
 * colour left to the festival, a serif for the things that are an occasion,
 * each festival dressed in its own things, and motion that never runs for
 * somebody who asked for less.
 */
const SRC = join(import.meta.dirname, '..', 'src');
const read = (...parts: string[]) => readFileSync(join(SRC, ...parts), 'utf8');

describe('the look', () => {
  it('sets Inter for reading and Fraunces for occasions, on <html>', () => {
    const fonts = read('app', 'fonts.ts');
    expect(fonts).toContain('Inter(');
    expect(fonts).toContain('Fraunces(');
    expect(read('app', 'layout.tsx')).toContain('${sans.variable} ${serif.variable}');
    const css = read('app', 'globals.css');
    expect(css).toContain('--font-serif: var(--font-fraunces)');
    expect(css).toContain('--font-sans:\n    var(--font-inter)');
  });

  it('keeps the primary button ink and leaves the festival colour to `festive`', () => {
    const button = read('components', 'ui', 'button.tsx');
    expect(button).toContain("primary: 'bg-ink text-surface");
    expect(button).toContain("festive: 'bg-accent text-accent-ink");
  });

  it('paints the page ivory and matches the browser toolbar to it', () => {
    expect(read('app', 'globals.css')).toContain('--surface: oklch(0.972 0.007 84)');
    expect(read('lib', 'appearance.ts')).toContain("light: '#f8f5f1'");
  });
});

describe('each festival', () => {
  it('leads its event page with its own banner and motif, not one toran for all', () => {
    const event = read('app', 'app', '[community]', 'events', '[event]', 'page.tsx');
    expect(event).toContain('<FestivalHero');
    const festival = read('components', 'festival.tsx');
    expect(festival).not.toContain('function Toran');
    expect(festival).not.toContain('function FestivalHeader');
    expect(festival).toContain('<Motif');
  });

  it('marks every event in a list with its festival’s tile', () => {
    for (const page of [
      ['app', 'app', '[community]', 'events', 'page.tsx'],
      ['app', 'app', '[community]', 'contribute', 'page.tsx'],
    ]) {
      expect(read(...page), page.join('/')).toContain('<FestivalTile');
    }
  });

  it('hangs a garland on the front page only for festivals a doorway is dressed that way for', () => {
    const theme = read('app', '_landing', 'theme.tsx');
    expect(theme).toContain('wearsGarland(look)');
    expect(read('app', 'page.tsx')).toContain('<SeasonTrim');
    expect(read('app', 'page.tsx')).not.toContain('<Garland');
  });

  it('takes the whole app, from the shell down, into the season', () => {
    const layout = read('app', 'app', '[community]', 'layout.tsx');
    expect(layout).toContain('getSeason(');
    expect(layout).toContain('style={festivalVars(season.festival)}');
  });
});

describe('motion', () => {
  it('never loops for somebody who asked for less of it', () => {
    const css = read('app', 'globals.css');
    const safe = css.slice(
      css.indexOf('@media (prefers-reduced-motion: no-preference) {\n  .motif-'),
    );
    expect(safe).toContain('.motif-flicker');
    expect(safe).toContain('.motif-swing');
    // Outside that block the loops have no animation at all.
    const before = css.slice(
      0,
      css.indexOf('@media (prefers-reduced-motion: no-preference) {\n  .motif-'),
    );
    expect(before).not.toMatch(/\.motif-flicker\s*\{\s*animation/);
  });

  it('keeps a list still: only a banner’s motif moves', () => {
    expect(read('components', 'motif.tsx')).toContain('const moving = !compact && layer.motion');
  });

  it('rolls amounts up in CSS alone, with the number itself for screen readers', () => {
    const amount = read('components', 'rolling-amount.tsx');
    expect(amount).not.toContain("'use client'");
    expect(amount).toContain('<span className="sr-only">{text}</span>');
  });
});

describe('the tokens', () => {
  it('are the ones the phone reads, so the two apps cannot drift apart', async () => {
    const { TOKENS } = await import('@compences/core');
    const css = read('app', 'globals.css');
    const name = (key: string) =>
      key === 'wash'
        ? 'festival-wash'
        : key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
    const light = css.slice(css.indexOf(':root {'), css.indexOf('@variant dark {'));
    const dark = css.slice(css.indexOf('@variant dark {'), css.indexOf('@theme inline'));
    for (const [key, value] of Object.entries(TOKENS.light)) {
      expect(light, key).toContain(`--${name(key)}: ${value};`);
    }
    for (const [key, value] of Object.entries(TOKENS.dark)) {
      expect(dark, key).toContain(`--${name(key)}: ${value};`);
    }
  });
});

describe('the phone', () => {
  const MOBILE = join(import.meta.dirname, '..', '..', 'mobile');
  const phone = (...parts: string[]) => readFileSync(join(MOBILE, ...parts), 'utf8');

  it('reads the same tokens as the web, converted rather than copied', () => {
    const theme = phone('src', 'lib', 'theme.ts');
    expect(theme).toContain('toHex(TOKENS.light)');
    expect(theme).toContain('toHex(TOKENS.dark)');
  });

  it('loads only the two cuts of the serif it uses, before the splash goes', () => {
    const layout = phone('app', '_layout.tsx');
    expect(layout).toContain("from '@expo-google-fonts/fraunces/500Medium'");
    expect(layout).toContain("from '@expo-google-fonts/fraunces/600SemiBold'");
    expect(layout).not.toContain("from '@expo-google-fonts/fraunces';");
    expect(layout).toContain('SplashScreen.preventAutoHideAsync()');
  });

  it('leads home and the event with the festival’s banner, and lists with its tile', () => {
    expect(phone('app', '(tabs)', 'index.tsx')).toContain('<FestivalHero');
    expect(phone('app', 'event', '[slug].tsx')).toContain('<FestivalHero');
    expect(phone('app', '(tabs)', 'events.tsx')).toContain('<FestivalTile');
    expect(phone('app', 'contribute.tsx')).toContain('<FestivalTile');
  });

  it('matches an event to the same look as the web, type first', () => {
    const events = phone('src', 'lib', 'events.ts');
    expect(events).toContain('event_type:catalogue_items!event_type_id(label)');
    expect(events).toContain('festivalFor(event.event_type?.label, event.name)');
  });

  it('puts the season’s colour on the Contribute button', () => {
    expect(phone('app', '(tabs)', '_layout.tsx')).toContain('lookColours(useSeason(), isDark)');
  });

  it('stills every loop, bar and count for somebody who asked for less motion', () => {
    expect(phone('src', 'components', 'motif.tsx')).toContain('const still = compact || reduced');
    expect(phone('src', 'components', 'event-ui.tsx')).toContain('useReducedMotion()');
    expect(phone('src', 'components', 'ui.tsx')).toContain('useReducedMotion()');
  });
});

/**
 * Emoji made a society's app read like a children's one — a 🏍️🚗 on a fund
 * card, a 🔔 for the bell, a 👍 on a vote — and every phone draws them
 * differently. Neither app shows any: an event wears its festival's colours
 * and line drawing, a control its line icon. The emoji still stored with
 * events and activities go only into the WhatsApp bot's messages.
 */
describe('emoji', () => {
  const ROOTS = [
    SRC,
    join(import.meta.dirname, '..', '..', 'mobile', 'app'),
    join(import.meta.dirname, '..', '..', 'mobile', 'src'),
  ];
  const screens = (dir: string): string[] =>
    readdirSync(dir).flatMap((entry) => {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) return screens(path);
      return entry.endsWith('.tsx') ? [path] : [];
    });
  const files = ROOTS.flatMap(screens);

  const EMOJI = /\p{Emoji_Presentation}|\uFE0F/u;
  // `{event.emoji}` as text, or `${event.emoji}` in a title or label. A hidden
  // input carrying the stored one on to the bot is not showing it.
  const SHOWN = /\.emoji\}|\$\{[^}]*\bemoji\b[^}]*\}/;
  const offenders = (pattern: RegExp) =>
    files.flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .flatMap((line, index) =>
          pattern.test(line) && !line.includes('type="hidden"') ? [`${file}:${index + 1}`] : [],
        ),
    );

  it('are never written into either app', () => {
    expect(offenders(EMOJI)).toEqual([]);
  });

  it('are never shown from an event, activity or catalogue item', () => {
    expect(offenders(SHOWN)).toEqual([]);
  });

  it('would be caught if one came back, and a tick is not one', () => {
    expect(EMOJI.test('<Text>🔔</Text>')).toBe(true);
    expect(EMOJI.test("label={bill ? '📎 Bill attached' : ''}")).toBe(true);
    expect(EMOJI.test('🗳️')).toBe(true);
    expect(EMOJI.test('✓ Matched · ₹1,200')).toBe(false);
    expect(SHOWN.test('{event.emoji} {event.name}')).toBe(true);
    expect(SHOWN.test('label={`${option.emoji} ${option.name}`}')).toBe(true);
    expect(files.length).toBeGreaterThan(150);
  });
});
