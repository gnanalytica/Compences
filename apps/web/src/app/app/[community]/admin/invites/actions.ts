'use server';

import { revalidatePath } from 'next/cache';
import { createInviteCodeSchema } from '@compences/core';
import { requireCapability } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase/server';
import { EMPTY_STATE, fieldErrors, friendlyDbError, type ActionState } from '@/lib/action-state';

export type InviteState = ActionState & { createdCode?: string };

export async function createInviteCode(
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const slug = String(formData.get('slug') ?? '');
  const context = await requireCapability(slug, 'roles:manage');

  const maxUsesRaw = String(formData.get('max_uses') ?? '1');
  const expiresRaw = String(formData.get('expires_at') ?? '').trim();
  const unitId = String(formData.get('unit_id') ?? '').trim();

  const parsed = createInviteCodeSchema.safeParse({
    community_id: context.community.id,
    role: formData.get('role') || 'resident',
    unit_id: unitId || null,
    relation: formData.get('relation') || 'owner',
    // "unlimited" is the UI's word for no cap at all.
    max_uses: maxUsesRaw === 'unlimited' ? null : Number(maxUsesRaw),
    expires_at: expiresRaw ? new Date(expiresRaw).toISOString() : null,
    label: formData.get('label') || undefined,
  });

  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await getSupabase();

  // Generated database-side so the code is unique and unguessable, and so the
  // admin check happens in the same transaction that writes the row.
  const { data, error } = await supabase.rpc('create_invite_code', {
    p_community_id: parsed.data.community_id,
    p_role: parsed.data.role,
    p_unit_id: parsed.data.unit_id ?? undefined,
    p_relation: parsed.data.relation,
    p_max_uses: parsed.data.max_uses ?? undefined,
    p_expires_at: parsed.data.expires_at ?? undefined,
    p_label: parsed.data.label ?? undefined,
  });

  if (error) return { error: friendlyDbError(error) };

  revalidatePath(`/app/${slug}/admin/invites`);
  return { ...EMPTY_STATE, createdCode: data?.code };
}

export async function revokeInviteCode(formData: FormData): Promise<void> {
  const slug = String(formData.get('slug') ?? '');
  const id = String(formData.get('id') ?? '');
  const context = await requireCapability(slug, 'roles:manage');

  const supabase = await getSupabase();
  await supabase
    .from('invite_codes')
    .update({ revoked_at: new Date().toISOString(), revoked_by: context.user.id })
    .eq('id', id)
    .eq('community_id', context.community.id);

  revalidatePath(`/app/${slug}/admin/invites`);
}
