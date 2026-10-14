import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { router, type Href } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationAppRoute, type NotificationData } from '@compences/core';
import { useAuth } from './auth';
import { supabase } from './supabase';
import { TODO_KEY } from './todo';

/**
 * In-app notifications and push taps.
 *
 * The database writes a notification row whenever something happens (a join
 * request, a payment to confirm, a bill approved…), whether it came from the
 * web, the phone or an integration. Pushes carry the same row's data plus its
 * id, so a tap and a row in the inbox open the same screen.
 */

// Show pushes as banners even while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export const NOTIFICATIONS_KEY = 'notifications';
export const UNREAD_KEY = 'notifications:unread';

export type NotificationRow = {
  id: string;
  community_id: string | null;
  kind: string;
  title: string;
  body: string | null;
  data: NotificationData | null;
  read_at: string | null;
  created_at: string;
};

export function useNotifications() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [NOTIFICATIONS_KEY, user?.id ?? null],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data } = await supabase
        .from('notifications')
        .select('id, community_id, kind, title, body, data, read_at, created_at')
        .order('created_at', { ascending: false })
        .limit(100);
      return (data ?? []) as NotificationRow[];
    },
  });
}

/** Unread count across every society the member belongs to, for the tab badge. */
export function useUnreadCount() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: [UNREAD_KEY, user?.id ?? null],
    enabled: Boolean(user),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .is('read_at', null);
      return count ?? 0;
    },
  });
  return query.data ?? 0;
}

export async function markRead(ids: string[] | null) {
  await supabase.rpc('mark_notifications_read', ids ? { p_ids: ids } : {});
}

/**
 * Opens what a notification is about. If it belongs to another society the
 * member is in, switch to that society first so the screen shows its data.
 */
export function useOpenNotification() {
  const queryClient = useQueryClient();
  const { memberships, activeCommunity, setActiveCommunity } = useAuth();

  return async (id: string | null, data: NotificationData | null | undefined) => {
    if (id) {
      await markRead([id]);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_KEY] }),
        queryClient.invalidateQueries({ queryKey: [UNREAD_KEY] }),
      ]);
    }
    const slug = data?.community_slug;
    if (slug && activeCommunity?.slug !== slug) {
      const target = memberships.find((membership) => membership.communities?.slug === slug);
      if (target) setActiveCommunity(target.community_id);
    }
    router.push(notificationAppRoute(data) as Href);
  };
}

/**
 * Handles a tapped push, including the one that launched the app. Mounted once
 * the member is signed in and has a society, so navigation lands inside the app.
 */
export function usePushTapHandler(ready: boolean) {
  const open = useOpenNotification();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!ready) return;

    const handle = (response: Notifications.NotificationResponse | null) => {
      if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) {
        return;
      }
      const data = (response.notification.request.content.data ?? {}) as NotificationData & {
        notification_id?: string;
      };
      void open(typeof data.notification_id === 'string' ? data.notification_id : null, data);
      void Notifications.clearLastNotificationResponseAsync();
    };

    void Notifications.getLastNotificationResponseAsync().then(handle);
    const tapped = Notifications.addNotificationResponseReceivedListener(handle);
    // A push that arrives while the app is open should show up in the inbox,
    // and usually means something new is waiting in the To do queue.
    const received = Notifications.addNotificationReceivedListener(() => {
      void queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_KEY] });
      void queryClient.invalidateQueries({ queryKey: [UNREAD_KEY] });
      void queryClient.invalidateQueries({ queryKey: [TODO_KEY] });
    });

    return () => {
      tapped.remove();
      received.remove();
    };
    // `open` is recreated each render; the listeners only need the latest
    // memberships when a tap happens, which the closure gets from useAuth.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);
}
