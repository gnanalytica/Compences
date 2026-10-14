'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  flatGeneratorSchema,
  generateFlats,
  parseFlatsCsv,
  uuid,
  type FlatRow,
} from '@compences/core';
import { requireCapability } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase/server';
import { EMPTY_STATE, fieldErrors, friendlyDbError, type ActionState } from '@/lib/action-state';

/**
 * Flats are set up by the committee: residents pick theirs from this list when
 * they join, so a wrong or missing flat is felt by every new resident.
 */

const labelKey = (block: string | null, number: string) =>
  `${(block ?? '').trim().toUpperCase()}|${number.trim().toUpperCase()}`;

/** Inserts the flats that do not exist yet; re-running the same list is harmless. */
async function insertMissing(communityId: string, rows: FlatRow[]) {
  const supabase = await getSupabase();
  const { data: existing, error: readError } = await supabase
    .from('units')
    .select('block, number')
    .eq('community_id', communityId)
    .limit(10000);
  if (readError) return { error: friendlyDbError(readError) };

  const have = new Set((existing ?? []).map((unit) => labelKey(unit.block, unit.number)));
  const fresh = rows.filter((row) => !have.has(labelKey(row.block, row.number)));

  for (let start = 0; start < fresh.length; start += 500) {
    const { error } = await supabase
      .from('units')
      .insert(
        fresh.slice(start, start + 500).map((row) => ({ ...row, community_id: communityId })),
      );
    if (error) return { error: friendlyDbError(error) };
  }
  return { added: fresh.length, skipped: rows.length - fresh.length };
}

function summary(added: number, skipped: number) {
  const parts = [`Added ${added} flat${added === 1 ? '' : 's'}`];
  if (skipped) parts.push(`skipped ${skipped} that already existed`);
  return `${parts.join(', ')}.`;
}

export async function generateUnits(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const slug = String(formData.get('slug') ?? '');
  const context = await requireCapability(slug, 'roles:manage');

  const parsed = flatGeneratorSchema.safeParse({
    towers: formData.get('towers'),
    floors: formData.get('floors'),
    flats_per_floor: formData.get('flats_per_floor'),
    include_ground_floor: formData.get('include_ground_floor') === 'on',
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const rows = generateFlats(parsed.data);
  if (rows.length > 5000)
    return { error: 'That is more than 5,000 flats. Split it into smaller runs.' };

  const result = await insertMissing(context.community.id, rows);
  if ('error' in result) return { error: result.error };

  revalidatePath(`/app/${slug}/admin/units`);
  revalidatePath(`/app/${slug}/admin`);
  return { ...EMPTY_STATE, success: summary(result.added, result.skipped) };
}

export async function importUnits(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const slug = String(formData.get('slug') ?? '');
  const context = await requireCapability(slug, 'roles:manage');

  const csv = String(formData.get('csv') ?? '');
  if (!csv.trim()) return { error: 'Choose a CSV file first.' };
  if (csv.length > 2_000_000) return { error: 'That file is too large. Keep it under 2 MB.' };

  const { rows, errors } = parseFlatsCsv(csv);
  if (errors.length) {
    const shown = errors.slice(0, 5).join(' ');
    return {
      error: `Nothing was imported. Fix these in the file and try again: ${shown}${
        errors.length > 5 ? ` …and ${errors.length - 5} more.` : ''
      }`,
    };
  }
  if (rows.length === 0) return { error: 'The file has no flats.' };

  const result = await insertMissing(context.community.id, rows);
  if ('error' in result) return { error: result.error };

  revalidatePath(`/app/${slug}/admin/units`);
  revalidatePath(`/app/${slug}/admin`);
  return { ...EMPTY_STATE, success: summary(result.added, result.skipped) };
}

const unitSchema = z.object({
  id: uuid,
  block: z
    .string()
    .trim()
    .max(20)
    .transform((value) => value.toUpperCase() || null),
  number: z.string().trim().min(1, 'Flat number is required').max(20),
  floor: z
    .string()
    .trim()
    .transform((value) => (value === '' ? null : Number(value)))
    .pipe(z.number().int().min(-5).max(200).nullable()),
  bedrooms: z
    .string()
    .trim()
    .transform((value) => (value === '' ? null : Number(value)))
    .pipe(z.number().int().min(0).max(20).nullable()),
  area_sqft: z
    .string()
    .trim()
    .transform((value) => (value === '' ? null : Number(value)))
    .pipe(z.number().int().min(50).max(100000).nullable()),
});

export async function updateUnit(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const slug = String(formData.get('slug') ?? '');
  const context = await requireCapability(slug, 'roles:manage');

  const parsed = unitSchema.safeParse({
    id: formData.get('id'),
    block: String(formData.get('block') ?? ''),
    number: String(formData.get('number') ?? ''),
    floor: String(formData.get('floor') ?? ''),
    bedrooms: String(formData.get('bedrooms') ?? ''),
    area_sqft: String(formData.get('area_sqft') ?? ''),
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const { id, ...fields } = parsed.data;
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('units')
    .update(fields)
    .eq('id', id)
    .eq('community_id', context.community.id)
    .select('id');
  if (error) return { error: friendlyDbError(error) };
  if (!data?.length) return { error: 'That flat no longer exists.' };

  revalidatePath(`/app/${slug}/admin/units`);
  return { ...EMPTY_STATE, success: 'Saved.' };
}

/** Deletes a flat nobody lives in and nobody has asked to join. */
export async function deleteUnit(formData: FormData): Promise<void> {
  const slug = String(formData.get('slug') ?? '');
  const id = String(formData.get('id') ?? '');
  const context = await requireCapability(slug, 'roles:manage');

  const supabase = await getSupabase();
  const [occupants, requests] = await Promise.all([
    supabase.from('unit_occupants').select('id', { count: 'exact', head: true }).eq('unit_id', id),
    supabase
      .from('join_requests')
      .select('id', { count: 'exact', head: true })
      .eq('unit_id', id)
      .eq('status', 'pending'),
  ]);
  if ((occupants.count ?? 0) > 0 || (requests.count ?? 0) > 0) return;

  await supabase.from('units').delete().eq('id', id).eq('community_id', context.community.id);
  revalidatePath(`/app/${slug}/admin/units`);
  revalidatePath(`/app/${slug}/admin`);
}
