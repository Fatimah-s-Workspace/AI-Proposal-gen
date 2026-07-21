import { Metadata } from "next";
import { redirect } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Lightbulb, FileText } from "lucide-react";
import Link from "next/link";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/session";
import { ClauseExplanationPanel } from "@/components/projects/clause-explanation-panel";
import { AiToolsProposalEditor } from "@/components/projects/ai-tools-proposal-editor";

export const metadata: Metadata = {
  title: "AI Tools",
};

type Props = {
  params: Promise<{ projectId: string }>;
};

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.map(String) : [];
}

function actionCompletions(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const completions = (value as { actionCompletions?: unknown })
    .actionCompletions;
  return Array.isArray(completions) ? completions.map(Boolean) : [];
}

export default async function AIToolsPage({ params }: Props) {
  const { projectId } = await params;
  const user = await requireUser();

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: user.id },
    include: {
      clauses: true,
      proposalSections: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!project) {
    redirect("/projects");
  }

  const clauses = project.clauses.map((clause) => ({
    id: clause.id,
    title: clause.title,
    originalText: clause.originalText,
    explanation: clause.explanation,
    importance: clause.importance,
    riskLevel: clause.riskLevel,
    actions: stringArray(clause.actions),
    actionsRequired: stringArray(clause.actionsRequired),
    actionCompletions: actionCompletions(clause.metadata),
    confidence: clause.confidence ?? 0,
  }));

  const proposalSections = project.proposalSections.map((section) => ({
    id: section.id,
    title: section.title,
    content: section.content ?? undefined,
    sectionType: section.sectionType,
    version: section.version,
    generatedAt: section.generatedAt ?? undefined,
    wordTarget: section.wordTarget,
  }));

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-4 md:p-6">
        {/* Header */}
        <div className="mb-6">
          <Link href={`/projects/${projectId}`}>
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="size-4 mr-2" />
              Back to Project
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">AI Tools</h1>
          <p className="text-muted-foreground mt-1">{project.title}</p>
          <p className="text-sm text-muted-foreground mt-2">
            Leverage AI to explain tender clauses and generate proposal content
          </p>
        </div>

        {/* Main Content - Tabs */}
        <Tabs defaultValue="clauses" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="clauses" className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4" />
              Clause Explanations ({clauses.length})
            </TabsTrigger>
            <TabsTrigger value="proposals" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Proposal Sections ({proposalSections.length})
            </TabsTrigger>
          </TabsList>

          {/* Clause Explanations Tab */}
          <TabsContent value="clauses" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Clause Explanation Service</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Upload tender documents to extract clauses, then use AI to
                  generate business-friendly explanations, classify importance,
                  and create action items.
                </p>
              </CardHeader>
              <CardContent>
                <ClauseExplanationPanel
                  clauses={clauses}
                  projectId={projectId}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Proposal Sections Tab */}
          <TabsContent value="proposals" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Proposal Generation Service</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Generate comprehensive proposal sections aligned with your
                  extracted requirements. Each section can be regenerated with
                  custom instructions.
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                {proposalSections.length > 0 ? (
                  proposalSections.map((section) => (
                    <AiToolsProposalEditor
                      key={section.id}
                      section={section}
                      projectId={projectId}
                    />
                  ))
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
                    <p className="text-lg font-medium mb-2">
                      No proposal sections yet
                    </p>
                    <p className="text-sm">
                      Create proposal sections to start generating content with
                      AI.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
