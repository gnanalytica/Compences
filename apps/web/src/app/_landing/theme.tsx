'use client';

import { createContext, useContext, useState, type CSSProperties, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { Sparkles as SparklesIcon } from 'lucide-react';
import { wearsGarland, type Festival } from '@compences/core';
import { FestivalTile, Rangoli, festivalVars } from '@/components/festival';
import { Motif } from '@/components/motif';
import { cn } from '@/lib/utils';
import { Garland } from '../festive';

/** A motif drawn on the page's pale wash, where the banner's pale gold would vanish. */
const ON_WASH = { '--motif-light': 'oklch(0.78 0.14 80)' } as CSSProperties;

/**
 * The front page can try on any festival's colours.
 *
 * The page wears the next festival's palette by default (lib/season.ts, set on
 * the server). Tapping a festival further down re-points the same tokens on a
 * wrapper around everything else, so the garland, the buttons, the kolam and
 * the toy fund all change together — the product's own trick, where an event
 * takes its festival's colours, shown by doing it rather than by saying it.
 *
 * The swap runs inside a view transition where the browser has one and the
 * visitor has not asked for less motion, so the page cross-fades instead of
 * jumping. Anywhere else it simply changes.
 */

export type ThemeOption = {
  id: string;
  name: string;
  /** A date for a fixed festival, the usual window for one that moves. */
  when: string;
  palette: Festival;
};

type FestivalThemeValue = {
  /** The festival the page wears on its own: the next one coming up. */
  season: ThemeOption | null;
  /** What it is wearing now — the season unless somebody picked another. */
  wearing: ThemeOption | null;
  options: ThemeOption[];
  wear: (id: string | null) => void;
};

const FestivalThemeContext = createContext<FestivalThemeValue | null>(null);

export function useFestivalTheme() {
  const value = useContext(FestivalThemeContext);
  if (!value) throw new Error('useFestivalTheme needs a <FestivalTheme> above it');
  return value;
}

export function FestivalTheme({
  season,
  options,
  children,
}: {
  season: ThemeOption | null;
  options: ThemeOption[];
  children: ReactNode;
}) {
  const [chosen, setChosen] = useState<string | null>(null);
  const picked = options.find((option) => option.id === chosen) ?? null;
  const wearing = picked ?? season;

  const wear = (id: string | null) => {
    const next = id === season?.id ? null : id;
    const apply = () => flushSync(() => setChosen(next));
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!calm && typeof document.startViewTransition === 'function') {
      document.startViewTransition(apply);
    } else {
      apply();
    }
  };

  return (
    <FestivalThemeContext.Provider value={{ season, wearing, options, wear }}>
      {/* `contents`: the wrapper draws no box of its own, and custom
          properties still inherit through it to everything inside. */}
      <div className="contents" style={picked ? festivalVars(picked.palette) : undefined}>
        {children}
      </div>
    </FestivalThemeContext.Provider>
  );
}

/**
 * A kolam with however many petals the festival being worn has — or, for a
 * festival nobody draws a kolam for, that festival's own motif: a star for
 * Christmas, a crescent and lanterns for Eid.
 */
export function ThemedRangoli({
  fallbackPetals,
  className,
  strokeWidth,
  mono,
}: {
  fallbackPetals: number;
  className?: string;
  strokeWidth?: number;
  mono?: boolean;
}) {
  const { wearing } = useFestivalTheme();
  const look = wearing?.palette;
  if (look && !wearsGarland(look)) {
    return (
      <Motif
        id={look.motif}
        // A kolam turns; a star or a lantern moves the way it does instead.
        className={cn(
          className?.replace('motion-safe:animate-rangoli', ''),
          !mono && 'text-accent',
        )}
        style={mono ? undefined : ON_WASH}
      />
    );
  }
  return (
    <Rangoli
      petals={look?.petals ?? fallbackPetals}
      className={className}
      strokeWidth={strokeWidth}
      mono={mono}
    />
  );
}

/**
 * What hangs along the top and foot of the page: a marigold garland for the
 * festivals a doorway is dressed that way for, and a string of the festival's
 * own motif for the rest — stars at Christmas, crescents at Eid, the three
 * colours on a national day.
 */
