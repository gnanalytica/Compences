# App Store Connect — privacy

Two separate things, which are easy to confuse:

1. **The privacy nutrition label**, typed into App Store Connect → your app →
   **App Privacy**. Shown to people on the product page.
2. **`PrivacyInfo.xcprivacy`**, generated into the binary from
   `ios.privacyManifests` in `apps/mobile/app.json`. Read by Apple's tooling.

They must agree, and both come from
[`data-collection.md`](./data-collection.md).

## The nutrition label

Apple asks, per data type: is it collected, is it **linked to the user's
identity**, and is it used to **track** them across other companies' apps and
websites.

**Tracking: No, for everything.** There is no ad network, no data broker, no
advertising identifier, and `NSPrivacyTracking` is `false`. Do not enable App
Tracking Transparency; there is nothing to ask for.

### Data Linked to You — used for App Functionality

| Apple category | Type                 | What it actually is                                     |
| -------------- | -------------------- | ------------------------------------------------------- |
| Contact Info   | Name                 | `profiles.full_name`                                    |
| Contact Info   | Email Address        | The sign-in address                                     |
| Contact Info   | Phone Number         | Optional; so the committee can reach you                |
| Contact Info   | Physical Address     | Your society and flat                                   |
| Identifiers    | User ID              | `auth.users.id`                                         |
| Identifiers    | Device ID            | The push notification token, if you allow notifications |
| Financial Info | Other Financial Info | Contribution amounts and the UPI reference you type in  |
| User Content   | Photos or Videos     | Bills and payment screenshots                           |
| User Content   | Other User Content   | Suggestions, comments, announcements, votes, sign-ups   |

Tick **App Functionality** as the purpose for every one of them, and nothing
else. Do not tick Analytics: the app has no analytics.

### Data Not Linked to You

| Apple category | Type       | Why it is not linked                                                                                                                           |
| -------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Diagnostics    | Crash Data | Sentry, with `sendDefaultPii: false`, no replay, no traces, and a `beforeSend` that deletes the user object, cookies, bodies and query strings |

### Data Not Collected

Health & Fitness, Location (both kinds), Sensitive Info, Contacts, Browsing
History, Search History, Purchases, Payment Info, Audio Data, Gameplay
Content, Customer Support, Advertising Data, Product Interaction, Other Usage
Data.

**Payment Info in particular is "not collected", and that is not a
simplification**: there is no gateway in the app. It records that a UPI
payment happened and what reference the payer typed; a card number or a UPI
PIN never reaches it.

## `PrivacyInfo.xcprivacy`

Generated, not hand-written. `ios.privacyManifests` in `apps/mobile/app.json`
is the source; `npx expo prebuild --platform ios` writes
`ios/Compences/PrivacyInfo.xcprivacy` from it.

It declares the same collected types as the label above, plus the
**required-reason APIs** used by the libraries in the binary. Apple does not
reliably read the manifests inside static CocoaPods, so the app's own manifest
carries the union of theirs:

| API category     | Reasons                      | Comes from                                                                             |
| ---------------- | ---------------------------- | -------------------------------------------------------------------------------------- |
| `FileTimestamp`  | `C617.1`, `0A2A.1`, `3B52.1` | `expo-file-system`, `expo-application`, AsyncStorage, React Native, Folly, glog, boost |
| `UserDefaults`   | `CA92.1`                     | `expo-constants`, `expo-notifications`, React Native                                   |
| `SystemBootTime` | `35F9.1`                     | `expo-device`, React Native, boost                                                     |
| `DiskSpace`      | `E174.1`, `85F4.1`           | `expo-file-system`                                                                     |

After adding or upgrading a native dependency, re-derive rather than guess:

```
find node_modules -name PrivacyInfo.xcprivacy -not -path '*/.*'
```

and fold anything new into `ios.privacyManifests`. Apple also emails after a
TestFlight or App Store upload naming any reason it still wants.

## The other App Store requirements this app has to meet

- **Account deletion (5.1.1(v))** — in-app at Me → Delete account, and at
  `https://compences.com/delete-account`.
- **Sign in with Apple (4.8)** — required when an app offers a third-party
  social login as the _only_ other option. Compences offers Google **and** a
  plain email link, which is a first-party, equivalent option, so 4.8 is met
  without adding Apple sign-in. If Google ever becomes the only route, this
  changes.
- **Age rating** — 18+. The Terms require it and the Privacy Policy says so.
- **`ITSAppUsesNonExemptEncryption: false`** — already set in `app.json`. True:
  the app uses HTTPS and nothing else.
