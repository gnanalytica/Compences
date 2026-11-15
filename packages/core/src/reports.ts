import { z } from 'zod';
import { uuid } from './schemas';

/**
 * Reporting and blocking: how a resident says "this should not be here" about
 * a listing, a review or a comment, and how they stop seeing what one
 * neighbour posts.
 *
 * Both app stores ask this of any app where people post (Apple's guideline
 * 1.2): a way to report, a way to block, and somebody who acts on reports
 * promptly. The database (migration 1115.0100) is the authority on who may
 * report what and who may decide it; this file is the shared vocabulary and
 * the sentences every surface says about it.
 *
 * Who reported is never shown to anybody in the society — not to whoever
 * posted it, and not to the committee, who are neighbours too.
 */

/** What a resident can report. Mirrors content_reports_kind_known, less 'member'. */
export const REPORT_SUBJECTS = ['listing', 'review', 'comment'] as const;

export type ReportSubject = (typeof REPORT_SUBJECTS)[number];

/**
 * What an item in the committee's queue can be about: something posted, or a
 * person — filed by the database when somebody is blocked, never by a form.
 */
export type ReportKind = ReportSubject | 'member';

export function isReportKind(value: unknown): value is ReportKind {
  return value === 'member' || (REPORT_SUBJECTS as readonly unknown[]).includes(value);
}

/**
 * The columns on content_reports that name the thing: one of them set, the
 * other two empty, which is what the database insists on.
 */
export function reportSubjectColumns(kind: ReportSubject, id: string) {
  return {
    listing_id: kind === 'listing' ? id : null,
    review_id: kind === 'review' ? id : null,
    comment_id: kind === 'comment' ? id : null,
  };
}

/** "Report this listing", "this review", "this comment". */
export const REPORT_SUBJECT_NOUN: Record<ReportSubject, string> = {
  listing: 'listing',
  review: 'review',
  comment: 'comment',
};

