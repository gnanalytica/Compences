'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SceneId } from './scene-player';
import { SCENE } from './scenes';
import { useFestivalTheme } from './theme';

/** The Player and the compositions, fetched only when the tour is near. */
const ScenePlayer = dynamic(() => import('./scene-player'), {
  ssr: false,
  loading: () => <PhonePlaceholder />,
});

function PhonePlaceholder() {
  return (
    <div
      className="bg-surface-sunken w-full"
      style={{ aspectRatio: `${SCENE.width} / ${SCENE.height}` }}
    />
  );
}

export type Chapter = {
  id: SceneId;
  label: string;
  title: string;
  points: string[];
};

/**
 * How a festival runs on Compences, in four chapters — the four the explainer
 * video is cut into — each with its step playing on a phone beside it.
 *
 * A tab list rather than four stacked sections, so the phone stays where the
 * eye is and the chapters take turns in it. Arrow keys move between tabs, as
 * the tabs pattern expects.
 */
export function Tour({ chapters }: { chapters: Chapter[] }) {
  const { wearing } = useFestivalTheme();
  const [active, setActive] = useState(0);
  const [near, setNear] = useState(false);
  const [calm, setCalm] = useState(false);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const frame = useRef<HTMLDivElement>(null);

  // Fetch and start the Player only once the tour is close to the screen.
  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    setCalm(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: '300px 0px' },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const move = (event: KeyboardEvent<HTMLButtonElement>) => {
    const last = chapters.length - 1;
    const to =
      event.key === 'ArrowRight'
        ? active === last
          ? 0
          : active + 1
        : event.key === 'ArrowLeft'
          ? active === 0
            ? last
            : active - 1
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : null;
    if (to === null) return;
    event.preventDefault();
    setActive(to);
    tabs.current[to]?.focus();
  };

  const chapter = chapters[active]!;
  const following = (active + 1) % chapters.length;

  const next = () => {
    setActive(following);
    // On a phone the chapter's words are below the phone showing it; bring
    // the phone back into view, or the step plays where nobody can see it.
    frame.current?.scrollIntoView({ block: 'nearest', behavior: calm ? 'auto' : 'smooth' });
  };

  return (
    // One column on a phone — tabs, then the phone, then the words, so a tap
    // on a tab changes what is just below it. From lg the phone stands beside
    // the words and spans both rows.
    <div className="mt-8 grid items-start gap-6 lg:grid-cols-[1fr_22rem] lg:grid-rows-[auto_1fr] lg:gap-x-16 lg:gap-y-6">
      <div
        role="tablist"
        aria-label="How it works"
        className="border-border-base bg-surface-raised inline-flex w-full rounded-2xl border p-1 shadow-sm sm:w-auto sm:justify-self-start lg:col-start-1"
      >
        {chapters.map((item, index) => (
          <button
            key={item.id}
            ref={(element) => {
              tabs.current[index] = element;
            }}
            type="button"
            role="tab"
            id={`tour-tab-${item.id}`}
            aria-selected={index === active}
            aria-controls={`tour-panel-${item.id}`}
            tabIndex={index === active ? 0 : -1}
            onClick={() => setActive(index)}
            onKeyDown={move}
            className={cn(
              'flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition-colors sm:flex-none sm:px-5 pointer-coarse:min-h-11',
              index === active
                ? 'bg-accent text-accent-ink shadow-sm'
                : 'text-ink-muted hover:text-ink hover:bg-surface-sunken',
            )}
          >
            <span className="hidden text-xs opacity-70 sm:inline">{index + 1}. </span>
            {item.label}
          </button>
        ))}
      </div>

      {/* The phone. Illustration only: everything it shows is said in the
          words beside it, so it is hidden from screen readers. */}
      <div
        ref={frame}
        aria-hidden="true"
        className="relative mx-auto w-full max-w-[17rem] scroll-mt-24 sm:max-w-[20rem] lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:max-w-[22rem]"
      >
        <div className="from-accent/30 to-ribbon/30 absolute -inset-6 -z-10 rounded-[3rem] bg-linear-to-br blur-2xl" />
        <div className="border-ink/85 bg-ink/85 rounded-[2.4rem] border-[6px] shadow-2xl">
          <div className="overflow-hidden rounded-[2rem]">
            {near ? (
              <ScenePlayer scene={chapter.id} festival={wearing?.name ?? 'Festival'} calm={calm} />
            ) : (
              <PhonePlaceholder />
            )}
          </div>
        </div>
      </div>

      <div className="lg:col-start-1">
        <div
          role="tabpanel"
          id={`tour-panel-${chapter.id}`}
          aria-labelledby={`tour-tab-${chapter.id}`}
          className="landing-pop"
          key={chapter.id}
        >
          <h3 className="font-display text-ink text-2xl leading-tight font-semibold text-balance sm:text-3xl">
            {chapter.title}
          </h3>
          <ul className="mt-4 space-y-3">
            {chapter.points.map((point) => (
              <li key={point} className="text-ink-muted flex gap-3 text-pretty">
                <span className="bg-accent text-accent-ink mt-0.5 grid size-5 shrink-0 place-items-center rounded-full">
                  <Check className="size-3" strokeWidth={3} aria-hidden="true" />
                </span>
                {point}
              </li>
            ))}
          </ul>
        </div>

        {/* Outside the panel, which is re-mounted for each chapter: a button
            inside it would take the keyboard focus down with it. */}
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex gap-2" aria-hidden="true">
            {chapters.map((item, index) => (
              <span
                key={item.id}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-500',
                  index === active ? 'bg-accent w-8' : 'bg-border-strong w-3',
                )}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={next}
            className="text-accent group inline-flex items-center gap-1.5 text-sm font-semibold pointer-coarse:min-h-11"
          >
            {following === 0
              ? `Back to ${chapters[0]!.label}`
              : `Next: ${chapters[following]!.label}`}
            <ArrowRight
              className="size-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </button>
        </div>
      </div>
    </div>
  );
}
