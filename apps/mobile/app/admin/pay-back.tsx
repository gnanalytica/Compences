import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { can, coverOverspendSchema, formatMoney, societyProofPath } from '@compences/core';
import { useAuth } from '../../src/lib/auth';
import { supabase } from '../../src/lib/supabase';
import { fetchSocietyBalance } from '../../src/lib/events';
import { invalidateAfterDecision } from '../../src/lib/todo';
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
import { FilePickerField } from '../../src/components/file-ui';
import { ErrorText } from '../../src/components/admin-ui';
import { spacing } from '../../src/lib/theme';

/**
 * The committee pays back somebody who covered an event's overspend, from the
 * society balance, with the screenshot of the transfer attached. Residents
 * see it, so they know people who pay out of their own pocket get paid back.
 * What the balance cannot cover stays in To do until it can.
 */
export default function PayBack() {
  const { role, activeCommunity } = useAuth();
  const params = useLocalSearchParams<{
    event: string;
    name?: string;
    over?: string;
    payer?: string;
  }>();
  const balance = useQuery({
    queryKey: ['society-balance', activeCommunity?.id],
    queryFn: () => fetchSocietyBalance(activeCommunity!.id),
    enabled: Boolean(activeCommunity),
  });

  if (!can(role, 'expenses:approve') || !activeCommunity || !params.event) {
    return (
      <Screen>
        <EmptyState title="Committee only" />
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
      eventId={params.event}
      eventName={params.name ?? 'This event'}
      overBy={Number(params.over ?? 0)}
      balance={balance.data.balance}
      payer={params.payer ?? ''}
    />
  );
}

function Form({
  communityId,
  currency,
  eventId,
  eventName,
  overBy,
  balance,
  payer,
}: {
  communityId: string;
  currency: string;
  eventId: string;
  eventName: string;
  overBy: number;
  balance: number;
  payer: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const canCover = Math.floor(Math.min(overBy, balance));
  const [paidTo, setPaidTo] = useState(payer);
  const [amount, setAmount] = useState(canCover > 0 ? String(canCover) : '');
  const [note, setNote] = useState('');
  const [proof, setProof] = useState<PickedFile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const parsed = coverOverspendSchema.safeParse({
      event_id: eventId,
      amount: amount.replace(/[^0-9.]/g, ''),
      paid_to: paidTo,
      note: note.trim() || undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the details.');
      return;
    }
    if (!proof) {
      setError('Attach the screenshot of the transfer.');
      return;
    }
    setBusy(true);
    setError(null);
    const uploaded = await uploadFile('bills', societyProofPath(communityId, proof.name), proof);
    if ('error' in uploaded) {
      setBusy(false);
      setError(uploaded.error);
      return;
    }
    const { error: saveError } = await supabase.rpc('cover_overspend', {
      p_event_id: eventId,
      p_amount: parsed.data.amount,
      p_paid_to: parsed.data.paid_to,
      p_proof_path: uploaded.path,
      p_note: parsed.data.note,
    });
    setBusy(false);
    if (saveError) {
      // The screenshot belongs to a pay-back that never happened.
      void supabase.storage.from('bills').remove([uploaded.path]);
      setError(saveError.message);
      return;
    }
    await invalidateAfterDecision(queryClient);
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
            <Title>Pay back</Title>
            <Caption>
              {eventName} spent {formatMoney(overBy, currency)} more than it collected. Somebody
              paid the difference out of their own pocket.
            </Caption>
          </View>

          {canCover <= 0 ? (
            <Card>
              <Body muted>
                The society balance is empty, so this waits in To do. Once an event&rsquo;s leftover
                is kept for the society, pay it back from here.
              </Body>
            </Card>
          ) : (
            <Card style={{ gap: spacing.lg }}>
              <Caption>
                {canCover < overBy
                  ? `The society balance holds ${formatMoney(balance, currency)}, so you can pay back that much now. The rest stays in To do.`
                  : `The society balance holds ${formatMoney(balance, currency)}, enough to pay it all back.`}
              </Caption>
              <Input label="Paid back to" value={paidTo} onChangeText={setPaidTo} />
              <Input
                label="Amount (₹)"
                value={amount}
                onChangeText={setAmount}
                keyboardType="number-pad"
              />
              <Input
                label="Note (optional)"
                value={note}
                onChangeText={setNote}
                placeholder="Sound system, paid by UPI"
              />
              <FilePickerField
                label="Screenshot of the transfer (required)"
                file={proof}
                onChange={setProof}
                existingLabel="Residents can open it, so they know the committee pays people back."
                allowPdf={false}
              />
              <ErrorText message={error} />
              <Button label="Pay back" onPress={() => void save()} loading={busy} />
            </Card>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
