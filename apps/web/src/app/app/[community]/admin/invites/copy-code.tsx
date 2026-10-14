'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { formatInviteCode } from '@compences/core';

/**
 * Shows a freshly minted code with a one-tap copy. The code is also listed in
 * the table below, so nothing is lost if the copy fails or the page reloads.
 */
export function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const display = formatInviteCode(code);

  return (
    <div className="border-brand-200 bg-brand-50 dark:border-brand-800 dark:bg-brand-950 rounded-xl border p-4">
      <p className="text-ink-muted text-xs tracking-wide uppercase">New code</p>
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="text-ink font-mono text-2xl font-semibold tracking-[0.15em]">
          {display}
        </span>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(display);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              // Clipboard access can be refused (insecure origin, permissions).
              // The code is on screen either way, so this is not worth an alert.
            }
          }}
          className="border-border-base bg-surface-raised text-ink hover:bg-surface-sunken inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm"
        >
          {copied ? (
            <>
              <Check className="text-success size-4" aria-hidden="true" />
              Copied
            </>
          ) : (
            <>
              <Copy className="size-4" aria-hidden="true" />
              Copy
            </>
          )}
        </button>
      </div>
      <p className="text-ink-muted mt-2 text-xs">
        Send this to the resident. They sign in, then enter it once.
      </p>
    </div>
  );
}
