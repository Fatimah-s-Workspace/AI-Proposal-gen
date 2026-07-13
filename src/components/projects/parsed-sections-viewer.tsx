"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ParsedSection = {
  id: string;
  title: string;
  body: string;
  order: number;
};

type DocumentWithParsing = {
  id: string;
  originalName: string;
  parsingStatus: string | null;
  parsingError: string | null;
  parsedAt: Date | null;
  parsedSections: ParsedSection[];
  rawParsedText?: string | null;
  parsedJson?: unknown | null;
};

type ParsedSectionsViewerProps = {
  documents: DocumentWithParsing[];
};

const parsingStatusColors = {
  pending: "secondary",
  completed: "success",
  failed: "destructive",
} as const;

export function ParsedSectionsViewer({ documents }: ParsedSectionsViewerProps) {
  if (!documents.length) {
    return (
      <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        No documents available. Upload a document to view parsed sections.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {documents.map((doc) => (
        <Card key={doc.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">{doc.originalName}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {doc.parsedSections.length} sections parsed
                </p>
              </div>
              <div className="flex flex-col gap-2 items-end">
                <Badge
                  variant={
                    parsingStatusColors[
                      doc.parsingStatus as keyof typeof parsingStatusColors
                    ] || "outline"
                  }
                >
                  {doc.parsingStatus || "unknown"}
                </Badge>
                {doc.parsedAt && (
                  <p className="text-xs text-muted-foreground">
                    {new Date(doc.parsedAt).toLocaleDateString("en-NG")}
                  </p>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="max-h-[640px] overflow-y-auto pr-4">
            {doc.parsingError ? (
              <div className="rounded-md border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">
                <p className="font-medium">Parsing Error</p>
                <p className="mt-1">{doc.parsingError}</p>
              </div>
            ) : doc.parsedSections.length > 0 ? (
              <div className="space-y-4">
                {doc.parsedSections.map((section) => (
                  <div key={section.id} className="rounded-lg border p-4">
                    <h3 className="font-semibold text-sm mb-2">
                      {section.order}. {section.title}
                    </h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-5">
                      {section.body}
                    </p>
                    <details className="mt-3">
                      <summary className="text-xs font-medium cursor-pointer hover:text-primary">
                        View full section
                      </summary>
                      <div className="mt-3 max-h-[360px] overflow-y-auto rounded-md bg-muted p-3">
                        <pre className="text-xs whitespace-pre-wrap break-words">
                          {section.body}
                        </pre>
                      </div>
                    </details>
                  </div>
                ))}
                <details className="rounded-md border p-4">
                  <summary className="text-sm font-medium cursor-pointer hover:text-primary">
                    View Raw Parsed Text
                  </summary>
                  <div className="mt-3 max-h-[360px] overflow-y-auto rounded-md bg-slate-950 p-4 text-xs text-white">
                    <pre className="whitespace-pre-wrap break-words">
                      {doc.rawParsedText ||
                        doc.parsedSections
                          .map(
                            (section) => `${section.title}\n\n${section.body}`,
                          )
                          .join("\n\n---\n\n")}
                    </pre>
                  </div>
                </details>
                <details className="rounded-md border p-4">
                  <summary className="text-sm font-medium cursor-pointer hover:text-primary">
                    View Parsed JSON
                  </summary>
                  <div className="mt-3 max-h-[360px] overflow-y-auto rounded-md bg-slate-950 p-4 text-xs text-white">
                    <pre className="whitespace-pre-wrap break-words">
                      {JSON.stringify(
                        doc.parsedJson ?? {
                          parsedSections: doc.parsedSections,
                          parsingStatus: doc.parsingStatus,
                          parsingError: doc.parsingError,
                          parsedAt: doc.parsedAt,
                        },
                        null,
                        2,
                      )}
                    </pre>
                  </div>
                </details>
                <details className="rounded-md border p-4">
                  <summary className="text-sm font-medium cursor-pointer hover:text-primary">
                    Parsing logs
                  </summary>
                  <div className="mt-3 max-h-[320px] overflow-y-auto rounded-md bg-muted p-4 text-sm text-muted-foreground">
                    <pre className="whitespace-pre-wrap break-words text-xs">
                      {JSON.stringify(
                        {
                          parsingStatus: doc.parsingStatus,
                          parsingError: doc.parsingError,
                          parsedAt: doc.parsedAt,
                          sectionsCount: doc.parsedSections.length,
                        },
                        null,
                        2,
                      )}
                    </pre>
                  </div>
                </details>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No sections have been parsed yet.
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
