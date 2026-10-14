import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { can } from '@compences/core';
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

/** The society's name and address as residents see them. Committee only. */
export default function SocietyDetails() {
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
      code={activeCommunity.join_code}
      initial={{
        name: activeCommunity.name,
        address: activeCommunity.address ?? '',
        pincode: activeCommunity.pincode ?? '',
        city: activeCommunity.city ?? '',
      }}
    />
  );
}

function Form({
  communityId,
  code,
  initial,
}: {
  communityId: string;
  code: string;
  initial: { name: string; address: string; pincode: string; city: string };
}) {
  const router = useRouter();
  const { refresh } = useAuth();
  const [name, setName] = useState(initial.name);
  const [address, setAddress] = useState(initial.address);
  const [pincode, setPincode] = useState(initial.pincode);
  const [city, setCity] = useState(initial.city);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (name.trim().length < 2 || name.trim().length > 120) {
      setError('Enter the society’s name.');
      return;
    }
    if (address.trim().length < 5) {
      setError('Enter the society’s address, e.g. street and area.');
      return;
    }
    if (address.length > 300) {
      setError('Keep the address under 300 characters.');
      return;
    }
    if (pincode.trim() && !/^[1-9][0-9]{5}$/.test(pincode.trim())) {
      setError('Enter a 6-digit PIN code.');
      return;
    }
    if (city.trim().length < 2) {
      setError('Enter the city.');
      return;
    }
    setBusy(true);
    setError(null);
    const { data, error: saveError } = await supabase
      .from('communities')
      .update({
        name: name.trim(),
        address: address.trim(),
        pincode: pincode.trim() || null,
        city: city.trim(),
      })
      .eq('id', communityId)
      .select('id');
    setBusy(false);
    if (saveError || !data?.length) {
      setError(saveError?.message ?? 'Only the committee can change the society’s details.');
      return;
    }
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
            <Title>Society details</Title>
            <Caption>Residents see these when they join. Society code: {code}</Caption>
          </View>
          <Card style={{ gap: spacing.lg }}>
            <Input label="Society name" value={name} onChangeText={setName} />
            <Input
              label="Address"
              value={address}
              onChangeText={setAddress}
              placeholder="Seegehalli, Whitefield"
              multiline
              style={{ minHeight: 72, textAlignVertical: 'top' }}
            />
            <Input
              label="PIN code"
              value={pincode}
              onChangeText={setPincode}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="560067"
            />
            <Input label="City" value={city} onChangeText={setCity} placeholder="Bengaluru" />
            <Body muted>Only the Compences team can change the society code.</Body>
          </Card>
          <ErrorText message={error} />
          <Button label="Save" onPress={() => void save()} loading={busy} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
