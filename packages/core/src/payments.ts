import { z } from 'zod';
import { formatMoney } from './format';

/**
 * Payments go straight from a resident's UPI app to the society's own UPI ID:
 * no gateway, no KYC, nothing to approve. The app opens the UPI app with the
 * amount and a note pre-filled; the resident then reports the 12-digit UPI
 * reference (UTR) and staff confirm it against the bank statement.
 */

/** Same rule as the communities_upi_vpa_format check in the database. */
export const UPI_VPA_PATTERN = /^[A-Za-z0-9._-]{2,255}@[A-Za-z][A-Za-z0-9.-]{1,64}$/;

export const upiVpaSchema = z
  .string()
  .trim()
  .regex(UPI_VPA_PATTERN, 'Enter a UPI ID like society@okaxis');

/** UPI references (UTR / transaction IDs) are 12 digits; some apps show more. */
export const upiReferenceSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/\s+/g, ''))
  .pipe(
    z
      .string()
      .regex(/^[A-Za-z0-9]{10,22}$/, 'Enter the 12-digit UPI reference from your payment app'),
  );

/**
 * The same reference, when the resident may not have one to give.
 *
 * Empty is a real answer now: on an iPhone or the website, digging a
 * twelve-digit UTR out of GPay is the step people abandon, and a payment
 * abandoned at that step has still left their account. A screenshot stands in.
 * Anything that is not empty still has to look like a reference, because a
 * half-typed one is worse than none — it would match nothing and read as
 * though it should.
 */
export const optionalUpiReference = z.preprocess(
  (value) => {
    if (value == null) return null;
    // Whitespace-only is empty too: a field somebody tabbed through is not an
    // attempt at a reference.
    const cleaned = String(value).replace(/\s+/g, '');
    return cleaned === '' ? null : cleaned;
  },
  z.union([z.null(), upiReferenceSchema]),
);

export const reportPaymentSchema = z.object({
  event_id: z.string().uuid(),
  amount: z.coerce.number().positive('Enter the amount you paid').max(10_000_000),
  reference: optionalUpiReference,
});

/**
 * Whether a report carries enough for anybody to ever check it, and what to
 * say when it does not.
 *
 * One of the two, never neither. The reference is what reconciliation runs on;
 * the screenshot is what somebody reads the reference off when the resident
 * did not type it. A report with neither is a claim with nothing behind it,
 * and confirming it would mean taking a stranger's word for money.
 *
 * This is a rule about the contribute form, not about the ledger, so it lives
 * here rather than in a constraint: staff recording a cash payment for a flat
 * have never had either, and never needed one.
 */
export function paymentEvidenceProblem(
  reference: string | null | undefined,
  hasProof: boolean,
): string | null {
  if (reference || hasProof) return null;
  return 'Add the UPI transaction ID or a screenshot of the payment.';
}

/**
 * The same rule for a payment staff record on a flat's behalf, where cash is
 * the one exception: nobody gets a transaction ID for a note handed over at
 * the door. A UPI transfer, a bank transfer or a cheque has a number, or a
 * screenshot showing it, and without one the entry is a claim.
 */
export function recordedPaymentEvidenceProblem(
  method: string,
  reference: string | null | undefined,
  hasProof: boolean,
): string | null {
  if (method === 'cash') return null;
  if (reference?.trim() || hasProof) return null;
  return 'Add the transaction ID or a screenshot. Only cash can be recorded without one.';
}

export type UpiPaymentLink = {
  vpa: string;
  payeeName: string;
  amount: number;
  /** Shown in the resident's and the society's bank statements. */
  note: string;
  /**
   * Our own id for this attempt (UPI `tr`). Many apps echo it back as
   * `txnRef`, which ties the app's response to the payment we started.
   */
  transactionRef?: string;
};

/**
 * The marker that makes a Compences payment findable in a bank statement.
 *
 * Three letters, because the note is typed by hand by everybody whose phone
 * does not open a UPI app from a link, and because it has to survive a bank
 * narration — which arrives as `UPI/CR/612345678901/RIA MENON/HDFC/SMDA1104`,
 * mangled, truncated and upper-cased in ways that vary by bank.
 */
export const NOTE_TAG = 'SMD';

/**
 * A note that identifies the payment on a bank statement, e.g.
 * "SMDA1104 GANESH".
 *
 * Two parts doing two jobs. `SMDA1104` is one contiguous alphanumeric token —
 * no spaces, no hyphens — because that is the only shape a narration reliably
 * preserves, and it is what the reconcile screen searches for to say whose
 * money a line is. "GANESH" is for the human reading their own bank statement
 * three months later.
 *
 * The token goes first. Banks truncate narration from the right, so the part
 * that has to survive is the part that arrives first.
 *
 * It names the flat, not the payment. A per-payment code would have to be
 * issued before the resident leaves to pay — which means a row for every
 * person who opens the screen and changes their mind, and those rows would
 * land in the "waiting to be confirmed" total. The flat is what staff actually
 * need in order to attribute money, and two payments from one flat are two
 * payments from one flat, which is the right answer to that question.
 */
