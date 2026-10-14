import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { CATALOGUE_KIND_LABEL, can, type CatalogueKind } from '@compences/core';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { useCommunityData } from '../lib/use-community-data';
import { spacing, tapSlop } from '../lib/theme';
import { useTheme } from '../lib/use-theme';
import { Body, Button, Caption, Input } from './ui';
import { Chip, ChipRow, ErrorText } from './admin-ui';

export type CatalogueItem = {
  id: string;
  kind: string;
  label: string;
  emoji: string | null;
  details: unknown;
  position: number;
  is_active: boolean;
};

export const catalogueKey = (kind: CatalogueKind) => `catalogue:${kind}`;

/** Active items of one kind, in the committee's order. */
export function useCatalogue(kind: CatalogueKind) {
  return useCommunityData(catalogueKey(kind), async (communityId) => {
    const { data } = await supabase
      .from('catalogue_items')
      .select('id, kind, label, emoji, details, position, is_active')
      .eq('community_id', communityId)
      .eq('kind', kind)
      .eq('is_active', true)
      .order('position')
      .order('label');
    return (data ?? []) as CatalogueItem[];
  });
}

export const itemText = (item: { label: string }) => item.label;

/** Friendly text for the unique-label constraint on catalogue_items. */
export function catalogueError(
  error: { code?: string; message: string },
  kind: CatalogueKind,
  label: string,
) {
  if (error.code === '23505') {
    return `There’s already a ${CATALOGUE_KIND_LABEL[kind].singular.toLowerCase()} called “${label.trim()}”.`;
  }
  return error.message;
}

/**
 * Pick one catalogue item, stored as both its id and its label. A value that was
 * typed before the catalogue existed still shows, selected, so an old bill can
 * be saved without losing its category. `preferred` labels sort first.
 */
export function CataloguePicker({
  kind,
  label,
  valueId,
  valueLabel,
  onChange,
  allowAdd = false,
  preferred = [],
}: {
  kind: CatalogueKind;
  label: string;
  valueId: string | null;
  valueLabel: string | null;
  onChange: (next: { id: string | null; label: string | null }) => void;
  allowAdd?: boolean;
  preferred?: string[];
}) {
  const queryClient = useQueryClient();
  const { activeCommunity, user } = useAuth();
  const { data: items, loading } = useCatalogue(kind);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sorted = [...(items ?? [])].sort((a, b) => {
    const pa = preferred.includes(a.label) ? 0 : 1;
    const pb = preferred.includes(b.label) ? 0 : 1;
    return pa - pb || a.position - b.position;
  });
  const legacy =
    valueLabel && !sorted.some((item) => item.id === valueId || item.label === valueLabel)
      ? valueLabel
      : null;
  const singular = CATALOGUE_KIND_LABEL[kind].singular.toLowerCase();

  const add = async () => {
    const text = draft.trim();
    if (!text || !activeCommunity) {
      setError(`Name the ${singular}.`);
      return;
    }
    setBusy(true);
    setError(null);
    const { data, error: insertError } = await supabase
      .from('catalogue_items')
      .insert({
        community_id: activeCommunity.id,
        kind,
        label: text,
        position: (items?.length ?? 0) + 1,
        created_by: user?.id ?? null,
      })
      .select('id, label')
      .single();
    setBusy(false);
    if (insertError || !data) {
      setError(insertError ? catalogueError(insertError, kind, text) : 'Could not add that.');
      return;
    }
    await queryClient.invalidateQueries({ queryKey: [catalogueKey(kind)] });
    onChange({ id: data.id, label: data.label });
    setDraft('');
    setAdding(false);
  };

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
        <Body>{label}</Body>
        <ManageCatalogueLink />
      </View>
      {loading && !items ? <Caption>Loading…</Caption> : null}
      <ChipRow>
        {legacy ? <Chip label={legacy} selected onPress={() => undefined} /> : null}
        {sorted.map((item) => (
          <Chip
            key={item.id}
            label={itemText(item)}
            selected={valueId === item.id || (!valueId && valueLabel === item.label)}
            onPress={() =>
              valueId === item.id
                ? onChange({ id: null, label: null })
                : onChange({ id: item.id, label: item.label })
            }
          />
        ))}
        {allowAdd && !adding ? (
          <Chip label={`+ Add ${singular}`} onPress={() => setAdding(true)} />
        ) : null}
      </ChipRow>
      {!loading && !sorted.length && !allowAdd ? (
        <Caption>
          No {CATALOGUE_KIND_LABEL[kind].title.toLowerCase()} yet. Tap Manage to add them.
        </Caption>
      ) : null}
      {adding ? (
        <View style={{ gap: spacing.sm }}>
          <Input
            label={`New ${singular}`}
            value={draft}
            onChangeText={setDraft}
            autoFocus
            placeholder={kind === 'vendor' ? 'Shubh Tent House' : 'Name'}
          />
          <ErrorText message={error} />
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Button label="Add" onPress={() => void add()} loading={busy} />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label="Cancel"
                variant="secondary"
                onPress={() => {
                  setAdding(false);
                  setDraft('');
                  setError(null);
                }}
              />
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Staff and the committee keep the catalogue from wherever they meet it: the
 * picker's own "Manage" link opens the catalogue screen.
 */
export function ManageCatalogueLink() {
  const router = useRouter();
  const { colors } = useTheme();
  const { role } = useAuth();
  if (!can(role, 'events:manage')) return null;
  return (
    <Pressable
      accessibilityRole="link"
      hitSlop={tapSlop}
      onPress={() => router.push('/admin/catalogue')}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '600' }}>Manage</Text>
    </Pressable>
  );
}
