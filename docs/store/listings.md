# Store listings

The copy for both stores, with the limit each field is held to. Everything in
a `text` block below is meant to be pasted in exactly as it is;
`apps/web/test/store-listing.test.ts` measures each one, so a line that has
grown past its limit fails CI rather than failing at submission.

Nothing here describes a feature the app does not have. A listing that
oversells is not just dishonest — Play and Apple both reject on it, and a
resident who installs expecting to pay their maintenance bill here is a
one-star review that is nobody's fault but ours.

---

## Google Play

### play.title — max 30

```text
Compences: Society Events
```

### play.short — max 80

```text
Plan your society's events together, and see every rupee raised and spent.
```

### play.full — max 4000

```text
Compences is for the people who actually run a residential society's festivals — the ones with the spreadsheet, the WhatsApp group with 214 unread messages, and a shoebox of bills nobody wants to be responsible for.

It is built around the event, not the building. Ganesh Chaturthi, Sports Day, a Diwali cultural evening: each one gets its own checklist, its own fund, its own activities, and its own ledger that every resident can read.

PLAN IT TOGETHER
• A step-by-step wizard for a new event: details, budget, what it needs, the cultural acts, the checklist, and what happens to any surplus — decided before a rupee is collected.
• A checklist with owners and due dates, so "readiness" is a number instead of an argument.
• Residents sign up for activities and volunteer roles themselves.
• Residents suggest ideas; the committee opens them for a vote; the count decides.

SEE WHERE THE MONEY WENT
• Every confirmed contribution and every approved bill, for every event, on one screen any member can open.
• Money out names the vendor, the amount, who approved it, and has the bill attached.
• Money in names who paid and their flat — the way a contribution list always has — and nothing else about them. No phone numbers, no email addresses.
• Nothing counts until somebody confirms it, so the total is what arrived, not what was promised.

BOOKS THAT ADD UP
• Import the society's bank statement — pasted or as a CSV, in the shapes Indian banks actually export — and match each line against a reported payment.
• Where the bank and the payer disagree on the amount, a person decides which figure the books keep, and the gap is written down.
• Lines that will never match are set aside with a reason, never deleted.
• Every change to a money record is in an audit trail nobody can edit, including us.

WHO SEES WHAT
Access is enforced in the database, not just in the app. Nothing crosses between societies. What you contributed is between you and the committee. Your ballot in a poll is yours alone; who voted in favour is public to the society, because a petition with fourteen named supporters is the point of one.

ABOUT PAYMENTS
Compences records payments; it does not process them. You pay from your own UPI app as you always have, then report the transaction ID and the amount that actually left your account. We never see your card number, your UPI PIN or your bank login.

Free to use. No advertising, no analytics, no selling anything to anybody.

Your data is stored in India. You can delete your account, and everything personal attached to it, from inside the app at any time — see compences.com/delete-account.
```

---

## App Store

### appstore.name — max 30

```text
Compences: Society Events
```

### appstore.subtitle — max 30

```text
Plan events. Show the money.
```

### appstore.promo — max 170

```text
Every society festival has a fund and a shoebox of bills. Compences gives it a checklist, a ledger every resident can read, and books that actually reconcile.
```

### appstore.keywords — max 100

```text
society,apartment,rwa,committee,event,festival,ganesh,diwali,fund,ledger,upi,expense,flat
```

### appstore.description — max 4000

```text
Compences is for the people who actually run a residential society's festivals — the ones with the spreadsheet, the WhatsApp group with 214 unread messages, and a shoebox of bills nobody wants to be responsible for.

It is built around the event, not the building. Ganesh Chaturthi, Sports Day, a Diwali cultural evening: each one gets its own checklist, its own fund, its own activities, and its own ledger that every resident can read.

PLAN IT TOGETHER

A step-by-step wizard sets up a new event: details, budget, what it needs, the cultural acts, the checklist, and what happens to a surplus — decided before a rupee is collected. The checklist carries owners and due dates, so how ready you are is a number rather than an argument. Residents sign up for activities and volunteer roles themselves, suggest ideas of their own, and vote on the ones the committee opens.

SEE WHERE THE MONEY WENT

Every confirmed contribution and every approved bill, across every event, on one screen any member can open. Money out names the vendor, the amount and whoever approved it, with the bill attached. Money in names who paid and their flat — the way a contribution list always has — and nothing else about them. Nothing counts until somebody confirms it, so what you are reading is what arrived, not what was promised.

BOOKS THAT ADD UP

Import the society's bank statement, pasted or as a CSV, in the shapes Indian banks actually export, and match each line against a reported payment. Where the bank and the payer disagree about the amount, a person decides which figure the books keep, and the gap is written into the record. Lines that will never match — bank charges, interest, transfers between the society's own accounts — are set aside with a reason rather than deleted. Every change to a money record is appended to an audit trail that nobody can edit, including us.

WHO SEES WHAT

Access is enforced in the database itself, not just in the app. Nothing crosses between societies. The amount you contributed is between you and the committee. Your ballot in a poll is yours alone, while who voted in favour is public to the society — a petition with fourteen named supporters is the whole point of one.

ABOUT PAYMENTS

Compences records payments; it does not process them. You pay from your own UPI app exactly as you do now, then report the transaction ID and the amount that actually left your account. We never see your card number, your UPI PIN or your bank login.

Free to use. No advertising, no analytics, and nothing sold to anybody. Your data is stored in India, and you can delete your account and everything personal attached to it from inside the app at any time.
```

---

## What still needs a person

These cannot be written into the repository, and no submission goes through
without them.

| Item                         | Both stores need                                                   | Notes                                                                                  |
| ---------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Screenshots                  | Phone, and 7"/10" tablet for Play; 6.7" and 6.5" for the App Store | `supportsTablet` is true on iOS, so iPad screenshots are required too — or turn it off |
| Feature graphic              | Play only, 1024×500                                                | —                                                                                      |
| App icon                     | Already in `assets/`, 512×512 for Play                             | —                                                                                      |
| Support URL                  | Both                                                               | A page or an email that is answered                                                    |
| Marketing URL                | Optional                                                           | `https://compences.com`                                                                |
| Category                     | Play: Lifestyle or House & Home. App Store: Lifestyle              | —                                                                                      |
| Content rating questionnaire | Play                                                               | Answer honestly: user-generated content, no ads                                        |
| Age rating                   | Both, 18+                                                          | The Terms require 18+                                                                  |
| Apple Team ID                | iOS universal links                                                | Needed for `apple-app-site-association`; see README                                    |
