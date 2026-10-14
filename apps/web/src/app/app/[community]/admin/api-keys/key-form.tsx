'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Check, Copy, TriangleAlert } from 'lucide-react';
import { API_SCOPES } from '@compences/core';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { createApiKey, type ApiKeyState } from './actions';

const initial: ApiKeyState = {};

const SCOPE_HELP: Record<string, string> = {
  'announcements:read': 'Read notices',
  'announcements:write': 'Post notices to residents',
  'requests:read': 'Read service requests',
  'requests:write': 'Raise and update service requests',
  'visitors:read': 'Read visitor passes and gate codes',
  'visitors:write': 'Create visitor passes',
  'amenities:read': 'Read amenities and bookings',
  'amenities:write': 'Book amenities',
  'members:read': 'Read the member list',
  'billing:read': 'Read invoices and balances',
};

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? 'Creating…' : 'Create key'}
    </Button>
  );
}

function RevealedKey({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="border-warning/40 bg-warning/10 rounded-xl border p-4">
      <p className="text-ink flex items-center gap-1.5 text-sm font-medium">
        <TriangleAlert className="text-warning size-4" aria-hidden="true" />
        Copy this now. It won’t be shown again.
      </p>
      <div className="mt-2 flex items-center gap-2">
        <code className="bg-surface-raised text-ink min-w-0 flex-1 truncate rounded-lg px-3 py-2 font-mono text-xs">
          {value}
        </code>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              // Clipboard can be blocked; the key is selectable on screen.
            }
          }}
          className="border-border-base bg-surface-raised hover:bg-surface-sunken inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-sm"
        >
          {copied ? (
            <Check className="text-success size-4" aria-hidden="true" />
          ) : (
            <Copy className="size-4" aria-hidden="true" />
          )}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <p className="text-ink-muted mt-2 text-xs">
        If you lose it, revoke the key and make a new one.
      </p>
    </div>
  );
}

export function ApiKeyForm({ slug }: { slug: string }) {
  const [state, action] = useActionState(createApiKey, initial);

  return (
    <Card className="h-fit">
      <CardHeader title="Create a key" description="Grant only what the integration needs." />
      <CardBody className="space-y-4">
        {state.createdKey ? <RevealedKey value={state.createdKey} /> : null}

        <form action={action} className="space-y-4">
          <input type="hidden" name="slug" value={slug} />

          <Field label="Name" htmlFor="name" error={state.fieldErrors?.name} required>
            {(control) => (
              <Input {...control} name="name" placeholder="Claude assistant" required />
            )}
          </Field>

          <fieldset>
            <legend className="text-ink mb-2 block text-sm font-medium">Scopes</legend>
            <div className="space-y-1.5">
              {API_SCOPES.map((scope) => (
                <label key={scope} className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="scopes"
                    value={scope}
                    defaultChecked={scope.endsWith(':read')}
                    className="border-border-strong mt-0.5 size-4 rounded"
                  />
                  <span>
                    <span className="text-ink font-mono text-xs">{scope}</span>
                    <span className="text-ink-subtle block text-xs">{SCOPE_HELP[scope]}</span>
                  </span>
                </label>
              ))}
            </div>
            {state.fieldErrors?.scopes ? (
              <p role="alert" className="text-danger mt-1.5 text-xs">
                {state.fieldErrors.scopes}
              </p>
            ) : null}
          </fieldset>

          <Field
            label="Expires"
            htmlFor="expires_at"
            error={state.fieldErrors?.expires_at}
            hint="Optional, but a good idea."
          >
            {(control) => <Input {...control} name="expires_at" type="datetime-local" />}
          </Field>

          {state.error ? (
            <p role="alert" className="text-danger text-sm">
              {state.error}
            </p>
          ) : null}

          <Submit />
        </form>
      </CardBody>
    </Card>
  );
}
