import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The demo video on the front page.
 *
 * A committee is being asked to put the society's money somewhere, and six
 * feature cards do not answer the question they actually have — what this
 * looks like when their neighbours use it. So the explainer runs on the
 * landing page before anybody signs in.
 *
 * What is pinned here is what would break it quietly. A hero that autoplays
 * for somebody who asked their system for less motion is a bug nobody reports.
 * A file that streams faster than a phone on mobile data can fetch it is a
 * landing page that stalls, and the number only moves when someone re-encodes
 * it, which is exactly when a test should object.
 */
const ROOT = join(import.meta.dirname, '..');
const page = () => readFileSync(join(ROOT, 'src', 'app', 'page.tsx'), 'utf8');
/**
 * What the page says, rather than how its source is laid out: comments out,
 * and whitespace collapsed, since Prettier decides where a sentence in JSX
 * breaks across lines and a phrase checked here can land on either side.
 */
const copy = () =>
  page()
    .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\s+/g, ' ');
const player = () => readFileSync(join(ROOT, 'src', 'app', 'demo-video.tsx'), 'utf8');
const proxy = () => readFileSync(join(ROOT, 'src', 'proxy.ts'), 'utf8');
const asset = (name: string) => join(ROOT, 'public', name);

/**
 * How long an MP4 plays, from its own movie header.
 *
 * `mvhd` holds a timescale and a duration in those units; version 1 widens the
 * times to 64 bits. Read straight off the bytes so the test needs no ffprobe.
 */
function mp4Seconds(file: string) {
  const bytes = readFileSync(file);
  const at = bytes.indexOf('mvhd');
  if (at < 0) throw new Error(`${file} has no movie header`);
  const version = bytes[at + 4];
  const body = at + 8;
  return version === 1
    ? Number(bytes.readBigUInt64BE(body + 20)) / bytes.readUInt32BE(body + 16)
    : bytes.readUInt32BE(body + 12) / bytes.readUInt32BE(body + 8);
}

describe('the demo video on the landing page', () => {
  it('is on the page, above the feature cards', () => {
    // Below them it is a footnote. The whole argument for putting a video on a
    // landing page is that somebody sees it before they decide to stop reading.
    const source = page();
    expect(source).toContain('<DemoVideo />');
    expect(source.indexOf('<DemoVideo />')).toBeLessThan(source.indexOf('FEATURES.map'));
  });

  it('says the society in it is invented', () => {
    // The footage names residents and what they paid. They are made up, and a
    // page about transparency is the last place to be coy about that.
    expect(copy()).toContain('are invented');
  });

  it('never autoplays at somebody who asked for less motion', () => {
    // There is no markup for this: `autoplay` has no media query, so the
    // attribute has to be absent and the play call has to be conditional.
    const source = player();
    expect(source).not.toMatch(/\bautoPlay\b/);
    expect(source).toContain("window.matchMedia('(prefers-reduced-motion: reduce)').matches");
    expect(source).toContain('video.play()');
  });

  it('is muted, looping and inline, so a phone plays it in place', () => {
    // Without playsInline, iOS Safari takes the video fullscreen the moment it
    // starts, which on a landing page reads as a popup.
    const source = player();
    for (const attribute of ['muted', 'loop', 'playsInline', 'controls']) {
      expect(source).toContain(attribute);
    }
  });

  it('shows a poster, so the hero is never a black rectangle', () => {
    expect(player()).toContain('poster="/compences-demo-poster.jpg"');
    expect(existsSync(asset('compences-demo-poster.jpg'))).toBe(true);
  });

  it('is reachable by somebody who has not signed in', () => {
    // The proxy redirects anything it matches and does not recognise as public
    // to /login. Before video was excluded from its matcher, a signed-out
    // visitor asking for the demo was answered with an HTML login page under a
    // 200 and a video/mp4-shaped request — which the <video> tag reports as
    // DEMUXER_ERROR_COULD_NOT_OPEN, a long way from the cause.
    const matcher = proxy().slice(proxy().indexOf('matcher:'));
    expect(matcher).toContain('mp4');

    // And the rule itself still has to match the file, or the assertion above
    // is only about a comment.
    const pattern = /'\/\(\(\?!(.+)\)\.\*\)'/.exec(matcher);
    expect(pattern).not.toBeNull();
    const matches = (path: string) =>
      new RegExp(`^/((?!${pattern![1].replace(/\\\\/g, '\\')}).*)$`).test(path);
    expect(matches('/compences-demo.mp4')).toBe(false);
    expect(matches('/compences-demo-poster.jpg')).toBe(false);
    // Pages still go through it, or nobody is signed in anywhere.
    expect(matches('/app/shanti-nivas/money')).toBe(true);
  });

  it('streams slowly enough to autoplay on mobile data', () => {
    // video/landing.mjs makes this file. This used to be a two-megabyte cap on
    // the whole file, which was a stand-in for the real limit while the video
    // was twenty-five seconds long. The page streams it — faststart, preload
    // "metadata" — so what a phone on mobile data has to keep up with is the
    // rate, not the total. When every shot was paced to be readable the cut
    // passed two minutes, and two megabytes across two minutes is about thirty
    // kilobits a second of video: the captions would have smeared. So the rate
    // is what is capped now, deliberately, and the size loosely behind it.
    const file = asset('compences-demo.mp4');
    expect(existsSync(file)).toBe(true);
    const seconds = mp4Seconds(file);
    expect(seconds).toBeGreaterThan(5);
    const kbps = (statSync(file).size * 8) / seconds / 1000;
    expect(kbps, `the landing video streams at ${kbps.toFixed(0)} kbps`).toBeLessThan(450);
    // Twice what the paced cut needs. Past this, the length itself changed and
    // somebody should decide whether a video that long belongs on the front page.
    expect(statSync(file).size).toBeLessThan(12 * 1024 * 1024);
    expect(statSync(asset('compences-demo-poster.jpg')).size).toBeLessThan(200 * 1024);
  });
});

describe('what the landing page says', () => {
  it('says how long the video is, and is right', () => {
    // The caption said "under a minute" long after the cut had grown to nearly
    // two, because nothing tied the sentence to the file.
    const claim = /Under (a|two|three) minutes?/.exec(copy());
    expect(claim, 'the caption should say how long the video is').not.toBeNull();
    const limit = { a: 60, two: 120, three: 180 }[claim![1] as 'a' | 'two' | 'three'];
    const seconds = mp4Seconds(asset('compences-demo.mp4'));
    expect(seconds, `the video runs ${seconds.toFixed(0)} seconds`).toBeLessThan(limit);
  });

  it('never promises that what a resident paid is private', () => {
    // It is not, deliberately: a confirmed payment is on the society's ledger
    // with the payer's name and flat, where every resident can read it
    // (20260920000500_every_resident_can_see_the_ledger.sql). The fund card
    // said otherwise for months.
    expect(copy()).not.toMatch(/amounts? (stays?|are|is|remains?) private/i);
    expect(copy()).toContain('with the payer’s name and flat');
  });

  it('wears the next festival’s colours, deepened until its text can be read', () => {
    // The palette comes from the calendar (lib/season.ts) and every palette it
    // hands back has been through legible() — tested in contrast.test.ts.
    const source = page();
    expect(source).toContain('season(todayIn(), 6)');
    expect(source).toContain('style={festivalVars(palette)}');
  });
});
