import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import {
  COPY,
  TODO_KIND,
  TODO_ORDER,
  can,
  formatMoney,
  relativeTime,
  type TodoKind,
} from '@compences/core';
import { requireCapability } from '@/lib/auth';
import { getTodoItems, type TodoItem } from '@/lib/todo';
import { getBillOverruns, getSocietyBalance } from '@/lib/events';
import { CoverOverspendForm } from '../money/money-forms';
import { PageBody, PageHeader } from '@/components/page-header';
import { Card, CardHeader } from '@/components/ui/card';
import { Button, ButtonLink } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/field';
import { EmptyState } from '@/components/ui/empty-state';
import { ReviewExpenseForm, ReviewPaymentForm } from '../admin/events/[event]/forms';
import {
  decideCampaign,
  decideSuggestion,
  reviewFlatChange,
  reviewJoinRequest,
} from '../admin/events/actions';

export const metadata = { title: COPY.todo };

/** Where to see the full picture behind a task. */
function detailHref(base: string, item: TodoItem): string | null {
  const event = item.eventSlug;
  switch (item.kind) {
    case 'payment_to_confirm':
      return event ? `${base}/admin/events/${event}?tab=payments` : null;
    case 'join_request':
      return `${base}/people/requests`;
    // The whole list, so the committee can see who else has no flat while
    // they are already thinking about flats.
    case 'flat_change':
      return `${base}/people`;
    case 'bill_to_approve':
    case 'bill_sent_back':
      return event ? `${base}/admin/events/${event}?tab=bills` : null;
    case 'campaign_to_review':
      return event ? `${base}/events/${event}` : null;
    // A suggestion belongs either to an event or to the society itself.
    case 'suggestion_to_review':
      return event ? `${base}/events/${event}#vote` : `${base}/suggest`;
    case 'overspent':
      return event ? `${base}/events/${event}#money` : null;
  }
}

const DETAIL_LABEL: Record<TodoKind, string> = {
  payment_to_confirm: 'See screenshot and payments',
  join_request: 'See all join requests',
  bill_to_approve: 'See the bill',
  bill_sent_back: 'Fix the bill',
  campaign_to_review: 'See the campaign',
  suggestion_to_review: 'See the event',
  flat_change: 'See everyone and their flats',
  overspent: 'See the event’s money',
};

/**
 * Who paid, off an overspent item's subtitle, to start the pay-back form with.
 * todo_items() writes it as "Paid by <name> · society balance ₹<n>".
 */
function payerOf(item: TodoItem): string | null {
  return /^Paid by (.+?)(?: · |$)/.exec(item.subtitle ?? '')?.[1] ?? null;
}

function detailLabel(item: TodoItem): string {
  if (item.kind === 'suggestion_to_review' && !item.eventSlug) return 'See all ideas';
  return DETAIL_LABEL[item.kind];
}

/**
 * One queue for everything waiting on staff or the committee, across every
 * event, with the decision right next to each item.
 */
