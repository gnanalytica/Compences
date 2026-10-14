import Link from 'next/link';
import { ButtonLink } from '@/components/ui/button';
import { LEGAL } from '@/lib/legal';

/** Shared chrome for /privacy and /terms: the landing page's header and footer
 *  around a narrower column that reads comfortably at length. */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <Link href="/" className="inline-flex items-center gap-2">
          <span className="bg-accent text-accent-ink grid size-8 place-items-center rounded-lg text-sm font-bold">
            स
          </span>
          <span className="text-lg font-semibold tracking-tight">Compences</span>
        </Link>
        <ButtonLink href="/login" variant="secondary" size="sm">
          Sign in
        </ButtonLink>
      </header>

      <main id="main" className="mx-auto max-w-3xl px-6 pt-8 pb-16 sm:pt-12">
        {children}
      </main>

      <footer className="text-ink-subtle mx-auto max-w-5xl px-6 py-10 text-sm">
        <div className="border-border-base flex flex-wrap items-center justify-between gap-4 border-t pt-6">
          <span>Compences · operated by {LEGAL.operator}</span>
          <nav aria-label="Legal" className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/" className="underline underline-offset-4">
              Home
            </Link>
            <Link href="/privacy" className="underline underline-offset-4">
              Privacy Policy
            </Link>
            <Link href="/terms" className="underline underline-offset-4">
              Terms &amp; Conditions
            </Link>
            <Link href="/delete-account" className="underline underline-offset-4">
              Delete your account
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
