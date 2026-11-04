import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Runs before every matched request.
 *
 * In Next.js 16 this file replaces `middleware.ts` and always runs on the
 * Node.js runtime. Its one job is to refresh the Supabase session cookie so
 * Server Components downstream see a valid user — plus a cheap redirect for
 * signed-out visitors.
 *
 * This is an optimistic check only. Every page and API route re-checks the
 * session itself, and RLS is the real boundary: a forged cookie gets nowhere.
 */

/** Routes reachable without a session. Everything else requires one. */
const PUBLIC_PATHS = [
  '/',
  '/login',
  // Shared join links; the route sends signed-out visitors to sign in.
  '/join',
  // The same, for a per-flat invite code. Without this the proxy sends them to
  // /login first and the route's own signed-out branch — which lands them on
  // the invite form rather than back here — never runs.
  '/invite',
  '/privacy',
  '/terms',
  // Google Play requires an account-deletion page reachable by somebody who
  // has already uninstalled the app, which means somebody who cannot sign in.
  // Putting it behind the session check would make the URL we file with Play
  // useless to exactly the people it is for.
  '/delete-account',
  // The App Store listing's Support URL; reviewers open it signed out.
  '/support',
  '/auth',
  '/api/webhooks',
  '/api/v1',
  '/api/mcp',
  '/api/health',
  // Android App Links verification. public/.well-known/assetlinks.json lists
  // the EAS signing key's SHA-256; after the first Google Play upload, append
  // the Play App Signing certificate's fingerprint too, or links from Play
  // installs open in the browser instead of the app.
  '/.well-known',
];

const isPublic = (pathname: string) =>
  PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Without configuration there is no session to refresh. Letting the request
  // through means the page itself renders the "not configured" message, which
  // is far easier to debug than a blank 500 from the proxy.
  if (!url || !anonKey) return response;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet, headers) => {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // A response that sets an auth cookie must never be cached by a CDN,
        // or one user's session could be handed to the next visitor.
        for (const [key, headerValue] of Object.entries(headers)) {
          response.headers.set(key, headerValue);
        }
      },
    },
  });

  // getClaims() refreshes an expiring session and verifies the token's
  // signature against the project's published signing keys, which are cached,
  // so this costs no call to Supabase on most requests. getSession() would
  // only read the cookie, which the client controls, so it must not gate
  // anything. Pages still call getUser() before showing private data.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims?.sub ? data.claims : null;

  const { pathname } = request.nextUrl;

  if (!user && !isPublic(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/login';
    // Remember where they were headed so login can send them back.
    redirectUrl.searchParams.set('next', pathname + request.nextUrl.search);
    return NextResponse.redirect(redirectUrl);
  }

  // Sending someone away from the login page needs a real account, not just a
  // well-signed token: a token outlives a deleted account or a revoked session
  // for up to an hour, and pages (which call getUser) would bounce it straight
  // back here in a loop. Only /login pays for this call to Supabase.
  if (user && pathname === '/login') {
    const {
      data: { user: account },
    } = await supabase.auth.getUser();
    if (!account) return response;
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/app';
    redirectUrl.search = '';
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except static assets, media files and crawler metadata —
     * matching those would burn a Node invocation per asset for no benefit,
     * and robots.txt and /.well-known files must answer crawlers and Android's
     * link verifier directly rather than redirect them to /login.
     *
     * Video belongs on that list for a harder reason than cost. Anything this
     * matcher catches goes through the session check below, and a file that is
     * not under a PUBLIC_PATHS prefix is answered with a redirect to /login —
     * so the demo on the landing page, which exists for people who have not
     * signed in, would be served to them as an HTML login page. The <video>
     * tag reports that as a decode failure, which is a long way from the
     * cause.
     */
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|\\.well-known/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|mp4|webm)$).*)',
  ],
};
