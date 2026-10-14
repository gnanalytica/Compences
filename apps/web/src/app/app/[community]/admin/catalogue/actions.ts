'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { CATALOGUE_KINDS, catalogueItemSchema, uuid, type CatalogueKind } from '@compences/core';
import { requireCapability } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase/server';
import { EMPTY_STATE, fieldErrors, friendlyDbError, type ActionState } from '@/lib/action-state';

/**
 * Staff and the committee keep the catalogue current: they run events and raise
 * bills, so they are the ones who meet a new vendor or venue first. Confirming
 * the default catalogue during setup is a committee step.
 */

function refresh(slug: string) {
  revalidatePath(`/app/${slug}/admin/catalogue`);
  revalidatePath(`/app/${slug}/admin`, 'layout');
}

/** Kind-specific extras kept in `details`; blank values are dropped. */
function detailsFor(kind: CatalogueKind, input: z.infer<typeof catalogueItemSchema>) {
  if (kind === 'vendor') {
    return {
      ...(input.phone ? { phone: input.phone } : {}),
      ...(input.upi_vpa ? { upi_vpa: input.upi_vpa } : {}),
    };
  }
  if (kind === 'venue' && input.capacity) return { capacity: input.capacity };
  return {};
}

function parseItem(formData: FormData) {
  return catalogueItemSchema.safeParse({
    kind: formData.get('kind'),
    label: formData.get('label'),
    emoji: formData.get('emoji') || undefined,
    phone: formData.get('phone') || undefined,
    upi_vpa: formData.get('upi_vpa') || undefined,
    capacity: formData.get('capacity') || undefined,
  });
}

export async function addCatalogueItem(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const slug = String(formData.get('slug') ?? '');
  const context = await requireCapability(slug, 'events:manage');

  const parsed = parseItem(formData);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await getSupabase();
  const { count } = await supabase
    .from('catalogue_items')
    .select('id', { count: 'exact', head: true })
    .eq('community_id', context.community.id)
    .eq('kind', parsed.data.kind);

  const { error } = await supabase.from('catalogue_items').insert({
    community_id: context.community.id,
    kind: parsed.data.kind,
    label: parsed.data.label,
    emoji: parsed.data.emoji,
    details: detailsFor(parsed.data.kind, parsed.data),
    position: count ?? 0,
    created_by: context.user.id,
  });
  if (error) return { error: friendlyDbError(error) };

  refresh(slug);
  return { ...EMPTY_STATE, success: `Added “${parsed.data.label}”.` };
}

export async function updateCatalogueItem(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const slug = String(formData.get('slug') ?? '');
  const context = await requireCapability(slug, 'events:manage');
  const id = uuid.safeParse(formData.get('item_id'));
  if (!id.success) return { error: 'That item no longer exists.' };

  const parsed = parseItem(formData);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('catalogue_items')
    .update({
      label: parsed.data.label,
      emoji: parsed.data.emoji,
      details: detailsFor(parsed.data.kind, parsed.data),
    })
    .eq('id', id.data)
    .eq('community_id', context.community.id)
    .select('id');
  if (error) return { error: friendlyDbError(error) };
  if (!data?.length) return { error: 'That item no longer exists.' };

  refresh(slug);
  return {
    ...EMPTY_STATE,
    success: 'Saved. Bills and budgets already filed keep their old wording.',
  };
}

/** Swaps an item with its neighbour, so staff can put the common choices first. */
export async function moveCatalogueItem(formData: FormData): Promise<void> {
  const slug = String(formData.get('slug') ?? '');
  const context = await requireCapability(slug, 'events:manage');
  const id = String(formData.get('item_id') ?? '');
  const direction = formData.get('direction') === 'up' ? -1 : 1;

  const supabase = await getSupabase();
  const { data: item } = await supabase
    .from('catalogue_items')
    .select('id, kind')
    .eq('id', id)
    .eq('community_id', context.community.id)
    .maybeSingle();
  if (!item) return;

  const { data: siblings } = await supabase
    .from('catalogue_items')
    .select('id, position')
    .eq('community_id', context.community.id)
    .eq('kind', item.kind)
    .order('position')
    .order('label');
  const ordered = siblings ?? [];
  const index = ordered.findIndex((row) => row.id === id);
  const swap = index + direction;
  if (index < 0 || swap < 0 || swap >= ordered.length) return;

  // Renumber the whole list, so older lists with duplicate positions settle too.
  const next = [...ordered];
  [next[index], next[swap]] = [next[swap]!, next[index]!];
  await Promise.all(
    next.map((row, position) =>
      row.position === position
        ? null
        : supabase.from('catalogue_items').update({ position }).eq('id', row.id),
    ),
  );

  refresh(slug);
}

/** Archiving hides an item from pickers; everything already filed keeps its label. */
export async function setCatalogueItemActive(formData: FormData): Promise<void> {
  const slug = String(formData.get('slug') ?? '');
  const context = await requireCapability(slug, 'events:manage');
  const supabase = await getSupabase();
  await supabase
    .from('catalogue_items')
    .update({ is_active: formData.get('active') === '1' })
    .eq('id', String(formData.get('item_id') ?? ''))
    .eq('community_id', context.community.id);
  refresh(slug);
}

/** Committee setup step: the default catalogue has been looked over. */
export async function markCatalogueReviewed(formData: FormData): Promise<void> {
  const slug = String(formData.get('slug') ?? '');
  const context = await requireCapability(slug, 'roles:manage');
  const supabase = await getSupabase();
  await supabase
    .from('communities')
    .update({ catalogue_reviewed_at: new Date().toISOString() })
    .eq('id', context.community.id);
  refresh(slug);
}

const quickAddSchema = z.object({
  kind: z.enum(CATALOGUE_KINDS),
  label: z.string().trim().min(1, 'Give it a name').max(80, 'Keep it under 80 characters'),
});

export type QuickAddResult =
  { item: { id: string; label: string; emoji: string | null } } | { error: string };

/**
 * Adds an item from inside a form (a new vendor while uploading a bill) and
 * hands it back so the picker can select it straight away.
 */
export async function quickAddCatalogueItem(
  slug: string,
  kind: CatalogueKind,
  label: string,
): Promise<QuickAddResult> {
  const context = await requireCapability(slug, 'events:manage');
  const parsed = quickAddSchema.safeParse({ kind, label });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Give it a name' };

  const supabase = await getSupabase();
  const { count } = await supabase
    .from('catalogue_items')
    .select('id', { count: 'exact', head: true })
    .eq('community_id', context.community.id)
    .eq('kind', parsed.data.kind);

  const { data, error } = await supabase
    .from('catalogue_items')
    .insert({
      community_id: context.community.id,
      kind: parsed.data.kind,
      label: parsed.data.label,
      position: count ?? 0,
      created_by: context.user.id,
    })
    .select('id, label, emoji')
    .single();
  if (error || !data) return { error: friendlyDbError(error) };

  refresh(slug);
  return { item: data };
}
