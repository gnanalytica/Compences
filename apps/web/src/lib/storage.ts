import { getSupabase } from '@/lib/supabase/server';

export type StorageBucket = 'bills' | 'payment-proofs' | 'listing-photos';

/** How long a link to a bill, payment screenshot or listing photo stays valid. */
const SIGNED_URL_SECONDS = 300;

/**
 * A short-lived link to a stored file, signed with the viewer's own session so
 * row-level security on storage.objects decides who may open it: residents get
 * a bill only once it is approved, a payment screenshot only if it is theirs.
 *
 * Older rows may hold a plain http(s) link; those pass through unchanged.
 * Returns null when there is nothing to link to or the viewer may not see it.
 */
export async function fileUrl(
  bucket: StorageBucket,
  path: string | null | undefined,
): Promise<string | null> {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const supabase = await getSupabase();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_SECONDS);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/**
 * fileUrl for many files in one round trip, keyed by path. The marketplace
 * board shows a photo on every card, and signing them one at a time would be
 * a request per listing before the page could render.
 *
 * A path the viewer may not open, or that no longer exists, is simply absent
 * from the result, and the card shows no picture.
 */
export async function fileUrls(
  bucket: StorageBucket,
  paths: (string | null | undefined)[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const stored: string[] = [];
  for (const path of new Set(paths)) {
    if (!path) continue;
    if (/^https?:\/\//i.test(path)) out.set(path, path);
    else stored.push(path);
  }
  if (!stored.length) return out;
  const supabase = await getSupabase();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrls(stored, SIGNED_URL_SECONDS);
  if (error) {
    console.error(`[storage] could not sign ${stored.length} ${bucket} links`, error);
    return out;
  }
  for (const entry of data ?? []) {
    if (entry.path && entry.signedUrl && !entry.error) out.set(entry.path, entry.signedUrl);
  }
  return out;
}

/**
 * Deletes a stored file that nothing points at any more, e.g. the previous copy
 * of a corrected bill. Best effort, with the caller's own session: storage
 * policies still decide (an approved bill's file can never be removed), and a
 * failure only leaves a stray file behind, so it is logged rather than thrown.
 * Plain http(s) links from older rows are not ours to delete.
 */
export async function removeStoredFile(
  bucket: StorageBucket,
  path: string | null | undefined,
): Promise<void> {
  if (!path || /^https?:\/\//i.test(path)) return;
  const supabase = await getSupabase();
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) console.error(`[storage] could not remove ${bucket}/${path}`, error);
}
