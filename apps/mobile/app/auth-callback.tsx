import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { completeSignIn, useAuth } from '../src/lib/auth';
import { Body, Button, Loading, Screen, Title } from '../src/components/ui';
import { spacing } from '../src/lib/theme';

/**
 * Where Google sign-in and magic links come back to (compences://auth-callback).
 *
 * On Android the redirect reaches the app as an ordinary deep link, so the
 * router opens this screen. If the in-app browser has not already exchanged the
 * code, this does; either way it hands off to the index route, which decides
 * between sign-in, join and the tabs.
 */
export default function AuthCallback() {
  const params = useLocalSearchParams<{ code?: string; error_description?: string }>();
  const { loading, user } = useAuth();
  const [error, setError] = useState<string | null>(params.error_description ?? null);
  const [exchanged, setExchanged] = useState(!params.code);

  useEffect(() => {
    if (!params.code) return;
    let active = true;
    completeSignIn(params.code).then((result) => {
      if (!active) return;
      if (result.error) setError(result.error);
      setExchanged(true);
    });
    return () => {
      active = false;
    };
  }, [params.code]);

  if (error && !user) {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.md }}>
          <Title>Sign-in didn’t finish</Title>
          <Body muted>{error}</Body>
          <Button label="Back to sign in" onPress={() => router.replace('/sign-in')} />
        </View>
      </Screen>
    );
  }

  if (!exchanged || loading) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  return <Redirect href="/" />;
}