export default async function TodoPage(props: PageProps<'/app/[community]/todo'>) {
  const { community: slug } = await props.params;
  const { community, role } = await requireCapability(slug, 'events:manage');
  const [items, society] = await Promise.all([
    getTodoItems(community.id, role),
    getSocietyBalance(community.id),
  ]);
  // Bills that would take their budget line below zero, flagged beside Approve.
  const overruns = await getBillOverruns(
    items.filter((item) => item.kind === 'bill_to_approve').map((item) => item.id),
  );
  const base = `/app/${community.slug}`;
  const committee = can(role, 'roles:manage');

  const sections = TODO_ORDER.map((kind) => ({
    kind,
    items: items.filter((item) => item.kind === kind),
  })).filter((section) => section.items.length > 0);

  return (
    <>
      <PageHeader
        title={COPY.todo}
        description={
          items.length
            ? `${items.length} ${items.length === 1 ? 'thing' : 'things'} waiting on you.`
            : 'Everything that needs you, across every event.'
        }
      />
      <PageBody>
        {sections.length ? (
          <div className="space-y-5">
            {sections.map((section) => (
              <Card key={section.kind} id={section.kind}>
                <CardHeader
                  title={TODO_KIND[section.kind].section}
                  description={`${section.items.length} waiting`}
                />
                <ul className="divide-border-base divide-y">
                  {section.items.map((item) => {
                    const href = detailHref(base, item);
                    return (
                      <li key={item.id} className="space-y-3 px-5 py-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-ink text-sm font-semibold">{item.title}</p>
                            <p className="text-ink-subtle mt-0.5 text-xs">
                              {[item.subtitle, item.eventName, relativeTime(item.createdAt)]
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                          </div>
                          {item.amount !== null ? (
                            <span className="text-ink shrink-0 text-sm font-semibold">
                              {formatMoney(item.amount, community.currency)}
                            </span>
                          ) : null}
                        </div>

                        <TodoActions
                          slug={community.slug}
                          communityId={community.id}
                          societyBalance={society.balance}
                          item={item}
                          overBy={overruns.get(item.id) ?? 0}
                          committee={committee}
                          currency={community.currency}
                          role={role}
                          fixHref={href}
                        />

                        {href && item.kind !== 'bill_sent_back' ? (
                          <Link
                            href={href}
                            className="text-accent inline-flex items-center gap-1 text-xs hover:underline"
                          >
                            {detailLabel(item)}
                            <ArrowRight className="size-3.5" aria-hidden="true" />
                          </Link>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <EmptyState
              icon={<CheckCircle2 className="size-6" />}
              title="All done"
              description="Payments to confirm, new residents, bills and suggestions show up here when they need you."
            />
          </Card>
        )}
      </PageBody>
    </>
  );
}

function TodoActions({
  slug,
  communityId,
  societyBalance,
  item,
  overBy,
  committee,
  currency,
  role,
  fixHref,
}: {
  slug: string;
  communityId: string;
  societyBalance: number;
  item: TodoItem;
  /** For a bill: how far approving it takes its budget line below zero. */
  overBy: number;
  committee: boolean;
  currency: string;
  role: Parameters<typeof can>[0];
  fixHref: string | null;
}) {
  switch (item.kind) {
    case 'payment_to_confirm':
      return can(role, 'payments:record') ? (
        // The queue does not carry the reference, so the field is always
        // offered here rather than hidden from the screen staff work on most.
        // Nor does it carry who reported the payment, so a committee member
        // confirming their own is refused by the database rather than by this
        // screen; the message they get back says so.
        <ReviewPaymentForm
          slug={slug}
          eventSlug={item.eventSlug ?? ''}
          contributionId={item.id}
          showReferenceField
          reportedAmount={item.amount}
          currency={currency}
          mayCorrect={committee}
        />
      ) : null;

    case 'join_request':
      return can(role, 'joinrequests:review') ? (
        <div className="flex flex-wrap items-center gap-2">
          <form action={reviewJoinRequest} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="request_id" value={item.id} />
            <input type="hidden" name="approve" value="1" />
            {committee ? (
              <>
                <label htmlFor={`todo-role-${item.id}`} className="sr-only">
                  Admit {item.title} as
                </label>
                <Select
                  id={`todo-role-${item.id}`}
                  name="role"
                  defaultValue="resident"
                  className="w-auto"
                >
                  <option value="resident">as resident</option>
                  <option value="staff">as staff</option>
                </Select>
              </>
            ) : null}
            <Button type="submit" size="sm">
              {committee ? 'Admit' : 'Admit as resident'}
            </Button>
          </form>
          <form action={reviewJoinRequest}>
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="request_id" value={item.id} />
            <input type="hidden" name="approve" value="0" />
            <Button type="submit" size="sm" variant="ghost">
              Decline
            </Button>
          </form>
        </div>
      ) : null;

    case 'bill_to_approve':
      return can(role, 'expenses:approve') ? (
        // The queue only lists bills this member may approve — it leaves out
        // the ones they wrote — so the button is never the one the database
        // would refuse.
        <ReviewExpenseForm
          slug={slug}
          eventSlug={item.eventSlug ?? ''}
          expenseId={item.id}
          mayApprove
          overBy={overBy}
          currency={currency}
        />
      ) : null;

    case 'flat_change':
      return can(role, 'roles:manage') ? (
        <div className="flex flex-wrap items-center gap-2">
          <form action={reviewFlatChange}>
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="request_id" value={item.id} />
            <input type="hidden" name="approve" value="1" />
            <Button type="submit" size="sm">
              Move them
            </Button>
          </form>
          <form action={reviewFlatChange}>
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="request_id" value={item.id} />
            <input type="hidden" name="approve" value="0" />
            <Button type="submit" size="sm" variant="ghost">
              Leave as is
            </Button>
          </form>
        </div>
      ) : null;

    // Somebody paid the difference out of their own pocket; the committee pays
    // them back from the society balance, as far as it goes.
    case 'overspent':
      return can(role, 'expenses:approve') ? (
        <CoverOverspendForm
          slug={slug}
          communityId={communityId}
          eventId={item.id}
          overBy={item.amount ?? 0}
          balance={societyBalance}
          payer={payerOf(item)}
          currency={currency}
        />
      ) : null;

    case 'bill_sent_back':
      return fixHref ? (
        <ButtonLink href={fixHref} size="sm" variant="secondary">
          {TODO_KIND.bill_sent_back.action}
        </ButtonLink>
      ) : null;

    case 'campaign_to_review':
      return can(role, 'campaigns:approve') ? (
        <form action={decideCampaign} className="flex flex-wrap gap-2">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="event_id" value={item.id} />
          <Button type="submit" name="approve" value="1" size="sm">
            Approve
          </Button>
          <Button type="submit" name="approve" value="0" size="sm" variant="ghost">
            Decline
          </Button>
        </form>
      ) : null;

    case 'suggestion_to_review':
      return can(role, 'suggestions:approve') ? (
        <form action={decideSuggestion} className="space-y-2">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="suggestion_id" value={item.id} />
          <label htmlFor={`todo-note-${item.id}`} className="sr-only">
            Note for the resident
          </label>
          <Input
            id={`todo-note-${item.id}`}
            name="note"
            placeholder="Note for the resident (optional)"
          />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" name="approve" value="1" size="sm">
              Open for voting
            </Button>
            <Button type="submit" name="approve" value="0" size="sm" variant="ghost">
              Decline
            </Button>
          </div>
        </form>
      ) : null;
  }
}
