import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { APPEARANCE_CHOICES, parseAppearance } from '@compences/core';
import {
  APPEARANCE_KEY,
  APPEARANCE_SCRIPT,
  CHOSEN_THEME_COLOR_ID,
  THEME_COLOR,
} from '@/lib/appearance';

/**
 * System, Light or Dark, on the web and on the phone.
 *
 * The web choice has to be on <html> before the first paint, or a page flashes
 * the device's colours on every load, and it has to get there without the
 * root layout reading a cookie, which would make every page dynamic. Every
 * dark rule then has to ask the same question — the tokens, the festival
 * fallback and Tailwind's `dark:` — or a page ends up half one and half the
 * other, which is worse than not offering the choice at all.
 */
const ROOT = join(import.meta.dirname, '..', '..');
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), 'utf8');
const count = (haystack: string, needle: string) => haystack.split(needle).length - 1;

/** Runs the <head> script the way a browser would, against a stand-in page. */
function headScript(saved: () => string | null) {
  const root = { dataset: {} as Record<string, string> };
  // What the script puts at the top of <head>, ahead of the layout's own pair.
  const added: Record<string, string>[] = [];
  const context = {
    localStorage: { getItem: (key: string) => (key === APPEARANCE_KEY ? saved() : null) },
    document: {
      documentElement: root,
      createElement: () => ({}) as Record<string, string>,
      head: { prepend: (element: Record<string, string>) => added.unshift(element) },
    },
  };
  runInNewContext(APPEARANCE_SCRIPT, context);
  return { theme: root.dataset.theme, added, context };
}

describe('the choice', () => {
  it('is System, Light or Dark, in that order, on both apps', () => {
    expect(APPEARANCE_CHOICES.map((choice) => choice.label)).toEqual(['System', 'Light', 'Dark']);
  });

  it('falls back to System for anything it does not recognise', () => {
    expect(parseAppearance('light')).toBe('light');
    expect(parseAppearance('dark')).toBe('dark');
    for (const value of ['system', null, undefined, '', 'Dark', 'auto', 1]) {
      expect(parseAppearance(value), String(value)).toBe('system');
    }
  });
});

describe('the web head script', () => {
  it('keeps the key browsers already have it under', () => {
    expect(APPEARANCE_KEY).toBe('compences-theme');
  });

  it('marks <html> with a saved Light or Dark', () => {
    expect(headScript(() => 'light').theme).toBe('light');
    expect(headScript(() => 'dark').theme).toBe('dark');
  });

  it('leaves <html> unmarked for System, and for anything else', () => {
    expect(headScript(() => null).theme).toBeUndefined();
    expect(headScript(() => 'purple').theme).toBeUndefined();
  });

  it('survives storage that throws, as it does when it is blocked', () => {
    const blocked = () => {
      throw new Error('SecurityError');
    };
    expect(() => headScript(blocked)).not.toThrow();
    expect(headScript(blocked).theme).toBeUndefined();
  });

  it('paints the browser toolbar in the chosen colour, whatever the device is set to', () => {
    // First in <head>, so it wins over the layout's pair, which it never edits.
    expect(headScript(() => 'dark').added).toEqual([
      { name: 'theme-color', id: CHOSEN_THEME_COLOR_ID, content: THEME_COLOR.dark },
    ]);
    expect(headScript(() => 'light').added[0]?.content).toBe(THEME_COLOR.light);
    // System leaves the toolbar to the layout's one-per-appearance pair.
    expect(headScript(() => null).added).toEqual([]);
  });

  it('leaves nothing behind on window', () => {
    expect(Object.keys(headScript(() => 'dark').context)).toEqual(['localStorage', 'document']);
  });

  it('runs in <head>, from a root layout that stays static', () => {
    const layout = read('web', 'src', 'app', 'layout.tsx');
    const head = layout.slice(layout.indexOf('<head>'), layout.indexOf('</head>'));
    expect(head).toContain('__html: APPEARANCE_SCRIPT');
    // Its own toolbar tags, ahead of the script that repaints them. Next's
    // viewport export would re-create them on every client-side navigation.
    expect(head.indexOf('name="theme-color"')).toBeLessThan(head.indexOf('APPEARANCE_SCRIPT'));
    expect(layout).not.toContain('themeColor');
    expect(layout).toMatch(/<html lang="en" suppressHydrationWarning[\s>]/);
    expect(layout).not.toContain('next/headers');
  });
});

