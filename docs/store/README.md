# Shipping Compences to the two stores

Four documents, in the order they depend on each other:

1. **[data-collection.md](./data-collection.md)** — what the app actually
   collects, read off the schema and the code. Everything else is downstream of
   it, so it is the one to change first.
2. **[play-data-safety.md](./play-data-safety.md)** — the Play Console Data
   safety form, answer by answer.
3. **[app-store-privacy.md](./app-store-privacy.md)** — the App Store privacy
   nutrition label, plus the `PrivacyInfo.xcprivacy` the binary carries.
4. **[listings.md](./listings.md)** — the listing copy for both stores, with
   the limit each field is held to. `apps/web/test/store-listing.test.ts`
   measures them, so an over-long field fails CI instead of failing at
   submission.

## What is done in the repository

- **Account deletion.** `public.delete_my_account()` (migration
  `20260920001100`), the in-app path in both apps, and the public page at
  `/delete-account` that Play requires for people who have already
  uninstalled. Proved by sixteen assertions in `supabase/tests/02_rls_test.sql`.
- **Privacy Policy and Terms**, at `/privacy` and `/terms`, written against the
  DPDP Act 2023 and kept in step with what the code does.
- **iOS privacy manifest**, from `ios.privacyManifests` in
  `apps/mobile/app.json`, including the required-reason APIs of every native
  dependency in the binary.
- **Android permissions**, audited against the generated manifest rather than
  guessed. `SYSTEM_ALERT_WINDOW` and `RECORD_AUDIO` are removed; nothing that
  needs a sensitive-permission declaration is requested.
- **Crash reporting with no personal data in it**, which is what makes the
  "not linked to identity" answer on both forms true rather than hopeful.
- **`ITSAppUsesNonExemptEncryption: false`**, and it is accurate.
- **Privacy Policy and Terms linked inside the app** — on the sign-in screen
  and at the foot of Me. Both stores want them in the app, not only on the
  listing.
- **iPhone only** (`ios.supportsTablet: false`). The app is portrait and laid
  out for a phone; claiming iPad would mean iPad screenshots and an iPad
  layout review. It still runs on an iPad in iPhone mode.
- **Push end to end.** The database writes a notification row,
  `pg_net` calls `/api/webhooks/push-dispatch`, which sends through Expo's
  push service to APNs (iOS) and Firebase Cloud Messaging (Android). Firebase
  is there for FCM only: `google-services.json` and nothing else — no Firebase
  SDK, no Analytics.

## What still needs a person

Not oversights — none of these can live in a repository.

| #   | Item                                                                   | Blocks                                               |
| --- | ---------------------------------------------------------------------- | ---------------------------------------------------- |
| 1   | Screenshots and the Play feature graphic                               | Both stores                                          |
| 2   | A support URL that is answered                                         | Both stores                                          |
| 3   | Play content-rating questionnaire, and 18+ age rating on both          | Both stores                                          |
| 4   | `SENTRY_DSN` / `EXPO_PUBLIC_SENTRY_DSN` set in the deploy environments | Nothing — both apps run inert without one, by design |
| 5   | Apple Team ID, for iOS universal links                                 | iOS deep links only                                  |
| 6   | A legal review of the Privacy Policy and Terms                         | Judgement call; they are drafts                      |
| 7   | **Sign in with Apple**: Apple key in the web env, Supabase provider on | App Store review (Guideline 4.8) — code is done      |
| 8   | A way for the reviewers to get in — see below                          | Both stores' review                                  |
| 9   | FCM V1 service-account key uploaded to EAS                             | Android pushes (tokens register, sends fail)         |
| 10  | Apple Developer account, APNs key and iOS signing in EAS               | Any iOS build; iOS pushes                            |
| 11  | A first `production` (AAB) Android build, and the Play app created     | Play submission — only APKs have been built so far   |
| 12  | The Grievance Officer's name in `LEGAL.grievanceOfficer`               | IT Rules 2021 ask for a named person                 |
| 13  | Restrict the Android API key in `google-services.json` to the app      | Nothing; it is public by design, but scope it        |

### 7 and 8, the two that will bounce an iOS submission

**Sign in with Apple.** The only sign-in the app offers is Google (email links
are switched off in `src/lib/sign-in-options.ts`). Guideline 4.8 requires an
app that uses a third-party login to also offer one that collects only name
and email and lets the person hide their email — in practice, Sign in with
Apple. The code is in: `expo-apple-authentication` and `ios.usesAppleSignIn`
in the app, and token revocation on deletion (`apps/web/src/lib/apple.ts`, see
`app-store-privacy.md`). What is left is configuration: the Sign in with Apple
capability on the App ID, the Apple provider in Supabase with
`com.compences.app` as an authorised client ID, and `APPLE_TEAM_ID`,
`APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` on the web deployment.

**Reviewer access.** Both stores need credentials that reach the inside of the
app. With Google-only sign-in that means a dedicated Google account, which
Google often challenges on a new device, and the account must already be an
approved member of a demo society. Create that society (`pnpm db:seed`
against production, or `pnpm society:create`), approve the reviewer account
in it, and put the credentials in App Review Information and Play's App
access section.

### The DPDP Rules timeline

The Digital Personal Data Protection Rules, 2025 phase in until May 2027. The
policy already covers notice, consent withdrawal, the 90-day grievance window
and breach reporting. One obligation is not met by the stack today: keeping
access logs for **one year** (Rule 6). Supabase and Vercel keep days, not a
year. Before May 2027, drain logs somewhere that keeps them (a Vercel log
drain, Supabase log export) — `audit_log` already keeps the in-app actions.

### 5, in a little more detail

Android app links work: `assetlinks.json` is served from
`apps/web/public/.well-known/`, and the intent filters cover `/join` and
`/invite`. The fingerprint in that file is the SHA-256 of the certificate the
EAS-managed keystore signs the APK with. Once the app is on Play with Play App
Signing, Play re-signs it, so add Play's SHA-256 (Play Console → App
integrity) as a second entry rather than replacing the first. iOS has no
equivalent yet, so on an iPhone those two links open the
website rather than the app — which works, but is not the same thing. Closing
it needs:

- `ios.associatedDomains: ["applinks:compences.com"]` in
  `apps/mobile/app.json`;
- an `apple-app-site-association` file served from
  `apps/web/public/.well-known/`, naming `<TeamID>.com.compences.app` with the
  `/join/*` and `/invite/*` paths;
- the Associated Domains capability on the App ID.

The Team ID is the only part that is not in the repository, and putting a
placeholder there would be worse than leaving it out: a wrong one fails
silently, at runtime, on somebody else's phone.

## After changing a dependency

Two things drift without saying so. Re-derive rather than assume:

```bash
# Android permissions, from the manifest that is actually generated
cd apps/mobile && npx expo prebuild --platform android --no-install --clean
grep uses-permission android/app/src/main/AndroidManifest.xml
rm -rf android            # it is gitignored; do not leave it behind

# iOS required-reason APIs, from the dependencies that declare them
find node_modules -name PrivacyInfo.xcprivacy -not -path '*/.*'
```
