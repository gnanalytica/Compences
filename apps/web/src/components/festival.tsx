import type { CSSProperties, ReactNode } from 'react';
import { heroGradient, type Festival } from '@compences/core';
import { cn } from '@/lib/utils';
import { Motif } from './motif';

/**
 * Hands a subtree the festival's colours by re-pointing the same tokens the
 * rest of the app already reads. Nothing below needs to know which festival it
 * is in — `text-accent` simply means marigold on a Deepavali page and
 * vermilion on a Dasara one.
 *
 * `light-dark()` carries both themes in one value, so this works without a
 * second set of rules under the dark-mode media query — in a browser that has
 * it. Safari gained it in 17.5 and Chrome in 123, after the 16.4 and 111 this
 * app is built for, and without it the value is invalid and `--accent` has
 * none: a white button label on nothing. So both halves are set again on
 * their own, and globals.css picks between them where `light-dark()` is
 * missing.
 */
export function festivalVars(festival: Festival): CSSProperties {
  return {
    '--accent': `light-dark(${festival.accent[0]}, ${festival.accent[1]})`,
    '--ribbon': `light-dark(${festival.ribbon[0]}, ${festival.ribbon[1]})`,
    '--festival-wash': `light-dark(${festival.wash[0]}, ${festival.wash[1]})`,
    '--accent-light': festival.accent[0],
    '--accent-dark': festival.accent[1],
    '--ribbon-light': festival.ribbon[0],
    '--ribbon-dark': festival.ribbon[1],
    '--festival-wash-light': festival.wash[0],
    '--festival-wash-dark': festival.wash[1],
  } as CSSProperties;
}

/**
 * A kolam drawn from the festival's petal count: a centre, a ring of petals,
 * an outer ring offset by half a step, and the dots the pattern is laid out
 * around. Decorative — it carries no meaning and is hidden from screen readers.
 */
export function Rangoli({
  petals,
  className,
  strokeWidth = 1.5,
  mono = false,
}: {
  petals: number;
  className?: string;
  strokeWidth?: number;
  /**
   * Draw the whole kolam in `currentColor` instead of the two festival
   * colours — for placing it on top of the festival gradient, where the
   * accent would disappear into the background it is made of.
   */
  mono?: boolean;
}) {
  const step = (Math.PI * 2) / petals;
  const petal = (index: number, radius: number, length: number, width: number) => {
    const angle = index * step;
    const tipX = 50 + Math.cos(angle) * (radius + length);
    const tipY = 50 + Math.sin(angle) * (radius + length);
    const baseX = 50 + Math.cos(angle) * radius;
    const baseY = 50 + Math.sin(angle) * radius;
    const left = angle - width;
    const right = angle + width;
    const midRadius = radius + length * 0.55;
    return [
      `M ${baseX.toFixed(2)} ${baseY.toFixed(2)}`,
      `Q ${(50 + Math.cos(left) * midRadius).toFixed(2)} ${(50 + Math.sin(left) * midRadius).toFixed(2)}`,
      `${tipX.toFixed(2)} ${tipY.toFixed(2)}`,
      `Q ${(50 + Math.cos(right) * midRadius).toFixed(2)} ${(50 + Math.sin(right) * midRadius).toFixed(2)}`,
      `${baseX.toFixed(2)} ${baseY.toFixed(2)}`,
      'Z',
    ].join(' ');
  };

  const ring = Array.from({ length: petals }, (_, index) => index);
  const strokeAccent = mono ? 'stroke-current' : 'stroke-accent';
  const fillAccent = mono ? 'fill-current' : 'fill-accent';
  const strokeRibbon = mono ? 'stroke-current' : 'stroke-ribbon';
  const fillRibbon = mono ? 'fill-current' : 'fill-ribbon';

  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      aria-hidden="true"
      focusable="false"
      fill="none"
      strokeWidth={strokeWidth}
    >
      <circle cx="50" cy="50" r="7" className={strokeAccent} />
      <circle cx="50" cy="50" r="2.5" className={fillAccent} stroke="none" />
      {ring.map((index) => (
        <path
          key={`inner-${index}`}
          d={petal(index, 8, 13, step * 0.34)}
          className={strokeAccent}
        />
      ))}
      {ring.map((index) => (
        <path
          key={`outer-${index}`}
          d={petal(index + 0.5, 23, 17, step * 0.3)}
          className={strokeRibbon}
        />
      ))}
      {ring.map((index) => {
        const angle = index * step;
        return (
          <circle
            key={`dot-${index}`}
            cx={(50 + Math.cos(angle) * 44).toFixed(2)}
            cy={(50 + Math.sin(angle) * 44).toFixed(2)}
            r="1.6"
            className={fillRibbon}
            stroke="none"
          />
        );
      })}
    </svg>
  );
}

/**
 * How a motif sits on a banner: in a column of its own to the right of the
 * words, like the illustration on an invitation card, never under them. Its
 * lines are a little faint so the lights and colours carry it.
 */
export const HERO_MOTIF = 'text-white/60 opacity-80 md:opacity-90';

/** The width the words on a banner keep to, leaving the motif its column. */
export const HERO_TEXT = 'max-w-[62%] sm:max-w-[64%] md:max-w-2xl';

/** The banner behind an event's title: its festival's colour, lit from a corner. */
export function heroBackground(festival: Festival, from = '92% 0%') {
  const [glow, middle, deep] = heroGradient(festival);
  return `radial-gradient(130% 125% at ${from}, ${glow} 0%, ${middle} 46%, ${deep} 100%)`;
}

/**
 * An event's banner: its festival's colour, and the thing the festival is
 * decorated with drawn large and faint across the corner — a lamp for
 * Deepavali, lanterns for Eid, a star for Christmas — moving the way it does.
 * White type on it, set in the serif. A day of mourning gets the colour and
 * nothing else.
 */
export function FestivalHero({
  festival,
  eyebrow,
  title,
  meta,
  back,
  action,
  className,
}: {
  festival: Festival;
  eyebrow?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  /** A link back, above everything else. */
  back?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn('relative isolate overflow-hidden text-white', className)}
      style={{ background: heroBackground(festival) }}
    >
      <Motif
        id={festival.motif}
        calm={festival.mood !== 'festive'}
        className={cn(
          'pointer-events-none absolute top-10 -right-3 size-44 sm:top-6 sm:size-56 md:right-8 md:size-64',
          HERO_MOTIF,
        )}
        style={{ '--motif-soft': 0.4 } as CSSProperties}
      />
      <div className="relative px-4 pt-5 pb-12 md:px-6 md:pt-7 md:pb-14">
        {back ? <div className="text-sm text-white/80">{back}</div> : null}
        <div className={HERO_TEXT}>
          {eyebrow ? (
            <p className="mt-7 text-[10.5px] font-semibold tracking-[0.16em] text-white/75 uppercase md:mt-9">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="mt-1.5 font-serif text-3xl leading-tight font-medium tracking-tight text-balance md:text-4xl">
            {title}
          </h1>
          {meta ? <p className="mt-1.5 text-sm text-white/80">{meta}</p> : null}
        </div>
        {action ? <div className="mt-4 flex flex-wrap items-center gap-2">{action}</div> : null}
      </div>
    </div>
  );
}

/**
 * A small square of the festival: its banner colour and its motif, whole and
 * still. What an event looks like in a list.
 */
export function FestivalTile({ festival, className }: { festival: Festival; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-[14px] text-white shadow-sm',
        className,
      )}
      style={{ background: heroBackground(festival, '100% 0%') }}
    >
      <Motif id={festival.motif} compact className="size-[76%]" />
    </span>
  );
}
