import type {
  ExtractedRequirement,
  ProposalDraft,
  QualityIssue,
  RequirementMappingResult,
  SectionComplianceMetrics,
} from "@/features/ai";

export type TenderProposalRequirement = Omit<
  ExtractedRequirement,
  "evidenceMatches" | "sourceClauseId"
> & {
  id: string;
  sourceClauseId?: string;
  status?: string;
  owner?: string | null;
  documentId?: string | null;
  evidenceMatches?: unknown;
};

export type TenderProposalClause = {
  id: string;
  documentId?: string | null;
  parsedSectionId?: string | null;
  title?: string | null;
  originalText: string;
  explanation?: string | null;
  clauseType?: string | null;
  importance?: string | null;
  riskLevel?: string | null;
  confidence?: number | null;
  actionsRequired?: unknown;
};

export type TenderProposalParsedSection = {
  id: string;
  documentId: string;
  documentName: string;
  documentType: string;
  isPrimary: boolean;
  title: string;
  body: string;
  order: number;
};

export type TenderProposalDocument = {
  id: string;
  originalName: string;
  documentType: string;
  isPrimary: boolean;
  version: number;
};

export type TenderProposalProject = {
  title: string;
  clientName: string;
  opportunityType: string;
  sector: string;
  country: string;
  authority?: string | null;
  deadline?: Date | null;
  budgetRange?: string | null;
  summary?: string | null;
};

export type TenderProposalSectionState = {
  id: string;
  title: string;
  slug: string;
  sectionType: string;
  order: number;
  content?: string | null;
  status?: string;
  wordTarget?: number;
};

export type TenderProposalContext = {
  project: TenderProposalProject;
  documents: TenderProposalDocument[];
  parsedSections: TenderProposalParsedSection[];
  clauses: TenderProposalClause[];
  requirements: TenderProposalRequirement[];
  existingSections?: TenderProposalSectionState[];
};

export type TenderProposalSectionPlan = {
  title: string;
  slug: string;
  sectionType: string;
  order: number;
  wordTarget: number;
  importance: "high" | "medium" | "low";
  prompt: string;
  rationale: string;
  requirementIds: string[];
  clauseIds: string[];
  sourceDocumentIds: string[];
  sourceSectionTitles: string[];
};

export type TenderProposalAssistantResult = {
  sectionPlan: TenderProposalSectionPlan[];
  mappings: RequirementMappingResult[];
  sectionMetrics: SectionComplianceMetrics[];
  coverage: Record<string, number>;
  complianceScores: Record<string, number>;
  qualityReview: {
    issues: Array<{
      type: string;
      severity: string;
      description: string;
      suggestion: string;
    }>;
    overallScore: number;
  };
  recommendations: string[];
};

type SectionBlueprint = {
  title: string;
  slug: string;
  order: number;
  wordTarget: number;
  always?: boolean;
  categories: ExtractedRequirement["category"][];
  clauseTypes: string[];
  keywords: RegExp[];
  prompt: string;
};

