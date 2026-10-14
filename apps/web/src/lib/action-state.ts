import type { ZodError } from 'zod';

/**
 * The shape every server action returns, so forms can render errors the same
 * way everywhere. `useActionState` needs a serialisable value, which rules out
 * throwing for expected failures like validation.
 */
export type ActionState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: string;
};

export const EMPTY_STATE: ActionState = {};

/**
 * Did the server take it?
 *
 * Not `Boolean(state.success)`: that message is optional, and the actions that
 * skip it are the ones whose result is already visible — postComment returns
 * EMPTY_STATE because the comment itself appears in the thread, and "Posted."
 * underneath would just be noise. Acceptance is the absence of anything to fix.
 *
 * True of EMPTY_STATE too, which is what a form starts on. Callers use this to
 * decide whether to clear a form, and clearing an untouched one is a no-op.
 */
export function wasAccepted(state: ActionState): boolean {
  return !state.error && !state.fieldErrors;
}

/** First message per field — showing three complaints about one input is noise. */
export function fieldErrors(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === 'string' && !out[key]) out[key] = issue.message;
  }
  return out;
}

/**
 * Guard messages raised by the database that are already written for people,
 * so they are shown as-is instead of a generic permission error.
 */
const KNOWN_DB_MESSAGES = [
  'Only the committee can approve or reject a bill',
  'You cannot approve an expense you requested yourself',
  'This event is closed; its ledger cannot be changed',
  'Only the committee can approve or turn down a proposed campaign',
  'Only the committee can close an event',
  'Only staff or the committee can change an event',
  'A closed event cannot be reopened',
  'Only the committee can approve or decline a suggestion',
  'Only staff or the committee can review join requests',
  'Only the committee can admit someone as staff or committee',
  'Committee access is set by the committee, not granted from a join request',
  'Only the committee can change roles',
  'You cannot raise your own role',
  'A community must keep at least one committee member',
  'Only staff or the committee can confirm payments',
  'This payment has already been reviewed',
  'Say why the payment could not be confirmed',
  'You cannot confirm your own payment; another committee member must',
  'You cannot approve a bill you uploaded or revised yourself',
  'Only the committee can correct the amount of a payment',
  'A corrected amount must be more than zero',
  'This event is closed; its ledger cannot be changed',
];

/** Constraint names worth their own explanation. */
const CONSTRAINT_MESSAGES: Record<string, string> = {
  contributions_upi_reference_unique: 'That UPI reference has already been reported.',
  communities_upi_vpa_format: 'Enter a UPI ID like society@okaxis.',
  communities_upi_payee_length: 'Keep the payee name under 80 characters.',
  catalogue_items_unique_label:
    'That name is already in the catalogue. Restore it from Archived if it is hidden.',
  catalogue_items_label_length: 'Give it a name of up to 80 characters.',
  catalogue_items_kind: 'That catalogue section doesn’t exist.',
  units_community_label_key: 'A flat with that tower and number already exists.',
  units_number_not_blank: 'Give the flat a number.',
  communities_pincode_format: 'Enter a 6-digit PIN code.',
  communities_address_length: 'Keep the address under 300 characters.',
};

/**
 * PostgREST codes for a function the database does not have, or has twice.
 * Both mean code shipped ahead of its migration rather than anything the
 * person at the keyboard did.
 */
const SCHEMA_MISMATCH = ['PGRST202', 'PGRST203'];

/**
 * Turns a PostgREST error into something a resident can act on.
 *
 * RLS denials surface as 42501; a violated exclusion constraint (two bookings
 * for one slot) as 23P01. Anything unrecognised gets a generic message rather
 * than leaking database internals into the UI.
 */
export function friendlyDbError(error: { code?: string; message?: string } | null): string {
  if (!error) return 'Something went wrong. Please try again.';

  // A missing function is an environment that never got the migration. Telling
  // someone to try again sends them round a loop that cannot end, so say it is
  // us, and log loudly enough to reach the runtime error dashboard — an error
  // we swallow into form state is otherwise invisible there.
  if (error.code && SCHEMA_MISMATCH.includes(error.code)) {
    console.error('[compences] database is behind the app', error.code, error.message);
    return 'This isn’t available yet. The problem is on our side, and we’ve been alerted.';
  }

  const known = KNOWN_DB_MESSAGES.find((message) => error.message?.includes(message));
  if (known) return known.endsWith('.') ? known : `${known}.`;
  const constraint = Object.keys(CONSTRAINT_MESSAGES).find((name) => error.message?.includes(name));
  if (constraint) return CONSTRAINT_MESSAGES[constraint]!;
  switch (error.code) {
    case '42501':
      return 'You don’t have permission to do that.';
    case '23505':
      return 'That already exists.';
    case '23503':
      return 'That refers to something which no longer exists.';
    case '23P01':
      return 'That slot has just been taken. Pick another time.';
    case '23514':
      return 'Some of those details aren’t valid.';
    default:
      return 'Something went wrong. Please try again.';
  }
}
