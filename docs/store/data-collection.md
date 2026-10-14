# What Compences actually collects

The inventory both store forms are filled in from. It is written from the
schema in `supabase/migrations/` and the code that reads and writes it, not
from what the product would like to be true — if a row below does not match
`\d public.<table>`, the row is wrong.

**Change this file first.** The Play Data Safety form, the App Store privacy
labels, the `ios.privacyManifests` block in `apps/mobile/app.json` and the
Privacy Policy at `apps/web/src/app/(legal)/privacy/page.tsx` are all
downstream of it, and a disclosure that has quietly stopped being true is a
worse problem than one that was never filed.

---

## Collected, and linked to you

| What                          | Where it lives                                                                | Why                                             | Optional?                                      |
| ----------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------- | ---------------------------------------------- |
| Name                          | `profiles.full_name`                                                          | Your neighbours need to know who is on the list | Required                                       |
| Email address                 | `profiles.email`, `auth.users`                                                | It is how you sign in                           | Required                                       |
| Phone number                  | `profiles.phone`, `join_requests.claimed_phone`                               | So staff and the committee can reach you        | Optional                                       |
| Profile photo                 | `profiles.avatar_url` (from Google, if you sign in with it)                   | Shown beside your name                          | Optional                                       |
| Which society, which flat     | `memberships`, `unit_occupants`, `units`                                      | The whole product; also who may read what       | Required                                       |
| Join requests                 | `join_requests`                                                               | The admin approves or declines                  | Required to join that way                      |
| Invite codes tried            | `invite_code_attempts.code_tried`                                             | Rate-limits brute force                         | Required                                       |
| Contributions                 | `contributions` — amount, UPI reference, receipt number                       | The society ledger                              | Optional (you need not contribute)             |
| Expenses you filed            | `expenses` — vendor, amount, bill                                             | The society ledger                              | Staff and committee only                       |
| Bills and payment screenshots | `storage.bills`, `storage.payment-proofs` (both private)                      | Proof behind a ledger line                      | Optional                                       |
| Votes, sign-ups, volunteering | `poll_votes`, `suggestion_votes`, `activity_participants`, `event_volunteers` | Taking part                                     | Optional                                       |
| Things you wrote              | `activity_suggestions`, `comments`, `announcements`                           | Taking part                                     | Optional                                       |
| Push notification token       | `device_push_tokens.token`, plus platform and app version                     | Sending you a notification                      | Optional — declining notifications stores none |
| WhatsApp number and messages  | `whatsapp_links`, `whatsapp_messages`                                         | Only if you use the WhatsApp bot                | Optional                                       |
| Audit trail                   | `audit_log` — the fields that moved, and who moved them                       | So a ledger cannot be quietly corrected         | Required                                       |

## Collected, and **not** linked to you

| What                                 | Where it goes                  | Why                                                                  |
| ------------------------------------ | ------------------------------ | -------------------------------------------------------------------- |
| Crash reports and error stack traces | Sentry, if a DSN is configured | So a resident hitting a broken screen is something we find out about |

This is the one entry that carries a deliberate technical decision rather than
a description. Both apps initialise Sentry with `sendDefaultPii: false`, no
session replay, no traces, and a `beforeSend` that deletes the `user` object,
cookies, request bodies and query strings, keeps only `content-type` and
`user-agent` headers, and rewrites `/invite/CODE` to `/invite/[code]`. See
`apps/web/src/lib/observability.ts` and `apps/mobile/src/lib/observability.ts`.

It is done that way _so that_ the answer to both stores can be "crash logs,
not linked to identity" — which is only sayable because it is true.

## Not collected at all

Checked, rather than assumed:

- **Location, of any precision.** No `expo-location`, no geolocation call.
- **Contacts.** No `expo-contacts`.
- **Microphone.** `expo-image-picker` is configured with
  `microphonePermission: false`, and the generated Android manifest carries
  `RECORD_AUDIO` with `tools:node="remove"`.
- **Advertising identifiers, and any advertising at all.** No ad SDK, no
  `AdvertisingData`.
- **Analytics or behavioural tracking.** No analytics SDK of any kind — no
  Firebase Analytics, PostHog, Mixpanel, Amplitude, or Google Tag Manager.
- **Payment instruments.** Compences _records_ that a UPI payment happened and
  its reference; it never touches a card number, a UPI PIN or a bank login,
  because it has no payment gateway integration of any kind.
- **Health, fitness, browsing history, search history, calendar, SMS, files
  other than the bills you attach.**

## Who else sees it

| Processor                | What reaches them                                    | Where                             |
| ------------------------ | ---------------------------------------------------- | --------------------------------- |
| Supabase                 | Everything above except crash reports                | Database in Mumbai (`ap-south-1`) |
| Vercel                   | Web requests and routine server logs                 | Regional                          |
| Expo, Apple, Google      | Push tokens and the notification text                | Regional                          |
| Meta (WhatsApp Business) | Your WhatsApp number and bot messages, if you use it | Regional                          |
| Google                   | Name, email, photo — only if you sign in with Google | Regional                          |
| Sentry                   | Crash reports, scrubbed as above                     | Only when a DSN is configured     |

Nothing is sold, and nothing is shared for advertising.

## Deletion

`public.delete_my_account()` (migration `20260920001100`) deletes the account
and everything personal attached to it, keeps ledger rows with the link to you
removed, and refuses only while you are the last committee member of a society
that still has other members. The in-app path is Settings on the web and Me on
the phone; the web page Play requires is `/delete-account`.