const sectionBlueprints: SectionBlueprint[] = [
  {
    title: "Executive Summary",
    slug: "executive-summary",
    order: 1,
    wordTarget: 360,
    always: true,
    categories: ["mandatory", "technical", "financial", "submission", "legal", "experience"],
    clauseTypes: [],
    keywords: [/evaluation/i, /scope/i, /eligib/i, /financial/i],
    prompt: "Summarise the bid position against the strongest tender drivers and mandatory gates.",
  },
  {
    title: "Understanding of Requirements",
    slug: "understanding-of-requirements",
    order: 2,
    wordTarget: 520,
    always: true,
    categories: ["mandatory", "technical", "submission", "legal"],
    clauseTypes: ["instruction", "evaluation", "technical"],
    keywords: [/scope/i, /objectives?/i, /terms of reference/i, /evaluation/i],
    prompt: "Explain the buyer's objectives, instructions, evaluation logic, and delivery constraints.",
  },
  {
    title: "Eligibility and Statutory Compliance",
    slug: "eligibility-and-statutory-compliance",
    order: 3,
    wordTarget: 430,
    categories: ["mandatory", "legal"],
    clauseTypes: ["eligibility", "legal"],
    keywords: [/eligib/i, /\bcac\b/i, /tax/i, /pencom/i, /itf/i, /nsitf/i, /registration/i],
    prompt: "Convert statutory and eligibility clauses into a concise compliance response and evidence list.",
  },
  {
    title: "Technical Approach",
    slug: "technical-approach",
    order: 4,
    wordTarget: 760,
    categories: ["technical"],
    clauseTypes: ["technical", "evaluation"],
    keywords: [/technical/i, /scope/i, /methodology/i, /deliverables?/i, /quality/i],
    prompt: "Draft the delivery approach from the extracted technical scope, deliverables, and evaluation criteria.",
  },
  {
    title: "Methodology and Work Plan",
    slug: "methodology-and-work-plan",
    order: 5,
    wordTarget: 620,
    categories: ["technical", "submission"],
    clauseTypes: ["technical", "submission"],
    keywords: [/methodology/i, /work ?plan/i, /implementation/i, /timeline/i, /milestone/i],
    prompt: "Translate methodology, work plan, milestones, and quality controls into an evaluator-friendly plan.",
  },
  {
    title: "Team and Relevant Experience",
    slug: "team-and-relevant-experience",
    order: 6,
    wordTarget: 520,
    categories: ["experience", "technical"],
    clauseTypes: ["experience", "technical"],
    keywords: [/experience/i, /similar assignment/i, /past performance/i, /\bcv\b/i, /key personnel/i],
    prompt: "Address team, personnel, CV, and similar-project requirements with evidence-backed placeholders.",
  },
  {
    title: "Commercial Response",
    slug: "commercial-response",
    order: 7,
    wordTarget: 420,
    categories: ["financial"],
    clauseTypes: ["financial"],
    keywords: [/financial/i, /commercial/i, /price/i, /pricing/i, /boq/i, /bid security/i, /bank guarantee/i],
    prompt: "Frame pricing, bid security, tax assumptions, payment milestones, and commercial compliance.",
  },
  {
    title: "Implementation, Reporting, and Handover",
    slug: "implementation-reporting-and-handover",
    order: 8,
    wordTarget: 560,
    categories: ["technical", "submission"],
    clauseTypes: ["technical", "submission"],
    keywords: [/implementation/i, /reporting/i, /handover/i, /training/i, /deadline/i, /submission/i],
    prompt: "Turn delivery, reporting, training, handover, and deadline instructions into an executable plan.",
  },
  {
    title: "Risk, Governance, and Declarations",
    slug: "risk-governance-and-declarations",
    order: 9,
    wordTarget: 440,
    categories: ["legal", "mandatory"],
    clauseTypes: ["legal", "submission"],
    keywords: [/risk/i, /conflict/i, /anti[-\s]?corruption/i, /fraud/i, /declaration/i, /sanction/i],
    prompt: "Address legal declarations, conflict rules, governance controls, and high-risk procurement clauses.",
  },
  {
    title: "Monitoring, Evaluation, and Learning",
    slug: "monitoring-evaluation-and-learning",
    order: 10,
    wordTarget: 420,
    categories: ["technical", "optional"],
    clauseTypes: ["evaluation", "technical"],
    keywords: [/monitoring/i, /\bm&e\b/i, /evaluation/i, /learning/i, /impact/i, /grant/i, /reporting/i],
    prompt: "For grant-style tenders, describe outcomes, indicators, reporting cadence, and learning loops.",
  },
  {
    title: "Compliance Matrix",
    slug: "compliance-matrix",
    order: 11,
    wordTarget: 500,
    always: true,
    categories: ["mandatory", "technical", "financial", "submission", "legal", "experience", "optional"],
    clauseTypes: [],
    keywords: [/requirement/i, /shall/i, /must/i, /submit/i],
    prompt: "Map extracted requirements to proposal response locations, owners, and supporting evidence.",
  },
];

