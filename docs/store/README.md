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
