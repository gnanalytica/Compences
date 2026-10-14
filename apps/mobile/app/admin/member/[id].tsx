import { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  ASSIGNABLE_ROLES,
  ROLE_DESCRIPTION,
  ROLE_LABEL,
  can,
  normalizeRole,
  setMemberUnitMessage,
  unitLabel,
  type Role,
} from '@compences/core';
import { useAuth } from '../../../src/lib/auth';
import { supabase } from '../../../src/lib/supabase';
import { useCommunityData } from '../../../src/lib/use-community-data';
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
} from '../../../src/components/ui';
import { Chip, ChipRow, ErrorText } from '../../../src/components/admin-ui';
import { spacing } from '../../../src/lib/theme';

/**
 * One member. Staff can remove a resident who has left; the committee can also
 * change anyone's role. The database enforces both, and keeps at least one
 * committee member in every society.
 */
export default function EditMember() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { role, membershipId, refresh: refreshAuth } = useAuth();

  const { data, loading } = useCommunityData(`admin:member:${id}`, async (communityId) => {
    // The member, and the flats the committee can move them between. Two reads
    // rather than one: the flat list is the society's, not this member's.
    const [{ data: row }, { data: flats }] = await Promise.all([
      supabase
        .from('memberships')
        .select(
          // Contact details are staff-only and come from society_people(); a plain
          // select of profiles.email is no longer granted to any client.
          'id, role, joined_at, profiles(full_name), unit_occupants(unit_id, relation, moved_out_on, units(block, number))',
        )
        .eq('community_id', communityId)
        .eq('id', String(id))
        .maybeSingle(),
      supabase
        .from('units')
        .select('id, block, number')
        .eq('community_id', communityId)
        .order('block')
        .order('number')
        .limit(5000),
    ]);
    return row ? { ...row, flats: flats ?? [] } : null;
  });

  if (!can(role, 'residents:remove')) {
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

  if (!data) {
    return (
      <Screen>
        <EmptyState title="Resident not found" description="They may already have been removed." />
      </Screen>
    );
  }

  return (
    <MemberEditor
      key={data.role}
      member={data}
      isSelf={data.id === membershipId}
      mayManageRoles={can(role, 'roles:manage')}
      onSelfChanged={refreshAuth}
    />
  );
}

type MemberRow = {
  id: string;
  role: Parameters<typeof normalizeRole>[0];
  joined_at: string;
  profiles: { full_name: string | null } | null;
  unit_occupants: {
    unit_id: string;
    relation: string;
    moved_out_on: string | null;
    units: { block: string | null; number: string } | null;
  }[];
  flats: { id: string; block: string | null; number: string }[];
};

