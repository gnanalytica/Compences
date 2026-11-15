import Link from 'next/link';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import {
  relativeTime,
  reportCountLabel,
  reportHeading,
  reportReasonsLine,
  type ReportToReview,
} from '@compences/core';
import { requireCapability } from '@/lib/auth';
import { getReportsToReview } from '@/lib/reports';
import { PageBody, PageHeader } from '@/components/page-header';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ReportDecision } from './report-decision';

export const metadata = { title: 'Reported by neighbours' };

/** Where the thing that was reported can be read in full. */
function whereItIs(base: string, report: ReportToReview): { href: string; label: string } | null {
  switch (report.kind) {
    case 'listing':
      return report.listingId
        ? { href: `${base}/market/${report.listingId}`, label: 'Open the listing' }
        : null;
    case 'review':
      return report.listingId
        ? { href: `${base}/market/${report.listingId}#reviews`, label: 'Open the listing it is on' }
        : null;
    // A comment hangs off an event or off a suggestion; the queue names the
    // event when there is one.
    case 'comment':
      return report.eventSlug
        ? { href: `${base}/events/${report.eventSlug}#discussion`, label: 'Open the discussion' }
        : { href: `${base}/suggest`, label: 'Open the ideas it is under' };
    case 'member':
      return { href: `${base}/people`, label: 'Open People' };
  }
}

/**
 * What neighbours have reported, for staff and the committee to decide: take
 * it down, or leave it up. One card per thing reported, however many reported
 * it, the longest-waiting first.
 *
 * Who reported is not on this page and is not available to it at all — the
 * database leaves it out, because the committee are neighbours too. Reports
 * about something the reader posted are left out as well; somebody else
 * decides those.
 *
 * Both app stores expect a report to be acted on within a day, which is why a
 * new one notifies staff and the committee and sits near the top of To do.
 */
export default async function ReportsPage(props: PageProps<'/app/[community]/admin/reports'>) {
  const { community: slug } = await props.params;
  const { community, role } = await requireCapability(slug, 'reports:review');
  const reports = await getReportsToReview(community.id, role);
  const base = `/app/${community.slug}`;

  return (
    <>
      <PageHeader
        title="Reported by neighbours"
        description={
          reports.length
            ? `${reports.length} ${reports.length === 1 ? 'thing' : 'things'} to decide. Please decide each within 24 hours.`
            : 'Listings, reviews and comments a neighbour has said should not be here.'
        }
      />
      <PageBody>
        <div className="mx-auto max-w-3xl space-y-5">
          {reports.length ? (
            <>
              <p className="text-ink-muted text-sm">
                Whoever reported it is told what you decided. Whoever posted it is told only if it
                comes down, and never who reported it.
              </p>
              {reports.map((report) => {
                const where = whereItIs(base, report);
                return (
                  <Card key={report.id}>
                    <CardHeader
                      title={reportHeading(report)}
                      description={[
                        reportCountLabel(report),
                        report.createdAt ? relativeTime(report.createdAt) : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    />
                    <CardBody className="space-y-4">
                      {report.excerpt ? (
                        <blockquote className="border-border-strong text-ink border-l-2 pl-3 text-sm leading-relaxed break-words whitespace-pre-line">
                          {report.excerpt}
                        </blockquote>
                      ) : null}
                      {report.kind === 'member' ? (
                        <p className="text-ink-muted text-sm">
                          Nothing was reported with it. It is here so you know, in case it is one of
                          several.
                        </p>
                      ) : (
                        <p className="text-ink text-sm">
                          <span className="text-ink-muted">Reported as: </span>
                          {reportReasonsLine(report.reasons)}
                        </p>
                      )}
                      {report.details.length ? (
                        <ul className="space-y-1">
                          {report.details.map((detail, index) => (
                            <li key={index} className="text-ink-muted text-sm break-words">
                              A neighbour added: “{detail}”
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {where ? (
                        <Link
                          href={where.href}
                          className="text-accent inline-flex items-center gap-1 text-sm hover:underline pointer-coarse:min-h-11"
                        >
                          {where.label}
                          <ArrowRight className="size-3.5" aria-hidden="true" />
                        </Link>
                      ) : null}
                      <div className="border-border-base border-t pt-4">
                        <ReportDecision slug={slug} reportId={report.id} kind={report.kind} />
                      </div>
                    </CardBody>
                  </Card>
                );
              })}
            </>
          ) : (
            <Card>
              <EmptyState
                icon={<ShieldCheck className="size-6" />}
                title="Nothing reported"
                description="When a neighbour reports a listing, a review or a comment, it appears here and on To do."
              />
            </Card>
          )}
        </div>
      </PageBody>
    </>
  );
}
