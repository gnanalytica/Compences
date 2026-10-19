import { useState } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  can,
  correctionNoteForStaff,
  formatDate,
  formatMoney,
  paymentProofPath,
  recordedPaymentEvidenceProblem,
  unitLabel,
  upiCaptureNote,
} from '@compences/core';
import { useAuth } from '../../src/lib/auth';
import { supabase } from '../../src/lib/supabase';
import { useCommunityData } from '../../src/lib/use-community-data';
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
} from '../../src/components/ui';
import { Chip, ChipRow, ErrorText } from '../../src/components/admin-ui';
import { KeyValue } from '../../src/components/event-ui';
import { FilePickerField, ViewFileButton } from '../../src/components/file-ui';
import { uploadFile, type PickedFile } from '../../src/lib/storage';
import { AuditTrail } from '../../src/components/audit-trail';
import { spacing } from '../../src/lib/theme';

const METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'cheque', label: 'Cheque' },
] as const;

type Method = (typeof METHODS)[number]['value'];

const METHOD_LABEL: Record<string, string> = {
  cash: 'Cash',
  upi: 'UPI',
  bank_transfer: 'Bank transfer',
  cheque: 'Cheque',
  card: 'Card',
  netbanking: 'Net banking',
  other: 'Other',
};

/**
 * Which flat paid what for an event, with method and reference, and a form to
 * record cash or UPI collected in person. Only staff and committee see
 * individual payments; residents see totals.
 */
