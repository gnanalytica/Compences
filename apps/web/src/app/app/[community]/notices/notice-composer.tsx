'use client';

import { useActionState, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { AUDIENCE_LABEL } from '@compences/core';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { EMPTY_STATE, type ActionState } from '@/lib/action-state';
import { postAnnouncement } from './actions';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Posting…' : 'Post notice'}
    </Button>
  );
}

export function NoticeComposer({ slug }: { slug: string }) {
  const [state, action] = useActionState<ActionState, FormData>(postAnnouncement, EMPTY_STATE);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <Card>
      <CardHeader
        title="Post a notice"
        description="Everyone in the audience you choose will see this."
      />
      <CardBody>
        <form
          ref={formRef}
          action={async (formData) => {
            await action(formData);
            formRef.current?.reset();
          }}
          className="space-y-4"
        >
          <input type="hidden" name="slug" value={slug} />

          <Field label="Title" htmlFor="title" error={state.fieldErrors?.title} required>
            {(control) => (
              <Input {...control} name="title" placeholder="Water supply interruption" required />
            )}
          </Field>

          <Field label="Notice" htmlFor="body" error={state.fieldErrors?.body} required>
            {(control) => (
              <Textarea
                {...control}
                name="body"
                rows={4}
                placeholder="Supply will be off from 10am to 2pm on Saturday while the tanks are cleaned."
                required
              />
            )}
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Audience" htmlFor="audience" error={state.fieldErrors?.audience}>
              {(control) => (
                <Select {...control} name="audience" defaultValue="all">
                  {Object.entries(AUDIENCE_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field
              label="Hide after"
              htmlFor="expires_at"
              error={state.fieldErrors?.expires_at}
              hint="Leave empty to keep it up."
            >
              {(control) => <Input {...control} name="expires_at" type="datetime-local" />}
            </Field>
          </div>

          <label className="text-ink flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="is_pinned"
              className="border-border-strong size-4 rounded"
            />
            Pin to the top
          </label>

          {state.error ? (
            <p role="alert" className="text-danger text-sm">
              {state.error}
            </p>
          ) : null}
          {state.success ? (
            <p role="status" className="text-success text-sm">
              {state.success}
            </p>
          ) : null}

          <Submit />
        </form>
      </CardBody>
    </Card>
  );
}
