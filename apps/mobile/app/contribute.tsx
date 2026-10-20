import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { startActivityAsync } from 'expo-intent-launcher';
import { useQueryClient } from '@tanstack/react-query';
import {
  COPY,
  can,
  contributionPresets,
  countdown,
  formatDate,
  formatMoney,
  fundBarSegments,
  inTheFund,
  newTransactionRef,
  optionalUpiReference,
  parseUpiResponse,
  paymentEvidenceProblem,
  paymentProofPath,
  unitLabel,
  upiNote,
  upiPayUri,
} from '@compences/core';
import { useAuth } from '../src/lib/auth';
import { supabase } from '../src/lib/supabase';
import { fetchEventBySlug, fetchEvents, fetchStats, lookOf } from '../src/lib/events';
import { uploadFile, type PickedFile } from '../src/lib/storage';
import { useCommunityData } from '../src/lib/use-community-data';
import {
  Body,
  Button,
  Caption,
  Card,
  EmptyState,
  Heading,
  Input,
  Loading,
  Screen,
  Title,
} from '../src/components/ui';
import { Chip, ChipRow, ErrorText } from '../src/components/admin-ui';
import { FilePickerField } from '../src/components/file-ui';
import { Meter } from '../src/components/event-ui';
import { FestivalTile } from '../src/components/festival';
import { fonts, radius, spacing } from '../src/lib/theme';
import { useTheme } from '../src/lib/use-theme';

/**
 * Pay the society's UPI ID from any UPI app, then report the UPI reference.
 * There is no gateway: the money goes straight to the society's account, and
 * the payment counts in the event total once staff confirm it against the
 * bank statement.
 *
 * On Android the UPI app is opened for a result, and most apps hand back the
 * payment's status and bank reference; a successful payment is then reported
 * without the resident typing anything. That response comes from the phone,
 * not the bank, so it is still only a report for staff to confirm. iPhones
 * return nothing, so the resident enters the reference there.
 */
export default function Contribute() {
  const { event } = useLocalSearchParams<{ event?: string }>();
  return event ? <ContributeTo eventSlug={event} /> : <ChooseEvent />;
}

/**
 * What the tab bar's Contribute button opens: everything collecting money
 * right now. With only one, there is nothing to ask, so it goes straight there.
 */
function ChooseEvent() {
  const router = useRouter();
  const { colors } = useTheme();
  const { activeCommunity, role } = useAuth();
  const currency = activeCommunity?.currency ?? 'INR';

  const { data, loading } = useCommunityData('contribute:choose', async (communityId) => {
    const open = (await fetchEvents(communityId))
      .filter((event) => event.status === 'published')
      .sort((a, b) => a.starts_on.localeCompare(b.starts_on));
    const stats = await fetchStats(open.map((event) => event.id));
    return open.map((event) => ({ ...event, stats: stats.get(event.id) }));
  });

  if (!can(role, 'contribute')) {
    return (
      <Screen>
        <EmptyState
          title="Staff don’t contribute"
          description="Record a flat’s payment from Manage → Receipts."
        />
      </Screen>
    );
  }

  if (loading && !data) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  const open = data ?? [];
  const only = open.length === 1 ? open[0] : undefined;
  if (only) {
    return <Redirect href={{ pathname: '/contribute', params: { event: only.slug } }} />;
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
        {open.length ? (
          <>
            <Caption>Pick what you’re paying for.</Caption>
            {open.map((event) => {
              const target = event.stats?.fundTarget ?? event.fund_target;
              const held = inTheFund(event.stats?.fundRaised ?? 0, event.stats?.fundCarriedIn ?? 0);
              const bar = fundBarSegments(
                event.stats?.fundRaised ?? 0,
                event.stats?.fundPending ?? 0,
                target,
                event.stats?.fundCarriedIn ?? 0,
              );
              return (
                <Pressable
                  key={event.id}
                  accessibilityRole="button"
                  // Replaced rather than pushed, so Done after paying goes back
                  // to wherever the button was pressed, not to this list.
                  onPress={() =>
                    router.replace({ pathname: '/contribute', params: { event: event.slug } })
                  }
                >
                  <Card style={{ gap: spacing.sm }}>
                    <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
                      <FestivalTile festival={lookOf(event)} size={46} />
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text
                          numberOfLines={2}
                          style={{ color: colors.ink, fontFamily: fonts.serif, fontSize: 18 }}
                        >
                          {event.name}
                        </Text>
                        <Caption>
                          {event.kind === 'campaign' ? 'Fundraising campaign · ' : ''}
                          {formatDate(event.starts_on)}
                          {countdown(event.starts_on) ? ` · ${countdown(event.starts_on)}` : ''}
                        </Caption>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Caption>
                        {formatMoney(held, currency)} of {formatMoney(target, currency)}
                      </Caption>
                      <Caption>{bar.confirmed}%</Caption>
                    </View>
                    <Meter
                      percent={bar.confirmed}
                      pendingPercent={bar.pending}
                      tone="success"
                      label="Fund progress"
                    />
                  </Card>
                </Pressable>
              );
            })}
          </>
        ) : (
          <EmptyState
            title="Nothing is collecting money right now"
            description="When the committee opens an event or a campaign, it shows up here."
          />
        )}
      </ScrollView>
    </Screen>
  );
}

