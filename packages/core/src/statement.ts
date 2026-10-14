/**
 * Reading a bank statement that was not written for us.
 *
 * There is no standard for what an Indian bank exports. HDFC gives you
 * `Withdrawal Amt.` and `Deposit Amt.` in separate columns and dates as
 * dd/mm/yy; ICICI gives `Withdrawal Amount (INR )` with the trailing space;
 * Axis puts `DR|CR` in its own column; SBI writes `16 Sep 2026`. A parser that
 * insists on one shape means a treasurer retyping forty lines by hand, which is
 * how a reconciliation feature ends up unused.
 *
 * So this reads what it is given: it finds the header row wherever it is,
 * recognises the columns by what they are called rather than where they sit,
 * and refuses a line it cannot make sense of instead of guessing. What it
 * cannot read comes back as a problem with the row number on it, so the person
 * holding the file can see which line to look at.
 *
 * It does not touch the network and knows nothing about the database, which is
 * the point: this is the one part of reconciliation that is pure enough to have
 * real tests.
 */

export type StatementLine = {
  /** ISO, because that is the only date format worth storing. */
  posted_on: string;
  /** Signed: money in is positive, money out is negative. */
  amount: number;
  narration: string | null;
  /** The UTR, if the statement gave one or the narration contained one. */
  reference: string | null;
  counterparty: string | null;
  balance_after: number | null;
};

export type StatementParse = {
  lines: StatementLine[];
  /** One per row that could not be read, in the order they appeared. */
  problems: { row: number; reason: string }[];
  /** The header the parser settled on, for showing back "we read these columns". */
  columns: string[];
};

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  sept: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

/** Header names, lowercased and stripped of everything but letters. */
const HEADERS = {
  date: ['date', 'txndate', 'transactiondate', 'valuedate', 'postingdate', 'bookingdate'],
  narration: [
    'narration',
    'description',
    'particulars',
    'details',
    'remarks',
    'transactionremarks',
  ],
  reference: [
    'chequenoref',
    'chqrefno',
    'refnochequeno',
    'reference',
    'refno',
    'utr',
    'transactionid',
    'rrn',
  ],
  debit: ['withdrawalamt', 'withdrawalamount', 'debit', 'debitamount', 'withdrawal', 'dr'],
  credit: ['depositamt', 'depositamount', 'credit', 'creditamount', 'deposit', 'cr'],
  amount: ['amount', 'txnamount', 'transactionamount'],
  type: ['type', 'drcr', 'crdr', 'transactiontype', 'debitcredit'],
  balance: ['balance', 'closingbalance', 'runningbalance', 'balanceinr', 'availablebalance'],
};

function key(value: string): string {
  return value.toLowerCase().replace(/[^a-z]/g, '');
}

/**
 * Splits one CSV line, honouring quotes. Not a general CSV library — it handles
 * quoted fields and doubled quotes, which is everything a bank export uses, and
 * deliberately not embedded newlines, which none of them produce.
 */
export function splitCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quoted) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      out.push(field.trim());
      field = '';
    } else {
      field += char;
    }
  }
  out.push(field.trim());
  return out;
}

/** Tab, then semicolon, then comma — whichever the header row has most of. */
function pickDelimiter(sample: string): string {
  const counts = ['\t', ';', ','].map((d) => [d, sample.split(d).length] as const);
  const best = counts.reduce((a, b) => (b[1] > a[1] ? b : a));
  return best[1] > 1 ? best[0] : ',';
}

/**
 * A date in any of the shapes a statement uses. Two-digit years are read as
 * 20xx: a society's bank statement is not from 1998.
 *
 * dd/mm and mm/dd are genuinely ambiguous for the first twelve days of a month,
 * and every Indian bank writes dd/mm, so that is what this assumes. Where the
 * first part is above 12 it is unambiguous and the assumption costs nothing.
 */
