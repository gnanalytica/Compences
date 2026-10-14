'use client';

import { useEffect, useRef } from 'react';

/**
 * Under two minutes of the app, on the front page.
 *
 * Animated rather than filmed since `video/src/story.tsx` — what plays here is
 * the `Explain` cut, drawn from the app's own screens and data.
 *
 * A society's committee is being asked to put the society's money somewhere,
 * and six feature cards do not answer the question they actually have, which
 * is what this looks like when their neighbours use it. So the ledger is on
 * the page, moving, before anybody has signed in.
 *
 * It starts itself rather than carrying `autoplay`, because that attribute has
 * no way to ask whether the visitor wants motion. Somebody who has told their
 * system to reduce it gets the poster and the controls, which is the whole
 * video, just not uninvited. Browsers that block autoplay outright land in the
 * same place, so there is nothing extra to handle.
 */
export function DemoVideo() {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // Rejects when the browser declines to autoplay. The poster and controls
    // are already there, so there is nothing to fall back to.
    void video.play().catch(() => {});
  }, []);

  return (
    <video
      ref={ref}
      className="bg-surface-sunken block aspect-video w-full"
      src="/compences-demo.mp4"
      poster="/compences-demo-poster.jpg"
      controls
      muted
      loop
      playsInline
      preload="metadata"
    >
      Compences, following one contribution the whole way: a resident pays ₹2,001 towards Ganesh
      Chaturthi, someone else confirms it, and it goes on the ledger every resident can see, with a
      name and flat. Then the money out: a bill the person who filed it can&rsquo;t approve,
      spending against the budget, the bank statement reconciled, and the ₹1,100 left over kept for
      the society.
    </video>
  );
}
