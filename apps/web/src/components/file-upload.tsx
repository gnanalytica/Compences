'use client';

import { useId, useState } from 'react';
import { CheckCircle2, Loader2, Paperclip, X } from 'lucide-react';
import { safeFileName, UPLOAD_MIME_TYPES } from '@compences/core';
import { getBrowserSupabase } from '@/lib/supabase/browser';

type Status =
  | { kind: 'idle' }
  | { kind: 'uploading'; name: string }
  | { kind: 'done'; name: string }
  | { kind: 'error'; message: string };

/**
 * Uploads one file straight to Supabase Storage with the signed-in user's
 * session and puts the stored path into a hidden input, so the surrounding
 * server action only ever receives a path. Storage policies decide whether the
 * upload is allowed; the checks here just give a faster, friendlier answer.
 */
export function FileUpload({
  bucket,
  folder,
  name,
  label,
  hint,
  maxBytes,
  defaultPath,
  onUploadingChange,
}: {
  bucket: 'bills' | 'payment-proofs';
  /** `{community_id}/{event_id}` for bills, `{community_id}/{membership_id}` for proofs. */
  folder: string;
  /** Name of the hidden input that carries the stored path. */
  name: string;
  label: string;
  hint?: string;
  maxBytes: number;
  /** An already attached file, kept unless a new one is uploaded or it is removed. */
  defaultPath?: string | null;
  onUploadingChange?: (uploading: boolean) => void;
}) {
  const id = useId();
  const [path, setPath] = useState<string>(defaultPath ?? '');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const setUploading = (uploading: boolean) => onUploadingChange?.(uploading);

  // A file uploaded here but never saved is referenced by nothing, so drop it
  // when it is replaced or removed. The saved file (defaultPath) is left alone:
  // the server removes it only once the new copy is actually saved.
  function discardUnsaved(previous: string) {
    if (!previous || previous === (defaultPath ?? '')) return;
    void getBrowserSupabase().storage.from(bucket).remove([previous]);
  }

  async function upload(file: File) {
    if (!(UPLOAD_MIME_TYPES as readonly string[]).includes(file.type)) {
      setStatus({ kind: 'error', message: 'Attach a photo (JPG, PNG, WebP, HEIC) or a PDF.' });
      return;
    }
    if (file.size > maxBytes) {
      setStatus({
        kind: 'error',
        message: `That file is too large. Keep it under ${Math.round(maxBytes / 1_048_576)} MB.`,
      });
      return;
    }

    setStatus({ kind: 'uploading', name: file.name });
    setUploading(true);
    const objectPath = `${folder}/${safeFileName(file.name)}`;
    const { error } = await getBrowserSupabase()
      .storage.from(bucket)
      .upload(objectPath, file, { contentType: file.type, upsert: false });
    setUploading(false);

    if (error) {
      setStatus({
        kind: 'error',
        message: /row-level security|unauthorized|403/i.test(error.message)
          ? 'You don’t have permission to upload here.'
          : 'The upload failed. Check your connection and try again.',
      });
      return;
    }
    discardUnsaved(path);
    setPath(objectPath);
    setStatus({ kind: 'done', name: file.name });
  }

  const hasExisting = Boolean(path) && status.kind !== 'done';

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-ink block text-sm font-medium">
        {label}
      </label>
      <input type="hidden" name={name} value={path} />
      <div className="flex flex-wrap items-center gap-3">
        <label
          htmlFor={id}
          className="border-border-base bg-surface-raised text-ink hover:bg-surface-sunken inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium"
        >
          <Paperclip className="size-4" aria-hidden="true" />
          {path ? 'Replace file' : 'Choose file or take a photo'}
        </label>
        <input
          id={id}
          type="file"
          // No `capture`: forcing the camera would hide the option to pick a
          // PDF or an existing photo. Mobile browsers still offer the camera.
          accept={UPLOAD_MIME_TYPES.join(',')}
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) void upload(file);
          }}
        />
        {status.kind === 'uploading' ? (
          <span className="text-ink-muted inline-flex items-center gap-1.5 text-xs">
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            Uploading {status.name}…
          </span>
        ) : null}
        {status.kind === 'done' ? (
          <span className="text-success inline-flex items-center gap-1.5 text-xs">
            <CheckCircle2 className="size-3.5" aria-hidden="true" />
            {status.name} attached
          </span>
        ) : null}
        {hasExisting ? <span className="text-ink-muted text-xs">A file is attached.</span> : null}
        {path && status.kind !== 'uploading' ? (
          <button
            type="button"
            onClick={() => {
              discardUnsaved(path);
              setPath('');
              setStatus({ kind: 'idle' });
            }}
            className="text-ink-subtle hover:text-ink inline-flex items-center gap-1 text-xs"
          >
            <X className="size-3.5" aria-hidden="true" />
            Remove
          </button>
        ) : null}
      </div>
      {status.kind === 'error' ? (
        <p role="alert" className="text-danger text-xs">
          {status.message}
        </p>
      ) : hint ? (
        <p className="text-ink-subtle text-xs">{hint}</p>
      ) : null}
    </div>
  );
}
