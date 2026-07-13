import { z } from "zod";

import { generateGeminiJson } from "@/features/ai/gemini-provider";
import type {
  ExtractedRequirement,
  ParsedSection,
  TenderClauseExtraction,
} from "@/features/ai";

type ProjectContext = {
  title: string;
  clientName: string;
  opportunityType: string;
  sector: string;
  country: string;
  authority?: string | null;
  deadline?: Date | null;
  summary?: string | null;
};

const prioritySchema = z.enum(["high", "medium", "low"]);
const categorySchema = z.enum([
  "mandatory",
  "technical",
  "financial",
  "submission",
  "legal",
  "experience",
  "optional",
]);

const tenderIntelligenceSchema = z.object({
  sections: z.array(
    z.object({
      title: z.string().min(1),
      body: z.string().min(1),
      order: z.number().int().positive().optional(),
    }),
  ),
  clauses: z.array(
    z.object({
      title: z.string().min(1),
      originalText: z.string().min(1),
      clauseType: z.string().min(1),
      importance: prioritySchema,
      riskLevel: prioritySchema,
      confidence: z.number().min(0).max(1),
      actionsRequired: z.array(z.string()).default([]),
      parsedSectionOrder: z.number().int().positive().optional(),
    }),
  ),
  requirements: z.array(
    z.object({
      title: z.string().min(1),
      description: z.string().min(1),
      category: categorySchema,
      sourceClause: z.string().nullable().default(null),
      priority: prioritySchema,
      confidence: z.number().min(0).max(1),
      evidenceNeeded: z.array(z.string()).default([]),
    }),
  ),
});

const clauseExplanationSchema = z.object({
  plainEnglish: z.string().min(1),
  riskLevel: prioritySchema,
  action: z.string().min(1),
  actionsRequired: z.array(z.string()).default([]),
  clauseType: z.string().min(1).optional(),
  confidence: z.number().min(0).max(1).default(0.86),
});

const tenderIntelligenceJsonSchema = {
  type: "object",
  properties: {
    sections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          body: { type: "string" },
          order: { type: "integer" },
        },
        required: ["title", "body"],
      },
    },
    clauses: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          originalText: { type: "string" },
          clauseType: { type: "string" },
          importance: { type: "string", enum: ["high", "medium", "low"] },
          riskLevel: { type: "string", enum: ["high", "medium", "low"] },
          confidence: { type: "number" },
          actionsRequired: { type: "array", items: { type: "string" } },
          parsedSectionOrder: { type: "integer" },
        },
        required: [
          "title",
          "originalText",
          "clauseType",
          "importance",
          "riskLevel",
          "confidence",
          "actionsRequired",
        ],
      },
    },
    requirements: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          category: {
            type: "string",
            enum: [
              "mandatory",
              "technical",
              "financial",
              "submission",
              "legal",
              "experience",
              "optional",
            ],
          },
          sourceClause: { type: ["string", "null"] },
          priority: { type: "string", enum: ["high", "medium", "low"] },
          confidence: { type: "number" },
          evidenceNeeded: { type: "array", items: { type: "string" } },
        },
        required: [
          "title",
          "description",
          "category",
          "sourceClause",
          "priority",
          "confidence",
          "evidenceNeeded",
        ],
      },
    },
  },
  required: ["sections", "clauses", "requirements"],
} satisfies Record<string, unknown>;

const clauseExplanationJsonSchema = {
  type: "object",
  properties: {
    plainEnglish: { type: "string" },
    riskLevel: { type: "string", enum: ["high", "medium", "low"] },
    action: { type: "string" },
    actionsRequired: { type: "array", items: { type: "string" } },
    clauseType: { type: "string" },
    confidence: { type: "number" },
  },
  required: ["plainEnglish", "riskLevel", "action", "actionsRequired"],
} satisfies Record<string, unknown>;

export async function analyseTenderDocumentWithGemini(input: {
  project: ProjectContext;
  documentName: string;
  documentType: string;
  text: string;
  localSections: ParsedSection[];
}) {
  const textLimit = Number(process.env.GEMINI_DOCUMENT_TEXT_LIMIT ?? 45000);
  const documentText = input.text.slice(0, textLimit);

  const result = await generateGeminiJson({
    schema: tenderIntelligenceJsonSchema,
    validator: tenderIntelligenceSchema,
    temperature: 0.1,
    systemInstruction:
      "You are a procurement intelligence engine for Nigerian and African tender, RFP, RFQ, EOI, and grant documents. Extract only instructions and requirements supported by the uploaded document text. Do not invent requirements. Do not write proposal copy. Return strict JSON only.",
    input: buildTenderIntelligencePrompt(input, documentText),
  });

  if (!result) return null;

  return {
    provider: result.provider,
    model: result.model,
    raw: result.raw,
    sections: normaliseSections(result.data.sections),
    clauses: normaliseClauses(result.data.clauses),
    requirements: normaliseRequirements(result.data.requirements),
  };
}

