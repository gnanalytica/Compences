import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { CAMPAIGN_EMOJI, can, formatMoney, eventSlug } from '@compences/core';
import { useAuth } from '../../src/lib/auth';
import { supabase } from '../../src/lib/supabase';
import {
  Body,
  Button,
  Caption,
  Card,
  EmptyState,
  Input,
  Screen,
  Title,
} from '../../src/components/ui';
import { DateField, today } from '../../src/components/date-field';
import { ErrorText } from '../../src/components/admin-ui';
import { spacing } from '../../src/lib/theme';

/**
 * A resident proposes a fundraising campaign. It is saved as 'proposed' and
 * nobody but the proposer, staff and the committee sees it until the committee
 * approves it.
 */
export default function NewCampaign() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { role, user, activeCommunity } = useAuth();
  const currency = activeCommunity?.currency ?? 'INR';

  const [name, setName] = useState('');
  const [purpose, setPurpose] = useState('');
  const [target, setTarget] = useState('');
  const [date, setDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  if (!can(role, 'campaigns:propose')) {
    return (
      <Screen>
        <EmptyState
          title="Residents propose campaigns"
          description="Staff run events; campaigns come from residents and the committee."
        />
      </Screen>
    );
  }

  const submit = async () => {
    const amount = Number.parseInt(target.replace(/[^0-9]/g, ''), 10);
    if (name.trim().length < 3) {
      setError('Give the campaign a name.');
      return;
    }
    if (purpose.trim().length < 10) {
      setError('Say what the money is for, in a sentence or two.');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter how much you want to raise.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError('Pick the date the campaign is for.');
      return;
    }
    if (!activeCommunity || !user) return;

    setBusy(true);
    setError(null);
    const { error: insertError } = await supabase.from('events').insert({
      community_id: activeCommunity.id,
      // A short random suffix keeps two campaigns with the same name apart.
      slug: eventSlug(name, Math.random().toString(36).slice(2, 6)),
      emoji: CAMPAIGN_EMOJI,
      name: name.trim(),
      description: purpose.trim(),
      starts_on: date,
      kind: 'campaign',
      status: 'proposed',
      fund_target: amount,
      fund_rule: 'general_fund',
      created_by: user.id,
    });
    setBusy(false);

    if (insertError) {
      setError('That did not go through. Check the date and try again.');
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ['events'] });
    setSent(name.trim());
  };

  if (sent) {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.lg }}>
          <Card style={{ gap: spacing.sm, paddingVertical: spacing.xl }}>
            <Title>Sent to the committee</Title>
            <Body muted>
              “{sent}” is waiting for the committee. Once they approve it, every resident can see it
              and contribute.
            </Body>
          </Card>
          <Button label="Done" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ gap: 2 }}>
            <Title>Start a fundraising campaign</Title>
            <Caption>The committee reviews each campaign before residents can contribute.</Caption>
          </View>

          <Card style={{ gap: spacing.lg }}>
            <Input
              label="Campaign name"
              value={name}
              onChangeText={setName}
              placeholder="New benches for the children’s park"
            />
            <Input
              label="What the money is for"
              value={purpose}
              onChangeText={setPurpose}
              placeholder="Who benefits, what will be bought, and how the surplus is used"
              multiline
            />
            <Input
              label={`Target (${currency})`}
              value={target}
              onChangeText={setTarget}
              keyboardType="number-pad"
              placeholder="40000"
            />
            {Number.parseInt(target, 10) > 0 ? (
              <Caption>
                Asking the society for {formatMoney(Number.parseInt(target, 10), currency)}
              </Caption>
            ) : null}
            <DateField
              label="Date"
              value={date || null}
              onChange={(next) => setDate(next ?? '')}
              minimumDate={today()}
              placeholder="When the money is needed"
            />
          </Card>

          <ErrorText message={error} />
          <Button label="Send for approval" onPress={() => void submit()} loading={busy} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
