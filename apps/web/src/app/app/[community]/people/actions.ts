'use server';

import { revalidatePath } from 'next/cache';
import { setMemberUnitMessage, updateMemberRoleSchema, uuid } from '@compences/core';
import { requireCapability } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase/server';
import { EMPTY_STATE, friendlyDbError, type ActionState } from '@/lib/action-state';

/**
 * The committee assigns roles. The database refuses self-promotion and keeps
 * at least one committee member; this scopes the change to the community.
 */
export async function changeMemberRole(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const slug = String(formData.get('slug') ?? '');
  const context = await requireCapability(slug, 'roles:manage');

  const parsed = updateMemberRoleSchema.safeParse({
    membership_id: formData.get('membership_id'),
    role: formData.get('role'),
  });
  if (!parsed.success) return { error: 'Pick a role.' };

  const supabase = await getSupabase();
  const { error } = await supabase
    .from('memberships')
    .update({ role: parsed.data.role })
    .eq('id', parsed.data.membership_id)
    .eq('community_id', context.community.id);
  if (error) return { error: friendlyDbError(error) };

  revalidatePath(`/app/${slug}/people`);
  return { ...EMPTY_STATE, success: 'Role updated.' };
}

/**
 * Removes someone from the society. Staff can remove residents; only the
 * committee can remove staff or committee members, and never the last one.
 */
export async function removeMember(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const slug = String(formData.get('slug') ?? '');
  const context = await requireCapability(slug, 'residents:remove');

  const id = uuid.safeParse(formData.get('membership_id'));
  if (!id.success) return { error: 'That member no longer exists.' };
  if (id.data === context.membership.id) return { error: 'You cannot remove yourself.' };

  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('memberships')
    .delete()
    .eq('id', id.data)
    .eq('community_id', context.community.id)
    .select('id');
  if (error) return { error: friendlyDbError(error) };
  if (!data?.length) return { error: 'Staff can remove residents only.' };

  revalidatePath(`/app/${slug}/people`);
  return { ...EMPTY_STATE, success: 'Removed.' };
}

/**
 * Puts a member in a flat, or takes them out of one.
 *
 * Until this existed there was no way to seat anybody after they had joined:
 * request_to_join() and a unit-bound invite code both do it once, at the
 * moment of joining, and nothing else did it at all. So a founder — never
 * asked where they live — and anybody who joined without a flat stayed
 * flatless for good, which is what left their payments in the ledger with no
 * flat beside them.
 *
 * Unlike the role control this is offered on your own row too: the founder is
 * usually the one who needs it, and set_member_unit() is committee-gated in
 * the database rather than by who the row belongs to.
 */
export async function setMemberFlat(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const slug = String(formData.get('slug') ?? '');
  await requireCapability(slug, 'roles:manage');

  const membershipId = uuid.safeParse(formData.get('membership_id'));
  if (!membershipId.success) return { error: 'That member is no longer in this society.' };

  // An empty choice is "lives nowhere", which is a real answer: somebody has
  // moved out and not moved back in.
  const raw = String(formData.get('unit_id') ?? '');
  const unitId = raw ? uuid.safeParse(raw) : null;
  if (unitId && !unitId.success) return { error: 'Pick a flat from the list.' };

  const supabase = await getSupabase();
  const { data, error } = await supabase.rpc('set_member_unit', {
    p_membership_id: membershipId.data,
    p_unit_id: unitId?.data ?? undefined,
  });
  if (error) return { error: friendlyDbError(error) };
  if (data !== 'ok') return { error: setMemberUnitMessage(data ?? '') };

  revalidatePath(`/app/${slug}/people`);
  // Their payments in the ledger are labelled from this, so the money pages
  // are stale the moment it changes.
  revalidatePath(`/app/${slug}/money`);
  return { ...EMPTY_STATE, success: raw ? 'Flat updated.' : 'Flat cleared.' };
}
