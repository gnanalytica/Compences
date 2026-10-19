import { describe, expect, it } from 'vitest';
import {
  buildPushMessages,
  chunk,
  isExpoPushToken,
  notificationAppRoute,
  notificationWebPath,
} from '../src/notifications';

describe('notification targets', () => {
  it('opens the right web page', () => {
    expect(notificationWebPath({ screen: 'join_requests', community_slug: 'wc' })).toBe(
      '/app/wc/admin/requests',
    );
    expect(
      notificationWebPath({ screen: 'event', community_slug: 'wc', event_slug: 'diwali' }),
    ).toBe('/app/wc/events/diwali');
    expect(
      notificationWebPath({ screen: 'bills', community_slug: 'wc', event_slug: 'diwali' }),
    ).toBe('/app/wc/admin/events/diwali');
    expect(notificationWebPath(null)).toBe('/app');
  });

  it('sends the society’s own money to Money, and an overspend to To do', () => {
    expect(notificationWebPath({ screen: 'money', community_slug: 'wc' })).toBe('/app/wc/money');
    expect(
      notificationWebPath({ screen: 'todo', community_slug: 'wc', event_slug: 'diwali' }),
    ).toBe('/app/wc/todo');
    expect(notificationAppRoute({ screen: 'money' })).toBe('/(tabs)/money');
    expect(notificationAppRoute({ screen: 'todo' })).toBe('/manage');
  });

  it('opens the right app screen', () => {
    expect(notificationAppRoute({ screen: 'payments' })).toBe('/admin/payments');
    expect(notificationAppRoute({ screen: 'event', event_slug: 'diwali' })).toBe('/event/diwali');
    expect(notificationAppRoute({})).toBe('/(tabs)');
  });
});

describe('push messages', () => {
  it('builds one message per valid Expo token with the notification id', () => {
    const messages = buildPushMessages(
      { id: 'n1', title: 'Receipt confirmed: ₹2,001', body: null, data: { screen: 'event' } },
      ['ExpoPushToken[abc]', 'not-a-token', 'ExponentPushToken[def]'],
    );
    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({
      to: 'ExpoPushToken[abc]',
      data: { screen: 'event', notification_id: 'n1' },
    });
    expect(messages[0]).not.toHaveProperty('body');
    expect(isExpoPushToken('ExpoPushToken[x]')).toBe(true);
  });

  it('chunks to Expo’s 100-message limit', () => {
    expect(chunk(Array.from({ length: 250 }, (_, i) => i)).map((part) => part.length)).toEqual([
      100, 100, 50,
    ]);
  });
});
