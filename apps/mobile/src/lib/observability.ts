import * as Sentry from '@sentry/react-native';

/**
 * Crash reporting for the phone app, and the limits on what it may carry.
 *
 * Off unless EXPO_PUBLIC_SENTRY_DSN is set, so a build without one — CI's
 * bundle check, a local run, a fork — behaves exactly as it did before this
 * existed.
 *
 * The privacy rules are the same as the web app's, and they are a decision
 * rather than a default. Residents' names, flats, phone numbers and payment
 * references are what the whole RLS layer exists to protect; posting them to a
 * third party to symbolicate a stack trace would undo that quietly. It is also
 * what the Play Data Safety form and the App Store privacy labels have to
 * declare, and "crash logs contain no personal data" is only sayable if it is
 * actually true.
 *
 * So no PII, no session replay, no traces — and a scrubber for the places a
 * name can still hide.
 */
const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';

export const SENTRY_ENABLED = DSN.length > 0;

export function initErrorReporting() {
  if (!SENTRY_ENABLED) return;

  Sentry.init({
    dsn: DSN,
    environment: process.env.EXPO_PUBLIC_SENTRY_ENV ?? 'production',
    sendDefaultPii: false,
    tracesSampleRate: 0,
    // A replay of somebody typing their flat number and phone is exactly the
    // recording this app should not be making.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    beforeSend(event) {
      delete event.user;
      if (event.request) {
        delete event.request.cookies;
        delete event.request.data;
        delete event.request.query_string;
        // compences://invite/CODE carries a working invite code in the path.
        if (typeof event.request.url === 'string') {
          event.request.url = event.request.url.replace(/\/invite\/[^/]+/, '/invite/[code]');
        }
      }
      return event;
    },
  });
}

/**
 * Reports something we caught ourselves and handled.
 *
 * The screens already log a failed read to the console with its PostgREST
 * code; this sends the same thing on, so a resident hitting a broken query is
 * something somebody finds out about rather than something they put up with.
 */
export function reportHandled(error: unknown, where: string) {
  if (!SENTRY_ENABLED) return;
  Sentry.captureException(error, { tags: { where } });
}
