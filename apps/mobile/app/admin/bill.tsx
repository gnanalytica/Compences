import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  COPY,
  billPath,
  budgetLineLabel,
  can,
  formatDate,
  formatMoney,
  overLineBy,
} from '@compences/core';
import { useAuth } from '../../src/lib/auth';
import { supabase } from '../../src/lib/supabase';
import { useCommunityData } from '../../src/lib/use-community-data';
import { TODO_KEY } from '../../src/lib/todo';
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
import { Chip, ChipRow, Disclosure, ErrorText } from '../../src/components/admin-ui';
import { FilePickerField, ViewFileButton } from '../../src/components/file-ui';
import { LineSummary, useLineBalances } from '../../src/components/budget-line-ui';
import { uploadFile, type PickedFile } from '../../src/lib/storage';
import { spacing } from '../../src/lib/theme';

const METHODS = [
  { value: 'upi', label: 'UPI' },
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'cheque', label: 'Cheque' },
] as const;

type Method = (typeof METHODS)[number]['value'];

/** The number in an amount field, 0 when there is none. */
const amountValue = (text: string) => {
  const value = Number.parseFloat(text.replace(/[^0-9.]/g, ''));
  return Number.isFinite(value) ? value : 0;
};

/**
 * Add a bill, or correct one that is still waiting or was sent back. A
 * corrected bill goes back into the committee's queue as pending.
 */