describe('the web stylesheet', () => {
  const css = read('web', 'src', 'app', 'globals.css');

  it('redefines dark: as an explicit Dark, or a dark device unless Light was picked', () => {
    const variant = css.slice(css.indexOf('@custom-variant dark {'));
    expect(css).toContain('@custom-variant dark {');
    expect(variant).toContain("&:where([data-theme='dark'], [data-theme='dark'] *)");
    expect(variant).toContain("&:where(:not([data-theme='light'], [data-theme='light'] *))");
  });

  it('sends every dark rule through it, the festival fallback included', () => {
    // The variant's own media query is the only one left.
    expect(count(css, 'prefers-color-scheme: dark')).toBe(1);
    // The tokens on :root, and the fallback for browsers without light-dark().
    expect(count(css, '@variant dark {')).toBe(2);
    const fallback = css.slice(css.indexOf('@supports not (color: light-dark('));
    expect(fallback.slice(0, fallback.indexOf('@variant dark {'))).toContain(
      "[style*='--accent-light']",
    );
  });

  it('tells the browser which scheme native controls should use', () => {
    expect(css).toMatch(/html \{\s*color-scheme: light dark;/);
    expect(css).toMatch(/html\[data-theme='light'\] \{\s*color-scheme: light;/);
    expect(css).toMatch(/html\[data-theme='dark'\] \{\s*color-scheme: dark;/);
  });
});

describe('the web control', () => {
  const control = read('web', 'src', 'components', 'appearance-switch.tsx');

  it('sits in the profile menu', () => {
    expect(read('web', 'src', 'components', 'profile-menu.tsx')).toContain('<AppearanceSwitch />');
  });

  it('saves under the key the head script reads, and forgets it for System', () => {
    expect(control).toContain('localStorage.setItem(APPEARANCE_KEY, choice)');
    expect(control).toContain('localStorage.removeItem(APPEARANCE_KEY)');
    expect(control).toContain('delete root.dataset.theme');
  });

  it('repaints the browser toolbar as it changes, and hands it back to the device for System', () => {
    expect(control).toContain('document.getElementById(CHOSEN_THEME_COLOR_ID)');
    expect(control).toContain('chosen?.remove()');
    expect(control).toContain('document.head.prepend(chosen)');
  });

  it('is a labelled group of toggle buttons that leave the menu open', () => {
    expect(control).toContain('role="group"');
    expect(control).toContain('aria-labelledby={labelId}');
    expect(control).toContain('aria-pressed={choice === option.id}');
    // A submit button would be closed on by DismissMenus.
    expect(control).toContain('type="button"');
    expect(control).toContain('pointer-coarse:min-h-11');
  });
});

describe('the phone', () => {
  const lib = read('mobile', 'src', 'lib', 'appearance.ts');

  it('keeps the choice in AsyncStorage and applies it app-wide', () => {
    expect(lib).toContain("const STORAGE_KEY = 'compences.theme'");
    expect(lib).toContain("from '@react-native-async-storage/async-storage'");
    // React Native 0.86 takes 'unspecified', not null, to follow the device.
    expect(lib).toContain(
      "Appearance.setColorScheme(choice === 'system' ? 'unspecified' : choice)",
    );
  });

  it('applies the saved choice at startup, from the root layout', () => {
    const layout = read('mobile', 'app', '_layout.tsx');
    expect(layout).toContain("import { applySavedAppearance } from '../src/lib/appearance'");
    // Module scope, before any component renders.
    expect(layout.indexOf('\napplySavedAppearance();')).toBeGreaterThan(-1);
    expect(layout.indexOf('\napplySavedAppearance();')).toBeLessThan(
      layout.indexOf('function RootStack'),
    );
  });

  it('offers it on the Me tab, just above Join another society', () => {
    const me = read('mobile', 'app', '(tabs)', 'me.tsx');
    const card = me.indexOf('<AppearanceCard />');
    expect(card).toBeGreaterThan(me.indexOf('<Heading>Switch society</Heading>'));
    expect(me.slice(card, me.indexOf('label="Join another society"'))).toMatch(
      /^<AppearanceCard \/>\s*<Button\s*$/,
    );
    const component = read('mobile', 'src', 'components', 'appearance-card.tsx');
    expect(component).toContain('<Heading>Appearance</Heading>');
    expect(component).toContain('<Segmented options={APPEARANCE_CHOICES}');
  });
});