function ContributeTo({ eventSlug }: { eventSlug: string }) {
  const { activeCommunity, membershipId, role } = useAuth();

  const { data, loading } = useCommunityData(
    `contribute:${eventSlug}:${membershipId}`,
    async (communityId) => {
      const [event, flat] = await Promise.all([
        fetchEventBySlug(communityId, String(eventSlug)),
        supabase
          .from('unit_occupants')
          .select('is_primary, units(id, block, number)')
          .eq('membership_id', membershipId ?? '')
          .is('moved_out_on', null)
          .order('is_primary', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      const unit = flat.data?.units ?? null;
      // Only when nobody has listed them at a door. A second round trip on
      // the rare path beats a list of every flat in the society on every one.
      const flats = unit
        ? null
        : await supabase
            .from('units')
            .select('id, block, number')
            .eq('community_id', communityId)
            .order('block')
            .order('number')
            .limit(5000);
      return { event, unit, flats: flats?.data ?? null };
    },
  );

  // Staff are operators and do not contribute; the database refuses it too.
  if (!can(role, 'contribute')) {
    return (
      <Screen>
        <EmptyState
          title="Staff don’t contribute"
          description="Record a flat’s payment from Manage → Receipts."
        />
      </Screen>
    );
  }

  if (loading && !data) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  if (!data?.event || !activeCommunity || !membershipId) {
    return (
      <Screen>
        <EmptyState title="Event not found" />
      </Screen>
    );
  }

  if (!activeCommunity.upi_vpa) {
    return (
      <Screen>
        <EmptyState
          title="Payments aren’t set up yet"
          description="The society has no UPI ID yet. Pay the committee directly and staff will record it against your flat."
        />
      </Screen>
    );
  }

  return (
    <PayWithUpi
      event={data.event}
      unit={data.unit}
      flats={data.flats}
      vpa={activeCommunity.upi_vpa}
      payeeName={activeCommunity.upi_payee_name ?? activeCommunity.name}
    />
  );
}

type Stage = 'amount' | 'report' | 'done';

/** One thing to carry to a UPI app, shown plainly and copied in one tap. */
function CopyRow({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <View style={{ flex: 1, gap: 1 }}>
        <Caption>{label}</Caption>
        <Body>{value}</Body>
      </View>
      <View style={{ width: 104 }}>
        <Button label={copied ? 'Copied' : 'Copy'} variant="secondary" onPress={onCopy} />
      </View>
    </View>
  );
}

/** What the UPI app said about a payment, stored for staff with the report. */
type AppResponse = Record<string, string | null>;

function PayWithUpi({
  event,
  unit,
  flats,
  vpa,
  payeeName,
}: {
  event: { id: string; slug: string; name: string };
  unit: { id: string; block: string | null; number: string } | null;
  /** Every flat in the society, and only when `unit` is null. */
  flats: { id: string; block: string | null; number: string }[] | null;
  vpa: string;
  payeeName: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const { activeCommunity, membershipId } = useAuth();
  const currency = activeCommunity?.currency ?? 'INR';

  // A few round figures to start from; nothing is chosen for the resident,
  // who gives what they choose.
  const presets = contributionPresets(null);

  const [stage, setStage] = useState<Stage>('amount');
  const [amount, setAmount] = useState<number | null>(null);
  const [custom, setCustom] = useState('');
  const [reference, setReference] = useState('');
  const [proof, setProof] = useState<PickedFile | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captured, setCaptured] = useState(false);
  const [copied, setCopied] = useState<'vpa' | 'note' | null>(null);

  const copy = (what: 'vpa' | 'note', value: string) => {
    void Clipboard.setStringAsync(value);
    setCopied(what);
    setTimeout(() => setCopied(null), 2000);
  };

  // Which flat the money is for, asked only when the society has none on
  // record. It has to be settled before they pay, not after: the note they
  // carry into their UPI app is what the committee matches the bank line
  // against, and a note with no flat in it is one more line nobody can place.
  // Narrowed by typing rather than listed, because a society is hundreds of
  // flats and a wall of chips is not a picker.
  const [flatQuery, setFlatQuery] = useState('');
  const [flatId, setFlatId] = useState<string | null>(null);
  const needle = flatQuery.replace(/[^a-z0-9]/gi, '').toUpperCase();
  const found = needle
    ? (flats ?? []).filter((flat) =>
        `${flat.block ?? ''}${flat.number}`
          .replace(/[^a-z0-9]/gi, '')
          .toUpperCase()
          .includes(needle),
      )
    : [];
  const matches = found.slice(0, 24);
  const chosenFlat = flats?.find((flat) => flat.id === flatId) ?? null;
  const flatNeeded = Boolean(flats?.length) && !unit;

  const payingFor = unit ?? chosenFlat;
  const note = upiNote(payingFor ? unitLabel(payingFor) : null, event.name);

  const openUpiApp = async () => {
    if (!amount) return;
    setError(null);
    setNotice(null);
    const transactionRef = newTransactionRef();
    const uri = upiPayUri({ vpa, payeeName, amount, note, transactionRef });
    try {
      if (Platform.OS !== 'android') {
        await Linking.openURL(uri);
        setStage('report');
        return;
      }

      setBusy(true);
      const result = await startActivityAsync('android.intent.action.VIEW', { data: uri });
      setBusy(false);
      const extra = (result.extra ?? {}) as Record<string, unknown>;
      const response = parseUpiResponse(
        typeof extra.response === 'string' ? extra.response : (result.data ?? null),
      );

      if (response.status === 'failure') {
        setError('Your UPI app says the payment did not go through. Nothing was charged here.');
        return;
      }

      if (
        (response.status === 'success' || response.status === 'submitted') &&
        response.reference
      ) {
        await submitReport(response.reference, {
          source: 'upi_app',
          status: response.status,
          approval_ref: response.approvalRef,
          txn_id: response.txnId,
          txn_ref: response.txnRef,
          expected_txn_ref: transactionRef,
          response_code: response.responseCode,
          raw: response.raw.slice(0, 500),
        });
        return;
      }

      // Cancelled, or an app that returns nothing: let them report it by hand,
      // with whatever id the app did give filled in.
      if (response.reference) setReference(response.reference);
      setNotice(
        'We couldn’t read the payment from your UPI app. If you paid, add the UPI transaction ID or a screenshot.',
      );
      setStage('report');
    } catch {
      setBusy(false);
      // No UPI app handles the link (common on iPhones with no UPI app
      // registered); copy the ID so they can pay by hand.
      await Clipboard.setStringAsync(vpa);
      setNotice(
        `No UPI app opened. We copied the UPI ID (${vpa}). Pay ${formatMoney(amount, currency)} with the note “${note}”, then come back here.`,
      );
      setStage('report');
    }
  };

  const submit = async () => {
    const parsed = optionalUpiReference.safeParse(reference);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the UPI transaction ID.');
      return;
    }
    // One of the two, never neither: the reference is what the bank matcher
    // runs on, and the screenshot is what staff read it off when the resident
    // did not have it to hand.
    const missing = paymentEvidenceProblem(parsed.data, Boolean(proof));
    if (missing) {
      setError(missing);
      return;
    }
    await submitReport(parsed.data, null);
  };

  const submitReport = async (upiReference: string | null, appResponse: AppResponse | null) => {
    if (!amount || !activeCommunity || !membershipId) return;
    setBusy(true);
    setError(null);

    let proofPath: string | null = null;
    if (proof) {
      const uploaded = await uploadFile(
        'payment-proofs',
        paymentProofPath(activeCommunity.id, membershipId, proof.name),
        proof,
      );
      if ('error' in uploaded) {
        setBusy(false);
        setError(uploaded.error);
        return;
      }
      proofPath = uploaded.path;
    }

    const { error: insertError } = await supabase.from('contributions').insert({
      event_id: event.id,
      community_id: activeCommunity.id,
      membership_id: membershipId,
      unit_id: payingFor?.id ?? null,
      amount,
      method: 'upi',
      reference: upiReference,
      proof_path: proofPath,
      status: 'pending',
      channel: 'mobile',
      // Kept for staff: what the UPI app said, and whether it echoed our own
      // transaction reference back.
      gateway_payload: appResponse ?? {},
    });
    setBusy(false);

    if (insertError) {
      // Don't leave a screenshot behind for a report that never saved.
      if (proofPath) void supabase.storage.from('payment-proofs').remove([proofPath]);
      setError(
        insertError.code === '23505'
          ? 'That UPI transaction ID has already been reported.'
          : appResponse
            ? `Your payment went through, but we couldn’t save the report. Enter UPI transaction ID ${upiReference} below and try again.`
            : 'That did not go through. Please try again.',
      );
      if (appResponse) {
        // Only reached when the UPI app handed one back, so it is never null
        // here; the fallback is for the type, not for a case that happens.
        setReference(upiReference ?? '');
        setStage('report');
      }
      return;
    }

    setCaptured(Boolean(appResponse));

    // They told us where they live, so tell the committee — who are the ones
    // who decide it. Best effort: the payment is in either way, and the
    // request upserts, so paying three times does not ask three times.
    if (flatNeeded && payingFor) {
      await supabase.rpc('request_unit_change', {
        p_community_id: activeCommunity.id,
        p_unit_id: payingFor.id,
        p_note: 'Told us when reporting a payment.',
      });
    }

    // Keys embed the member and event (`more:<id>`, `event:<slug>`), so refresh
    // everything rather than guessing prefixes.
    await queryClient.invalidateQueries();
    setStage('done');
  };

  if (stage === 'done') {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.lg }}>
          <Card style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl }}>
            <Title>Thank you</Title>
            <Text style={{ fontSize: 34, fontWeight: '700', color: colors.success }}>
              {formatMoney(amount ?? 0, currency)}
            </Text>
            <Body muted>Waiting for confirmation</Body>
            <Caption>
              {captured ? 'We got the payment details from your UPI app. ' : ''}
              It counts in the event total once staff confirm it. Follow it under Money → My
              contributions.
            </Caption>
          </Card>
          <Button label="Done" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  const chip = (selected: boolean) => ({
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderRadius: radius.sm,
    overflow: 'hidden' as const,
    fontSize: 15,
    fontWeight: selected ? ('600' as const) : ('400' as const),
    backgroundColor: selected ? colors.accent : colors.surfaceSunken,
    color: selected ? colors.accentInk : colors.inkMuted,
  });

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
            <Title>Support {event.name}</Title>
            <Caption>Pay the society’s UPI ID directly. It goes to this event’s fund only.</Caption>
          </View>

          <Card style={{ gap: spacing.lg }}>
            {/* Nobody has listed this member at a flat, so the app asks before
                they pay rather than filing a payment that can never say which
                door it came from. Answering it also puts the question to the
                committee, who are the ones who decide where somebody lives. */}
            {flatNeeded ? (
              <View style={{ gap: spacing.sm }}>
                <Body>Your flat</Body>
                {chosenFlat ? (
                  <Caption>Paying as {unitLabel(chosenFlat)}. Tap another to change it.</Caption>
                ) : (
                  <Caption>
                    Your society hasn&rsquo;t recorded a flat for you. The committee will be asked
                    to list you here.
                  </Caption>
                )}
                <Input
                  label="Find your flat"
                  value={flatQuery}
                  onChangeText={setFlatQuery}
                  placeholder="A 703"
                  autoCapitalize="characters"
                  editable={stage === 'amount'}
                />
                {flatQuery.trim() ? (
                  matches.length ? (
                    <ChipRow>
                      {matches.map((flat) => (
                        <Chip
                          key={flat.id}
                          label={unitLabel(flat)}
                          selected={flat.id === flatId}
                          disabled={stage !== 'amount'}
                          onPress={() => setFlatId(flat.id)}
                        />
                      ))}
                    </ChipRow>
                  ) : (
                    <Caption>No flat matches that.</Caption>
                  )
                ) : (
                  <Caption>{flats?.length} flats in this society. Type part of one.</Caption>
                )}
              </View>
            ) : null}

            <View style={{ gap: spacing.sm }}>
              <Body>Amount</Body>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {presets.map((preset) => (
                  <Text
                    key={preset}
                    accessibilityRole="button"
                    accessibilityLabel={formatMoney(preset, currency)}
                    accessibilityState={{ selected: amount === preset && custom === '' }}
                    onPress={() => {
                      if (stage !== 'amount') return;
                      setAmount(preset);
                      setCustom('');
                    }}
                    style={chip(amount === preset && custom === '')}
                  >
                    {formatMoney(preset, currency)}
                  </Text>
                ))}
              </View>
            </View>
            <Input
              label="Or another amount"
              value={custom}
              editable={stage === 'amount'}
              onChangeText={(value) => {
                setCustom(value);
                const parsed = Number.parseInt(value, 10);
                setAmount(Number.isFinite(parsed) && parsed > 0 ? parsed : null);
              }}
              keyboardType="number-pad"
              placeholder="Enter an amount"
            />
            {/* Two things to carry across to a UPI app, and on an iPhone with
                no UPI app registered the deep link does nothing, so this is the
                whole path. Two buttons rather than one combined string: they
                go into two different fields over there. */}
            <View style={{ gap: spacing.sm }}>
              <Caption>Paying {payeeName}</Caption>
              <CopyRow
                label="UPI ID"
                value={vpa}
                copied={copied === 'vpa'}
                onCopy={() => copy('vpa', vpa)}
              />
              {note ? (
                <>
                  <CopyRow
                    label="Note"
                    value={note}
                    copied={copied === 'note'}
                    onCopy={() => copy('note', note)}
                  />
                  <Caption>Keep this note on the payment so the committee can match it.</Caption>
                </>
              ) : null}
            </View>
          </Card>

          {stage === 'amount' ? (
            <>
              <ErrorText message={error} />
              <Button
                label={
                  flatNeeded && !chosenFlat
                    ? 'Pick your flat first'
                    : amount
                      ? `Pay ${formatMoney(amount, currency)} with UPI`
                      : 'Choose an amount'
                }
                onPress={() => void openUpiApp()}
                loading={busy}
                disabled={!amount || (flatNeeded && !chosenFlat)}
              />
              <Button
                label="I’ve already paid"
                variant="secondary"
                onPress={() => setStage('report')}
                disabled={!amount || (flatNeeded && !chosenFlat)}
              />
            </>
          ) : (
            <Card style={{ gap: spacing.md }}>
              <Heading>Tell us you’ve paid</Heading>
              {notice ? <Body muted>{notice}</Body> : null}
              <Input
                label={COPY.upiReference}
                value={reference}
                onChangeText={setReference}
                keyboardType="number-pad"
                placeholder="12-digit number from your UPI app"
                autoCapitalize="none"
              />
              <Caption>No ID to hand? A screenshot is enough.</Caption>
              <FilePickerField
                label="Payment screenshot"
                file={proof}
                onChange={setProof}
                allowPdf={false}
              />
              <ErrorText message={error} />
              <Button
                label={`Report ${amount ? formatMoney(amount, currency) : 'payment'}`}
                onPress={() => void submit()}
                loading={busy}
                disabled={!amount}
              />
              <Button
                label="Back"
                variant="secondary"
                onPress={() => {
                  setStage('amount');
                  setNotice(null);
                  setError(null);
                }}
              />
            </Card>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
