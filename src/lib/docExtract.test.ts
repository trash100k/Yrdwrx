import { describe, it, expect } from 'vitest';
import {
  vendorInvoiceToExpense,
  validateExtraction,
  UNKNOWN_VENDOR,
  AMOUNT_TOLERANCE,
  type ParsedVendorInvoice,
} from './docExtract';

describe('vendorInvoiceToExpense — happy path', () => {
  it('normalizes a complete, reconciled invoice', () => {
    const parsed: ParsedVendorInvoice = {
      vendor: '  SiteOne Landscape Supply ',
      date: '2024-03-14',
      lineItems: [
        { description: 'Premium mulch', amount: 120, quantity: 3 },
        { description: 'Delivery fee', amount: 30, quantity: 1 },
      ],
      total: 150,
    };
    const draft = vendorInvoiceToExpense(parsed);
    expect(draft.vendor).toBe('SiteOne Landscape Supply');
    expect(draft.date).toBe('2024-03-14');
    expect(draft.items).toEqual([
      { description: 'Premium mulch', amount: 120, quantity: 3 },
      { description: 'Delivery fee', amount: 30, quantity: 1 },
    ]);
    expect(draft.total).toBe(150);
    expect(draft.needsReview).toBe(false);
  });

  it('treats amount as the extended line total (does NOT multiply by quantity)', () => {
    const draft = vendorInvoiceToExpense({
      vendor: 'Acme',
      date: '2024-01-01',
      lineItems: [{ description: 'Sod', amount: 100, quantity: 5 }],
      total: 100,
    });
    expect(draft.total).toBe(100);
    expect(draft.needsReview).toBe(false);
  });

  it('attaches jobId and customerId from context when provided', () => {
    const draft = vendorInvoiceToExpense(
      {
        vendor: 'Acme',
        date: '2024-01-01',
        lineItems: [{ description: 'Sod', amount: 100 }],
        total: 100,
      },
      { jobId: 'job_123', customerId: 'cust_9' },
    );
    expect(draft.jobId).toBe('job_123');
    expect(draft.customerId).toBe('cust_9');
  });

  it('omits context ids that are empty or whitespace', () => {
    const draft = vendorInvoiceToExpense(
      { vendor: 'Acme', date: '2024-01-01', lineItems: [{ amount: 5 }], total: 5 },
      { jobId: '   ', customerId: '' },
    );
    expect(draft).not.toHaveProperty('jobId');
    expect(draft).not.toHaveProperty('customerId');
  });
});

describe('vendorInvoiceToExpense — total derivation & reconciliation', () => {
  it('sums line items when total is missing and flags for review', () => {
    const draft = vendorInvoiceToExpense({
      vendor: 'Acme',
      date: '2024-01-01',
      lineItems: [
        { description: 'A', amount: 10 },
        { description: 'B', amount: 15.5 },
      ],
    });
    expect(draft.total).toBe(25.5);
    expect(draft.needsReview).toBe(true);
  });

  it('keeps the provided total but flags review when it mismatches the line sum', () => {
    const draft = vendorInvoiceToExpense({
      vendor: 'Acme',
      date: '2024-01-01',
      lineItems: [{ description: 'A', amount: 10 }],
      total: 99,
    });
    expect(draft.total).toBe(99);
    expect(draft.needsReview).toBe(true);
  });

  it('does not flag mismatch within tolerance', () => {
    const draft = vendorInvoiceToExpense({
      vendor: 'Acme',
      date: '2024-01-01',
      lineItems: [{ description: 'A', amount: 10 }],
      total: 10 + AMOUNT_TOLERANCE / 2, // 10.005, within a cent
    });
    expect(draft.needsReview).toBe(false);
  });

  it('flags mismatch just beyond tolerance', () => {
    const draft = vendorInvoiceToExpense({
      vendor: 'Acme',
      date: '2024-01-01',
      lineItems: [{ description: 'A', amount: 10 }],
      total: 10.02,
    });
    expect(draft.needsReview).toBe(true);
  });

  it('rounds floating-point line sums to two decimals', () => {
    const draft = vendorInvoiceToExpense({
      vendor: 'Acme',
      date: '2024-01-01',
      lineItems: [
        { description: 'A', amount: 0.1 },
        { description: 'B', amount: 0.2 },
      ],
    });
    expect(draft.total).toBe(0.3); // not 0.30000000000000004
  });
});

