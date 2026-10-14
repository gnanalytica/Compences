import { RefreshControl, ScrollView, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { COPY, EVENT_STATUS_LABEL, can, formatDate } from '@compences/core';
import { useAuth } from '../../src/lib/auth';
import { fetchEvents } from '../../src/lib/events';
import { useTodoItems } from '../../src/lib/todo';
import { useCommunityData } from '../../src/lib/use-community-data';
import { Body, Button, Caption, Card, Heading, Loading, Screen } from '../../src/components/ui';
import { LinkRow } from '../../src/components/admin-ui';
import { TodoEmpty, TodoQueue, todoTitle } from '../../src/components/todo-queue';
import { spacing } from '../../src/lib/theme';

/**
 * Staff and the committee's tab: what's waiting on them first, then the events
 * they run, then the rest of the society's records.
 */
export default function Manage() {
  const router = useRouter();
  const { role, activeCommunity } = useAuth();
  const currency = activeCommunity?.currency ?? 'INR';
  const todo = useTodoItems();
  const events = useCommunityData('manage:events', fetchEvents);

  if (!can(role, 'events:manage')) return <Redirect href="/" />;

  const running = (events.data ?? []).filter(
    (event) => event.status === 'draft' || event.status === 'published',
  );
  const items = todo.data ?? [];
  const refreshing = todo.isRefetching || events.refreshing;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void todo.refetch();
              events.refresh();
            }}
          />
        }
      >
        <Heading>{todoTitle(items.length)}</Heading>
        {todo.isPending ? (
          <Loading />
        ) : todo.isError ? (
          <Card>
            <Body muted>Could not load your To do list. Pull down to try again.</Body>
          </Card>
        ) : items.length ? (
          <TodoQueue items={items} currency={currency} />
        ) : (
          <TodoEmpty />
        )}

        <View style={{ gap: spacing.sm }}>
          <Heading>Events to run</Heading>
          <Button label="New event" onPress={() => router.push('/admin/event/new')} />
          {running.length ? (
            <Card style={{ gap: 0 }}>
              {running.map((event) => (
                <LinkRow
                  key={event.id}
                  label={event.name}
                  detail={`${formatDate(event.starts_on)}${
                    event.status === 'draft' ? ` · ${EVENT_STATUS_LABEL.draft}` : ''
                  }`}
                  onPress={() =>
                    router.push({ pathname: '/admin/event/[slug]', params: { slug: event.slug } })
                  }
                />
              ))}
            </Card>
          ) : events.loading ? null : (
            <Caption>No events being run right now.</Caption>
          )}
        </View>

        <Card style={{ gap: 0 }}>
          <LinkRow
            label="Residents"
            detail="Everyone admitted, by flat"
            onPress={() => router.push('/people')}
          />
          <LinkRow
            label="Bills"
            detail="Add a bill, or see bills waiting and sent back"
            onPress={() => router.push('/admin/bills')}
          />
          <LinkRow
            label="Payments"
            detail="Who has paid for each event"
            onPress={() => router.push('/admin/payments')}
          />
          {/* Same capability the screen itself checks, so the row is not an
              invitation to a page that will turn you away. */}
          {can(role, 'payments:record') ? (
            <LinkRow
              label="Reconcile"
              detail="Match the bank statement to reported payments"
              onPress={() => router.push('/admin/reconcile')}
            />
          ) : null}
          {can(role, 'roles:manage') ? (
            <LinkRow
              label={COPY.societySettings}
              detail="Society details, flats, catalogue, UPI ID, society code"
              onPress={() => router.push('/admin/society-settings')}
            />
          ) : (
            <>
              <LinkRow
                label="Share society code"
                detail="Invite residents with the code and join link"
                onPress={() => router.push('/admin/share?for=residents')}
              />
              <LinkRow
                label="Catalogue"
                detail="Event types, venues, budget categories, vendors"
                onPress={() => router.push('/admin/catalogue')}
              />
            </>
          )}
        </Card>
        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </Screen>
  );
}
