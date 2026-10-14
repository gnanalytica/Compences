import { describe, expect, it } from 'vitest';
import {
  counterpartyIn,
  parseMoney,
  parseStatement,
  parseStatementDate,
  referenceIn,
  splitCsvLine,
} from '@compences/core';

/**
 * Real statement shapes, because a parser tested only against the CSV its
 * author invented is a parser that works once.
 *
 * Each fixture below is the header row an Indian bank actually exports, with
 * two or three lines under it. They differ in delimiter, date format, whether
 * debit and credit are one column or two, and how much junk sits above the
 * header — which is the whole reason this function is not four lines of split.
 */

const HDFC = `
Statement of account
Account No: XXXXXXXX4417

Date,Narration,Chq./Ref.No.,Value Dt,Withdrawal Amt.,Deposit Amt.,Closing Balance
16/09/26,UPI/612345678901/RIA MENON/HDFC,0000000000,16/09/26,,"2,001.00","1,24,551.00"
17/09/26,ACCOUNT MAINTENANCE CHARGE,0000000000,17/09/26,350.00,,"1,24,201.00"
`;

const ICICI = `Transaction Date;Transaction Remarks;Withdrawal Amount (INR );Deposit Amount (INR );Balance (INR )
16-Sep-2026;UPI/755500011122/AARAV MENON;;1001.00;125202.00
18-Sep-2026;NEFT-DECOR VENDORS PVT LTD;1800.00;;123402.00`;

const SIGNED = `Date\tDescription\tAmount\tBalance
2026-09-16\tUPI 612345678901 RIA MENON\t2001\t124551
2026-09-17\tBANK CHARGES\t-350\t124201`;

const MARKED = `Txn Date,Particulars,Amount,DR|CR,Balance
16/09/2026,UPI/612345678901/RIA MENON,2001.00,CR,124551.00
17/09/2026,ATM WITHDRAWAL,350.00,DR,124201.00`;

describe('parseStatementDate', () => {
  it('reads the formats banks actually write', () => {
    expect(parseStatementDate('16/09/26')).toBe('2026-09-16');
    expect(parseStatementDate('16-09-2026')).toBe('2026-09-16');
    expect(parseStatementDate('2026-09-16')).toBe('2026-09-16');
    expect(parseStatementDate('16-Sep-2026')).toBe('2026-09-16');
    expect(parseStatementDate('16 Sept 2026')).toBe('2026-09-16');
    expect(parseStatementDate('16.09.2026')).toBe('2026-09-16');
  });

  it('assumes day first, because every Indian bank writes it that way', () => {
    expect(parseStatementDate('05/09/2026')).toBe('2026-09-05');
  });

  it('refuses a date that does not exist rather than rolling it forward', () => {
    expect(parseStatementDate('31/02/2026')).toBeNull();
    expect(parseStatementDate('16/13/2026')).toBeNull();
    expect(parseStatementDate('not a date')).toBeNull();
    expect(parseStatementDate('')).toBeNull();
  });
});

describe('parseMoney', () => {
  it('reads rupees however they are punctuated', () => {
    expect(parseMoney('1,24,551.00')).toBe(124551);
    expect(parseMoney('₹2,001')).toBe(2001);
    expect(parseMoney('2001.50 Cr')).toBe(2001.5);
  });

  it('treats brackets as a debit', () => {
    expect(parseMoney('(350.00)')).toBe(-350);
  });

  it('gives null for blank, so an empty debit column is not zero', () => {
    expect(parseMoney('')).toBeNull();
    expect(parseMoney('   ')).toBeNull();
    expect(parseMoney('-')).toBeNull();
    expect(parseMoney('n/a')).toBeNull();
  });
});

describe('referenceIn', () => {
  it('finds the UTR buried in a narration', () => {
    expect(referenceIn('UPI/612345678901/RIA MENON/HDFC')).toBe('612345678901');
    expect(referenceIn('UPI-755500011122-payment')).toBe('755500011122');
    expect(referenceIn('NEFT 612345678901')).toBe('612345678901');
  });

  it('will not take part of a longer number for one', () => {
    expect(referenceIn('ACCT 1234567890123456')).toBeNull();
    expect(referenceIn('CHARGE 350')).toBeNull();
    expect(referenceIn(null)).toBeNull();
  });
});

describe('counterpartyIn', () => {
  it('pulls the name out of a UPI narration', () => {
    expect(counterpartyIn('UPI/612345678901/RIA MENON/HDFC')).toBe('RIA MENON');
  });

  it('does not mistake the scheme for a person', () => {
    expect(counterpartyIn('UPI/612345678901')).toBeNull();
    expect(counterpartyIn(null)).toBeNull();
  });
});

describe('splitCsvLine', () => {
  it('keeps a comma inside quotes', () => {
    expect(splitCsvLine('a,"1,234.00",b', ',')).toEqual(['a', '1,234.00', 'b']);
  });

  it('reads a doubled quote as one', () => {
    expect(splitCsvLine('a,"say ""hi""",b', ',')).toEqual(['a', 'say "hi"', 'b']);
  });
});

describe('parseStatement', () => {
  it('reads HDFC: two money columns, dd/mm/yy, three junk lines on top', () => {
    const { lines, problems } = parseStatement(HDFC);
    expect(problems).toEqual([]);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({
      posted_on: '2026-09-16',
      amount: 2001,
      reference: '612345678901',
      counterparty: 'RIA MENON',
      balance_after: 124551,
    });
    // A withdrawal comes back negative, whichever column it was in.
    expect(lines[1].amount).toBe(-350);
  });

  it('reads ICICI: semicolons, dd-Mon-yyyy, a trailing space in the header', () => {
    const { lines, problems } = parseStatement(ICICI);
    expect(problems).toEqual([]);
    expect(lines.map((line) => line.amount)).toEqual([1001, -1800]);
    expect(lines[0].posted_on).toBe('2026-09-16');
    expect(lines[0].reference).toBe('755500011122');
  });

  it('reads a tab-separated export with one signed amount column', () => {
    const { lines, problems } = parseStatement(SIGNED);
    expect(problems).toEqual([]);
    expect(lines.map((line) => line.amount)).toEqual([2001, -350]);
  });

  it('lets a DR/CR column decide the sign', () => {
    const { lines } = parseStatement(MARKED);
    expect(lines.map((line) => line.amount)).toEqual([2001, -350]);
  });

  it('says which line it could not read instead of dropping it', () => {
    const { lines, problems } = parseStatement(
      'Date,Description,Amount\n16/09/2026,Good line,2001\n17/09/2026,Broken line,not a number\n',
    );
    expect(lines).toHaveLength(1);
    expect(problems).toEqual([{ row: 3, reason: 'No amount on this line' }]);
  });

  it('ignores the totals row banks put at the bottom', () => {
    const { lines, problems } = parseStatement(
      'Date,Description,Amount\n16/09/2026,A payment,2001\n,TOTAL,2001\n',
    );
    expect(lines).toHaveLength(1);
    expect(problems).toEqual([]);
  });

  it('asks for a header rather than guessing at one', () => {
    const { lines, problems } = parseStatement('16/09/2026,something,2001\n');
    expect(lines).toEqual([]);
    expect(problems[0].reason).toContain('No header row');
  });

  it('says so when handed nothing', () => {
    expect(parseStatement('   ').problems[0].reason).toBe('The file is empty');
  });

  it('never returns a zero-rupee line, which no bank posts', () => {
    const { lines } = parseStatement(
      'Date,Description,Withdrawal,Deposit\n16/09/2026,Nothing happened,0.00,0.00\n',
    );
    expect(lines).toEqual([]);
  });
});
