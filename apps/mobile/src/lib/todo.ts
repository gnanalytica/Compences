import { useQuery, type QueryClient } from '@tanstack/react-query';
import { TODO_ORDER, can, type TodoKind } from '@compences/core';
import { useAuth } from './auth';
import { supabase } from './supabase';

/**
 * Everything waiting on the signed-in staff member or committee member, from
 * public.todo_items(). The database decides what counts as a task for each
 * role; residents never ask.
 */

export const TODO_KEY = 'todo';

export type TodoItem = {
  kind: TodoKind;
  id: string;
  title: string;
  subtitle: string | null;
  amount: number | null;
  event_slug: string | null;
  event_name: string | null;
  created_at: string;
};

const isKind = (value: string | null): value is TodoKind =>
  value !== null && (TODO_ORDER as string[]).includes(value);

export async function fetchTodoItems(communityId: string): Promise<TodoItem[]> {
  const { data, error } = await supabase.rpc('todo_items', { p_community_id: communityId });
  if (error) throw error;
  return (data ?? []).flatMap((row) =>
    isKind(row.kind) && row.id
      ? [
          {
            kind: row.kind,
            id: row.id,
            title: row.title ?? '',
            subtitle: row.subtitle,
            amount: row.amount,
            event_slug: row.event_slug,
            event_name: row.event_name,
            created_at: row.created_at ?? '',
          },
        ]
      : [],
  );
}

/**
 * The queue, polled gently so the Manage tab's count stays roughly current.
 * Polling pauses while the app is in the background and catches up as soon as
 * it returns; a push that arrives while open refreshes it straight away.
 */
export function useTodoItems() {
  const { activeCommunity, role } = useAuth();
  const communityId = activeCommunity?.id ?? null;
  return useQuery({
    queryKey: [TODO_KEY, communityId],
    queryFn: () => fetchTodoItems(communityId as string),
    enabled: communityId !== null && can(role, 'events:manage'),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}

/** Groups items by kind in the order the queue shows them, skipping empty groups. */
export function groupTodo(items: TodoItem[]) {
  return TODO_ORDER.map((kind) => ({
    kind,
    items: items.filter((item) => item.kind === kind),
  })).filter((group) => group.items.length > 0);
}

/**
 * After any decision. A payment, bill or campaign shows up in the queue, the
 * admin lists, event totals and Home at once, so refresh everything on screen
 * rather than guess which keys moved.
 */
export function invalidateAfterDecision(queryClient: QueryClient) {
  return queryClient.invalidateQueries();
}
