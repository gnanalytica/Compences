import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import {
  DELETE_ACCOUNT_CONFIRMATION,
  DELETE_ACCOUNT_EFFECTS,
  DELETE_ACCOUNT_KEPT,
  deleteAccountMessage,
  isAccountDeleted,
  isDeleteConfirmed,
} from '@compences/core';
import { useAuth } from '../src/lib/auth';
import { supabase } from '../src/lib/supabase';
import { reportHandled } from '../src/lib/observability';
import { Body, Button, Caption, Card, Heading, Input, Screen, Title } from '../src/components/ui';
import { ErrorText } from '../src/components/admin-ui';
import { spacing } from '../src/lib/theme';

/**
 * The way out, on the phone.
 *
 * Google Play has required this path since May 2024 and Apple asks for it in
 * guideline 5.1.1(v), so it is not optional — but it is also the only
 * irreversible thing a resident can do to themselves, which is why it reads
 * the way it does. What goes and what stays are listed before the field, not
 * after it, and the field asks for a word rather than a tap: a destructive
 * button on a phone is one thumb away from a mis-tap on the bus.
 *
 * The rules all live in the database function; the same ones answer the web.
 */
export default function DeleteAccount() {
  const router = useRouter();
  const { signOut } = useAuth();
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    setError(null);
    setBusy(true);
    const { data, error: rpcError } = await supabase.rpc('delete_my_account');
    setBusy(false);

    if (rpcError) {
      reportHandled(rpcError, 'deleting an account');
      return setError('We could not delete your account. Please try again.');
    }

    const row = data?.[0];
    // A null status is not a success. The generated type allows one and the
    // function never returns one; guessing either way is how a refused
    // deletion would sign somebody out and tell them their account is gone.
    if (!row || !isAccountDeleted(row.status ?? '')) {
      return setError(deleteAccountMessage(row?.status ?? '', row?.detail));
    }

    // The session's user no longer exists, so the stored token is now a token
    // for nobody. Clearing it is what stops the app reopening signed in.
    await signOut();
    router.replace('/');
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
          keyboardShouldPersistTaps="handled"
        >
          <Title>Delete your account</Title>
          <Body muted>This can’t be undone.</Body>

          <Card style={{ gap: spacing.xs }}>
            <Heading>This deletes</Heading>
            {DELETE_ACCOUNT_EFFECTS.map((line) => (
              <Caption key={line}>{`•  ${line}`}</Caption>
            ))}
          </Card>

          <Card style={{ gap: spacing.xs }}>
            <Heading>What stays</Heading>
            {DELETE_ACCOUNT_KEPT.map((line) => (
              <Caption key={line}>{`•  ${line}`}</Caption>
            ))}
          </Card>

          <Input
            label={`Type ${DELETE_ACCOUNT_CONFIRMATION} to confirm`}
            value={typed}
            onChangeText={setTyped}
            autoCapitalize="characters"
            autoCorrect={false}
          />

          <Button
            label="Delete my account"
            onPress={() => void remove()}
            loading={busy}
            disabled={!isDeleteConfirmed(typed)}
          />
          <Button label="Keep my account" variant="secondary" onPress={() => router.back()} />

          <ErrorText message={error} />

          <Caption>
            Last committee member of a society with other members? Make someone else a committee
            member first, from People.
          </Caption>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
