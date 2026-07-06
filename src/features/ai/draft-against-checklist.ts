import type {
  ClauseExplanation,
  DraftAgainstChecklistResult,
  ExtractedRequirement,
  ParsedSection,
  ProposalDraft,
  QualityIssue,
  QualityReviewSummary,
  RequirementCoverage,
  RequirementMappingResult,
  SectionComplianceMetrics,
} from "./types";

export type ProjectContext = {
  title: string;
  clientName: string;
  opportunityType: string;
  sector: string;
  country: string;
  authority?: string | null;
  deadline?: Date;
  budgetRange?: string;
  summary?: string | null;
};

export type CompanyProfile = {
  companyName: string;
  registeredSince: number;
  employees: number;
  coreCapabilities: string[];
  relevantMarkets: string[];
  certifications: string[];
  trackRecord: string;
};

export type TenderDocumentSummary = {
  id: string;
  originalName: string;
  documentType: string;
  isPrimary: boolean;
  version: number;
};

export type DraftAgainstChecklistInput = {
  project: ProjectContext;
  requirements: ExtractedRequirement[];
  parsedSections: ParsedSection[];
  clauses: ClauseExplanation[];
  documents: TenderDocumentSummary[];
  companyProfile: CompanyProfile;
};

const sectionDefinitions = [
  { type: "executive-summary", title: "Executive Summary" },
  { type: "company-profile", title: "Company Profile" },
  { type: "technical-approach", title: "Technical Approach" },
  { type: "methodology", title: "Methodology" },
  { type: "implementation-plan", title: "Implementation Plan" },
  { type: "risk-management", title: "Risk Management" },
  { type: "experience", title: "Experience Section" },
  { type: "conclusion", title: "Conclusion" },
];

const genericPhrases = [
  "committed to excellence",
  "highly qualified",
  "industry-leading",
  "best-in-class",
  "world-class",
  "customer-centric",
  "tailored solutions",
  "proven track record",
  "robust approach",
];

const weakStatements = [
  "we are committed",
  "we are confident",
  "we are well positioned",
  "we are prepared",
  "we aim to",
  "we believe",
  "our team is capable",
  "our organization is experienced",
];

const requirementCategoryMapping: Record<
  ExtractedRequirement["category"],
  string[]
> = {
  mandatory: ["executive-summary", "company-profile", "implementation-plan"],
  technical: ["technical-approach", "methodology", "risk-management"],
  financial: ["company-profile", "implementation-plan", "conclusion"],
  submission: ["implementation-plan", "executive-summary", "conclusion"],
  legal: ["company-profile", "risk-management", "conclusion"],
  experience: ["experience", "company-profile", "technical-approach"],
  optional: ["experience", "executive-summary", "conclusion"],
};

export class DraftAgainstChecklistService {
  static async generate(
    input: DraftAgainstChecklistInput,
  ): Promise<DraftAgainstChecklistResult> {
    const requirements = this.categorizeRequirements(input.requirements);
    const mappings = this.mapRequirementsToSections(requirements);
    const draftSections = this.generateDraftSections(input);
    const coverage = this.evaluateCoverage(requirements, draftSections);
    const sectionMetrics = this.calculateSectionMetrics(
      requirements,
      mappings,
      coverage,
      draftSections,
    );
    const complianceScores = this.scoreCompliance(requirements, coverage);
    const qualityReview = this.reviewProposalQuality(draftSections);
    const recommendations = this.compileRecommendations(
      coverage,
      qualityReview,
    );

    return {
      mappings,
      draftSections,
      coverage,
      sectionMetrics,
      complianceScores,
      qualityReview,
      recommendations,
    };
  }

  static categorizeRequirements(requirements: ExtractedRequirement[]) {
    return requirements.map((requirement) => {
      const category = requirement.category || this.detectCategory(requirement);
      return { ...requirement, category };
    });
  }

