'use server';

import { revalidatePath } from 'next/cache';
import { createApiKeySchema, generateApiKey } from '@compences/core';
import { requireCapability } from '@/lib/auth';
import { getSupabase, createAdminSupabase } from '@/lib/supabase/server';
import { fieldErrors, friendlyDbError, type ActionState } from '@/lib/action-state';

export type ApiKeyState = ActionState & {
  /** The plaintext key, returned once and never stored. */
  createdKey?: string;
};

export async function createApiKey(_prev: ApiKeyState, formData: FormData): Promise<ApiKeyState> {
  const slug = String(formData.get('slug') ?? '');
  const context = await requireCapability(slug, 'roles:manage');

  const expiresRaw = String(formData.get('expires_at') ?? '').trim();

  const parsed = createApiKeySchema.safeParse({
    community_id: context.community.id,
    name: formData.get('name'),
    scopes: formData.getAll('scopes').map(String),
    expires_at: expiresRaw ? new Date(expiresRaw).toISOString() : null,
  });

  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const { key, prefix, hash } = await generateApiKey('live');

  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('api_keys')
    .insert({
      community_id: parsed.data.community_id,
      name: parsed.data.name,
      key_prefix: prefix,
      scopes: parsed.data.scopes,
      expires_at: parsed.data.expires_at ?? null,
      created_by: context.user.id,
      // Calls made with this key act as the admin who created it, which keeps
      // the audit trail meaningful and bounds what the key can reach.
      acts_as: context.membership.id,
    })
    .select('id')
    .single();

  if (error) return { error: friendlyDbError(error) };

  // The digest lives in a table no client role can read, so it has to be
  // written with the service role rather than the admin's own session.
  const admin = createAdminSupabase();
  const { error: secretError } = await admin
    .from('api_key_secrets')
    .insert({ api_key_id: data.id, key_hash: hash });

  if (secretError) {
    // A key row with no secret could never authenticate; remove it rather than
    // leaving a dead entry in the admin's list.
    await supabase.from('api_keys').delete().eq('id', data.id);
    return { error: 'Could not finish creating the key. Please try again.' };
  }

  revalidatePath(`/app/${slug}/admin/api-keys`);
  return { createdKey: key };
}

export async function revokeApiKey(formData: FormData): Promise<void> {
  const slug = String(formData.get('slug') ?? '');
  const id = String(formData.get('id') ?? '');
  const context = await requireCapability(slug, 'roles:manage');

  const supabase = await getSupabase();
  await supabase
    .from('api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .eq('community_id', context.community.id);

  revalidatePath(`/app/${slug}/admin/api-keys`);
}
