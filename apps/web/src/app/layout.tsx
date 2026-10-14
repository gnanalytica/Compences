import type { Metadata, Viewport } from 'next';
import { APPEARANCE_SCRIPT, THEME_COLOR } from '@/lib/appearance';
import { sans, serif } from './fonts';
import './globals.css';

export const metadata: Metadata = {
  /**
   * The link preview a shared URL unfurls into — on WhatsApp above all, which
   * is where a society's links get passed around. The image is
   * app/opengraph-image.jpg: the video's cover, play button and length
   * included, made by `npm run share` in video/. It needs an absolute URL, and
   * this is what it is built on.
   *
   * No og:title or og:description here on purpose: children inherit them, so
   * a shared privacy policy would unfurl as the front page's pitch. Without
   * them each page falls back to its own title and description.
   */
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://compences.com'),
  title: {
    default: 'Compences',
    template: '%s · Compences',
  },
  description:
    'Plan society events together: activities, budgets, contributions and every bill, open to residents on the web and on their phone.',
  applicationName: 'Compences',
  openGraph: { type: 'website', siteName: 'Compences', locale: 'en_IN' },
  twitter: { card: 'summary_large_image' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The script marks <html> with the chosen appearance before React hydrates it.
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${serif.variable}`}>
      <head>
        {/* One per device appearance, for System. Light or Dark adds a tag of
            its own ahead of these (lib/appearance.ts). */}
        <meta
          name="theme-color"
          media="(prefers-color-scheme: light)"
          content={THEME_COLOR.light}
        />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content={THEME_COLOR.dark} />
        <script dangerouslySetInnerHTML={{ __html: APPEARANCE_SCRIPT }} />
      </head>
      <body className="min-h-dvh font-sans antialiased">
        <a
          href="#main"
          className="bg-accent text-accent-ink sr-only rounded-lg px-4 py-2 focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