export function upiNote(flatLabel: string | null | undefined, eventName: string): string {
  const flat = normalizeFlat(flatLabel);
  const event = eventName
    .replace(/[^A-Za-z0-9 ]/g, ' ')
    .trim()
    .split(/\s+/)[0]
    ?.toUpperCase();
  // No flat, no token: there would be nothing for it to identify.
  return [flat ? `${NOTE_TAG}${flat}` : '', event].filter(Boolean).join(' ').slice(0, 50);
}

/** `A-1104` and `a 1104` are the same flat; a narration keeps neither shape. */
export function normalizeFlat(label: string | null | undefined): string {
  return (label ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

/**
 * The flat a bank line names, if the payer kept our note on it.
 *
 * Searched rather than parsed: by the time a narration reaches a statement the
 * token is surrounded by the bank's own punctuation, and which punctuation
 * depends on the bank.
 */
export function flatTagIn(narration: string | null | undefined): string | null {
  if (!narration) return null;
  const match = new RegExp(`${NOTE_TAG}([A-Za-z0-9]{1,12})`, 'i').exec(narration);
  return match?.[1] ? match[1].toUpperCase() : null;
}

/** Whether a bank line's tag names this flat. Both sides are normalised. */
export function flatMatchesTag(
  flatLabel: string | null | undefined,
  tag: string | null | undefined,
): boolean {
  const flat = normalizeFlat(flatLabel);
  return flat.length > 0 && flat === normalizeFlat(tag);
}

/** The `upi://pay` link every UPI app understands (NPCI deep-link format). */
export function upiPayUri({
  vpa,
  payeeName,
  amount,
  note,
  transactionRef,
}: UpiPaymentLink): string {
  const params = new URLSearchParams({
    pa: vpa,
    pn: payeeName,
    am: amount.toFixed(2),
    cu: 'INR',
    tn: note,
  });
  if (transactionRef) params.set('tr', transactionRef);
  return `upi://pay?${params.toString().replace(/\+/g, '%20')}`;
}

/** A fresh, UPI-safe reference for one payment attempt, e.g. "SMDY7K2F9QX1". */
export function newTransactionRef(): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `SMDY${Date.now().toString(36)}${random}`.toUpperCase().slice(0, 35);
}

export type UpiAppResult = {
  /** 'submitted' means the UPI app accepted it but the bank has not settled yet. */
  status: 'success' | 'submitted' | 'failure' | 'unknown';
  /** The bank reference (UTR) when the app gives one, else the app's transaction id. */
  reference: string | null;
  approvalRef: string | null;
  txnId: string | null;
  txnRef: string | null;
  responseCode: string | null;
  raw: string;
};

/**
 * Reads the key=value string an Android UPI app hands back after a payment,
 * e.g. "txnId=AXI123&responseCode=00&Status=SUCCESS&txnRef=SMDY...&ApprovalRefNo=612345678901".
 *
 * Apps differ in key casing, order and which keys they send, and some send
 * nothing. The result is the payer's phone talking, not the bank: treat it as
 * a report that still needs staff to confirm against the statement.
 */
export function parseUpiResponse(raw: string | null | undefined): UpiAppResult {
  const text = (raw ?? '').trim().replace(/^\?/, '');
  const values = new Map<string, string>();
  for (const part of text.split('&')) {
    const index = part.indexOf('=');
    if (index <= 0) continue;
    const key = part.slice(0, index).trim().toLowerCase();
    let value = part.slice(index + 1).trim();
    try {
      value = decodeURIComponent(value.replace(/\+/g, ' '));
    } catch {
      // Keep the raw value if an app sent a malformed escape.
    }
    if (value && value.toLowerCase() !== 'null' && value.toLowerCase() !== 'undefined') {
      values.set(key, value);
    }
  }

  const statusText = (values.get('status') ?? '').toLowerCase();
  const status: UpiAppResult['status'] =
    statusText === 'success'
      ? 'success'
      : statusText === 'submitted' || statusText === 'pending'
        ? 'submitted'
        : statusText === 'failure' || statusText === 'failed'
          ? 'failure'
          : 'unknown';

  const approvalRef = values.get('approvalrefno') ?? null;
  const txnId = values.get('txnid') ?? null;
  const usable = (value: string | null) =>
    value && /^[A-Za-z0-9]{10,22}$/.test(value.replace(/\s+/g, ''))
      ? value.replace(/\s+/g, '')
      : null;

  return {
    status,
    reference: usable(approvalRef) ?? usable(txnId),
    approvalRef,
    txnId,
    txnRef: values.get('txnref') ?? null,
    responseCode: values.get('responsecode') ?? null,
    raw: text,
  };
}

/**
 * For staff reviewing a report: how it reached us. A capture from the UPI app is
 * still the payer's phone talking, but an echoed transaction reference means it
 * answered the payment Compences started rather than something pasted in.
 */
export function upiCaptureNote(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const data = payload as Record<string, unknown>;
  if (data.source !== 'upi_app') return null;
  const echoed = Boolean(data.txn_ref) && data.txn_ref === data.expected_txn_ref;
  const processing =
    data.status === 'submitted' ? ' The UPI app said it was still processing.' : '';
  return echoed
    ? `Captured from the resident’s UPI app.${processing}`
    : `Captured from the resident’s UPI app, but it did not return our payment reference, so check it carefully.${processing}`;
}

/** Storage paths, mirroring the bucket policies in the database. */
export const billPath = (communityId: string, eventId: string, fileName: string) =>
  `${communityId}/${eventId}/${safeFileName(fileName)}`;

export const paymentProofPath = (communityId: string, membershipId: string, fileName: string) =>
  `${communityId}/${membershipId}/${safeFileName(fileName)}`;

/**
 * The receipt for money the society paid from its own balance — a repair, or
 * paying somebody back — in the bills bucket, under the society rather than
 * an event. Every member can open it once a row points at it.
 */
export const societyProofPath = (communityId: string, fileName: string) =>
  `${communityId}/society/${safeFileName(fileName)}`;

/** Unique, URL-safe file name that keeps the extension. */
export function safeFileName(original: string): string {
  const dot = original.lastIndexOf('.');
  const ext =
    dot > -1
      ? original
          .slice(dot + 1)
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')
      : '';
  const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return ext ? `${stamp}.${ext}` : stamp;
}

export const UPLOAD_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/pdf',
] as const;

