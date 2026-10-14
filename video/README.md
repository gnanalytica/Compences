# The Compences demo video

Four cuts, from two sources:

| Composition   | Length | Built from       | For                                                  |
| ------------- | ------ | ---------------- | ---------------------------------------------------- |
| `Explain`     | ~1:46  | animation        | The landing page, in 16:9.                           |
| `Phone`       | ~1:46  | animation        | Portrait — a status, a Reel, anywhere held upright.  |
| `Walkthrough` | ~1:28  | screen recording | A committee that wants to watch the real thing move. |
| `Launch`      | ~0:25  | screen recording | A short forward into a group chat.                   |

`Explain` and `Phone` are the same fourteen beats in two shapes. The script
lives once, in `src/story.tsx`, so the two cannot drift into two different
arguments about the same product.

Captions and a score, no voiceover — most of the people this reaches will
watch it on mute, and the ones who don't get something under it.

## Why it is built this way

The product is a ledger, so the shots have to be the ledger. Two things make
that awkward, and the pipeline exists to get around both:

- **The pages are behind a sign-in**, so there is nothing for a screen
  recorder to point at without a seeded database and a session.
- **The data is real neighbours and real payments.** The Money page names who
  paid and how much, which is the one thing that must never be in a video.

So `capture/stage.mjs` writes an invented society into `apps/web` — Shanti
Nivas, twenty-four flats, a Ganesh Chaturthi fund — and patches the proxy to
serve it at `/app/shanti-nivas`, which is the path the app's own navigation
builds. That last part is the whole trick: `SidebarNav` makes every href from
the slug and lights the active one from `usePathname()`, so a demo served at
its own path would have a sidebar that navigates nowhere. Served where the app
expects it, clicking Money loads the real Money page through a real client-side
transition. The shell, the switcher, the profile menu, the bottom bar and every
row are the app's own components. Only the residents are made up.

The staged pages sit where the app would put them — the sidebar's Reconcile
link points at `/admin/reconcile`, so the harness page does too. A page at the
wrong path is a click that lands on a 404 in the middle of a take.

Both scripts remove everything they wrote before they exit, so no page that
exists only to be filmed can reach a commit or a build.

This directory is deliberately outside the pnpm workspace (`apps/*`,
`packages/*`), so CI never builds, lints or typechecks a video. It is still
covered by the repo-wide `pnpm format:check`.

## Making it

```bash
cd video
npm install

npm run record        # one continuous take at a desktop window → take.webm
npm run record:phone  # the same society through the mobile layout → phone.webm
npm run capture   # the stills and the one-control clips
npm run brand     # splits the Gnanalytica logo into the layers the close animates
npm run score     # synthesises the music bed for each cut
npm run render    # all four cuts into out/
npm run landing   # the 720p copy the landing page serves, from Explain, at a fixed bitrate
npm run share     # covers, thumbnails, the site's link preview, and the WhatsApp copies
```

`npm run studio` opens Remotion's editor for scrubbing a scene while you
change it.

### The two animated cuts are drawn, not filmed

`src/screens.tsx` redraws the app's screens as React, and `src/story.tsx` puts
fourteen of them in an order. `Phone` lays that out vertically, because most of
a society reads its ledger standing in a lift; `Explain` lays the same thing
out in 16:9 with a panel beside the handset.

A recording is the most honest way to show a product and the worst way to show
it _quickly_. It moves at the speed a browser navigates, so every shot opened
on a page settling into place. Redrawn, a screen arrives in a third of a second
and spends its whole life doing what its caption is about — which buys the room
for the five screens the filmed cuts never had time for: the committee's To do
queue, confirming a payment, the budget, closing an event, and the society
balance.

**The screens follow the money, in order** — plan, collect, spend, prove: a
payment made, queued for the committee, confirmed by someone other than the
payer, on the public ledger, spent against a bill, reconciled against the bank,
and what is left decided on the record. The text over them does not narrate
that as a story. Each shot has a headline and two specifics — a figure off the
screen, or the rule it shows — because what a committee wants from a video like
this is facts it can check, not a character to follow.