export async function explainClauseWithGemini(input: {
  clauseText: string;
  clauseType?: string | null;
  projectTitle?: string;
}) {
  const result = await generateGeminiJson({
    schema: clauseExplanationJsonSchema,
    validator: clauseExplanationSchema,
    temperature: 0.1,
    systemInstruction:
      "Explain procurement clauses in practical business English for a bid team. Focus on compliance risk, required action, and evidence. Return strict JSON only.",
    input: [
      `Project: ${input.projectTitle ?? "TenderFlow AI project"}`,
      `Known clause type: ${input.clauseType ?? "unknown"}`,
      "Clause text:",
      input.clauseText,
      "Return practical actions. Do not add generic procurement advice unrelated to this clause.",
    ].join("\n"),
  });

  return result
    ? {
        ...result.data,
        provider: result.provider,
        model: result.model,
        raw: result.raw,
      }
    : null;
}

function buildTenderIntelligencePrompt(
  input: {
    project: ProjectContext;
    documentName: string;
    documentType: string;
    localSections: ParsedSection[];
  },
  documentText: string,
) {
  const localSectionHints = input.localSections
    .slice(0, 20)
    .map((section) => `${section.order}. ${section.title}`)
    .join("\n");

  return [
    `Project title: ${input.project.title}`,
    `Buyer/client: ${input.project.clientName}`,
    `Authority: ${input.project.authority ?? input.project.clientName}`,
    `Opportunity type: ${input.project.opportunityType}`,
    `Sector: ${input.project.sector}`,
    `Country: ${input.project.country}`,
    `Document: ${input.documentName}`,
    `Document type: ${input.documentType}`,
    input.project.deadline
      ? `Known deadline: ${input.project.deadline.toISOString()}`
      : null,
    input.project.summary ? `Project summary: ${input.project.summary}` : null,
    "",
    "Local section hints:",
    localSectionHints || "No section hints available.",
    "",
    "Tasks:",
    "1. Split the tender into meaningful procurement sections.",
    "2. Extract raw clauses. Clauses must be actual buyer instructions, rules, eligibility gates, evaluation rules, submission rules, commercial rules, legal declarations, or technical obligations.",
    "3. Convert clauses into checklist requirements only when the document clearly asks the bidder to do, submit, prove, provide, attach, comply with, or deliver something.",
    "4. Evidence needed should be concrete documents or proof items such as CAC certificate, tax clearance, audited accounts, bid security, CVs, methodology, pricing schedule, work plan, signed forms, declarations, or references.",
    "5. Mark risk and importance high for pass/fail, deadline, bid security, statutory eligibility, mandatory submission, and rejection/disqualification language.",
    "",
    "Tender text:",
    documentText,
  ]
    .filter((item): item is string => Boolean(item))
    .join("\n");
}

function normaliseSections(sections: Array<{ title: string; body: string; order?: number }>): ParsedSection[] {
  return sections
    .map((section, index) => ({
      title: section.title.trim().slice(0, 180) || `Section ${index + 1}`,
      body: section.body.trim(),
      order: section.order && section.order > 0 ? section.order : index + 1,
    }))
    .filter((section) => section.body.length > 20 || section.title.length > 4)
    .sort((a, b) => a.order - b.order)
    .map((section, index) => ({ ...section, order: index + 1 }))
    .slice(0, 40);
}

function normaliseClauses(clauses: z.infer<typeof tenderIntelligenceSchema>["clauses"]): TenderClauseExtraction[] {
  return clauses
    .map((clause, index) => ({
      title: clause.title.trim().slice(0, 180),
      originalText: clause.originalText.trim(),
      clauseType: clause.clauseType.trim().toLowerCase().slice(0, 80) || "instruction",
      importance: clause.importance,
      riskLevel: clause.riskLevel,
      confidence: clampConfidence(clause.confidence),
      actionsRequired: clause.actionsRequired.map((action) => action.trim()).filter(Boolean).slice(0, 6),
      parsedSectionOrder:
        clause.parsedSectionOrder && clause.parsedSectionOrder > 0
          ? clause.parsedSectionOrder
          : index + 1,
    }))
    .filter((clause) => clause.originalText.length >= 12)
    .slice(0, 100);
}

function normaliseRequirements(
  requirements: z.infer<typeof tenderIntelligenceSchema>["requirements"],
): ExtractedRequirement[] {
  return requirements
    .map((requirement) => ({
      title: requirement.title.trim().slice(0, 180),
      description: requirement.description.trim(),
      category: requirement.category,
      sourceClause: requirement.sourceClause?.trim() || null,
      priority: requirement.priority,
      confidence: clampConfidence(requirement.confidence),
      evidenceNeeded: requirement.evidenceNeeded.map((item) => item.trim()).filter(Boolean).slice(0, 8),
    }))
    .filter((requirement) => requirement.title && requirement.description)
    .slice(0, 140);
}

function clampConfidence(value: number) {
  return Math.min(0.99, Math.max(0.35, value));
}
