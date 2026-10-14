import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FESTIVALS } from '@compences/core';
import { festivalVars } from '@/components/festival';

/**
 * festivalVars() carries both themes in one light-dark() value, which Safari
 * only understands from 17.5 — after the 16.4 this app is built for. Without
 * it the value is invalid and a festival page's primary button loses its fill
 * entirely, which is a front page with a white "Join your society" on nothing.
 * The fallback is two halves set alongside, and a rule in globals.css that
 * picks between them; these pin the two to each other.
 */
const TOKENS = [
  ['--accent', 'accent'],
  ['--ribbon', 'ribbon'],
  ['--festival-wash', 'wash'],
] as const;

describe('festival colours in a browser without light-dark()', () => {
  it('sets each half on its own, beside the light-dark() value', () => {
    for (const festival of FESTIVALS) {
      const vars = festivalVars(festival) as Record<string, string>;
      for (const [token, field] of TOKENS) {
        expect(vars[token]).toBe(`light-dark(${festival[field][0]}, ${festival[field][1]})`);
        expect(vars[`${token}-light`]).toBe(festival[field][0]);
        expect(vars[`${token}-dark`]).toBe(festival[field][1]);
      }
    }
  });

  it('has globals.css pick between the halves where light-dark() is missing', () => {
    const css = readFileSync(join(import.meta.dirname, '..', 'src', 'app', 'globals.css'), 'utf8');
    const at = css.indexOf('@supports not (color: light-dark(');
    expect(at, 'globals.css should carry the fallback').toBeGreaterThan(-1);
    const block = css.slice(at);
    // Found by the half festivalVars() sets, since an inline style is the only
    // place one ever is.
    expect(block).toContain("[style*='--accent-light']");
    for (const [token] of TOKENS) {
      expect(block).toContain(`${token}: var(${token}-light) !important;`);
      expect(block).toContain(`${token}: var(${token}-dark) !important;`);
    }
    // The dark halves go by the same rule as every other dark style: a choice
    // made in the profile menu, or else the device.
    expect(block).toContain('@variant dark {');
  });
});
