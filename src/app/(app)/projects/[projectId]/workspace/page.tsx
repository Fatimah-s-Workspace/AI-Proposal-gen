import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClausePanel } from "@/components/editor/clause-panel";
import { ProposalEditor } from "@/components/editor/proposal-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/session";
import { buildTenderProposalPlan } from "@/features/proposals/tender-proposal";
import {
  mapProjectToTenderProposalContext,
  tenderProposalContextInclude,
} from "@/server/tender-proposal";

export const dynamic = "force-dynamic";

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const user = await requireUser();
  const { projectId } = await params;
  // A single fetch covering everything this page and its proposal-context
  // mapping need, rather than two separate Project queries with
  // overlapping requirements/clauses/proposalSections includes.
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: user.id },
    include: {
      ...tenderProposalContextInclude,
      proposalSections: {
        ...tenderProposalContextInclude.proposalSections,
        include: {
          generatedContents: {
            orderBy: { createdAt: "desc" },
            take: 5,
          },
        },
      },
    },
  });

  if (!project) notFound();

  const proposalContext = mapProjectToTenderProposalContext(project);

  const clauses = project.clauses.map((clause) => ({
    id: clause.id,
    clause: clause.title || clause.originalText.substring(0, 100) + "...",
    plainEnglish: clause.explanation || "No explanation available",
    riskLevel: (clause.riskLevel as "high" | "medium" | "low") || "medium",
    action:
      Array.isArray(clause.actionsRequired) && clause.actionsRequired.length > 0
        ? String(clause.actionsRequired[0])
        : "Review this clause carefully",
  }));
  const sectionProps = project.proposalSections.map((section) => ({
    id: section.id,
    title: section.title,
    slug: section.slug,
    sectionType: section.sectionType,
    order: section.order,
    content: section.content,
    status: section.status,
    wordTarget: section.wordTarget,
    versions: section.generatedContents.map((version) => ({
      id: version.id,
      provider: version.provider,
      contentType: version.contentType,
      version: version.version,
      createdAt: version.createdAt.toISOString(),
    })),
  }));
  const requirementProps = project.requirements.map((requirement) => ({
    id: requirement.id,
    title: requirement.title,
    description: requirement.description,
    category: requirement.category,
    sourceClause: requirement.sourceClause,
    evidenceNeeded: Array.isArray(requirement.evidenceNeeded)
      ? requirement.evidenceNeeded.map(String)
      : [],
    evidenceMatches: Array.isArray(requirement.evidenceMatches)
      ? requirement.evidenceMatches
      : [],
    priority: requirement.priority,
    status: requirement.status,
    owner: requirement.owner,
  }));
  const sectionPlan = buildTenderProposalPlan(proposalContext);

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b pb-4 pt-5 mb-8">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="-ml-3 mb-2 text-muted-foreground"
        >
          <Link href={`/projects/${projectId}`}>
            <ArrowLeft className="size-4" />
            Back to project
          </Link>
        </Button>
        <div className="mb-2 flex flex-wrap gap-2">
          <Badge variant="secondary">{project.opportunityType}</Badge>
          <Badge variant="outline">{project.clientName}</Badge>
        </div>
        <h1 className="text-3xl font-semibold tracking-normal">
          Proposal workspace
        </h1>
        <p className="mt-2 text-muted-foreground">{project.title}</p>
      </div>

      <div className="grid gap-6">
        <ProposalEditor
          projectId={project.id}
          sections={sectionProps}
          sectionPlan={sectionPlan}
          requirements={requirementProps}
          clauses={clauses}
        />

        <ClausePanel clauses={clauses} />
      </div>
    </div>
  );
}
