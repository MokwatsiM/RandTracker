import { describe, expect, it } from 'vitest';
import { guessMapping, parseCsv, readCsv } from './csv';
import { assignImportIds, findPossibleDuplicates } from './dedupe';
import { detectKind, fromPdfResult, readCsvFile } from './index';
import { parseOfx } from './ofx';
import { parseQif } from './qif';
import { guessDateOrder, parseAmount, parseDate } from './values';

describe('values', () => {
  it.each([
    ['2026-11-05', '2026-11-05'],
    ['2026/11/05', '2026-11-05'],
    ['20261105120000[+2:SAST]', '2026-11-05'],
    ['05/11/2026', '2026-11-05'],
    ['5 Nov 2026', '2026-11-05'],
    ['05-Nov-26', '2026-11-05'],
    ['05 Okt 2026', '2026-10-05'],
    ['Nov 5, 2026', '2026-11-05'],
    ['31/02/2026', null],
    ['not a date', null],
  ])('reads the date %s', (raw, expected) => {
    expect(parseDate(raw)).toBe(expected);
  });

  it('reads month-first dates when told to', () => {
    expect(parseDate('11/05/2026', 'MDY')).toBe('2026-11-05');
    expect(guessDateOrder(['01/02/2026', '12/25/2026'])).toBe('MDY');
    expect(guessDateOrder(['01/02/2026', '25/12/2026'])).toBe('DMY');
    expect(guessDateOrder(['01/02/2026'])).toBe('DMY');
  });

  it.each([
    ['R 1 234,56', 123456],
    ['-1,234.56', -123456],
    ['1,234', 123400],
    ['(123.45)', -12345],
    ['123.45 Cr', 12345],
    ['50.00Dr', -5000],
    ['+15', 1500],
    ['R-50.5', -5050],
    ['', null],
    ['abc', null],
  ])('reads the amount %s', (raw, expected) => {
    expect(parseAmount(raw)).toBe(expected);
  });
});

describe('CSV', () => {
  it('finds the header below account details, as in an FNB export', () => {
    const text = [
      '2,Account Number,62000000000,Cheque',
      '3,Opening Balance,1000.00',
      'Date,Amount,Balance,Description',
      '2026/11/01,-450.00,550.00,"CHECKERS HYPER, SANDTON"',
      '2026/11/02,"1,000.00",1550.00,ACME SALARY',
      '2026/11/03,0.00,1550.00,INTEREST ADJUSTMENT',
    ].join('\r\n');
    const table = readCsv(text);
    const mapping = guessMapping(table)!;
    expect(mapping).toMatchObject({ headerRow: 2, dateColumn: 0, amountColumn: 1, balanceColumn: 2, payeeColumn: 3 });
    const file = parseCsv(table, mapping);
    expect(file.rows).toEqual([
      { date: '2026-11-01', amount: -45000, payee: 'CHECKERS HYPER, SANDTON' },
      { date: '2026-11-02', amount: 100000, payee: 'ACME SALARY' },
    ]);
    expect(file.unparsedLines).toHaveLength(1);
    expect(file.closingBalance).toBe(155000);
  });

  it('handles separate money in and money out columns, as in a Capitec export', () => {
    const text = [
      'Nr;Posting Date;Transaction Date;Description;Money In;Money Out;Balance',
      '1;05/11/2026;05/11/2026;Engen Quickshop;;-650,00;2 350,00',
      '2;06/11/2026;06/11/2026;Payment Received;3 000,00;;5 350,00',
    ].join('\n');
    const { table, mapping } = readCsvFile(text);
    expect(mapping).toMatchObject({ debitColumn: 5, creditColumn: 4 });
    expect(parseCsv(table, mapping!).rows.map((r) => r.amount)).toEqual([-65000, 300000]);
  });

  it('keeps a saved mapping when it still fits the file', () => {
    const text = 'a,b,c\n05/11/2026,Shop,-10\n';
    const saved = { headerRow: 0, dateColumn: 0, payeeColumn: 1, amountColumn: 2, dateOrder: 'DMY' as const };
    const { mapping } = readCsvFile(text, saved);
    expect(mapping).toBe(saved);
    expect(readCsvFile(text, { ...saved, amountColumn: 9 }).mapping).toBeNull();
  });
});

