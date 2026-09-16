import { sendRenewalReminders } from "@/server/billing";
import { captureError } from "@/lib/monitoring";
import { cronUnauthorized } from "@/server/responses";

// Triggered by Vercel Cron (see vercel.json) once a day. Vercel adds
// `Authorization: Bearer $CRON_SECRET` automatically when CRON_SECRET is set
// as a project env var - checking it here stops anyone else who finds this
// URL from triggering it, since that would resend reminder emails on demand.
//
// Deliberately not rate limited: the secret check already rejects everything
// that isn't the scheduler, there is no user to key a limit on, and capping
// it could suppress the one run a day that is supposed to happen.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return cronUnauthorized();
  }

  try {
    const result = await sendRenewalReminders();
    return Response.json(result);
  } catch (error) {
    captureError(error, { route: "cron/billing-reminders" });
    return Response.json({ error: "Failed to send renewal reminders" }, { status: 500 });
  }
}
