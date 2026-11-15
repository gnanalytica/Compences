import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TODO_KIND, TODO_ORDER } from '../src/copy';
import { notificationAppRoute, notificationWebPath } from '../src/notifications';
import { can } from '../src/roles';
import {
  REPORT_DECISION,
  REPORT_REASONS,
  REPORT_REASON_LABEL,
  REPORT_SUBJECTS,
  blockErrorMessage,
  blockExplainer,
  contentReportSchema,
  isReportKind,
  reportCountLabel,
  reportErrorMessage,
  reportHeading,
  reportReasonLabel,
  reportReasonsLine,
  reportSubjectColumns,
  resolveReportMessage,
  toReportsToReview,
} from '../src/reports';

const MIGRATION = readFileSync(
  join(
    __dirname,
    '../../../supabase/migrations/20261115000100_a_neighbour_can_say_this_should_not_be_here.sql',
  ),
  'utf8',
);

const inCheck = (name: string) => {
  const block = MIGRATION.match(new RegExp(`${name}\\s+check \\(\\w+ in \\(([^)]*)\\)`));
  expect(block).not.toBeNull();
  return [...block![1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
};

describe('what can be reported', () => {
  it('is what the database accepts, less the kind only a block files', () => {
    expect(inCheck('content_reports_kind_known')).toEqual([...REPORT_SUBJECTS, 'member']);
  });

  it('names exactly one column on the reports table for each kind', () => {
    for (const subject of REPORT_SUBJECTS) {
      const columns = reportSubjectColumns(subject, 'an-id');
      expect(Object.values(columns).filter(Boolean)).toEqual(['an-id']);
      for (const column of Object.keys(columns)) expect(MIGRATION).toContain(`  ${column} `);
    }
    expect(reportSubjectColumns('review', 'an-id').review_id).toBe('an-id');
  });

  it('tells a kind this app knows from one it does not', () => {
    expect(isReportKind('listing')).toBe(true);
    expect(isReportKind('member')).toBe(true);
    expect(isReportKind('suggestion')).toBe(false);
    expect(isReportKind(null)).toBe(false);
  });
});

describe('report reasons', () => {
  it('are the ones the database accepts, less the one kept for a block', () => {
    expect(inCheck('content_reports_reason_known')).toEqual([...REPORT_REASONS, 'blocked']);
  });

  it('read the same here as in the database', () => {
    for (const [reason, label] of Object.entries(REPORT_REASON_LABEL)) {
      const line =
        reason === 'other' ? `else '${label}'` : new RegExp(`when '${reason}'\\s+then '${label}'`);
      expect(MIGRATION).toMatch(line);
    }
  });

  it('fall back to "Something else" for one this app has not heard of', () => {
    expect(reportReasonLabel('spam')).toBe('Spam or advertising');
    expect(reportReasonLabel('a_newer_reason')).toBe('Something else');
  });

  it('are listed in the order the form offers them, each once', () => {
    expect(reportReasonsLine(['unsafe', 'spam', 'unsafe'])).toBe(
      'Spam or advertising, Unsafe or not allowed',
    );
    expect(reportReasonsLine(['blocked'])).toBe('Blocked by a neighbour');
  });
});

describe('the report form', () => {
  const id = '11111111-1111-4111-8111-111111111111';

  it('takes a kind, a thing and a reason', () => {
    const parsed = contentReportSchema.parse({
      subject_kind: 'review',
      subject_id: id,
      reason: 'harassment',
      details: '  Names my family.  ',
      block: 'on',
    });
    expect(parsed).toEqual({
      subject_kind: 'review',
      subject_id: id,
      reason: 'harassment',
      details: 'Names my family.',
      block: true,
    });
  });

  it('treats an empty box as nothing said, and an unticked one as no block', () => {
    const parsed = contentReportSchema.parse({
      subject_kind: 'listing',
      subject_id: id,
      reason: 'spam',
      details: '   ',
    });
    expect(parsed.details).toBeNull();
    expect(parsed.block).toBe(false);
  });

  it('refuses a person as the thing reported, and the reason kept for a block', () => {
    expect(
      contentReportSchema.safeParse({ subject_kind: 'member', subject_id: id, reason: 'spam' })
        .success,
    ).toBe(false);
    const blocked = contentReportSchema.safeParse({
      subject_kind: 'listing',
      subject_id: id,
      reason: 'blocked',
    });
    expect(blocked.success).toBe(false);
    expect(blocked.error?.issues[0]?.message).toBe('Pick what is wrong with it');
  });

  it('keeps what a neighbour adds to 500 characters, as the database does', () => {
    expect(MIGRATION).toMatch(/length\(details\) <= 500/);
    expect(
      contentReportSchema.safeParse({
        subject_kind: 'comment',
        subject_id: id,
        reason: 'other',
        details: 'x'.repeat(501),
      }).success,
    ).toBe(false);
  });
});

describe('what a refusal says', () => {
  it('says so when it was already reported or blocked', () => {
    expect(reportErrorMessage({ code: '23505', message: 'duplicate key' })).toBe(
      'You have already reported this. The committee has it.',
    );
    expect(blockErrorMessage({ code: '23505' })).toBe('You have already blocked them.');
  });

  it('passes on the sentences the database wrote, and nothing else of its own', () => {
    expect(
      reportErrorMessage({
        code: 'P0001',
        message: 'You cannot report yourself or something you posted',
      }),
    ).toBe('You cannot report yourself or something you posted');
    expect(reportErrorMessage({ code: '42501', message: 'new row violates row-level…' })).toBe(
      'Your report did not go through. Please try again.',
    );
    expect(blockErrorMessage(null)).toBe('That did not go through. Please try again.');
  });

  it('never suggests the blocked person finds out', () => {
    expect(blockExplainer('Chitra')).toContain('They are not told');
    expect(blockExplainer('Chitra')).toContain('Chitra');
  });
});

describe('the committee’s queue', () => {
  const row = {
    id: 'r1',
    subject_kind: 'review',
    listing_id: 'l1',
    review_id: 'v1',
    comment_id: null,
    member_id: null,
    event_slug: null,
    author_name: '  Ismail Rahman ',
    excerpt: 'A cheat.',
    reasons: ['harassment'],
    details: null,
    report_count: 2,
    created_at: '2026-11-15T10:00:00Z',
  };

  it('reads a row into what the screens use', () => {
    expect(toReportsToReview([row])).toEqual([
      {
        id: 'r1',
        kind: 'review',
        listingId: 'l1',
        reviewId: 'v1',
        commentId: null,
        memberId: null,
        eventSlug: null,
        authorName: 'Ismail Rahman',
        excerpt: 'A cheat.',
        reasons: ['harassment'],
        details: [],
        reportCount: 2,
        createdAt: '2026-11-15T10:00:00Z',
      },
    ]);
  });

  it('drops a kind a later database knows and this app does not', () => {
    expect(toReportsToReview([{ ...row, subject_kind: 'suggestion' }])).toEqual([]);
    expect(toReportsToReview(null)).toEqual([]);
  });

  it('never carries who reported', () => {
    const [report] = toReportsToReview([{ ...row, reporter_id: 'm1' } as typeof row]);
    expect(Object.keys(report ?? {}).some((key) => /reporter/i.test(key))).toBe(false);
  });

  it('has a heading and a count for each kind', () => {
    expect(reportHeading({ kind: 'listing', authorName: 'Chitra Rao' })).toBe(
      'Listing by Chitra Rao',
    );
    expect(reportHeading({ kind: 'member', authorName: 'Chitra Rao' })).toBe(
      'Chitra Rao was blocked',
    );
    expect(reportCountLabel({ kind: 'comment', reportCount: 1 })).toBe('Reported by 1 neighbour');
    expect(reportCountLabel({ kind: 'review', reportCount: 3 })).toBe('Reported by 3 neighbours');
    expect(reportCountLabel({ kind: 'member', reportCount: 2 })).toBe('Blocked by 2 neighbours');
  });

  it('words both decisions for each kind', () => {
    for (const kind of [...REPORT_SUBJECTS, 'member'] as const) {
      expect(REPORT_DECISION[kind].remove).toBeTruthy();
      expect(REPORT_DECISION[kind].keep).toBeTruthy();
    }
    // Nothing is taken down when the report is about a person.
    expect(REPORT_DECISION.member.remove).not.toMatch(/remove|take/i);
  });

  it('has a sentence for every answer resolve_report() gives', () => {
    for (const status of ['no_report', 'not_staff', 'already_resolved', 'own_content']) {
      expect(MIGRATION).toContain(`return '${status}'`);
      expect(resolveReportMessage(status)).not.toMatch(/could not record/);
    }
    expect(resolveReportMessage('ok')).toBe('Done.');
    expect(resolveReportMessage('something_new')).toMatch(/could not record/);
  });

  it('is for staff and the committee, not residents', () => {
    expect(can('staff', 'reports:review')).toBe(true);
    expect(can('committee', 'reports:review')).toBe(true);
    expect(can('resident', 'reports:review')).toBe(false);
  });

  it('is on the To do list, ahead of bills', () => {
    expect(TODO_KIND.report_to_review.section).toBe('Reported by neighbours');
    expect(TODO_ORDER.indexOf('report_to_review')).toBeLessThan(
      TODO_ORDER.indexOf('bill_to_approve'),
    );
    expect(MIGRATION).toContain(`select 'report_to_review'`);
  });

  it('opens from its notification, on the web and in the app', () => {
    expect(MIGRATION).toContain(`'screen', 'reports'`);
    expect(notificationWebPath({ screen: 'reports', community_slug: 'green-valley' })).toBe(
      '/app/green-valley/admin/reports',
    );
    expect(notificationAppRoute({ screen: 'reports' })).toBe('/admin/reports');
  });
});
