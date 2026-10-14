/**
 * How a recording is driven: the pointer you can see, and the moves it makes.
 *
 * Two recorders share this — one at a desktop window, one at a phone. They film
 * the same product through very different layouts, and the only thing that
 * differs is what a pointer means. A desktop gets an arrow that glides between
 * things; a phone gets the ripple a finger leaves, because a phone has no
 * cursor and drawing one would be a small lie about how the app is used.
 *
 * Playwright draws neither. Its mouse is synthetic, so there is nothing for the
 * compositor to capture, which is why every screen recording made this way
 * looks haunted — menus open with nothing touching them.
 */

/**
 * Runs before anything on the page, on every navigation. It listens in the
 * capture phase so a page that stops propagation on its own handlers cannot
 * freeze the pointer, and it never touches layout: everything is fixed,
 * pointer-events:none, and appended to <html> rather than <body>, so the app
 * underneath behaves exactly as it does without it.
 *
 * @param {'pointer' | 'touch'} mode
 */
export function cursorScript(mode = 'pointer') {
  const ARROW = `'<svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M5 2.5 L5 19.2 L9.2 15.3 L12.1 21.6 L15.1 20.2 L12.2 14 L18 13.6 Z" ' +
      'fill="#16211e" stroke="#ffffff" stroke-width="1.4" stroke-linejoin="round"/></svg>'`;
  return SCRIPT.replace('__ARROW__', mode === 'touch' ? "''" : ARROW).replace(
    '__TOUCH__',
    mode === 'touch' ? 'true' : 'false',
  );
}

const SCRIPT = `(() => {
  const ID = '__compences_cursor';
  const TOUCH = __TOUCH__;
  const install = () => {
    if (document.getElementById(ID)) return;

    const style = document.createElement('style');
    style.textContent = \`
      #\${ID}, #\${ID}-ring { position: fixed; pointer-events: none; z-index: 2147483647; }
      #\${ID} { width: 24px; height: 24px; margin: -2px 0 0 -2px; opacity: 0;
               transition: opacity .25s ease; filter: drop-shadow(0 2px 4px rgba(0,0,0,.35)); }
      /* A finger is blunt, so its mark is bigger than a pointer's and stays
         visible between taps rather than only flashing on one. */
      #\${ID}-ring { width: \${TOUCH ? 46 : 14}px; height: \${TOUCH ? 46 : 14}px;
                    border-radius: 999px; margin: \${TOUCH ? -23 : -7}px 0 0 \${TOUCH ? -23 : -7}px;
                    background: rgba(15,118,110,.28); border: 2px solid rgba(15,118,110,.8);
                    opacity: 0; transform: scale(.4); }
      #\${ID}-ring.pulse { animation: \${ID}-pulse .55s ease-out; }
      @keyframes \${ID}-pulse {
        0%   { opacity: .95; transform: scale(.45); }
        100% { opacity: 0;   transform: scale(\${TOUCH ? 2.1 : 3.2}); }
      }
      /* The dev-server badge is invisible to anyone who works on the app and
         glaring in a frame. */
      nextjs-portal { display: none !important; }
    \`;
    document.documentElement.appendChild(style);

    const ring = document.createElement('div');
    ring.id = ID + '-ring';
    document.documentElement.appendChild(ring);

    const cursor = document.createElement('div');
    cursor.id = ID;
    cursor.innerHTML = __ARROW__;
    document.documentElement.appendChild(cursor);

    addEventListener('mousemove', (event) => {
      if (!TOUCH) {
        cursor.style.opacity = '1';
        cursor.style.left = event.clientX + 'px';
        cursor.style.top = event.clientY + 'px';
      }
      ring.style.left = event.clientX + 'px';
      ring.style.top = event.clientY + 'px';
      // On a phone the ring follows the finger faintly, so a tap does not
      // arrive from nowhere.
      if (TOUCH) ring.style.opacity = '0.22';
    }, true);

    addEventListener('mousedown', (event) => {
      ring.style.left = event.clientX + 'px';
      ring.style.top = event.clientY + 'px';
      ring.classList.remove('pulse');
      // Reading offsetWidth restarts the animation; without it a second click
      // in the same place draws nothing.
      void ring.offsetWidth;
      ring.classList.add('pulse');
    }, true);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install);
  } else {
    install();
  }
  // Next replaces large parts of the tree on navigation; this puts the cursor
  // back if it ever goes with them.
  setInterval(install, 500);
})();`;

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** Where the pointer currently is, so every move starts where the last ended. */
let at = { x: 0, y: 0 };

/** Called once by each recorder, because they open in different viewports. */
export function startPointerAt(x, y) {
  at = { x, y };
}

/**
 * A move with acceleration and a settle. Playwright's `steps` option
 * interpolates linearly, which reads as a machine; this eases, which reads as
 * a hand.
 */
export async function glide(page, x, y, ms = 650) {
  const from = { ...at };
  const steps = Math.max(12, Math.round(ms / 16));
  for (let i = 1; i <= steps; i += 1) {
    const t = ease(i / steps);
    await page.mouse.move(from.x + (x - from.x) * t, from.y + (y - from.y) * t);
    await page.waitForTimeout(ms / steps);
  }
  at = { x, y };
}

export async function glideTo(page, locator, ms) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('nothing to glide to');
  await glide(page, box.x + box.width / 2, box.y + box.height / 2, ms);
  return box;
}

/** Move to a thing, pause as if reading it, then click it. */
export async function press(page, locator, { settle = 420 } = {}) {
  await glideTo(page, locator);
  await page.waitForTimeout(settle);
  await page.mouse.down();
  await page.waitForTimeout(90);
  await page.mouse.up();
}

/**
 * Waits for the page you actually asked for.
 *
 * waitForLoadState('networkidle') answers as soon as nothing is in flight,
 * which on a client-side transition can be before the new page exists at all —
 * and in dev, where the route is compiled on first request, several seconds
 * before. The take then films the old page and misses the interaction. Waiting
 * for something only the destination has cannot resolve early.
 */
export async function arrived(page, locator, timeout = 20_000) {
  await locator.first().waitFor({ state: 'visible', timeout });
  await page.waitForTimeout(500);
}

/**
 * Scrolling the way a reader does: eased, and slow enough that the text is
 * legible on the way past. A wheel event jumps, which in a video about a
 * ledger means the evidence goes by unread.
 */
export async function readDown(page, distance, ms = 2200) {
  await page.evaluate(
    ([dy, duration]) =>
      new Promise((resolve) => {
        const start = window.scrollY;
        const began = performance.now();
        const step = (now) => {
          const t = Math.min(1, (now - began) / duration);
          const eased = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
          window.scrollTo(0, start + dy * eased);
          if (t < 1) requestAnimationFrame(step);
          else resolve();
        };
        requestAnimationFrame(step);
      }),
    [distance, ms],
  );
}

/**
 * Scrolls a thing into the middle of the screen, then presses it.
 *
 * On a phone the app's two-column pages stack, so a control that sits beside
 * the fold on a desktop is a long way below it here. Scrolling to a fixed
 * offset and clicking where the button used to be lands on whatever moved into
 * that space — which is how a take ends with a twenty-second timeout.
 */
export async function reachAndPress(page, locator, { ms = 1600, settle = 500 } = {}) {
  const target = locator.first();
  const delta = await target.evaluate((node) => {
    const box = node.getBoundingClientRect();
    return box.top + box.height / 2 - window.innerHeight / 2;
  });
  if (Math.abs(delta) > 24) {
    await readDown(page, delta, ms);
    await page.waitForTimeout(settle);
  }
  await press(page, target);
}
