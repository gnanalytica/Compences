'use server';

import { revalidatePath } from 'next/cache';
import { createAnnouncementSchema } from '@compences/core';
import { requireCapability } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase/server';
import { EMPTY_STATE, fieldErrors, friendlyDbError, type ActionState } from '@/lib/action-state';

export async function postAnnouncement(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const slug = String(formData.get('slug') ?? '');
  const context = await requireCapability(slug, 'events:manage');

  const expiresRaw = String(formData.get('expires_at') ?? '').trim();

  const parsed = createAnnouncementSchema.safeParse({
    community_id: context.community.id,
    title: formData.get('title'),
    body: formData.get('body'),
    audience: formData.get('audience') || 'all',
    is_pinned: formData.get('is_pinned') === 'on',
    // <input type="datetime-local"> has no timezone, so interpret it as local.
    expires_at: expiresRaw ? new Date(expiresRaw).toISOString() : null,
  });

  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await getSupabase();
  const { error } = await supabase.from('announcements').insert({
    ...parsed.data,
    author_id: context.membership.id,
  });

  if (error) return { error: friendlyDbError(error) };

  revalidatePath(`/app/${slug}/notices`);
  revalidatePath(`/app/${slug}`);
  return { ...EMPTY_STATE, success: 'Notice posted.' };
}

export async function deleteAnnouncement(formData: FormData): Promise<void> {
  const slug = String(formData.get('slug') ?? '');
  const id = String(formData.get('id') ?? '');
  await requireCapability(slug, 'events:manage');

  const supabase = await getSupabase();
  await supabase.from('announcements').delete().eq('id', id);

  revalidatePath(`/app/${slug}/notices`);
}