describe('vendorInvoiceToExpense — coercion & normalization', () => {
  it('parses currency-formatted string amounts', () => {
    const draft = vendorInvoiceToExpense({
      vendor: 'Acme',
      date: '2024-01-01',
      // amounts arrive as strings from OCR
      lineItems: [{ description: 'A', amount: '$1,234.56' as unknown as number }],
      total: '1,234.56' as unknown as number,
    });
    expect(draft.items[0].amount).toBe(1234.56);
    expect(draft.total).toBe(1234.56);
    expect(draft.needsReview).toBe(false);
  });

  it('reads accounting-style parentheses as negative amounts', () => {
    const draft = vendorInvoiceToExpense({
      vendor: 'Acme',
      date: '2024-01-01',
      lineItems: [{ description: 'Credit', amount: '(50.00)' as unknown as number }],
      total: -50,
    });
    expect(draft.items[0].amount).toBe(-50);
    expect(draft.total).toBe(-50);
    expect(draft.needsReview).toBe(false);
  });

  it('defaults quantity to 1 when missing, invalid, or non-positive', () => {
    const draft = vendorInvoiceToExpense({
      vendor: 'Acme',
      date: '2024-01-01',
      lineItems: [
        { description: 'no qty', amount: 1 },
        { description: 'zero qty', amount: 1, quantity: 0 },
        { description: 'neg qty', amount: 1, quantity: -3 },
        { description: 'nan qty', amount: 1, quantity: NaN },
        { description: 'good qty', amount: 1, quantity: 4 },
      ],
      total: 5,
    });
    expect(draft.items.map((i) => i.quantity)).toEqual([1, 1, 1, 1, 4]);
  });

  it('skips non-object and wholly-empty line items', () => {
    const lineItems = [
      null,
      { description: '   ', amount: 0 }, // empty row -> dropped
      { description: 'Keep', amount: 5 },
      42,
    ] as unknown as ParsedVendorInvoice['lineItems'];
    const draft = vendorInvoiceToExpense({
      vendor: 'Acme',
      date: '2024-01-01',
      lineItems,
      total: 5,
    });
    expect(draft.items).toEqual([{ description: 'Keep', amount: 5, quantity: 1 }]);
  });

  it('falls back to UNKNOWN_VENDOR for missing/whitespace vendor and flags review', () => {
    const draft = vendorInvoiceToExpense({
      vendor: '   ',
      date: '2024-01-01',
      lineItems: [{ description: 'A', amount: 5 }],
      total: 5,
    });
    expect(draft.vendor).toBe(UNKNOWN_VENDOR);
    expect(draft.needsReview).toBe(true);
  });
});

describe('vendorInvoiceToExpense — date normalization', () => {
  const cases: Array<[unknown, string | null]> = [
    ['2024-03-14', '2024-03-14'],
    ['2024/3/4', '2024-03-04'],
    ['03/14/2024', '2024-03-14'],
    ['1/5/24', '2024-01-05'],
    ['not a date', null],
    ['2024-13-40', null], // impossible month/day
    ['02/30/2024', null], // Feb 30 invalid
    ['02/29/2024', '2024-02-29'], // leap year valid
    ['02/29/2023', null], // non-leap invalid
    ['', null],
    [undefined, null],
    [12345 as unknown, null], // non-string
  ];

  it.each(cases)('normalizes %p -> %p', (input, expected) => {
    const draft = vendorInvoiceToExpense({
      vendor: 'Acme',
      date: input as string,
      lineItems: [{ description: 'A', amount: 5 }],
      total: 5,
    });
    expect(draft.date).toBe(expected);
  });
});