export default function BillForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { role } = useAuth();

  const { data, loading } = useCommunityData(`admin:bill:${id ?? 'new'}`, async (communityId) => {
    const [events, existing] = await Promise.all([
      supabase
        .from('events')
        .select('id, name, emoji, status')
        .eq('community_id', communityId)
        .in('status', ['draft', 'published'])
        .order('starts_on', { ascending: true }),
      id
        ? supabase
            .from('expenses')
            .select(
              'id, event_id, budget_line_id, name, category, category_id, amount, vendor, vendor_id, method, bill_url, spent_on, status',
            )
            .eq('id', id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    return { events: events.data ?? [], existing: existing.data };
  });

  if (!can(role, 'expenses:submit')) {
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

  if (id && !data?.existing) {
    return (
      <Screen>
        <EmptyState title="Bill not found" />
      </Screen>
    );
  }

  return (
    <Form
      key={data?.existing?.id ?? 'new'}
      events={data?.events ?? []}
      existing={data?.existing ?? null}
    />
  );
}

type EventOption = {
  id: string;
  name: string;
  emoji: string;
};

type Existing = {
  id: string;
  event_id: string;
  budget_line_id: string | null;
  name: string;
  category: string | null;
  category_id: string | null;
  amount: number;
  vendor: string | null;
  vendor_id: string | null;
  method: string;
  bill_url: string | null;
  spent_on: string;
  status: string;
};

/**
 * Removes a bill's stored file. Old rows may hold an http link instead of a
 * storage path; those aren't ours to delete. Storage policies refuse to
 * delete an approved bill's file, so a published ledger keeps its evidence.
 */
async function removeStoredBill(path: string) {
  if (/^https?:\/\//i.test(path)) return;
  await supabase.storage.from('bills').remove([path]);
}

function Form({ events, existing }: { events: EventOption[]; existing: Existing | null }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { activeCommunity, membershipId, role } = useAuth();
  const currency = activeCommunity?.currency ?? 'INR';

  const [eventId, setEventId] = useState(existing?.event_id ?? events[0]?.id ?? '');
  const [name, setName] = useState(existing?.name ?? '');
  // The line the bill is paid out of. A bill from before lines existed has
  // none, and keeps the category and vendor it was written with.
  const [lineId, setLineId] = useState<string | null>(existing?.budget_line_id ?? null);
  const [amount, setAmount] = useState(existing ? String(existing.amount) : '');
  const [method, setMethod] = useState<Method>(
    (METHODS.find((item) => item.value === existing?.method)?.value ?? 'upi') as Method,
  );
  // Local calendar day: toISOString would give yesterday's date before 5:30 am IST.
  const [spentOn, setSpentOn] = useState(existing?.spent_on ?? today());
  // Approved or rejected: a decision exists, and a change to the substance
  // withdraws it. The database does the withdrawing; this only says so.
  const wasDecided =
    existing != null && existing.status !== 'pending' && existing.status !== 'changes_requested';
  const [billFile, setBillFile] = useState<PickedFile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: lines, loading: loadingLines } = useLineBalances(eventId);
  const line = (lines ?? []).find((item) => item.id === lineId) ?? null;
  const legacy = existing != null && existing.budget_line_id == null && !line;
  // An approved bill is already taken off its line, so editing it must not
  // count it twice.
  const ownShare =
    existing?.status === 'approved' && existing.budget_line_id === line?.id
      ? Number(existing.amount)
      : 0;
  const over = line ? overLineBy(line.remaining + ownShare, amountValue(amount)) : 0;

  const save = async () => {
    const value = amountValue(amount);
    if (!eventId) {
      setError('Pick the event this bill belongs to.');
      return;
    }
    // The committee approves a bill on everybody's behalf, and cannot without
    // knowing which line of the budget and which vendor it is for.
    if (!line && !legacy) {
      setError('Pick the budget line this bill is paid from.');
      return;
    }
    if (value <= 0) {
      setError('Enter the amount to record.');
      return;
    }
    if (name.trim().length < 2) {
      setError('Add remarks about the bill.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(spentOn)) {
      setError('Pick the date on the bill.');
      return;
    }
    if (!activeCommunity || !membershipId) return;

    if (!existing?.bill_url && !billFile) {
      setError('Attach a photo or PDF of the bill.');
      return;
    }

    setBusy(true);
    setError(null);

    // Upload first so a failed upload never leaves a bill pointing nowhere. A
    // correction uploads a new file rather than overwriting the old one.
    let billUrl = existing?.bill_url ?? null;
    if (billFile) {
      const uploaded = await uploadFile(
        'bills',
        billPath(activeCommunity.id, eventId, billFile.name),
        billFile,
      );
      if ('error' in uploaded) {
        setBusy(false);
        setError(uploaded.error);
        return;
      }
      billUrl = uploaded.path;
    }

    const fields = {
      event_id: eventId,
      name: name.trim(),
      budget_line_id: line?.id ?? null,
      // Copied off the line. The id links the catalogue; the label stays on
      // the bill so renaming a category later never rewrites a ledger
      // residents have already seen.
      category: line ? line.category : (existing?.category ?? null),
      category_id: line ? line.categoryId : (existing?.category_id ?? null),
      amount: value,
      vendor: line ? line.vendor : (existing?.vendor ?? null),
      vendor_id: line ? line.vendorId : (existing?.vendor_id ?? null),
      method,
      spent_on: spentOn,
      bill_url: billUrl,
    };

    const { error: saveError } = existing
      ? await supabase
          .from('expenses')
          .update({ ...fields, status: 'pending' })
          .eq('id', existing.id)
      : await supabase.from('expenses').insert({
          ...fields,
          community_id: activeCommunity.id,
          requested_by: membershipId,
          paid_by: membershipId,
          status: 'pending',
        });
    setBusy(false);

    if (saveError) {
      // The new upload belongs to a bill that never saved; don't leave it behind.
      if (billFile && billUrl && billUrl !== existing?.bill_url) {
        void removeStoredBill(billUrl);
      }
      setError(saveError.message);
      return;
    }
    // A correction with a new file replaces the old one; remove the old file
    // only now that the bill points at the new path. A bill that had already
    // been decided is the exception: residents have seen that copy, and it is
    // the record the revision is answerable to, so it stays.
    if (billFile && existing?.bill_url && existing.bill_url !== billUrl && !wasDecided) {
      void removeStoredBill(existing.bill_url);
    }
    await queryClient.invalidateQueries({ queryKey: ['admin:bills'] });
    await queryClient.invalidateQueries({ queryKey: [TODO_KEY] });
    router.back();
  };

  const deleteBill = async () => {
    if (!existing) return;
    setBusy(true);
    setError(null);
    const { error: deleteError } = await supabase.from('expenses').delete().eq('id', existing.id);
    setBusy(false);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    if (existing.bill_url) void removeStoredBill(existing.bill_url);
    await queryClient.invalidateQueries({ queryKey: ['admin:bills'] });
    await queryClient.invalidateQueries({ queryKey: [TODO_KEY] });
    router.back();
  };

  const confirmDelete = () =>
    Alert.alert('Delete this bill?', 'It will be removed with its file. This can’t be undone.', [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void deleteBill() },
    ]);

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
            <Title>
              {!existing ? 'Add a bill' : wasDecided ? 'Revise a bill' : 'Correct a bill'}
            </Title>
            <Caption>
              {wasDecided
                ? 'Saving withdraws the current decision and sends the bill back for approval.'
                : existing?.status === 'changes_requested'
                  ? 'Saving sends it back to the committee for approval.'
                  : 'The committee approves every bill before it appears in the accounts.'}
            </Caption>
          </View>

          <Card style={{ gap: spacing.lg }}>
            <View style={{ gap: spacing.sm }}>
              <Body>Event</Body>
              {events.length ? (
                <ChipRow>
                  {events.map((event) => (
                    <Chip
                      key={event.id}
                      label={event.name}
                      selected={eventId === event.id}
                      onPress={() => {
                        setEventId(event.id);
                        setLineId(null);
                      }}
                    />
                  ))}
                </ChipRow>
              ) : (
                <Caption>No open events. Create one from Manage → New event first.</Caption>
              )}
            </View>
            <View style={{ gap: spacing.sm }}>
              <Body>Budget line</Body>
              {lines?.length ? (
                <ChipRow>
                  {lines.map((item) => (
                    <Chip
                      key={item.id}
                      label={budgetLineLabel(item)}
                      selected={lineId === item.id}
                      onPress={() => setLineId(item.id)}
                    />
                  ))}
                </ChipRow>
              ) : loadingLines ? (
                <Caption>Loading…</Caption>
              ) : (
                <Caption>
                  This event has no budget lines yet. Add them from Manage → the event.
                </Caption>
              )}
              {line ? <LineSummary line={line} currency={currency} /> : null}
              {legacy ? (
                <Caption>
                  {[existing?.category, existing?.vendor].filter(Boolean).join(' · ') ||
                    'Not tied to a budget line'}{' '}
                  · raised before budget lines. Pick a line to move it onto one.
                </Caption>
              ) : null}
            </View>
            <Input
              label={`Record (${currency})`}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="12000"
            />
            {amountValue(amount) > 0 ? (
              <Caption>{formatMoney(amountValue(amount), currency)}</Caption>
            ) : null}
            {over > 0 ? (
              <Caption tone="warning">
                {formatMoney(over, currency)} over what’s left on this line. You can still submit;
                the committee will see it.
              </Caption>
            ) : null}
            <FilePickerField
              label="Photo of the bill"
              file={billFile}
              onChange={setBillFile}
              existingLabel={
                existing?.bill_url
                  ? 'A bill is attached. Pick a new file to replace it.'
                  : 'Photograph the bill or attach the PDF.'
              }
            />
            {existing?.bill_url && !billFile ? (
              <ViewFileButton bucket="bills" value={existing.bill_url} label="View current bill" />
            ) : null}
            <Input
              label="Remarks"
              value={name}
              onChangeText={setName}
              placeholder="Pandal and chairs, advance"
              multiline
            />

            <Disclosure
              label={COPY.moreDetails}
              summary={[
                line?.vendor ?? existing?.vendor ?? 'No vendor',
                spentOn === today() ? 'Today' : formatDate(spentOn),
                METHODS.find((item) => item.value === method)?.label,
              ]
                .filter(Boolean)
                .join(' · ')}
            >
              <DateField
                label="Bill date"
                value={spentOn}
                onChange={(next) => setSpentOn(next ?? today())}
                maximumDate={today()}
              />
              <View style={{ gap: spacing.sm }}>
                <Body>Paid by</Body>
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
              </View>
            </Disclosure>
          </Card>

          <ErrorText message={error} />
          <Button
            label={
              !existing ? 'Submit for approval' : wasDecided ? 'Save revision' : 'Save and resubmit'
            }
            onPress={() => void save()}
            loading={busy}
          />
          {existing && existing.status !== 'approved' && can(role, 'expenses:approve') ? (
            <Button
              label="Delete bill"
              variant="secondary"
              onPress={confirmDelete}
              disabled={busy}
            />
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
