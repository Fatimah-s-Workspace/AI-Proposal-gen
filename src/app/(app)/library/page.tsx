import { BookMarked } from "lucide-react";

import { LibraryManager } from "@/components/library/library-manager";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { listLibraryEntries } from "@/server/content-library";
import { canDeleteLibraryEntries } from "@/server/permissions";
import { requireUser } from "@/server/session";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Content library",
};

export default async function LibraryPage() {
  const user = await requireUser();

  const entries = await listLibraryEntries({
    organizationId: user.organizationId,
    includeArchived: true,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Content library</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Answers your team has approved once and can reuse on every bid. Saved
          answers are offered automatically when a proposal section needs them.
        </p>
      </div>

      {entries.length === 0 ? (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <BookMarked className="text-muted-foreground h-5 w-5" />
              <CardTitle>Nothing saved yet</CardTitle>
            </div>
            <CardDescription>
              The library fills up as you work. When a proposal section reads
              well, use <strong>Save to library</strong> in the editor and it
              will be offered on the next tender that asks the same thing.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LibraryManager
              entries={[]}
              canDelete={canDeleteLibraryEntries(user.organizationRole)}
            />
          </CardContent>
        </Card>
      ) : (
        <LibraryManager
          entries={entries.map((entry) => ({
            id: entry.id,
            title: entry.title,
            content: entry.content,
            sectionType: entry.sectionType,
            tags: entry.tags,
            timesUsed: entry.timesUsed,
            lastUsedAt: entry.lastUsedAt ? entry.lastUsedAt.toISOString() : null,
            archivedAt: entry.archivedAt ? entry.archivedAt.toISOString() : null,
            authorName: entry.createdBy?.name ?? entry.createdBy?.email ?? null,
          }))}
          canDelete={canDeleteLibraryEntries(user.organizationRole)}
        />
      )}
    </div>
  );
}
