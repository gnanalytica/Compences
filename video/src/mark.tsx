import { Img } from 'remotion';
import mark from '../../docs/brand/compences-mark.svg';

/**
 * The Compences mark as the app icon draws it: docs/brand/compences-mark.svg
 * on the navy of scripts/render-brand.mjs, nudged right by the same 19/1024
 * because the mark's own box is not centred in its viewBox.
 *
 * The covers and the title cards all draw it from here, so the video cannot
 * open on one mark and be shared under another.
 */
export function Mark({ size }: { size: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        overflow: 'hidden',
        borderRadius: size * 0.225,
        backgroundImage: 'radial-gradient(circle at 50% 45%, #16306B, #0A1736 75%)',
        boxShadow: `0 ${size * 0.06}px ${size * 0.2}px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.12)`,
      }}
    >
      <Img
        src={mark}
        style={{ width: size, height: size, transform: `translateX(${(19 / 1024) * size}px)` }}
      />
    </div>
  );
}
