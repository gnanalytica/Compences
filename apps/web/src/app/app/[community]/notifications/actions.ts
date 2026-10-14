'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { notificationWebPath, type NotificationData } from '@compences/core';
import { requireCommunity } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase/server';

/** Clears the bell. RLS and the RPC both limit it to the caller's own rows. */
export async function markAllNotificationsRead(formData: FormData): Promise<void> {
  const slug = String(formData.get('slug') ?? '');
  await requireCommunity(slug);
  const supabase = await getSupabase();
  await supabase.rpc('mark_notifications_read', {});
  revalidatePath(`/app/${slug}`, 'layout');
}

/**
 * Opens a notification: marks it read, then goes where it points. A form post
 * rather than a link, so prefetching never marks anything read by accident.
 */
export async function openNotification(formData: FormData): Promise<void> {
  const slug = String(formData.get('slug') ?? '');
  const id = String(formData.get('notification_id') ?? '');
  await requireCommunity(slug);
  const supabase = await getSupabase();

  const { data } = await supabase.from('notifications').select('data').eq('id', id).maybeSingle();
  await supabase.rpc('mark_notifications_read', { p_ids: [id] });
  revalidatePath(`/app/${slug}`, 'layout');

  redirect(notificationWebPath((data?.data ?? null) as NotificationData | null));
}
