import { useState } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  CATALOGUE_KINDS,
  CATALOGUE_KIND_LABEL,
  can,
  catalogueItemSchema,
  type CatalogueKind,
} from '@compences/core';
import { useAuth } from '../../src/lib/auth';
import { supabase } from '../../src/lib/supabase';
import { useCommunityData } from '../../src/lib/use-community-data';
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
  Title,
} from '../../src/components/ui';
import { Chip, ChipRow, ErrorText } from '../../src/components/admin-ui';
import {
  catalogueError,
  catalogueKey,
  itemText,
  type CatalogueItem,
} from '../../src/components/catalogue-ui';
import { spacing } from '../../src/lib/theme';

type Draft = {
  id: string | null;
  kind: CatalogueKind;
  label: string;
  emoji: string;
  phone: string;
  upi: string;
  capacity: string;
};

const emptyDraft = (kind: CatalogueKind): Draft => ({
  id: null,
  kind,
  label: '',
  emoji: '',
  phone: '',
  upi: '',
  capacity: '',
});

const detail = (item: CatalogueItem, key: string) => {
  const details = (item.details ?? {}) as Record<string, unknown>;
  const value = details[key];
  return value === undefined || value === null ? '' : String(value);
};

/**
 * The lists events and bills pick from: event types, budget and bill
 * categories, venues, activity types and vendors. Staff and committee keep it
 * current; residents only ever see the choices.
 */
