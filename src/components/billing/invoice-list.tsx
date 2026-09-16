import { Download } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/features/billing/invoice";

type InvoiceRow = {
  id: string;
  invoiceNumber: string | null;
  invoicedAt: Date | null;
  amount: number;
  currency: string;
  reference: string;
};

/**
 * Past invoices, downloadable.
 *
 * A finance team needs to fetch a copy months later without emailing support,
 * which is the whole reason these are stored rather than only sent once.
 */
export function InvoiceList({ invoices }: { invoices: InvoiceRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoices</CardTitle>
        <CardDescription>
          Every payment receipt, ready to download for your records.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No invoices yet. One is issued and emailed each time a payment succeeds.
          </p>
        ) : (
          <ul className="divide-y">
            {invoices.map((invoice) => (
              <li key={invoice.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium tabular-nums">{invoice.invoiceNumber}</p>
                  <p className="text-xs text-muted-foreground">
                    {invoice.invoicedAt
                      ? invoice.invoicedAt.toISOString().slice(0, 10)
                      : "Date unavailable"}
                    {" · "}
                    {invoice.reference}
                  </p>
                </div>
                <p className="tabular-nums font-medium">
                  {formatMoney(invoice.amount, invoice.currency)}
                </p>
                {/* A plain link, not a fetch: the browser handles the download
                    and the file lands where the user expects it. */}
                <a
                  href={`/api/billing/invoices/${invoice.id}/download`}
                  className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Download className="size-3.5" aria-hidden="true" />
                  <span>PDF</span>
                  <span className="sr-only"> for invoice {invoice.invoiceNumber}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