export function SeasonTrim({ id }: { id: string }) {
  const { wearing } = useFestivalTheme();
  const look = wearing?.palette;
  if (!look || wearsGarland(look)) return <Garland id={id} />;
  return (
    <div
      aria-hidden="true"
      className="text-accent flex h-[46px] items-center justify-center gap-5 overflow-hidden"
      style={ON_WASH}
    >
      {Array.from({ length: 40 }, (_, index) =>
        index % 2 ? (
          <span key={index} className="bg-ribbon/50 size-1 shrink-0 rounded-full" />
        ) : (
          <Motif key={index} id={look.motif} compact className="size-6 shrink-0" />
        ),
      )}
    </div>
  );
}

/**
 * The festivals coming up, as swatches that dress the page when tapped. Each
 * card is drawn in its own festival's colours whatever the page is wearing.
 */
export function FestivalPicker() {
  const { options, wearing, wear } = useFestivalTheme();
  return (
    <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
      {options.map((option) => {
        const on = wearing?.id === option.id;
        return (
          <li key={option.id}>
            <button
              type="button"
              aria-pressed={on}
              onClick={() => wear(option.id)}
              style={festivalVars(option.palette)}
              className={cn(
                'group relative isolate flex h-full w-full flex-col overflow-hidden rounded-2xl border p-4 text-left',
                'bg-[var(--festival-wash)] transition-[transform,box-shadow,border-color] duration-300',
                'hover:-translate-y-1 hover:shadow-lg motion-reduce:hover:translate-y-0',
                on
                  ? 'border-accent ring-accent shadow-md ring-2'
                  : 'border-border-base hover:border-accent/50',
              )}
            >
              <span
                aria-hidden="true"
                className="from-accent to-ribbon absolute inset-x-0 top-0 h-1 bg-linear-to-r"
              />
              {wearsGarland(option.palette) ? (
                <Rangoli
                  petals={option.palette.petals}
                  strokeWidth={1.6}
                  className="pointer-events-none absolute -top-8 -right-8 -z-10 size-24 opacity-30 transition-transform duration-700 group-hover:rotate-45 group-hover:opacity-50"
                />
              ) : (
                <Motif
                  id={option.palette.motif}
                  compact
                  className="text-accent pointer-events-none absolute -top-5 -right-5 -z-10 size-20 opacity-30 transition-opacity duration-700 group-hover:opacity-50"
                  style={ON_WASH}
                />
              )}
              <FestivalTile festival={option.palette} className="size-11" />
              <span className="text-ink mt-3 font-semibold">{option.name}</span>
              <span className="text-ink-muted mt-0.5 text-sm">{option.when}</span>
              <span
                className={cn(
                  'mt-3 inline-flex items-center gap-1 text-xs font-medium',
                  on ? 'text-accent' : 'text-ink-subtle group-hover:text-accent',
                )}
              >
                <SparklesIcon className="size-3.5" aria-hidden="true" />
                {on ? 'The page is wearing it' : 'Try its colours'}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Says so when the page is wearing somebody else's festival, with the way
 * back — otherwise a visitor who scrolled up would find a page in colours
 * they have forgotten choosing.
 */
export function ThemeToast() {
  const { season, wearing, wear } = useFestivalTheme();
  const away = wearing && season && wearing.id !== season.id;
  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 flex justify-center px-4"
    >
      {away ? (
        <div className="border-border-base bg-surface-raised/95 text-ink pointer-events-auto flex items-center gap-3 rounded-full border py-1.5 pr-1.5 pl-4 text-sm shadow-lg backdrop-blur-md">
          <span className="min-w-0">
            <Motif
              id={wearing.palette.motif}
              compact
              className="text-accent mr-1.5 inline-block size-4 align-[-3px]"
            />
            <span className="max-sm:sr-only">Wearing </span>
            {wearing.name}&rsquo;s colours
          </span>
          <button
            type="button"
            onClick={() => wear(null)}
            className="bg-accent text-accent-ink shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap pointer-coarse:min-h-11"
          >
            Back to {season.name}
          </button>
        </div>
      ) : null}
    </div>
  );
}
