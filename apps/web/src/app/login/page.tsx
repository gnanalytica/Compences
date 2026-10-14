import Link from 'next/link';
import { LEGAL } from '@/lib/legal';
import { LoginForm } from './login-form';

export const metadata = { title: 'Sign in' };

export default async function LoginPage(props: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await props.searchParams;
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/app';

  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12">
      <Link href="/" className="mb-8 inline-flex items-center gap-2 self-start">
        <span className="bg-accent text-accent-ink grid size-8 place-items-center rounded-lg text-sm font-bold">
          स
        </span>
        <span className="font-serif text-lg font-medium tracking-tight">Compences</span>
      </Link>

      <h1 className="font-serif text-3xl font-medium tracking-tight">Sign in</h1>
      <p className="text-ink-muted mt-1.5 mb-8 text-sm">
        New here? Sign in first, then join with your society code or start your society.
      </p>

      <LoginForm next={safeNext} />

      <p className="text-ink-subtle mt-8 text-xs">
        By continuing you agree to the{' '}
        <Link href="/terms" className="underline underline-offset-4">
          Terms &amp; Conditions
        </Link>{' '}
        and acknowledge the{' '}
        <Link href="/privacy" className="underline underline-offset-4">
          Privacy Policy
        </Link>
        .
      </p>
      <p className="text-ink-subtle mt-3 text-xs">
        {LEGAL.product} · {LEGAL.byline}
      </p>
    </main>
  );
}
