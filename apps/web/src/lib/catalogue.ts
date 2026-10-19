import { cache } from 'react';
import { CATALOGUE_KINDS, type CatalogueKind } from '@compences/core';
import { getSupabase } from './supabase/server';

/**
 * The society's catalogue: the structured choices (categories, venues,
 * activity types, event types, vendors) pickers offer instead of free text.
 * RLS lets every member read it and staff or the committee change it.
 */

export type CatalogueItem = {
  id: string;
  kind: CatalogueKind;
  label: string;
  emoji: string | null;
  details: Record<string, unknown>;
  position: number;
  is_active: boolean;
};

export type Catalogue = Record<CatalogueKind, CatalogueItem[]>;

/** Every item, grouped by kind and ordered as staff arranged them. */
export const getCatalogue = cache(async (communityId: string): Promise<Catalogue> => {
  const supabase = await getSupabase();
  const { data } = await supabase
    .from('catalogue_items')
    .select('id, kind, label, emoji, details, position, is_active')
    .eq('community_id', communityId)
    .order('position')
    .order('label');

  const grouped = Object.fromEntries(
    CATALOGUE_KINDS.map((kind) => [kind, []]),
  ) as unknown as Catalogue;
  for (const row of data ?? []) {
    if (!(CATALOGUE_KINDS as readonly string[]).includes(row.kind)) continue;
    const details =
      row.details && typeof row.details === 'object' && !Array.isArray(row.details)
        ? (row.details as Record<string, unknown>)
        : {};
    grouped[row.kind as CatalogueKind].push({ ...row, kind: row.kind as CatalogueKind, details });
  }
  return grouped;
});

/** Only what a picker should offer for new choices. */
export function activeItems(catalogue: Catalogue, kind: CatalogueKind) {
  return catalogue[kind].filter((item) => item.is_active);
}

export type CatalogueChoice = { id: string | null; label: string | null };

/**
 * Reads a picker's submission and turns it into the id and the label to store.
 *
 * The label always comes from the society's own catalogue, never from the
 * browser, so a tampered form cannot write words the catalogue does not have or
 * point at another society's item. A picker showing an old label that is no
 * longer in the catalogue posts it as `<name>_legacy`, and it is kept as is.
 */
export async function resolveCatalogueChoice(
  communityId: string,
  kind: CatalogueKind,
  formData: FormData,
  name: string,
): Promise<CatalogueChoice> {
  const id = String(formData.get(`${name}_id`) ?? '').trim();
  if (id) {
    const catalogue = await getCatalogue(communityId);
    const item = catalogue[kind].find((entry) => entry.id === id);
    if (item) return { id: item.id, label: item.label };
  }
  const legacy = String(formData.get(`${name}_legacy`) ?? '').trim();
  return { id: null, label: legacy || null };
}

/** The most a catalogue label can hold; the database checks the same. */
export const CATALOGUE_LABEL_MAX = 80;

/** The words a person typed, tidied the way the catalogue compares them. */
export function tidyLabel(value: unknown): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

export type FoundItems = Map<string, { id: string; label: string }>;

/**
 * Turns words someone typed (a budget row's Type or Vendor) into catalogue
 * items, so the suggestions the next form offers grow with use. Matching
 * ignores case and spacing, so "food" finds "Food" rather than adding a twin,
 * and an item staff archived is reused as it is. Several rows may name the same
 * new word; it is created once.
 *
 * The label stored is the catalogue's, never the browser's, as with a picker.
 * Returns a map from each word's lower case to what to store, or an error for
 * a word the catalogue cannot hold.
 */
export async function findOrCreateCatalogueItems(
  communityId: string,
  userId: string,
  kind: CatalogueKind,
  words: string[],
): Promise<{ items: FoundItems } | { error: string }> {
  const supabase = await getSupabase();
  const known: FoundItems = new Map();
  const { data: existing } = await supabase
    .from('catalogue_items')
    .select('id, label')
    .eq('community_id', communityId)
    .eq('kind', kind);
  for (const row of existing ?? []) known.set(tidyLabel(row.label).toLowerCase(), row);

  let position = existing?.length ?? 0;
  for (const word of words.map(tidyLabel).filter(Boolean)) {
    const key = word.toLowerCase();
    if (known.has(key)) continue;
    if (word.length > CATALOGUE_LABEL_MAX) {
      return { error: `Keep “${word.slice(0, 20)}…” under ${CATALOGUE_LABEL_MAX} characters.` };
    }
    const { data } = await supabase
      .from('catalogue_items')
      .insert({
        community_id: communityId,
        kind,
        label: word,
        position: position++,
        created_by: userId,
      })
      .select('id, label')
      .single();
    if (data) {
      known.set(key, data);
      continue;
    }
    // Somebody added the same word a moment ago; theirs is the one to use.
    const { data: winner } = await supabase
      .from('catalogue_items')
      .select('id, label')
      .eq('community_id', communityId)
      .eq('kind', kind)
      .ilike('label', word.replace(/[\\%_]/g, '\\$&'))
      .limit(1)
      .maybeSingle();
    if (!winner) return { error: `Could not save “${word}”. Try again.` };
    known.set(key, winner);
  }
  return { items: known };
}
