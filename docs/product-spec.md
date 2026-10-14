# Compences — product specification

Derived from the clickable HTML prototype. **The prototype is the source of
truth for behaviour**; this document is the working translation of it into a
domain model, and should be updated alongside it.

> "Plan together. Participate together. Spend transparently."
>
> Every event has its own people, activities, tasks, fund and transparent ledger.

---

## The central idea

This is **not** a facilities-management app. The organising unit is the
**event** — Ganesh Chaturthi, Sports Day, a Cultural Evening. Everything else
hangs off one:

```
Event
├── Checklist        tasks with owner, due date, status → drives "Readiness %"
├── Fund             target, contributions, contributors
├── Activities       cultural acts residents sign up to perform in
├── Volunteer roles  jobs residents sign up to do
├── Expenses         vendor, amount, attached bill, approval trail
└── Closure          surplus rule → published transparency report
```

A resident can see, at any moment: how ready the event is, how much has been
collected, exactly what has been spent and on what, with the bill attached.
That transparency is the product.

---

## Roles

| Role          | Can                                                                                             |
| ------------- | ----------------------------------------------------------------------------------------------- |
| **Resident**  | Contribute, join activities, volunteer, suggest activities, vote in polls, read the full ledger |
| **Committee** | Coordinate activities and volunteer roles, work the checklist                                   |
| **Admin**     | Create and publish events, approve expenses, approve join requests, close events                |
| **Owner**     | Everything, plus transferring ownership                                                         |

---

## Flows

### Resident onboarding

1. Enter the **Society ID** the admin shared (`MHR-4827`).
2. Pick **tower → flat**, give name and mobile.
3. Request goes to the admin as a **join request**.
4. Admin approves → resident is in.

Invite codes remain as a second path: a code that is already approved, so the
resident skips the waiting step. The committee mints one against a flat on the
admin invites page and shares `/invite/CODE`; the resident sees which society,
which role and which flat it is for, and redeeming seats them straight away —
in that flat, as primary occupant if it had none. One use by default, and
re-entering a code you have already used returns your seat rather than a second
membership.

Both paths sign you in first. A code names a seat; there is nobody to seat
until there is an account.

### Admin onboarding

1. Community name, flat count, tower count, city.
2. Add flats — manually or by spreadsheet import (preview before confirm).
3. Society ID is generated and shown.
4. Invite residents by WhatsApp / SMS / link / QR.

### Creating an event (7-step wizard)

1. **Details** — name, date, venue, description, expected attendance
2. **Budget** — line items; the total becomes the fund target
3. **Requirements** — toggles (religious, decoration, food, sound, cultural, volunteers, photography, kids) that seed the checklist
4. **Cultural activities** — the acts residents can join
5. **Checklist** — auto-generated from requirements, editable
6. **Fund rule** — what happens to a surplus, decided _before_ money is collected
7. **Preview** — exactly what residents will see, then publish

### Contributing

An event carries the figure its committee asks each flat for, set beside the
budget it came from. The contribute screen offers that figure first and has it
already chosen — societies decide an amount ("₹2,100 per flat this year") rather
than a ladder, and the ladder only stands in when nobody has named one. Twice
the figure is the other chip, for a household paying for two flats. Anything
else is typed.

Pick an amount → pay it from a UPI app → report it back with **the amount that
actually left the account**. The amount is pre-filled and stays editable,
because a UPI app lets you change the figure on the way through and people do;
what the payer types is what gets stored.

The 12-digit UPI reference is no longer the price of reporting. On Android it
never was — the UPI app is opened for a result and hands it back, so the report
files itself. Everywhere else, finding it means leaving the app, opening GPay
or PhonePe, and digging three taps down; residents who give up at that step have
still paid, and the money arrives with nothing pointing at who sent it.

So a screenshot is enough, and the society's UPI ID can be copied with one tap
for anyone whose phone does not open a UPI app from a link. One of the two is
still required, never neither: a report with no reference and no picture is a
claim with nothing behind it.

