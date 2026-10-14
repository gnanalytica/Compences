/**
 * The web app's address, for join links and pages that live on the website.
 * EXPO_PUBLIC_SITE_URL overrides it for staging builds.
 */
export const SITE_URL = (
  process.env.EXPO_PUBLIC_SITE_URL ?? 'https://compences.com'
).replace(/\/$/, '');
