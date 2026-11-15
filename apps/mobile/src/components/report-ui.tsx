import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import {
  REPORT_PROMISE,
  REPORT_REASONS,
  REPORT_REASON_LABEL,
  REPORT_SENT,
  REPORT_SUBJECT_NOUN,
  blockExplainer,
  type ReportReason,
  type ReportSubject,
} from '@compences/core';
import { useAuth } from '../lib/auth';
import { blockMember, fileReport, invalidateAfterModeration } from '../lib/reports';
import { spacing, tapSlop } from '../lib/theme';
import { useTheme } from '../lib/use-theme';
import { Button, Caption, Input } from './ui';
import { Chip, ChipRow, ErrorText } from './admin-ui';

/** A quiet inline link: these sit under somebody's post and should not shout. */
function QuietLink({
  label,
  onPress,
  hint,
}: {
  label: string;
  onPress: () => void;
  hint?: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      onPress={onPress}
      hitSlop={tapSlop}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
    >
      <Text style={{ color: colors.inkMuted, fontSize: 13, textDecorationLine: 'underline' }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** "Chitra", from "Chitra Rao": a button that says "Block Chitra" reads like a person. */
const firstName = (name: string) => name.trim().split(/\s+/)[0] || 'them';

/**
 * Report and Block, under a listing or a review somebody else wrote.
 *
 * Both app stores expect these wherever residents post. They open in place
 * rather than on a sheet: the thing being reported stays on screen above the
 * form, which is what somebody needs to look at while saying what is wrong
 * with it.
 *
 * Nobody is told who reported or who blocked — the database does not show it
 * even to the committee — and the form says so, because "will they know it
 * was me?" is the question that stops a neighbour from reporting at all.
 */
export function ReportControls({
  kind,
  subjectId,
  authorId,
  authorName,
  onBlocked,
}: {
  kind: ReportSubject;
  subjectId: string;
  /** The membership of whoever posted it; who Block blocks. */
  authorId: string;
  authorName: string;
  /** After a block, when the screen itself is about to have nothing to show. */
  onBlocked?: () => void;
}) {
  const queryClient = useQueryClient();
  const { activeCommunity, membershipId } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  if (!activeCommunity || !membershipId || authorId === membershipId) return null;
  const who = firstName(authorName);
  const ids = { communityId: activeCommunity.id, membershipId };

  const block = async () => {
    const blockError = await blockMember({ ...ids, blockedId: authorId });
    if (blockError) {
      setError(blockError);
      return false;
    }
    await invalidateAfterModeration(queryClient);
    onBlocked?.();
    return true;
  };

  const confirmBlock = () =>
    Alert.alert(`Block ${authorName}?`, blockExplainer(who), [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Block',
        style: 'destructive',
        onPress: () => {
          void block().then((blocked) => {
            if (blocked) {
              Alert.alert(`${who} is blocked`, 'You can undo this under Me, in Blocked people.');
            }
          });
        },
      },
    ]);

  const send = async () => {
    if (!reason) {
      setError('Pick what is wrong with it.');
      return;
    }
    setBusy(true);
    setError(null);
    const reportError = await fileReport({
      ...ids,
      kind,
      subjectId,
      reason,
      details: details.trim() || null,
    });
    if (reportError) {
      setBusy(false);
      setError(reportError);
      return;
    }
    setSent(true);
    setOpen(false);
    // The report is in either way; a block that fails says so under it.
    if (alsoBlock) await block();
    setBusy(false);
  };

  if (sent) {
    return (
      <View style={{ gap: spacing.xs }}>
        <Caption>{REPORT_SENT}</Caption>
        <ErrorText message={error} />
      </View>
    );
  }

  if (!open) {
    return (
      <View style={{ gap: spacing.xs }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg }}>
          <QuietLink
            label={`Report this ${REPORT_SUBJECT_NOUN[kind]}`}
            hint="Tells the committee it should not be here"
            onPress={() => {
              setError(null);
              setOpen(true);
            }}
          />
          <QuietLink
            label={`Block ${who}`}
            hint="Hides what they post from you"
            onPress={confirmBlock}
          />
        </View>
        <ErrorText message={error} />
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.sm }}>
      <Caption>WHAT IS WRONG WITH THIS {REPORT_SUBJECT_NOUN[kind].toUpperCase()}?</Caption>
      <ChipRow>
        {REPORT_REASONS.map((option) => (
          <Chip
            key={option}
            label={REPORT_REASON_LABEL[option]}
            selected={reason === option}
            onPress={() => {
              setReason(option);
              setError(null);
            }}
            disabled={busy}
          />
        ))}
      </ChipRow>
      <Input
        value={details}
        onChangeText={setDetails}
        placeholder="Anything the committee should know (optional)"
        accessibilityLabel="Anything the committee should know"
        multiline
        maxLength={500}
        style={{ minHeight: 72, textAlignVertical: 'top' }}
      />
      <ChipRow>
        <Chip
          label={alsoBlock ? `Also block ${who} ✓` : `Also block ${who}`}
          selected={alsoBlock}
          onPress={() => setAlsoBlock((current) => !current)}
          disabled={busy}
        />
      </ChipRow>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Button
            label="Cancel"
            variant="secondary"
            onPress={() => {
              setOpen(false);
              setError(null);
            }}
            disabled={busy}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button label="Report" onPress={() => void send()} loading={busy} />
        </View>
      </View>
      <ErrorText message={error} />
      <Caption>{REPORT_PROMISE}</Caption>
    </View>
  );
}
