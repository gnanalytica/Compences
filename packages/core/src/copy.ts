/**
 * Words the product uses, in one place, so the website and the app say the
 * same thing. Plain English for residents first; no internal terms.
 */

export const COPY = {
  todo: 'To do',
  manage: 'Manage',
  money: 'Money',
  households: 'Households',
  societyCode: 'Society code',
  societySettings: 'Society settings',
  upiReference: 'UPI transaction ID (12 digits)',
  upiReferenceHint:
    'In your UPI app, open the payment and copy the 12-digit UPI transaction ID (also called UTR or UPI Ref No).',
  saveForLater: 'Save for later',
  publish: 'Publish',
  publishHint:
    'Publishing shows the event to every resident. Save for later keeps it visible only to staff and the committee.',
  moreOptions: 'More options',
  moreDetails: 'More details',
} as const;

export type TodoKind =
  | 'join_request'
  | 'payment_to_confirm'
  | 'bill_to_approve'
  | 'bill_sent_back'
  | 'campaign_to_review'
  | 'suggestion_to_review'
  | 'flat_change'
  | 'overspent';

/** Section headings and action labels for the To do queue. */
export const TODO_KIND: Record<TodoKind, { section: string; action: string }> = {
  join_request: { section: 'New residents', action: 'Review' },
  payment_to_confirm: { section: 'Receipts to confirm', action: 'Confirm' },
  bill_to_approve: { section: 'Bills to approve', action: 'Approve' },
  bill_sent_back: { section: 'Your bills sent back', action: 'Fix' },
  campaign_to_review: { section: 'Campaigns to review', action: 'Review' },
  suggestion_to_review: { section: 'Suggestions to review', action: 'Review' },
  flat_change: { section: 'Residents who moved', action: 'Approve' },
  overspent: { section: 'Events that spent more than they collected', action: 'Pay back' },
};

export const TODO_ORDER: TodoKind[] = [
  'payment_to_confirm',
  'join_request',
  'bill_to_approve',
  // Somebody is out of pocket for the society; that waits on nothing else.
  'overspent',
  'bill_sent_back',
  'campaign_to_review',
  'suggestion_to_review',
  // Last, because it is the one whose delay costs least: a wrong flat beside
  // somebody's name is worth fixing, and it is not money waiting on a signature.
  'flat_change',
];

/** The event page's tabs, in order. */
export const EVENT_TABS = [
  { id: 'about', label: 'About' },
  { id: 'money', label: 'Money' },
  { id: 'activities', label: 'Activities' },
  { id: 'vote', label: 'Ideas' },
] as const;
export type EventTab = (typeof EVENT_TABS)[number]['id'];

/** How the app looks. System follows the device, and is what everyone starts on. */
export const APPEARANCE_CHOICES = [
  { id: 'system', label: 'System' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
] as const;
export type AppearanceChoice = (typeof APPEARANCE_CHOICES)[number]['id'];

/** Anything unrecognised, including no stored choice, means System. */
export const parseAppearance = (value: unknown): AppearanceChoice =>
  value === 'light' || value === 'dark' ? value : 'system';

/** Default fund rule when the organiser doesn't open "More options". */
export const DEFAULT_FUND_RULE = 'general_fund' as const;

/** Generated web address for an event, e.g. "Deepavali 2026" → "deepavali-2026". */
export function eventSlug(name: string, suffix?: string): string {
  const base =
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50) || 'event';
  return suffix ? `${base}-${suffix}`.slice(0, 60) : base;
}

/**
 * Web address for a society, e.g. "Shraddha Whitecliff" → "shraddha-whitecliff".
 *
 * Mirrors app.society_slug() in the database, which has the final say:
 * create_society() derives the slug itself and hands the real one back, so
 * this is for previews and for the platform team's script. Keep the two in
 * step — note there is deliberately no Unicode normalisation, because Postgres
 * has no unaccent extension here to match it. communities_slug_format wants
 * 3–50 characters, so a name that slugifies to nothing (or to one or two
 * characters) falls back instead of failing the constraint.
 */
export function societySlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '');
  if (!base) return 'society';
  return base.length >= 3 ? base : `${base}-society`;
}
