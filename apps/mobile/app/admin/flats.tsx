import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  View,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import {
  can,
  flatGeneratorSchema,
  generateFlats,
  parseFlatsCsv,
  unitLabel,
  type FlatRow,
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
  Title,
} from '../../src/components/ui';
import { Chip, ChipRow, ErrorText } from '../../src/components/admin-ui';
import { spacing } from '../../src/lib/theme';

type UnitRow = {
  id: string;
  block: string | null;
  number: string;
  floor: number | null;
  bedrooms: number | null;
  occupants: number;
};

const keyOf = (flat: { block: string | null; number: string }) =>
  `${(flat.block ?? '').toUpperCase()}|${flat.number.toUpperCase()}`;

const SHOW_PER_TOWER = 40;

/**
 * The society's flats. Residents pick from these when they join, so the
 * committee sets them up once: generate towers × floors × flats, or import a
 * spreadsheet. Staff can see the list; only the committee changes it.
 */
export default function Flats() {
  const queryClient = useQueryClient();
  const { role, activeCommunity } = useAuth();
  const mayEdit = can(role, 'roles:manage');

  const [mode, setMode] = useState<'list' | 'generate' | 'import'>('list');
  const [towers, setTowers] = useState('A, B');
  const [floors, setFloors] = useState('');
  const [perFloor, setPerFloor] = useState('');
  const [ground, setGround] = useState(false);
  const [preview, setPreview] = useState<{
    rows: FlatRow[];
    errors: string[];
    source: string;
  } | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const { data, loading, refreshing, refresh } = useCommunityData(
    'admin:flats',
    async (communityId) => {
      const { data: rows } = await supabase
        .from('units')
        .select('id, block, number, floor, bedrooms, unit_occupants(count)')
        .eq('community_id', communityId)
        .order('block', { nullsFirst: true })
        .order('number')
        .limit(5000);
      return (rows ?? []).map((row) => ({
        id: row.id,
        block: row.block,
        number: row.number,
        floor: row.floor,
        bedrooms: row.bedrooms,
        occupants: (row.unit_occupants as unknown as { count: number }[] | null)?.[0]?.count ?? 0,
      })) as UnitRow[];
    },
  );

  if (!can(role, 'events:manage') || !activeCommunity) {
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

  const units = data ?? [];
  const existing = new Set(units.map(keyOf));
  const byTower = new Map<string, UnitRow[]>();
  for (const unit of units) {
    const tower = unit.block ?? '';
    byTower.set(tower, [...(byTower.get(tower) ?? []), unit]);
  }
  const towerNames = [...byTower.keys()].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );

  const reload = () => queryClient.invalidateQueries({ queryKey: ['admin:flats'] });

  const buildPreview = () => {
    setNotice(null);
    const parsed = flatGeneratorSchema.safeParse({
      towers,
      floors,
      flats_per_floor: perFloor,
      include_ground_floor: ground,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the numbers.');
      return;
    }
    setError(null);
    setPreview({ rows: generateFlats(parsed.data), errors: [], source: 'generator' });
  };

  const pickCsv = async () => {
    setNotice(null);
    setError(null);
    const result = await DocumentPicker.getDocumentAsync({
      type: ['text/csv', 'text/comma-separated-values', 'text/plain', 'application/vnd.ms-excel'],
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset) return;
    try {
      const text = await new File(asset.uri).text();
      const parsed = parseFlatsCsv(text);
      setPreview({ ...parsed, source: asset.name });
    } catch {
      setError('Could not read that file. Save the sheet as CSV and try again.');
    }
  };

  const addFlats = async () => {
    if (!preview) return;
    const fresh = preview.rows.filter((row) => !existing.has(keyOf(row)));
    if (!fresh.length) {
      setNotice('All of these flats already exist. Nothing to add.');
      return;
    }
    setBusy('add');
    setError(null);
    for (let start = 0; start < fresh.length; start += 500) {
      const batch = fresh
        .slice(start, start + 500)
        .map((row) => ({ ...row, community_id: activeCommunity.id }));
      const { error: insertError } = await supabase.from('units').insert(batch);
      if (insertError) {
        setBusy(null);
        setError(
          start > 0
            ? `Added ${start} flats, then stopped: ${insertError.message}`
            : insertError.message,
        );
        await reload();
        return;
      }
    }
    setBusy(null);
    setNotice(
      `Added ${fresh.length} flat${fresh.length === 1 ? '' : 's'}${
        preview.rows.length > fresh.length
          ? `; ${preview.rows.length - fresh.length} already existed`
          : ''
      }.`,
    );
    setPreview(null);
    setMode('list');
    await reload();
  };

  const removeFlat = (unit: UnitRow) => {
    if (!mayEdit) return;
    if (unit.occupants > 0) {
      Alert.alert(
        `Flat ${unitLabel(unit)} has residents`,
        'Remove or move its residents before deleting the flat.',
      );
      return;
    }
    Alert.alert(`Delete flat ${unitLabel(unit)}?`, 'Residents will no longer be able to pick it.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setBusy(unit.id);
            const { error: deleteError } = await supabase.from('units').delete().eq('id', unit.id);
            setBusy(null);
            if (deleteError) setError(deleteError.message);
            await reload();
          })();
        },
      },
    ]);
  };

  const fresh = preview ? preview.rows.filter((row) => !existing.has(keyOf(row))) : [];

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
            <Title>Flats</Title>
            <Caption>
              {units.length} flat{units.length === 1 ? '' : 's'}
              {towerNames.length
                ? ` across ${towerNames.length} tower${towerNames.length === 1 ? '' : 's'}`
                : ''}
              . Residents pick from this list when they join.
            </Caption>
          </View>

          {mayEdit ? (
            <ChipRow>
              <Chip label="Flats" selected={mode === 'list'} onPress={() => setMode('list')} />
              <Chip
                label="Generate"
                selected={mode === 'generate'}
                onPress={() => {
                  setMode('generate');
                  setPreview(null);
                }}
              />
              <Chip
                label="Import CSV"
                selected={mode === 'import'}
                onPress={() => {
                  setMode('import');
                  setPreview(null);
                }}
              />
            </ChipRow>
          ) : (
            <Caption>Only the committee can add or remove flats.</Caption>
          )}

          {notice ? (
            <Card>
              <Body>{notice}</Body>
            </Card>
          ) : null}

          {mode === 'generate' && mayEdit ? (
            <Card style={{ gap: spacing.md }}>
              <Heading>Generate flats</Heading>
              <Caption>
                Numbered by floor: 101 is floor 1, flat 1; 1104 is floor 11, flat 4.
              </Caption>
              <Input
                label="Towers"
                value={towers}
                onChangeText={setTowers}
                autoCapitalize="characters"
                placeholder="A, B, C"
              />
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Floors"
                    value={floors}
                    onChangeText={setFloors}
                    keyboardType="number-pad"
                    placeholder="11"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Flats per floor"
                    value={perFloor}
                    onChangeText={setPerFloor}
                    keyboardType="number-pad"
                    placeholder="10"
                  />
                </View>
              </View>
              <ChipRow>
                <Chip
                  label={ground ? '✓ Ground floor flats (G01…)' : 'Add ground floor flats (G01…)'}
                  selected={ground}
                  onPress={() => setGround(!ground)}
                />
              </ChipRow>
              <Button label="Preview" variant="secondary" onPress={buildPreview} />
            </Card>
          ) : null}

          {mode === 'import' && mayEdit ? (
            <Card style={{ gap: spacing.md }}>
              <Heading>Import from a spreadsheet</Heading>
              <Body muted>
                Save the sheet as CSV with a header row. Needed: a “flat” column, and “tower” if you
                have towers. Optional: floor, bhk, sqft.
              </Body>
              <Caption>
                Example:{'\n'}tower,flat,floor,bhk,sqft{'\n'}A,1104,11,3,1680
              </Caption>
              <Button label="Choose CSV file" variant="secondary" onPress={() => void pickCsv()} />
            </Card>
          ) : null}

          {preview && mode !== 'list' ? (
            <Card style={{ gap: spacing.md }}>
              <Heading>Preview</Heading>
              <Body>
                {preview.rows.length} flat{preview.rows.length === 1 ? '' : 's'} from{' '}
                {preview.source}
                {preview.rows.length !== fresh.length
                  ? ` · ${preview.rows.length - fresh.length} already exist and will be skipped`
                  : ''}
              </Body>
              {preview.errors.length ? (
                <View style={{ gap: 2 }}>
                  <Caption>These lines have problems and will be skipped:</Caption>
                  {preview.errors.slice(0, 10).map((line) => (
                    <ErrorText key={line} message={line} />
                  ))}
                  {preview.errors.length > 10 ? (
                    <Caption>…and {preview.errors.length - 10} more.</Caption>
                  ) : null}
                </View>
              ) : null}
              <ChipRow>
                {fresh.slice(0, 30).map((row) => (
                  <Chip key={keyOf(row)} label={unitLabel(row)} onPress={() => undefined} />
                ))}
              </ChipRow>
              {fresh.length > 30 ? <Caption>…and {fresh.length - 30} more.</Caption> : null}
              <Button
                label={fresh.length ? `Add ${fresh.length} flats` : 'Nothing new to add'}
                onPress={() => void addFlats()}
                loading={busy === 'add'}
                disabled={!fresh.length}
              />
            </Card>
          ) : null}

          <ErrorText message={error} />

          {mode === 'list' ? (
            units.length ? (
              towerNames.map((tower) => {
                const rows = byTower.get(tower) ?? [];
                const occupied = rows.filter((row) => row.occupants > 0).length;
                const open = expanded[tower] ?? false;
                const shown = open ? rows : rows.slice(0, SHOW_PER_TOWER);
                return (
                  <Card key={tower || 'none'} style={{ gap: spacing.sm }}>
                    <Heading>{tower ? `Tower ${tower}` : 'No tower'}</Heading>
                    <Caption>
                      {rows.length} flats · {occupied} with residents
                      {mayEdit ? ' · tap an empty flat to delete it' : ''}
                    </Caption>
                    <ChipRow>
                      {shown.map((unit) => (
                        <Chip
                          key={unit.id}
                          label={unit.occupants > 0 ? `${unit.number} ●` : unit.number}
                          selected={unit.occupants > 0}
                          disabled={busy === unit.id}
                          onPress={() => removeFlat(unit)}
                        />
                      ))}
                    </ChipRow>
                    {rows.length > SHOW_PER_TOWER ? (
                      <Chip
                        label={open ? 'Show fewer' : `Show all ${rows.length}`}
                        onPress={() => setExpanded({ ...expanded, [tower]: !open })}
                      />
                    ) : null}
                  </Card>
                );
              })
            ) : (
              <Card>
                <EmptyState
                  title="No flats yet"
                  description={
                    mayEdit
                      ? 'Generate them from towers and floors, or import a spreadsheet.'
                      : 'The committee will add the society’s flats.'
                  }
                />
              </Card>
            )
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
