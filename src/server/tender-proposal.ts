import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import {
  buildTenderProposalAssistant,
  buildTenderProposalPlan,
  type TenderProposalContext,
} from "@/features/proposals/tender-proposal";
import type { ExtractedRequirement } from "@/features/ai";
import { generateProposalSectionDraft } from "@/server/proposal-generation";

export const tenderProposalContextInclude = {
  documents: {
    orderBy: [
      { isPrimary: "desc" },
      { version: "desc" },
      { createdAt: "desc" },
    ],
    include: {
      parsedSections: { orderBy: { order: "asc" } },
    },
  },
  requirements: {
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  },
  clauses: {
    orderBy: [{ importance: "asc" }, { createdAt: "asc" }],
  },
  proposalSections: {
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  },
  // The bidder writing the proposal. Selected rather than included whole so
  // this can't quietly start shipping billing or slug data into a prompt.
  organization: {
    select: {
      name: true,
      legalName: true,
      registrationNumber: true,
      foundedYear: true,
      teamSize: true,
      profileSummary: true,
      capabilities: true,
      certifications: true,
      pastPerformance: true,
    },
  },
} satisfies Prisma.ProjectInclude;

type ProjectForTenderProposalContext = Prisma.ProjectGetPayload<{
  include: typeof tenderProposalContextInclude;
}>;

// Pure mapper, split out from loadTenderProposalContext so callers that
// already fetched the Project row for their own purposes (e.g. the
// workspace page) can build the same TenderProposalContext shape without
// paying for a second, largely-overlapping round trip to the database.
export function mapProjectToTenderProposalContext(
  project: ProjectForTenderProposalContext,
): TenderProposalContext {
  return {
    project: {
      title: project.title,
      clientName: project.clientName,
      opportunityType: project.opportunityType,
      sector: project.sector,
      country: project.country,
      authority: project.authority,
      deadline: project.deadline,
      budgetRange: project.budgetRange,
      summary: project.summary,
      referenceNumber: project.referenceNumber,
      evaluationCriteria: project.evaluationCriteria,
      winThemes: project.winThemes,
      contractDuration: project.contractDuration,
      incumbent: project.incumbent,
      submissionLanguage: project.submissionLanguage,
    },
    bidder: {
      name: project.organization.name,
      legalName: project.organization.legalName,
      registrationNumber: project.organization.registrationNumber,
      foundedYear: project.organization.foundedYear,
      teamSize: project.organization.teamSize,
      profileSummary: project.organization.profileSummary,
      capabilities: project.organization.capabilities,
      certifications: project.organization.certifications,
      pastPerformance: project.organization.pastPerformance,
    },
    documents: project.documents.map((document) => ({
      id: document.id,
      originalName: document.originalName,
      documentType: document.documentType,
      isPrimary: document.isPrimary,
      version: document.version,
    })),
    parsedSections: project.documents.flatMap((document) =>
      document.parsedSections.map((section) => ({
        id: section.id,
        documentId: document.id,
        documentName: document.originalName,
        documentType: document.documentType,
        isPrimary: document.isPrimary,
        title: section.title,
        body: section.body,
        order: section.order,
      })),
    ),
    clauses: project.clauses.map((clause) => ({
      id: clause.id,
      documentId: clause.documentId,
      parsedSectionId: clause.parsedSectionId,
      title: clause.title,
      originalText: clause.originalText,
      explanation: clause.explanation,
      clauseType: clause.clauseType,
      importance: clause.importance,
      riskLevel: clause.riskLevel,
      confidence: clause.confidence,
      actionsRequired: clause.actionsRequired,
    })),
    requirements: project.requirements.map((requirement) => ({
      id: requirement.id,
      documentId: requirement.documentId,
      sourceClauseId: requirement.sourceClauseId ?? undefined,
      title: requirement.title,
      description: requirement.description,
      category: normaliseRequirementCategory(requirement.category),
      sourceClause: requirement.sourceClause ?? "Tender requirement",
      priority: normalisePriority(requirement.priority),
      confidence: requirement.confidence ?? 0,
      evidenceNeeded: Array.isArray(requirement.evidenceNeeded)
        ? requirement.evidenceNeeded.map(String)
        : [],
      evidenceMatches: requirement.evidenceMatches,
      status: requirement.status,
      owner: requirement.owner,
    })),
    existingSections: project.proposalSections.map((section) => ({
      id: section.id,
      title: section.title,
      slug: section.slug,
      sectionType: section.sectionType,
      order: section.order,
      content: section.content,
      status: section.status,
      wordTarget: section.wordTarget,
    })),
  };
}

export async function loadTenderProposalContext(
  projectId: string,
  userId?: string,
): Promise<TenderProposalContext | null> {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      ...(userId ? { userId } : {}),
    },
    include: tenderProposalContextInclude,
  });

  if (!project) return null;

  return mapProjectToTenderProposalContext(project);
}

