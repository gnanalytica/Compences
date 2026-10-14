import { auditTrail, hasAuditTrail, relativeTime } from '@compences/core';

/**
 * Who approved this, when, and whether anybody has changed it since.
 *
 * The four facts a society argues about a year later, in the place the argument
 * happens — next to the record itself, rather than in a log somebody has to go
 * and find.
 *
 * The rule about which edits are worth mentioning lives in `@compences/core`, so
 * the phone flags the same ones. What is left here is only how to draw them.
 */
export function AuditTrail({
  confirmedBy,
  confirmedAt,
  editedBy,
  editedAt,
  confirmedLabel = 'Confirmed',
}: {
  confirmedBy?: string | null;
  confirmedAt?: string | null;
  editedBy?: string | null;
  editedAt?: string | null;
  /** "Approved" reads better on a bill than "Confirmed". */
  confirmedLabel?: string;
}) {
  const facts = auditTrail({ confirmedBy, confirmedAt, editedBy, editedAt });

  if (!hasAuditTrail(facts)) return <span className="text-ink-subtle">—</span>;

  return (
    <span className="block space-y-0.5">
      {facts.confirmed ? (
        <span className="block">
          {confirmedLabel} by {facts.confirmed.by} · {relativeTime(facts.confirmed.at)}
        </span>
      ) : null}
      {facts.editedAfter ? (
        <span className="text-warning block">
          Edited by {facts.editedAfter.by} · {relativeTime(facts.editedAfter.at)}
        </span>
      ) : null}
    </span>
  );
}