describe('OFX', () => {
  const sgml = `OFXHEADER:100
DATA:OFXSGML
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKACCTFROM><ACCTID>62000000000</BANKACCTFROM>
<BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261101<TRNAMT>-450.00<FITID>2026110101<NAME>CHECKERS HYPER<MEMO>Card purchase
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261102120000[+2:SAST]<TRNAMT>1000.00<FITID>2026110202<NAME>ACME &amp; SONS SALARY
</BANKTRANLIST>
<LEDGERBAL><BALAMT>1550.00<DTASOF>20261102</LEDGERBAL>
</STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

  it('reads SGML OFX, keeping FITIDs and the closing balance', () => {
    const file = parseOfx(sgml);
    expect(file.rows).toEqual([
      { date: '2026-11-01', amount: -45000, payee: 'CHECKERS HYPER', notes: 'Card purchase', bankId: '2026110101' },
      { date: '2026-11-02', amount: 100000, payee: 'ACME & SONS SALARY', bankId: '2026110202' },
    ]);
    expect(file.closingBalance).toBe(155000);
    expect(file.statementDate).toBe('2026-11-02');
    expect(file.accountNumber).toBe('62000000000');
  });

  it('reads XML OFX', () => {
    const xml = '<?xml version="1.0"?><OFX><STMTTRN><DTPOSTED>20261103</DTPOSTED><TRNAMT>-20.5</TRNAMT><FITID>X1</FITID><NAME>Uber</NAME></STMTTRN></OFX>';
    expect(parseOfx(xml).rows).toEqual([{ date: '2026-11-03', amount: -2050, payee: 'Uber', bankId: 'X1' }]);
  });
});

describe('QIF', () => {
  it('reads bank records and skips other sections', () => {
    const text = [
      '!Type:Bank',
      "D25/10'26", 'T-1,250.00', 'PWOOLWORTHS', 'MGroceries', '^',
      'D26/10/2026', 'T2000', 'PACME SALARY', '^',
      '!Type:Cat', 'NGroceries', '^',
    ].join('\n');
    const file = parseQif(text);
    expect(file.rows).toEqual([
      { date: '2026-10-25', amount: -125000, payee: 'WOOLWORTHS', notes: 'Groceries' },
      { date: '2026-10-26', amount: 200000, payee: 'ACME SALARY' },
    ]);
  });
});

describe('detecting the file type', () => {
  it('uses the extension, then the content', () => {
    expect(detectKind('stmt.PDF')).toBe('pdf');
    expect(detectKind('stmt.qfx')).toBe('ofx');
    expect(detectKind('export.dat', 'OFXHEADER:100')).toBe('ofx');
    expect(detectKind('export.dat', '!Type:Bank')).toBe('qif');
    expect(detectKind('export.csv')).toBe('csv');
    expect(detectKind('photo.jpg')).toBeNull();
  });
});

describe('PDF results', () => {
  it('turns parser output into signed rows', () => {
    const file = fromPdfResult({
      transactions: [
        { date: '2026-11-01', description: 'ENGEN N1 CITY', merchant: 'Engen', location: 'N1 City', amount: 50000, type: 'expense', category: 'Fuel', rawText: '' },
        { date: '2026-11-02', description: 'PAYMENT THANK YOU', amount: -100000, type: 'income', rawText: '' },
      ],
      errors: [],
      unparsedLines: [],
    });
    expect(file.rows).toEqual([
      { date: '2026-11-01', amount: -50000, payee: 'ENGEN N1 CITY', title: 'Engen', notes: 'Location: N1 City', categoryHint: 'Fuel' },
      { date: '2026-11-02', amount: 100000, payee: 'PAYMENT THANK YOU', title: undefined, notes: undefined, categoryHint: undefined },
    ]);
  });
});

describe('duplicates', () => {
  const rows = [
    { date: '2026-11-01', amount: -3500, payee: 'Vida e Caffe' },
    { date: '2026-11-01', amount: -3500, payee: 'VIDA E  CAFFE' },
    { date: '2026-11-02', amount: 100000, payee: 'Salary', bankId: 'F1' },
  ];

  it('gives identical rows different, repeatable IDs', () => {
    const ids = assignImportIds(rows);
    expect(ids).toEqual(['2026-11-01|-3500|vida e caffe|1', '2026-11-01|-3500|vida e caffe|2', 'ofx:F1']);
    expect(assignImportIds(rows)).toEqual(ids);
    expect(assignImportIds([{ date: '2026-11-01', amount: -1, payee: 'ACME "X" \\ CO' }])).toEqual(['2026-11-01|-1|acme x co|1']);
  });

  it('matches existing transactions by amount, direction and nearby date, once each', () => {
    const existing = [
      { id: 'coffee', account_id: 'acc', type: 'expense' as const, amount: 3500, date: '2026-10-30' },
      { id: 'salary-in', account_id: 'other', transfer_account_id: 'acc', type: 'transfer' as const, amount: 100000, date: '2026-11-02' },
      { id: 'refund', account_id: 'acc', type: 'income' as const, amount: 3500, date: '2026-11-01' },
      { id: 'far', account_id: 'acc', type: 'expense' as const, amount: 3500, date: '2026-10-20' },
    ];
    const matches = findPossibleDuplicates(rows, existing, 'acc');
    expect([...matches.entries()]).toEqual([[2, 'salary-in'], [0, 'coffee']]);
    expect(findPossibleDuplicates(rows, existing, 'acc', 3, new Set([0])).get(1)).toBe('coffee');
  });
});
