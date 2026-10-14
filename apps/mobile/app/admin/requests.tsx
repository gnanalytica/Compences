import { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { ROLE_LABEL, can, formatDate, unitLabel, type Role } from '@compences/core';
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
} from '../../src/components/ui';
import { Chip, ChipRow, ErrorText } from '../../src/components/admin-ui';
import { spacing } from '../../src/lib/theme';

/**
 * People who entered the society code and are waiting to be let in. Staff
 * admit residents; only the committee can admit someone straight in as staff.
 */
export default function Requests() {
  const queryClient = useQueryClient();
  const { role } = useAuth();

  const { data, loading, refreshing, refresh } = useCommunityData(
    'admin:requests',
    async (communityId) => {
      const { data: rows } = await supabase
        .from('join_requests')
        .select(
          'id, claimed_name, claimed_phone, relation, created_at, units!join_requests_unit_id_fkey(block, number)',
        )
        .eq('community_id', communityId)
        .eq('status', 'pending')
        .order('created_at', { ascending: true });
      return rows ?? [];
    },
  );

  if (!can(role, 'joinrequests:review')) {
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

  const afterChange = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin:requests'] });
    void queryClient.invalidateQueries({ queryKey: ['admin:members'] });
    void queryClient.invalidateQueries({ queryKey: [`home:${role}`] });
    void queryClient.invalidateQueries({ queryKey: [TODO_KEY] });
  };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        <Caption>Check each person against your records before admitting them.</Caption>
        {data?.length ? (
          data.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              mayGrantStaff={can(role, 'roles:manage')}
              onDone={afterChange}
            />
          ))
        ) : (
          <Card>
            <EmptyState title="Nobody is waiting" description="New requests will appear here." />
          </Card>
        )}
      </ScrollView>
    </Screen>
  );
}

type RequestRow = {
  id: string;
  claimed_name: string;
  claimed_phone: string | null;
  relation: string;
  created_at: string;
  units: { block: string | null; number: string } | null;
};

function RequestCard({
  request,
  mayGrantStaff,
  onDone,
}: {
  request: RequestRow;
  mayGrantStaff: boolean;
  onDone: () => void;
}) {
  const [grant, setGrant] = useState<Role>('resident');
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const review = async (approve: boolean) => {
    setBusy(approve ? 'approve' : 'reject');
    setError(null);
    const { error: rpcError } = await supabase.rpc('review_join_request', {
      p_request_id: request.id,
      p_approve: approve,
      p_role: approve ? grant : undefined,
      p_reason: approve ? undefined : reason.trim() || undefined,
    });
    setBusy(null);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    onDone();
  };

  return (
    <Card style={{ gap: spacing.sm }}>
      <Body>{request.claimed_name}</Body>
      <Caption>
        {request.units ? `Flat ${unitLabel(request.units)} · ` : ''}
        {request.relation}
        {request.claimed_phone ? ` · ${request.claimed_phone}` : ''}
      </Caption>
      <Caption>Asked {formatDate(request.created_at.slice(0, 10))}</Caption>

      {mayGrantStaff ? (
        <View style={{ gap: spacing.xs }}>
          <Caption>ADMIT AS</Caption>
          <ChipRow>
            {(['resident', 'staff'] as const).map((option) => (
              <Chip
                key={option}
                label={ROLE_LABEL[option]}
                selected={grant === option}
                onPress={() => setGrant(option)}
              />
            ))}
          </ChipRow>
        </View>
      ) : null}

      {declining ? (
        <View style={{ gap: spacing.sm }}>
          <Input
            label="Reason (shown to them)"
            value={reason}
            onChangeText={setReason}
            placeholder="e.g. We couldn’t match this flat to our records"
          />
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Button label="Cancel" variant="secondary" onPress={() => setDeclining(false)} />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label="Decline"
                onPress={() => void review(false)}
                loading={busy === 'reject'}
              />
            </View>
          </View>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Button label="Decline" variant="secondary" onPress={() => setDeclining(true)} />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              label={`Admit${grant === 'staff' ? ' as staff' : ''}`}
              onPress={() => void review(true)}
              loading={busy === 'approve'}
            />
          </View>
        </View>
      )}
      <ErrorText message={error} />
    </Card>
  );
}
