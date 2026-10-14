import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  foundSocietyMessage,
  foundSocietySchema,
  isFlatLabel,
  societySlug,
  splitFlat,
} from '@compences/core';
import { useAuth } from '../src/lib/auth';
import { supabase } from '../src/lib/supabase';
import { Body, Button, Caption, Card, Input, Screen, Title } from '../src/components/ui';
import { ErrorText } from '../src/components/admin-ui';
import { spacing } from '../src/lib/theme';

/**
 * Starting a society, for the committee member who has nobody to give them a
 * code. The web app asks the same questions on /onboarding?mode=create.
 *
 * create_society() decides the web address, the Society code and the founder,
 * so nothing here can claim a society that already exists. Everything else —
 * flats, the catalogue, the UPI ID — waits for the setup checklist.
 */
export default function Found() {
  const router = useRouter();
  const { refresh, setActiveCommunity } = useAuth();

  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [flat, setFlat] = useState('');
  const [address, setAddress] = useState('');
  const [pincode, setPincode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preview = name.trim() ? societySlug(name) : '';

  const submit = async () => {
    const parsed = foundSocietySchema.safeParse({ name, city, address, pincode, phone, flat });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the details and try again.');
      return;
    }

    setBusy(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc('create_society', {
      p_name: parsed.data.name,
      p_city: parsed.data.city,
      p_address: parsed.data.address,
      p_pincode: parsed.data.pincode,
      p_phone: parsed.data.phone,
      p_flat: parsed.data.flat,
    });
    setBusy(false);

    const row = data?.[0];
    if (rpcError || row?.status !== 'ok' || !row.community_id) {
      setError(foundSocietyMessage(row?.status ?? ''));
      return;
    }

    // Become a member of it before routing, so the tabs do not bounce back to
    // the join screen. The welcome screen greets the new committee member.
    await refresh();
    setActiveCommunity(row.community_id);
    router.replace('/(tabs)');
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ gap: 2 }}>
            <Title>Start your society</Title>
            <Body muted>
              A few details now. Flats, categories and your UPI ID come next, on a setup checklist.
            </Body>
          </View>

          <Card style={{ gap: spacing.lg }}>
            <View style={{ gap: spacing.xs }}>
              <Input
                label="Society name"
                value={name}
                onChangeText={setName}
                placeholder="Shraddha Whitecliff"
                autoCapitalize="words"
                maxLength={120}
              />
              <Caption>
                {preview
                  ? `Residents will find it at /app/${preview}`
                  : 'As it appears on the gate.'}
              </Caption>
            </View>

            <Input
              label="City"
              value={city}
              onChangeText={setCity}
              placeholder="Bengaluru"
              autoCapitalize="words"
              maxLength={80}
            />

            <View style={{ gap: spacing.xs }}>
              <Input
                label="Your phone number"
                value={phone}
                onChangeText={setPhone}
                placeholder="98450 10101"
                keyboardType="phone-pad"
                autoCapitalize="none"
                maxLength={20}
              />
              <Caption>Only staff and the committee see it.</Caption>
            </View>

            {/* Every resident is asked which flat they live in; the founder
                never was, and ended up the one member of a society who lived
                nowhere. That is why their own payments reached the ledger with
                no flat beside them. */}
            <View style={{ gap: spacing.xs }}>
              <Input
                label="Your flat"
                value={flat}
                onChangeText={setFlat}
                placeholder="A 703"
                autoCapitalize="characters"
                maxLength={24}
              />
              {/* How it was read, shown back: "G01" and "B G01" are the same
                  letters and different flats, and a space is what settles it. */}
              <Caption>
                {flat.trim() && isFlatLabel(flat)
                  ? splitFlat(flat).block
                    ? `Tower ${splitFlat(flat).block}, flat ${splitFlat(flat).number}`
                    : `Flat ${splitFlat(flat).number}, no tower`
                  : 'As it is on your door. Leave blank if you don’t live here.'}
              </Caption>
            </View>

            <View style={{ gap: spacing.xs }}>
              <Input
                label="Address"
                value={address}
                onChangeText={setAddress}
                placeholder="Seegehalli, Whitefield"
                maxLength={300}
              />
              <Caption>Optional.</Caption>
            </View>

            <Input
              label="PIN code"
              value={pincode}
              onChangeText={setPincode}
              placeholder="560067"
              keyboardType="number-pad"
              maxLength={6}
            />

            <Button label="Create the society" onPress={() => void submit()} loading={busy} />
            <Caption>
              You become the first committee member, with a society code to share with residents.
            </Caption>
          </Card>

          <ErrorText message={error} />

          <Button
            label="I have a society code"
            variant="secondary"
            onPress={() => router.replace('/join')}
            disabled={busy}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