export default function Payments() {
  const { event: initialSlug } = useLocalSearchParams<{ event?: string }>();
  const queryClient = useQueryClient();
  const { activeCommunity, role, membershipId } = useAuth();
  const currency = activeCommunity?.currency ?? 'INR';
  const [slug, setSlug] = useState<string | null>(initialSlug ?? null);
  const [recording, setRecording] = useState(false);

  const { data, loading, refreshing, refresh } = useCommunityData(
    'admin:payments',
    async (communityId) => {
      const [events, contributions, units, committee] = await Promise.all([
        supabase
          .from('events')
          .select('id, slug, name, emoji, status, starts_on')
          .eq('community_id', communityId)
          .in('status', ['published', 'completed'])
          .order('starts_on', { ascending: false }),
        supabase
          .from('contributions')
          .select(
            'id, event_id, amount, reported_amount, method, reference, status, channel, paid_at, receipt_no, proof_path, review_note, gateway_payload, verified_at, updated_at, membership_id, units(block, number), payer:memberships!contributions_membership_id_fkey(profiles(full_name)), verifier:memberships!contributions_verified_by_fkey(profiles(full_name)), editor:memberships!contributions_updated_by_fkey(profiles(full_name))',
          )
          .eq('community_id', communityId)
          .order('paid_at', { ascending: false })
          .limit(2000),
        supabase
          .from('units')
          .select('id, block, number')
          .eq('community_id', communityId)
          .order('block', { nullsFirst: true })
          .order('number')
          .limit(2000),
        // One committee member means there is nobody else to confirm their
        // own payment, so the rule below steps aside for them.
        supabase
          .from('memberships')
          .select('id', { count: 'exact', head: true })
          .eq('community_id', communityId)
          .eq('role', 'committee')
          .eq('status', 'active'),
      ]);
      return {
        events: events.data ?? [],
        contributions: contributions.data ?? [],
        units: units.data ?? [],
        committeeCount: committee.count ?? 0,
      };
    },
  );

  if (!can(role, 'payments:view')) {
    return (
      <Screen>
        <EmptyState title="Staff and committee only" />
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

  const events = data?.events ?? [];
  const current = events.find((event) => event.slug === slug) ?? events[0];
  const eventRows = (data?.contributions ?? []).filter((row) => row.event_id === current?.id);
  const rows = eventRows.filter((row) => row.status === 'succeeded');
  const waiting = eventRows.filter((row) => row.status === 'pending');
  const refreshAll = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin:payments'] });
    // Totals on the event pages change once a payment is confirmed.
    void queryClient.invalidateQueries();
  };
  const total = rows.reduce((sum, row) => sum + Number(row.amount), 0);
  const flatsPaid = new Set(
    rows.map((row) => (row.units ? unitLabel(row.units) : null)).filter(Boolean),
  );
  const unitCount = data?.units.length ?? 0;
  const mayCorrect = can(role, 'expenses:approve');
  const alone = mayCorrect && (data?.committeeCount ?? 0) <= 1;

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
          keyboardShouldPersistTaps="handled"
        >
          {events.length ? (
            <ChipRow>
              {events.map((event) => (
                <Chip
                  key={event.id}
                  label={event.name}
                  selected={current?.id === event.id}
                  onPress={() => {
                    setSlug(event.slug);
                    setRecording(false);
                  }}
                />
              ))}
            </ChipRow>
          ) : (
            <EmptyState title="No events are collecting money" />
          )}

          {current ? (
            <>
              <Card style={{ gap: spacing.xs }}>
                <Heading>{current.name}</Heading>
                <KeyValue label="Collected" value={formatMoney(total, currency)} />
                <KeyValue label="Receipts" value={String(rows.length)} />
                <KeyValue label="Waiting for confirmation" value={String(waiting.length)} />
                <KeyValue
                  label="Flats paid"
                  value={unitCount ? `${flatsPaid.size} of ${unitCount}` : String(flatsPaid.size)}
                />
              </Card>

              {current.status === 'published' && can(role, 'payments:record') ? (
                recording ? (
                  <RecordPayment
                    eventId={current.id}
                    units={data?.units ?? []}
                    onCancel={() => setRecording(false)}
                    onDone={() => {
                      setRecording(false);
                      refreshAll();
                    }}
                  />
                ) : (
                  <Button label="Record a receipt for a flat" onPress={() => setRecording(true)} />
                )
              ) : null}

              {waiting.length ? (
                <Card style={{ gap: spacing.md }}>
                  <Heading>Waiting for confirmation</Heading>
                  <Caption>
                    Match each against the bank statement before confirming. Only confirmed receipts
                    count.
                  </Caption>
                  {waiting.map((row) => (
                    <PendingPayment
                      key={row.id}
                      row={row}
                      currency={currency}
                      mayReview={can(role, 'payments:record')}
                      mayCorrect={mayCorrect}
                      mine={!alone && row.membership_id === membershipId}
                      onDone={refreshAll}
                    />
                  ))}
                </Card>
              ) : null}

              <Card style={{ gap: spacing.md }}>
                <Heading>Confirmed receipts</Heading>
                <Caption>
                  Transaction IDs and screenshots stay here, to check against the statement any
                  time.
                </Caption>
                {rows.length ? (
                  rows.map((row) => (
                    <View key={row.id} style={{ gap: spacing.xs }}>
                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          gap: spacing.md,
                        }}
                      >
                        <View style={{ flex: 1, gap: 2 }}>
                          <Body>
                            {row.units ? `Flat ${unitLabel(row.units)}` : 'No flat'}
                            {row.payer?.profiles?.full_name
                              ? ` · ${row.payer.profiles.full_name}`
                              : ' · recorded by staff'}
                          </Body>
                          <Caption>
                            {METHOD_LABEL[row.method] ?? row.method}
                            {row.reference ? ` · ${row.reference}` : ''} ·{' '}
                            {formatDate(row.paid_at.slice(0, 10))} · #{row.receipt_no}
                          </Caption>
                          {/* A number that moved with no trace of the move is
                              the thing this app exists to replace. */}
                          {correctionNoteForStaff(row.amount, row.reported_amount, currency) ? (
                            <Caption>
                              {correctionNoteForStaff(row.amount, row.reported_amount, currency)}
                            </Caption>
                          ) : null}
                        </View>
                        <Body>{formatMoney(row.amount, currency)}</Body>
                      </View>
                      {/* Confirming a payment used to be the last moment anybody
                          could see the screenshot. Reconciliation happens later,
                          when the bank statement arrives, so the evidence has to
                          outlive the decision. */}
                      <ViewFileButton
                        bucket="payment-proofs"
                        value={row.proof_path}
                        label="View screenshot"
                      />
                    </View>
                  ))
                ) : (
                  <Caption>No receipts yet.</Caption>
                )}
              </Card>
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

type PendingRow = {
  id: string;
  amount: number;
  reported_amount: number | null;
  membership_id: string | null;
  method: string;
  reference: string | null;
  paid_at: string;
  proof_path: string | null;
  gateway_payload?: unknown;
  verified_at: string | null;
  updated_at: string | null;
  units: { block: string | null; number: string } | null;
  payer: { profiles: { full_name: string | null } | null } | null;
  verifier: { profiles: { full_name: string | null } | null } | null;
  editor: { profiles: { full_name: string | null } | null } | null;
};

function PendingPayment({
  row,
  currency,
  mayReview,
  mayCorrect,
  mine,
  onDone,
}: {
  row: PendingRow;
  currency: string;
  mayReview: boolean;
  /** Rewriting a recorded amount is a ledger correction: committee only. */
  mayCorrect: boolean;
  /** The viewer reported this payment, and somebody else must confirm it. */
  mine: boolean;
  onDone: () => void;
}) {
  const [declining, setDeclining] = useState(false);
  const [note, setNote] = useState('');
  const [reference, setReference] = useState('');
  const [amount, setAmount] = useState(String(row.amount));
  const [busy, setBusy] = useState<'confirm' | 'decline' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const review = async (confirm: boolean) => {
    if (!confirm && !note.trim()) {
      setError('Say why it can’t be confirmed.');
      return;
    }
    const corrected = Number(amount);
    if (confirm && mayCorrect && (!Number.isFinite(corrected) || corrected <= 0)) {
      setError('Enter the amount the bank shows, or put the reported figure back.');
      return;
    }
    setBusy(confirm ? 'confirm' : 'decline');
    setError(null);
    const { error: rpcError } = await supabase.rpc('review_contribution', {
      p_contribution_id: row.id,
      p_confirm: confirm,
      p_note: note.trim() || undefined,
      p_reference: reference.trim() || undefined,
      p_amount: confirm && mayCorrect ? corrected : undefined,
    });
    setBusy(null);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    onDone();
  };

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Body>
            {row.units ? `Flat ${unitLabel(row.units)}` : 'No flat'}
            {row.payer?.profiles?.full_name ? ` · ${row.payer.profiles.full_name}` : ''}
          </Body>
          <Caption>
            {METHOD_LABEL[row.method] ?? row.method}
            {row.reference ? ` · Ref ${row.reference}` : ''} ·{' '}
            {formatDate(row.paid_at.slice(0, 10))}
          </Caption>
        </View>
        <Body>{formatMoney(row.amount, currency)}</Body>
      </View>
      {upiCaptureNote(row.gateway_payload) ? (
        <Caption>{upiCaptureNote(row.gateway_payload)}</Caption>
      ) : null}
      <ViewFileButton bucket="payment-proofs" value={row.proof_path} label="View screenshot" />
      {/* Only when it is missing, which means the resident sent a screenshot
          instead of typing it. Whoever is confirming has the statement open
          and the picture one tap away, so this is the cheapest moment in the
          whole flow to capture the one thing reconciliation runs on. */}
      {mayReview && !row.reference ? (
        <Input
          label="UPI transaction ID from the screenshot (optional)"
          value={reference}
          onChangeText={setReference}
          keyboardType="number-pad"
          autoCapitalize="none"
          placeholder="612345678901"
        />
      ) : null}
      {/* Pre-filled with what the resident reported, so confirming an accurate
          report is still one tap. Somebody who typed ₹1,000 and sent ₹10 is a
          digit, not a fraud, and turning the whole payment down over it makes
          them report it all over again. */}
      {mayReview && mayCorrect && !mine ? (
        <Input
          label={`Amount the bank shows (reported ${formatMoney(row.amount, currency)})`}
          value={amount}
          onChangeText={setAmount}
          keyboardType="number-pad"
          placeholder={String(row.amount)}
        />
      ) : null}
      {/* Who confirmed the money arrived, and any edit made after they did. */}
      <AuditTrail
        confirmedBy={row.verifier?.profiles?.full_name}
        confirmedAt={row.verified_at}
        editedBy={row.editor?.profiles?.full_name}
        editedAt={row.updated_at}
      />
      {mine ? (
        <Caption>You reported this receipt. Another committee member must confirm it.</Caption>
      ) : mayReview ? (
        declining ? (
          <View style={{ gap: spacing.sm }}>
            <Input
              label="Why can’t it be confirmed?"
              value={note}
              onChangeText={setNote}
              placeholder="No matching credit in the bank statement"
              multiline
            />
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Button label="Cancel" variant="secondary" onPress={() => setDeclining(false)} />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  label="Turn down"
                  onPress={() => void review(false)}
                  loading={busy === 'decline'}
                />
              </View>
            </View>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Button
                label="Confirm"
                onPress={() => void review(true)}
                loading={busy === 'confirm'}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button label="Turn down" variant="secondary" onPress={() => setDeclining(true)} />
            </View>
          </View>
        )
      ) : null}
      <ErrorText message={error} />
    </View>
  );
}

function RecordPayment({
  eventId,
  units,
  onCancel,
  onDone,
}: {
  eventId: string;
  units: { id: string; block: string | null; number: string }[];
  onCancel: () => void;
  onDone: () => void;
}) {
  const { activeCommunity, membershipId } = useAuth();
  const currency = activeCommunity?.currency ?? 'INR';
  const [proof, setProof] = useState<PickedFile | null>(null);
  const [flatQuery, setFlatQuery] = useState('');
  const [unitId, setUnitId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<Method>('cash');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const query = flatQuery.trim().toUpperCase().replace(/\s+/g, '');
  const matches = query
    ? units
        .filter((unit) =>
          unitLabel(unit).toUpperCase().replace('-', '').includes(query.replace('-', '')),
        )
        .slice(0, 12)
    : [];
  const chosen = units.find((unit) => unit.id === unitId);

  const save = async () => {
    const value = Number.parseFloat(amount.replace(/[^0-9.]/g, ''));
    if (!unitId) {
      setError('Pick the flat that paid.');
      return;
    }
    if (!Number.isFinite(value) || value <= 0) {
      setError('Enter the amount received.');
      return;
    }
    // Cash is the one kind of payment with nothing to show for it; anything
    // else carries its transaction ID or a screenshot.
    const missing = recordedPaymentEvidenceProblem(method, reference, Boolean(proof));
    if (missing) {
      setError(missing);
      return;
    }
    if (!activeCommunity || !membershipId) return;
    setBusy(true);
    setError(null);
    let proofPath: string | null = null;
    if (proof && method !== 'cash') {
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
      event_id: eventId,
      community_id: activeCommunity.id,
      unit_id: unitId,
      amount: value,
      method,
      reference: reference.trim() || null,
      proof_path: proofPath,
      status: 'succeeded',
      channel: 'mobile',
    });
    setBusy(false);
    if (insertError) {
      if (proofPath) void supabase.storage.from('payment-proofs').remove([proofPath]);
      setError(insertError.message);
      return;
    }
    onDone();
  };

  return (
    <Card style={{ gap: spacing.md }}>
      <Heading>Record a receipt</Heading>
      {chosen ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Body>Flat {unitLabel(chosen)}</Body>
          <Chip label="Change" onPress={() => setUnitId(null)} />
        </View>
      ) : (
        <View style={{ gap: spacing.sm }}>
          <Input
            label="Flat"
            value={flatQuery}
            onChangeText={setFlatQuery}
            placeholder="Type a flat, e.g. A1104"
            autoCapitalize="characters"
          />
          {matches.length ? (
            <ChipRow>
              {matches.map((unit) => (
                <Chip key={unit.id} label={unitLabel(unit)} onPress={() => setUnitId(unit.id)} />
              ))}
            </ChipRow>
          ) : query ? (
            <Caption>No flat matches.</Caption>
          ) : null}
        </View>
      )}
      <Input
        label={`Amount (${currency})`}
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        placeholder="1001"
      />
      <ChipRow>
        {METHODS.map((item) => (
          <Chip
            key={item.value}
            label={item.label}
            selected={method === item.value}
            onPress={() => setMethod(item.value)}
          />
        ))}
      </ChipRow>
      <Input
        label={method === 'cash' ? 'Receipt book number (optional)' : 'UPI / bank reference'}
        value={reference}
        onChangeText={setReference}
        autoCapitalize="characters"
      />
      {method !== 'cash' ? (
        <FilePickerField
          label="Or a screenshot of the payment"
          file={proof}
          onChange={setProof}
          existingLabel="Either the reference or a screenshot. Cash needs neither."
          allowPdf={false}
        />
      ) : null}
      <ErrorText message={error} />
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Button label="Cancel" variant="secondary" onPress={onCancel} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label="Save" onPress={() => void save()} loading={busy} />
        </View>
      </View>
    </Card>
  );
}