export async function syncProposalSectionsFromTender(projectId: string) {
  const context = await loadTenderProposalContext(projectId);
  if (!context) throw new Error("Project not found");

  const plan = buildTenderProposalPlan(context);
  const existingSections = await prisma.proposalSection.findMany({
    where: { projectId },
    include: {
      _count: { select: { generatedContents: true } },
    },
  });
  const existingBySlug = new Map(
    existingSections.map((section) => [
      section.sectionType || section.slug,
      section,
    ]),
  );
  const plannedSlugs = new Set(plan.map((section) => section.slug));

  const updatedSections = await Promise.all(
    plan.map((sectionPlan) => {
      const existing =
        existingBySlug.get(sectionPlan.slug) ||
        existingSections.find((section) => section.slug === sectionPlan.slug);

      const include = {
        generatedContents: {
          orderBy: { createdAt: "desc" as const },
          take: 5,
        },
      };

      if (existing) {
        return prisma.proposalSection.update({
          where: { id: existing.id },
          data: {
            title: sectionPlan.title,
            slug: sectionPlan.slug,
            sectionType: sectionPlan.sectionType,
            order: sectionPlan.order,
            wordTarget: sectionPlan.wordTarget,
            prompt: sectionPlan.prompt,
            status: existing.content?.trim() ? existing.status : "not_started",
          },
          include,
        });
      }

      return prisma.proposalSection.create({
        data: {
          projectId,
          title: sectionPlan.title,
          slug: sectionPlan.slug,
          sectionType: sectionPlan.sectionType,
          order: sectionPlan.order,
          wordTarget: sectionPlan.wordTarget,
          prompt: sectionPlan.prompt,
          status: "not_started",
        },
        include,
      });
    }),
  );

  const staleSectionIds = existingSections
    .filter((section) => {
      const hasContent = Boolean(section.content?.trim());
      const hasVersions = section._count.generatedContents > 0;
      return (
        !plannedSlugs.has(section.sectionType) &&
        !plannedSlugs.has(section.slug) &&
        !hasContent &&
        !hasVersions
      );
    })
    .map((section) => section.id);

  if (staleSectionIds.length > 0) {
    await prisma.proposalSection.deleteMany({
      where: { id: { in: staleSectionIds } },
    });
  }

  await prisma.generatedContent.create({
    data: {
      projectId,
      provider: "local",
      contentType: "proposal_section_plan",
      output: JSON.stringify(plan, null, 2),
      metadata: {
        requirementsCount: context.requirements.length,
        clausesCount: context.clauses.length,
        documentsCount: context.documents.length,
      },
    },
  });

  return { plan, sections: updatedSections };
}

export async function generateTenderSectionsForProject(input: {
  projectId: string;
  userId: string;
  sectionId?: string;
  tone?: "formal" | "confident" | "technical" | "ngo";
  customPrompt?: string;
}) {
  const syncResult = await syncProposalSectionsFromTender(input.projectId);
  const context = await loadTenderProposalContext(
    input.projectId,
    input.userId,
  );
  if (!context) throw new Error("Project not found");

  const targetSection = input.sectionId
    ? syncResult.sections.find((section) => section.id === input.sectionId)
    : null;
  const sectionSlug = targetSection?.sectionType ?? targetSection?.slug;
  const selectedPlans = syncResult.plan.filter(
    (plan) => !sectionSlug || plan.slug === sectionSlug,
  );
  const updatedSections = [];

  for (const plan of selectedPlans) {
    const section = syncResult.sections.find(
      (item) => item.sectionType === plan.slug || item.slug === plan.slug,
    );
    if (!section) continue;

    const result = await generateProposalSectionDraft({
      projectId: input.projectId,
      sectionId: section.id,
      userId: input.userId,
      context,
      sectionPlan: plan,
      prismaClient: prisma,
      tone: input.tone,
      customPrompt: input.customPrompt,
    });

    // generateProposalSectionDraft's own update already includes
    // generatedContents, so no separate re-fetch is needed here.
    updatedSections.push(result.section);
  }

  const refreshedContext = await loadTenderProposalContext(
    input.projectId,
    input.userId,
  );
  return {
    sections: updatedSections,
    assistant: refreshedContext
      ? buildTenderProposalAssistant(refreshedContext)
      : null,
  };
}

function normalisePriority(value: string): ExtractedRequirement["priority"] {
  if (value === "high" || value === "medium" || value === "low") return value;
  return "medium";
}

function normaliseRequirementCategory(
  value: string,
): ExtractedRequirement["category"] {
  if (
    value === "mandatory" ||
    value === "technical" ||
    value === "financial" ||
    value === "submission" ||
    value === "legal" ||
    value === "experience" ||
    value === "optional"
  ) {
    return value;
  }
  const lower = value.toLowerCase();
  if (/eligib|mandatory|statutory/.test(lower)) return "mandatory";
  if (/financial|commercial|price|tax/.test(lower)) return "financial";
  if (/submission|deadline|format/.test(lower)) return "submission";
  if (/legal|declaration|conflict/.test(lower)) return "legal";
  if (/experience|cv|personnel/.test(lower)) return "experience";
  if (/optional/.test(lower)) return "optional";
  return "technical";
}
