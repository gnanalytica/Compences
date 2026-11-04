import Image from 'next/image';
import mark from './brand-mark.png';

/**
 * The Compences mark on navy, the same render as the app icon. Drawn by
 * scripts/render-brand.mjs from docs/brand/compences-mark.svg, so the site and
 * the phone show one mark. Decorative: it always sits beside the
 * word "Compences", which carries the name for screen readers.
 */
export function BrandMark({ className = 'size-8 rounded-lg' }: { className?: string }) {
  return <Image src={mark} alt="" className={`shrink-0 ${className}`} priority />;
}
