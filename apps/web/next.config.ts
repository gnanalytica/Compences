import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs/config';

const nextConfig: NextConfig = {
  // iOS universal links. The file has no extension, so without this it goes
  // out as application/octet-stream, which Apple's CDN can refuse to read.
  async headers() {
    return [
      {
        source: '/.well-known/apple-app-site-association',
        headers: [{ key: 'Content-Type', value: 'application/json' }],
      },
    ];
  },
};

/**
 * Sentry wraps the build to upload source maps, so a stack trace names a line
 * of our code rather than a column in a minified bundle.
 *
 * Uploading needs SENTRY_AUTH_TOKEN, org and project. Without them the wrapper
 * is a no-op and the build is what it always was — which is what CI, a fork and
 * a local checkout all get.
 */
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  // Nothing to upload without a token; saying so keeps the build quiet.
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  // Routes Sentry's own browser requests through our origin so an ad blocker
  // does not silently swallow every report from a resident's phone.
  tunnelRoute: '/monitoring',
});
