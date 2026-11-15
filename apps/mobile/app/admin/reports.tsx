import { useState } from 'react';
import { Alert, RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  REPORT_DECISION,
  can,
  formatDate,
  reportCountLabel,
  reportHeading,
  reportReasonsLine,
  type ReportToReview,
} from '@compences/core';
import { useAuth } from '../../src/lib/auth';
import {
  fetchReportsToReview,
  invalidateAfterModeration,
  resolveReport,
} from '../../src/lib/reports';
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
import { ErrorText, LinkRow } from '../../src/components/admin-ui';
import { spacing } from '../../src/lib/theme';

/**
 * What neighbours have reported, for staff and the committee to decide:
 * take it down, or leave it up. One card per thing reported, however many
 * reported it, the longest-waiting first.
 *
 * Who reported is not here and is not available to this screen at all — the
 * database leaves it out. Reports about something the viewer posted are left
 * out too; somebody else on the committee decides those.
 *
 * Both stores expect a report to be acted on within a day, which is why a new
 * one sends a push and sits near the top of To do.
 */
export default function Reports() {
  const { role } = useAuth();
  const allowed = can(role, 'reports:review');

  const { data, loading, refreshing, refresh, error } = useCommunityData(
    'admin:reports',
    fetchReportsToReview,
  );

  if (!allowed) {
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

  const reports = data ?? [];

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        keyboardShouldPersistTaps="handled"
      >
        <Caption>
          Please decide each one within 24 hours. Whoever reported it is told what you decided;
          whoever posted it is told only if it comes down, and never who reported it.
        </Caption>
        {error ? <Caption tone="danger">{error}</Caption> : null}
        {reports.length ? (
          reports.map((report) => <ReportCard key={report.id} report={report} />)
        ) : (
          <Card>
            <EmptyState
              title="Nothing reported"
              description="When a neighbour reports a listing, a review or a comment, it appears here."
            />
          </Card>
        )}
        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </Screen>
  );
}

function ReportCard({ report }: { report: ReportToReview }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [removing, setRemoving] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<'remove' | 'keep' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const words = REPORT_DECISION[report.kind];

  const decide = async (remove: boolean) => {
    setBusy(remove ? 'remove' : 'keep');
    setError(null);
    const decideError = await resolveReport(report.id, remove, remove ? note : '');
    if (decideError) {
      setBusy(null);
      setError(decideError);
      // Somebody else may have decided it meanwhile; show what is true now.
      void queryClient.invalidateQueries({ queryKey: ['admin:reports'] });
      return;
    }
    await invalidateAfterModeration(queryClient);
  };

  const keep = () =>
    report.kind === 'member'
      ? void decide(false)
      : Alert.alert(
          'Leave it up?',
          'The report is closed, and whoever reported it is told it was looked at.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: words.keep, onPress: () => void decide(false) },
          ],
        );

  return (
    <Card style={{ gap: spacing.sm }}>
      <View style={{ gap: 2 }}>
        <Heading>{reportHeading(report)}</Heading>
        <Caption>
          {[
            reportCountLabel(report),
            report.createdAt ? formatDate(report.createdAt.slice(0, 10)) : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </Caption>
      </View>

      {report.excerpt ? <Body>“{report.excerpt}”</Body> : null}
      {report.kind === 'member' ? (
        <Body muted>
          Nothing was reported with it. It is here so you know, in case it is one of several.
        </Body>
      ) : (
        <Caption>{reportReasonsLine(report.reasons)}</Caption>
      )}
      {report.details.map((detail, index) => (
        <Body key={index} muted>
          A neighbour added: “{detail}”
        </Body>
      ))}

      {report.listingId ? (
        <LinkRow
          label={report.kind === 'review' ? 'Open the listing it is on' : 'Open the listing'}
          onPress={() =>
            router.push({ pathname: '/listing/[id]', params: { id: report.listingId ?? '' } })
          }
        />
      ) : null}
      {report.kind === 'comment' ? (
        <Caption>
          Comments are read on the website
          {report.eventSlug ? ', under the event it was posted on' : ''}. What it said is above.
        </Caption>
      ) : null}
      {report.kind === 'member' && report.memberId ? (
        <LinkRow
          label={`Open ${report.authorName}`}
          onPress={() => router.push(`/admin/member/${report.memberId}`)}
        />
      ) : null}

      {removing ? (
        <View style={{ gap: spacing.sm }}>
          <Input
            label={words.noteLabel}
            value={note}
            onChangeText={setNote}
            placeholder={words.notePlaceholder}
            multiline
            maxLength={500}
          />
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Button
                label="Cancel"
                variant="secondary"
                onPress={() => {
                  setRemoving(false);
                  setError(null);
                }}
                disabled={busy !== null}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label={words.remove}
                onPress={() => void decide(true)}
                loading={busy === 'remove'}
              />
            </View>
          </View>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Button
              label={words.keep}
              variant="secondary"
              onPress={keep}
              loading={busy === 'keep'}
              disabled={busy !== null}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              label={words.remove}
              onPress={() => setRemoving(true)}
              disabled={busy !== null}
            />
          </View>
        </View>
      )}
      <ErrorText message={error} />
    </Card>
  );
}
