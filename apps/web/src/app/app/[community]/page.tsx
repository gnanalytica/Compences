import type { CSSProperties } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  CalendarDays,
  ClipboardCheck,
  Lightbulb,
  Megaphone,
  PiggyBank,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react';
import {
  COPY,
  ROLE_LABEL,
  can,
  countdown,
  festivalFor,
  formatDate,
  formatMoney,
  fundBarSegments,
  fundKey,
  headingTowards,
  inTheFund,
  normalizeRole,
  todayIn,
  type Festival,
} from '@compences/core';
import { requireCommunity } from '@/lib/auth';
import { getTodoItems } from '@/lib/todo';
import { getSocietyBalance, getIdeas, getSeason, getStatsFor } from '@/lib/events';
import { bottomNavItems } from '@/components/nav-items';
import {
  FestivalTile,
  HERO_MOTIF,
  HERO_TEXT,
  festivalVars,
  heroBackground,
} from '@/components/festival';
import { Motif } from '@/components/motif';
import { RollingAmount } from '@/components/rolling-amount';
import { SectionLabel } from '@/components/section-label';
import { WhatsappGroupLink } from '@/components/whatsapp-group-link';
import { PageBody } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { FundBar, FundKey, StatTile, StatTiles } from '@/components/badges';
import { WelcomeCard } from '@/components/welcome-card';
import { LinkRow } from '@/components/link-row';
import { cn } from '@/lib/utils';

/** Morning, afternoon or evening where the society is, not where the server is. */
function greeting(timezone: string) {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: timezone })
      .formatToParts(new Date())
      .find((part) => part.type === 'hour')?.value ?? 12,
  );
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
}

/** "Ganesh Chaturthi is in 12 days." — or on a date, or was, as the calendar has it. */
function whenLine(name: string, startsOn: string) {
  const when = countdown(startsOn);
  if (!when) return `${name} is on ${formatDate(startsOn)}.`;
  if (when === 'yesterday' || when.endsWith('ago')) return `${name} was ${when}.`;
  return `${name} is ${when}.`;
}

/** What kind of day the card's small capitals announce. */
function kindOf(festival: Festival, isCampaign: boolean) {
  if (isCampaign) return 'Fundraising campaign';
  if (festival.kind === 'festival') return 'Festival';
  if (festival.kind === 'national') return 'National day';
  if (festival.kind === 'occasion') return festival.label;
  return 'Event';
}

