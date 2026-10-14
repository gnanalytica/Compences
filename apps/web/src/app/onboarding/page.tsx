import type { ReactNode } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Building2, Clock, KeyRound, RefreshCw, Ticket, XCircle } from 'lucide-react';
import { relativeTime } from '@compences/core';
import { getMemberships, getProfile, requireUser } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase/server';
import { Card, CardBody } from '@/components/ui/card';
import { Button, ButtonLink } from '@/components/ui/button';
import { CreateFlow } from './create-flow';
import { InviteFlow } from './invite-flow';
import { JoinFlow } from './join-flow';
import { withdrawJoinRequest } from './actions';

export const metadata = { title: 'Join your society' };

/**
 * The caller's own latest request. Applicants cannot read the society or its
 * flats yet, so the pending screen shows what they submitted about themselves.
 */
async function latestRequest(userId: string) {
  const supabase = await getSupabase();
  const { data: request } = await supabase
    .from('join_requests')
    .select(
      'id, unit_id, claimed_name, claimed_phone, relation, status, decline_reason, created_at, updated_at',
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!request) return null;

  return request;
}

/**
 * Two ways in, and a screen that asks which. Most people arrive from a join
 * link and never see the choice; the committee member setting their society up
 * for the first time has nobody to give them a code, and used to have nobody
 * to ask either.
 */
