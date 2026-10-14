import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { COPY, TODO_KIND, formatDate, formatMoney, type TodoKind } from '@compences/core';
import { supabase } from '../lib/supabase';
import { groupTodo, invalidateAfterDecision, type TodoItem } from '../lib/todo';
import { spacing } from '../lib/theme';
import { Body, Button, Caption, Card, Heading, Input } from './ui';
import { ErrorText } from './admin-ui';

/**
 * The To do queue: one list of everything waiting on this person, grouped by
 * kind. The common decisions happen right here; tapping a card opens the full
 * screen for anything that needs a closer look (the bill photo, the admit-as
 * choice, the payment screenshot).
 */
export function TodoQueue({ items, currency }: { items: TodoItem[]; currency: string }) {
  const groups = groupTodo(items);
  return (
    <View style={{ gap: spacing.lg }}>
      {groups.map((group) => (
        <View key={group.kind} style={{ gap: spacing.sm }}>
          <Heading>
            {TODO_KIND[group.kind].section} ({group.items.length})
          </Heading>
          {group.items.map((item) => (
            <TodoCard key={`${item.kind}:${item.id}`} item={item} currency={currency} />
          ))}
        </View>
      ))}
    </View>
  );
}

/** Where tapping a card goes. */
function detailRoute(item: TodoItem): Href {
  switch (item.kind) {
    case 'join_request':
      return '/admin/requests';
    case 'payment_to_confirm':
      return item.event_slug
        ? { pathname: '/admin/payments', params: { event: item.event_slug } }
        : '/admin/payments';
    case 'bill_to_approve':
      return '/admin/bills';
    case 'bill_sent_back':
      return { pathname: '/admin/bill', params: { id: item.id } };
    case 'campaign_to_review':
      return item.event_slug
        ? { pathname: '/event/[slug]', params: { slug: item.event_slug } }
        : '/events';
    // A suggestion about the society belongs to no event, and this used to send
    // the committee to the events list — a tab called "See the event" landing
    // them nowhere near the thing they were asked to decide on.
    case 'suggestion_to_review':
      return item.event_slug
        ? { pathname: '/event/[slug]', params: { slug: item.event_slug, tab: 'vote' } }
        : '/ideas';
    // The whole list, so the committee can see who else has no flat while
    // they are already thinking about flats.
    case 'flat_change':
      return '/admin/society';
    // Paying somebody back needs the screenshot of the transfer, so it has a
    // screen of its own rather than a button here.
    case 'overspent':
      return {
        pathname: '/admin/pay-back',
        params: {
          event: item.id,
          name: item.title,
          over: String(item.amount ?? 0),
          payer: payerOf(item) ?? '',
        },
      };
  }
}

/**
 * Who paid, off an overspent item's subtitle, to start the pay-back with.
 * todo_items() writes it as "Paid by <name> · society balance ₹<n>".
 */
function payerOf(item: TodoItem): string | null {
  return /^Paid by (.+?)(?: · |$)/.exec(item.subtitle ?? '')?.[1] ?? null;
}

type Action = {
  id: string;
  label: string;
  primary?: boolean;
  /** Ask for a note first. `required` refuses an empty one. */
  note?: { label: string; placeholder: string; required: boolean };
  run: (note: string) => PromiseLike<{ error: { message: string } | null }>;
};