/**
 * The amounts the contribute screen offers, given what the event asks for.
 *
 * Societies do not think in ladders, they think in a figure: "₹2,100 per flat
 * this year." When the committee has named one it is the whole answer, and the
 * only other chip worth offering is twice it — for the household paying for
 * two flats they own, or doubling as a gesture, both of which happen often
 * enough to be worth a tap. Everything else is what the custom field is for.
 *
 * With no figure named, the generic ladder stands in. There is one of it now:
 * the web offered ₹500/₹1,001/₹2,001/₹5,001 and the phone ₹1,001/₹2,001/₹5,001,
 * which is the kind of difference nobody decides on purpose.
 */
/**
 * A member's own payments, totalled the way a fund bar reads them: what staff
 * have confirmed, and what is still to be confirmed. A payment turned down or
 * refunded counts in neither.
 */
export function myPaymentTotals(rows: { amount: number | string; status: string }[]): {
  confirmed: number;
  pending: number;
} {
  let confirmed = 0;
  let pending = 0;
  for (const row of rows) {
    if (row.status === 'succeeded') confirmed += Number(row.amount);
    else if (row.status === 'pending') pending += Number(row.amount);
  }
  return { confirmed, pending };
}

export const GENERIC_CONTRIBUTION_PRESETS = [500, 1001, 2001, 5001] as const;

export function contributionPresets(suggested: number | null | undefined): number[] {
  const asked = Number(suggested ?? 0);
  if (!Number.isFinite(asked) || asked <= 0) return [...GENERIC_CONTRIBUTION_PRESETS];
  return [asked, asked * 2];
}

/** True when this chip is the figure the committee actually asked for. */
export function isSuggestedAmount(preset: number, suggested: number | null | undefined): boolean {
  const asked = Number(suggested ?? 0);
  return Number.isFinite(asked) && asked > 0 && preset === asked;
}

/**
 * What a resident said they paid, when the committee wrote down something else.
 *
 * `amount` is the one number every total reads, so a correction moves the fund
 * bar, the ledger and the resident's own history without any of them knowing a
 * correction happened. That is right for the arithmetic and wrong for the
 * person: somebody who reported ₹1,000 and sees ₹10 needs to be told, on the
 * row, that the change was deliberate and who made it — otherwise the app
 * looks like it lost their money.
 *
 * Null when nothing was corrected, which is almost every row.
 */
export function correctionNote(
  amount: number | string | null | undefined,
  reportedAmount: number | string | null | undefined,
  currency = 'INR',
): string | null {
  if (reportedAmount === null || reportedAmount === undefined || reportedAmount === '') return null;
  const reported = Number(reportedAmount);
  const recorded = Number(amount ?? 0);
  if (!Number.isFinite(reported) || !Number.isFinite(recorded)) return null;
  if (reported === recorded) return null;
  return `Corrected from ${formatMoney(reported, currency)}, which is what you reported`;
}

/** The same fact, for whoever is reading somebody else's row. */
export function correctionNoteForStaff(
  amount: number | string | null | undefined,
  reportedAmount: number | string | null | undefined,
  currency = 'INR',
): string | null {
  const note = correctionNote(amount, reportedAmount, currency);
  if (!note) return null;
  return `Corrected from ${formatMoney(Number(reportedAmount), currency)}, which is what the flat reported`;
}