export default async function OnboardingPage(props: PageProps<'/onboarding'>) {
  const user = await requireUser();
  const { mode, code, invite } = await props.searchParams;
  const profile = await getProfile();
  // From a shared join link: /join/CODE fills the society code in.
  const initialCode = typeof code === 'string' ? code.toUpperCase().slice(0, 16) : '';
  // From a shared invite link: /invite/CODE fills the invite code in.
  const initialInvite = typeof invite === 'string' ? invite.toUpperCase().slice(0, 16) : '';
  // A deliberate choice, as opposed to "I just landed here".
  const intent = mode === 'join' || mode === 'create' || mode === 'invite' ? mode : null;

  const memberships = await getMemberships();
  const firstSlug = memberships[0]?.communities?.slug;
  if (firstSlug && !intent) redirect(`/app/${firstSlug}`);

  const request = intent && firstSlug ? null : await latestRequest(user.id);
  // Joining files one complete request, so any pending request is waiting on
  // staff — but it is no reason to stand between someone and their own society.
  const pending = request?.status === 'pending' && intent !== 'create' ? request : null;
  const declined = request?.status === 'rejected' && !intent ? request : null;

  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12">
      <Link href="/" className="mb-8 inline-flex items-center gap-2 self-start">
        <span className="bg-accent text-accent-ink grid size-8 place-items-center rounded-lg text-sm font-bold">
          स
        </span>
        <span className="text-lg font-semibold tracking-tight">Compences</span>
      </Link>

      {pending ? (
        <Card>
          <CardBody className="py-8 text-center">
            <Clock className="text-accent mx-auto size-10" aria-hidden="true" />
            <h1 className="text-ink mt-4 text-xl font-semibold tracking-tight">
              Waiting for approval
            </h1>
            <p className="text-ink-muted mt-1.5 text-sm">
              Your request is with your society’s staff. You’ll see events and accounts as soon as
              they approve it.
            </p>
            <dl className="border-border-base bg-surface-sunken mt-5 space-y-1 rounded-xl border p-4 text-left text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-ink-muted">Name</dt>
                <dd className="text-ink font-medium">{pending.claimed_name}</dd>
              </div>
              {pending.claimed_phone ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-muted">Mobile</dt>
                  <dd className="text-ink font-medium">{pending.claimed_phone}</dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-4">
                <dt className="text-ink-muted">Joining as</dt>
                <dd className="text-ink font-medium capitalize">
                  {pending.relation === 'other' ? 'Works for the society' : pending.relation}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-muted">Sent</dt>
                <dd className="text-ink font-medium">{relativeTime(pending.created_at)}</dd>
              </div>
            </dl>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <ButtonLink href="/onboarding" size="sm">
                <RefreshCw className="size-4" aria-hidden="true" />
                Check again
              </ButtonLink>
              <form action={withdrawJoinRequest}>
                <input type="hidden" name="request_id" value={pending.id} />
                <Button type="submit" size="sm" variant="ghost">
                  Withdraw and start over
                </Button>
              </form>
            </div>
          </CardBody>
        </Card>
      ) : (
        <>
          {declined ? (
            <div className="border-danger/30 bg-danger/10 mb-5 flex items-start gap-3 rounded-xl border p-4 text-sm">
              <XCircle className="text-danger mt-0.5 size-5 shrink-0" aria-hidden="true" />
              <div>
                <p className="text-ink font-medium">Your last request to join wasn’t approved.</p>
                <p className="text-ink-muted mt-0.5">
                  {declined.decline_reason ?? 'Check your flat and details with the committee.'}
                </p>
              </div>
            </div>
          ) : null}

          {intent === 'create' ? (
            <>
              <h1 className="text-2xl font-semibold tracking-tight">Start your society</h1>
              <p className="text-ink-muted mt-1.5 mb-6 text-sm">
                A few details now. Flats, categories and your UPI ID come next.
              </p>
              <CreateFlow />
              <p className="text-ink-muted mt-5 text-center text-sm">
                Already on Compences?{' '}
                <Link href="/onboarding?mode=join" className="text-accent hover:underline">
                  Join with your society code
                </Link>
              </p>
            </>
          ) : intent === 'invite' || initialInvite ? (
            <>
              <h1 className="text-2xl font-semibold tracking-tight">Use your invite code</h1>
              <p className="text-ink-muted mt-1.5 mb-6 text-sm">
                A personal code from your committee. It lets you in straight away.
              </p>
              <InviteFlow initialCode={initialInvite} />
              <p className="text-ink-muted mt-5 text-center text-sm">
                Only have the society code everyone shares?{' '}
                <Link href="/onboarding?mode=join" className="text-accent hover:underline">
                  Join with that instead
                </Link>
              </p>
            </>
          ) : intent === 'join' || initialCode ? (
            <>
              <h1 className="text-2xl font-semibold tracking-tight">Join your society</h1>
              <p className="text-ink-muted mt-1.5 mb-6 text-sm">
                Enter your society code, then your details and flat.
              </p>
              <JoinFlow initialCode={initialCode} initialName={profile?.full_name ?? ''} />
              <p className="text-ink-muted mt-5 text-center text-sm">
                Nobody has set your society up yet?{' '}
                <Link href="/onboarding?mode=create" className="text-accent hover:underline">
                  Start it yourself
                </Link>
              </p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-semibold tracking-tight">Welcome to Compences</h1>
              <p className="text-ink-muted mt-1.5 mb-6 text-sm">
                Your society’s events, and every rupee behind them, in one place.
              </p>
              <div className="space-y-3">
                <ChoiceCard
                  href="/onboarding?mode=join"
                  icon={<KeyRound className="size-5" aria-hidden="true" />}
                  title="I have a society code"
                  detail="One code for every resident. Pick your flat and staff let you in."
                />
                <ChoiceCard
                  href="/onboarding?mode=invite"
                  icon={<Ticket className="size-5" aria-hidden="true" />}
                  title="I was sent an invite code"
                  detail="A code just for you. It lets you in straight away."
                />
                <ChoiceCard
                  href="/onboarding?mode=create"
                  icon={<Building2 className="size-5" aria-hidden="true" />}
                  title="I’m setting up my society"
                  detail="You become its first committee member, with a code to share."
                />
              </div>
            </>
          )}
        </>
      )}

      <form action="/auth/signout" method="post" className="mt-8 text-center">
        <button type="submit" className="text-ink-subtle text-xs underline underline-offset-4">
          Sign out
        </button>
      </form>
    </main>
  );
}

function ChoiceCard({
  href,
  icon,
  title,
  detail,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <Link
      href={href}
      className="border-border-base bg-surface-raised hover:border-accent/50 hover:bg-surface-sunken flex gap-3 rounded-xl border p-4 text-left transition-colors"
    >
      <span className="bg-accent/10 text-accent grid size-10 shrink-0 place-items-center rounded-lg">
        {icon}
      </span>
      <span>
        <span className="text-ink block text-sm font-medium">{title}</span>
        <span className="text-ink-muted mt-0.5 block text-sm">{detail}</span>
      </span>
    </Link>
  );
}
