import { requireUser } from "@/server/session";
import { prisma } from "@/server/db";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export const dynamic = "force-dynamic";

function formatPeriod(period: string) {
  const [year, month] = period.split("-").map(Number);
  if (!year || !month) return period;
  return new Intl.DateTimeFormat("en-NG", {
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

function percentOf(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

export default async function UsagePage() {
  const user = await requireUser();

  const [usage, subscription] = await Promise.all([
    prisma.usageTracking.findMany({
      where: { userId: user.id },
      orderBy: { period: "desc" },
      take: 24,
    }),
    prisma.subscription.findUnique({ where: { userId: user.id } }),
  ]);

  const currentPeriod = new Date().toISOString().slice(0, 7);

  // A user can have one row per project per period; aggregate by period.
  const byPeriod = new Map<
    string,
    { uploads: number; aiGenerations: number; exports: number; tokensUsed: number }
  >();
  for (const row of usage) {
    const bucket = byPeriod.get(row.period) ?? {
      uploads: 0,
      aiGenerations: 0,
      exports: 0,
      tokensUsed: 0,
    };
    bucket.uploads += row.uploads;
    bucket.aiGenerations += row.aiGenerations;
    bucket.exports += row.exports;
    bucket.tokensUsed += row.tokensUsed;
    byPeriod.set(row.period, bucket);
  }
  const periods = [...byPeriod.entries()]
    .map(([period, totals]) => ({ period, ...totals }))
    .sort((a, b) => b.period.localeCompare(a.period));

  const totals = periods.reduce(
    (acc, p) => ({
      uploads: acc.uploads + p.uploads,
      aiGenerations: acc.aiGenerations + p.aiGenerations,
      exports: acc.exports + p.exports,
      tokensUsed: acc.tokensUsed + p.tokensUsed,
    }),
    { uploads: 0, aiGenerations: 0, exports: 0, tokensUsed: 0 },
  );

  const current = byPeriod.get(currentPeriod) ?? {
    uploads: 0,
    aiGenerations: 0,
    exports: 0,
    tokensUsed: 0,
  };
  const uploadLimit = subscription?.monthlyUploadLimit ?? 100;
  const proposalLimit = subscription?.monthlyProposalLimit ?? 10;

  const monthCount = Math.max(periods.length, 1);
  const maxActivity = Math.max(
    1,
    ...periods.map((p) => p.uploads + p.aiGenerations + p.exports),
  );

  const summaryCards = [
    {
      title: "Total uploads",
      value: totals.uploads.toLocaleString(),
      hint: `${Math.round(totals.uploads / monthCount)} avg per month`,
    },
    {
      title: "AI generations",
      value: totals.aiGenerations.toLocaleString(),
      hint: `${Math.round(totals.aiGenerations / monthCount)} avg per month`,
    },
    {
      title: "Exports",
      value: totals.exports.toLocaleString(),
      hint: `${Math.round(totals.exports / monthCount)} avg per month`,
    },
    {
      title: "Estimated tokens",
      value:
        totals.tokensUsed >= 1000
          ? `${(totals.tokensUsed / 1000).toFixed(1)}k`
          : totals.tokensUsed.toLocaleString(),
      hint: "Estimated from document and draft length",
    },
  ];

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Usage</h1>
        <p className="mt-2 text-muted-foreground">
          Your plan limits for this month and activity across the last{" "}
          {monthCount} month{monthCount !== 1 ? "s" : ""}.
        </p>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>This month · {formatPeriod(currentPeriod)}</CardTitle>
            <CardDescription>
              Counted across all active workspaces on the{" "}
              {subscription?.plan ?? "starter"} plan.
            </CardDescription>
          </div>
          <Badge variant="secondary">{subscription?.status ?? "trialing"}</Badge>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div>
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium">Document uploads</span>
              <span className="text-muted-foreground">
                {current.uploads}/{uploadLimit}
              </span>
            </div>
            <Progress
              value={Math.min(100, percentOf(current.uploads, uploadLimit))}
              className="mt-2"
            />
          </div>
          <div>
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium">AI generations</span>
              <span className="text-muted-foreground">
                {current.aiGenerations}/{proposalLimit}
              </span>
            </div>
            <Progress
              value={Math.min(
                100,
                percentOf(current.aiGenerations, proposalLimit),
              )}
              className="mt-2"
            />
            {current.aiGenerations >= proposalLimit && (
              <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                Monthly AI limit reached — drafts fall back to local templates
                until next month.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                {card.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{card.value}</div>
              <p className="mt-1 text-xs text-muted-foreground">{card.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Monthly activity</CardTitle>
          <CardDescription>
            Uploads, AI generations, and exports per month.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {periods.length === 0 ? (
            <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              No activity recorded yet. Upload a tender document to get
              started.
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-end gap-3 overflow-x-auto pb-2">
                {[...periods].reverse().map((p) => {
                  const total = p.uploads + p.aiGenerations + p.exports;
                  const height = Math.max(6, (total / maxActivity) * 120);
                  return (
                    <div
                      key={p.period}
                      className="flex min-w-12 flex-col items-center gap-2"
                      title={`${formatPeriod(p.period)}: ${p.uploads} uploads · ${p.aiGenerations} AI · ${p.exports} exports`}
                    >
                      <span className="text-xs font-medium">{total}</span>
                      <div
                        className="flex w-8 flex-col justify-end overflow-hidden rounded-sm bg-muted"
                        style={{ height: 120 }}
                      >
                        <div
                          className="flex flex-col justify-end"
                          style={{ height }}
                        >
                          {p.exports > 0 && (
                            <div
                              className="bg-accent"
                              style={{
                                height: `${(p.exports / total) * 100}%`,
                              }}
                            />
                          )}
                          {p.aiGenerations > 0 && (
                            <div
                              className="bg-primary/60"
                              style={{
                                height: `${(p.aiGenerations / total) * 100}%`,
                              }}
                            />
                          )}
                          {p.uploads > 0 && (
                            <div
                              className="bg-primary"
                              style={{
                                height: `${(p.uploads / total) * 100}%`,
                              }}
                            />
                          )}
                        </div>
                      </div>
                      <span className="whitespace-nowrap text-[10px] text-muted-foreground">
                        {formatPeriod(p.period)}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm bg-primary" /> Uploads
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm bg-primary/60" /> AI
                  generations
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm bg-accent" /> Exports
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Monthly breakdown</CardTitle>
          <CardDescription>
            Detailed usage statistics for each month.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Uploads</TableHead>
                  <TableHead className="text-right">AI generations</TableHead>
                  <TableHead className="text-right">Exports</TableHead>
                  <TableHead className="text-right">Est. tokens</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {periods.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center">
                      <p className="text-muted-foreground">
                        No usage data available yet
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  periods.map((p) => (
                    <TableRow key={p.period}>
                      <TableCell className="font-medium">
                        {formatPeriod(p.period)}
                        {p.period === currentPeriod && (
                          <Badge variant="outline" className="ml-2 text-[10px]">
                            current
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{p.uploads}</TableCell>
                      <TableCell className="text-right">
                        {p.aiGenerations}
                      </TableCell>
                      <TableCell className="text-right">{p.exports}</TableCell>
                      <TableCell className="text-right">
                        {p.tokensUsed.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
