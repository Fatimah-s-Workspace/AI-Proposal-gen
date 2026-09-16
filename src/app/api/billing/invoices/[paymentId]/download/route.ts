import { prisma } from "@/server/db";
import { requireApiUser } from "@/server/session";
import { unauthorized, serverError } from "@/server/responses";
import { renderInvoicePdf } from "@/features/billing/invoice-pdf";
import { captureError } from "@/lib/monitoring";
import type { Invoice } from "@/features/billing/invoice";

/**
 * Downloads an issued invoice.
 *
 * Rendered on demand from the snapshot stored when the invoice was issued, not
 * from current settings - an invoice is a legal record, and changing the
 * company address must not silently rewrite every invoice ever sent. Nothing
 * is kept in file storage, so there is no second copy to get out of step.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ paymentId: string }> },
) {
  const user = await requireApiUser();
  if (!user) return unauthorized();

  const { paymentId } = await params;

  try {
    const payment = await prisma.payment.findFirst({
      // Scoped to a workspace the caller belongs to. Without this, any signed
      // in user could read any other company's invoice by guessing an id -
      // and an invoice names the customer, their address and what they pay.
      where: {
        id: paymentId,
        organization: { memberships: { some: { userId: user.id } } },
      },
      select: { invoiceNumber: true, invoiceData: true },
    });

    // Same reply for "no such payment" and "not yours", so this cannot be used
    // to discover which payment ids exist.
    if (!payment?.invoiceData || !payment.invoiceNumber) {
      return Response.json(
        { error: "We couldn't find that invoice. It may have been deleted, or the link may be out of date." },
        { status: 404 },
      );
    }

    const invoice = payment.invoiceData as unknown as Invoice;
    const pdf = await renderInvoicePdf(invoice);

    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${payment.invoiceNumber}.pdf"`,
        // An invoice is immutable once issued, but it names a customer, so it
        // must not sit in a shared cache.
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("INVOICE DOWNLOAD ERROR:", error);
    captureError(error, { route: "billing/invoices/download", paymentId });
    return serverError();
  }
}
