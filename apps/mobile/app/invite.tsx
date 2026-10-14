import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ROLE_LABEL,
  formatDate,
  formatInviteCode,
  isPlausibleInviteCode,
  isRedeemSuccess,
  normalizeInviteCode,
  normalizeRole,
  redeemMessage,
  type Role,
} from '@compences/core';
import { useAuth } from '../src/lib/auth';
import { supabase } from '../src/lib/supabase';
import { Body, Button, Caption, Card, Heading, Input, Screen, Title } from '../src/components/ui';
import { ErrorText } from '../src/components/admin-ui';
import { spacing } from '../src/lib/theme';

type Preview = {
  communityName: string;
  role: string;
  unitLabel: string | null;
  expiresAt: string | null;
};

/**
 * An invite code, what it is for, and a button that uses it.
 *
 * The society code on the Join screen asks to be let in and waits for staff.
 * This one is already approved: redeeming seats the member immediately, with
 * the role and often the flat the committee chose. That is why it previews
 * first — a code carries no society's name on its face, and this screen is the
 * only chance to notice it is the wrong one before joining it.
 */
export default function Invite() {
  const router = useRouter();
  const { refresh } = useAuth();
  const params = useLocalSearchParams<{ code?: string }>();
  const [code, setCode] = useState(
    typeof params.code === 'string' ? normalizeInviteCode(params.code) : '',
  );
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState<'check' | 'redeem' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const check = async () => {
    const normalized = normalizeInviteCode(code);
    setError(null);
    if (!isPlausibleInviteCode(normalized)) {
      return setError('Enter the invite code your committee sent you.');
    }
    setBusy('check');
    const { data, error: rpcError } = await supabase.rpc('preview_invite_code', {
      p_code: normalized,
    });
    setBusy(null);
    if (rpcError) return setError('We could not check that code. Please try again.');

    const row = data?.[0];
    // preview and redeem share one vocabulary of statuses and one set of
    // sentences, so the two steps cannot describe the same code differently.
    if (!row || row.status !== 'ok') return setError(redeemMessage(row?.status ?? 'not_found'));

    setPreview({
      communityName: row.community_name ?? 'your society',
      role: normalizeRole(row.role) ?? 'resident',
      unitLabel: row.unit_label,
      expiresAt: row.expires_at,
    });
  };

  const redeem = async () => {
    setError(null);
    setBusy('redeem');
    const { data, error: rpcError } = await supabase.rpc('redeem_invite_code', {
      p_code: normalizeInviteCode(code),
      p_channel: 'mobile',
    });
    setBusy(null);
    if (rpcError) return setError(rpcError.message);

    const row = data?.[0];
    // A null status is not a success. The generated types allow one and the
    // function never returns one; guessing either way is how a failed
    // redemption would read as a join.
    if (!row || !isRedeemSuccess(row.status ?? '')) {
      return setError(redeemMessage(row?.status ?? 'not_found'));
    }

    // The membership is new, so the session's cached list is now stale.
    await refresh();
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
          {preview ? (
            <>
              <Title>{preview.communityName}</Title>
              <Card style={{ gap: spacing.sm }}>
                <Heading>Joining as {ROLE_LABEL[preview.role as Role] ?? 'Resident'}</Heading>
                {preview.unitLabel ? (
                  <Body muted>Flat {preview.unitLabel} will be yours.</Body>
                ) : null}
                {preview.expiresAt ? (
                  <Caption>Valid until {formatDate(preview.expiresAt.slice(0, 10))}</Caption>
                ) : null}
              </Card>
              <Button
                label={`Join ${preview.communityName}`}
                onPress={() => void redeem()}
                loading={busy === 'redeem'}
              />
              <Button
                label="Use a different code"
                variant="secondary"
                onPress={() => {
                  setPreview(null);
                  setError(null);
                }}
              />
              <Caption>
                This code admits you straight away. If this isn’t your society, don’t use it.
              </Caption>
              <ErrorText message={error} />
            </>
          ) : (
            <>
              <Title>Use your invite code</Title>
              <Body muted>A personal code from your committee. It lets you in straight away.</Body>
              <View style={{ gap: spacing.xs }}>
                <Input
                  label="Invite code"
                  value={code}
                  onChangeText={(next) => setCode(next.toUpperCase())}
                  placeholder="K7MQ-3XPB"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  autoComplete="one-time-code"
                />
                {code && formatInviteCode(code) !== code ? (
                  <Caption>Reads as {formatInviteCode(code)}</Caption>
                ) : null}
              </View>
              <Button
                label="Check this code"
                onPress={() => void check()}
                loading={busy === 'check'}
              />
              <Button
                label="I only have the society code"
                variant="secondary"
                onPress={() => router.replace('/join')}
              />
              <ErrorText message={error} />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
