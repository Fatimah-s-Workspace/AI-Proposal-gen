import assert from "node:assert/strict";
import test from "node:test";

import {
  buildInvoice,
  formatInvoiceNumber,
  formatMoney,
  formatMoneyPlain,
  formatRegistrationNumber,
  sellerFromEnv,
  splitTax,
  taxConfigFromEnv,
} from "./invoice";

const NO_TAX = { ratePercent: 0, inclusive: true, exemptNote: "Not registered for VAT." };

/* ------------------------------------------------------------------ tax --- */

test("with no VAT registration, the charge passes through untouched", () => {
  // Charging VAT without being registered is an offence, so zero must mean
  // zero - not a rounding of something small.
  assert.deepEqual(splitTax(500_000, NO_TAX), {
    subtotal: 500_000,
    taxAmount: 0,
    total: 500_000,
  });
});

test("inclusive VAT is carved out of the price, not added to it", () => {
  // ₦5,000 charged at 7.5% inclusive: ₦4,651.16 net + ₦348.84 VAT.
  const result = splitTax(500_000, { ratePercent: 7.5, inclusive: true, exemptNote: null });

  assert.equal(result.total, 500_000, "the customer still pays exactly ₦5,000");
  assert.equal(result.taxAmount, 34_884);
  assert.equal(result.subtotal, 465_116);
});

test("exclusive VAT is added on top", () => {
  const result = splitTax(500_000, { ratePercent: 7.5, inclusive: false, exemptNote: null });

  assert.equal(result.subtotal, 500_000);
  assert.equal(result.taxAmount, 37_500);
  assert.equal(result.total, 537_500);
});

test("the two halves always add back to the total, at every amount", () => {
  // Rounding each side independently lets both round up, and then the invoice
  // does not reconcile. Swept rather than spot-checked because the failure
  // only appears at specific amounts.
  for (const inclusive of [true, false]) {
    for (let kobo = 1; kobo <= 2_000; kobo += 1) {
      const { subtotal, taxAmount, total } = splitTax(kobo, {
        ratePercent: 7.5,
        inclusive,
        exemptNote: null,
      });
      assert.equal(
        subtotal + taxAmount,
        total,
        `inclusive=${inclusive} at ${kobo} kobo: ${subtotal} + ${taxAmount} != ${total}`,
      );
    }
  }
});

test("every amount stays a whole number of kobo", () => {
  for (const kobo of [1, 7, 99, 333, 500_000, 1_234_567]) {
    const result = splitTax(kobo, { ratePercent: 7.5, inclusive: true, exemptNote: null });
    for (const [label, value] of Object.entries(result)) {
      assert.ok(Number.isInteger(value), `${label} was ${value} at ${kobo} kobo`);
    }
  }
});

/* -------------------------------------------------------------- config --- */

test("tax is off unless a positive rate is configured", () => {
  assert.equal(taxConfigFromEnv({}).ratePercent, 0);
  assert.equal(taxConfigFromEnv({ INVOICE_TAX_RATE_PERCENT: "7.5" }).ratePercent, 7.5);
});

test("a malformed rate never becomes a tax charge", () => {
  // An invoice claiming tax that was never collected is worse than one with
  // no tax line at all.
  for (const value of ["", "abc", "-5", "NaN", "null"]) {
    assert.equal(
      taxConfigFromEnv({ INVOICE_TAX_RATE_PERCENT: value }).ratePercent,
      0,
      `"${value}" produced a tax rate`,
    );
  }
});

test("inclusive is the default, and can be turned off explicitly", () => {
  assert.equal(taxConfigFromEnv({}).inclusive, true);
  assert.equal(taxConfigFromEnv({ INVOICE_TAX_INCLUSIVE: "false" }).inclusive, false);
});

test("the seller falls back to something printable when unconfigured", () => {
  const seller = sellerFromEnv({});
  assert.equal(seller.name, "TenderFlow AI");
  // Never invent a tax number: an invoice carrying a made-up TIN is a forged
  // tax document.
  assert.equal(seller.taxId, null);
  assert.equal(seller.registrationNumber, null);
});

