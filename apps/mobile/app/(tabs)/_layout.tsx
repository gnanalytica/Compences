import { Redirect, Tabs, useRouter } from 'expo-router';
import { COPY, can } from '@compences/core';
import { Pressable, Text, View, type ColorValue } from 'react-native';
import {
  CalendarDays,
  House,
  LayoutGrid,
  Plus,
  UserRound,
  Wallet,
  type LucideIcon,
} from 'lucide-react-native';
import { useAuth } from '../../src/lib/auth';
import { useSeason } from '../../src/lib/events';
import { useTodoItems } from '../../src/lib/todo';
import { NavDrawerButton } from '../../src/components/nav-drawer';
import { NotificationBell } from '../../src/components/notification-bell';
import { Loading, Screen } from '../../src/components/ui';
import { fonts, lookColours } from '../../src/lib/theme';
import { useTheme } from '../../src/lib/use-theme';

/** A line icon, a touch heavier when its tab is the one open. */
function tabIcon(Icon: LucideIcon) {
  function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    return <Icon color={String(color)} size={23} strokeWidth={focused ? 2 : 1.6} />;
  }
  return TabIcon;
}

/**
 * Contribute is the thing a resident most often opens the app to do, so it is
 * a raised button in the middle of the bar rather than a tab. It opens what is
 * collecting money over the tabs, or the one event that is. It wears the
 * colour of whatever the society is heading towards, ringed in the bar's own
 * white and a hairline of gold.
 */
function ContributeButton({ onPress }: { onPress: () => void }) {
  const { colors, isDark } = useTheme();
  const accent = lookColours(useSeason(), isDark).accent;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Contribute"
      onPress={onPress}
      style={{ flex: 1, alignItems: 'center' }}
    >
      {({ pressed }) => (
        <>
          <View
            style={{
              marginTop: -20,
              padding: 3,
              borderRadius: 32,
              borderWidth: 1,
              borderColor: `${colors.gold}8c`,
              backgroundColor: colors.surfaceRaised,
              transform: [{ scale: pressed ? 0.94 : 1 }],
            }}
          >
            <View
              style={{
                width: 50,
                height: 50,
                borderRadius: 25,
                backgroundColor: accent,
                alignItems: 'center',
                justifyContent: 'center',
                elevation: 6,
                shadowColor: accent,
                shadowOpacity: 0.45,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 6 },
              }}
            >
              <Plus color={isDark ? colors.surface : '#ffffff'} size={24} strokeWidth={2.2} />
            </View>
          </View>
          <Text
            style={{ color: colors.inkSubtle, fontSize: 10.5, fontWeight: '500', marginTop: 2 }}
          >
            Contribute
          </Text>
        </>
      )}
    </Pressable>
  );
}

export default function TabsLayout() {
  const router = useRouter();
  const { colors } = useTheme();
  const { loading, user, memberships, welcomedAt, viewRole } = useAuth();
  // The committee's resident view hides Manage, exactly as residents see it.
  const staffView = can(viewRole, 'events:manage');
  // Staff don't contribute; residents and the committee do.
  const contributes = can(viewRole, 'contribute');
  const { data: todo } = useTodoItems();
  const todoCount = staffView ? (todo?.length ?? 0) : 0;

  if (loading) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  // Guard the whole tab group rather than each screen: a signed-out user who
  // deep-links into a tab must not see a half-rendered shell.
  if (!user) return <Redirect href="/sign-in" />;
  if (memberships.length === 0) return <Redirect href="/join" />;
  // First time in after being admitted: a short role-specific welcome.
  if (!welcomedAt) return <Redirect href="/welcome" />;

  return (
    <Tabs
      screenOptions={{
        // The header is the page's own ivory, its title in the serif.
        headerStyle: { backgroundColor: colors.surface },
        headerShadowVisible: false,
        headerTintColor: colors.ink,
        headerTitleStyle: { fontFamily: fonts.serif, fontSize: 18 },
        // The society name opens the full navigation, as on the web.
        headerLeft: () => <NavDrawerButton />,
        headerTitleAlign: 'center',
        // Visible, so the Contribute button can rise above the bar's edge.
        tabBarStyle: {
          backgroundColor: colors.surfaceRaised,
          borderTopColor: colors.border,
          overflow: 'visible',
        },
        tabBarLabelStyle: { fontSize: 10.5, fontWeight: '500' },
        // A bar has a fixed height; scaling its labels with the system font
        // size is what pushed them out of it.
        tabBarAllowFontScaling: false,
        // Ink, not colour, for the tab that is open: the colour is the
        // festival's, and it is on the Contribute button.
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.inkSubtle,
        sceneStyle: { backgroundColor: colors.surface },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          // The screen greets by name instead; the header keeps the bell.
          headerTitle: '',
          tabBarIcon: tabIcon(House),
          headerRight: () => <NotificationBell />,
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: 'Events',
          tabBarIcon: tabIcon(CalendarDays),
          headerRight: () => <NotificationBell />,
        }}
      />
      <Tabs.Screen
        name="give"
        options={
          contributes
            ? {
                title: 'Contribute',
                tabBarButton: () => <ContributeButton onPress={() => router.push('/contribute')} />,
              }
            : { href: null }
        }
      />
      {/* The ledger is what the app exists to publish, so residents get it on
          the bar. Staff and the committee have Manage there instead and reach
          Money from Home and Me. */}
      <Tabs.Screen
        name="money"
        options={{
          title: 'Money',
          href: staffView ? null : undefined,
          tabBarIcon: tabIcon(Wallet),
          headerRight: () => <NotificationBell />,
        }}
      />
      {/* Staff and the committee only; residents never see the tab. */}
      <Tabs.Screen
        name="manage"
        options={{
          title: COPY.manage,
          href: staffView ? undefined : null,
          tabBarIcon: tabIcon(LayoutGrid),
          tabBarBadge: todoCount > 0 ? (todoCount > 99 ? '99+' : todoCount) : undefined,
        }}
      />
      <Tabs.Screen name="me" options={{ title: 'Me', tabBarIcon: tabIcon(UserRound) }} />
      {/* Notices and polls are switched off for the pilot; the screen stays in
          the codebase but is kept out of the tab bar. */}
      <Tabs.Screen name="community" options={{ href: null }} />
      {/* The old More tab, now a redirect to Me. */}
      <Tabs.Screen name="more" options={{ href: null }} />
    </Tabs>
  );
}
