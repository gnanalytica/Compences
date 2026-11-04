/**
 * Notification rows are written by database triggers with a small `data`
 * payload ({ screen, community_slug, event_slug, … }). These helpers turn that
 * payload into a place to open on the web or in the app, and into Expo push
 * messages.
 */

export type NotificationData = {
  screen?: string;
  community_slug?: string;
  event_slug?: string;
  [key: string]: unknown;
};

/** Where a notification opens on the website. */
export function notificationWebPath(data: NotificationData | null | undefined): string {
  const slug = data?.community_slug;
  if (!slug) return '/app';
  const base = `/app/${slug}`;
  const event = data?.event_slug;
  switch (data?.screen) {
    case 'join_requests':
      return `${base}/admin/requests`;
    case 'payments':
    case 'bills':
      return event ? `${base}/admin/events/${event}` : `${base}/admin`;
    case 'approvals':
      return `${base}/admin/approvals`;
    case 'event':
      return event ? `${base}/events/${event}` : `${base}/events`;
    case 'events':
      return `${base}/events`;
    // The society's own money: kept, spent, or paid back.
    case 'money':
      return `${base}/money`;
    // Something only the committee can settle, such as an overspent event.
    case 'todo':
      return `${base}/todo`;
    case 'listing': {
      const listing = typeof data?.listing_id === 'string' ? data.listing_id : null;
      return listing ? `${base}/market/${listing}` : `${base}/market`;
    }
    case 'market':
      return `${base}/market`;
    case 'join':
      return '/onboarding';
    default:
      return base;
  }
}

/** Where a notification opens in the mobile app (expo-router href). */
export function notificationAppRoute(data: NotificationData | null | undefined): string {
  const event = data?.event_slug;
  switch (data?.screen) {
    case 'join_requests':
      return '/admin/requests';
    case 'payments':
      return '/admin/payments';
    case 'bills':
      return '/admin/bills';
    case 'approvals':
      return '/admin/queue';
    case 'event':
      return event ? `/event/${event}` : '/(tabs)/events';
    case 'events':
      return '/(tabs)/events';
    case 'money':
      return '/(tabs)/money';
    case 'todo':
      return '/manage';
    case 'listing': {
      const listing = typeof data?.listing_id === 'string' ? data.listing_id : null;
      return listing ? `/listing/${listing}` : '/market';
    }
    case 'market':
      return '/market';
    case 'join':
      return '/join';
    default:
      return '/(tabs)';
  }
}

export type PushNotificationRow = {
  id: string;
  title: string;
  body: string | null;
  data: NotificationData | null;
};

export type ExpoPushMessage = {
  to: string;
  title: string;
  body?: string;
  data: Record<string, unknown>;
  sound: 'default';
  channelId: 'default';
  priority: 'high';
};

export const isExpoPushToken = (token: string) => /^Expo(nent)?PushToken\[[^\]]+\]$/.test(token);

/** One message per device, carrying the notification id so taps can mark it read. */
export function buildPushMessages(
  notification: PushNotificationRow,
  tokens: string[],
): ExpoPushMessage[] {
  return tokens.filter(isExpoPushToken).map((to) => ({
    to,
    title: notification.title,
    ...(notification.body ? { body: notification.body } : {}),
    data: { ...(notification.data ?? {}), notification_id: notification.id },
    sound: 'default',
    channelId: 'default',
    priority: 'high',
  }));
}

/** Expo accepts at most 100 messages per request. */
export function chunk<T>(items: T[], size = 100): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