There is no QR code on that screen any more. Most residents read it on the phone
they are about to pay from, where there is nothing to scan it with, and it sat
above the two things they do carry into their UPI app — the ID and the note —
leaving those as small print underneath. The ID and the note are the pay step
now, each with its own copy button; the link that opens a UPI app with the
amount already filled in stays.

The reference is not abandoned, because reconciliation runs on it — matching on
the UTR is near-certain, and the fallback of amount-within-a-fortnight is no
help when sixty flats each pay ₹2,100 in the same week. It is simply captured
later: the screenshot contains it, and whoever confirms the payment has the bank
statement open anyway, so they record it then.

Nothing counts until somebody confirms it. A reported payment sits at `pending`
and is **not** in the fund total; staff confirm it against the statement (by
hand, or by pairing it with a bank line on the Reconcile screen) and the row
records who confirmed it and when.

The evidence outlives the decision. The screenshot is on the payments page for
every flat, confirmed or not, beside the amount and the transaction ID — the
statement arrives long after the confirming tap, and the page that exists to be
checked against it should still have the picture on it.

It is not invisible, though, and that is a deliberate correction. A resident who
has just paid was looking at the fund bar when they decided to, and a bar that
does not move is the app telling them nothing happened. So `event_stats` reports
money on its way as its own number, and the bar draws it as its own fainter
segment behind the confirmed one. Two numbers side by side, never added
together: the headline total stays confirmed money, because a ledger of claims
is what this replaces.

### Reconciliation

The society's account, as rows. A statement is imported — pasted or as a CSV,
from any of the shapes Indian banks export — and each line is matched against a
reported payment: by UTR, then by the flat the line names, then by amount within
a fortnight. Confirming the match confirms the money.

Every payment Compences starts carries a note — `SMDA1104 GANESH` — and that note
rides to the statement, so a credit usually says which flat sent it. One
contiguous token, first, because a narration preserves a run of letters and
digits, mangles punctuation, and truncates from the right.

That is what makes the next sentence reachable. Where the bank and the payer
disagree on the amount, a person chooses which figure the books keep and the gap
is written into the record — but a pairing that far apart was never offered
until the line could say whose money it was. A flat match is offered whatever
the amounts say, because the reported figure is the payer's own and is the thing
most likely to be wrong.