export default function Catalogue() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { setup } = useLocalSearchParams<{ setup?: string }>();
  const { role, activeCommunity, refresh: refreshAuth } = useAuth();
  const [kind, setKind] = useState<CatalogueKind>('budget_category');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data, loading, refreshing, refresh } = useCommunityData(
    'admin:catalogue',
    async (communityId) => {
      const { data: rows } = await supabase
        .from('catalogue_items')
        .select('id, kind, label, emoji, details, position, is_active')
        .eq('community_id', communityId)
        .order('position')
        .order('label');
      return (rows ?? []) as CatalogueItem[];
    },
  );

  if (!can(role, 'events:manage')) {
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

  const items = (data ?? []).filter((item) => item.kind === kind);
  const active = items.filter((item) => item.is_active);
  const archived = items.filter((item) => !item.is_active);
  const meta = CATALOGUE_KIND_LABEL[kind];

  const reload = async (changedKind: CatalogueKind) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin:catalogue'] }),
      queryClient.invalidateQueries({ queryKey: [catalogueKey(changedKind)] }),
    ]);
  };

  const save = async () => {
    if (!draft || !activeCommunity) return;
    const parsed = catalogueItemSchema.safeParse({
      kind: draft.kind,
      label: draft.label,
      emoji: draft.emoji,
      phone: draft.phone || undefined,
      upi_vpa: draft.upi || undefined,
      capacity: draft.capacity || undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the details.');
      return;
    }
    const details: Record<string, string | number> = {};
    if (draft.kind === 'vendor') {
      if (parsed.data.phone) details.phone = parsed.data.phone;
      if (parsed.data.upi_vpa) details.upi_vpa = parsed.data.upi_vpa;
    }
    if (draft.kind === 'venue' && parsed.data.capacity) details.capacity = parsed.data.capacity;

    setBusy('save');
    setError(null);
    const fields = { label: parsed.data.label, emoji: parsed.data.emoji, details };
    const { error: saveError } = draft.id
      ? await supabase.from('catalogue_items').update(fields).eq('id', draft.id)
      : await supabase.from('catalogue_items').insert({
          ...fields,
          community_id: activeCommunity.id,
          kind: draft.kind,
          position: active.length + archived.length,
        });
    setBusy(null);
    if (saveError) {
      setError(catalogueError(saveError, draft.kind, parsed.data.label));
      return;
    }
    await reload(draft.kind);
    setDraft(null);
  };

  const setActive = async (item: CatalogueItem, isActive: boolean) => {
    setBusy(item.id);
    setError(null);
    const { error: updateError } = await supabase
      .from('catalogue_items')
      .update({ is_active: isActive })
      .eq('id', item.id);
    setBusy(null);
    if (updateError) setError(updateError.message);
    await reload(kind);
  };

  /** Swap with the neighbour; positions are rewritten for the whole list. */
  const move = async (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= active.length) return;
    const order = [...active];
    const [moved] = order.splice(index, 1);
    if (!moved) return;
    order.splice(target, 0, moved);
    setBusy(moved.id);
    setError(null);
    const results = await Promise.all(
      order.map((item, position) =>
        item.position === position
          ? Promise.resolve({ error: null })
          : supabase.from('catalogue_items').update({ position }).eq('id', item.id),
      ),
    );
    setBusy(null);
    const failed = results.find((result) => result.error);
    if (failed?.error) setError(failed.error.message);
    await reload(kind);
  };

  const markReviewed = async () => {
    if (!activeCommunity) return;
    setBusy('reviewed');
    const { error: updateError } = await supabase
      .from('communities')
      .update({ catalogue_reviewed_at: new Date().toISOString() })
      .eq('id', activeCommunity.id);
    setBusy(null);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    await refreshAuth();
    router.back();
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        >
          <View style={{ gap: 2 }}>
            <Title>Catalogue</Title>
            <Caption>The choices staff pick from when planning events and raising bills.</Caption>
          </View>

          <ChipRow>
            {CATALOGUE_KINDS.map((value) => (
              <Chip
                key={value}
                label={CATALOGUE_KIND_LABEL[value].title}
                selected={kind === value}
                onPress={() => {
                  setKind(value);
                  setDraft(null);
                  setError(null);
                }}
              />
            ))}
          </ChipRow>

          <Card style={{ gap: spacing.md }}>
            <View style={{ gap: 2 }}>
              <Heading>{meta.title}</Heading>
              <Caption>{meta.hint}</Caption>
            </View>

            {draft && draft.kind === kind ? (
              <View style={{ gap: spacing.md }}>
                <Input
                  label={
                    draft.id
                      ? `Rename ${meta.singular.toLowerCase()}`
                      : `New ${meta.singular.toLowerCase()}`
                  }
                  value={draft.label}
                  onChangeText={(label) => setDraft({ ...draft, label })}
                  autoFocus
                />
                {kind === 'vendor' ? (
                  <>
                    <Input
                      label="Phone (optional)"
                      value={draft.phone}
                      onChangeText={(phone) => setDraft({ ...draft, phone })}
                      keyboardType="phone-pad"
                      placeholder="9845012345"
                    />
                    <Input
                      label="Vendor’s UPI ID (optional)"
                      value={draft.upi}
                      onChangeText={(upi) => setDraft({ ...draft, upi })}
                      autoCapitalize="none"
                      autoCorrect={false}
                      placeholder="shubhtents@okaxis"
                    />
                  </>
                ) : null}
                {kind === 'venue' ? (
                  <Input
                    label="Capacity (optional)"
                    value={draft.capacity}
                    onChangeText={(capacity) => setDraft({ ...draft, capacity })}
                    keyboardType="number-pad"
                    placeholder="200"
                  />
                ) : null}
                <ErrorText message={error} />
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <Button label="Save" onPress={() => void save()} loading={busy === 'save'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      label="Cancel"
                      variant="secondary"
                      onPress={() => {
                        setDraft(null);
                        setError(null);
                      }}
                    />
                  </View>
                </View>
              </View>
            ) : (
              <Button
                label={`Add ${meta.singular.toLowerCase()}`}
                variant="secondary"
                onPress={() => {
                  setDraft(emptyDraft(kind));
                  setError(null);
                }}
              />
            )}

            {!draft ? <ErrorText message={error} /> : null}

            {active.length ? (
              active.map((item, index) => (
                <View key={item.id} style={{ gap: spacing.xs }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      gap: spacing.md,
                    }}
                  >
                    <View style={{ flex: 1, gap: 2 }}>
                      <Body>{itemText(item)}</Body>
                      {kind === 'vendor' && (detail(item, 'phone') || detail(item, 'upi_vpa')) ? (
                        <Caption>
                          {[detail(item, 'phone'), detail(item, 'upi_vpa')]
                            .filter(Boolean)
                            .join(' · ')}
                        </Caption>
                      ) : null}
                      {kind === 'venue' && detail(item, 'capacity') ? (
                        <Caption>Up to {detail(item, 'capacity')} people</Caption>
                      ) : null}
                    </View>
                  </View>
                  <ChipRow>
                    <Chip
                      label="↑"
                      disabled={index === 0 || busy !== null}
                      onPress={() => void move(index, -1)}
                    />
                    <Chip
                      label="↓"
                      disabled={index === active.length - 1 || busy !== null}
                      onPress={() => void move(index, 1)}
                    />
                    <Chip
                      label="Edit"
                      onPress={() => {
                        setError(null);
                        setDraft({
                          id: item.id,
                          kind,
                          label: item.label,
                          emoji: item.emoji ?? '',
                          phone: detail(item, 'phone'),
                          upi: detail(item, 'upi_vpa'),
                          capacity: detail(item, 'capacity'),
                        });
                      }}
                    />
                    <Chip
                      label="Archive"
                      disabled={busy !== null}
                      onPress={() => void setActive(item, false)}
                    />
                  </ChipRow>
                </View>
              ))
            ) : (
              <Caption>Nothing here yet.</Caption>
            )}
          </Card>

          {archived.length ? (
            <Card style={{ gap: spacing.md }}>
              <Heading>Archived</Heading>
              <Caption>Hidden from pickers. Past bills and events keep their names.</Caption>
              {archived.map((item) => (
                <View
                  key={item.id}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <Body muted>{itemText(item)}</Body>
                    <Badge label="Archived" />
                  </View>
                  <Chip
                    label="Restore"
                    disabled={busy !== null}
                    onPress={() => void setActive(item, true)}
                  />
                </View>
              ))}
            </Card>
          ) : null}

          {can(role, 'roles:manage') &&
          (setup === '1' || !activeCommunity?.catalogue_reviewed_at) ? (
            <Card style={{ gap: spacing.sm }}>
              <Heading>Setup</Heading>
              <Body muted>
                {activeCommunity?.catalogue_reviewed_at
                  ? 'Catalogue confirmed. Edit it any time.'
                  : 'Confirm once these lists suit your society.'}
              </Body>
              {!activeCommunity?.catalogue_reviewed_at ? (
                <Button
                  label="This looks right"
                  onPress={() => void markReviewed()}
                  loading={busy === 'reviewed'}
                />
              ) : null}
            </Card>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