What stops a drawing being a lie is that nothing in it is invented. Every
figure, label and rule comes from `capture/harness/society/demo-data.ts`, which
is the data the filmed cuts use, and `apps/web/test/demo-video-claims.test.ts`
checks ten of those figures appear in both. The two closure answers are the
strings in `packages/core/src/funds.ts`; the To do sections and their order are
`TODO_ORDER` in `packages/core/src/copy.ts`; the tab bar is the app's, including
that residents get Home/Events/Money/Me while the committee trades Money for
Manage.

Three things about the drawing that took a render each to find:

- **The phone must not cut.** Ground, bezel, chrome and camera render once for
  the whole video and each shot supplies only the page inside them, so pages
  push through a handset that stays put.
- **Chrome that slides is chrome that lies.** Built first with the status bar
  and tab bar inside each page, every transition slid two clocks and two Home
  tabs past each other. They are drawn over the pages instead.
- **Nothing may be laid out flush against the phone's resting edge.** The
  camera pushes in, so the drawn phone's bottom moves with it — the chapter
  rail spent its first render hidden behind a tab bar. `CAPTION_TOP` and
  `RAIL_TOP` are fixed numbers with the deepest zoom already allowed for.

A WhatsApp scene used to sit in all of these. It came out because the bot is
still in beta, and a demo that shows a beta surface beside shipped ones is
making a promise on its behalf. The test above also fails if it comes back.

`capture/record-phone.mjs` is still there and still runs: the landscape filmed
cuts use its footage for the one scene that shows the app on a phone.

### Every shot lasts as long as it takes to read

The first animated cuts were timed by eye, and they were too fast: a viewer
could watch the phone or read the text, not both. Now nothing in `story.tsx`
declares a length. `holdOf()` derives each one from the text the shot puts on
screen — a lead for the eye to find it, then 14 characters a second, then a
tail to look back at the phone. Subtitle guidance for native readers watching
nothing else is 15–17; this audience is often reading in a second language
while something moves beside the words.

Both cuts show the same words — a headline and two specifics per shot — so they
share one timeline and one score, and only the layout differs: a card under
the phone in portrait, a panel beside it in landscape. Everything appears at
once. An earlier version lit each word as a reading cursor reached it and
coloured key terms marigold; people can read, and being shown where to look
was not what anybody asked for. It was taken out.

### The close: Compences's mark flows into Gnanalytica's

Gnanalytica's logo is an infinity: a navy loop with a red arrow and three bars
rising out of its right lobe. It lives in `brand/gnanalytica-logo.png`, exactly
as supplied, and `npm run brand` splits it into the navy loop and the red rise
on transparent ground (`public/brand/`), cropped to the same box so they stack
into the original. Alpha is each pixel's coverage of its ink, read on the
channel where that ink is furthest from white; a generic colour-to-alpha leaves
the navy at 95% and the festive ground shows through it.

**Compences had no logo.** The mobile app's icon is still Expo's template, and
the landing page sets the name in plain type. So the mark in `logo.tsx` is
built from the product's own motif — a kolam, one line drawn around dots. The
simplest kolam is a single line looped around two dots; half of that loop, stood
on end, is an S. If Compences gets a real logo, `logo.tsx` is the one place to
change.

The sting is that one line doing three things. It draws as Compences's S on the
festive ground; it turns flat and closes, and the two dots it was drawn around
become the lobes of an infinity; then it _is_ Gnanalytica's loop. The ground
goes to white on the way, because the navy was designed for white and all but
disappears on the festive dark, and the red rise grows out of the crossing.

For that to work the drawn loop has to land _on_ the supplied artwork, not near
it, or the crossfade shows two loops. It is Bernoulli's lemniscate, scaled in y,
fitted to seventeen centreline points measured off the logo: 4.2 px RMS and
8.6 px at worst, on a stroke 33 px wide, so the line never leaves the stroke it
is about to become.

It ends on `compences.com`. The card it replaced said `compences.app`,
which is the app's bundle identifier and not a site anybody can visit; the
claims test now fails if the video shows an address the product does not live
at.