export default async function DashboardPage(props: PageProps<'/app/[community]'>) {
  const { community: slug } = await props.params;
  const { joined } = await props.searchParams;
  // Committee in resident view sees exactly what residents see.
  const { community, viewRole: role, profile, membership } = await requireCommunity(slug);
  const base = `/app/${community.slug}`;

  // The phone's bottom bar has four slots and the society has more than four
  // places. Rather than hard-code what it left out — which is how two lists
  // drift until one of them strands a page — subtract the bar from the list.
  // A resident's bar carries Money, so they see People here; staff trade Money
  // for Manage, so they see both.
  const onTheBar = new Set(bottomNavItems(community.slug, role).map((item) => item.href));
  const alsoHere = [
    {
      href: `${base}/people`,
      label: 'People',
      detail: 'Everyone in the society, by flat',
      icon: Users,
    },
    {
      href: `${base}/money`,
      label: 'Money',
      detail: 'Every rupee in and out',
      icon: Wallet,
    },
  ].filter((item) => !onTheBar.has(item.href));

  const today = todayIn(community.timezone);
  // What the society is heading towards, and the look it wears — the same
  // answer the app's shell took its colour from.
  const { next, published, festival: nextFestival } = await getSeason(community.id, today);
  const campaigns = published.filter((event) => event.kind === 'campaign' && event.id !== next?.id);

  const stats = await getStatsFor(
    [next?.id, ...campaigns.map((c) => c.id)].filter(Boolean) as string[],
  );
  const s = next ? stats.get(next.id) : undefined;
  const bar = fundBarSegments(
    s?.fundRaised ?? 0,
    s?.fundPending ?? 0,
    s?.fundTarget ?? 0,
    s?.fundCarriedIn ?? 0,
  );
  const funded = bar.confirmed;
  const firstName = profile?.full_name?.split(' ')[0];

  const staff = can(role, 'events:manage');
  const todo = await getTodoItems(community.id, role);
  const balance = await getSocietyBalance(community.id);
  // What the fund holds, carried money included: the card's headline, and the
  // bar's solid part. Where carried money came from is a row on the event.
  const held = inTheFund(s?.fundRaised ?? 0, s?.fundCarriedIn ?? 0);
  // Every idea in the society, an event's as much as its own: a vote you have
  // not cast is a vote you have not cast, and this used to count only half of
  // them because the other half lived on their event's page.
  const ideas = await getIdeas(community.id, membership.id);
  const societyIdeas = ideas.filter((row) => row.status === 'accepted').length;
  // Voting is the best thing in the app and it was four taps down. This is what
  // is waiting on you — a vote you have not cast — rather than what exists.
  const needsMySay = ideas.filter((row) => row.status === 'accepted' && row.myVote === null).length;
  const roleName = normalizeRole(role);
  const heading = next ? headingTowards(nextFestival, next.name) : null;

  return (
    <>
      {/* A greeting, not a banner: the colour is saved for what the society
          is heading towards, a few lines down. */}
      <div className="px-4 pt-6 md:px-6 md:pt-8">
        <p className="text-gold text-[11px] font-semibold tracking-[0.14em] uppercase">
          {community.name}
          {roleName ? ` · ${ROLE_LABEL[roleName]}` : ''}
        </p>
        <h1 className="text-ink mt-1.5 font-serif text-[28px] leading-tight font-medium tracking-tight md:text-3xl">
          {firstName
            ? `${greeting(community.timezone)}, ${firstName}`
            : greeting(community.timezone)}
        </h1>
        {next && heading ? (
          <p className="text-ink-muted mt-1 text-sm">{whenLine(heading, next.starts_on)}</p>
        ) : null}
      </div>

      <PageBody>
        {!membership.welcomed_at ? (
          <WelcomeCard
            slug={community.slug}
            role={role}
            societyName={community.name}
            joinCode={community.join_code}
          />
        ) : null}

        {joined && membership.welcomed_at ? (
          <div className="border-border-base shadow-card mb-5 flex items-start gap-3 rounded-2xl border bg-[var(--festival-wash)] p-4">
            <Sparkles className="text-accent mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <p className="text-ink text-sm font-medium">You’ve joined {community.name}.</p>
          </div>
        ) : null}

        {todo.length || (needsMySay && can(role, 'vote')) ? (
          <div className="mb-2 space-y-2.5">
            {todo.length ? (
              <LinkRow
                href={`${base}/todo`}
                tone="warning"
                icon={<ClipboardCheck className="size-5" aria-hidden="true" />}
                title={`${COPY.todo}: ${todo.length} ${todo.length === 1 ? 'thing needs' : 'things need'} you`}
              />
            ) : null}
            {needsMySay && can(role, 'vote') ? (
              <LinkRow
                href={`${base}/suggest`}
                index={1}
                icon={<Lightbulb className="size-5" aria-hidden="true" />}
                title={`${needsMySay} ${needsMySay === 1 ? 'idea is' : 'ideas are'} waiting for your vote`}
              />
            ) : null}
          </div>
        ) : null}

        {next ? (
          <>
            <SectionLabel className="mt-5 mb-3">Coming up</SectionLabel>
            <div
              style={festivalVars(nextFestival)}
              className="rise-in border-border-base bg-surface-raised shadow-card overflow-hidden rounded-2xl border"
            >
              {/* The festival's banner: its colour, and the thing it is
                  decorated with, moving the way it does. */}
              <Link
                href={`${base}/events/${next.slug}`}
                className="relative isolate block overflow-hidden text-white"
                style={{ background: heroBackground(nextFestival) }}
              >
                <Motif
                  id={nextFestival.motif}
                  calm={nextFestival.mood !== 'festive'}
                  className={cn(
                    'pointer-events-none absolute top-3 -right-2 size-36 sm:size-40',
                    HERO_MOTIF,
                  )}
                  style={{ '--motif-soft': 0.4 } as CSSProperties}
                />
                <div className={cn('relative px-5 pt-4 pb-5', HERO_TEXT, 'max-w-[68%]')}>
                  <p className="text-[10.5px] font-semibold tracking-[0.16em] text-white/75 uppercase">
                    {kindOf(nextFestival, next.kind === 'campaign')} · {formatDate(next.starts_on)}
                  </p>
                  <p className="mt-1.5 max-w-md font-serif text-2xl leading-tight font-medium tracking-tight text-balance">
                    {next.name}
                  </p>
                  <p className="mt-1 text-[13px] text-white/80">
                    {[next.venue, countdown(next.starts_on)].filter(Boolean).join(' · ') ||
                      formatDate(next.starts_on)}
                  </p>
                </div>
              </Link>
              <div className="px-5 pt-4 pb-5">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-ink-muted min-w-0 text-sm">
                    <RollingAmount
                      value={held}
                      currency={community.currency}
                      className="text-ink mr-1.5 font-serif text-[30px] leading-none font-medium tracking-tight"
                    />
                    of {formatMoney(s?.fundTarget ?? 0, community.currency)}
                  </p>
                  <span className="text-success text-sm font-semibold">{funded}%</span>
                </div>
                <div className="mt-3">
                  <FundBar percent={funded} pendingPercent={bar.pending} />
                </div>
                <FundKey
                  confirmed={held}
                  pending={s?.fundPending ?? 0}
                  currency={community.currency}
                  className="mt-2.5"
                />
                <div className="mt-4 grid grid-cols-2 gap-2.5">
                  <ButtonLink
                    href={`${base}/events/${next.slug}`}
                    variant="secondary"
                    className="h-11"
                  >
                    View event
                  </ButtonLink>
                  {can(role, 'contribute') ? (
                    <ButtonLink href={`${base}/events/${next.slug}/contribute`} className="h-11">
                      Contribute
                    </ButtonLink>
                  ) : null}
                </div>
              </div>
            </div>

            <SectionLabel className="mt-8 mb-3">
              {nextFestival.kind === 'festival' ? 'This festival' : 'This event'}
            </SectionLabel>
            <StatTiles className="gap-2.5">
              <StatTile label="Spent" value={formatMoney(s?.spent ?? 0, community.currency)} />
              <StatTile label={`${COPY.households} gave`} value={String(s?.contributors ?? 0)} />
              <StatTile label="Registered" value={String(s?.participants ?? 0)} />
            </StatTiles>

            <SectionLabel className="mt-8 mb-3">Take part</SectionLabel>
            <div className="grid gap-2.5 sm:grid-cols-3">
              {[
                {
                  href: `${base}/events/${next.slug}#activities`,
                  icon: CalendarDays,
                  title: 'Activities',
                  detail: 'Register yourself or your family.',
                },
                {
                  href: `${base}/events/${next.slug}#vote`,
                  icon: Lightbulb,
                  title: 'Suggest and vote',
                  detail: 'Ideas the committee approves go to a vote.',
                },
                {
                  href: `${base}/events/${next.slug}#money`,
                  icon: BarChart3,
                  title: 'Where the money goes',
                  detail: 'Budget, spending and every bill.',
                },
              ].map(({ href, icon: Icon, title, detail }, index) => (
                <Link
                  key={href}
                  href={href}
                  style={{ '--i': index } as CSSProperties}
                  className="rise-in pressable border-border-base bg-surface-raised shadow-card hover:border-border-strong rounded-2xl border p-4 transition-colors"
                >
                  <span className="text-accent grid size-9 place-items-center rounded-xl bg-[var(--festival-wash)]">
                    <Icon className="size-[18px]" aria-hidden="true" />
                  </span>
                  <p className="text-ink mt-3 text-sm font-semibold">{title}</p>
                  <p className="text-ink-muted mt-0.5 text-xs">{detail}</p>
                </Link>
              ))}
            </div>
          </>
        ) : (
          <Card className="mt-5">
            <EmptyState
              icon={<CalendarDays className="size-6" />}
              title="Nothing planned yet"
              description={
                staff
                  ? 'Create the first event with its budget, then publish it.'
                  : 'Events the society plans show up here.'
              }
              action={
                staff ? (
                  <ButtonLink href={`${base}/admin/events/new`} size="sm">
                    Create an event
                  </ButtonLink>
                ) : undefined
              }
            />
          </Card>
        )}

        {/* Money the society is holding that is not behind any event: what a
            closed event had left, once the committee decided to keep it. On
            everybody's home screen, resident and committee alike, because it
            is the one figure a society is most often asked about and least
            often able to answer. Tapping it shows where every rupee came
            from. */}
        {balance.balance > 0 ? (
          <>
            <SectionLabel className="mt-8 mb-3">Kept for the society</SectionLabel>
            <LinkRow
              href={`${base}/money#society-balance`}
              icon={<PiggyBank className="size-5" aria-hidden="true" />}
              title={
                <span className="font-serif text-lg font-medium">
                  {formatMoney(balance.balance, community.currency)}
                </span>
              }
              detail={`Left over from ${balance.movements} closed ${
                balance.movements === 1 ? 'event' : 'events'
              }`}
            />
          </>
        ) : null}

        {campaigns.length ? (
          <>
            <SectionLabel className="mt-8 mb-3">Fundraising campaigns</SectionLabel>
            <div className="space-y-2.5">
              {campaigns.map((campaign, index) => {
                const cs = stats.get(campaign.id);
                const pct = fundBarSegments(
                  cs?.fundRaised ?? 0,
                  0,
                  cs?.fundTarget ?? 0,
                  cs?.fundCarriedIn ?? 0,
                ).confirmed;
                const note = fundKey(0, cs?.fundPending ?? 0, community.currency).pending;
                return (
                  <Link
                    key={campaign.id}
                    href={`${base}/events/${campaign.slug}`}
                    style={{ '--i': index } as CSSProperties}
                    className="rise-in pressable border-border-base bg-surface-raised shadow-card hover:border-border-strong flex items-center gap-3 rounded-2xl border p-3.5 transition-colors"
                  >
                    <FestivalTile festival={festivalFor(null, campaign.name)} />
                    <span className="min-w-0 flex-1">
                      <span className="flex justify-between gap-3 text-sm">
                        <span className="text-ink font-semibold">{campaign.name}</span>
                        <span className="text-ink-muted">{pct}%</span>
                      </span>
                      <span className="text-ink-subtle mt-0.5 block text-xs">
                        {formatMoney(
                          inTheFund(cs?.fundRaised ?? 0, cs?.fundCarriedIn ?? 0),
                          community.currency,
                        )}{' '}
                        of {formatMoney(cs?.fundTarget ?? 0, community.currency)}
                        {note ? ` · ${note}` : ''}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </>
        ) : null}

        {community.whatsapp_group_url ? (
          <div className="mt-8">
            <WhatsappGroupLink
              url={community.whatsapp_group_url}
              label={`Join the ${community.name} WhatsApp group`}
            />
          </div>
        ) : null}

        {/* Phone only: on a desktop the sidebar already lists every one of
            these, and a card repeating the sidebar two inches to its right is
            noise. This exists because the bar is four slots wide. */}
        {alsoHere.length ? (
          <div className="md:hidden">
            <SectionLabel className="mt-8 mb-3">More in this society</SectionLabel>
            <div className="space-y-2.5">
              {alsoHere.map(({ href, label, detail, icon: Icon }, index) => (
                <LinkRow
                  key={href}
                  href={href}
                  index={index}
                  icon={<Icon className="size-5" aria-hidden="true" />}
                  title={label}
                  detail={detail}
                />
              ))}
            </div>
          </div>
        ) : null}

        {/* Raising money was the only thing a resident could start from here.
            Most of what a society actually argues about costs nothing. */}
        {can(role, 'suggest') || can(role, 'campaigns:propose') ? (
          <>
            <SectionLabel className="mt-8 mb-3">Start something</SectionLabel>
            <div className="space-y-2.5">
              {can(role, 'suggest') ? (
                <LinkRow
                  href={`${base}/suggest`}
                  icon={<Lightbulb className="size-5" aria-hidden="true" />}
                  title="Suggest an idea or an activity"
                  detail={`For an event or the society.${
                    societyIdeas ? ` ${societyIdeas} open for voting now.` : ''
                  }`}
                />
              ) : null}
              {can(role, 'campaigns:propose') ? (
                <LinkRow
                  href={`${base}/events/propose`}
                  index={1}
                  icon={<Megaphone className="size-5" aria-hidden="true" />}
                  title="Start a fundraising campaign"
                  detail="The committee approves it first."
                />
              ) : null}
            </div>
          </>
        ) : null}
      </PageBody>
    </>
  );
}
