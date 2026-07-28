import { requireApiUser } from "@/server/session";
import { finalizePayment } from "@/server/billing";

// Paystack redirects the user's own browser here after checkout, with
// ?reference=... (and the equivalent ?trxref=...) in the query string. The
// redirect itself is just a UX signal, not proof of payment - the actual
// state comes from re-verifying the transaction with Paystack inside
// finalizePayment(), which is also what the webhook calls, so this and the
// webhook can't double-apply the same payment regardless of which fires
// first.
export async function GET(request: Request) {
  const user = await requireApiUser();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  if (!user) {
    return Response.redirect(`${baseUrl}/auth/sign-in`, 302);
  }

  const reference = new URL(request.url).searchParams.get("reference");
  if (!reference) {
    return Response.redirect(`${baseUrl}/billing/failed`, 302);
  }

  const result = await finalizePayment(reference);

  if (!result.ok) {
    return Response.redirect(`${baseUrl}/billing/failed?reason=${result.reason}`, 302);
  }

  return Response.redirect(`${baseUrl}/billing/success`, 302);
}
