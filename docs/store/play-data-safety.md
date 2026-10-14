# Play Console — Data safety

Every answer below comes from [`data-collection.md`](./data-collection.md).
Transcribe, do not re-derive: the point of one inventory is that the two stores
cannot end up saying different things about the same app.

Play Console → **App content** → **Data safety**.

## Before the data types: the questions at the top

| Question                                                              | Answer                                                                     |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Does your app collect or share any of the required user data types?   | **Yes**                                                                    |
| Is all of the user data collected by your app encrypted in transit?   | **Yes** — HTTPS/TLS throughout; Supabase, Vercel and Expo are all TLS-only |
| Do you provide a way for users to request that their data be deleted? | **Yes**                                                                    |
| Account deletion URL                                                  | `https://compences.com/delete-account`                                     |
| Does your app allow users to request account deletion in the app?     | **Yes** — Settings on the web, Me → Delete account on the phone            |
| Privacy policy URL                                                    | `https://compences.com/privacy`                                            |
| Independent security review                                           | **No** (do not tick it; there has not been one)                            |
| Play Families Policy                                                  | **Not applicable** — the app is for adults, 18+                            |

## The data types

For every row: **Collected = Yes**, **Shared = No**, **Processed ephemerally =
No**, **Purpose = App functionality** unless a row says otherwise. Nothing here
is collected for analytics, advertising, personalisation or developer
communications, because none of those exist in this app.

"Shared" in Play's sense means passing data to a _third party_ — a processor
acting on our instructions (Supabase, Vercel, Expo) is not sharing. Google's
own definition says so; the Privacy Policy lists them anyway.

### Personal info

| Data type     | Collected | Required or optional | Purposes                              | Note                                                                                     |
| ------------- | --------- | -------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------- |
| Name          | Yes       | Required             | App functionality, Account management | `profiles.full_name`                                                                     |
| Email address | Yes       | Required             | App functionality, Account management | It is the sign-in                                                                        |
| User IDs      | Yes       | Required             | App functionality, Account management | `auth.users.id`                                                                          |
| Phone number  | Yes       | Optional             | App functionality                     | So the committee can reach you                                                           |
| Address       | Yes       | Required             | App functionality                     | Your society and flat. Not a street address, but it is where you live, so it is declared |
| Other info    | No        | —                    | —                                     | —                                                                                        |

### Financial info

| Data type            | Collected | Required or optional | Purposes          | Note                                                                                 |
| -------------------- | --------- | -------------------- | ----------------- | ------------------------------------------------------------------------------------ |
| User payment info    | **No**    | —                    | —                 | There is no payment gateway. The app never sees a card number, UPI PIN or bank login |
| Purchase history     | No        | —                    | —                 | Nothing is bought in the app                                                         |
| Credit score         | No        | —                    | —                 | —                                                                                    |
| Other financial info | Yes       | Optional             | App functionality | Contribution amounts, the UPI reference you type in, and society expenses            |

### Photos and videos

| Data type | Collected | Required or optional | Purposes          | Note                                                |
| --------- | --------- | -------------------- | ----------------- | --------------------------------------------------- |
| Photos    | Yes       | Optional             | App functionality | Bills and payment screenshots, into private buckets |
| Videos    | No        | —                    | —                 | —                                                   |

### Messages

| Data type             | Collected | Required or optional | Purposes          | Note                                                                                   |
| --------------------- | --------- | -------------------- | ----------------- | -------------------------------------------------------------------------------------- |
| Other in-app messages | Yes       | Optional             | App functionality | Comments, suggestions and announcements you write; WhatsApp bot messages if you use it |
| Emails, SMS or MMS    | No        | —                    | —                 | The app does not read your email or SMS                                                |

### App activity

| Data type                    | Collected | Required or optional | Purposes          | Note                                                                                                         |
| ---------------------------- | --------- | -------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------ |
| App interactions             | **No**    | —                    | —                 | There is no analytics SDK. The audit trail records changes to the society's records, not your use of the app |
| Other user-generated content | Yes       | Optional             | App functionality | Votes, activity sign-ups, volunteer roles                                                                    |
| In-app search history        | No        | —                    | —                 | —                                                                                                            |
| Installed apps               | No        | —                    | —                 | —                                                                                                            |
| Other actions                | No        | —                    | —                 | —                                                                                                            |

### App info and performance

| Data type                  | Collected | Required or optional | Purposes          | Note                                                                                                                              |
| -------------------------- | --------- | -------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Crash logs                 | Yes       | Optional             | App functionality | Sentry, only when a DSN is configured. **Answer "Data is not linked to your identity"** — see the scrubbing in `observability.ts` |
| Diagnostics                | Yes       | Optional             | App functionality | The app version sent with a push token, and nothing else                                                                          |
| Other app performance data | No        | —                    | —                 | No traces; `tracesSampleRate: 0`                                                                                                  |

### Device or other IDs

| Data type           | Collected | Required or optional | Purposes          | Note                                                                |
| ------------------- | --------- | -------------------- | ----------------- | ------------------------------------------------------------------- |
| Device or other IDs | Yes       | Optional             | App functionality | The push notification token, stored only if you allow notifications |

### Everything else: No

Location (approximate and precise), Health and fitness, Audio files,
Files and docs, Calendar, Contacts, Web browsing history. Checked in
`data-collection.md` rather than assumed.

## Permissions Play will ask about

The Android manifest, after merging, declares:

| Permission                                                               | Why                                               | Source                                  |
| ------------------------------------------------------------------------ | ------------------------------------------------- | --------------------------------------- |
| `INTERNET`                                                               | It is a networked app                             | Template                                |
| `VIBRATE`                                                                | Notification vibration                            | `expo-notifications`                    |
| `POST_NOTIFICATIONS`                                                     | Android 13+ notification prompt                   | `expo-notifications`                    |
| `RECEIVE_BOOT_COMPLETED`                                                 | Rescheduling notifications after a restart        | `expo-notifications`                    |
| `CAMERA`                                                                 | Photographing a bill                              | `expo-image-picker`                     |
| `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE` (`maxSdkVersion="32"`) | Picking an existing photo on Android 12 and below | `expo-image-picker`, `expo-file-system` |

Two are deliberately removed, and stay removed:

- `RECORD_AUDIO` — via `microphonePermission: false`.
- `SYSTEM_ALERT_WINDOW` ("display over other apps") — the React Native
  template adds it for the developer menu. It is in
  `android.blockedPermissions` in `apps/mobile/app.json`; a release build has
  no use for it, and it is exactly the kind of permission a reviewer stops on.

Verify after any dependency change with:

```
cd apps/mobile && npx expo prebuild --platform android --no-install --clean
grep uses-permission android/app/src/main/AndroidManifest.xml
```

There is **no sensitive-permission declaration form to file**: the app requests
no `SMS`, `CALL_LOG`, `MANAGE_EXTERNAL_STORAGE`, `QUERY_ALL_PACKAGES`,
location or accessibility permission.
