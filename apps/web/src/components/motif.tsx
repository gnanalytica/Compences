import type { CSSProperties } from 'react';
import { motifLayers, motifViewBox, type MotifId, type MotifPaint } from '@compences/core';
import { cn } from '@/lib/utils';

/** How each paint in a motif's data is drawn here. */
function paint(value: MotifPaint | undefined) {
  if (value === undefined) return 'none';
  if (value === 'line' || value === 'soft') return 'currentColor';
  if (value === 'light') return 'var(--motif-light)';
  return value;
}

/**
 * A festival's motif (core/motifs.ts), drawn in `currentColor` with its lights
 * in --motif-light. Large, all of it and moving on a hero; small, only its
 * essentials and still on a tile — a list of twenty events is not twenty
 * flickering lamps.
 *
 * Decorative: hidden from screen readers, and every movement is behind
 * prefers-reduced-motion (globals.css).
 */
export function Motif({
  id,
  compact = false,
  calm = false,
  className,
  style,
}: {
  id: MotifId;
  compact?: boolean;
  /** Half the pace, for a calm look. */
  calm?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const layers = motifLayers(id, compact);
  if (!layers.length) return null;
  return (
    <svg
      viewBox={motifViewBox(id, compact)}
      className={cn('motif overflow-visible', calm && 'motif-calm', className)}
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      {layers.map((layer, index) => {
        const moving = !compact && layer.motion;
        return (
          <g
            key={index}
            className={moving ? `motif-${layer.motion}` : undefined}
            style={
              moving
                ? {
                    transformOrigin: `${layer.origin?.[0] ?? 60}px ${layer.origin?.[1] ?? 60}px`,
                    animationDelay: `${layer.delay ?? 0}s`,
                  }
                : undefined
            }
          >
            {layer.paths.map((path, at) => (
              <path
                key={at}
                d={path.d}
                fill={paint(path.fill)}
                stroke={paint(path.stroke)}
                strokeWidth={path.width ?? 1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                opacity={path.opacity}
                className={path.fill === 'soft' ? 'motif-soft' : undefined}
              />
            ))}
          </g>
        );
      })}
    </svg>
  );
}
