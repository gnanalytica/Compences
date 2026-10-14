'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { MessageCircle } from 'lucide-react';
import { residentInviteMessage, whatsappShareUrl } from '@compences/core';
import { buttonClass } from '@/components/ui/button';
import { CopyButton } from '@/components/ui/copy-button';

export { CopyButton };

export function JoinQr({ link, societyName }: { link: string; societyName: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    QRCode.toDataURL(link, { margin: 1, width: 240, errorCorrectionLevel: 'M' })
      .then((url) => {
        if (active) setSrc(url);
      })
      .catch(() => {
        if (active) setSrc(null);
      });
    return () => {
      active = false;
    };
  }, [link]);

  return src ? (
    // A data URL generated in the browser; next/image adds nothing for it.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={`QR code to join ${societyName} on Compences`}
      width={240}
      height={240}
      className="border-border-base rounded-lg border bg-white p-2"
    />
  ) : (
    <div className="border-border-base bg-surface-sunken grid size-60 place-items-center rounded-lg border">
      <span className="text-ink-subtle text-xs">Making QR code…</span>
    </div>
  );
}

export function InviteMessage({
  societyName,
  code,
  link,
}: {
  societyName: string;
  code: string;
  link: string;
}) {
  const message = residentInviteMessage({ societyName, code, link });
  return (
    <div className="space-y-3">
      <pre className="border-border-base bg-surface-sunken text-ink rounded-lg border p-4 font-sans text-sm whitespace-pre-wrap">
        {message}
      </pre>
      <div className="flex flex-wrap gap-2">
        <a
          href={whatsappShareUrl(message)}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClass('primary', 'sm')}
        >
          <MessageCircle className="size-4" aria-hidden="true" />
          Share on WhatsApp
        </a>
        <CopyButton value={message} label="Copy message" />
      </div>
    </div>
  );
}
