import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { can, formatMoney, societyExpenseSchema, societyProofPath } from '@compences/core';
import { useAuth } from '../../src/lib/auth';
import { supabase } from '../../src/lib/supabase';
import { fetchSocietyBalance } from '../../src/lib/events';
import { uploadFile, type PickedFile } from '../../src/lib/storage';
import {
  Body,
  Button,
  Caption,
  Card,
  EmptyState,
  Input,
  Loading,
  Screen,
  Title,
} from '../../src/components/ui';
import { DateField, today } from '../../src/components/date-field';
import { FilePickerField } from '../../src/components/file-ui';
import { ErrorText } from '../../src/components/admin-ui';
import { spacing } from '../../src/lib/theme';

/**
 * Staff or the committee record money the society spent from its own balance:
 * a repair, damage, anything that is not an event's. Every field is required,
 * the receipt included, and every resident sees the entry on the Money tab.
 */
export default function SocietySpend() {
  const { role, activeCommunity } = useAuth();
  const balance = useQuery({
    queryKey: ['society-balance', activeCommunity?.id],
    queryFn: () => fetchSocietyBalance(activeCommunity!.id),
    enabled: Boolean(activeCommunity),
  });

  if (!can(role, 'expenses:submit') || !activeCommunity) {
    return (
      <Screen>
        <EmptyState title="Staff and the committee only" />
      </Screen>
    );
  }
  if (!balance.data) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }
  return (
    <Form
      communityId={activeCommunity.id}
      currency={activeCommunity.currency ?? 'INR'}
      balance={balance.data.balance}
    />
  );
}

function Form({
  communityId,
  currency,
  balance,
}: {
  communityId: string;
  currency: string;
  balance: number;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const [paidTo, setPaidTo] = useState('');
  const [amount, setAmount] = useState('');
  const [spentOn, setSpentOn] = useState<string | null>(today());
  const [receipt, setReceipt] = useState<PickedFile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const parsed = societyExpenseSchema.safeParse({
      amount: amount.replace(/[^0-9.]/g, ''),
      reason,
      paid_to: paidTo,
      spent_on: spentOn ?? '',
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the details.');
      return;
    }
    if (!receipt) {
      setError('Attach the bill or a screenshot of the payment.');
      return;
    }
    if (parsed.data.amount > balance) {
      setError(`The society balance holds ${formatMoney(balance, currency)}.`);
      return;
    }
    setBusy(true);
    setError(null);
    const uploaded = await uploadFile(
      'bills',
      societyProofPath(communityId, receipt.name),
      receipt,
    );
    if ('error' in uploaded) {
      setBusy(false);
      setError(uploaded.error);
      return;
    }
    const { error: saveError } = await supabase.rpc('record_society_expense', {
      p_community_id: communityId,
      p_amount: parsed.data.amount,
      p_reason: parsed.data.reason,
      p_paid_to: parsed.data.paid_to,
      p_proof_path: uploaded.path,
      p_spent_on: parsed.data.spent_on,
    });
    setBusy(false);
    if (saveError) {
      // The receipt belongs to spending that was never recorded.
      void supabase.storage.from('bills').remove([uploaded.path]);
      setError(saveError.message);
      return;
    }
    await queryClient.invalidateQueries();
    router.back();
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
          <View style={{ gap: 2 }}>
            <Title>Spend from the society balance</Title>
            <Caption>
              For a repair, damage or anything that is not an event&rsquo;s. Every resident sees it
              on the Money tab, with the receipt.
            </Caption>
          </View>
          {balance <= 0 ? (
            <Card>
              <Body muted>
                The society balance is empty, so there is nothing to spend from yet.
              </Body>
            </Card>
          ) : (
            <Card style={{ gap: spacing.lg }}>
              <Caption>The society balance holds {formatMoney(balance, currency)}.</Caption>
              <Input
                label="What for"
                value={reason}
                onChangeText={setReason}
                placeholder="Gate motor repair"
              />
              <Input
                label="Paid to"
                value={paidTo}
                onChangeText={setPaidTo}
                placeholder="Sri Ram Electricals"
              />
              <Input
                label="Amount (₹)"
                value={amount}
                onChangeText={setAmount}
                keyboardType="number-pad"
              />
              <DateField label="Paid on" value={spentOn} onChange={setSpentOn} />
              <FilePickerField
                label="Bill or payment screenshot (required)"
                file={receipt}
                onChange={setReceipt}
                existingLabel="Every resident can open it."
              />
              <ErrorText message={error} />
              <Button label="Record spending" onPress={() => void save()} loading={busy} />
            </Card>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
