import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
// Each weight from its own path: the package's index requires all eighteen
// cuts, and every one of them would ship in the app.
import { Fraunces_500Medium } from '@expo-google-fonts/fraunces/500Medium';
import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces/600SemiBold';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { COPY } from '@compences/core';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../src/lib/auth';
import { usePushRegistration } from '../src/lib/use-push-registration';
import { usePushTapHandler } from '../src/lib/notifications';
import { useTheme } from '../src/lib/use-theme';
import { initErrorReporting } from '../src/lib/observability';
import { applySavedAppearance } from '../src/lib/appearance';
import { fonts } from '../src/lib/theme';

// Before the first render, so a crash while the tree is mounting is still
// reported. Inert without a DSN — see lib/observability.
initErrorReporting();

// Started before the first render too: the saved Light or Dark is read from
// storage, and starting now lets it land while the app is still loading rather
// than after the first real screen has drawn.
applySavedAppearance();

// The splash stays up until the serif has loaded, so no title is ever drawn in
// the system face and then swapped. In global scope, as the SDK asks: inside a
// component it can run after the splash has already gone.
void SplashScreen.preventAutoHideAsync();

function RootStack() {
  const { colors, isDark } = useTheme();
  const { user, memberships, loading } = useAuth();

  // Runs inside the provider so it re-registers whenever the signed-in user
  // changes, and does nothing at all while signed out.
  usePushRegistration(user?.id ?? null);
  // A tapped push opens its screen once there is a signed-in member to show it to.
  usePushTapHandler(!loading && Boolean(user) && memberships.length > 0);

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          // The header is the page's own ivory, not a white bar across it,
          // and its title is set in the serif like every title in the app.
          headerStyle: { backgroundColor: colors.surface },
          headerShadowVisible: false,
          headerTintColor: colors.ink,
          headerTitleStyle: { fontFamily: fonts.serif, fontSize: 18 },
          contentStyle: { backgroundColor: colors.surface },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        <Stack.Screen name="auth-callback" options={{ headerShown: false }} />
        <Stack.Screen name="join" options={{ title: 'Join your community' }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        {/* The event's banner carries its name. */}
        <Stack.Screen name="event/[slug]" options={{ title: '' }} />
        <Stack.Screen name="contribute" options={{ title: 'Contribute', presentation: 'modal' }} />
        <Stack.Screen name="campaign/new" options={{ title: 'New campaign' }} />
        <Stack.Screen name="admin/requests" options={{ title: 'Join requests' }} />
        <Stack.Screen name="people" options={{ title: 'People' }} />
        <Stack.Screen name="ideas" options={{ title: 'Ideas' }} />
        <Stack.Screen name="admin/member/[id]" options={{ title: 'Resident' }} />
        <Stack.Screen name="admin/bills" options={{ title: 'Bills' }} />
        <Stack.Screen name="admin/bill" options={{ title: 'Bill' }} />
        <Stack.Screen name="admin/payments" options={{ title: 'Payments' }} />
        <Stack.Screen name="admin/pay-back" options={{ title: 'Pay back' }} />
        <Stack.Screen name="admin/society-spend" options={{ title: 'Society balance' }} />
        <Stack.Screen name="admin/reconcile" options={{ title: 'Reconcile' }} />
        <Stack.Screen name="admin/upi" options={{ title: 'UPI ID' }} />
        {/* Old link for committee decisions; redirects to the To do queue. */}
        <Stack.Screen name="admin/queue" options={{ title: COPY.todo }} />
        <Stack.Screen name="welcome" options={{ headerShown: false }} />
        <Stack.Screen name="join/[code]" options={{ headerShown: false }} />
        <Stack.Screen name="invite" options={{ title: 'Invite code' }} />
        <Stack.Screen name="invite/[code]" options={{ headerShown: false }} />
        <Stack.Screen name="found" options={{ title: 'Start a society' }} />
        <Stack.Screen name="admin/setup" options={{ title: 'Setup' }} />
        <Stack.Screen name="admin/society-settings" options={{ title: COPY.societySettings }} />
        <Stack.Screen name="admin/society" options={{ title: 'Society details' }} />
        <Stack.Screen name="admin/flats" options={{ title: 'Flats' }} />
        <Stack.Screen name="admin/catalogue" options={{ title: 'Catalogue' }} />
        <Stack.Screen
          name="admin/share"
          options={{ title: `Share ${COPY.societyCode.toLowerCase()}` }}
        />
        <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
        <Stack.Screen name="delete-account" options={{ title: 'Delete account' }} />
        <Stack.Screen name="admin/event/new" options={{ title: 'New event' }} />
        <Stack.Screen name="admin/event/[slug]" options={{ title: 'Manage event' }} />
      </Stack>
    </>
  );
}

// Created once, outside the component, so a re-render never throws the cache
// away. Data here is community-scoped and changes slowly; a short stale window
// keeps tab switches instant without serving genuinely old information.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// React Query only knows about browser tabs. Tell it when the app goes to the
// background and comes back, so badge polls stop while nobody is looking and
// counts refresh the moment the app is reopened.
if (Platform.OS !== 'web') {
  focusManager.setEventListener((setFocused) => {
    const subscription = AppState.addEventListener('change', (state) =>
      setFocused(state === 'active'),
    );
    return () => subscription.remove();
  });
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Fraunces_500Medium, Fraunces_600SemiBold });
  // A font that fails to load is not worth a blank app: fall back and go on.
  const ready = fontsLoaded || Boolean(fontError);

  useEffect(() => {
    if (ready) SplashScreen.hide();
  }, [ready]);

  if (!ready) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <AuthProvider>
          <RootStack />
        </AuthProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