Lines that will never match (bank charges, interest, transfers between the
society's own accounts) are set aside with a reason rather than deleted. What is
left is the honest residue: money that arrived and nobody can explain, and money
somebody claims to have sent that never landed.

An automatic bank feed needs an RBI-licensed account aggregator in the middle.
The import and a feed post through the same function, so connecting one changes
nothing on the screen.

Staff reconcile on the web or on the phone, through the same functions and the
same statement reader. The phone fetches a line's candidate matches when the
line is opened rather than all of them up front — forty round trips is a
server's luxury, not a phone's — so an unopened line neither offers a match nor
claims there is none.

### Expenses

A committee member submits an expense with a bill. An admin approves, rejects,
or requests changes. **Only approved expenses appear in the resident ledger**,
and every one shows its vendor, amount, requester, approver and bill.

**A revised bill is a new bill.** Changing the amount, the attached copy or any
of the details a committee member reads before approving withdraws the approval
and sends it back — enforced by a trigger rather than asked of the client,
because a committee member outranks the update policy on every bill in their
society and PostgREST takes an update straight from the app. The row records who
revised it, and that person is the one who may not approve it. The copy
residents already saw is kept rather than deleted: a revision should be
answerable to the version it replaces.

### Nobody signs off their own money

The person who puts money into the ledger is not the person who says it is true.
It holds for a bill (you cannot approve one you uploaded or revised) and, since
0921.0200, for a payment: reporting your own contribution and confirming it in
the next tap moved the fund bar on nobody's word but yours.

There is one escape hatch, and only one: **a society with exactly one active
committee member.** A rule nobody can satisfy is not a control, it is a dead end
with a moral — the founder of a small society would have bills that can never be
approved and money that can never be counted. The audit log records who did it
either way, which is the part that survives.

### Correcting what a payment was for

A resident reports ₹1,000 and ₹10 arrives — a typo, or a screenshot from the
wrong payment. The only answer used to be turning the whole payment down and
asking them to report it again, which is a bad trade for one digit.

So the committee can write down what the bank actually shows, at the moment they
confirm it. `amount` becomes the corrected figure and `reported_amount` keeps
what the resident typed, which means every total — the fund bar, the ledger, the
resident's own history — follows the correction without knowing one happened.
That is right for the arithmetic and wrong for the person, so the row says
"corrected from ₹1,000" wherever it is shown, and the resident is notified in
both figures. Staff confirm payments but cannot rewrite them: a correction is a
ledger change, and those are the committee's.

### The society ledger

`society_ledger` is every confirmed contribution and every approved bill, across
every event, on one screen any member can read — Money on the web, Money on the
phone, reached from Me. Both read the same two views and narrow them with the
same filters from `@compences/core`, so the two cannot drift into disagreeing
about what "money in" means.

Money the committee moves is in it too, as two rows per movement (`kind =
'transfer'`): one on the side it left — a closed event, or the society balance
— and one on the side it arrived. So one event's rows add up to what it holds,
and the society balance has a ledger of its own. Society-wide the two rows
cancel, so the list and `society_money`'s totals leave them out: carrying money
to the next event is not money collected, and keeping it is not money spent.

- **Money out** names the vendor, the amount, the approver and the bill.
- **Money in** names the payer and their flat, and nothing else about them — no
  phone, no email. Who gave how much is what a contribution list has always
  said; a way to reach them is not, and that stays behind `society_people()`.
- **Unconfirmed payments are not in it**, because a ledger of claims is what it
  replaces.

It is a definer view, so the column list is the whole of the protection: it
selects `full_name` and the flat and stops, and a test pins that list so
widening it has to be deliberate.

`member_history()` gives a member their own record — payments, activities,
suggestions — and the committee anyone's, because "has A-204 paid?" is asked at
every meeting. Staff cannot: they run the events, not the households.

### The audit trail

Every money and decision row carries `updated_by` beside its `updated_at`, and
every insert, update and delete on contributions, expenses, suggestions, events,
memberships and bank lines is appended to `audit_log` with the fields that moved,
their before and after, and who moved them. Nothing but the trigger can write to
it and nobody can edit or delete a row: an audit log a committee member can
quietly correct is not an audit log.

It is readable by staff, because it holds every field of every change including
a neighbour's contribution. What a resident is owed is on the record itself —
who approved this bill, when, and whether anybody has touched it since — and that
is shown next to the record, on the web and on the phone.

One rule decides what that line says, and both apps read it from
`@compences/core`: **an edit is only mentioned when it happened after the
approval.** Every row has been modified at the moment it was made, and a column
that says so on every line is one people stop reading — taking the edit that
mattered with it.

### Leaving

A member can delete their account from inside either app, and from a public web
page for anybody who has already uninstalled — both stores require all three.
What goes is everything personal: the profile, every membership, the flat, join
requests, votes, sign-ups, notifications, the WhatsApp link and the push token.
What stays is the money: contributions and bills remain in the society's ledger
with the link to the person removed, because a total that changes when somebody
leaves is not a record.

One case is refused, and says which society: the last committee member of a
society that still has other members. Nobody would be left who could approve a
bill or admit a resident, and appointing a committee member is itself a
committee act, so nobody left could fix it either. A society whose _only_
member leaves is deleted with them — an empty society cannot be read or joined
by anyone ever again.

### Voting

A resident suggests, the committee opens it for voting, everybody has their say,
the committee closes it and the count decides. **A vote in favour is public to
the society** — fourteen named supporters is a petition, and people who sign one
generally want their name on it. **A vote against is visible to the committee
only.** Who has not voted is visible to nobody, because an abstention leaves no
row. Totals always come from `suggestion_stats`, which counts every ballot
without handing over any of them.

### Where the leftover goes

A **closed** event's surplus is the committee's to decide, without a vote.

That deserves naming rather than glossing, because the money is residents' and
an earlier design said the opposite. `fund_reallocations` — propose, vote,
clear a 60% threshold, write an audit row — was built in 0870 and never
reachable: nothing in either app ever created a proposal, and the card that
would have collected the votes was written, exported and never rendered.
0921.0400 removed it rather than leave the schema making a promise the product
could not keep.

What keeps the committee's decision honest instead is that it is a row — who
decided, when, how much, and where it went — readable by every member on the
same screen as the balance it produced, and unchangeable afterwards by anybody
including the person who made it. There is no update or delete policy on
`fund_movements`; the two RPCs are the only way in.

An event budgets ₹50,000, collects ₹30,000 and spends ₹20,000. Three answers:

| Answer              | What happens                                                               |
| ------------------- | -------------------------------------------------------------------------- |
| **Next event**      | It shows on that event's bar as money already received                     |
| **Next edition**    | The same, for next year's run; the draft event is created if it is missing |
| **Society balance** | It sits with the society, on everybody's home screen, until it is used     |

The amount is never typed. `allocate_surplus()` takes the whole of what is left,
because the figure is what the ledger says and a box to type it in is an
invitation to a typo in the one number nobody is checking.

Money moved across is its own number on an event — `fund_carried_in`, and
`fund_moved_out` for what a closed event handed on (`fund_carried` is the two
netted) — and is **never** folded into `fund_raised`: "sixty flats contributed
₹30,000" and "the committee moved ₹10,000 across from last year" are different
sentences and only one of them is a contribution. Money carried in counts in
what the event collected, and what the event still asks residents for comes
down by the same amount. What it handed on is the spent bar's second segment
and a Moved on figure of its own, so a closed event's card ends where its money
did.

The society balance has a way back out (`spend_society_balance()`), because the
third answer would otherwise be a one-way door: a society that always kept its
surplus would accumulate a number it could look at and never use.

### Closing an event

Shows collected / spent / remaining, task completion, bills uploaded, and the
surplus destination fixed at creation. Publishing closes the event and issues
the **transparency report**: full breakdown, every bill, audit history and
participation figures. If money is left, the committee is asked where it goes —
after closing rather than inside it, so the decision is not something somebody
clicks past on the way to the confirmation box.

---

## Screens

**Resident** — splash · join society · select flat · request sent · home ·
events list · event detail · contribute (amount → payment → report) ·
**money (every transaction the society has ever made)** · activities list ·
activity detail · activity joined · suggest activity · volunteer list ·
volunteer confirm · accounts · view bill · community feed · polls ·
notifications · my activity

**Admin** — welcome · add flats · import preview · community created · invite
residents · dashboard · create-event wizard · event management (overview,
tasks, expenses, approvals, reports) · add expense · expense approval ·
**reconcile (import a statement, pair each line)** · event closure · final report

---

## Derived values

| Value             | Definition                    |
| ----------------- | ----------------------------- |
| Readiness %       | completed tasks ÷ total tasks |
| Fund raised       | Σ **confirmed** contributions |
| Spent             | Σ **approved** expenses       |
| Available         | raised − spent                |
| Volunteers needed | role target − signed up       |
| Unexplained lines | bank lines matched to nothing |

These are computed from the underlying rows, never stored and hand-updated.

---

## Deliberately out of scope

The prototype covers none of these, and they are **not** part of the product:
maintenance dues and recurring invoices, visitor/gate passes, amenity booking,
service requests and complaints. An earlier build of this repository included
them; they were removed when this specification arrived.
