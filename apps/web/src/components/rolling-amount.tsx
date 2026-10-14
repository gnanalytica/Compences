import type { CSSProperties } from 'react';
import { formatMoney } from '@compences/core';
import { cn } from '@/lib/utils';

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

/**
 * An amount whose digits roll up to their value as the page arrives, like the
 * board at a station. Pure CSS: the server renders every digit already in
 * place and the animation only runs from zero to there, so there is nothing
 * to hydrate, no flash of the wrong number, and with reduced motion it is
 * simply the number.
 *
 * Screen readers get the amount once, as text; the reels are hidden.
 */
export function RollingAmount({
  value,
  currency,
  className,
}: {
  value: number;
  currency: string;
  className?: string;
}) {
  const text = formatMoney(value, currency);
  let order = 0;
  return (
    <span className={cn('tabular inline-flex whitespace-nowrap', className)}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true" className="inline-flex">
        {Array.from(text).map((character, index) => {
          if (!/\d/.test(character)) return <span key={index}>{character}</span>;
          const digit = Number(character);
          const style = {
            '--i': order++,
            transform: `translateY(${-digit * 10}%)`,
          } as CSSProperties;
          return (
            // The invisible digit gives the reel its width and the line its
            // baseline; clip-path hides the rest of the reel without the
            // overflow that would move that baseline.
            <span key={index} className="relative inline-block [clip-path:inset(0)]">
              <span className="invisible">{character}</span>
              <span className="roll-digit absolute inset-x-0 top-0 flex flex-col" style={style}>
                {DIGITS.map((reel) => (
                  <span key={reel}>{reel}</span>
                ))}
              </span>
            </span>
          );
        })}
      </span>
    </span>
  );
}
