import Link from "next/link";
import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default async function BillingFailedPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;

  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center">
      <Card className="w-full">
        <CardContent className="flex flex-col items-center gap-4 p-8">
          <XCircle className="size-12 text-destructive" />
          <div>
            <h1 className="text-xl font-semibold">Payment not completed</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {reason === "payment_not_successful"
                ? "The payment wasn't completed. No charge was made."
                : "Something went wrong confirming your payment. If you were charged, contact support and we'll sort it out."}
            </p>
          </div>
          <Button asChild className="w-full">
            <Link href="/usage">Back to usage</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