### Sharing: a cover, and a file WhatsApp takes as a video

WhatsApp settles two things about a forwarded video before anybody plays it,
and the renders got both wrong. Past 16 MB it will not send a file as a video
at all: it goes as a document, a file icon with no picture and no play button,
and the full renders are 28 and 46 MB. And the thumbnail is the first frame,
which for both cuts was the empty ground before the title fades up.

`src/cover.tsx` draws the cover instead: the video's opening line, the Money
screen on a phone, and the name, in the video's own colours. `npm run share`
renders it and makes, in `out/`:

- **`compences-phone-whatsapp.mp4`** and **`compences-explain-whatsapp.mp4`** —
  each opens on its cover for a moment, dissolves into the cut, and is encoded
  at 720p to about 13 MB, H.264 Main and AAC. WhatsApp draws its own play
  button and length over the thumbnail, so these covers carry neither.
- **`compences-thumbnail.jpg`** (1280×720) and
  **`compences-thumbnail-portrait.jpg`** — the covers with a play button and the
  length, for anywhere that does not draw its own.
- **`apps/web/src/app/opengraph-image.jpg`** — the same at 1200×630, which Next
  serves as the site's link preview. It is committed; WhatsApp drops a preview
  image over about 300 KB, and `apps/web/test/link-preview.test.ts` holds it
  under that.

The portrait cover keeps its name and headline inside the middle 4:5 of the
frame, because that is roughly what WhatsApp shows of a tall video in a chat.

### Two things the recorder bit on

- **Playwright records at the viewport's CSS pixels.** Asking for a phone's 3x
  device pixels does not render sharper, it pads: a 390-wide page ends up in the
  corner of a 1170-wide grey frame. The take is captured 1:1 and the composition
  scales it, which is what a screen recording looks like anyway.
- **A phone stacks the two-column pages**, so a control beside the fold on a
  desktop is a long way below it here. `reachAndPress` scrolls to a thing before
  pressing it; a fixed offset lands on whatever moved into that space, which is
  how a take ends in a twenty-second timeout.

Rendering needs a Chromium that still supports old headless mode; Playwright's
`chromium` is not one. The render scripts already point at the headless shell
beside it, which is.

## Changing it

- **The script** is `src/scenes.tsx` — one entry per scene, each with the
  length it wants. `src/Root.tsx` picks which scenes each cut uses and how long
  to hold them, so re-cutting is a list edit rather than a new timeline.
- **The look** is `src/theme.ts`, the app's palette copied verbatim from
  `apps/web/src/app/globals.css`, and `src/festive.tsx`, which ports the kolam
  and the toran out of `apps/web/src/components/festival.tsx` along with Ganesh
  Chaturthi's colours from `packages/core/src/festivals.ts`. Retune them
  together.

  That festival dressing is the app's, not the video's. Compences re-points its
  whole palette per festival — `festivalVars` makes `--accent` marigold on a
  Ganesh page — and draws a kolam and a toran on Home, the events list and
  every event page. The first cut of this video used plain headers in the
  harness and so filmed the entire product in its default green, which is the
  app with its clothes off. Contribute, Money and Reconcile are _not_ dressed
  in the real app, so they are not dressed here either.

- **The words** are captions in `src/scenes.tsx`. They are marketing copy, not
  documentation: what it does for a committee, not how it is implemented. "Every
  rupee out, with the bill attached" rather than a sentence about approval
  trails.
- **The journey** is `capture/record.mjs` — where the cursor goes, what it
  clicks, how long it reads. Every stop is a named beat, and a beat can also
  record _where on screen_ the thing it is about sits, into `boxes` in
  beats.json. The edit pushes in on those coordinates and draws its highlight
  rings from them, so "zoom to the row that says Flat not recorded" is measured
  by the browser that drew the row rather than read off a paused frame. The row
  in question was at y = -17 when measured, having just scrolled above the
  fold; `look()` clamps a framing so that is harmless instead of a grey band
  across the shot.
