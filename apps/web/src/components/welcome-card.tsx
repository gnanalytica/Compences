import {
  BarChart3,
  CalendarDays,
  ClipboardCheck,
  HandCoins,
  Lightbulb,
  Receipt,
  Settings2,
  UserPlus,
  Users,
  Vote,
  type LucideIcon,
} from 'lucide-react';
import { COPY, type MemberRole } from '@compences/core';
import { Card, CardBody } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/ui/copy-button';
import { dismissWelcome } from '@/app/app/[community]/welcome/actions';

type Welcome = {
  title: string;
  intro: string;
  points: { icon: LucideIcon; text: string }[];
  cta: { label: string; path: string };
};

function welcomeFor(role: MemberRole, societyName: string): Welcome {
  if (role === 'committee' || role === 'admin') {
    return {
      title: `Welcome to the ${societyName} committee`,
      intro: 'You have the final say on money and decisions, and you set the society up.',
      points: [
        {
          icon: Settings2,
          text: 'Work through the setup checklist: flats, catalogue, UPI ID and invites.',
        },
        {
          icon: ClipboardCheck,
          text: 'Approve or reject bills, campaigns and suggestions from To do.',
        },
        {
          icon: Users,
          text: 'Decide who is staff, and close an event to publish its final accounts.',
        },
      ],
      cta: { label: 'Open Society settings', path: 'admin/settings' },
    };
  }
  if (role === 'staff') {
    return {
      title: `Welcome to ${societyName}`,
      intro: 'As staff you keep the society running day to day.',
      points: [
        {
          icon: UserPlus,
          text: 'Admit new residents from To do, and remove people who have left.',
        },
        {
          icon: Receipt,
          text: 'Upload bills with a photo or PDF, and correct them if the committee sends them back.',
        },
        {
          icon: HandCoins,
          text: 'Confirm UPI receipts against the bank statement and record cash receipts from flats.',
        },
        { icon: CalendarDays, text: 'Create events with their budgets and activities.' },
      ],
      cta: { label: 'Open To do', path: 'todo' },
    };
  }
  return {
    title: `Welcome to ${societyName}`,
    intro: 'You’re in. Here’s what you can do.',
    points: [
      {
        icon: HandCoins,
        text: 'Contribute to an event by UPI, straight to the society’s account.',
      },
      { icon: CalendarDays, text: 'Register yourself and your family for activities.' },
      { icon: Lightbulb, text: 'Suggest activities and ideas, or start a fundraising campaign.' },
      { icon: Vote, text: 'Vote on suggestions the committee opens up.' },
      { icon: BarChart3, text: 'See every approved rupee of spending, with its bill.' },
    ],
    cta: { label: 'See events', path: 'events' },
  };
}

/** Shown once, the first time someone gets in after being approved. */
export function WelcomeCard({
  slug,
  role,
  societyName,
  joinCode,
}: {
  slug: string;
  role: MemberRole;
  societyName: string;
  /** Shown to the committee: the first thing a founder needs is this code. */
  joinCode?: string;
}) {
  const welcome = welcomeFor(role, societyName);
  const base = `/app/${slug}`;
  return (
    <Card className="border-accent/40 mb-5">
      <CardBody className="space-y-4">
        <div>
          <h2 className="text-ink text-lg font-semibold tracking-tight">{welcome.title}</h2>
          <p className="text-ink-muted mt-1 text-sm">{welcome.intro}</p>
        </div>
        {joinCode && (role === 'committee' || role === 'admin') ? (
          <div className="border-border-base bg-surface-sunken flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3">
            <div>
              <p className="text-ink-subtle text-xs tracking-wide uppercase">{COPY.societyCode}</p>
              <p className="text-ink font-mono text-lg font-semibold tracking-[0.2em]">
                {joinCode}
              </p>
            </div>
            <CopyButton value={joinCode} label="Copy code" />
          </div>
        ) : null}
        <ul className="space-y-2.5">
          {welcome.points.map(({ icon: Icon, text }) => (
            <li key={text} className="text-ink flex items-start gap-3 text-sm">
              <Icon className="text-accent mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {text}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <form action={dismissWelcome}>
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="next" value={`${base}/${welcome.cta.path}`} />
            <Button type="submit" size="sm">
              {welcome.cta.label}
            </Button>
          </form>
          <form action={dismissWelcome}>
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="next" value={base} />
            <Button type="submit" size="sm" variant="ghost">
              Got it
            </Button>
          </form>
        </div>
      </CardBody>
    </Card>
  );
}
