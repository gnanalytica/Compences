/* eslint-disable */
// Generated set for the demo video. Copied into apps/web/src/app/zz-demo/ by
// video/capture/capture.mjs and deleted again when the capture finishes.
//
// Home: what the society is doing and what its money looks like, which is the
// first thing anybody sees and the shot the video opens the app on.
import Link from 'next/link';
import { CalendarDays, Wallet } from 'lucide-react';
import { festivalFor, formatDate, formatMoney } from '@compences/core';
import { StatTile, StatTiles } from '@/components/badges';
import { PageBody } from '@/components/page-header';
import { FestivalHeader, festivalVars } from '@/components/festival';
import { Badge } from '@/components/ui/badge';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { EVENTS, SOCIETY, TOTALS, YOU } from './demo-data';

const { currency, slug } = SOCIETY;
const base = `/app/${slug}`;

export default function DemoHome() {
  const open = EVENTS.filter((event) => event.status !== 'Closed');
  // Opening the app in September should look like September.
  const festival = festivalFor(open[0]?.name);

  return (
    <div style={festivalVars(festival)}>
      <FestivalHeader
        festival={festival}
        title={`Hello, ${YOU.name.split(' ')[0]}`}
        description={`${SOCIETY.name} · ${festival.label} next`}
      />
      <PageBody>
        <StatTiles>
          <StatTile label="Collected" value={formatMoney(TOTALS.collected, currency)} />
          <StatTile label="Spent" value={formatMoney(TOTALS.spent, currency)} />
          <StatTile label="Balance" value={formatMoney(TOTALS.balance, currency)} tone="success" />
        </StatTiles>

        <Card className="mt-5">
          <CardHeader
            title="What is running"
            description="Events open for contributions right now."
          />
          <ul className="divide-border-base divide-y">
            {open.map((event) => (
              <li key={event.slug}>
                <Link
                  href={`${base}/events`}
                  className="hover:bg-surface-sunken flex items-center gap-3 px-5 py-4"
                >
                  <CalendarDays className="text-accent size-5 shrink-0" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-ink font-medium">{event.name}</p>
                      <Badge tone={event.tone}>{event.status}</Badge>
                    </div>
                    <p className="text-ink-subtle mt-0.5 text-xs">
                      {formatDate(event.starts_on)} · {event.note}
                    </p>
                  </div>
                  <p className="text-ink shrink-0 text-sm font-semibold tabular-nums">
                    {formatMoney(event.collected, currency)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="mt-5">
          <CardHeader title="The society's money" />
          <CardBody>
            <Link
              href={`${base}/money`}
              className="text-ink hover:bg-surface-sunken -mx-2 flex items-center gap-3 rounded-lg px-2 py-2 text-sm"
            >
              <Wallet className="text-accent size-5 shrink-0" aria-hidden="true" />
              <span className="flex-1">
                Every payment in and every bill out, with the name behind it
              </span>
              <span className="text-ink-subtle">Open</span>
            </Link>
          </CardBody>
        </Card>
      </PageBody>
    </div>
  );
}
