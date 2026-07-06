import { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ParsedSectionsViewer } from "@/components/projects/parsed-sections-viewer";
import { ExtractedRequirementsTable } from "@/components/projects/extracted-requirements-table";
import { ClauseExplanationPanel } from "@/components/projects/clause-explanation-panel";
import { ChecklistDashboard } from "@/components/projects/checklist-dashboard";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/session";

export const metadata: Metadata = {
  title: "Tender Intelligence",
};

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ projectId: string }>;
};

export default async function ParsedOverviewPage({ params }: Props) {
  const { projectId } = await params;
  const user = await requireUser();

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: user.id },
    include: {
      documents: {
        orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
        include: {
          parsedSections: { orderBy: { order: "asc" } },
          clauses: { orderBy: { createdAt: "asc" } },
          supportingEvidence: true,
        },
      },
      clauses: {
        orderBy: [{ importance: "asc" }, { createdAt: "asc" }],
        include: {
          document: { select: { originalName: true, documentType: true, version: true } },
          parsedSection: { select: { title: true, order: true } },
        },
      },
      requirements: {
        orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
      },
      supportingEvidence: {
        orderBy: { createdAt: "desc" },
        include: {
          document: { select: { originalName: true } },
          requirement: { select: { title: true } },
        },
      },
    },
  });

  if (!project) redirect("/projects");

  const documents = project.documents.map((doc) => ({
    id: doc.id,
    originalName: doc.originalName,
    parsingStatus: doc.parsingStatus,
    parsingError: doc.parsingError,
    parsedAt: doc.parsedAt,
    documentType: doc.documentType,
    isPrimary: doc.isPrimary,
    version: doc.version,
    parsedSections: doc.parsedSections,
    rawParsedText: doc.extractedText,
    parsedJson: doc.sections,
  }));

  const requirements = project.requirements.map((req) => ({
    id: req.id,
    title: req.title,
    description: req.description,
    category: req.category,
    confidence: req.confidence,
    sourceClause: req.sourceClause,
    priority: req.priority,
    status: req.status,
    owner: req.owner,
    reviewNotes: req.reviewNotes,
    evidenceNeeded: req.evidenceNeeded,
    evidenceMatches: req.evidenceMatches,
  }));

  const clauses = project.clauses.map((clause) => ({
    id: clause.id,
    title: clause.title,
    originalText: clause.originalText,
    explanation: clause.explanation,
    importance: clause.importance,
    riskLevel: clause.riskLevel,
    actionsRequired: Array.isArray(clause.actionsRequired) ? clause.actionsRequired.map(String) : [],
    actionCompletions: getActionCompletions(clause.metadata),
    confidence: clause.confidence ?? 0,
  }));

  const parsedDocuments = documents.filter((doc) => doc.parsedSections.length > 0);
  const failedDocuments = documents.filter((doc) => doc.parsingStatus === "failed");
  const pendingDocuments = documents.filter((doc) => doc.parsingStatus === "pending" || doc.parsingStatus === "processing");

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-3 mb-2">
          <Link href={`/projects/${projectId}`}>
            <ArrowLeft />
            Project
          </Link>
        </Button>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">Procurement intelligence</p>
            <h1 className="text-3xl font-semibold tracking-normal">{project.title}</h1>
            <p className="mt-2 text-muted-foreground">
              Parsed sections, raw clauses, extracted requirements, checklist state, evidence matches, and parser diagnostics.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{documents.length} documents</Badge>
            <Badge variant="outline">{clauses.length} clauses</Badge>
            <Badge variant="outline">{requirements.length} requirements</Badge>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Parsed documents" value={parsedDocuments.length} />
        <StatCard label="Pending" value={pendingDocuments.length} />
        <StatCard label="Checklist items" value={requirements.length} />
        <StatCard label="Evidence matches" value={project.supportingEvidence.length} />
      </div>

      <Tabs defaultValue="checklist" className="w-full">
        <TabsList className="mb-6 flex h-auto flex-wrap justify-start">
          <TabsTrigger value="checklist">Checklist</TabsTrigger>
          <TabsTrigger value="clauses">Clauses</TabsTrigger>
          <TabsTrigger value="requirements">Requirements</TabsTrigger>
          <TabsTrigger value="sections">Parsed sections</TabsTrigger>
          <TabsTrigger value="debug">Debug</TabsTrigger>
        </TabsList>

        <TabsContent value="checklist">
          <ChecklistDashboard requirements={requirements} projectId={projectId} />
        </TabsContent>

        <TabsContent value="clauses">
          <ClauseExplanationPanel clauses={clauses} projectId={projectId} />
        </TabsContent>

        <TabsContent value="requirements">
          <Card>
            <CardHeader>
              <CardTitle>Extracted requirements</CardTitle>
            </CardHeader>
            <CardContent>
              <ExtractedRequirementsTable requirements={requirements} projectId={projectId} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sections" className="space-y-6">
          {parsedDocuments.length ? (
            <ParsedSectionsViewer documents={parsedDocuments} />
          ) : (
            <EmptyState text="No parsed sections yet. Upload a tender pack or addendum to run the parser." />
          )}
        </TabsContent>

        <TabsContent value="debug" className="space-y-4">
          {failedDocuments.length ? (
            failedDocuments.map((doc) => (
              <Card key={doc.id} className="border-destructive/50">
                <CardHeader>
                  <CardTitle className="text-base">{doc.originalName}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-destructive">{doc.parsingError || "Unknown parser failure"}</CardContent>
              </Card>
            ))
          ) : null}
          <Card>
            <CardHeader>
              <CardTitle>Parser payload</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="max-h-[560px] overflow-auto rounded-md bg-slate-950 p-4 text-xs text-white">
                {JSON.stringify(
                  {
                    documents: documents.map((doc) => ({
                      id: doc.id,
                      originalName: doc.originalName,
                      type: doc.documentType,
                      isPrimary: doc.isPrimary,
                      version: doc.version,
                      parsingStatus: doc.parsingStatus,
                      parsedSections: doc.parsedSections.length,
                    })),
                    clauseSample: project.clauses.slice(0, 5),
                    evidence: project.supportingEvidence,
                  },
                  null,
                  2,
                )}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function getActionCompletions(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return [];
  }
  const value = (metadata as { actionCompletions?: unknown }).actionCompletions;
  return Array.isArray(value) ? value.map(Boolean) : [];
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-2 text-3xl font-semibold tracking-normal">{value}</p>
      </CardContent>
    </Card>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <Card>
      <CardContent className="p-8 text-center text-sm text-muted-foreground">{text}</CardContent>
    </Card>
  );
}
