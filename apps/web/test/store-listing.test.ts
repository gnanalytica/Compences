import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The store listings, measured.
 *
 * Play and the App Store both truncate or reject on length, and they do it at
 * submission — after the screenshots, the build upload and the review queue.
 * A character count is the cheapest possible thing to check and the most
 * annoying possible thing to find out about late, so it is checked here.
 *
 * The copy lives in docs/store/listings.md, headed `### <field> — max <n>`
 * followed by a fenced block. Parsing it rather than duplicating it means
 * there is one copy of the words, and it is the one that gets pasted in.
 */
const SOURCE = join(import.meta.dirname, '../../../docs/store/listings.md');

type Field = { name: string; limit: number; body: string };

function fields(): Field[] {
  const markdown = readFileSync(SOURCE, 'utf8');
  // `### name — max 80` then, after any blank lines, a ```text block.
  const pattern = /^### (\S+) — max (\d+)\s*\n+```text\n([\s\S]*?)\n```/gm;
  const found: Field[] = [];
  for (const match of markdown.matchAll(pattern)) {
    found.push({ name: match[1]!, limit: Number(match[2]), body: match[3]! });
  }
  return found;
}

describe('store listings', () => {
  const all = fields();

  it('finds every field the two stores need', () => {
    expect(all.map((field) => field.name).sort()).toEqual([
      'appstore.description',
      'appstore.keywords',
      'appstore.name',
      'appstore.promo',
      'appstore.subtitle',
      'play.full',
      'play.short',
      'play.title',
    ]);
  });

  it.each(fields())('$name fits in $limit characters', ({ body, limit }) => {
    expect(body.length).toBeLessThanOrEqual(limit);
  });

  it.each(fields())('$name has no leading or trailing whitespace', ({ body }) => {
    expect(body).toBe(body.trim());
  });

  it('keeps App Store keywords comma-separated with no spaces', () => {
    // Apple counts the separators toward the 100, so a space after each comma
    // is a wasted keyword. It also splits on commas only.
    const keywords = all.find((field) => field.name === 'appstore.keywords')!.body;
    expect(keywords).not.toContain(', ');
    expect(keywords.split(',').every((word) => word.length > 0)).toBe(true);
  });

  it('never promises payment processing, which the app does not do', () => {
    // The one claim that would be both a rejection and a lie: Compences records
    // a UPI payment somebody made elsewhere. It has no gateway of any kind.
    for (const { name, body } of all) {
      const lower = body.toLowerCase();
      expect(lower, name).not.toMatch(/pay (your|the) (maintenance|dues|bill)/);
      expect(lower, name).not.toMatch(/(accept|process|collect) (upi |card )?payments/);
    }
  });
});
