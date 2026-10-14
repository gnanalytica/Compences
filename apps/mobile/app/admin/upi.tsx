import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { can, upiVpaSchema } from '@compences/core';
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
import { ErrorText } from '../../src/components/admin-ui';
import { spacing } from '../../src/lib/theme';

/**
 * The UPI ID residents pay into. Committee only: whoever controls this decides
 * where every contribution lands, so staff cannot change it (the database
 * enforces that too).
 */
export default function SocietyUpi() {
  const { role, activeCommunity } = useAuth();

  if (!can(role, 'roles:manage') || !activeCommunity) {
    return (
      <Screen>
        <EmptyState title="Committee only" />
      </Screen>
    );
  }

  return (
    <Form
      key={activeCommunity.id}
      communityId={activeCommunity.id}
      initialVpa={activeCommunity.upi_vpa ?? ''}
      initialPayee={activeCommunity.upi_payee_name ?? activeCommunity.name}
    />
  );
}

function Form({
  communityId,
  initialVpa,
  initialPayee,
}: {
  communityId: string;
  initialVpa: string;
  initialPayee: string;
}) {
  const router = useRouter();
  const { refresh } = useAuth();
  const [vpa, setVpa] = useState(initialVpa);
  const [payee, setPayee] = useState(initialPayee);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const parsed = upiVpaSchema.safeParse(vpa);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Enter a valid UPI ID.');
      return;
    }
    const name = payee.trim();
    if (!name || name.length > 80) {
      setError('Enter the account name residents will see, up to 80 characters.');
      return;
    }
    setBusy(true);
    setError(null);
    const { data, error: saveError } = await supabase
      .from('communities')
      .update({ upi_vpa: parsed.data, upi_payee_name: name })
      .eq('id', communityId)
      .select('id');
    setBusy(false);
    if (saveError || !data?.length) {
      setError(saveError?.message ?? 'Only the committee can change the society’s UPI ID.');
      return;
    }
    // The society row lives in the auth context; reload it so Contribute
    // picks up the new UPI ID straight away.
    await refresh();
    router.back();
  };

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
            <Title>Society UPI ID</Title>
            <Caption>
              Residents pay this ID from their UPI app, with no gateway or fee. Staff confirm each
              payment against the bank statement.
            </Caption>
          </View>
          <Card style={{ gap: spacing.lg }}>
            <Input
              label="UPI ID"
              value={vpa}
              onChangeText={setVpa}
              placeholder="whitecliffrwa@okaxis"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
            />
            <Input
              label="Account name"
              value={payee}
              onChangeText={setPayee}
              placeholder="Whitecliff Residents Welfare Association"
            />
            <Body muted>
              Use the association’s own bank account where you can. Personal UPI IDs have daily
              limits and banks may question many incoming payments.
            </Body>
          </Card>
          <ErrorText message={error} />
          <Button label="Save" onPress={() => void save()} loading={busy} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
