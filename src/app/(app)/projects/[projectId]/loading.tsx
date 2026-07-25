import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Shown for the project detail page and, as a fallback, any nested project
// route (workspace, parsed-overview, export, edit) that doesn't define its
// own more specific loading.tsx.
export default function ProjectLoading() {
  return (
    <div className="space-y-8">
      <div>
        <Skeleton className="h-4 w-24" />
        <div className="mt-2 flex gap-2">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-6 w-24" />
        </div>
        <Skeleton className="mt-2 h-8 w-72 max-w-full" />
        <Skeleton className="mt-2 h-4 w-56" />
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index}>
            <CardContent className="space-y-3 p-5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardContent className="space-y-3 p-5">
            <Skeleton className="h-5 w-28" />
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-3 p-5">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
