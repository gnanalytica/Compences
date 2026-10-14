import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDate, joinMessage, normalizeJoinCode, unitLabel } from '@compences/core';
import { useAuth } from '../src/lib/auth';
import { supabase } from '../src/lib/supabase';
import {
  Badge,
  Body,
  Button,
  Caption,
  Card,
  Heading,
  Input,
  Loading,
  Screen,
  Title,
} from '../src/components/ui';
import { Chip, ChipRow, ErrorText } from '../src/components/admin-ui';
import { spacing } from '../src/lib/theme';

const RELATIONS = [
  { value: 'owner', label: 'Owner' },
  { value: 'tenant', label: 'Tenant' },
  { value: 'family', label: 'Family member' },
  // Supervisors and facility managers have no flat; the committee admits them
  // as staff.
  { value: 'other', label: 'I work for the society' },
] as const;

type Relation = (typeof RELATIONS)[number]['value'];
type Unit = { id: string; block: string | null; number: string };

/**
 * One way in: the society code the committee shares, plus a few details.
 *
 * Nothing is sent until the details are complete, so staff never see a
 * half-filled request. A join link (compences://join/CODE, or ?code=CODE) fills
 * in the code and looks up the flats straight away. The request then waits for staff or the committee;
 * until they admit it the app shows only this pending screen.
 */