describe('vendorInvoiceToExpense — garbage / guards (never throws)', () => {
  it('handles null input with safe defaults', () => {
    const draft = vendorInvoiceToExpense(null);
    expect(draft).toEqual({
      vendor: UNKNOWN_VENDOR,
      date: null,
      items: [],
      total: 0,
      needsReview: true,
    });
  });

  it('handles undefined input', () => {
    expect(() => vendorInvoiceToExpense(undefined)).not.toThrow();
    expect(vendorInvoiceToExpense(undefined).needsReview).toBe(true);
  });

  it('handles an empty object', () => {
    const draft = vendorInvoiceToExpense({});
    expect(draft.vendor).toBe(UNKNOWN_VENDOR);
    expect(draft.date).toBeNull();
    expect(draft.items).toEqual([]);
    expect(draft.total).toBe(0);
    expect(draft.needsReview).toBe(true);
  });

  it('handles non-object garbage passed as the document', () => {
    const draft = vendorInvoiceToExpense('totally not an invoice' as unknown as ParsedVendorInvoice);
    expect(draft.total).toBe(0);
    expect(draft.needsReview).toBe(true);
  });

  it('treats NaN / Infinity numeric fields as missing (falls back to 0)', () => {
    const draft = vendorInvoiceToExpense({
      vendor: 'Acme',
      date: '2024-01-01',
      lineItems: [{ description: 'weird', amount: Infinity }],
      total: NaN,
    });
    // Infinity amount -> 0, and description is non-empty so the row is kept.
    expect(draft.items).toEqual([{ description: 'weird', amount: 0, quantity: 1 }]);
    expect(draft.total).toBe(0); // NaN total -> derived from items (0)
    expect(draft.needsReview).toBe(true);
  });

  it('never throws on lineItems that is not an array', () => {
    const draft = vendorInvoiceToExpense({
      vendor: 'Acme',
      date: '2024-01-01',
      lineItems: 'nope' as unknown as ParsedVendorInvoice['lineItems'],
      total: 10,
    });
    expect(draft.items).toEqual([]);
    expect(draft.needsReview).toBe(true); // no items
  });
});

describe('validateExtraction', () => {
  it('accepts a complete, reconciled invoice', () => {
    const result = validateExtraction({
      vendor: 'Acme',
      date: '2024-01-01',
      lineItems: [{ description: 'Sod', amount: 100 }],
      total: 100,
    });
    expect(result).toEqual({ ok: true, errors: [] });
  });

  it('rejects null/garbage with a single top-level error', () => {
    expect(validateExtraction(null)).toEqual({
      ok: false,
      errors: ['No document data to validate'],
    });
    expect(validateExtraction(undefined).ok).toBe(false);
    expect(validateExtraction('x' as unknown as ParsedVendorInvoice).ok).toBe(false);
  });

  it('flags a missing vendor', () => {
    const result = validateExtraction({
      vendor: '  ',
      date: '2024-01-01',
      lineItems: [{ description: 'A', amount: 5 }],
      total: 5,
    });
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('Missing vendor name');
  });

  it('flags a missing/invalid date', () => {
    const result = validateExtraction({
      vendor: 'Acme',
      date: 'yesterday',
      lineItems: [{ description: 'A', amount: 5 }],
      total: 5,
    });
    expect(result.errors).toContain('Missing or invalid date');
  });

  it('flags an absent line-items list', () => {
    const result = validateExtraction({
      vendor: 'Acme',
      date: '2024-01-01',
      total: 0,
    });
    expect(result.errors).toContain('No line items found');
  });

  it('flags malformed, description-less, and amount-less line items', () => {
    const result = validateExtraction({
      vendor: 'Acme',
      date: '2024-01-01',
      lineItems: [
        null as unknown as { amount: number },
        { amount: 5 }, // missing description
        { description: 'no amount' }, // missing amount
      ],
      total: 5,
    });
    expect(result.errors).toContain('Line item 1 is malformed');
    expect(result.errors).toContain('Line item 2 is missing a description');
    expect(result.errors).toContain('Line item 3 has an invalid amount');
  });

  it('flags a missing total', () => {
    const result = validateExtraction({
      vendor: 'Acme',
      date: '2024-01-01',
      lineItems: [{ description: 'A', amount: 5 }],
    });
    expect(result.errors).toContain('Missing invoice total');
  });

  it('flags a total that does not reconcile with the line items', () => {
    const result = validateExtraction({
      vendor: 'Acme',
      date: '2024-01-01',
      lineItems: [{ description: 'A', amount: 5 }],
      total: 999,
    });
    expect(result.errors).toContain('Invoice total does not match sum of line items');
  });

  it('accumulates multiple errors at once', () => {
    const result = validateExtraction({});
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        'Missing vendor name',
        'Missing or invalid date',
        'No line items found',
        'Missing invoice total',
      ]),
    );
  });
});
