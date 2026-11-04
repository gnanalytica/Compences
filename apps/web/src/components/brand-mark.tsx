import Image from 'next/image';
import mark from './brand-mark.png';

/**
 * The gold currency-C, the same artwork as the app icon (apps/mobile/assets/icon.png),
 * so the site and the phone show one mark. Decorative: it always sits beside the
 * word "Compences", which carries the name for screen readers.
 */
export function BrandMark({ className = 'size-8 rounded-lg' }: { className?: string }) {
  return <Image src={mark} alt="" className={`shrink-0 ${className}`} priority />;
}