export default function Join() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, refresh, signOut, memberships } = useAuth();
  const params = useLocalSearchParams<{ code?: string }>();
  const linkedCode = typeof params.code === 'string' ? normalizeJoinCode(params.code) : '';

  const [step, setStep] = useState<'code' | 'details'>('code');
  const [editing, setEditing] = useState(false);
  const [code, setCode] = useState(linkedCode);
  const [name, setName] = useState(user?.user_metadata?.full_name ?? '');
  const [phone, setPhone] = useState('');
  const [units, setUnits] = useState<Unit[]>([]);
  const [block, setBlock] = useState<string | null>(null);
  const [flatQuery, setFlatQuery] = useState('');
  const [unitId, setUnitId] = useState<string | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [relation, setRelation] = useState<Relation>('owner');
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Looks the code up and moves to the details step. Declared before any early
  // return so the join-link effect below can call it.
  const lookUpCode = useCallback(async (raw: string) => {
    const normalized = normalizeJoinCode(raw);
    if (normalized.length < 4) {
      setError('Enter the society code your committee shared.');
      return;
    }
    setLookingUp(true);
    setError(null);
    // A valid code returns the society's flats; a wrong one returns nothing and
    // counts toward the same attempt limit as a join request.
    const { data, error: rpcError } = await supabase.rpc('society_units', {
      p_join_code: normalized,
    });
    setLookingUp(false);
    if (rpcError) {
      setError(
        /too many/i.test(rpcError.message)
          ? rpcError.message
          : 'We could not check that code. Please try again.',
      );
      return;
    }
    const rows = (data ?? []).filter((row): row is Unit => Boolean(row.id) && Boolean(row.number));
    if (!rows.length) {
      setError(joinMessage('not_found'));
      return;
    }
    setUnits(rows);
    const blocks = [...new Set(rows.map((row) => row.block ?? ''))];
    setBlock(blocks.length === 1 ? (blocks[0] ?? null) : null);
    setUnitId((current) => (rows.some((row) => row.id === current) ? current : null));
    setStep('details');
  }, []);

  // Opened from a join link: look the code up once.
  const linkHandled = useRef<string | null>(null);
  useEffect(() => {
    if (!linkedCode || !user?.id || linkHandled.current === linkedCode) return;
    linkHandled.current = linkedCode;
    void lookUpCode(linkedCode);
  }, [linkedCode, user?.id, lookUpCode]);

  const latest = useQuery({
    queryKey: ['join:latest', user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data } = await supabase
        .from('join_requests')
        .select('id, claimed_name, claimed_phone, relation, status, decline_reason, created_at')
        .eq('user_id', user?.id ?? '')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const checkAgain = async () => {
    setChecking(true);
    await refresh();
    await latest.refetch();
    setChecking(false);
  };

  if (latest.isPending && user?.id) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  const request = latest.data;
  const admitted = memberships.length > 0;

  if (request?.status === 'pending' && !editing) {
    return (
      <Screen>
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            padding: spacing.xl,
            gap: spacing.lg,
          }}
          refreshControl={<RefreshControl refreshing={checking} onRefresh={checkAgain} />}
        >
          <Card style={{ gap: spacing.md, paddingVertical: spacing.xl }}>
            <View style={{ flexDirection: 'row' }}>
              <Badge label="Waiting for approval" tone="warning" />
            </View>
            <Title>Your request is with the society</Title>
            <Body muted>Staff or the committee will check your details and admit you.</Body>
            <View style={{ gap: 2 }}>
              <Caption>SENT {formatDate(request.created_at.slice(0, 10)).toUpperCase()}</Caption>
              <Body>{request.claimed_name}</Body>
              <Caption>
                {RELATIONS.find((item) => item.value === request.relation)?.label ??
                  request.relation}
                {request.claimed_phone ? ` · ${request.claimed_phone}` : ''}
              </Caption>
            </View>
          </Card>
          <Button label="Check again" onPress={() => void checkAgain()} loading={checking} />
          {admitted ? (
            <Button
              label="Back to my community"
              variant="secondary"
              onPress={() => router.replace('/(tabs)')}
            />
          ) : null}
          <Button
            label="Change my details"
            variant="secondary"
            onPress={() => {
              setEditing(true);
              setStep('code');
            }}
          />
          <Button label="Sign out" variant="secondary" onPress={() => void signOut()} />
        </ScrollView>
      </Screen>
    );
  }

  const continueToDetails = () => lookUpCode(code);

  const submit = async () => {
    // Same normalisation as the web app: a 10-digit Indian mobile gets +91.
    const digits = phone.replace(/[\s-]/g, '');
    const cleanPhone = /^[6-9]\d{9}$/.test(digits) ? `+91${digits}` : digits;
    if (name.trim().length < 2) {
      setError('Enter your full name.');
      return;
    }
    if (!/^\+?[0-9]{7,15}$/.test(cleanPhone)) {
      setError('Enter a valid phone number.');
      return;
    }
    const worksHere = relation === 'other';
    if (!unitId && !worksHere) {
      setError('Pick your flat, or choose “I work for the society”.');
      return;
    }
    setBusy(true);
    setError(null);

    const { data, error: rpcError } = await supabase.rpc('request_to_join', {
      p_join_code: normalizeJoinCode(code),
      p_unit_id: worksHere ? undefined : (unitId ?? undefined),
      p_name: name.trim(),
      p_phone: cleanPhone,
      p_relation: relation,
    });
    setBusy(false);

    const status = data?.[0]?.status;
    if (rpcError || !status) {
      setError('We could not send that request. Please try again.');
      return;
    }
    if (status === 'already_member') {
      await refresh();
      router.replace('/(tabs)');
      return;
    }
    if (status !== 'pending') {
      setError(joinMessage(status));
      if (status === 'not_found') setStep('code');
      return;
    }

    await supabase.auth.updateUser({ data: { full_name: name.trim() } });
    setEditing(false);
    await queryClient.invalidateQueries({ queryKey: ['join:latest'] });
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
            <Title>Join your society</Title>
            <Body muted>
              {step === 'code'
                ? 'Enter the society code your committee shared.'
                : 'Staff check these details before letting you in.'}
            </Body>
          </View>

          {request?.status === 'rejected' && !editing ? (
            <Card style={{ gap: spacing.xs }}>
              <Heading>Your last request was declined</Heading>
              <Body muted>
                {request.decline_reason ?? 'Check your details with the committee and try again.'}
              </Body>
            </Card>
          ) : null}

          {step === 'code' ? (
            <Card style={{ gap: spacing.md }}>
              <Input
                label="Society code"
                value={code}
                onChangeText={(value) => setCode(value.toUpperCase())}
                placeholder="VJ4FQW"
                autoCapitalize="characters"
                autoCorrect={false}
                style={{ textAlign: 'center', letterSpacing: 3, fontSize: 18 }}
              />
              <Button
                label="Continue"
                onPress={() => void continueToDetails()}
                loading={lookingUp}
              />
              {/* The other way in. A code addressed to one resident admits them
                  without a request, so it does not belong on this form. */}
              <Button
                label="I was sent an invite code instead"
                variant="secondary"
                onPress={() => router.push('/invite')}
              />
            </Card>
          ) : (
            <Card style={{ gap: spacing.lg }}>
              <View style={{ gap: 2 }}>
                <Caption>SOCIETY CODE</Caption>
                <Heading>{normalizeJoinCode(code)}</Heading>
              </View>
              <Input label="Full name" value={name} onChangeText={setName} autoCapitalize="words" />
              <Input
                label="Phone"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="9876543210"
              />
              {relation === 'other' ? (
                <Caption>
                  No flat needed. The committee sets your role when they approve you.
                </Caption>
              ) : (
                <FlatPicker
                  units={units}
                  block={block}
                  onBlock={setBlock}
                  query={flatQuery}
                  onQuery={setFlatQuery}
                  unitId={unitId}
                  onPick={setUnitId}
                />
              )}
              <View style={{ gap: spacing.sm }}>
                <Body>You are the</Body>
                <ChipRow>
                  {RELATIONS.map((item) => (
                    <Chip
                      key={item.value}
                      label={item.label}
                      selected={relation === item.value}
                      onPress={() => setRelation(item.value)}
                    />
                  ))}
                </ChipRow>
                <Caption>
                  Several people from one flat can each join with their own account.
                </Caption>
              </View>
              <Button label="Send request" onPress={() => void submit()} loading={busy} />
              <Button
                label="Change society code"
                variant="secondary"
                onPress={() => setStep('code')}
                disabled={busy}
              />
            </Card>
          )}

          <ErrorText message={error} />

          {step === 'code' && !editing ? (
            <View style={{ gap: spacing.sm }}>
              <Caption>
                Society not on Compences yet? Start it and become its first committee member.
              </Caption>
              <Button
                label="Start a new society"
                variant="secondary"
                onPress={() => router.push('/found')}
              />
            </View>
          ) : null}

          {editing ? (
            <Button label="Cancel" variant="secondary" onPress={() => setEditing(false)} />
          ) : admitted ? (
            <Button
              label="Back to my community"
              variant="secondary"
              onPress={() => router.replace('/(tabs)')}
            />
          ) : (
            <Button label="Sign out" variant="secondary" onPress={() => void signOut()} />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

/**
 * Picks one flat out of a few hundred: choose the tower, then type to narrow
 * the flat numbers. Shows at most 60 matches so the list stays quick.
 */
function FlatPicker({
  units,
  block,
  onBlock,
  query,
  onQuery,
  unitId,
  onPick,
}: {
  units: Unit[];
  block: string | null;
  onBlock: (block: string | null) => void;
  query: string;
  onQuery: (query: string) => void;
  unitId: string | null;
  onPick: (unitId: string | null) => void;
}) {
  const chosen = units.find((unit) => unit.id === unitId);
  const blocks = [...new Set(units.map((unit) => unit.block ?? ''))].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );

  if (chosen) {
    return (
      <View style={{ gap: spacing.sm }}>
        <Body>Your flat</Body>
        <ChipRow>
          <Chip label={`Flat ${unitLabel(chosen)}`} selected onPress={() => onPick(null)} />
          <Chip label="Change" onPress={() => onPick(null)} />
        </ChipRow>
      </View>
    );
  }

  const needle = query.trim().toUpperCase().replace(/[\s-]/g, '');
  const matches = units
    .filter((unit) => block === null || (unit.block ?? '') === block)
    .filter(
      (unit) => !needle || unitLabel(unit).toUpperCase().replace(/[\s-]/g, '').includes(needle),
    )
    .sort((a, b) => unitLabel(a).localeCompare(unitLabel(b), undefined, { numeric: true }));

  return (
    <View style={{ gap: spacing.sm }}>
      <Body>Your flat</Body>
      {blocks.length > 1 ? (
        <ChipRow>
          {blocks.map((value) => (
            <Chip
              key={value || 'none'}
              label={value ? `Tower ${value}` : 'No tower'}
              selected={block === value}
              onPress={() => onBlock(block === value ? null : value)}
            />
          ))}
        </ChipRow>
      ) : null}
      <Input
        value={query}
        onChangeText={onQuery}
        placeholder={block ? `Flat number in Tower ${block}` : 'Type your flat, e.g. A1104'}
        autoCapitalize="characters"
        autoCorrect={false}
      />
      {matches.length ? (
        <ChipRow>
          {matches.slice(0, 60).map((unit) => (
            <Chip key={unit.id} label={unitLabel(unit)} onPress={() => onPick(unit.id)} />
          ))}
        </ChipRow>
      ) : (
        <Caption>No flat matches. Check the tower and number.</Caption>
      )}
      {matches.length > 60 ? (
        <Caption>Showing 60 of {matches.length}. Pick a tower or type your flat number.</Caption>
      ) : null}
    </View>
  );
}