  private static detectCategory(
    requirement: ExtractedRequirement,
  ): ExtractedRequirement["category"] {
    const text =
      `${requirement.title} ${requirement.description}`.toLowerCase();
    if (
      /(bid security|financial|commercial|payment|tax|price|budget|fee)/i.test(
        text,
      )
    ) {
      return "financial";
    }
    if (
      /(technical|methodology|scope|service delivery|implementation|quality|risk|team|experience)/i.test(
        text,
      )
    ) {
      return "technical";
    }
    if (
      /(optional|disclose|declaration|conflict|sustainability|social|environment)/i.test(
        text,
      )
    ) {
      return "optional";
    }
    return "mandatory";
  }

  static mapRequirementsToSections(
    requirements: ExtractedRequirement[],
  ): RequirementMappingResult[] {
    return requirements.map((requirement) => {
      const score = this.scoreMapping(requirement);
      const sectionType = this.pickSectionForRequirement(requirement);
      return {
        requirementId: requirement.id ?? this.requirementKey(requirement),
        proposalSectionType: sectionType,
        mappingStrength:
          score >= 8 ? "strong" : score >= 5 ? "moderate" : "weak",
        status: score > 0 ? "mapped" : "unmapped",
        notes: `Mapped requirement to ${sectionType.replace(/-/g, " ")} based on requirement keywords and expected tender response structure.`,
      };
    });
  }

  private static scoreMapping(requirement: ExtractedRequirement) {
    const title = requirement.title.toLowerCase();
    const description = requirement.description.toLowerCase();
    let score = 0;

    if (
      /experience|similar projects|past performance|references/.test(
        title + description,
      )
    )
      score += 4;
    if (
      /technical|methodology|scope|deliver|approach/.test(title + description)
    )
      score += 4;
    if (/risk|mitigation|contingency/.test(title + description)) score += 4;
    if (/timeline|schedule|milestone|plan/.test(title + description))
      score += 4;
    if (/financial|commercial|price|tax|payment/.test(title + description))
      score += 3;
    if (
      /company profile|organisation|company background|capacity/.test(
        title + description,
      )
    )
      score += 3;

    return score;
  }

  private static pickSectionForRequirement(requirement: ExtractedRequirement) {
    const title = requirement.title.toLowerCase();
    const description = requirement.description.toLowerCase();

    for (const [category, sections] of Object.entries(
      requirementCategoryMapping,
    )) {
      if (requirement.category === category) {
        return sections[0];
      }
    }

    if (/experience|similar projects|references/.test(title + description))
      return "experience";
    if (/risk|mitigation|contingency|issue/.test(title + description))
      return "risk-management";
    if (/timeline|schedule|milestone|plan/.test(title + description))
      return "implementation-plan";
    if (/technical|methodology|approach|scope/.test(title + description))
      return "technical-approach";
    if (/financial|commercial|price|tax|payment/.test(title + description))
      return "company-profile";
    return "executive-summary";
  }

