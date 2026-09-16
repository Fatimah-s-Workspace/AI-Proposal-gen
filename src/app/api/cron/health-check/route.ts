import { runHealthChecks, summarise } from "@/server/health";
import { captureError } from "@/lib/monitoring";
import { sendEmail } from "@/lib/email";
import { cronUnauthorized } from "@/server/responses";

export const dynamic = "force-dynamic";

/**
 * A daily canary.
 *
 * Sentry records errors, but recording is not alerting: the Brevo endpoint
 * typo was captured correctly and still broke every email in the product for
 * weeks, because nobody was looking at the dashboard. Something has to
 * actively check and speak up.
 *
 * Runs once a day and reports only when something is wrong, so a message from
 * this means something rather than becoming another daily email to filter.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return cronUnauthorized();
  }

  const report = await runHealthChecks();

  if (report.status === "ok") {
    return Response.json({ status: report.status, alerted: false });
  }

  const summary = summarise(report);
  const failing = report.checks.filter((check) => check.status !== "ok");

  // Sentry first: it is the record, and it works even if email is the thing
  // that is broken - which, given email gates signup, is a likely case.
  captureError(new Error(`Health check ${report.status}: ${summary}`), {
    area: "health-check",
    checks: failing,
  });

  // Then email, because a Sentry entry nobody opens is what this exists to
  // fix. Best-effort: failing to send an alert must not fail the check that
  // produced it, and if email is down the Sentry entry above still stands.
  let alerted = false;
  const recipient = process.env.ALERT_EMAIL?.trim();

  if (recipient) {
    const lines = failing.map((check) => `- ${check.name} (${check.status}): ${check.detail}`);
    const result = await sendEmail({
      to: recipient,
      subject: `TenderFlow ${report.status === "down" ? "is down" : "is degraded"}: ${summary}`,
      text: [
        `Health check at ${report.checkedAt} reported: ${report.status}.`,
        "",
        ...lines,
        "",
        "This runs once a day and only writes when something is wrong.",
      ].join("\n"),
      html: [
        `<p>Health check at ${report.checkedAt} reported: <strong>${report.status}</strong>.</p>`,
        "<ul>",
        ...failing.map(
          (check) =>
            `<li><strong>${check.name}</strong> (${check.status}): ${check.detail}</li>`,
        ),
        "</ul>",
        "<p>This runs once a day and only writes when something is wrong.</p>",
      ].join(""),
    }).catch(() => ({ delivered: false as const }));

    alerted = result.delivered;
  }

  return Response.json({ status: report.status, summary, alerted, checks: failing });
}
