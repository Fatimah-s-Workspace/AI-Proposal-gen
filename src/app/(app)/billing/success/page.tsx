import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function BillingSuccessPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center">
      <Card className="w-full">
        <CardContent className="flex flex-col items-center gap-4 p-8">
          <CheckCircle2 className="size-12 text-emerald-600" />
          <div>
            <h1 className="text-xl font-semibold">Payment successful</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              You&apos;re on the Pro plan. Your new upload and AI generation
              limits are active immediately.
            </p>
          </div>
          <Button asChild className="w-full">
            <Link href="/usage">View usage</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
