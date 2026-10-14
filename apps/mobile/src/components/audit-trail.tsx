import { Text, View } from 'react-native';
import { auditTrail, hasAuditTrail, relativeTime } from '@compences/core';
import { Caption } from './ui';
import { useTheme } from '../lib/use-theme';

/**
 * Who approved this, when, and whether anybody has changed it since.
 *
 * The same four facts the web shows beside a payment or a bill, decided by the
 * same rule in `@compences/core`: an edit only counts once the approval has
 * happened. A phone flagging an edit the laptop does not would be a
 * disagreement about the society's own records.
 *
 * Renders nothing at all when there is nothing to say — a dash under every
 * unconfirmed payment is noise on a screen this narrow.
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
  const { colors } = useTheme();
  const facts = auditTrail({ confirmedBy, confirmedAt, editedBy, editedAt });

  if (!hasAuditTrail(facts)) return null;

  return (
    <View style={{ gap: 2 }}>
      {facts.confirmed ? (
        <Caption>
          {confirmedLabel} by {facts.confirmed.by} · {relativeTime(facts.confirmed.at)}
        </Caption>
      ) : null}
      {facts.editedAfter ? (
        <Text style={{ color: colors.warning, fontSize: 12 }}>
          Edited by {facts.editedAfter.by} · {relativeTime(facts.editedAfter.at)}
        </Text>
      ) : null}
    </View>
  );
}
