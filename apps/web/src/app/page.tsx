import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArrowRight,
  CalendarDays,
  ClipboardList,
  MessageCircle,
  ReceiptIndianRupee,
  Vote,
  Wallet,
} from 'lucide-react';
import { todayIn } from '@compences/core';
import { ButtonLink } from '@/components/ui/button';
import { festivalVars } from '@/components/festival';
import { Motif } from '@/components/motif';
import { getCurrentUser } from '@/lib/auth';
import { season } from '@/lib/season';
import { cn } from '@/lib/utils';
import { DemoVideo } from './demo-video';
import { Sparkles } from './festive';
import { display } from './_landing/font';
import { FundToy } from './_landing/fund-toy';
import {
  FestivalPicker,
  FestivalTheme,
  ThemeToast,
  SeasonTrim,
  ThemedRangoli,
  type ThemeOption,
} from './_landing/theme';
import { Tour, type Chapter } from './_landing/tour';

const FEATURES = [
  {
    icon: CalendarDays,
    title: 'One place per event',
    body: 'Ganesh Chaturthi, Dussehra, Diwali, Christmas: each has its own activities, budget, fund and ledger.',
  },
  {
    icon: ClipboardList,
    title: 'A budget everyone can see',
    body: 'What the committee plans to spend, category by category, next to what was actually spent.',
  },
  {
    // This card used to promise that individual amounts stay private. They do
    // not, deliberately: a confirmed payment is on the society's ledger with the
    // payer's name and flat, as the noticeboard list always had it (see
    // 20260920000500_every_resident_can_see_the_ledger.sql).
    icon: Wallet,
    title: 'A fund with a target',
    body: 'Residents chip in and the bar fills. Each confirmed payment goes on a ledger every resident can see, with the payer’s name and flat.',
  },
  {
    icon: ReceiptIndianRupee,
    title: 'Every rupee, with the bill',
    body: 'Staff upload each bill, the committee approves it, and residents see the vendor, amount and invoice.',
  },
  {
    icon: Vote,
    title: 'Residents suggest and vote',
    body: 'Suggest an activity or idea; once the committee approves it, everyone votes.',
  },
  {
    icon: MessageCircle,
    title: 'Campaigns from residents',
    body: 'Anyone can propose a fundraising campaign. The committee approves it before collection starts.',
  },
];

/**
 * The tour's four chapters — the four the explainer video is cut into. Every
 * sentence here is held to what the app does, exceptions included: the one
 * hatch in "nobody signs off their own money" is a committee of one person
 * (app.sole_committee_member), and payments are confirmed by staff as well as
 * the committee (review_contribution).
 */
const CHAPTERS: Chapter[] = [
  {
    id: 'plan',
    label: 'Plan',
    title: 'Every festival gets a page of its own',
    points: [
      'Activities, a budget and a fund for each event, in its festival’s colours.',
      'Readiness you can see: which jobs are done, and which have nobody on them yet.',
      'Each volunteer role shows how many more people it needs.',
    ],
  },
  {
    id: 'collect',
    label: 'Collect',
    title: 'Two taps to pay, and someone else confirms it',
    points: [
      'Residents pay by UPI with the amount and note filled in. Staff record cash payments.',
      'Staff or the committee confirm each payment. Nobody confirms their own, unless the committee is one person.',
      'Then every resident can see it on the ledger: name, flat and how they paid.',
    ],
  },
  {
    id: 'spend',
    label: 'Spend',
    title: 'Every rupee out, with the bill beside it',
    points: [
      'Each bill is uploaded with the vendor and the amount, and approved by the committee.',
      'Whoever filed a bill can’t approve it, unless the committee is one person.',
      'Spending is tracked against the budget line by line, with any overspend in red.',
    ],
  },
  {
    id: 'prove',
    label: 'Prove',
    title: 'Match the bank, close the books',
    points: [
      'Paste in the bank statement and pair each line with its payment; likely matches are suggested. Anything unexplained is listed and totalled.',
      'When a festival closes, the committee decides where the leftover goes, and residents see who decided.',
      'The Money page shows where every rupee of the balance is, event by event.',
    ],
  },
];

/**
 * Both doors, named on the front page. Signing in is the step before either,
 * not a third choice: the intent rides through login in `next`, so someone who
 * clicked "Start a society" lands on the create form rather than back here.
 */
const withIntent = (mode: 'join' | 'create') =>
  `/login?next=${encodeURIComponent(`/onboarding?mode=${mode}`)}`;