  private static requirementKey(requirement: ExtractedRequirement) {
    return requirement.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80);
  }

  static generateDraftSections(
    input: DraftAgainstChecklistInput,
  ): ProposalDraft[] {
    return sectionDefinitions.map((definition) => ({
      slug: definition.type,
      title: definition.title,
      rationale: this.buildRationale(
        definition,
        input.requirements,
        input.project,
        input.companyProfile,
      ),
      content: this.buildSectionContent(definition, input),
    }));
  }

  private static buildRationale(
    definition: { type: string; title: string },
    requirements: ExtractedRequirement[],
    project: ProjectContext,
    companyProfile: CompanyProfile,
  ) {
    const mappedRequirements = requirements
      .filter(
        (requirement) =>
          this.pickSectionForRequirement(requirement) === definition.type,
      )
      .map((requirement) => `• ${requirement.title}`)
      .join("\n");

    return mappedRequirements
      ? `This ${definition.title.toLowerCase()} draft for ${project.clientName} is centered on ${requirementCategoryMapping[requirements.find((req) => this.pickSectionForRequirement(req) === definition.type)?.category ?? "mandatory"]?.[0] || definition.title.toLowerCase()} and uses ${companyProfile.companyName}'s profile as the bidder context. It directly references the following checklist items:\n${mappedRequirements}`
      : `This draft section is prepared for ${project.clientName} to support the overall proposal response and reflect procurement expectations for ${definition.title.toLowerCase()} using ${companyProfile.companyName}'s bidder context.`;
  }

  private static buildSectionContent(
    definition: { type: string; title: string },
    input: DraftAgainstChecklistInput,
  ) {
    const requirements = input.requirements;
    const requirementBullets = requirements
      .filter(
        (requirement) =>
          this.pickSectionForRequirement(requirement) === definition.type,
      )
      .slice(0, 4)
      .map(
        (requirement) => `- ${requirement.title}: ${requirement.description}`,
      )
      .join("\n");

    const primaryDocument =
      input.documents.find((doc) => doc.isPrimary) ?? input.documents[0];
    const requirementHint =
      requirementBullets ||
      "- The proposal response must remain aligned with mandatory, technical and financial requirements from the tender.";
    const highlight = `The ${definition.title.toLowerCase()} is written for ${input.project.clientName} and references the tender requirements extracted from the project documents.`;

    return `## ${definition.title}

${highlight}

${definition.type === "executive-summary" ? `This executive summary frames the bidder's strengths against the most important checklist items, referencing mandatory requirements and competitive advantage.` : ""}

${definition.type === "company-profile" ? `Our company, ${input.companyProfile.companyName}, has operated in ${input.companyProfile.relevantMarkets.join(", ")} since ${input.companyProfile.registeredSince}. We maintain ${input.companyProfile.certifications.join(", ")} and a ${input.companyProfile.employees}-member team ready to deliver this opportunity.` : ""}

${definition.type === "technical-approach" ? `The technical approach explains how we will satisfy the technical and performance expectations defined in the tender, including reliability, compliance and integration.` : ""}

${definition.type === "methodology" ? `The methodology explains the phased delivery approach, quality gates and sign-off criteria that keep the project aligned with the tender's evaluation criteria.` : ""}

${definition.type === "implementation-plan" ? `The implementation plan presents a practical timeline of milestones, dependencies, and handover steps to ensure the submission meets the stated deadline and delivery expectations.` : ""}

${definition.type === "risk-management" ? `The risk management section identifies likely risks from the tender, assesses their impact, and sets out targeted mitigation steps to keep the proposal compliant.` : ""}

${definition.type === "experience" ? `The experience section highlights similar projects and measurable outcomes that prove our ability to satisfy the tender evaluation for past performance.` : ""}

${definition.type === "conclusion" ? `The conclusion summarizes compliance, commercial clarity, and the evidence-backed next steps to make the proposal easy to score and accept.` : ""}

${requirementHint}

${primaryDocument ? `Source document: ${primaryDocument.originalName} (${primaryDocument.documentType}).` : ""}

${input.companyProfile.trackRecord ? `We have completed ${input.companyProfile.trackRecord}.` : ""}

${definition.type === "experience" ? `Example outcome: Delivered similar projects for clients in ${input.companyProfile.relevantMarkets.join(", ")}, with measurable results and documented references.` : ""}`;
  }

  static evaluateCoverage(
    requirements: ExtractedRequirement[],
    draftSections: ProposalDraft[],
  ): RequirementCoverage[] {
    return requirements.map((requirement) => {
      const lowerTitle = requirement.title.toLowerCase();
      const lowerDescription = requirement.description.toLowerCase();
      const combined = draftSections
        .map((section) => section.content.toLowerCase())
        .join(" ");
      const mentionScore = [lowerTitle, lowerDescription].filter((text) =>
        combined.includes(text),
      ).length;
      const weakMatch = this.containsWeakLanguage(combined, requirement);

      if (mentionScore >= 2 && !weakMatch) {
        return {
          requirementId: requirement.title,
          title: requirement.title,
          status: "covered",
          reason:
            "The draft references the requirement clearly and connects it to proposal content.",
          recommendation:
            "Maintain this coverage and attach supporting evidence in the proposal appendix.",
        };
      }

      if (mentionScore > 0) {
        return {
          requirementId: requirement.title,
          title: requirement.title,
          status: "weak",
          reason:
            "The requirement is mentioned, but the draft lacks strength or evidence-specific language.",
          recommendation:
            "Add project-specific references, evidence, or measurable statements to strengthen the response.",
        };
      }

      return {
        requirementId: requirement.title,
        title: requirement.title,
        status: requirement.category === "mandatory" ? "blocked" : "missing",
        reason:
          "This requirement is not reflected clearly in the generated proposal content.",
        recommendation:
          "Update the relevant section to speak directly to this requirement and attach the required evidence.",
      };
    });
  }

  private static containsWeakLanguage(
    content: string,
    requirement: ExtractedRequirement,
  ) {
    const requirementWords =
      `${requirement.title} ${requirement.description}`.toLowerCase();
    return (
      weakStatements.some((phrase) => content.includes(phrase)) &&
      requirementWords.split(" ").some((word) => content.includes(word))
    );
  }

  static scoreCompliance(
    requirements: ExtractedRequirement[],
    coverage: RequirementCoverage[],
  ) {
    const total = Math.max(requirements.length, 1);
    const covered = coverage.filter((item) => item.status === "covered").length;
    const blocked = coverage.filter((item) => item.status === "blocked").length;
    const weak = coverage.filter((item) => item.status === "weak").length;
    const documentation = Math.max(0, 100 - blocked * 15 - weak * 5);
    const technical = Math.max(0, 100 - blocked * 12 - weak * 4);
    const completeness = Math.round((covered / total) * 100);
    const overall = Math.round(
      completeness * 0.55 +
        technical * 0.25 +
        documentation * 0.2 -
        blocked * 2,
    );

    return {
      overall: Math.min(100, Math.max(0, overall)),
      technical,
      completeness,
      documentation,
    };
  }

  static reviewProposalQuality(
    draftSections: ProposalDraft[],
  ): QualityReviewSummary {
    const combined = draftSections.map((section) => section.content).join(" ");
    const repeated = this.detectRepeatedPhrases(combined);
    const genericScore = this.detectGenericLanguage(combined);
    const weakScore = this.detectWeakStatements(combined);
    const qualityScore = Math.max(
      0,
      100 - repeated * 12 - genericScore * 10 - weakScore * 8,
    );
    const issues: QualityIssue[] = [];

    if (repeated >= 2) {
      issues.push({
        issueType: "repetitive wording",
        severity: repeated > 3 ? "major" : "minor",
        affectedText: "Repeated generic phrases detected across sections.",
        recommendation:
          "Replace repeated wording with section-specific, evidence-backed statements.",
      });
    }

    if (genericScore >= 2) {
      issues.push({
        issueType: "generic language",
        severity: genericScore > 3 ? "major" : "minor",
        affectedText: "The draft contains generic procurement language.",
        recommendation:
          "Use measurable outcomes and precise examples instead of broad marketing phrases.",
      });
    }

    if (weakScore >= 2) {
      issues.push({
        issueType: "weak statements",
        severity: weakScore > 3 ? "major" : "minor",
        affectedText: "Weak or unsupported claims detected.",
        recommendation:
          "Convert generic claims into concrete achievements and evidence statements.",
      });
    }

    return {
      qualityScore: Math.min(100, Math.max(0, qualityScore)),
      repetitivenessScore: repeated * 10,
      genericLanguageScore: genericScore * 10,
      weakStatementScore: weakScore * 10,
      recommendations: issues.map((issue) => issue.recommendation),
      issues,
    };
  }

  private static detectRepeatedPhrases(content: string) {
    const lower = content.toLowerCase();
    return genericPhrases.reduce((count, phrase) => {
      const matches = lower.match(new RegExp(phrase, "g"));
      return count + (matches ? matches.length - 1 : 0);
    }, 0);
  }

  private static detectGenericLanguage(content: string) {
    const lower = content.toLowerCase();
    return genericPhrases.reduce(
      (count, phrase) => count + (lower.includes(phrase) ? 1 : 0),
      0,
    );
  }

  private static detectWeakStatements(content: string) {
    const lower = content.toLowerCase();
    return weakStatements.reduce(
      (count, phrase) => count + (lower.includes(phrase) ? 1 : 0),
      0,
    );
  }

  static compileRecommendations(
    coverage: RequirementCoverage[],
    review: QualityReviewSummary,
  ) {
    const base = coverage
      .filter((item) => item.status !== "covered")
      .map((item) => `${item.title}: ${item.recommendation}`);

    const reviewRecommendations = review.recommendations.length
      ? ["Quality improvements:", ...review.recommendations]
      : [];

    return [...base, ...reviewRecommendations].slice(0, 8);
  }

  static calculateSectionMetrics(
    requirements: ExtractedRequirement[],
    mappings: RequirementMappingResult[],
    coverage: RequirementCoverage[],
    draftSections: ProposalDraft[],
  ): SectionComplianceMetrics[] {
    return sectionDefinitions.map((sectionDef) => {
      const sectionMappings = mappings.filter(
        (m) => m.proposalSectionType === sectionDef.type,
      );
      const sectionRequirements = sectionMappings
        .map((mapping) =>
          requirements.find(
            (req) =>
              req.id === mapping.requirementId ||
              req.title === mapping.requirementId,
          ),
        )
        .filter(Boolean);

      const sectionCoverage = coverage.filter((cov) =>
        sectionRequirements.some(
          (req) =>
            req?.id === cov.requirementId || req?.title === cov.requirementId,
        ),
      );

      const covered = sectionCoverage.filter(
        (c) => c.status === "covered",
      ).length;
      const weak = sectionCoverage.filter((c) => c.status === "weak").length;
      const missing = sectionCoverage.filter(
        (c) => c.status === "missing" || c.status === "blocked",
      ).length;
      const total = sectionRequirements.length;

      const coveragePercent =
        total > 0 ? Math.round((covered / total) * 100) : 0;
      const complianceScore = Math.max(
        0,
        Math.min(100, coveragePercent - weak * 10 - missing * 20),
      );

      // Get quality issues specific to this section
      const sectionDraft = draftSections.find(
        (d) => d.slug === sectionDef.type,
      );
      const sectionQualityIssues: QualityIssue[] = [];

      if (sectionDraft) {
        const content = sectionDraft.content.toLowerCase();
        if (genericPhrases.some((phrase) => content.includes(phrase))) {
          sectionQualityIssues.push({
            issueType: "generic language",
            severity: "minor",
            affectedText: "Contains generic procurement phrases",
            recommendation: "Replace with specific, evidence-based language",
          });
        }
        if (weakStatements.some((phrase) => content.includes(phrase))) {
          sectionQualityIssues.push({
            issueType: "weak statements",
            severity: "minor",
            affectedText: "Contains unsupported claims",
            recommendation: "Add measurable outcomes and evidence",
          });
        }
      }

      return {
        sectionType: sectionDef.type,
        coverage: coveragePercent,
        missing,
        weak,
        strong: covered,
        complianceScore,
        qualityIssues: sectionQualityIssues,
        mappedRequirements: sectionRequirements
          .map((req) => req?.id || req?.title || "")
          .filter(Boolean),
      };
    });
  }
}
