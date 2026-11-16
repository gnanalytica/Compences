import { useEffect, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Redirect } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../src/lib/auth';
import { EMAIL_SIGN_IN_ENABLED, PASSWORD_SIGN_IN_ENABLED } from '../src/lib/sign-in-options';
import { Body, Button, Caption, Input, Screen, Title } from '../src/components/ui';
import { LegalLinks } from '../src/components/legal-links';
import { minTapTarget, spacing } from '../src/lib/theme';
import { useTheme } from '../src/lib/use-theme';

export default function SignIn() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { signInWithGoogle, signInWithApple, signInWithEmail, signInWithPassword, user, loading } =
    useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // The test account's form replaces the buttons rather than sitting under
  // them: a resident never has a password, so they should not meet the field.
  const [withPassword, setWithPassword] = useState(false);
  const [busy, setBusy] = useState<'google' | 'apple' | 'email' | 'password' | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  // Apple's sheet exists on iOS only; the button must follow Apple's own design.
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    void AppleAuthentication.isAvailableAsync().then(setAppleAvailable);
  }, []);

  // Once a session exists, let the index route pick sign-in, join or the tabs.
  if (user && !loading) return <Redirect href="/" />;

  const handleGoogle = async () => {
    setBusy('google');
    setError(null);
    const result = await signInWithGoogle();
    if (result.error) setError(result.error);
    setBusy(null);
  };

  const handleApple = async () => {
    setBusy('apple');
    setError(null);
    const result = await signInWithApple();
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

  const handlePassword = async () => {
    if (!email.includes('@') || !password) {
      setError('Enter the email address and the password.');
      return;
    }
    setBusy('password');
    setError(null);
    const result = await signInWithPassword(email, password);
    if (result.error) setError(result.error);
    setBusy(null);
  };

  const switchForm = (toPassword: boolean) => {
    setWithPassword(toPassword);
    setPassword('');
    setError(null);
  };

  const textLink = (label: string, onPress: () => void) => (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={busy !== null}
      hitSlop={8}
      style={{ minHeight: minTapTarget, justifyContent: 'center', alignItems: 'center' }}
    >
      <Text style={{ color: colors.accent, fontSize: 13, textDecorationLine: 'underline' }}>
        {label}
      </Text>
    </Pressable>
  );

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
            {/* The app icon itself, so the first screen matches the home screen. */}
            <Image
              source={require('../assets/icon.png')}
              accessibilityIgnoresInvertColors
              style={{ width: 44, height: 44, borderRadius: 12, marginBottom: spacing.md }}
            />
            <Title>Compences</Title>
            <Body muted>Sign in, then enter your society code and pick your flat.</Body>
          </View>

          {sent ? (
            <View style={{ gap: spacing.xs }}>
              <Body>Check your email. We sent a sign-in link to {email}.</Body>
              <Caption>It’s good for one hour.</Caption>
            </View>
          ) : withPassword ? (
            <View style={{ gap: spacing.md }}>
              <Caption>
                For a test account you were given an email address and a password for. Everybody
                else signs in the other way.
              </Caption>
              <Input
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="username"
                keyboardType="email-address"
                inputMode="email"
              />
              <Input
                label="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="current-password"
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={() => void handlePassword()}
              />
              <Button
                label="Sign in"
                onPress={handlePassword}
                loading={busy === 'password'}
                disabled={busy !== null}
              />
              {textLink('Sign in another way', () => switchForm(false))}
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

              {appleAvailable ? (
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                  buttonStyle={
                    isDark
                      ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                      : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                  }
                  cornerRadius={12}
                  style={{ height: 48, opacity: busy !== null ? 0.5 : 1 }}
                  onPress={() => {
                    if (busy === null) void handleApple();
                  }}
                />
              ) : null}

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

              {PASSWORD_SIGN_IN_ENABLED
                ? textLink('Have a test account? Sign in with a password', () => switchForm(true))
                : null}
            </View>
          )}

          {error ? (
            <Text style={{ color: colors.danger, fontSize: 13 }} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}

          <LegalLinks intro="By continuing you agree to our Terms and acknowledge our Privacy Policy." />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