/** Lamplight in the corner the kolam turns in, and a little of the ribbon opposite. */
const GLOW: CSSProperties = {
  backgroundImage: [
    'radial-gradient(ellipse 55% 60% at 92% 10%, color-mix(in oklch, var(--accent) 22%, transparent), transparent 70%)',
    'radial-gradient(ellipse 45% 55% at 0% 100%, color-mix(in oklch, var(--ribbon) 14%, transparent), transparent 70%)',
  ].join(', '),
};

/**
 * The grid of dots a kolam is drawn around, fading out before it reaches the
 * words so it never sits under anything that has to be read. Wide screens
 * only: on anything narrower the words are the whole width.
 */
const KOLAM_DOTS: CSSProperties = {
  backgroundImage:
    'radial-gradient(circle, color-mix(in oklch, var(--accent) 40%, transparent) 1.1px, transparent 1.7px)',
  backgroundSize: '24px 24px',
  maskImage: 'linear-gradient(to left, black 0%, transparent 55%)',
};

/** A section's small heading, in the festival's colour. */
function Kicker({ children }: { children: ReactNode }) {
  return <p className="text-accent text-sm font-semibold tracking-wide uppercase">{children}</p>;
}

/**
 * A section's heading, and the target of the header's links to it: the scroll
 * margin clears the sticky header and leaves the kicker above in view.
 */
function SectionTitle({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h2
      id={id}
      className="font-display text-ink mt-2 scroll-mt-28 text-3xl leading-[1.1] font-semibold tracking-tight text-balance sm:text-4xl"
    >
      {children}
    </h2>
  );
}

