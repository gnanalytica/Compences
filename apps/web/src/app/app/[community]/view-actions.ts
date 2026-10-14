'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { parseViewMode } from '@compences/core';
import { VIEW_COOKIE, requireCommunity } from '@/lib/auth';

/**
 * Switches a committee member between the committee and resident views, then
 * lands them on Home, which looks different in each. Only what is shown
 * changes; the role, and what row-level security allows, stay the same.
 */
export async function switchView(formData: FormData): Promise<void> {
  const slug = String(formData.get('slug') ?? '');
  const mode = parseViewMode(formData.get('mode'));
  const { viewMode } = await requireCommunity(slug);
  if (viewMode === null) redirect(`/app/${slug}`);

  const store = await cookies();
  store.set(VIEW_COOKIE, mode, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect(`/app/${slug}`);
}
