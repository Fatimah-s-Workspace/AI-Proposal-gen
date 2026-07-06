import { defaultProposalSections } from "@/features/projects/default-sections";
import {
  clauseExtractionToExplanation,
  extractRequirementsFromClauses,
  extractTenderClausesFromSections,
} from "@/features/tender-intelligence/pipeline";
import type {
  ClauseExplanation,
  ComplianceAnalysis,
  ExtractedRequirement,
  ParsedSection,
  ProposalDraft,
} from "./types";

type ProjectContext = {
  title: string;
  clientName: string;
  opportunityType: string;
  sector: string;
  country: string;
  authority?: string | null;
  summary?: string | null;
};

const nigeriaEvidence = [
  "CAC certificate and status report",
  "Tax Identification Number and current tax clearance",
  "Audited financial statements for the last three years",
  "PENCOM, ITF, NSITF, or BPP evidence where applicable",
];

export async function extractRequirementsFromTender(input: {
  project: ProjectContext;
  text: string;
  sections: ParsedSection[];
}): Promise<ExtractedRequirement[]> {
  const extractedClauses = extractTenderClausesFromSections(input.sections);
  const requirementsFromClauses = extractRequirementsFromClauses(extractedClauses);
  if (requirementsFromClauses.length) return requirementsFromClauses;

  const source = input.sections.length
    ? input.sections
    : [{ title: "Tender instructions", body: input.text, order: 1 }];
  const hasBidSecurity =
    /bid security|bank guarantee|tender security|emd/i.test(input.text);
  const hasTax = /tax clearance|tin|firs|revenue/i.test(input.text);
  const hasExperience =
    /similar assignment|past performance|experience|portfolio/i.test(
      input.text,
    );

  const base: ExtractedRequirement[] = [
    {
      title: "Company eligibility documentation",
      description:
        "Provide statutory business documents proving registration, tax standing, and ability to contract in the stated jurisdiction.",
      category: "mandatory",
      sourceClause: source[0]?.title ?? "Eligibility",
      priority: "high",
      confidence: 0.96,
      evidenceNeeded: nigeriaEvidence,
    },
    {
      title: "Signed technical proposal",
      description:
        "Submit a complete technical response covering understanding of scope, methodology, work plan, team structure, and quality controls.",
      category: "technical",
      sourceClause:
        source.find((section) => /scope|technical|terms/i.test(section.title))
          ?.title ?? "Technical requirements",
      priority: "high",
      confidence: 0.94,
      evidenceNeeded: [
        "Methodology",
        "Work plan",
        "CVs of key personnel",
        "Quality assurance process",
      ],
    },
    {
      title: "Financial/commercial proposal",
      description:
        "Prepare a priced commercial offer with assumptions, applicable taxes, validity period, payment milestones, and currency.",
      category: "financial",
      sourceClause:
        source.find((section) =>
          /financial|commercial|price/i.test(section.title),
        )?.title ?? "Commercial requirements",
      priority: "high",
      confidence: 0.92,
      evidenceNeeded: [
        "Bill of quantities or pricing schedule",
        "Tax assumptions",
        "Payment terms",
      ],
    },
    {
      title: "Submission format and deadline compliance",
      description:
        "Follow the required submission channel, file format, envelope labelling, signatory rules, and deadline exactly.",
      category: "mandatory",
      sourceClause:
        source.find((section) =>
          /submission|deadline|instruction/i.test(section.title),
        )?.title ?? "Submission instructions",
      priority: "high",
      confidence: 0.9,
      evidenceNeeded: [
        "Submission checklist",
        "Authorised signatory",
        "Deadline confirmation",
      ],
    },
    {
      title: "Conflict of interest declaration",
      description:
        "Disclose relationships, conflicts, sanctions exposure, and anti-corruption commitments relevant to the procuring entity.",
      category: "optional",
      sourceClause: "General conditions",
      priority: "medium",
      confidence: 0.78,
      evidenceNeeded: [
        "Conflict declaration",
        "Anti-bribery undertaking",
        "Beneficial ownership declaration",
      ],
    },
  ];

  if (hasBidSecurity) {
    base.push({
      title: "Bid security or bank guarantee",
      description:
        "Attach the requested bid security in the specified amount, format, issuing bank grade, and validity period.",
      category: "financial",
      sourceClause:
        source.find((section) => /security|guarantee|bond/i.test(section.body))
          ?.title ?? "Bid security",
      priority: "high",
      confidence: 0.92,
      evidenceNeeded: [
        "Bank guarantee",
        "Validity confirmation",
        "Authorised bank signatory",
      ],
    });
  }

  if (hasTax) {
    base.push({
      title: "Current tax clearance evidence",
      description:
        "Include current tax documentation aligned with the issuer's jurisdiction and beneficiary company name.",
      category: "mandatory",
      sourceClause: "Eligibility documents",
      priority: "high",
      confidence: 0.93,
      evidenceNeeded: [
        "Tax clearance certificate",
        "TIN certificate",
        "VAT registration where relevant",
      ],
    });
  }

  if (hasExperience) {
    base.push({
      title: "Relevant project experience",
      description:
        "Show similar assignments in Nigeria or comparable African markets, including client, scope, year, contract value, and outcomes.",
      category: "optional",
      sourceClause: "Experience requirements",
      priority: "medium",
      confidence: 0.84,
      evidenceNeeded: [
        "Project references",
        "Completion certificates",
        "Client contact details",
      ],
    });
  }

  return base.slice(0, 9);
}

