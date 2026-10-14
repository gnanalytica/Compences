# Compences

**समुदाय** — _plan together, participate together, spend transparently._

A platform for the events a residential community runs: Ganesh Chaturthi, a
sports day, a cultural evening. Each one carries its own people, activities,
checklist, fund and public ledger.

One codebase, four surfaces:

| Surface       | What it is                                                        |
| ------------- | ----------------------------------------------------------------- |
| **Web**       | Next.js 16 app — resident portal and admin console                |
| **Mobile**    | Expo / React Native — iOS and Android from the same source        |
| **WhatsApp**  | A bot for the fund, notices, activities and your own tasks        |
| **API & MCP** | REST for integrations, MCP so an AI assistant can use it as tools |

Nobody joins by guessing a URL. An admin shares the **Society ID**; a resident
signs in with Google, picks their flat, and the admin approves them. For people
the committee already knows, an **invite code** skips the waiting step.

---

## How it is put together

```
apps/
  web/        Next.js 16 (App Router) — UI, REST API, MCP server, WhatsApp webhook
  mobile/     Expo SDK 57 + expo-router — iOS, Android
packages/
  core/       Domain rules: roles, event maths, zod schemas, WhatsApp parsing
  supabase/   Typed Supabase clients + generated database types
  config/     Shared TypeScript config
supabase/
  migrations/ Schema, RLS policies and RPCs
  tests/      A Supabase shim + the RLS test suite
scripts/      db-test.sh, smoke-test.sh, gen-db-types.mjs, seed.ts
```

### The shape of it

```
Event
├── Checklist        tasks with owner and due date → drives "Readiness %"
├── Fund             target, contributions, contributor count
├── Activities       cultural acts residents sign up to perform in
├── Volunteer roles  jobs residents sign up to do
├── Expenses         vendor, amount, attached bill, approval trail
└── Closure          surplus rule → published transparency report
```

### Where the rules actually live

**In PostgreSQL.** Every table has row-level security; the web app, the mobile
app, the API and the bot all go through it. The TypeScript in
`packages/core/src/roles.ts` decides what to _show_ a user — it is not what
stops them. That separation is tested rather than asserted: `supabase/tests`
proves that

- a resident sees every **approved** rupee of spending, with the vendor and the
  bill, and does not see an expense still under review;
- a resident's own contribution amount is private while the society total and
  contributor count are public;
- nobody approves an expense they filed themselves;
- a closed event's ledger cannot be reopened or edited;
- moving money between funds needs a resident vote that clears a threshold, and
  writes an audit row in the same transaction as the deciding vote;
- one member, one vote — and a ballot is readable only by the person who cast it;
- nothing leaks between societies.

Two places bypass RLS on purpose, both server-side only:

- **API-key requests** — there is no Supabase user behind an AI agent's key, so
  the service role is used and every query is scoped by hand. All of those
  queries live in one file, `apps/web/src/lib/api/resources.ts`, so the scoping
  cannot be forgotten piecemeal.
- **The WhatsApp webhook** — a phone number is not a session. `lib/whatsapp/bot.ts`
  resolves the sender to one society first and scopes everything to it.

---

## Getting it running

### 1. Create a Supabase project

