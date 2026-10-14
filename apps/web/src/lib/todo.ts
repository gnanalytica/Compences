import { cache } from 'react';
import { TODO_ORDER, can, type MemberRole, type TodoKind } from '@compences/core';
import { getSupabase } from './supabase/server';

export type TodoItem = {
  kind: TodoKind;
  id: string;
  title: string;
  subtitle: string | null;
  amount: number | null;
  eventSlug: string | null;
  eventName: string | null;
  createdAt: string;
};

const KINDS = new Set<string>(TODO_ORDER);

/**
 * Everything waiting on staff or the committee, across every event. The
 * todo_items() function runs with the caller's rights and decides by role
 * what counts as a task; residents have no queue.
 */
export const getTodoItems = cache(
  async (communityId: string, role: MemberRole): Promise<TodoItem[]> => {
    if (!can(role, 'events:manage')) return [];
    const supabase = await getSupabase();
    const { data } = await supabase.rpc('todo_items', { p_community_id: communityId });
    return (data ?? []).flatMap((row) =>
      row.kind && KINDS.has(row.kind) && row.id
        ? [
            {
              kind: row.kind as TodoKind,
              id: row.id,
              title: row.title ?? '',
              subtitle: row.subtitle,
              amount: row.amount === null ? null : Number(row.amount),
              eventSlug: row.event_slug,
              eventName: row.event_name,
              createdAt: row.created_at ?? '',
            },
          ]
        : [],
    );
  },
);

/** Just the size of the queue, for badges. Matches getTodoItems() row for row. */
export const getTodoCount = cache(
  async (communityId: string, role: MemberRole): Promise<number> => {
    if (!can(role, 'events:manage')) return 0;
    const supabase = await getSupabase();
    const { data } = await supabase.rpc('todo_count', { p_community_id: communityId });
    return data ?? 0;
  },
);
