import { Bell } from 'lucide-react';
import { relativeTime } from '@compences/core';
import { requireCommunity } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase/server';
import { PageBody, PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import { markAllNotificationsRead, openNotification } from './actions';

export const metadata = { title: 'Notifications' };

export default async function NotificationsPage(
  props: PageProps<'/app/[community]/notifications'>,
) {
  const { community: slug } = await props.params;
  const { community } = await requireCommunity(slug);
  const supabase = await getSupabase();

  // RLS returns only the caller's own notifications.
  const { data } = await supabase
    .from('notifications')
    .select('id, title, body, read_at, created_at')
    .eq('community_id', community.id)
    .order('created_at', { ascending: false })
    .limit(100);
  const notifications = data ?? [];
  const unread = notifications.filter((row) => !row.read_at).length;

  return (
    <>
      <PageHeader
        title="Notifications"
        description={unread ? `${unread} unread` : 'You are all caught up.'}
        action={
          unread ? (
            <form action={markAllNotificationsRead}>
              <input type="hidden" name="slug" value={slug} />
              <Button type="submit" variant="secondary" size="sm">
                Mark all read
              </Button>
            </form>
          ) : null
        }
      />
      <PageBody>
        <Card>
          {notifications.length === 0 ? (
            <EmptyState
              icon={<Bell className="size-6" aria-hidden="true" />}
              title="No notifications yet"
              description="Approvals, payments, new events and votes will show up here."
            />
          ) : (
            <ul className="divide-border-base divide-y">
              {notifications.map((row) => (
                <li key={row.id}>
                  <form action={openNotification}>
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="notification_id" value={row.id} />
                    <button
                      type="submit"
                      className="hover:bg-surface-sunken flex w-full items-start gap-3 px-5 py-4 text-left"
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          'mt-1.5 size-2 shrink-0 rounded-full',
                          row.read_at ? 'bg-transparent' : 'bg-accent',
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span
                          className={cn(
                            'text-ink block text-sm',
                            row.read_at ? 'font-normal' : 'font-semibold',
                          )}
                        >
                          {row.title}
                          {row.read_at ? null : <span className="sr-only"> (unread)</span>}
                        </span>
                        {row.body ? (
                          <span className="text-ink-muted mt-0.5 block text-sm">{row.body}</span>
                        ) : null}
                        <span className="text-ink-subtle mt-1 block text-xs">
                          {relativeTime(row.created_at)}
                        </span>
                      </span>
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </PageBody>
    </>
  );
}