export default async function LandingPage(props: PageProps<'/'>) {
  // Signed-in visitors have no use for the pitch.
  const user = await getCurrentUser();
  if (user) redirect('/app');

  // Somebody who has just deleted their account arrives here, signed out, with
  // no other way of knowing it worked. The pitch is the wrong thing to greet
  // them with on its own.
  const { deleted } = await props.searchParams;

  // The page wears the colours of whichever festival is next, the way every
  // event in the app wears its own. See lib/season.ts. The festivals after it
  // can be tried on further down (_landing/theme.tsx).
  const { next, palette, upcoming } = season(todayIn(), 6);
  const options: ThemeOption[] = upcoming.map(({ id, name, when, palette: colours }) => ({
    id,
    name,
    when,
    palette: colours,
  }));
  const current: ThemeOption | null = next
    ? { id: next.id, name: next.name, when: next.when, palette: next.palette }
    : null;

  return (
    <div
      id="landing"
      style={festivalVars(palette)}
      className={cn(display.variable, 'min-h-dvh overflow-x-clip')}
    >
      <FestivalTheme season={current} options={options}>
        <div className="bg-[var(--festival-wash)]">
          <SeasonTrim id="garland-top" />
        </div>
        <header className="border-border-base/60 sticky top-0 z-30 border-b bg-[var(--festival-wash)]/85 backdrop-blur-md">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-2.5">
            <Link href="/" className="inline-flex items-center gap-2">
              <span className="from-accent to-ribbon text-accent-ink font-display grid size-9 place-items-center rounded-xl bg-linear-to-br text-lg font-bold shadow-sm">
                स
              </span>
              <span className="font-display text-xl font-semibold tracking-tight">Compences</span>
            </Link>
            <nav aria-label="On this page" className="hidden items-center gap-6 text-sm lg:flex">
              <a href="#try" className="text-ink-muted hover:text-ink">
                Try it
              </a>
              <a href="#how" className="text-ink-muted hover:text-ink">
                How it works
              </a>
              <a href="#festivals" className="text-ink-muted hover:text-ink">
                Festivals
              </a>
            </nav>
            <div className="flex items-center gap-2">
              <ButtonLink href="/login" variant="ghost" size="sm">
                Sign in
              </ButtonLink>
              <ButtonLink href={withIntent('join')} size="sm" className="hidden sm:inline-flex">
                Join your society
              </ButtonLink>
            </div>
          </div>
        </header>

        <main id="main">
          {/* ---------------------------------------------------------- hero */}
          <section className="relative isolate overflow-hidden bg-[var(--festival-wash)]">
            <div aria-hidden="true" className="absolute inset-0 -z-10" style={GLOW} />
            <div
              aria-hidden="true"
              className="absolute inset-0 -z-10 hidden lg:block"
              style={KOLAM_DOTS}
            />
            {/* On a phone the kolam only peeks in at the corner; from lg it
                turns behind the toy fund, clear of the words. */}
            <ThemedRangoli
              fallbackPetals={palette.petals}
              strokeWidth={0.6}
              className="motion-safe:animate-rangoli pointer-events-none absolute -top-36 -right-36 -z-10 size-72 opacity-30 lg:top-auto lg:right-[-10rem] lg:bottom-[-12rem] lg:size-[44rem] lg:opacity-35"
            />
            <Sparkles className="-z-10" />

            <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 pt-10 pb-20 sm:pt-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:pb-28">
              <div>
                {deleted ? (
                  <p
                    role="status"
                    className="border-border-base bg-surface-raised text-ink mb-8 rounded-xl border px-5 py-4 text-sm"
                  >
                    Your account has been deleted. Contributions and bills stay in your
                    society&rsquo;s ledger with your name removed, as our{' '}
                    <Link href="/privacy" className="text-accent underline underline-offset-4">
                      Privacy Policy
                    </Link>{' '}
                    describes.
                  </p>
                ) : null}

                {next ? (
                  <p className="landing-pop border-accent/25 bg-surface-raised/80 text-ink inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-2xl border px-3.5 py-1.5 text-sm shadow-sm backdrop-blur-sm sm:rounded-full">
                    <Motif
                      id={next.palette.motif}
                      compact
                      className="text-accent size-5 shrink-0"
                    />
                    <span className="font-medium">Getting ready for {next.name},</span>
                    <span className="text-ink-muted">{next.when}</span>
                  </p>
                ) : null}
                <p className="font-display text-accent mt-7 text-lg font-semibold">
                  समुदाय · community
                </p>
                <h1 className="font-display text-ink mt-2 text-5xl leading-[0.98] font-bold tracking-tight text-balance sm:text-6xl lg:text-7xl">
                  Plan together. Participate together.{' '}
                  <span className="landing-shimmer from-accent via-ribbon to-accent bg-linear-to-r bg-clip-text text-transparent">
                    Spend transparently.
                  </span>
                </h1>
                <p className="text-ink-muted mt-6 max-w-xl text-lg text-pretty">
                  Each event gets its own activities, budget, fund and a ledger every resident can
                  see. On the web and on your phone.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <ButtonLink
                    href={withIntent('join')}
                    size="lg"
                    className="shadow-accent/30 group shadow-lg"
                  >
                    Join your society
                    <ArrowRight
                      className="size-4 transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </ButtonLink>
                  <ButtonLink href={withIntent('create')} variant="secondary" size="lg">
                    Start a society
                  </ButtonLink>
                </div>
                <p className="text-ink-muted mt-4 max-w-md text-sm">
                  Residents join with the code their committee shares, and staff approve each one.
                  Starting a new society? No code needed.
                </p>
              </div>

              <div className="relative mx-auto w-full max-w-md lg:mx-0 lg:justify-self-end">
                <div
                  aria-hidden="true"
                  className="from-accent/25 to-ribbon/25 absolute -inset-4 -z-10 rotate-2 rounded-[2.2rem] bg-linear-to-br"
                />
                <FundToy />
              </div>
            </div>
          </section>

          {/* --------------------------------------------------------- video */}
          <section
            aria-labelledby="watch"
            className="relative mx-auto -mt-10 max-w-5xl px-6 pb-20 sm:-mt-14"
          >
            <div className="landing-reveal from-accent via-ribbon to-accent shadow-accent/20 rounded-[1.4rem] bg-linear-to-br p-[3px] shadow-xl">
              <figure className="bg-surface-raised overflow-hidden rounded-[1.25rem]">
                <div className="border-border-base flex flex-wrap items-baseline justify-between gap-2 border-b px-5 py-3">
                  <h2 id="watch" className="font-display text-ink text-lg font-semibold">
                    Watch one payment go all the way
                  </h2>
                  <span className="text-ink-subtle text-sm">
                    From two taps to the bank statement
                  </span>
                </div>
                <DemoVideo />
                <figcaption className="text-ink-muted border-border-base border-t px-5 py-3 text-sm">
                  Under two minutes, no sound needed. Drawn from the app&rsquo;s own screens; the
                  society, neighbours and amounts are invented.
                </figcaption>
              </figure>
            </div>
          </section>

          {/* ---------------------------------------------------------- tour */}
          <section aria-labelledby="how" className="mx-auto max-w-6xl px-6 pb-16 sm:pb-24">
            <div className="landing-reveal">
              <Kicker>How it works</Kicker>
              <SectionTitle id="how">From the first plan to the last rupee</SectionTitle>
              <p className="text-ink-muted mt-3 max-w-2xl text-lg text-pretty">
                The same four steps for every festival. Pick one to watch.
              </p>
            </div>
            <Tour chapters={CHAPTERS} />
          </section>

          {/* ----------------------------------------------------- festivals */}
          <section
            aria-labelledby="festivals"
            className="relative isolate overflow-hidden bg-[var(--festival-wash)] py-16 sm:py-20"
          >
            <ThemedRangoli
              fallbackPetals={palette.petals}
              strokeWidth={0.8}
              className="motion-safe:animate-rangoli pointer-events-none absolute -bottom-40 -left-40 -z-10 size-96 opacity-20"
            />
            <div className="mx-auto max-w-6xl px-6">
              <div className="landing-reveal">
                <Kicker>Dressed for the occasion</Kicker>
                <SectionTitle id="festivals">Every festival, in its own colours</SectionTitle>
                <p className="text-ink-muted mt-3 max-w-2xl text-pretty">
                  Start an event and pick from the festivals coming up. Compences fills in the name
                  and a date, and the event takes that festival&rsquo;s colours. If the date moves
                  each year, it reminds you to check before you publish.
                </p>
                <p className="text-ink mt-3 font-medium">Tap one to try it on this page.</p>
              </div>
              <FestivalPicker />
            </div>
          </section>

          {/* ------------------------------------------------------ features */}
          <section aria-labelledby="everything" className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
            <div className="landing-reveal">
              <Kicker>All of it, in one place</Kicker>
              <SectionTitle id="everything">What a festival committee juggles</SectionTitle>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <div
                  key={title}
                  className="landing-reveal group border-border-base bg-surface-raised relative flex gap-4 overflow-hidden rounded-2xl border p-5 transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-xl motion-reduce:hover:translate-y-0 sm:block sm:p-6"
                >
                  <span
                    aria-hidden="true"
                    className="from-accent to-ribbon absolute inset-x-0 top-0 h-1 origin-left scale-x-0 bg-linear-to-r transition-transform duration-500 group-hover:scale-x-100"
                  />
                  <span className="from-accent to-ribbon text-accent-ink grid size-11 shrink-0 place-items-center rounded-xl bg-linear-to-br shadow-sm transition-transform duration-300 group-hover:-rotate-6">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-display text-ink text-lg leading-snug font-semibold tracking-tight sm:mt-4">
                      {title}
                    </h3>
                    <p className="text-ink-muted mt-1 text-sm sm:mt-1.5">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ----------------------------------------------------------- end */}
          <section aria-labelledby="start" className="mx-auto max-w-6xl px-6 pb-16 sm:pb-24">
            <div className="landing-reveal from-accent to-ribbon text-accent-ink relative isolate overflow-hidden rounded-[2rem] bg-linear-to-br px-6 py-14 text-center shadow-2xl sm:px-12">
              <ThemedRangoli
                fallbackPetals={palette.petals}
                mono
                strokeWidth={0.7}
                className="motion-safe:animate-rangoli pointer-events-none absolute -top-24 -right-24 -z-10 size-80 opacity-25"
              />
              <ThemedRangoli
                fallbackPetals={palette.petals}
                mono
                strokeWidth={0.7}
                className="motion-safe:animate-rangoli pointer-events-none absolute -bottom-28 -left-20 -z-10 size-72 opacity-20"
              />
              <h2
                id="start"
                className="font-display mx-auto max-w-2xl text-4xl leading-[1.05] font-bold tracking-tight text-balance sm:text-5xl"
              >
                Your society&rsquo;s next festival, fully accounted for.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-lg opacity-90">
                Bring your neighbours in with a code, or set your society up in a few minutes.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link
                  href={withIntent('join')}
                  className="bg-surface-raised text-ink inline-flex h-12 items-center gap-2 rounded-lg px-6 font-semibold shadow-lg transition-transform hover:-translate-y-0.5"
                >
                  Join your society
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
                <Link
                  href={withIntent('create')}
                  className="border-accent-ink/40 inline-flex h-12 items-center rounded-lg border-2 px-6 font-semibold transition-colors hover:bg-black/10"
                >
                  Start a society
                </Link>
              </div>
            </div>
          </section>
        </main>

        <footer className="bg-[var(--festival-wash)]">
          <SeasonTrim id="garland-foot" />
          <div className="text-ink-muted mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 pt-6 pb-10 text-sm">
            <span className="font-display text-ink font-semibold">Compences</span>
            <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2">
              <Link href="/privacy" className="underline underline-offset-4">
                Privacy Policy
              </Link>
              <Link href="/terms" className="underline underline-offset-4">
                Terms &amp; Conditions
              </Link>
              <Link href="/login" className="underline underline-offset-4">
                Sign in
              </Link>
            </nav>
          </div>
        </footer>
        <ThemeToast />
      </FestivalTheme>
    </div>
  );
}