Anywhere you like — [supabase.com](https://supabase.com) or a local stack.
You need the project URL, the anon key and the service-role key.

### 2. Apply the schema

```bash
pnpm dlx supabase link --project-ref <your-ref>
pnpm db:push          # applies supabase/migrations in order
pnpm db:status        # SUPABASE_DB_URL=… — names any migration the database is missing
```

Deploys and migrations travel separately: the web app ships when `main` moves,
the schema waits for `db:push`. The **Migrations** workflow runs `db:status`
against production on every push to `main` and once a day, so a migration left
behind turns a check red instead of turning a feature into "Something went
wrong". It needs a `SUPABASE_DB_URL` repository secret, and fails rather than
skips without one.

Use the **Session pooler** string for that secret — Supabase dashboard →
**Connect** → **Session pooler**:

```
postgresql://postgres.<ref>:<password>@aws-<n>-<region>.pooler.supabase.com:5432/postgres
```

Not the direct `db.<ref>.supabase.co` one. It resolves to IPv6 only, and GitHub
Actions runners are IPv4, so the job would fail on the network rather than on
the schema.

### 3. Turn on Google sign-in

In the Supabase dashboard → **Authentication → Providers → Google**, add your
Google OAuth client ID and secret. In the Google Cloud console, add this
redirect URI:

```
https://<your-project-ref>.supabase.co/auth/v1/callback
```

Then under **Authentication → URL Configuration**, add your site URL and
`http://localhost:3000/**` to the redirect allow-list. Email magic links work
with no extra setup, as a fallback for residents without a Google account.

### 4. Configure and run

```bash
cp .env.example apps/web/.env.local     # fill in the Supabase values
cp .env.example apps/mobile/.env        # the EXPO_PUBLIC_ ones
pnpm install
pnpm dev
```

The web app is on `http://localhost:3000`; `pnpm --filter @compences/mobile start`
opens the Expo dev server.

### 5. First run

1. Sign in. With no society yet you are asked which you are: someone with a
   **Society code**, or the committee member **setting the society up**. Choose
   the second, give it a name, a city and your phone number, and you become its
   first committee member.
2. **Admin → Flats**: paste your flat list (`A,101` one per line).
3. Share the **Society ID** from the admin console; residents ask to join and
   you approve them under **People → Requests**.
4. **Create event** walks through four steps — the event, budget, activities,
   review — and leaves you a draft to publish when you are ready.

A society is created by `public.create_society()`, never by a plain insert:
`public.communities` has no INSERT policy, so the function is the only door and
it decides the web address, the Society ID and who the founder is. One account
may open three societies; the platform team sets up anything beyond that with
`pnpm society:create`, which also takes the flats, a chosen Society ID and more
than one committee member up front.

Everyone who registers gives a phone number — the founder when they open the
society, every resident when they ask to join — and it lands on their profile,
which is what staff and the committee read in the people directory. Residents
never see it.

`pnpm db:seed` fills a development project with a society mid-flight: a
part-raised fund, a part-done checklist, approved spending with bills, and one
expense waiting for you to approve.

---

## WhatsApp

Uses the [Meta WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api).
Set `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`
and `WHATSAPP_VERIFY_TOKEN`, then point the webhook at:

```
https://<your-host>/api/webhooks/whatsapp
```

All four variables are required — with any of them missing the webhook returns
503 rather than accepting requests it cannot verify. Every delivery's
`X-Hub-Signature-256` is checked against the raw body before anything is read,
and `whatsapp_messages.wa_message_id` is unique so Meta's retries cannot
double-process a message.

A resident links their number from **Settings → WhatsApp**: the app shows a
code, they send `link ABC123` to the bot. After that:

```
events           what's coming up
fund             how much is raised and spent
contribute 2000  a link to chip in
notices          latest announcements
activities       what you can perform in
volunteer        where help is needed
tasks            what's assigned to you
suggest <idea>   send it to the committee
stop             opt out
```

---

## Letting an AI assistant use it

Compences speaks the **Model Context Protocol**. Create a key under
**Admin → API & AI access**, pick its scopes, then:

```json
{
  "mcpServers": {
    "compences": {
      "type": "http",
      "url": "https://<your-host>/api/mcp",
      "headers": { "Authorization": "Bearer sam_live_…" }
    }
  }
}
```

`tools/list` is filtered by the key's scopes, so a read-only key never sees
`post_announcement` at all. The full key is shown once and never stored — only
a SHA-256 digest is kept, in a table with RLS enabled and no policies, which no
client role can read.

The same keys work against the REST API:

```bash
curl https://<your-host>/api/v1/events?status=published \
  -H "Authorization: Bearer sam_live_…"
```

See [`docs/api.md`](docs/api.md) for the endpoints and scopes.

---

## Mobile builds

```bash
cd apps/mobile
pnpm dlx eas-cli build --platform ios      # or android
```

Set `extra.eas.projectId` in `app.json` to your own EAS project first. The
bundle identifier and package name are `com.compences.app`; change them to
something you own before submitting to either store.

---

## Checks

```bash
pnpm db:test      # applies every migration to a throwaway Postgres, runs the RLS suite
pnpm db:status    # checks a real database has every migration (needs SUPABASE_DB_URL)
pnpm test         # unit tests across the workspace
pnpm typecheck
pnpm lint
pnpm build
pnpm smoke        # boots the built app and probes the public surface
```

`db:test` needs a local PostgreSQL 16 (`postgresql-16` + `postgresql-contrib-16`)
but no Docker: `supabase/tests/00_harness.sql` stands in for the parts of
Supabase the migrations depend on.

After a schema change, regenerate the types:

```bash
pnpm db:test                                   # rebuilds the test database
node scripts/gen-db-types.mjs "postgresql://postgres@127.0.0.1:55432/compences_test"
```

---

## What is deliberately not done yet

- **Payments** are recorded, not collected. There is no gateway integration —
  `contributions.gateway_payload` is there for when you add one, and the flow
  already writes a receipt number the contributor can quote.
- **Push notifications** register a device token but nothing sends to it yet;
  the sending side wants a scheduled job or an edge function.
- **Bill uploads** store a path on the expense, but the Supabase Storage bucket
  and the upload widget are not wired up — today an admin pastes the path.
- **Closing an event** publishes the report and freezes the ledger, but there is
  no PDF export yet.