function actionsFor(kind: TodoKind, id: string): Action[] {
  switch (kind) {
    case 'payment_to_confirm':
      return [
        {
          id: 'confirm',
          label: 'Confirm',
          primary: true,
          run: () =>
            supabase.rpc('review_contribution', { p_contribution_id: id, p_confirm: true }),
        },
        {
          id: 'decline',
          label: 'Turn down',
          note: {
            label: 'Why can’t it be confirmed?',
            placeholder: 'No matching credit in the bank statement',
            required: true,
          },
          run: (note) =>
            supabase.rpc('review_contribution', {
              p_contribution_id: id,
              p_confirm: false,
              p_note: note,
            }),
        },
      ];
    case 'flat_change':
      return [
        {
          id: 'move',
          label: 'Move them',
          primary: true,
          run: () => supabase.rpc('review_unit_change', { p_request_id: id, p_approve: true }),
        },
        {
          id: 'leave',
          label: 'Leave as is',
          note: {
            label: 'Why not? They will see this.',
            placeholder: 'That flat already has someone in it',
            required: false,
          },
          run: (note) =>
            supabase.rpc('review_unit_change', {
              p_request_id: id,
              p_approve: false,
              p_reason: note || undefined,
            }),
        },
      ];
    case 'join_request':
      return [
        {
          id: 'admit',
          label: 'Admit',
          primary: true,
          run: () =>
            supabase.rpc('review_join_request', {
              p_request_id: id,
              p_approve: true,
              p_role: 'resident',
            }),
        },
        {
          id: 'decline',
          label: 'Decline',
          note: {
            label: 'Reason (shown to them)',
            placeholder: 'e.g. We couldn’t match this flat to our records',
            required: false,
          },
          run: (note) =>
            supabase.rpc('review_join_request', {
              p_request_id: id,
              p_approve: false,
              p_reason: note || undefined,
            }),
        },
      ];
    case 'bill_to_approve':
      return [
        {
          id: 'approve',
          label: 'Approve',
          primary: true,
          run: () => supabase.rpc('review_expense', { p_expense_id: id, p_decision: 'approved' }),
        },
        {
          id: 'send_back',
          label: 'Send back',
          note: {
            label: 'What needs to change?',
            placeholder: 'Shown to whoever raised the bill',
            required: false,
          },
          run: (note) =>
            supabase.rpc('review_expense', {
              p_expense_id: id,
              p_decision: 'changes_requested',
              p_note: note || undefined,
            }),
        },
        {
          id: 'reject',
          label: 'Reject',
          note: {
            label: 'Reason for rejecting',
            placeholder: 'Shown to whoever raised the bill',
            required: false,
          },
          run: (note) =>
            supabase.rpc('review_expense', {
              p_expense_id: id,
              p_decision: 'rejected',
              p_note: note || undefined,
            }),
        },
      ];
    case 'campaign_to_review':
      return [
        {
          id: 'approve',
          label: 'Approve',
          primary: true,
          run: () =>
            supabase
              .from('events')
              .update({ status: 'published' })
              .eq('id', id)
              .eq('status', 'proposed'),
        },
        {
          id: 'decline',
          label: 'Decline',
          run: () =>
            supabase
              .from('events')
              .update({ status: 'cancelled' })
              .eq('id', id)
              .eq('status', 'proposed'),
        },
      ];
    case 'suggestion_to_review':
      return [
        {
          id: 'accept',
          label: 'Open for voting',
          primary: true,
          run: () =>
            supabase.from('activity_suggestions').update({ status: 'accepted' }).eq('id', id),
        },
        {
          id: 'decline',
          label: 'Decline',
          run: () =>
            supabase.from('activity_suggestions').update({ status: 'declined' }).eq('id', id),
        },
      ];
    // Both need a screen of their own — fixing a bill, and paying somebody
    // back with the screenshot of the transfer — so the card opens it.
    case 'bill_sent_back':
    case 'overspent':
      return [];
  }
}

function TodoCard({ item, currency }: { item: TodoItem; currency: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<Action | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const actions = actionsFor(item.kind, item.id);
  const open = () => router.push(detailRoute(item));

  const run = async (action: Action) => {
    if (action.note?.required && !note.trim()) {
      setError('Add a short note first.');
      return;
    }
    setBusy(action.id);
    setError(null);
    const { error: runError } = await action.run(note.trim());
    setBusy(null);
    if (runError) {
      setError(runError.message);
      return;
    }
    setPending(null);
    setNote('');
    await invalidateAfterDecision(queryClient);
  };

  const context = [
    item.subtitle,
    item.event_name && item.kind !== 'campaign_to_review' ? item.event_name : null,
    item.created_at ? formatDate(item.created_at.slice(0, 10)) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Card style={{ gap: spacing.sm }}>
      <Pressable
        accessibilityRole="button"
        accessibilityHint="Opens the full details"
        onPress={open}
        style={({ pressed }) => ({
          flexDirection: 'row',
          justifyContent: 'space-between',
          gap: spacing.md,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Body>{item.title}</Body>
          {context ? <Caption>{context}</Caption> : null}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 2 }}>
          {item.amount !== null ? <Heading>{formatMoney(item.amount, currency)}</Heading> : null}
          <Caption>Details ›</Caption>
        </View>
      </Pressable>

      {pending?.note ? (
        <View style={{ gap: spacing.sm }}>
          <Input
            label={pending.note.label}
            value={note}
            onChangeText={setNote}
            placeholder={pending.note.placeholder}
            multiline
          />
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Button
                label="Cancel"
                variant="secondary"
                onPress={() => {
                  setPending(null);
                  setError(null);
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label={pending.label}
                onPress={() => void run(pending)}
                loading={busy === pending.id}
              />
            </View>
          </View>
        </View>
      ) : actions.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {actions.map((action) => (
            <View
              key={action.id}
              style={{
                flexGrow: 1,
                flexBasis: actions.length > 2 && action.primary ? '100%' : 0,
              }}
            >
              <Button
                label={action.label}
                variant={action.primary ? 'primary' : 'secondary'}
                onPress={() => (action.note ? setPending(action) : void run(action))}
                loading={busy === action.id}
                disabled={busy !== null}
              />
            </View>
          ))}
        </View>
      ) : (
        <Button label={TODO_KIND[item.kind].action} variant="secondary" onPress={open} />
      )}
      <ErrorText message={error} />
    </Card>
  );
}

export function TodoEmpty() {
  return (
    <Card>
      <Body muted>Nothing waiting. New payments, bills and requests appear here.</Body>
    </Card>
  );
}

export const todoTitle = (count: number) => (count ? `${COPY.todo} (${count})` : COPY.todo);