export function parseStatementDate(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  const iso = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(value);
  if (iso) return isoOf(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const named = /^(\d{1,2})[\s\-/]([A-Za-z]{3,4})[\s\-/](\d{2,4})/.exec(value);
  if (named) {
    const month = MONTHS[(named[2] ?? '').toLowerCase()];
    if (!month) return null;
    return isoOf(fullYear(Number(named[3])), month, Number(named[1]));
  }

  const numeric = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/.exec(value);
  if (numeric) {
    return isoOf(fullYear(Number(numeric[3])), Number(numeric[2]), Number(numeric[1]));
  }

  return null;
}

function fullYear(year: number): number {
  return year < 100 ? 2000 + year : year;
}

function isoOf(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  // Catches 31 February, which the constructor would silently roll forward.
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}

/**
 * A rupee figure as written by a bank: `1,234.50`, `(1,234.50)` for a debit,
 * `1234.50 Cr`, `₹1,234`, or blank. Returns null for blank and for anything
 * that is not a number, so a blank debit column does not read as zero.
 */
export function parseMoney(raw: string): number | null {
  const value = raw.replace(/[₹\s,]/g, '').replace(/(cr|dr)$/i, '');
  if (!value || value === '-') return null;
  const bracketed = /^\((.*)\)$/.exec(value);
  const parsed = Number(bracketed ? bracketed[1] : value);
  if (!Number.isFinite(parsed)) return null;
  return bracketed ? -parsed : parsed;
}

/**
 * Why bank_line_candidates offered a pairing, in the words a person confirming
 * it would use. Shared so the web and the phone cannot describe the same
 * candidate differently — and so a tier added to the function has one place to
 * be named rather than two to be forgotten in.
 */
export const MATCH_CONFIDENCE: Record<string, string> = {
  reference: 'same UTR',
  // The narration carries the note Compences put on the payment, so the bank
  // line says which flat sent it. Offered whatever the amounts say.
  flat: 'names this flat',
  amount: 'same amount',
  close: 'close',
};

/**
 * The UTR hiding in a narration.
 *
 * A UPI reference is twelve digits, and every bank buries it in free text
 * somewhere: `UPI/612345678901/Ria Menon`, `UPI-612345678901-...`,
 * `NEFT 612345678901`. Twelve consecutive digits in a narration is that
 * reference often enough to be worth offering as a match, and the person
 * confirming still has to agree.
 */
export function referenceIn(text: string | null): string | null {
  if (!text) return null;
  const match = /(?<!\d)(\d{12})(?!\d)/.exec(text);
  return match?.[1] ?? null;
}

/**
 * The name on the other side of the transfer, pulled out of a UPI narration.
 * Best effort and openly so: it is shown to help staff recognise a line, never
 * used to decide anything.
 */
export function counterpartyIn(text: string | null): string | null {
  if (!text) return null;
  const parts = text.split(/[/|]/).map((part) => part.trim());
  const name = parts.find(
    (part) => /^[A-Za-z][A-Za-z.\s]{2,40}$/.test(part) && !/^(upi|neft|imps|rtgs|ach)$/i.test(part),
  );
  return name ? name.replace(/\s+/g, ' ') : null;
}

/**
 * Which column is this, by name.
 *
 * An exact match first, then a prefix — because ICICI writes
 * `Withdrawal Amount (INR )`, which reduces to `withdrawalamountinr` and is
 * plainly the withdrawal column. Only names of five letters or more may match
 * as a prefix: `dr` would otherwise claim the `DR|CR` column and turn every
 * credit into a debit.
 */
function columnOf(keys: string[], names: string[]): number {
  const exact = keys.findIndex((k) => names.includes(k));
  if (exact >= 0) return exact;
  return keys.findIndex((k) => names.some((name) => name.length >= 5 && k.startsWith(name)));
}

function findHeader(rows: string[][]): number {
  for (let i = 0; i < Math.min(rows.length, 25); i += 1) {
    const keys = (rows[i] ?? []).map(key);
    const hasDate = columnOf(keys, HEADERS.date) >= 0;
    const hasMoney =
      columnOf(keys, HEADERS.amount) >= 0 ||
      columnOf(keys, HEADERS.debit) >= 0 ||
      columnOf(keys, HEADERS.credit) >= 0;
    if (hasDate && hasMoney) return i;
  }
  return -1;
}

/**
 * Turns a pasted or uploaded statement into lines ready for
 * public.import_bank_lines().
 *
 * Rows the parser cannot read are reported rather than dropped silently: a
 * statement that quietly loses three lines is worse than one that will not
 * import, because the totals still look plausible.
 */
export function parseStatement(text: string): StatementParse {
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);

  if (!rows.length) {
    return { lines: [], problems: [{ row: 0, reason: 'The file is empty' }], columns: [] };
  }

  const delimiter = pickDelimiter(rows.slice(0, 25).join('\n'));
  const cells = rows.map((line) => splitCsvLine(line, delimiter));
  const headerAt = findHeader(cells);

  if (headerAt < 0) {
    return {
      lines: [],
      problems: [
        {
          row: 0,
          reason:
            'No header row with a date and an amount. Export the statement as CSV and paste it with its column names.',
        },
      ],
      columns: [],
    };
  }

  const header = cells[headerAt] ?? [];
  const keys = header.map(key);
  const at = {
    date: columnOf(keys, HEADERS.date),
    narration: columnOf(keys, HEADERS.narration),
    reference: columnOf(keys, HEADERS.reference),
    debit: columnOf(keys, HEADERS.debit),
    credit: columnOf(keys, HEADERS.credit),
    amount: columnOf(keys, HEADERS.amount),
    type: columnOf(keys, HEADERS.type),
    balance: columnOf(keys, HEADERS.balance),
  };

  const lines: StatementLine[] = [];
  const problems: { row: number; reason: string }[] = [];
  const cell = (row: string[], index: number) => (index >= 0 ? (row[index] ?? '') : '');

  for (let i = headerAt + 1; i < cells.length; i += 1) {
    const row = cells[i] ?? [];
    // Bank exports end with a totals line and sometimes a disclaimer; both have
    // no readable date, so they fall out here rather than needing a rule.
    const posted = parseStatementDate(cell(row, at.date));
    if (!posted) continue;

    const debit = parseMoney(cell(row, at.debit));
    const credit = parseMoney(cell(row, at.credit));
    const single = parseMoney(cell(row, at.amount));

    let amount: number | null = null;
    if (credit !== null && credit !== 0) amount = Math.abs(credit);
    else if (debit !== null && debit !== 0) amount = -Math.abs(debit);
    else if (single !== null && single !== 0) {
      const marker = cell(row, at.type).toUpperCase();
      // A DR/CR column overrides the sign; without one, a bank that writes
      // debits as positives is indistinguishable from one that does not, and
      // the sign it gave us is the only evidence there is.
      if (marker.startsWith('D') || marker.includes('WITHDRAW')) amount = -Math.abs(single);
      else if (marker.startsWith('C') || marker.includes('DEPOSIT')) amount = Math.abs(single);
      else amount = single;
    }

    if (amount === null) {
      problems.push({ row: i + 1, reason: 'No amount on this line' });
      continue;
    }

    const narration = cell(row, at.narration).trim() || null;
    const stated = cell(row, at.reference).trim();
    // HDFC fills its reference column with `0000000000` on every UPI line. A
    // reference of all zeros is the bank saying "none", and storing it would
    // make every such line look like the same transfer.
    const meaningful = /[1-9]/.test(stated) ? stated : '';
    lines.push({
      posted_on: posted,
      amount: Math.round(amount * 100) / 100,
      narration,
      reference: referenceIn(stated) ?? referenceIn(narration) ?? (meaningful || null),
      counterparty: counterpartyIn(narration),
      balance_after: parseMoney(cell(row, at.balance)),
    });
  }

  if (!lines.length && !problems.length) {
    problems.push({ row: headerAt + 1, reason: 'No rows with a readable date below the header' });
  }

  return { lines, problems, columns: header };
}