function MemberEditor({
  member,
  isSelf,
  mayManageRoles,
  onSelfChanged,
}: {
  member: MemberRow;
  isSelf: boolean;
  mayManageRoles: boolean;
  onSelfChanged: () => Promise<void>;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const current = normalizeRole(member.role) ?? 'resident';
  const [nextRole, setNextRole] = useState<Role>(current);
  const [busy, setBusy] = useState<'save' | 'remove' | 'flat' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flatQuery, setFlatQuery] = useState('');

  const name = member.profiles?.full_name ?? 'This resident';
  const here = member.unit_occupants.filter((row) => row.moved_out_on === null);
  const flats = here
    .filter((row) => row.units)
    .map((row) => `Flat ${unitLabel(row.units)} · ${row.relation}`);
  const mayRemove = !isSelf && (current === 'resident' || mayManageRoles);
  const seated = here.find((row) => row.units)
    ? unitLabel(here.find((row) => row.units)!.units)
    : null;

  // Narrowed on the normalised label, so "a703", "A 703" and "a-703" all find
  // the same flat — the same shapes app.split_flat() reads.
  const needle = flatQuery.replace(/[^a-z0-9]/gi, '').toUpperCase();
  const found = needle
    ? member.flats.filter((flat) =>
        `${flat.block ?? ''}${flat.number}`
          .replace(/[^a-z0-9]/gi, '')
          .toUpperCase()
          .includes(needle),
      )
    : [];
  const matchCount = found.length;
  const matches = found.slice(0, 24);

  const afterChange = async () => {
    await queryClient.invalidateQueries({ queryKey: ['admin:members'] });
    await queryClient.invalidateQueries({ queryKey: [`admin:member:${member.id}`] });
    if (isSelf) await onSelfChanged();
  };

  const saveRole = async () => {
    setBusy('save');
    setError(null);
    const { error: updateError } = await supabase
      .from('memberships')
      .update({ role: nextRole })
      .eq('id', member.id);
    setBusy(null);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    await afterChange();
    router.back();
  };

  const saveFlat = async (unitId: string | null) => {
    setBusy('flat');
    setError(null);
    const { data: result, error: rpcError } = await supabase.rpc('set_member_unit', {
      p_membership_id: member.id,
      p_unit_id: unitId ?? undefined,
    });
    setBusy(null);
    if (rpcError || result !== 'ok') {
      setError(rpcError?.message ?? setMemberUnitMessage(result ?? ''));
      return;
    }
    setFlatQuery('');
    await afterChange();
  };

  const remove = async () => {
    setBusy('remove');
    setError(null);
    const { error: deleteError, count } = await supabase
      .from('memberships')
      .delete({ count: 'exact' })
      .eq('id', member.id);
    setBusy(null);
    if (deleteError || count === 0) {
      setError(deleteError?.message ?? 'You can’t remove this resident.');
      return;
    }
    await afterChange();
    router.back();
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <View style={{ gap: 2 }}>
          <Title>{name}</Title>
          <Caption>{ROLE_LABEL[current]}</Caption>
          {flats.map((flat) => (
            <Caption key={flat}>{flat}</Caption>
          ))}
        </View>

        {mayManageRoles ? (
          <Card style={{ gap: spacing.md }}>
            <Heading>Role</Heading>
            <ChipRow>
              {ASSIGNABLE_ROLES.map((option) => (
                <Chip
                  key={option}
                  label={ROLE_LABEL[option]}
                  selected={nextRole === option}
                  onPress={() => setNextRole(option)}
                  disabled={busy !== null}
                />
              ))}
            </ChipRow>
            <Caption>{ROLE_DESCRIPTION[nextRole]}</Caption>
            {isSelf ? <Caption>You can lower your own role but not raise it.</Caption> : null}
            <Button
              label="Save role"
              onPress={() => void saveRole()}
              loading={busy === 'save'}
              disabled={nextRole === current}
            />
          </Card>
        ) : null}

        {/* A committee member on their phone could not seat anybody: the flats
            screen counts occupants without being able to add one, and the two
            paths that do seat somebody both happen at the moment of joining.
            Filtered rather than listed, because a society is hundreds of flats
            and a wall of chips is not a picker. */}
        {mayManageRoles ? (
          <Card style={{ gap: spacing.md }}>
            <Heading>Flat</Heading>
            <Body muted>
              {seated
                ? `Listed at ${seated}. Past payments stay with the old flat if you move them.`
                : 'Not listed at any flat. Their payments show no flat.'}
            </Body>
            <Input
              label="Find a flat"
              value={flatQuery}
              onChangeText={setFlatQuery}
              placeholder="A 703"
              autoCapitalize="characters"
            />
            {flatQuery.trim() ? (
              matches.length ? (
                <ChipRow>
                  {matches.map((flat) => (
                    <Chip
                      key={flat.id}
                      label={unitLabel(flat)}
                      selected={here.some((row) => row.unit_id === flat.id)}
                      disabled={busy !== null}
                      onPress={() => void saveFlat(flat.id)}
                    />
                  ))}
                </ChipRow>
              ) : (
                <Caption>No flat matches that.</Caption>
              )
            ) : (
              <Caption>{member.flats.length} flats in this society. Type part of one.</Caption>
            )}
            {matchCount > matches.length ? (
              <Caption>
                Showing {matches.length} of {matchCount}. Type more to narrow it.
              </Caption>
            ) : null}
            {seated ? (
              <Button
                label="Take them out of their flat"
                variant="secondary"
                loading={busy === 'flat'}
                disabled={busy !== null}
                onPress={() =>
                  Alert.alert(
                    `Take ${name} out of ${seated}?`,
                    'Past payments stay with this flat.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Take out', onPress: () => void saveFlat(null) },
                    ],
                  )
                }
              />
            ) : null}
          </Card>
        ) : null}

        {mayRemove ? (
          <Card style={{ gap: spacing.sm }}>
            <Heading>Remove from the society</Heading>
            <Body muted>
              For someone who has moved out. They lose access at once and must ask to join again.
              Past contributions stay in the accounts.
            </Body>
            <Button
              label={`Remove ${name}`}
              variant="secondary"
              loading={busy === 'remove'}
              onPress={() =>
                Alert.alert(`Remove ${name}?`, 'They lose access immediately.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Remove', style: 'destructive', onPress: () => void remove() },
                ])
              }
            />
          </Card>
        ) : null}

        <ErrorText message={error} />
      </ScrollView>
    </Screen>
  );
}
