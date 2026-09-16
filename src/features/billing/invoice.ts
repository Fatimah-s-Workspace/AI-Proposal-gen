/**
 * Building the invoice a Nigerian business can actually put through its books.
 *
 * Pure: takes a payment and some configuration, returns the document's
 * contents. Rendering, numbering and storage live elsewhere, so the arithmetic
 * - the part where a mistake is permanent and visible to an accountant - can be
 * tested without a database or a PDF.
 *
 * Every amount here is an integer number of kobo, never naira as a float.
 * 0.1 + 0.2 is not 0.3 in binary floating point, and an invoice that is one
 * kobo out is an invoice that does not reconcile.
 */

export type InvoiceParty = {
  name: string;
  legalName?: string | null;
  address?: string | null;
  email?: string | null;
  /** RC number from the Corporate Affairs Commission. */
  registrationNumber?: string | null;
  /** Tax Identification Number. */
  taxId?: string | null;
};

export type InvoiceLine = {
  description: string;
  /** Kobo. */
  unitAmount: number;
  quantity: number;
};

export type Invoice = {
  number: string;
  issuedAt: string;
  reference: string;
  seller: InvoiceParty;
  buyer: InvoiceParty;
  lines: InvoiceLine[];
  currency: string;
  /** All kobo. */
  subtotal: number;
  taxAmount: number;
  total: number;
  /** Percent, e.g. 7.5. Zero when not registered for VAT. */
  taxRate: number;
  /** Printed where the tax line would be, so its absence is explained. */
  taxNote: string | null;
};

export type TaxConfig = {
  /** Percent. 0 disables the tax line entirely. */
  ratePercent: number;
  /**
   * Whether the charged amount already contains the tax.
   *
   * Inclusive is the right default for a price that has been advertised as
   * "₦5,000": the customer keeps paying ₦5,000 and the tax is carved out of
   * it. Exclusive adds tax on top, which is a price rise for everyone who
   * already signed up.
   */
  inclusive: boolean;
  /** Shown when ratePercent is 0, so a missing tax line is not a mystery. */
  exemptNote: string | null;
};

export function taxConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
): TaxConfig {
  const ratePercent = Number(env.INVOICE_TAX_RATE_PERCENT ?? "0");
  return {
    // A malformed value must not silently become a tax charge, or an invoice
    // claims tax that was never collected and never remitted.
    ratePercent: Number.isFinite(ratePercent) && ratePercent > 0 ? ratePercent : 0,
    inclusive: env.INVOICE_TAX_INCLUSIVE !== "false",
    exemptNote:
      env.INVOICE_TAX_EXEMPT_NOTE?.trim() ||
      "Not registered for VAT. No VAT has been charged on this invoice.",
  };
}

export function sellerFromEnv(
  env: Record<string, string | undefined> = process.env,
): InvoiceParty {
  return {
    name: env.INVOICE_SELLER_NAME?.trim() || "TenderFlow AI",
    address: env.INVOICE_SELLER_ADDRESS?.trim() || null,
    email: env.INVOICE_SELLER_EMAIL?.trim() || null,
    registrationNumber: env.INVOICE_SELLER_RC?.trim() || null,
    taxId: env.INVOICE_SELLER_TIN?.trim() || null,
  };
}

/**
 * Splits a charged amount into net and tax.
 *
 * Tax is computed then rounded once, and the other side is derived by
 * subtraction rather than rounded separately - otherwise the two halves can
 * each round up and stop adding to the total.
 */
export function splitTax(chargedKobo: number, tax: TaxConfig) {
  if (tax.ratePercent <= 0) {
    return { subtotal: chargedKobo, taxAmount: 0, total: chargedKobo };
  }

  const rate = tax.ratePercent / 100;

  if (tax.inclusive) {
    const taxAmount = Math.round(chargedKobo - chargedKobo / (1 + rate));
    return { subtotal: chargedKobo - taxAmount, taxAmount, total: chargedKobo };
  }

  const taxAmount = Math.round(chargedKobo * rate);
  return { subtotal: chargedKobo, taxAmount, total: chargedKobo + taxAmount };
}

export function buildInvoice(input: {
  number: string;
  issuedAt: Date;
  reference: string;
  seller: InvoiceParty;
  buyer: InvoiceParty;
  description: string;
  /** What the customer was actually charged, in kobo. */
  chargedKobo: number;
  currency: string;
  tax: TaxConfig;
}): Invoice {
  const { subtotal, taxAmount, total } = splitTax(input.chargedKobo, input.tax);

  return {
    number: input.number,
    issuedAt: input.issuedAt.toISOString(),
    reference: input.reference,
    seller: input.seller,
    buyer: input.buyer,
    lines: [{ description: input.description, unitAmount: subtotal, quantity: 1 }],
    currency: input.currency,
    subtotal,
    taxAmount,
    total,
    taxRate: input.tax.ratePercent,
    taxNote: input.tax.ratePercent > 0 ? null : input.tax.exemptNote,
  };
}

/** Kobo to a displayable amount for the web. 500000 -> "\u20a65,000.00". */
export function formatMoney(kobo: number, currency = "NGN") {
  const symbol = currency === "NGN" ? "₦" : "";
  const value = (kobo / 100).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return symbol ? `${symbol}${value}` : `${value} ${currency}`;
}


/**
 * The same amount, written for a PDF. 500000 -> "NGN 5,000.00".
 *
 * pdfkit's built-in fonts have no naira glyph. U+20A6 gets encoded as its low
 * byte alone, which in WinAnsi is U+00A6 - so "\u20a65,000.00" prints as
 * "\u00a65,000.00", a broken bar. Verified by rendering and reading it back.
 * The currency code is unambiguous, needs no font, and is what an accounting
 * system expects anyway. Embedding a font with the glyph would also work and
 * would put a binary in the repo to solve a three-character problem.
 */
export function formatMoneyPlain(kobo: number, currency = "NGN") {
  const value = (kobo / 100).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${currency} ${value}`;
}

/**
 * Labels a company registration number without repeating the prefix.
 *
 * People type their RC number both ways - "RC123456" and "123456" - and
 * blindly prefixing produces "RC RC123456" on a legal document.
 */
export function formatRegistrationNumber(value: string) {
  const trimmed = value.trim();
  return /^rc[\s-]*/i.test(trimmed) ? `RC ${trimmed.replace(/^rc[\s-]*/i, "")}` : `RC ${trimmed}`;
}

/**
 * TF-2026-000042.
 *
 * The year is in the number because accountants file by year, and the counter
 * is zero-padded so invoices sort correctly as text - which is how they will
 * end up sorted in a spreadsheet or a filename listing.
 */
export function formatInvoiceNumber(sequence: number, issuedAt: Date, prefix = "TF") {
  return `${prefix}-${issuedAt.getUTCFullYear()}-${String(sequence).padStart(6, "0")}`;
}