- **The society** is `capture/harness/society/demo-data.ts`. One file, so the
  total on Home is the total on Money, the event the ledger credits is the event
  the Events page lists, and the figures the WhatsApp bot quotes are the ones on
  the screen before it.
- **The two drawn scenes** are `src/surfaces.tsx`. Compences has four surfaces
  and a screen recorder can only point at two: filming WhatsApp would mean
  photographing somebody else's app, and an MCP server has no pixels at all. So
  those are animated, in the app's palette, from the app's own source — every
  command from `packages/core/src/whatsapp/commands.ts`, every tool name and
  scope from `apps/web/src/lib/api/mcp-tools.ts`.

  A drawing can claim anything, so `apps/web/test/demo-video-claims.test.ts`
  checks both against those files. The first draft of the MCP scene invented
  four scope names that read perfectly and matched nothing.

- **The music** is `score/compose.mjs`, written rather than licensed — every
  other way of getting a bed ends in a licence nobody on a committee can
  produce two years later.

  The first version was a D major pentatonic pad. Pleasant, and the wrong
  continent: a video about a Ganesh Chaturthi fund should not sound like a
  Scandinavian banking advert. It is now built from the things that actually
  make music sound Indian rather than from a scale that happens to have five
  notes — **Raga Hamsadhwani**, the raga of Ganesh invocation; **just
  intonation**, so Re is exactly 9/8 of Sa rather than a twelfth-root
  approximation; a **tanpura** underneath whose partials are stretched the way
  a jawari bridge stretches them, which is why it buzzes instead of humming;
  **meend**, so the bansuri line slides into its notes instead of stepping onto
  them; and **Keherwa**, the eight-beat cycle, on a tabla rather than a drum
  kit. It normalises to half scale, leaving about seven decibels for a
  voiceover to sit on top of without a remix.

  It also had an audible buzz under it for a while, and the cause is worth
  writing down. The bansuri's breath was `fract(sin(i) * 43758.5)` — the GLSL
  hash — fed the sample index. A hash needs unrelated inputs to look random;
  given a smoothly increasing one it returns a structured full-scale signal,
  measurably periodic (autocorrelation 0.55 one sample out, where noise is ~0)
  and piled up around 3.2 kHz, which is roughly where hearing is sharpest. A
  Goertzel probe across the mix put that one frequency 45 dB above its own
  neighbours. It is now an xorshift generator, low-passed to about 1.9 kHz, and
  that probe reads level. If the bed ever sounds metallic again, measure before
  adjusting: the tanpura's shimmer and a synthesis bug sound nothing alike on
  paper and quite similar through a laptop speaker.

`public/captures/`, `public/score-*.wav` and `out/` are generated and
git-ignored; the commands above rebuild all of them.

`public/fonts/` is not generated. It holds Baloo 2, the landing page's display
face, which the video's own titles, covers and sting are set in (`src/theme.ts`),
with its licence (SIL OFL) beside it. It is committed rather than fetched from
Google at render time, so a render needs no network and draws the same letters
every time.

### The three files that are generated and committed

`scenes.tsx` imports them, so a clean clone has to typecheck before anybody has
run a capture.

- **`src/beats.json`** — every moment in the take, in seconds. The edit says
  "two seconds before Money opened" rather than a frame number that the next
  recording would invalidate. It also carries `lead`: Playwright starts
  recording when the browser context opens, which is about three seconds before
  the first navigation, so every beat is that much later in the file than in
  the log. Measured from the file's own duration against the wall clock, not
  guessed — guess it and the whole cut runs early.
- **`src/clips.json`** — the same idea for the short single-control clips.
- **`src/shots.json`** — what each still actually came out as. Shots are taken
  `fullPage`, so their height is whatever the content needed that day; Remotion
  pans by subtracting the viewport from it. Typed in by hand, that number goes
  wrong silently the first time a ledger row is added.

### What is not here yet

Filming the real production app, signed in. That needs a session, which needs
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and a way to mint a
token, none of which belong in a repository. The staged society is the honest
substitute: the same components and the same navigation, with residents who do
not exist.
