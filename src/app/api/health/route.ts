import { runHealthChecks } from "@/server/health";

export const dynamic = "force-dynamic";

/**
 * The endpoint an uptime monitor polls.
 *
 * Deliberately says almost nothing. A monitor only needs to know whether to
 * page someone, and this URL is public - listing which of your services is
 * currently down is a map for anyone deciding when to attack. The detail is
 * available at /api/cron/health-check, behind the cron secret.
 *
 * 503 on "down" is what makes this useful: monitors alert on status codes, so
 * a failing database pages someone instead of sitting green because the
 * homepage still renders from cache.
 */
export async function GET() {
  const report = await runHealthChecks();

  return Response.json(
    { status: report.status, checkedAt: report.checkedAt },
    {
      status: report.status === "down" ? 503 : 200,
      headers: {
        // Never cached: a cached health check is a monitor watching the past.
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
