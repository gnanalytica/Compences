import { useState } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import {
  can,
  flatTagIn,
  formatDate,
  MATCH_CONFIDENCE,
  formatMoney,
  parseStatement,
  relativeTime,
} from '@compences/core';
import { useAuth } from '../../src/lib/auth';
import { supabase } from '../../src/lib/supabase';
import { useCommunityData } from '../../src/lib/use-community-data';
import { reportHandled } from '../../src/lib/observability';
import {
  Badge,
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
import { StatTile } from '../../src/components/event-ui';
import { spacing } from '../../src/lib/theme';

/** Open lines held on screen at once, matching the web page. */
const PAGE = 40;

type Candidate = {
  contribution_id: string;
  payer: string;
  amount: number;
  reference: string | null;
  confidence: string;
};

type Line = {
  id: string;
  posted_on: string;
  amount: number;
  narration: string | null;
  reference: string | null;
  ignored_reason: string | null;
  contribution_id: string | null;
  matched_at: string | null;
  matcher: { profiles: { full_name: string | null } | null } | null;
};

type Account = { id: string; label: string; bank_name: string | null; last4: string | null };

/**
 * The bank's version of events, next to ours — the web Reconcile page, on a
 * phone.
 *
 * Lines the bank posted sit on one side, payments residents reported on the
 * other, and what is left is the honest answer: money that arrived and nobody
 * can explain, or money somebody claims to have sent that never landed.
 *
 * One difference from the web, and it is deliberate. The web page fetches
 * candidate matches for every open line while it renders, which is forty round
 * trips it can afford on a server beside the database. A phone on mobile data
 * cannot, so candidates are fetched for the line you open. The web page's
 * comment is the thing to preserve there: a line shown without its candidates
 * reads as "nothing matches this", which is a different claim from "we have not
 * looked yet" — so an unopened line says neither, and asks you to look.
 */
export default function Reconcile() {
  const { role, activeCommunity } = useAuth();
  const currency = activeCommunity?.currency ?? 'INR';
  const mayRecord = can(role, 'payments:record');
  const mayManage = can(role, 'roles:manage');

  const { data, loading, refreshing, refresh, error } = useCommunityData(
    'admin:reconcile',
    async (communityId) => {
      const [accounts, lines, summary] = await Promise.all([
        supabase
          .from('bank_accounts')
          .select('id, label, bank_name, last4, is_active')
          .eq('community_id', communityId)
          .eq('is_active', true)
          .order('created_at'),
        supabase
          .from('bank_transactions')
          .select(
            'id, posted_on, amount, narration, reference, ignored_reason, contribution_id, matched_at, matcher:memberships!bank_transactions_matched_by_fkey(profiles(full_name))',
          )
          .eq('community_id', communityId)
          .order('posted_on', { ascending: false })
          .limit(300),
        supabase
          .from('reconciliation_summary')
          .select('*')
          .eq('community_id', communityId)
          .maybeSingle(),
      ]);
      const failure = accounts.error ?? lines.error ?? summary.error;
      if (failure) {
        console.error(
          '[compences] read failed: reconciliation',
          failure.code,
          failure.message,
          failure.details ?? '',
        );
        reportHandled(failure, 'reconciliation');
        throw new Error(failure.message);
      }
      return {
        accounts: (accounts.data ?? []) as Account[],
        lines: (lines.data ?? []) as Line[],
        summary: summary.data ?? null,
      };
    },
  );

  if (!mayRecord) {
    return (
      <Screen>
        <View style={{ padding: spacing.lg }}>
          <EmptyState title="Staff and committee only" />
        </View>
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

  if (error && !data) {
    return (
      <Screen>
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <EmptyState title="Could not load the statement" description={error} />
          <Button label="Try again" onPress={refresh} />
        </View>
      </Screen>
    );
  }

  const accounts = data?.accounts ?? [];
  const lines = data?.lines ?? [];
  const summary = data?.summary ?? null;
  const allOpen = lines.filter((line) => !line.contribution_id && !line.ignored_reason);
  const settled = lines.filter((line) => line.contribution_id || line.ignored_reason);
  const open = allOpen.slice(0, PAGE);

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <StatTile label="UNEXPLAINED" value={String(summary?.unexplained_lines ?? 0)} />
            <StatTile label="ARRIVED" value={formatMoney(summary?.unexplained_in ?? 0, currency)} />
          </View>
          <StatTile
            label="LEFT, UNEXPLAINED"
            value={formatMoney(summary?.unexplained_out ?? 0, currency)}
          />

          {accounts.length ? (
            <ImportCard accounts={accounts} onDone={refresh} />
          ) : (
            <Card style={{ gap: spacing.sm }}>
              <Heading>Name the account first</Heading>
              {mayManage ? (
                <AddAccountForm onDone={refresh} />
              ) : (
                <Body muted>Ask the committee to add the society’s bank account here.</Body>
              )}
            </Card>
          )}

          <View style={{ gap: spacing.sm }}>
            <Heading>Nobody has explained these yet ({allOpen.length})</Heading>
            <Caption>
              {allOpen.length > PAGE
                ? `Pair each with a payment, or say what it was. Showing the ${PAGE} most recent.`
                : 'Pair each with a payment, or say what it was.'}
            </Caption>
            {open.length ? (
              open.map((line) => (
                <OpenLine key={line.id} line={line} currency={currency} onDone={refresh} />
              ))
            ) : (
              <EmptyState
                title={lines.length ? 'Everything is accounted for' : 'Nothing imported yet'}
                description={
                  lines.length
                    ? 'Every bank line is matched to a payment or set aside with a reason.'
                    : 'Import a statement above to see its lines here.'
                }
              />
            )}
          </View>

          {settled.length ? (
            <View style={{ gap: spacing.sm }}>
              <Heading>Settled ({settled.length})</Heading>
              <Caption>Lines already paired or set aside, and who decided.</Caption>
              {settled.slice(0, 60).map((line) => (
                <SettledLine
                  key={line.id}
                  line={line}
                  currency={currency}
                  mayUndo={mayManage}
                  onDone={refresh}
                />
              ))}
            </View>
          ) : null}

          {accounts.length && mayManage ? (
            <Card style={{ gap: spacing.sm }}>
              <Heading>Accounts</Heading>
              <Caption>The full account number is never stored.</Caption>
              {/* Plain rows, not LinkRow: there is nothing to open, and a
                  chevron that does nothing is a worse lie than no chevron. */}
              {accounts.map((account) => (
                <View key={account.id} style={{ gap: 2 }}>
                  <Body>{account.label}</Body>
                  <Caption>
                    {[account.bank_name, account.last4 ? `····${account.last4}` : null]
                      .filter(Boolean)
                      .join(' · ') || 'No bank named'}
                  </Caption>
                </View>
              ))}
              <AddAccountForm onDone={refresh} />
            </Card>
          ) : null}

          <Caption>
            An automatic bank feed needs an RBI-licensed account aggregator. Until then, import
            statements above.
          </Caption>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

/** Pick the account, paste or choose a statement, file what it can read. */
function ImportCard({ accounts, onDone }: { accounts: Account[]; onDone: () => void }) {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [text, setText] = useState('');
  const [source, setSource] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const pickCsv = async () => {
    setProblem(null);
    setNotice(null);
    const result = await DocumentPicker.getDocumentAsync({
      type: ['text/csv', 'text/comma-separated-values', 'text/plain', 'application/vnd.ms-excel'],
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset) return;
    try {
      setText(await new File(asset.uri).text());
      setSource(asset.name);
    } catch {
      setProblem('Could not read that file. Save the statement as CSV and try again.');
    }
  };

  const importNow = async () => {
    setProblem(null);
    setNotice(null);
    if (!accountId) return setProblem('Pick the account this statement is for.');
    if (!text.trim()) return setProblem('Paste the statement, or choose a CSV file.');
    if (text.length > 4_000_000) {
      return setProblem('That statement is too large. Import one month at a time.');
    }

    // Parsed with the same reader the web uses, so a bank whose export the web
    // understands is not a bank the phone rejects.
    const { lines, problems } = parseStatement(text);
    if (!lines.length) {
      return setProblem(problems[0]?.reason ?? 'Nothing in that looked like a statement line.');
    }

    setBusy(true);
    const { data, error } = await supabase.rpc('import_bank_lines', {
      p_account_id: accountId,
      p_lines: lines,
    });
    setBusy(false);
    if (error) return setProblem(error.message);

    const added = Number(data ?? 0);
    // The database deduplicates, so an overlapping month is safe and says "0
    // new" rather than doubling the money. Unreadable rows are named rather
    // than dropped: a statement that quietly loses three lines is worse than
    // one that refuses, because the totals still look about right.
    setNotice(
      [
        `${added} new ${added === 1 ? 'line' : 'lines'} from ${lines.length} read.`,
        lines.length - added > 0 ? `${lines.length - added} already on file.` : null,
        ...problems.slice(0, 5).map((row) => `Line ${row.row}: ${row.reason}`),
      ]
        .filter(Boolean)
        .join('\n'),
    );
    setText('');
    setSource(null);
    onDone();
  };

  return (
    <Card style={{ gap: spacing.md }}>
      <View style={{ gap: 2 }}>
        <Heading>Import a statement</Heading>
        <Caption>Overlapping months are safe. Lines already imported are skipped.</Caption>
      </View>

      {accounts.length > 1 ? (
        <ChipRow>
          {accounts.map((account) => (
            <Chip
              key={account.id}
              label={account.label}
              selected={accountId === account.id}
              onPress={() => setAccountId(account.id)}
            />
          ))}
        </ChipRow>
      ) : null}

      <Input
        label="Statement"
        value={text}
        onChangeText={(next) => {
          setText(next);
          setSource(null);
        }}
        placeholder={
          'Date,Narration,Withdrawal Amt.,Deposit Amt.\n16/09/26,UPI/6123.../RIA,,2001.00'
        }
        multiline
        numberOfLines={6}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Caption>
        {source ? `Read from ${source}.` : 'Include the header row. Anything above it is ignored.'}
      </Caption>

      <ChipRow>
        <Chip label="Choose a CSV" onPress={pickCsv} disabled={busy} />
      </ChipRow>

      <Button label="Import" onPress={importNow} loading={busy} />
      <ErrorText message={problem} />
      {notice ? <Body muted>{notice}</Body> : null}
    </Card>
  );
}

/** One line the bank posted that nothing in the app explains yet. */
function OpenLine({
  line,
  currency,
  onDone,
}: {
  line: Line;
  currency: string;
  onDone: () => void;
}) {
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [chosen, setChosen] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const incoming = Number(line.amount) > 0;
  const candidate = candidates?.find((row) => row.contribution_id === chosen) ?? null;
  const differs = candidate ? Number(candidate.amount) !== Number(line.amount) : false;

  const look = async () => {
    setBusy('look');
    setProblem(null);
    const { data, error } = await supabase.rpc('bank_line_candidates', {
      p_transaction_id: line.id,
    });
    setBusy(null);
    if (error) return setProblem(error.message);
    // A set-returning function's columns are all nullable to the type
    // generator; one without an id could not be matched anyway.
    const rows = (data ?? []).flatMap((row) =>
      row.contribution_id
        ? [
            {
              contribution_id: row.contribution_id,
              payer: row.payer ?? 'A resident',
              amount: Number(row.amount ?? 0),
              reference: row.reference,
              confidence: row.confidence ?? 'close',
            },
          ]
        : [],
    );
    setCandidates(rows);
    setChosen(rows[0]?.contribution_id ?? '');
  };

  const confirm = async (takeBankAmount: boolean) => {
    if (!chosen) return;
    setBusy('confirm');
    setProblem(null);
    const { error } = await supabase.rpc('reconcile_bank_line', {
      p_transaction_id: line.id,
      p_contribution_id: chosen,
      p_take_bank_amount: takeBankAmount,
    });
    setBusy(null);
    if (error) return setProblem(error.message);
    onDone();
  };

  const setAside = async () => {
    if (!reason.trim()) return setProblem('Say what this line was.');
    setBusy('aside');
    setProblem(null);
    const { error } = await supabase.rpc('ignore_bank_line', {
      p_transaction_id: line.id,
      p_reason: reason.trim().slice(0, 200),
    });
    setBusy(null);
    if (error) return setProblem(error.message);
    onDone();
  };

  return (
    <Card style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Body>
            {incoming ? '+' : '−'}
            {formatMoney(Math.abs(Number(line.amount)), currency)} · {formatDate(line.posted_on)}
          </Body>
          <Caption>{line.narration ?? 'No narration'}</Caption>
          {line.reference ? <Caption>UTR {line.reference}</Caption> : null}
          {/* The payer kept the note Compences put on the payment, so the line
              says which flat sent it — the question this screen is for. */}
          {flatTagIn(line.narration) ? <Body>Names flat {flatTagIn(line.narration)}</Body> : null}
        </View>
        <Badge
          label={incoming ? 'Money in' : 'Money out'}
          tone={incoming ? 'success' : 'warning'}
        />
      </View>

      {incoming ? (
        candidates === null ? (
          <ChipRow>
            <Chip
              label={busy === 'look' ? 'Looking…' : 'Find the payment'}
              onPress={look}
              disabled={busy !== null}
            />
          </ChipRow>
        ) : candidates.length ? (
          <View style={{ gap: spacing.sm }}>
            <ChipRow>
              {candidates.map((row) => (
                <Chip
                  key={row.contribution_id}
                  label={`${row.payer} · ${formatMoney(row.amount, currency)}${
                    MATCH_CONFIDENCE[row.confidence] ? ` · ${MATCH_CONFIDENCE[row.confidence]}` : ''
                  }`}
                  selected={chosen === row.contribution_id}
                  onPress={() => setChosen(row.contribution_id)}
                />
              ))}
            </ChipRow>
            <Button
              label="Confirm"
              onPress={() => confirm(false)}
              loading={busy === 'confirm'}
              disabled={!chosen}
            />
            {differs && candidate ? (
              <>
                <Button
                  label={`Confirm as ${formatMoney(Number(line.amount), currency)}`}
                  variant="secondary"
                  onPress={() => confirm(true)}
                  loading={busy === 'confirm'}
                />
                <Caption>
                  They reported {formatMoney(Number(candidate.amount), currency)}; the bank shows{' '}
                  {formatMoney(Number(line.amount), currency)}. Confirming keeps their figure and
                  notes the gap.
                </Caption>
              </>
            ) : null}
          </View>
        ) : (
          <Caption>No reported payment matches this. Ask around, or set it aside.</Caption>
        )
      ) : (
        <Caption>Money out can’t be matched to a bill yet. Set it aside with what it was.</Caption>
      )}

      <Input
        value={reason}
        onChangeText={setReason}
        placeholder="Bank charge, interest, own transfer…"
      />
      <Button label="Set aside" variant="secondary" onPress={setAside} loading={busy === 'aside'} />
      <ErrorText message={problem} />
    </Card>
  );
}

/** A line already paired or written off, and who decided. */
function SettledLine({
  line,
  currency,
  mayUndo,
  onDone,
}: {
  line: Line;
  currency: string;
  mayUndo: boolean;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const undo = async () => {
    setBusy(true);
    setProblem(null);
    const { error } = await supabase.rpc('unreconcile_bank_line', { p_transaction_id: line.id });
    setBusy(false);
    if (error) return setProblem(error.message);
    onDone();
  };

  return (
    <Card style={{ gap: spacing.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Body>
            {Number(line.amount) > 0 ? '+' : '−'}
            {formatMoney(Math.abs(Number(line.amount)), currency)} · {formatDate(line.posted_on)}
          </Body>
          <Caption>{line.ignored_reason ?? line.narration ?? 'Matched'}</Caption>
          {line.matched_at ? (
            <Caption>
              Matched by {line.matcher?.profiles?.full_name ?? 'staff'} ·{' '}
              {relativeTime(line.matched_at)}
            </Caption>
          ) : null}
        </View>
        <Badge
          label={line.contribution_id ? 'Matched' : 'Set aside'}
          tone={line.contribution_id ? 'success' : undefined}
        />
      </View>
      {line.contribution_id && mayUndo ? (
        <>
          {/* Committee only, and the database says so too: residents have
              already seen the fund total move, so taking it back needs the
              people whose names are on the accounts. */}
          <Button label="Undo match" variant="secondary" onPress={undo} loading={busy} />
          <ErrorText message={problem} />
        </>
      ) : null}
    </Card>
  );
}

/** The committee names an account a statement can be imported against. */
function AddAccountForm({ onDone }: { onDone: () => void }) {
  const { activeCommunity, membershipId } = useAuth();
  const [label, setLabel] = useState('');
  const [bankName, setBankName] = useState('');
  const [last4, setLast4] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const add = async () => {
    setProblem(null);
    if (!label.trim()) return setProblem('Give the account a name.');
    if (last4 && !/^\d{4}$/.test(last4))
      return setProblem('The last four digits, or leave it blank.');
    if (!activeCommunity) return;

    setBusy(true);
    const { error } = await supabase.from('bank_accounts').insert({
      community_id: activeCommunity.id,
      label: label.trim().slice(0, 80),
      bank_name: bankName.trim().slice(0, 80) || null,
      last4: last4 || null,
      created_by: membershipId,
    });
    setBusy(false);
    if (error) return setProblem(error.message);
    setLabel('');
    setBankName('');
    setLast4('');
    onDone();
  };

  return (
    <View style={{ gap: spacing.sm }}>
      <Input label="Name" value={label} onChangeText={setLabel} placeholder="Society current a/c" />
      <Input label="Bank" value={bankName} onChangeText={setBankName} placeholder="HDFC" />
      <Input
        label="Last four digits"
        value={last4}
        onChangeText={setLast4}
        placeholder="4821"
        keyboardType="number-pad"
        maxLength={4}
      />
      <Button label="Add account" onPress={add} loading={busy} />
      <ErrorText message={problem} />
    </View>
  );
}