/* ------------------------------------------------------------- invoice --- */

const baseInput = {
  number: "TF-2026-000001",
  issuedAt: new Date("2026-09-16T10:00:00.000Z"),
  reference: "tf_ref_123",
  seller: { name: "TenderFlow AI" },
  buyer: { name: "Falcons Consulting", registrationNumber: "RC123456" },
  description: "TenderFlow AI Pro plan - 30 days",
  chargedKobo: 500_000,
  currency: "NGN",
};

test("an invoice without VAT explains why there is no VAT line", () => {
  const invoice = buildInvoice({ ...baseInput, tax: NO_TAX });

  assert.equal(invoice.taxAmount, 0);
  assert.equal(invoice.total, 500_000);
  assert.match(invoice.taxNote!, /not registered for vat/i);
});

test("an invoice with VAT carries no exemption note", () => {
  const invoice = buildInvoice({
    ...baseInput,
    tax: { ratePercent: 7.5, inclusive: true, exemptNote: "unused" },
  });

  assert.equal(invoice.taxNote, null);
  assert.equal(invoice.taxRate, 7.5);
  assert.equal(invoice.total, 500_000);
});

test("the line item shows the net amount, so the sums are followable", () => {
  const invoice = buildInvoice({
    ...baseInput,
    tax: { ratePercent: 7.5, inclusive: true, exemptNote: null },
  });

  const lineTotal = invoice.lines.reduce((sum, l) => sum + l.unitAmount * l.quantity, 0);
  assert.equal(lineTotal, invoice.subtotal);
  assert.equal(invoice.subtotal + invoice.taxAmount, invoice.total);
});

/* ------------------------------------------------------- presentation --- */

test("money is formatted in naira with two decimals", () => {
  assert.equal(formatMoney(500_000), "₦5,000.00");
  assert.equal(formatMoney(34_884), "₦348.84");
  assert.equal(formatMoney(0), "₦0.00");
});

test("invoice numbers sort correctly as text", () => {
  const issuedAt = new Date("2026-09-16T00:00:00.000Z");
  const numbers = [1, 2, 10, 100, 1000].map((n) => formatInvoiceNumber(n, issuedAt));

  assert.equal(numbers[0], "TF-2026-000001");
  assert.deepEqual([...numbers].sort(), numbers, "zero-padding must keep text order correct");
});

/*
 * pdfkit's built-in fonts have no naira glyph. U+20A6 is encoded as its low
 * byte alone, which in WinAnsi is U+00A6 - so every invoice printed a broken
 * bar where the currency should be. Caught by rendering one and reading it
 * back, not by looking at the code.
 */
test("PDF amounts use the currency code, never the naira glyph", () => {
  const rendered = formatMoneyPlain(500_000);

  assert.equal(rendered, "NGN 5,000.00");
  assert.ok(!rendered.includes("₦"), "the naira sign does not survive pdfkit's fonts");
});

test("web amounts still use the naira sign, where fonts handle it", () => {
  assert.equal(formatMoney(500_000), "₦5,000.00");
});

test("both formatters agree on the number, differing only in currency mark", () => {
  for (const kobo of [0, 1, 99, 500_000, 1_234_567]) {
    const digits = (value: string) => value.replace(/[^\d.,]/g, "");
    assert.equal(digits(formatMoney(kobo)), digits(formatMoneyPlain(kobo)), `at ${kobo}`);
  }
});

test("a registration number is never prefixed twice", () => {
  // People type it both ways, and "RC RC123456" on a legal document looks
  // like a clerical error by the issuer.
  assert.equal(formatRegistrationNumber("RC987654"), "RC 987654");
  assert.equal(formatRegistrationNumber("rc987654"), "RC 987654");
  assert.equal(formatRegistrationNumber("RC 987654"), "RC 987654");
  assert.equal(formatRegistrationNumber("RC-987654"), "RC 987654");
  assert.equal(formatRegistrationNumber("987654"), "RC 987654");
  assert.equal(formatRegistrationNumber("  987654  "), "RC 987654");
});
