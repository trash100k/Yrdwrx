/**
 * Feature-level coverage for the document-understanding parse-result → expense mapping.
 *
 * The /api/documents/parse route (server.ts) feeds Gemini's structured `responseSchema` output
 * straight into `vendorInvoiceToExpense` / `validateExtraction` from docExtract.ts. These tests
 * exercise that seam with the EXACT payload shapes the route produces — the mock canned data, a
 * clean multi-item invoice, and messy real-world variants — so a regression in the mapping (bad
 * total reconciliation, dropped coercion, context threading) fails loudly and independently of the
 * server. Pure logic only; no network, no server import.
 */
import { describe, it, expect } from "vitest";
import {
  vendorInvoiceToExpense,
  validateExtraction,
  UNKNOWN_VENDOR,
  type ParsedVendorInvoice,
} from "./docExtract";

describe("documents/parse vendor-invoice mapping", () => {
  // Mirrors the canned payload server.ts getMockText returns for the vendor-invoice extractor.
  // Guards the mock contract: the numbers must reconcile so mock mode yields a confident draft.
  const MOCK_INVOICE: ParsedVendorInvoice = {
    vendor: "Southern Landscape Supply",
    date: "2026-06-28",
    lineItems: [
      { description: "Double-Shredded Hardwood Mulch", amount: 240, quantity: 4 },
      { description: "Delivery Fee", amount: 45, quantity: 1 },
    ],
    total: 285,
  };

  it("maps the mock canned invoice to a clean draft (reconciles → needsReview false)", () => {
    const draft = vendorInvoiceToExpense(MOCK_INVOICE);
    expect(draft.vendor).toBe("Southern Landscape Supply");
    expect(draft.date).toBe("2026-06-28");
    expect(draft.items).toHaveLength(2);
    expect(draft.total).toBe(285);
    expect(draft.needsReview).toBe(false);
    expect(validateExtraction(MOCK_INVOICE).ok).toBe(true);
  });

  it("threads job/customer context onto the draft", () => {
    const draft = vendorInvoiceToExpense(MOCK_INVOICE, { jobId: " job-1 ", customerId: "cust-9" });
    expect(draft.jobId).toBe("job-1"); // trimmed
    expect(draft.customerId).toBe("cust-9");
  });

  it("coerces messy real-world fields (currency strings, parenthesized credit, missing qty) and drops empty rows", () => {
    const parsed: ParsedVendorInvoice = {
      vendor: "  ACME Supply  ",
      date: "6/28/26", // US M/D/YY → 2026-06-28
      lineItems: [
        { description: "Mulch", amount: "$1,234.56" as any, quantity: "3" as any },
        { description: "Loyalty Credit", amount: "(50.00)" as any }, // accounting negative, qty defaults to 1
        { description: "", amount: 0 }, // wholly-empty extractor noise → dropped
      ],
      total: "$1,184.56" as any, // 1234.56 - 50 == 1184.56 → reconciles
    };
    const draft = vendorInvoiceToExpense(parsed);
    expect(draft.vendor).toBe("ACME Supply");
    expect(draft.date).toBe("2026-06-28");
    expect(draft.items).toEqual([
      { description: "Mulch", amount: 1234.56, quantity: 3 },
      { description: "Loyalty Credit", amount: -50, quantity: 1 },
    ]);
    expect(draft.total).toBe(1184.56);
    expect(draft.needsReview).toBe(false);
  });

  it("flags a total that does not reconcile with the line items", () => {
    const parsed: ParsedVendorInvoice = {
      vendor: "Vendor Co",
      date: "2026-01-01",
      lineItems: [{ description: "Item", amount: 10 }],
      total: 999,
    };
    const draft = vendorInvoiceToExpense(parsed);
    expect(draft.needsReview).toBe(true);
    const v = validateExtraction(parsed);
    expect(v.ok).toBe(false);
    expect(v.errors).toContain("Invoice total does not match sum of line items");
  });

  it("derives the total from line items when the model omits it, and marks it for review", () => {
    const parsed: ParsedVendorInvoice = {
      vendor: "Vendor Co",
      date: "2026-01-01",
      lineItems: [
        { description: "A", amount: 10 },
        { description: "B", amount: 15.5 },
      ],
    };
    const draft = vendorInvoiceToExpense(parsed);
    expect(draft.total).toBe(25.5); // derived from Σ amount
    expect(draft.needsReview).toBe(true); // missing total → not confidently complete
    expect(validateExtraction(parsed).errors).toContain("Missing invoice total");
  });

  it("never throws on garbage / empty extractor output", () => {
    const draft = vendorInvoiceToExpense(null);
    expect(draft.vendor).toBe(UNKNOWN_VENDOR);
    expect(draft.date).toBeNull();
    expect(draft.items).toEqual([]);
    expect(draft.total).toBe(0);
    expect(draft.needsReview).toBe(true);

    const v = validateExtraction(undefined);
    expect(v.ok).toBe(false);
    expect(v.errors).toEqual(["No document data to validate"]);
  });

  it("collects specific, human-readable validation errors for an incomplete invoice", () => {
    const v = validateExtraction({} as ParsedVendorInvoice);
    expect(v.ok).toBe(false);
    expect(v.errors).toContain("Missing vendor name");
    expect(v.errors).toContain("Missing or invalid date");
    expect(v.errors).toContain("No line items found");
    expect(v.errors).toContain("Missing invoice total");
  });
});
