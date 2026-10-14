/* eslint-disable */
// Generated set for the demo video. Copied into apps/web/src/app/zz-demo/ by
// video/capture/capture.mjs and deleted again when the capture finishes.
import Link from 'next/link';
import { festivalFor, formatDate, formatMoney, fundedPercent, inTheFund } from '@compences/core';
import { PageBody, PageHeader } from '@/components/page-header';
import { festivalVars } from '@/components/festival';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { EVENTS, SOCIETY } from '../demo-data';

const { currency, slug } = SOCIETY;

export default function DemoEvents() {
  return (
    <>
      <PageHeader
        title="Events"
        description="Everything the society has run, is running, and has planned."
      />
      <PageBody>
        <Card>
          <CardHeader title="All events" description="Newest first." />
          <ul className="divide-border-base divide-y">
            {EVENTS.map((event) => (
              <li key={event.slug}>
                <Link
                  href={`/app/${slug}/event`}
                  style={{
                    ...festivalVars(festivalFor(event.name)),
                    borderLeftColor: 'var(--accent)',
                  }}
                  className="hover:bg-surface-sunken block border-l-4 px-5 py-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-ink font-medium">{event.name}</p>
                    <Badge tone={event.tone}>{event.status}</Badge>
                  </div>
                  <p className="text-ink-subtle mt-1 text-xs">
                    {formatDate(event.starts_on)} · {event.note}
                  </p>
                  <p className="text-ink-muted mt-2 text-sm tabular-nums">
                    {formatMoney(inTheFund(event.collected, event.carried), currency)} of{' '}
                    {formatMoney(event.target, currency)}
                  </p>
                  <div className="bg-surface-sunken mt-1.5 h-1.5 overflow-hidden rounded-full">
                    <div
                      className="bg-accent h-full rounded-full"
                      style={{
                        width: `${fundedPercent(inTheFund(event.collected, event.carried), event.target)}%`,
                      }}
                    />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </PageBody>
    </>
  );
}
