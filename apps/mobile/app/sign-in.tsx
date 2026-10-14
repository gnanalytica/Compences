import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../src/lib/auth';
import { EMAIL_SIGN_IN_ENABLED } from '../src/lib/sign-in-options';
import { Body, Button, Caption, Input, Screen, Title } from '../src/components/ui';
import { spacing } from '../src/lib/theme';
import { useTheme } from '../src/lib/use-theme';

export default function SignIn() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { signInWithGoogle, signInWithEmail, user, loading } = useAuth();

  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState<'google' | 'email' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  // Once a session exists, let the index route pick sign-in, join or the tabs.
  if (user && !loading) return <Redirect href="/" />;

  const handleGoogle = async () => {
    setBusy('google');
    setError(null);
    const result = await signInWithGoogle();
    if (result.error) setError(result.error);
    setBusy(null);
  };

  const handleEmail = async () => {
    if (!email.includes('@')) {
      setError('Enter a valid email address.');
      return;
    }
    setBusy('email');
    setError(null);
    const result = await signInWithEmail(email);
    if (result.error) setError(result.error);
    if (result.sent) setSent(true);
    setBusy(null);
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            padding: spacing.xl,
            paddingTop: insets.top + spacing.xl,
            gap: spacing.lg,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ gap: spacing.xs }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: colors.accent,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: spacing.md,
              }}
            >
              <Text style={{ color: colors.accentInk, fontSize: 22, fontWeight: '700' }}>स</Text>
            </View>
            <Title>Compences</Title>
            <Body muted>Sign in, then enter your society code and pick your flat.</Body>
          </View>

          {sent ? (
            <View style={{ gap: spacing.xs }}>
              <Body>Check your email. We sent a sign-in link to {email}.</Body>
              <Caption>It’s good for one hour.</Caption>
            </View>
          ) : (
            <View style={{ gap: spacing.md }}>
              <Button
                label="Continue with Google"
                variant="secondary"
                onPress={handleGoogle}
                loading={busy === 'google'}
                disabled={busy !== null}
              />

              {EMAIL_SIGN_IN_ENABLED ? (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                    <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                    <Caption>or</Caption>
                    <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                  </View>

                  <Input
                    label="Email"
                    value={email}
                    onChangeText={setEmail}
                    placeholder="you@example.com"
                    autoCapitalize="none"
                    autoComplete="email"
                    keyboardType="email-address"
                    inputMode="email"
                  />
                  <Button
                    label="Email me a link"
                    onPress={handleEmail}
                    loading={busy === 'email'}
                    disabled={busy !== null}
                  />
                </>
              ) : (
                <Caption>Use the Google account you want your society to know you by.</Caption>
              )}
            </View>
          )}

          {error ? (
            <Text style={{ color: colors.danger, fontSize: 13 }} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