/** Mirrors the content_reports_reason_known check constraint, less 'blocked'. */
export const REPORT_REASONS = [
  'spam',
  'offensive',
  'harassment',
  'scam',
  'unsafe',
  'other',
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

/** The same words as app.report_reason_label() in the database. */
export const REPORT_REASON_LABEL: Record<ReportReason | 'blocked', string> = {
  spam: 'Spam or advertising',
  offensive: 'Offensive or hateful',
  harassment: 'Harassment or a personal attack',
  scam: 'Misleading or a scam',
  unsafe: 'Unsafe or not allowed',
  other: 'Something else',
  blocked: 'Blocked by a neighbour',
};

/** A reason as words; one this app has not heard of reads as "Something else". */
export function reportReasonLabel(reason: string): string {
  return reason in REPORT_REASON_LABEL
    ? REPORT_REASON_LABEL[reason as keyof typeof REPORT_REASON_LABEL]
    : REPORT_REASON_LABEL.other;
}

/** The fields of the report form, on the web and in the app. */
export const contentReportSchema = z.object({
  subject_kind: z.enum(REPORT_SUBJECTS),
  subject_id: uuid,
  reason: z.enum(REPORT_REASONS, { message: 'Pick what is wrong with it' }),
  details: z
    .string()
    .trim()
    .max(500, 'Keep it under 500 characters')
    .optional()
    .transform((value) => (value ? value : null)),
  /** "Also block them", ticked. A checkbox arrives as 'on' or not at all. */
  block: z
    .union([z.boolean(), z.literal('on'), z.literal('true'), z.literal('false'), z.literal('')])
    .optional()
    .transform((value) => value === true || value === 'on' || value === 'true'),
});

export type ContentReportInput = z.infer<typeof contentReportSchema>;

/** Said under every report form. The Terms make the same promise. */
export const REPORT_PROMISE =
  'The committee looks at reports within 24 hours. Nobody is told who reported it.';

/** Said before a block is confirmed. */
export function blockExplainer(name: string): string {
  return `You will stop seeing what ${name} posts: listings, reviews and comments. They are not told. The committee is told that somebody blocked them, not who.`;
}

/** Said once a report has gone in. */
export const REPORT_SENT = 'Reported. The committee will look at it within 24 hours.';

type DbError = { code?: string | null; message?: string | null } | null | undefined;

/**
 * A sentence for a report the database refused. The trigger's own refusals
 * are written to be read ("You cannot report yourself or something you
 * posted"), so they pass through; everything else gets a plain line rather
 * than a constraint name.
 */
export function reportErrorMessage(error: DbError): string {
  if (error?.code === '23505') return 'You have already reported this. The committee has it.';
  if (error?.code === 'P0001' && error.message) return error.message;
  return 'Your report did not go through. Please try again.';
}

/** The same, for a block. */
export function blockErrorMessage(error: DbError): string {
  if (error?.code === '23505') return 'You have already blocked them.';
  if (error?.code === 'P0001' && error.message) return error.message;
  return 'That did not go through. Please try again.';
}

// ---------------------------------------------------------------------------
// The committee's side
// ---------------------------------------------------------------------------

/** One row of public.reports_to_review(): one thing reported, however many reported it. */
export type ReportToReview = {
  /** The earliest open report about it; what resolve_report() is given. */
  id: string;
  kind: ReportKind;
  /** The listing itself, or the listing a reported review is on. */
  listingId: string | null;
  reviewId: string | null;
  commentId: string | null;
  /** The person, when somebody was blocked. */
  memberId: string | null;
  /** The event a reported comment is under, when it is under one. */
  eventSlug: string | null;
  authorName: string;
  /** What it said when it was first reported. */
  excerpt: string | null;
  reasons: string[];
  /** What the neighbours who reported it added, oldest first. Never who they are. */
  details: string[];
  reportCount: number;
  createdAt: string;
};

/** The shape supabase-js hands back for a reports_to_review() row. */
export type ReportToReviewRow = {
  id: string | null;
  subject_kind: string | null;
  listing_id: string | null;
  review_id: string | null;
  comment_id: string | null;
  member_id: string | null;
  event_slug: string | null;
  author_name: string | null;
  excerpt: string | null;
  reasons: string[] | null;
  details: string[] | null;
  report_count: number | null;
  created_at: string | null;
};

/** Rows as the screens read them; one of a kind this app does not know is dropped. */
export function toReportsToReview(rows: ReportToReviewRow[] | null | undefined): ReportToReview[] {
  return (rows ?? []).flatMap((row) =>
    row.id && isReportKind(row.subject_kind)
      ? [
          {
            id: row.id,
            kind: row.subject_kind,
            listingId: row.listing_id,
            reviewId: row.review_id,
            commentId: row.comment_id,
            memberId: row.member_id,
            eventSlug: row.event_slug,
            authorName: row.author_name?.trim() || 'A resident',
            excerpt: row.excerpt,
            reasons: row.reasons ?? [],
            details: row.details ?? [],
            reportCount: Number(row.report_count ?? 1),
            createdAt: row.created_at ?? '',
          },
        ]
      : [],
  );
}

/** "Listing by Chitra Rao", "Chitra Rao was blocked". */
export function reportHeading(report: Pick<ReportToReview, 'kind' | 'authorName'>): string {
  switch (report.kind) {
    case 'listing':
      return `Listing by ${report.authorName}`;
    case 'review':
      return `Review by ${report.authorName}`;
    case 'comment':
      return `Comment by ${report.authorName}`;
    case 'member':
      return `${report.authorName} was blocked`;
  }
}

/** "Spam or advertising, Misleading or a scam", in the order the form offers them. */
export function reportReasonsLine(reasons: string[]): string {
  const known = [...REPORT_REASONS, 'blocked'] as string[];
  return [...new Set(reasons)]
    .sort((a, b) => known.indexOf(a) - known.indexOf(b))
    .map(reportReasonLabel)
    .join(', ');
}

/** "Reported by 3 neighbours", "Blocked by 1 neighbour". */
export function reportCountLabel(report: Pick<ReportToReview, 'kind' | 'reportCount'>): string {
  const n = Math.max(1, report.reportCount);
  return `${report.kind === 'member' ? 'Blocked' : 'Reported'} by ${n} ${n === 1 ? 'neighbour' : 'neighbours'}`;
}

/**
 * The two decisions, in words that fit what is being decided. A block has
 * nothing to take down: it is there so the committee knows, and the choice is
 * between having dealt with it and there being nothing to deal with.
 */
export const REPORT_DECISION: Record<
  ReportKind,
  { remove: string; keep: string; noteLabel: string; notePlaceholder: string }
> = {
  listing: {
    remove: 'Take it down',
    keep: 'Leave it up',
    noteLabel: 'Reason for the seller',
    notePlaceholder: 'e.g. Not allowed under the society’s bye-laws',
  },
  review: {
    remove: 'Remove review',
    keep: 'Leave it up',
    noteLabel: 'Reason for whoever wrote it',
    notePlaceholder: 'e.g. A review is about what was bought, not about the person',
  },
  comment: {
    remove: 'Remove comment',
    keep: 'Leave it up',
    noteLabel: 'Reason for whoever wrote it',
    notePlaceholder: 'e.g. Keep it civil, please',
  },
  member: {
    remove: 'Dealt with',
    keep: 'Nothing to do',
    noteLabel: 'A note for the record (optional)',
    notePlaceholder: 'e.g. Spoke to both of them',
  },
};

/** The statuses public.resolve_report() can return. */
export type ResolveReportStatus =
  'ok' | 'no_report' | 'not_staff' | 'already_resolved' | 'own_content';

const RESOLVE_MESSAGES: Record<ResolveReportStatus, string> = {
  ok: 'Done.',
  no_report: 'That report is no longer there.',
  not_staff: 'Only staff and the committee can decide a report.',
  already_resolved: 'Somebody has already decided this one.',
  own_content: 'This is about something you posted, so somebody else on the committee decides it.',
};

export function resolveReportMessage(status: string): string {
  return (
    RESOLVE_MESSAGES[status as ResolveReportStatus] ??
    'We could not record that decision. Please try again.'
  );
}
