import { requireApiUser } from "@/server/session";
import { rateLimit } from "@/lib/rate-limit";
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

  // Each call re-verifies the reference with Paystack over the network, so a
  // replayed callback URL is an outbound request per hit. Redirects to the
  // failure page rather than returning 429: this is a browser navigation, and
  // a JSON error body would render as raw text in the address bar.
  const limit = await rateLimit(`billing:callback:${user.id}`, 20, 60_000);
  if (!limit.allowed) {
    return Response.redirect(`${baseUrl}/billing/failed?reason=rate_limited`, 302);
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