export function buildTenderProposalPlan(
  context: TenderProposalContext,
): TenderProposalSectionPlan[] {
  const documentText = [
    context.project.opportunityType,
    context.project.summary,
    ...context.documents.map((document) => `${document.originalName} ${document.documentType}`),
    ...context.parsedSections.map((section) => `${section.title} ${section.body.slice(0, 300)}`),
  ]
    .filter(Boolean)
    .join("\n");

  const scored = sectionBlueprints
    .map((blueprint) => {
      const mappedRequirements = context.requirements.filter((requirement) =>
        mapsRequirementToBlueprint(requirement, blueprint),
      );
      const mappedClauses = context.clauses.filter((clause) =>
        mapsClauseToBlueprint(clause, blueprint),
      );
      const sourceSections = context.parsedSections.filter((section) =>
        blueprint.keywords.some((keyword) => keyword.test(`${section.title}\n${section.body}`)),
      );
      const keywordScore = blueprint.keywords.filter((keyword) =>
        keyword.test(documentText),
      ).length;
      const grantBoost =
        blueprint.slug === "monitoring-evaluation-and-learning" &&
        /grant|donor|impact|beneficiaries|monitoring|evaluation/i.test(documentText)
          ? 3
          : 0;
      const score =
        keywordScore +
        grantBoost +
        mappedRequirements.reduce((total, requirement) => total + priorityWeight(requirement.priority), 0) +
        mappedClauses.reduce((total, clause) => total + riskWeight(clause.riskLevel ?? clause.importance), 0);

      return {
        blueprint,
        score,
        mappedRequirements,
        mappedClauses,
        sourceSections,
      };
    })
    .filter((item) => item.blueprint.always || item.score >= 2 || item.mappedRequirements.length > 0)
    .sort((a, b) => a.blueprint.order - b.blueprint.order);

  return scored.map((item, index) => {
    const sourceDocumentIds = new Set<string>();
    for (const requirement of item.mappedRequirements) {
      if (requirement.documentId) sourceDocumentIds.add(requirement.documentId);
    }
    for (const clause of item.mappedClauses) {
      if (clause.documentId) sourceDocumentIds.add(clause.documentId);
    }
    for (const section of item.sourceSections) sourceDocumentIds.add(section.documentId);

    const importance = classifySectionImportance(item.score, item.mappedRequirements, item.mappedClauses);
    const sourceSectionTitles = [...new Set(item.sourceSections.map((section) => section.title))].slice(0, 5);
    const wordTarget = Math.min(
      item.blueprint.wordTarget + item.mappedRequirements.length * 45 + item.mappedClauses.length * 20,
      item.blueprint.slug === "compliance-matrix" ? 900 : 980,
    );

    return {
      title: item.blueprint.title,
      slug: item.blueprint.slug,
      sectionType: item.blueprint.slug,
      order: index + 1,
      wordTarget,
      importance,
      prompt: buildSectionPrompt(item.blueprint, item.mappedRequirements, item.mappedClauses, sourceSectionTitles),
      rationale: buildSectionRationale(item.blueprint, item.mappedRequirements, item.mappedClauses, sourceSectionTitles),
      requirementIds: item.mappedRequirements.map((requirement) => requirement.id),
      clauseIds: item.mappedClauses.map((clause) => clause.id),
      sourceDocumentIds: [...sourceDocumentIds],
      sourceSectionTitles,
    };
  });
}

export function generateTenderProposalDrafts(input: {
  context: TenderProposalContext;
  sectionSlug?: string;
  tone?: "formal" | "confident" | "technical" | "ngo";
  customPrompt?: string;
}): Array<ProposalDraft & { plan: TenderProposalSectionPlan }> {
  const plan = buildTenderProposalPlan(input.context).filter(
    (section) => !input.sectionSlug || section.slug === input.sectionSlug,
  );

  return plan.map((section) => ({
    slug: section.slug,
    title: section.title,
    rationale: section.rationale,
    content: buildSectionContent(input.context, section, input.tone, input.customPrompt),
    plan: section,
  }));
}

