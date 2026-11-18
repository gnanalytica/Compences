'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { ImagePlus, Loader2, Star, X } from 'lucide-react';
import { safeFileName } from '@compences/core';
import { getBrowserSupabase } from '@/lib/supabase/browser';
import { cn } from '@/lib/utils';
import { IMAGE_MIME_TYPES } from './file-upload';

type Photo = {
  path: string;
  /** What the thumbnail shows: a signed link for a saved photo, a blob for a new one. */
  preview: string | null;
  /** Already saved on the listing, so the server, not this, removes it. */
  saved: boolean;
};

/**
 * A listing's photos, up to `max`: picked several at once, uploaded straight
 * to Storage with the signed-in user's session, and carried to the server
 * action as one hidden input per photo, in order. The first is the cover;
 * any of the others can be made the cover, and any removed.
 *
 * Like FileUpload, storage policies decide whether an upload is allowed, and
 * the checks here only give a faster answer. A photo uploaded here and then
 * removed (or abandoned with the form) is referenced by nothing, so it is
 * deleted straight away; a photo already saved on the listing is left for
 * the server to remove once the listing without it is saved.
 */
export function PhotoUploads({
  folder,
  name,
  max,
  label,
  hint,
  maxBytes,
  initial = [],
  onUploadingChange,
}: {
  /** `{community_id}/{membership_id}`: the uploader's own folder. */
  folder: string;
  /** Name of the hidden inputs that carry the stored paths. */
  name: string;
  max: number;
  label: string;
  hint?: string;
  maxBytes: number;
  initial?: { path: string; url: string | null }[];
  onUploadingChange?: (uploading: boolean) => void;
}) {
  const id = useId();
  const [photos, setPhotos] = useState<Photo[]>(() =>
    initial.map((photo) => ({ path: photo.path, preview: photo.url, saved: true })),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blobs = useRef<string[]>([]);
  const uploading = useRef(0);

  // How many uploads are under way, told to the form so it holds its submit
  // button until every photo has a path to send.
  function track(change: 1 | -1) {
    uploading.current += change;
    const now = uploading.current > 0;
    setBusy(now);
    onUploadingChange?.(now);
  }

  // Blob previews hold the file in memory until they are let go.
  useEffect(() => {
    const held = blobs.current;
    return () => held.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const room = max - photos.length;

  async function add(files: File[]) {
    setError(null);
    if (!files.length) return;
    const chosen = files.slice(0, Math.max(0, room));
    if (files.length > chosen.length) {
      setError(
        room > 0
          ? `Only ${room} more ${room === 1 ? 'photo fits' : 'photos fit'}; the first ${room === 1 ? 'one was' : `${room} were`} added.`
          : `A listing has ${max} photos at most. Remove one to add another.`,
      );
    }
    for (const file of chosen) {
      if (!(IMAGE_MIME_TYPES as readonly string[]).includes(file.type)) {
        setError('Attach photos only (JPG, PNG, WebP, HEIC).');
        continue;
      }
      if (file.size > maxBytes) {
        setError(
          `${file.name} is too large. Keep each photo under ${Math.round(maxBytes / 1_048_576)} MB.`,
        );
        continue;
      }
      track(1);
      const path = `${folder}/${safeFileName(file.name)}`;
      const { error: uploadError } = await getBrowserSupabase()
        .storage.from('listing-photos')
        .upload(path, file, { contentType: file.type, upsert: false });
      track(-1);
      if (uploadError) {
        setError(
          /row-level security|unauthorized|403/i.test(uploadError.message)
            ? 'You don’t have permission to upload here.'
            : 'An upload failed. Check your connection and try again.',
        );
        continue;
      }
      const preview = URL.createObjectURL(file);
      blobs.current.push(preview);
      setPhotos((current) =>
        current.length >= max ? current : [...current, { path, preview, saved: false }],
      );
    }
  }

  function remove(index: number) {
    const photo = photos[index];
    if (!photo) return;
    if (!photo.saved) void getBrowserSupabase().storage.from('listing-photos').remove([photo.path]);
    setPhotos((current) => current.filter((_, i) => i !== index));
    setError(null);
  }

  function makeCover(index: number) {
    setPhotos((current) => {
      const photo = current[index];
      if (!photo) return current;
      return [photo, ...current.filter((_, i) => i !== index)];
    });
  }

  return (
    <div className="space-y-2">
      <p id={`${id}-label`} className="text-ink block text-sm font-medium">
        {label}
      </p>
      {photos.map((photo) => (
        <input key={photo.path} type="hidden" name={name} value={photo.path} />
      ))}

      {photos.length ? (
        <ul aria-labelledby={`${id}-label`} className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {photos.map((photo, index) => (
            <li
              key={photo.path}
              className="border-border-base bg-surface-sunken relative overflow-hidden rounded-xl border"
            >
              {photo.preview ? (
                // A blob or a short-lived signed link: nothing for next/image to do.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photo.preview}
                  alt={`Photo ${index + 1}${index === 0 ? ', the cover' : ''}`}
                  className="aspect-square w-full object-cover"
                />
              ) : (
                <div className="text-ink-subtle grid aspect-square place-items-center text-xs">
                  Photo {index + 1}
                </div>
              )}
              {index === 0 ? (
                <span className="bg-ink text-surface absolute top-1.5 left-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold">
                  Cover
                </span>
              ) : null}
              <div className="bg-surface-raised/95 flex items-center justify-between gap-1 px-1.5 py-1">
                {index > 0 ? (
                  <button
                    type="button"
                    onClick={() => makeCover(index)}
                    className="text-ink-muted hover:text-ink inline-flex items-center gap-1 text-[11px] pointer-coarse:min-h-11"
                    aria-label={`Make photo ${index + 1} the cover`}
                  >
                    <Star className="size-3" aria-hidden="true" />
                    Cover
                  </button>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="text-ink-subtle hover:text-danger inline-flex items-center gap-1 text-[11px] pointer-coarse:min-h-11"
                  aria-label={`Remove photo ${index + 1}`}
                >
                  <X className="size-3" aria-hidden="true" />
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <label
          htmlFor={id}
          aria-disabled={room <= 0 || undefined}
          className={cn(
            'border-border-base bg-surface-raised text-ink hover:bg-surface-sunken inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium pointer-coarse:min-h-11',
            room <= 0 && 'pointer-events-none opacity-50',
          )}
        >
          <ImagePlus className="size-4" aria-hidden="true" />
          {photos.length ? 'Add more photos' : 'Choose or take photos'}
        </label>
        <input
          id={id}
          type="file"
          multiple
          disabled={room <= 0}
          accept={IMAGE_MIME_TYPES.join(',')}
          className="sr-only"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = '';
            void add(files);
          }}
        />
        <span className="text-ink-subtle text-xs" aria-live="polite">
          {busy ? (
            <span className="text-ink-muted inline-flex items-center gap-1.5">
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              Uploading…
            </span>
          ) : (
            `${photos.length} of ${max}`
          )}
        </span>
      </div>
      {error ? (
        <p role="alert" className="text-danger text-xs">
          {error}
        </p>
      ) : hint ? (
        <p className="text-ink-subtle text-xs">{hint}</p>
      ) : null}
    </div>
  );
}
