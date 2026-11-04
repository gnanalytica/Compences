import { Linking } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import * as WebBrowser from 'expo-web-browser';
import { UPLOAD_MIME_TYPES, safeFileName } from '@compences/core';
import { supabase } from './supabase';

/**
 * Bills and payment screenshots live in private Supabase Storage buckets.
 * Row-level security on storage.objects decides who may upload and read:
 * staff and committee upload bills, residents read a bill only once it is
 * approved, and a payment screenshot is visible to its owner and staff. A
 * marketplace listing's picture is in a third, which every member may look at
 * and only its seller writes to.
 */

export type Bucket = 'bills' | 'payment-proofs' | 'listing-photos';

export const MAX_BYTES: Record<Bucket, number> = {
  bills: 10 * 1024 * 1024,
  'payment-proofs': 5 * 1024 * 1024,
  'listing-photos': 5 * 1024 * 1024,
};

/** What each bucket calls the thing it holds, for the line when it will not open. */
const MISSING: Record<Bucket, string> = {
  bills: 'Bill not available.',
  'payment-proofs': 'Screenshot not available.',
  'listing-photos': 'Photo not available.',
};

/**
 * A listing's picture, in the seller's own folder, which is the only place the
 * bucket's policy and the listings table will both accept it.
 */
export const listingPhotoPath = (communityId: string, membershipId: string, fileName: string) =>
  `${communityId}/${membershipId}/${safeFileName(fileName)}`;

export type PickedFile = {
  uri: string;
  name: string;
  mimeType: string;
  size: number | null;
};

export type PickSource = 'camera' | 'library' | 'pdf';

const ALLOWED = new Set<string>(UPLOAD_MIME_TYPES);

function mimeFromName(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'heic' || ext === 'heif') return 'image/heic';
  return 'image/jpeg';
}

/** Opens the camera, photo library or file picker. Null when the user backs out. */
export async function pickFile(source: PickSource): Promise<PickedFile | { error: string } | null> {
  if (source === 'pdf') {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });
    if (result.canceled) return null;
    const asset = result.assets[0];
    if (!asset) return null;
    return {
      uri: asset.uri,
      name: asset.name,
      mimeType: asset.mimeType ?? 'application/pdf',
      size: asset.size ?? null,
    };
  }

  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      return { error: 'Allow camera access in Settings to take a photo.' };
    }
  }

  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.7 };
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset) return null;
  const name = asset.fileName ?? `photo-${Date.now()}.jpg`;
  return {
    uri: asset.uri,
    name,
    mimeType: asset.mimeType ?? mimeFromName(name),
    size: asset.fileSize ?? null,
  };
}

/** Uploads a picked file to `path` in `bucket`. Returns the stored path. */
export async function uploadFile(
  bucket: Bucket,
  path: string,
  file: PickedFile,
): Promise<{ path: string } | { error: string }> {
  const mimeType = file.mimeType.toLowerCase();
  // The listing-photos bucket takes pictures only: an ad is looked at, and a
  // PDF would be a download nobody opens.
  if (bucket === 'listing-photos' && !mimeType.startsWith('image/')) {
    return { error: 'Attach a photo (JPG, PNG, WebP, HEIC).' };
  }
  if (!ALLOWED.has(mimeType)) {
    return { error: 'Attach a photo (JPG, PNG, WebP, HEIC) or a PDF.' };
  }

  let body: ArrayBuffer;
  try {
    body = await new File(file.uri).arrayBuffer();
  } catch {
    return { error: 'Could not read that file. Please pick it again.' };
  }

  const size = file.size ?? body.byteLength;
  if (size > MAX_BYTES[bucket]) {
    const limit = Math.round(MAX_BYTES[bucket] / (1024 * 1024));
    return { error: `That file is too large. Keep it under ${limit} MB.` };
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, body, { contentType: mimeType, upsert: false });
  if (error || !data) {
    return { error: 'Upload failed. Check your connection and try again.' };
  }
  return { path: data.path };
}

/** Whether a stored file is a photo, from its name, so it can open in place. */
export function isStoredImage(value: string): boolean {
  return /\.(png|jpe?g|webp|gif|heic|heif)$/i.test(value.split('?')[0] ?? value);
}

/**
 * A short-lived link to a stored file, for showing it inside the app. Older
 * rows may hold a plain link, which is returned as is; RLS refuses a signed
 * link to a file the viewer may not see.
 */
export async function storedFileUrl(
  bucket: Bucket,
  value: string,
): Promise<{ url: string } | { error: string }> {
  if (/^https?:\/\//i.test(value)) return { url: value };
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(value, 300);
  if (error || !data?.signedUrl) {
    return { error: MISSING[bucket] };
  }
  return { url: data.signedUrl };
}

/**
 * Short-lived links for many stored files at once, keyed by path: one round
 * trip for a whole board of thumbnails rather than one per card. A path the
 * viewer may not see, or that is gone, is simply missing from the map.
 */
export async function storedFileUrls(
  bucket: Bucket,
  paths: string[],
  expiresIn = 3600,
): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  const unique = [...new Set(paths.filter(Boolean))];
  if (!unique.length) return urls;
  const { data } = await supabase.storage.from(bucket).createSignedUrls(unique, expiresIn);
  for (const row of data ?? []) {
    if (row.path && row.signedUrl && !row.error) urls.set(row.path, row.signedUrl);
  }
  return urls;
}

/**
 * Deletes stored files, best-effort. Used to tidy up a photo that was replaced
 * or whose listing was deleted: a leftover file costs a little storage, which
 * is not worth failing the thing the person actually asked for.
 */
export async function removeStoredFiles(bucket: Bucket, paths: (string | null | undefined)[]) {
  const list = paths.filter(
    (path): path is string => typeof path === 'string' && path !== '' && !/^https?:/i.test(path),
  );
  if (!list.length) return;
  await supabase.storage
    .from(bucket)
    .remove(list)
    .catch(() => undefined);
}

/**
 * Opens a stored bill or screenshot. Older rows may hold a plain link, which
 * opens as is; anything else is a storage path that needs a short-lived signed
 * URL, and RLS refuses one the viewer may not see.
 */
export async function openStoredFile(bucket: Bucket, value: string): Promise<string | null> {
  if (/^https?:\/\//i.test(value)) {
    await Linking.openURL(value);
    return null;
  }
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(value, 300);
  if (error || !data?.signedUrl) {
    return MISSING[bucket];
  }
  await WebBrowser.openBrowserAsync(data.signedUrl);
  return null;
}