export function buildTenderProposalAssistant(
  context: TenderProposalContext,
): TenderProposalAssistantResult {
  const sectionPlan = buildTenderProposalPlan(context);
  const mappings = sectionPlan.flatMap((section) =>
    section.requirementIds.map((requirementId) => ({
      requirementId,
      proposalSectionType: section.slug,
      mappingStrength: section.importance === "high" ? "strong" : section.importance === "medium" ? "moderate" : "weak",
      status: "mapped",
      notes: `Mapped from extracted tender intelligence into ${section.title}.`,
    })),
  ) satisfies RequirementMappingResult[];

  const coverage: Record<string, number> = {};
  const complianceScores: Record<string, number> = {};
  const sectionMetrics = sectionPlan.map((section) => {
    const existing = context.existingSections?.find(
      (item) => item.slug === section.slug || item.sectionType === section.slug,
    );
    const content = stripHtml(existing?.content ?? "");
    const mappedRequirements = section.requirementIds
      .map((id) => context.requirements.find((requirement) => requirement.id === id))
      .filter((item): item is TenderProposalRequirement => Boolean(item));

    const strong = mappedRequirements.filter((requirement) => contentCoversRequirement(content, requirement, true)).length;
    const weak = mappedRequirements.filter(
      (requirement) =>
        !contentCoversRequirement(content, requirement, true) &&
        contentCoversRequirement(content, requirement, false),
    ).length;
    const missing = Math.max(0, mappedRequirements.length - strong - weak);
    const total = Math.max(mappedRequirements.length, 1);
    const sectionCoverage = Math.round(((strong + weak * 0.45) / total) * 100);
    const complianceScore = Math.max(
      0,
      Math.min(100, sectionCoverage - missing * 8 + (section.importance === "high" ? 0 : 6)),
    );
    const qualityIssues = qualityIssuesForContent(content, section, mappedRequirements);

    coverage[section.slug] = sectionCoverage;
    complianceScores[section.slug] = complianceScore;

    return {
      sectionType: section.slug,
      coverage: sectionCoverage,
      missing,
      weak,
      strong,
      complianceScore,
      qualityIssues,
      mappedRequirements: section.requirementIds,
    };
  });

  const allIssues = sectionMetrics.flatMap((metric) =>
    metric.qualityIssues.map((issue) => ({
      type: issue.issueType,
      severity: issue.severity,
      description: issue.affectedText,
      suggestion: issue.recommendation,
    })),
  );
  const overallScore =
    sectionMetrics.length > 0
      ? Math.round(sectionMetrics.reduce((total, metric) => total + metric.complianceScore, 0) / sectionMetrics.length)
      : 0;

  return {
    sectionPlan,
    mappings,
    sectionMetrics,
    coverage,
    complianceScores: {
      ...complianceScores,
      overall: overallScore,
    },
    qualityReview: {
      issues: allIssues,
      overallScore,
    },
    recommendations: buildAssistantRecommendations(context, sectionPlan, sectionMetrics),
  };
}

function mapsRequirementToBlueprint(
  requirement: TenderProposalRequirement,
  blueprint: SectionBlueprint,
) {
  if (blueprint.always && ["executive-summary", "compliance-matrix"].includes(blueprint.slug)) return true;
  const text = `${requirement.title}\n${requirement.description}\n${requirement.sourceClause}\n${requirement.evidenceNeeded.join(" ")}`;
  return (
    blueprint.categories.includes(requirement.category) ||
    blueprint.keywords.some((keyword) => keyword.test(text))
  );
}

function mapsClauseToBlueprint(clause: TenderProposalClause, blueprint: SectionBlueprint) {
  if (blueprint.slug === "executive-summary") {
    return clause.importance === "high" || clause.riskLevel === "high";
  }
  if (blueprint.slug === "compliance-matrix") return true;
  const type = clause.clauseType ?? "";
  const text = `${clause.title ?? ""}\n${clause.originalText}\n${clause.explanation ?? ""}`;
  return blueprint.clauseTypes.includes(type) || blueprint.keywords.some((keyword) => keyword.test(text));
}

