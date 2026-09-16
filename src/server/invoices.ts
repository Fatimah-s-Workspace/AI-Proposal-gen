import { prisma } from "@/server/db";
import { captureError } from "@/lib/monitoring";
import {
  buildInvoice,
  formatInvoiceNumber,
  sellerFromEnv,
  taxConfigFromEnv,
  type Invoice,
} from "@/features/billing/invoice";
import { PRO_PLAN } from "@/lib/payments/plans";

/**
 * Issuing the invoice for a successful payment.
 *
 * A Nigerian business cannot put a card charge through its books without a
 * proper invoice, so this is not a nicety - it is what makes the product
 * sellable to a company rather than an individual.
 */

/**
 * Takes the next invoice number from a Postgres sequence.
 *
 * Not a count of existing invoices. Paystack can deliver the same payment
 * twice - a browser redirect and a webhook, racing - and counting would hand
 * both the same number. nextval is atomic under concurrency. Gaps are fine;
 * two invoices sharing a number is not.
 */
async function nextInvoiceSequence(db: typeof prisma): Promise<number> {
  const rows = await db.$queryRawUnsafe<Array<{ nextval: bigint }>>(
    `SELECT nextval('invoice_number_seq')`,
  );
  return Number(rows[0].nextval);
}

/**
 * Issues an invoice, once.
 *
 * Returns the existing one if the payment already has it, so both sides of the
 * Paystack race converge on a single document - the same idempotence
 * finalizePayment already relies on.
 */
export async function issueInvoiceForPayment(
  paymentId: string,
  db: typeof prisma = prisma,
): Promise<Invoice | null> {
  const payment = await db.payment.findUnique({
    where: { id: paymentId },
    include: { organization: true },
  });

  if (!payment || payment.status !== "success") return null;

  if (payment.invoiceNumber && payment.invoiceData) {
    return payment.invoiceData as unknown as Invoice;
  }

  const issuedAt = payment.paidAt ?? new Date();
  const sequence = await nextInvoiceSequence(db);

  // Who to bill. The organisation's own contact is preferred; the person who
  // clicked checkout is the fallback, since a workspace may have no billing
  // address set yet and an invoice still has to name somebody.
  const initiator = await db.user.findUnique({
    where: { id: payment.initiatedByUserId },
    select: { email: true, name: true },
  });

  const invoice = buildInvoice({
    number: formatInvoiceNumber(sequence, issuedAt),
    issuedAt,
    reference: payment.reference,
    seller: sellerFromEnv(),
    buyer: {
      name: payment.organization.name,
      legalName: payment.organization.legalName,
      registrationNumber: payment.organization.registrationNumber,
      address: payment.organization.billingAddress,
      taxId: payment.organization.billingTaxId,
      email: initiator?.email ?? null,
    },
    description: `TenderFlow AI ${PRO_PLAN.name} plan - ${PRO_PLAN.durationDays} days`,
    chargedKobo: payment.amount,
    currency: payment.currency,
    tax: taxConfigFromEnv(),
  });

  try {
    await db.payment.update({
      where: { id: payment.id },
      data: {
        invoiceNumber: invoice.number,
        invoicedAt: issuedAt,
        invoiceData: invoice as unknown as object,
      },
    });
  } catch (error) {
    // Almost certainly the unique index catching the other side of the race.
    // Re-read rather than fail: the customer needs an invoice, and by now one
    // exists.
    const existing = await db.payment.findUnique({ where: { id: payment.id } });
    if (existing?.invoiceData) return existing.invoiceData as unknown as Invoice;
    captureError(error, { area: "invoices", paymentId });
    return null;
  }

  return invoice;
}

/** Every issued invoice for a workspace, newest first. */
export async function listInvoices(organizationId: string, db: typeof prisma = prisma) {
  const payments = await db.payment.findMany({
    where: { organizationId, status: "success", invoiceNumber: { not: null } },
    orderBy: { invoicedAt: "desc" },
    select: {
      id: true,
      invoiceNumber: true,
      invoicedAt: true,
      amount: true,
      currency: true,
      reference: true,
    },
  });

  return payments;
}
