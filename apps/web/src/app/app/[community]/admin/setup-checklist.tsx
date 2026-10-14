import Link from 'next/link';
import { CheckCircle2, Circle } from 'lucide-react';
import { setupProgress, setupSteps, type SetupStepId } from '@compences/core';
import type { Community } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase/server';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Button, buttonClass } from '@/components/ui/button';
import { FundBar } from '@/components/badges';
import { finishSetup } from './actions';

/** Each step opens its section of Society settings (or the editor it links to). */
const CTA: Record<SetupStepId, { label: string; path: string }> = {
  details: { label: 'Add details', path: 'admin/settings#details' },
  flats: { label: 'Add flats', path: 'admin/units' },
  catalogue: { label: 'Review catalogue', path: 'admin/catalogue' },
  upi: { label: 'Set UPI ID', path: 'admin/settings#upi' },
  staff: { label: 'Invite staff', path: 'admin/settings#staff' },
  residents: { label: 'Invite residents', path: 'admin/settings#invite' },
  event: { label: 'Create event', path: 'admin/events/new' },
};

/**
 * What a new society's committee still has to do before residents arrive.
 * Shown in Society settings and on the events console until the committee
 * finishes or skips it.
 */
export async function SetupChecklist({ community }: { community: Community }) {
  const supabase = await getSupabase();
  const count = (query: PromiseLike<{ count: number | null }>) =>
    Promise.resolve(query).then((result) => result.count ?? 0);

  const [flats, staff, residents, events] = await Promise.all([
    count(
      supabase
        .from('units')
        .select('id', { count: 'exact', head: true })
        .eq('community_id', community.id),
    ),
    count(
      supabase
        .from('memberships')
        .select('id', { count: 'exact', head: true })
        .eq('community_id', community.id)
        .eq('status', 'active')
        .eq('role', 'staff'),
    ),
    count(
      supabase
        .from('memberships')
        .select('id', { count: 'exact', head: true })
        .eq('community_id', community.id)
        .eq('status', 'active')
        .eq('role', 'resident'),
    ),
    count(
      supabase
        .from('events')
        .select('id', { count: 'exact', head: true })
        .eq('community_id', community.id)
        .neq('status', 'proposed'),
    ),
  ]);

  const steps = setupSteps({
    hasAddress: Boolean(community.address?.trim()),
    flats,
    catalogueReviewed: Boolean(community.catalogue_reviewed_at),
    upiSet: Boolean(community.upi_vpa),
    staff,
    residents,
    events,
  });
  const { done, total } = setupProgress(steps);
  const base = `/app/${community.slug}`;
  const next = steps.find((step) => !step.done);

  return (
    <Card className="border-accent/40 mb-5">
      <CardHeader
        title={`Set up ${community.name}`}
        description={
          done === total
            ? 'Everything is in place.'
            : `${done} of ${total} done. Residents can join as soon as your flats are in.`
        }
        action={
          <form action={finishSetup}>
            <input type="hidden" name="slug" value={community.slug} />
            <Button type="submit" size="sm" variant={done === total ? 'primary' : 'ghost'}>
              {done === total ? 'Finish setup' : 'Skip for now'}
            </Button>
          </form>
        }
      />
      <CardBody className="space-y-4">
        <FundBar percent={Math.round((done / total) * 100)} />
        <ol className="space-y-2">
          {steps.map((step) => (
            <li
              key={step.id}
              className={
                step.id === next?.id
                  ? 'border-accent/40 bg-surface-sunken flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3'
                  : 'flex flex-wrap items-center justify-between gap-3 px-4 py-2'
              }
            >
              <div className="flex min-w-0 items-start gap-3">
                {step.done ? (
                  <CheckCircle2
                    className="text-success mt-0.5 size-5 shrink-0"
                    aria-hidden="true"
                  />
                ) : (
                  <Circle className="text-ink-subtle mt-0.5 size-5 shrink-0" aria-hidden="true" />
                )}
                <div className="min-w-0">
                  <p
                    className={
                      step.done
                        ? 'text-ink-muted text-sm line-through'
                        : 'text-ink text-sm font-medium'
                    }
                  >
                    {step.title}
                    <span className="sr-only">{step.done ? ' (done)' : ' (to do)'}</span>
                  </p>
                  {!step.done ? <p className="text-ink-muted text-xs">{step.description}</p> : null}
                </div>
              </div>
              {!step.done ? (
                <Link
                  href={`${base}/${CTA[step.id].path}`}
                  className={buttonClass(step.id === next?.id ? 'primary' : 'secondary', 'sm')}
                >
                  {CTA[step.id].label}
                </Link>
              ) : null}
            </li>
          ))}
        </ol>
      </CardBody>
    </Card>
  );
}
