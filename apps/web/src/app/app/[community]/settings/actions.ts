'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import {
  DELETE_ACCOUNT_CONFIRMATION,
  deleteAccountMessage,
  isAccountDeleted,
  isDeleteConfirmed,
  requestUnitChangeMessage,
  residentPhoneSchema,
  uuid,
} from '@compences/core';
import { requireCommunity, requireUser } from '@/lib/auth';
import { revokeAppleToken } from '@/lib/apple';
import { getSupabase } from '@/lib/supabase/server';
import { EMPTY_STATE, fieldErrors, friendlyDbError, type ActionState } from '@/lib/action-state';

const profileSchema = z.object({
  full_name: z.string().trim().min(1, 'Tell us your name').max(120),
  // Optional here, unlike registration: this is also how somebody who joined
  // before the forms asked for one finally becomes reachable, and making it
  // compulsory would block them from saving their name.
  phone: residentPhoneSchema.optional().or(z.literal('').transform(() => null)),
});

export async function updateProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const slug = String(formData.get('slug') ?? '');

  const parsed = profileSchema.safeParse({
    full_name: formData.get('full_name'),
    phone: formData.get('phone'),
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await getSupabase();
  const { error } = await supabase.from('profiles').update(parsed.data).eq('id', user.id);

  if (error) return { error: friendlyDbError(error) };

  revalidatePath(`/app/${slug}/settings`);
  return { ...EMPTY_STATE, success: 'Saved.' };
}

export type LinkCodeState = ActionState & { code?: string; expiresAt?: string };

/**
 * Issues the short code a resident sends to the bot as `link ABC123`.
 * Generating a new one retires any previous code.
 */
export async function createWhatsAppLinkCode(
  _prev: LinkCodeState,
  formData: FormData,
): Promise<LinkCodeState> {
  const slug = String(formData.get('slug') ?? '');
  const context = await requireCommunity(slug);

  const supabase = await getSupabase();
  const { data, error } = await supabase.rpc('create_whatsapp_link_code', {
    p_community_id: context.community.id,
  });

  if (error || !data) return { error: 'Could not create a link code. Please try again.' };

  revalidatePath(`/app/${slug}/settings`);
  return { code: data.code, expiresAt: data.expires_at };
}

export async function unlinkWhatsApp(formData: FormData): Promise<void> {
  const slug = String(formData.get('slug') ?? '');
  const user = await requireUser();

  const supabase = await getSupabase();
  await supabase.from('whatsapp_links').delete().eq('user_id', user.id);

  revalidatePath(`/app/${slug}/settings`);
}

/**
 * Deletes the signed-in account, then signs the browser out of what is left.
 *
 * Both stores require this path to exist before they will take the app at all,
 * and the database function is where the rules live — what goes, what the
 * ledger keeps, and the one case it refuses. This is the form around it.
 *
 * The typed confirmation is checked here as well as in the browser, because a
 * server action is a public endpoint: the field is a speed bump for the person
 * and the check is the actual guard.
 */
export async function deleteAccount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();

  if (!isDeleteConfirmed(String(formData.get('confirm') ?? ''))) {
    return { fieldErrors: { confirm: `Type ${DELETE_ACCOUNT_CONFIRMATION} to confirm.` } };
  }

  // The Apple token row cascades away with the account, so revoke it first.
  // Apple being unreachable must not stand in the way of a deletion.
  await revokeAppleToken(user.id);

  const supabase = await getSupabase();
  const { data, error } = await supabase.rpc('delete_my_account');
  if (error) return { error: friendlyDbError(error) };

  const row = data?.[0];
  // A null status is not a success. The generated type allows one and the
  // function never returns one; guessing either way is how a refused deletion
  // would sign somebody out and tell them their account is gone.
  if (!row || !isAccountDeleted(row.status ?? '')) {
    return { error: deleteAccountMessage(row?.status ?? '', row?.detail) };
  }

  // The session's user no longer exists. Signing out is what stops the next
  // request from being an authenticated one against a deleted account.
  await supabase.auth.signOut();
  redirect('/?deleted=1');
}

/**
 * A member says they have moved. The committee decides; this only asks.
 *
 * Which flat somebody lives in is not theirs to set — it decides who the
 * ledger names against their money and who the directory lists at that door.
 * But they are the one who knows, and until this existed they could watch
 * every payment they made carry the wrong flat with no way to mention it.
 */
export async function askToChangeFlat(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const slug = String(formData.get('slug') ?? '');
  const context = await requireCommunity(slug);

  // An empty choice is "I do not live in a flat here any more", which somebody
  // who has moved out but still runs an event needs to be able to say.
  const raw = String(formData.get('unit_id') ?? '');
  const unitId = raw ? uuid.safeParse(raw) : null;
  if (unitId && !unitId.success) return { error: 'Pick a flat from the list.' };

  const supabase = await getSupabase();
  const { data, error } = await supabase.rpc('request_unit_change', {
    p_community_id: context.community.id,
    p_unit_id: unitId?.data ?? undefined,
    p_note: String(formData.get('note') ?? '').trim() || undefined,
  });
  if (error) return { error: friendlyDbError(error) };
  if (data !== 'ok') return { error: requestUnitChangeMessage(data ?? '') };

  revalidatePath(`/app/${slug}/settings`);
  return { ...EMPTY_STATE, success: 'Sent. You’ll hear back once the committee decides.' };
}
