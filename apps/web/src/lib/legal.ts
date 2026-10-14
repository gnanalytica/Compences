/**
 * Facts shared by the Privacy Policy and the Terms, kept in one place so a new
 * contact address or revision date is a one-line change.
 *
 * Both documents are drafts written against what the product does today. Have
 * them reviewed by a lawyer before relying on them, and update EFFECTIVE_DATE
 * whenever their substance changes.
 */
export const LEGAL = {
  operator: 'Gnanalytica',
  product: 'Compences',
  /** The line that says whose product this is; shown wherever the name is. */
  byline: 'A Gnanalytica product',
  /** What the service was called before it became Compences. */
  formerName: 'Samudaya',
  contactEmail: 'sandeep@gnanalytica.com',
  effectiveDate: '14 October 2026',
  courts: 'Bengaluru, Karnataka',
} as const;