function buildSectionPrompt(
  blueprint: SectionBlueprint,
  requirements: TenderProposalRequirement[],
  clauses: TenderProposalClause[],
  sourceSectionTitles: string[],
) {
  const drivers = requirements.slice(0, 5).map((requirement) => requirement.title);
  const clauseDrivers = clauses.slice(0, 3).map((clause) => clause.title || clause.originalText.slice(0, 90));
  return [
    blueprint.prompt,
    drivers.length ? `Priority requirements: ${drivers.join("; ")}.` : null,
    clauseDrivers.length ? `Relevant clauses: ${clauseDrivers.join("; ")}.` : null,
    sourceSectionTitles.length ? `Tender source sections: ${sourceSectionTitles.join("; ")}.` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

function buildSectionRationale(
  blueprint: SectionBlueprint,
  requirements: TenderProposalRequirement[],
  clauses: TenderProposalClause[],
  sourceSectionTitles: string[],
) {
  const highPriority = requirements.filter((requirement) => requirement.priority === "high").length;
  return `${blueprint.title} is included because the uploaded tender documents produced ${requirements.length} mapped requirement(s), ${clauses.length} related clause(s), and ${highPriority} high-priority compliance driver(s)${
    sourceSectionTitles.length ? ` from ${sourceSectionTitles.slice(0, 3).join(", ")}` : ""
  }.`;
}

function buildSectionContent(
  context: TenderProposalContext,
  section: TenderProposalSectionPlan,
  tone = "formal",
  customPrompt?: string,
) {
  const requirements = requirementsForSection(context, section);
  const clauses = clausesForSection(context, section);
  const requirementBullets = requirements.slice(0, 8).map((requirement) => {
    const evidence = requirement.evidenceNeeded.length
      ? ` Evidence: ${requirement.evidenceNeeded.join(", ")}.`
      : "";
    return `${requirement.title}: ${requirement.description}${evidence}`;
  });
  const clauseBullets = clauses
    .slice(0, 5)
    .map((clause) => `${clause.title || clause.originalText.slice(0, 90)}: ${clause.explanation || clause.originalText}`);

  if (section.slug === "compliance-matrix") {
    return complianceMatrixHtml(context, section, requirements);
  }

  const specificBody = specificSectionParagraphs(context, section, requirements);

  return [
    `<h2>${escapeHtml(section.title)}</h2>`,
    `<p>${escapeHtml(openingParagraph(context, section, requirements, tone))}</p>`,
    specificBody.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("\n"),
    requirementBullets.length
      ? `<h3>Tender requirements addressed</h3><ul>${requirementBullets.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
      : "",
    clauseBullets.length
      ? `<h3>Clause alignment</h3><ul>${clauseBullets.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
      : "",
    `<h3>Evidence and review notes</h3><ul>${evidenceNotes(requirements).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`,
    customPrompt ? `<p><strong>Additional instruction applied:</strong> ${escapeHtml(customPrompt)}</p>` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function openingParagraph(
  context: TenderProposalContext,
  section: TenderProposalSectionPlan,
  requirements: TenderProposalRequirement[],
  tone: string,
) {
  const buyer = context.project.clientName;
  const project = context.project.title;
  const authority = context.project.authority || buyer;
  const topRequirement = requirements[0]?.title;

  if (section.slug === "executive-summary") {
    return `We are pleased to submit this proposal to ${buyer} for ${project}. The response is organised to satisfy the mandatory submission instructions, demonstrate delivery capability, and make the evaluation committee's compliance review straightforward.`;
  }

  if (section.slug === "technical-approach") {
    return `Our technical approach for ${project} is built around the scope, performance expectations, and evaluation criteria issued by ${authority}. It sets out how the work will be delivered, controlled, reported, and evidenced.`;
  }

  if (section.slug === "commercial-response") {
    return `This commercial response follows the buyer's pricing, validity, tax, and submission instructions so that the financial offer can be evaluated without qualification or ambiguity.`;
  }

  if (section.slug === "compliance-matrix") {
    return `The compliance matrix tracks each tender requirement against the response location, supporting evidence, and current review status.`;
  }

  const focus = topRequirement ? `, with particular attention to ${topRequirement}` : "";
  return `This ${section.title.toLowerCase()} section responds directly to ${buyer}'s stated requirements for ${project}${focus}. The language is ${tone === "technical" ? "technical and evidence-led" : "clear, formal, and evaluator-ready"}.`;
}

function specificSectionParagraphs(
  context: TenderProposalContext,
  section: TenderProposalSectionPlan,
  requirements: TenderProposalRequirement[],
) {
  const buyer = context.project.clientName;
  const sector = context.project.sector;
  const authority = context.project.authority || buyer;
  const deadline = context.project.deadline
    ? new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(context.project.deadline)
    : "the stated tender deadline";
  const topRequirement = requirements[0]?.title ?? "the extracted tender requirements";

  switch (section.slug) {
    case "executive-summary":
      return [
        `Our response is structured around ${topRequirement} and the mandatory procurement instructions extracted from the tender documents.`,
        `For ${authority}, the proposal will demonstrate compliance first, then delivery credibility, with supporting evidence attached against each high-priority requirement.`,
      ];
    case "understanding-of-requirements":
      return [
        `${buyer} is asking for a response that proves understanding of the scope, evaluation criteria, submission rules, and evidence expectations.`,
        `The proposal should mirror the buyer's wording where it defines mandatory requirements, then translate those instructions into clear delivery commitments for ${sector}.`,
      ];
    case "eligibility-and-statutory-compliance":
      return [
        `This section confirms the bidding entity's statutory readiness and highlights documents that must be current, signed, and issued in the correct organisation name.`,
        `Any missing evidence should be treated as a submission blocker unless the team records a deliberate waiver with approval.`,
      ];
    case "technical-approach":
      return [
        `The technical response should be organised around the scope items and evaluation language extracted from the tender, with a clear method for each deliverable.`,
        `Each workstream should show inputs, activities, quality controls, outputs, and how the delivery team will report progress to ${buyer}.`,
      ];
    case "methodology-and-work-plan":
      return [
        `The methodology should convert tender instructions into sequenced phases, milestones, owners, and acceptance points.`,
        `The work plan should be realistic against ${deadline}, with internal review points before final submission or delivery handover.`,
      ];
    case "team-and-relevant-experience":
      return [
        `The experience response should match CVs, role descriptions, similar assignments, and completion evidence to the buyer's stated evaluation priorities.`,
        `Where the tender asks for similar projects, include sector, client type, contract value or scale, dates, outcomes, and named references where available.`,
      ];
    case "commercial-response":
      return [
        `The commercial section should follow the tender's pricing format, tax assumptions, bid security language, and payment milestone instructions exactly.`,
        `Commercial assumptions should be visible and conservative so the evaluator can reconcile price, scope, and compliance without ambiguity.`,
      ];
    case "implementation-reporting-and-handover":
      return [
        `Implementation should connect the technical method to schedule, governance, reporting cadence, training, and handover obligations from the tender.`,
        `Reporting should use the buyer's required channels and frequency, with escalation points for blockers and documentation gaps.`,
      ];
    case "risk-governance-and-declarations":
      return [
        `This section should make legal and governance commitments explicit, especially conflict of interest, anti-corruption, sanctions, and signature requirements.`,
        `High-risk clauses should become named controls in the proposal so reviewers can see how the bidder will prevent non-compliance.`,
      ];
    case "monitoring-evaluation-and-learning":
      return [
        `For a grant or donor-style opportunity, this section should define outputs, outcomes, indicators, data sources, review cadence, and learning feedback loops.`,
        `Monitoring language should connect impact reporting to the tender's beneficiary, sustainability, and accountability expectations.`,
      ];
    default:
      return [
        `This section should respond directly to the tender instructions mapped to it and avoid generic proposal language.`,
        `Use evidence-backed statements and keep every claim traceable to a requirement, clause, or supporting document.`,
      ];
  }
}

function complianceMatrixHtml(
  context: TenderProposalContext,
  section: TenderProposalSectionPlan,
  requirements: TenderProposalRequirement[],
) {
  const rows = requirements.length ? requirements : context.requirements.slice(0, 12);
  return `<h2>${escapeHtml(section.title)}</h2>
<p>The matrix below is generated from extracted tender requirements. Use it as the working control list before export.</p>
<table>
<thead><tr><th>Requirement</th><th>Source clause</th><th>Response location</th><th>Evidence</th><th>Status</th></tr></thead>
<tbody>
${rows
  .map(
    (requirement) =>
      `<tr><td>${escapeHtml(requirement.title)}</td><td>${escapeHtml(requirement.sourceClause || "Tender clause")}</td><td>${escapeHtml(sectionForRequirement(requirement))}</td><td>${escapeHtml(requirement.evidenceNeeded.join(", ") || "Evidence to confirm")}</td><td>${escapeHtml(requirement.status || "in_progress")}</td></tr>`,
  )
  .join("")}
</tbody>
</table>`;
}

function requirementsForSection(context: TenderProposalContext, section: TenderProposalSectionPlan) {
  return section.requirementIds
    .map((id) => context.requirements.find((requirement) => requirement.id === id))
    .filter((item): item is TenderProposalRequirement => Boolean(item));
}

function clausesForSection(context: TenderProposalContext, section: TenderProposalSectionPlan) {
  return section.clauseIds
    .map((id) => context.clauses.find((clause) => clause.id === id))
    .filter((item): item is TenderProposalClause => Boolean(item));
}

function evidenceNotes(requirements: TenderProposalRequirement[]) {
  const notes = requirements.flatMap((requirement) =>
    requirement.evidenceNeeded.map((evidence) => `${evidence} supports ${requirement.title}.`),
  );
  return notes.length
    ? [...new Set(notes)].slice(0, 8)
    : ["Attach supporting evidence for each mandatory requirement before final export."];
}

function buildAssistantRecommendations(
  context: TenderProposalContext,
  plan: TenderProposalSectionPlan[],
  metrics: SectionComplianceMetrics[],
) {
  const missingHigh = context.requirements
    .filter((requirement) => requirement.priority === "high" && requirement.status !== "met" && requirement.status !== "waiver")
    .slice(0, 4)
    .map((requirement) => `Resolve high-priority checklist item: ${requirement.title}.`);
  const weakSections = metrics
    .filter((metric) => metric.complianceScore < 65)
    .slice(0, 4)
    .map((metric) => {
      const section = plan.find((item) => item.slug === metric.sectionType);
      return `Improve ${section?.title ?? metric.sectionType}: ${metric.missing} missing and ${metric.weak} weak mapped requirement(s).`;
    });
  const missingEvidence = context.requirements
    .filter((requirement) => requirement.evidenceNeeded.length && !normaliseArray(requirement.evidenceMatches).length)
    .slice(0, 3)
    .map((requirement) => `Attach or upload evidence for ${requirement.title}.`);

  return [...missingHigh, ...weakSections, ...missingEvidence].slice(0, 10);
}

function qualityIssuesForContent(
  content: string,
  section: TenderProposalSectionPlan,
  requirements: TenderProposalRequirement[],
): QualityIssue[] {
  const issues: QualityIssue[] = [];
  if (!content.trim()) {
    issues.push({
      issueType: "empty section",
      severity: section.importance === "high" ? "major" : "minor",
      affectedText: `${section.title} has no drafted content.`,
      recommendation: "Generate this section from the tender intelligence before review.",
    });
  }
  const missingEvidenceLanguage = requirements.some((requirement) => requirement.evidenceNeeded.length) && !/evidence|attach|appendix|certificate|cv|tax|cac|financial/i.test(content);
  if (missingEvidenceLanguage) {
    issues.push({
      issueType: "evidence gap",
      severity: "major",
      affectedText: `${section.title} does not reference required supporting evidence.`,
      recommendation: "Add evidence references and appendix pointers for the mapped requirements.",
    });
  }
  if (/committed to excellence|world-class|best-in-class|highly qualified/i.test(content)) {
    issues.push({
      issueType: "generic language",
      severity: "minor",
      affectedText: "Generic proposal phrases detected.",
      recommendation: "Replace generic claims with requirement-specific delivery and evidence statements.",
    });
  }
  return issues;
}

function contentCoversRequirement(
  content: string,
  requirement: TenderProposalRequirement,
  strict: boolean,
) {
  const terms = [
    requirement.title,
    requirement.category,
    ...requirement.evidenceNeeded,
    ...requirement.title.split(/\s+/).filter((word) => word.length > 5).slice(0, 4),
  ]
    .map((value) => value.toLowerCase())
    .filter(Boolean);
  const hits = terms.filter((term) => content.toLowerCase().includes(term)).length;
  return strict ? hits >= Math.min(2, terms.length) : hits >= 1;
}

function sectionForRequirement(requirement: TenderProposalRequirement) {
  if (requirement.category === "financial") return "Commercial Response";
  if (requirement.category === "technical") return "Technical Approach";
  if (requirement.category === "submission") return "Implementation, Reporting, and Handover";
  if (requirement.category === "legal") return "Risk, Governance, and Declarations";
  if (requirement.category === "experience") return "Team and Relevant Experience";
  return "Eligibility and Statutory Compliance";
}

function classifySectionImportance(
  score: number,
  requirements: TenderProposalRequirement[],
  clauses: TenderProposalClause[],
): "high" | "medium" | "low" {
  if (
    score >= 7 ||
    requirements.some((requirement) => requirement.priority === "high") ||
    clauses.some((clause) => clause.riskLevel === "high" || clause.importance === "high")
  ) {
    return "high";
  }
  if (score >= 3 || requirements.some((requirement) => requirement.priority === "medium")) return "medium";
  return "low";
}

function priorityWeight(priority: string) {
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  return 1;
}

function riskWeight(risk?: string | null) {
  if (risk === "high") return 3;
  if (risk === "medium") return 2;
  return 1;
}

function normaliseArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