export async function explainClauses(input: {
  text: string;
  sections: ParsedSection[];
}): Promise<ClauseExplanation[]> {
  const extractedClauses = extractTenderClausesFromSections(input.sections);
  if (extractedClauses.length) {
    return extractedClauses.slice(0, 20).map(clauseExtractionToExplanation);
  }

  const candidateSections = input.sections.slice(0, 5);
  const fallback = [
    {
      title: "Bid validity",
      body: "The proposal must remain valid for the stated period after submission.",
    },
    {
      title: "Late submissions",
      body: "Documents received after the deadline may be rejected without evaluation.",
    },
    {
      title: "Evaluation method",
      body: "The buyer will score technical quality, responsiveness, experience, and commercial price.",
    },
  ];

  return (candidateSections.length ? candidateSections : fallback).map(
    (section, index) => ({
      clause: section.title,
      plainEnglish:
        index === 0
          ? "This is a gatekeeping clause. Treat it as mandatory and gather the evidence before drafting the narrative."
          : "This clause affects how reviewers judge responsiveness. Mirror its wording in the proposal and cite supporting evidence.",
      riskLevel: index === 0 ? "high" : index === 1 ? "medium" : "low",
      action:
        index === 0
          ? "Add it to the compliance checklist and assign an owner."
          : "Reference this clause in the relevant proposal section and keep proof files ready.",
    }),
  );
}

export async function generateProposalDraft(input: {
  project: ProjectContext;
  requirements: ExtractedRequirement[];
  sectionSlug?: string;
  tone?: "formal" | "confident" | "technical" | "ngo";
}): Promise<ProposalDraft[]> {
  const sections = defaultProposalSections.filter(
    (section) => !input.sectionSlug || section.slug === input.sectionSlug,
  );
  const requirementLine = input.requirements
    .slice(0, 4)
    .map((requirement) => requirement.title.toLowerCase())
    .join(", ");
  const countryContext = input.project.country || "Nigeria";
  const authority = input.project.authority || input.project.clientName;

  return sections.map((section) => ({
    slug: section.slug,
    title: section.title,
    rationale: `Generated locally using mocked AI context from ${input.requirements.length} extracted requirements.`,
    content: `<h2>${section.title}</h2>
<p>${input.project.clientName} requires a responsive ${input.project.opportunityType.toLowerCase()} for ${input.project.title}. TenderFlow AI has prepared this draft to align with ${authority}'s evaluation priorities, statutory requirements, and delivery realities across ${countryContext} and comparable African markets.</p>
<p>Our response addresses the key compliance themes identified from the uploaded document, including ${requirementLine || "eligibility, technical approach, submission format, and evidence readiness"}. The proposal will be strengthened with organisation-specific credentials, signed declarations, pricing assumptions, and project references before final submission.</p>
<p>For this section, the recommended tone is ${input.tone ?? "formal"}: precise, evidence-led, and easy for an evaluation committee to score against the stated criteria.</p>`,
  }));
}

export async function analyseCompliance(input: {
  requirements: Array<{ title: string; status: string; priority: string }>;
}): Promise<ComplianceAnalysis> {
  const total = Math.max(input.requirements.length, 1);
  const met = input.requirements.filter(
    (requirement) => requirement.status === "met" || requirement.status === "waiver",
  ).length;
  const blocked = input.requirements.filter(
    (requirement) => requirement.status === "blocked",
  ).length;
  const score = Math.round((met / total) * 100);

  return {
    score,
    summary:
      score > 75
        ? "The submission is close to compliant. Review high-priority evidence and final formatting before export."
        : "Several mandatory items still need attention before this proposal should be submitted.",
    gaps: input.requirements
      .filter((requirement) => requirement.status !== "met" && requirement.status !== "waiver")
      .slice(0, 5)
      .map((requirement) => ({
        requirement: requirement.title,
        severity:
          requirement.priority === "high" || blocked > 0 ? "high" : "medium",
        recommendation:
          "Assign an owner, attach evidence, and mirror the tender wording in the compliance matrix.",
      })),
  };
}
