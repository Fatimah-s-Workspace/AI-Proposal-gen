import { z } from "zod";

import type {
  TenderProposalContext,
  TenderProposalSectionPlan,
} from "@/features/proposals/tender-proposal";
import {
  GEMINI_MODEL,
  getGeminiClient,
  isGeminiQuotaOrAvailabilityError,
} from "@/lib/ai/client";
import { parseJson } from "@/features/ai/gemini-provider";
import { prisma } from "@/server/db";

const geminiDraftResponseSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
});

export async function generateProposalSectionDraft(input: {
  projectId: string;
  sectionId: string;
  userId: string;
  context: TenderProposalContext;
  sectionPlan: TenderProposalSectionPlan;
  prismaClient?: typeof prisma;
  geminiClient?: ReturnType<typeof getGeminiClient>;
  tone?: "formal" | "confident" | "technical" | "ngo";
  customPrompt?: string;
}) {
  const prismaClient = input.prismaClient ?? prisma;
  const geminiClient = input.geminiClient ?? getGeminiClient();

  const section = await prismaClient.proposalSection.findUnique({
    where: { id: input.sectionId },
  });
  if (!section) throw new Error("Proposal section not found");

  const prompt = buildProposalPrompt(
    input.context,
    input.sectionPlan,
    input.tone,
    input.customPrompt,
  );

  let responseText = "";
  let generationMode: "gemini" | "fallback" = geminiClient
    ? "gemini"
    : "fallback";
  let geminiError: unknown;

  if (geminiClient) {
    try {
      const response = await geminiClient.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
      });
      responseText = response.text?.trim() ?? "";
      if (!responseText) throw new Error("Gemini returned an empty response");
    } catch (error) {
      geminiError = error;
      if (
        !process.env.GEMINI_API_KEY ||
        isGeminiQuotaOrAvailabilityError(error)
      ) {
        generationMode = "fallback";
        responseText = "";
      } else {
        await prismaClient.$transaction(async (tx) => {
          await tx.proposalGeneration.create({
            data: {
              projectId: input.projectId,
              sectionId: input.sectionId,
              userId: input.userId,
              provider: "gemini",
              status: "failed",
              prompt,
              response:
                error instanceof Error
                  ? error.message
                  : "Gemini generation failed",
              metadata: {
                error: error instanceof Error ? error.message : String(error),
              },
            },
          });
        });
        throw new Error(
          `Gemini generation failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  let parsed: z.infer<typeof geminiDraftResponseSchema>;
  try {
    if (generationMode === "fallback") {
      parsed = buildFallbackDraft(
        input.context,
        input.sectionPlan,
        input.tone,
        input.customPrompt,
      );
    } else {
      parsed = geminiDraftResponseSchema.parse(parseJson(responseText));
    }
  } catch {
    await prismaClient.$transaction(async (tx) => {
      await tx.proposalGeneration.create({
        data: {
          projectId: input.projectId,
          sectionId: input.sectionId,
          userId: input.userId,
          provider: "gemini",
          status: "failed",
          prompt,
          response: responseText,
          metadata: { error: "Invalid Gemini response format" },
        },
      });
    });
    throw new Error("Invalid Gemini response format");
  }

  const fallbackReason =
    generationMode === "fallback"
      ? !process.env.GEMINI_API_KEY
        ? "no_api_key"
        : geminiError && isGeminiQuotaOrAvailabilityError(geminiError)
          ? "quota_or_availability"
          : "gemini_error"
      : undefined;

  try {
    const updatedSection = await prismaClient.$transaction(async (tx) => {
      const nextVersion =
        (await tx.proposalGeneration.count?.({
          where: { sectionId: input.sectionId },
        })) ?? 0;

      await tx.proposalGeneration.create({
        data: {
          projectId: input.projectId,
          sectionId: input.sectionId,
          userId: input.userId,
          provider:
            generationMode === "fallback" ? "gemini-fallback" : "gemini",
          status: "succeeded",
          prompt,
          response: parsed.content,
          metadata: {
            title: parsed.title,
            model: generationMode === "fallback" ? "fallback" : GEMINI_MODEL,
            version: nextVersion + 1,
            fallback: generationMode === "fallback",
            fallbackReason,
            error:
              geminiError instanceof Error ? geminiError.message : undefined,
          },
        },
      });

      await tx.generatedContent.create({
        data: {
          projectId: input.projectId,
          sectionId: input.sectionId,
          provider:
            generationMode === "fallback" ? "gemini-fallback" : "gemini",
          contentType: "proposal_section",
          prompt,
          output: parsed.content,
          metadata: {
            title: parsed.title,
            model: generationMode === "fallback" ? "fallback" : GEMINI_MODEL,
            version: nextVersion + 1,
            fallback: generationMode === "fallback",
            fallbackReason,
          },
        },
      });

      // include here (rather than a separate findUnique after the
      // transaction commits) is what lets callers that need the fresh
      // generatedContents list - e.g. generateTenderSectionsForProject's
      // loop over sections - skip an extra per-section round trip.
      return tx.proposalSection.update({
        where: { id: input.sectionId },
        data: {
          title: parsed.title,
          content: parsed.content,
          status: "drafting",
          version: { increment: 1 },
          generatedAt: new Date(),
        },
        include: {
          generatedContents: {
            orderBy: { createdAt: "desc" },
            take: 5,
          },
        },
      });
    });

    return {
      section: updatedSection,
      prompt,
    };
  } catch (error) {
    await prismaClient.$transaction(async (tx) => {
      await tx.proposalGeneration.create({
        data: {
          projectId: input.projectId,
          sectionId: input.sectionId,
          userId: input.userId,
          provider: "gemini",
          status: "failed",
          prompt,
          response: "",
          metadata: {
            error: error instanceof Error ? error.message : String(error),
          },
        },
      });
    });
    throw error;
  }
}

function buildFallbackDraft(
  context: TenderProposalContext,
  sectionPlan: TenderProposalSectionPlan,
  tone = "formal",
  customPrompt?: string,
) {
  const requirementSummary = context.requirements
    .slice(0, 3)
    .map((requirement) => requirement.title)
    .join(", ");
  const clauseSummary = context.clauses
    .slice(0, 2)
    .map((clause) => clause.title ?? clause.originalText.slice(0, 60))
    .join("; ");
  const audience = context.project.clientName || "the client";
  const opening = `We understand ${audience}’s requirements and the importance of presenting a clear, evaluator-friendly response for ${sectionPlan.title}.`;
  const supporting = requirementSummary
    ? `The response is structured around the key requirements of ${requirementSummary}.`
    : "The response is structured around the core tender drivers and compliance needs.";
  const compliance = clauseSummary
    ? `It also addresses the principal clauses covering ${clauseSummary}.`
    : "It also addresses the principal compliance obligations and delivery expectations.";
  const toneLabel =
    tone === "technical"
      ? "technical and implementation-focused"
      : tone === "confident"
        ? "confident and persuasive"
        : tone === "ngo"
          ? "mission-driven and impact-focused"
          : "formal and evaluator-ready";
  const instruction = customPrompt ? ` ${customPrompt}` : "";

  return {
    title: sectionPlan.title,
    content: `<h2>${sectionPlan.title}</h2><p>${opening}</p><p>${supporting}</p><p>${compliance}</p><p>This draft is written in a ${toneLabel} style${instruction} and is intended to be reviewed, refined, and tailored to the tender evidence before submission.</p>`,
  };
}

// Exported for tests: which project fields reach the model is the whole
// point of the fields users fill in, and nothing else would catch a
// regression that silently drops one.
export function buildProposalPrompt(
  context: TenderProposalContext,
  sectionPlan: TenderProposalSectionPlan,
  tone = "formal",
  customPrompt?: string,
) {
  const requirements = context.requirements
    .slice(0, 8)
    .map((requirement) => `${requirement.title}: ${requirement.description}`)
    .join("\n");
  const clauses = context.clauses
    .slice(0, 5)
    .map((clause) => clause.title ?? clause.originalText.slice(0, 140))
    .join("\n");

  const project = context.project;

  // Only emit a line when there's something in it - a prompt full of
  // "Budget: not specified" teaches the model that blanks are normal and
  // invites it to leave its own.
  const detail = (label: string, value?: string | null) =>
    value && value.trim() ? `${label}: ${value.trim()}` : null;

  return [
    `Write a proposal section for the ${project.opportunityType} titled ${sectionPlan.title}.`,
    detail("Client", project.clientName),
    detail("Project", project.title),
    detail("Tender reference", project.referenceNumber),
    detail("Sector", project.sector),
    detail("Country", project.country),
    detail("Procuring authority", project.authority),
    detail("Budget", project.budgetRange),
    detail("Contract duration", project.contractDuration),
    project.deadline
      ? `Submission deadline: ${project.deadline.toISOString().slice(0, 10)}`
      : null,
    detail("Opportunity notes", project.summary),
    // The two highest-leverage inputs, so they carry an instruction rather
    // than being dropped in as bare context the model may or may not act on.
    project.evaluationCriteria?.trim()
      ? `Evaluation criteria - address these explicitly and in proportion to their weight:\n${project.evaluationCriteria.trim()}`
      : null,
    project.winThemes?.trim()
      ? `Win themes to carry through the writing:\n${project.winThemes.trim()}`
      : null,
    detail("Incumbent or known competitors", project.incumbent),
    `Tone: ${tone} and evaluator-ready.`,
    project.submissionLanguage && project.submissionLanguage !== "English"
      ? `Write the section in ${project.submissionLanguage}.`
      : null,
    `Target length: about ${sectionPlan.wordTarget} words.`,
    `Section rationale: ${sectionPlan.rationale}`,
    `Requirements:\n${requirements || "None"}`,
    `Clauses:\n${clauses || "None"}`,
    customPrompt ? `Additional instruction: ${customPrompt}` : null,
    `Return JSON with the shape {"title":"...","content":"..."}.`,
    `Do not include markdown fencing or commentary.`,
  ]
    .filter(Boolean)
    .join("\n");
}
