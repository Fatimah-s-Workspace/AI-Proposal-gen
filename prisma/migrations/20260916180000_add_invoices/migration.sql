-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "invoiceNumber" TEXT,
                      ADD COLUMN     "invoicedAt" TIMESTAMP(3),
                      ADD COLUMN     "invoiceData" JSONB;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "billingAddress" TEXT,
                           ADD COLUMN     "billingTaxId" TEXT;

-- CreateIndex
-- Two payments sharing an invoice number is an accounting problem, not a
-- display bug, so the database refuses it rather than trusting callers.
CREATE UNIQUE INDEX "Payment_invoiceNumber_key" ON "Payment"("invoiceNumber");

-- CreateSequence
-- Invoice numbers come from a sequence rather than counting existing rows.
-- Paystack can deliver the same payment twice - a browser redirect and a
-- webhook, racing - and a count-and-increment would hand both the same number.
-- nextval is atomic; gaps are acceptable, collisions are not.
CREATE SEQUENCE IF NOT EXISTS "invoice_number_seq" START WITH 1 INCREMENT BY 1;
