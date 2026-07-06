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

export const dynamic = "force-dynamic";

export default async function UsagePage() {
  const user = await requireUser();

  // Fetch 24 months of usage data with detailed breakdown
  const usage = await prisma.usageTracking.findMany({
    where: { userId: user.id },
    orderBy: { period: "desc" },
    take: 24,
  });

  // Calculate statistics
  const totalUploads = usage.reduce((sum, u) => sum + u.uploads, 0);
  const totalAiGenerations = usage.reduce((sum, u) => sum + u.aiGenerations, 0);
  const totalExports = usage.reduce((sum, u) => sum + u.exports, 0);
  const totalTokens = usage.reduce((sum, u) => sum + u.tokensUsed, 0);

  const avgMonthlyUploads = Math.round(totalUploads / Math.max(usage.length, 1));
  const avgMonthlyAi = Math.round(
    totalAiGenerations / Math.max(usage.length, 1)
  );
  const avgMonthlyExports = Math.round(totalExports / Math.max(usage.length, 1));

  const peakUploadMonth =
    usage.length > 0
      ? usage.reduce((max, u) => (u.uploads > max.uploads ? u : max))
      : null;
  const peakAiMonth =
    usage.length > 0
      ? usage.reduce((max, u) => (u.aiGenerations > max.aiGenerations ? u : max))
      : null;

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Usage Analytics</h1>
        <p className="text-muted-foreground mt-2">
          Detailed breakdown of your account activity over the last 24 months
        </p>
      </div>

      {/* Summary Statistics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Uploads
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUploads}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {avgMonthlyUploads} avg per month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              AI Generations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAiGenerations}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {avgMonthlyAi} avg per month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Exports
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalExports}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {avgMonthlyExports} avg per month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Tokens Used
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(totalTokens / 1000).toFixed(1)}k
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Total usage
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Peak Activity */}
      <div className="grid gap-4 md:grid-cols-2">
        {peakUploadMonth && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Peak Upload Month</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-muted-foreground">
                  {peakUploadMonth.period}
                </span>
                <span className="text-2xl font-bold">
                  {peakUploadMonth.uploads}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {Math.round((peakUploadMonth.uploads / totalUploads) * 100)}% of
                total uploads
              </p>
            </CardContent>
          </Card>
        )}

        {peakAiMonth && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Peak AI Month</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-muted-foreground">
                  {peakAiMonth.period}
                </span>
                <span className="text-2xl font-bold">
                  {peakAiMonth.aiGenerations}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {Math.round((peakAiMonth.aiGenerations / totalAiGenerations) * 100)}% of
                total generations
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Monthly Breakdown Table */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Breakdown</CardTitle>
          <CardDescription>
            Detailed usage statistics for each month
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Uploads</TableHead>
                  <TableHead className="text-right">AI Generations</TableHead>
                  <TableHead className="text-right">Exports</TableHead>
                  <TableHead className="text-right">Tokens Used</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usage.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <p className="text-muted-foreground">
                        No usage data available yet
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  usage.map((period) => (
                    <TableRow key={period.id}>
                      <TableCell className="font-medium">
                        {period.period}
                      </TableCell>
                      <TableCell className="text-right">
                        {period.uploads}
                      </TableCell>
                      <TableCell className="text-right">
                        {period.aiGenerations}
                      </TableCell>
                      <TableCell className="text-right">
                        {period.exports}
                      </TableCell>
                      <TableCell className="text-right">
                        {period.tokensUsed.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Insights */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Insights</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3">
            <Badge variant="secondary" className="mt-1">
              1
            </Badge>
            <div>
              <p className="font-medium text-sm">Most Active Period</p>
              <p className="text-sm text-muted-foreground">
                {peakUploadMonth?.period} had the highest document upload
                activity
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Badge variant="secondary" className="mt-1">
              2
            </Badge>
            <div>
              <p className="font-medium text-sm">Average Monthly Usage</p>
              <p className="text-sm text-muted-foreground">
                You upload {avgMonthlyUploads} documents and generate {avgMonthlyAi} AI proposals per month on average
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Badge variant="secondary" className="mt-1">
              3
            </Badge>
            <div>
              <p className="font-medium text-sm">Usage Consistency</p>
              <p className="text-sm text-muted-foreground">
                Track your {usage.length} months of activity to understand your
                usage patterns
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
