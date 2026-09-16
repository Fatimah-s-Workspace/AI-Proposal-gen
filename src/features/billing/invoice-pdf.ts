import {
  formatMoneyPlain,
  formatRegistrationNumber,
  type Invoice,
} from "@/features/billing/invoice";

/**
 * Renders an invoice to PDF.
 *
 * Deliberately plain. This document is read by an accounts department and
 * filed; it needs to be unambiguous and printable, not designed. pdfkit is
 * already a dependency for proposal exports, so this adds no new one.
 */
export async function renderInvoicePdf(invoice: Invoice): Promise<Buffer> {
  const PDFDocument = (await import("pdfkit")).default;

  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const finished = new Promise<void>((resolve) => doc.on("end", () => resolve()));

  const issued = new Date(invoice.issuedAt);
  const dateText = issued.toISOString().slice(0, 10);

  // Header
  doc.fontSize(20).text(invoice.seller.name, { continued: false });
  doc.fontSize(9).fillColor("#555555");
  for (const line of [
    invoice.seller.address,
    invoice.seller.email,
    invoice.seller.registrationNumber
      ? formatRegistrationNumber(invoice.seller.registrationNumber)
      : null,
    invoice.seller.taxId ? `TIN ${invoice.seller.taxId}` : null,
  ].filter(Boolean)) {
    doc.text(String(line));
  }

  doc.moveDown(1.5).fillColor("#000000").fontSize(16).text("INVOICE");
  doc.fontSize(10).fillColor("#333333");
  doc.text(`Invoice number:  ${invoice.number}`);
  doc.text(`Date issued:     ${dateText}`);
  doc.text(`Payment ref:     ${invoice.reference}`);

  // Bill to
  doc.moveDown(1).fillColor("#000000").fontSize(11).text("Billed to");
  doc.fontSize(10).fillColor("#333333");
  for (const line of [
    invoice.buyer.legalName || invoice.buyer.name,
    invoice.buyer.address,
    invoice.buyer.registrationNumber
      ? formatRegistrationNumber(invoice.buyer.registrationNumber)
      : null,
    invoice.buyer.taxId ? `TIN ${invoice.buyer.taxId}` : null,
    invoice.buyer.email,
  ].filter(Boolean)) {
    doc.text(String(line));
  }

  // Lines
  doc.moveDown(1.5).fillColor("#000000").fontSize(11).text("Description");
  doc.moveTo(50, doc.y + 2).lineTo(545, doc.y + 2).strokeColor("#cccccc").stroke();
  doc.moveDown(0.5).fontSize(10).fillColor("#333333");

  for (const line of invoice.lines) {
    const amount = formatMoneyPlain(line.unitAmount * line.quantity, invoice.currency);
    doc.text(line.description, 50, doc.y, { width: 380, continued: false });
    doc.text(amount, 400, doc.y - doc.currentLineHeight(), { width: 145, align: "right" });
  }

  // Totals
  doc.moveDown(1);
  doc.moveTo(300, doc.y).lineTo(545, doc.y).strokeColor("#cccccc").stroke();
  doc.moveDown(0.5);

  const total = (label: string, value: string, bold = false) => {
    doc.fontSize(bold ? 12 : 10).fillColor(bold ? "#000000" : "#333333");
    doc.text(label, 300, doc.y, { width: 145, align: "right", continued: false });
    doc.text(value, 450, doc.y - doc.currentLineHeight(), { width: 95, align: "right" });
  };

  total("Subtotal", formatMoneyPlain(invoice.subtotal, invoice.currency));
  if (invoice.taxRate > 0) {
    total(`VAT (${invoice.taxRate}%)`, formatMoneyPlain(invoice.taxAmount, invoice.currency));
  }
  total("Total paid", formatMoneyPlain(invoice.total, invoice.currency), true);

  // The absence of a VAT line is explained rather than left to be wondered at.
  if (invoice.taxNote) {
    doc.moveDown(2).fontSize(9).fillColor("#666666").text(invoice.taxNote, 50, doc.y, {
      width: 495,
    });
  }

  doc
    .moveDown(1.5)
    .fontSize(9)
    .fillColor("#666666")
    .text("This invoice was paid in full. No payment is due.", 50, doc.y, { width: 495 });

  doc.end();
  await finished;
  return Buffer.concat(chunks);
}
