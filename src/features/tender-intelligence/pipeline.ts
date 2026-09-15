import type {
  ClauseExplanation,
  EvidenceMatch,
  ExtractedRequirement,
  ParsedSection,
  TenderClauseExtraction,
} from "@/features/ai";

const directivePattern =
  /(must|shall|required|requirement|mandatory|submit|provide|attach|include|eligible|eligibility|deadline|validity|bid security|bank guarantee|tax clearance|audited|cac|technical proposal|financial proposal|sealed|email|portal|late submission|evaluation|criteria|experience|similar assignment|cv|key personnel|conflict of interest|anti[-\s]?corruption|pencom|itf|nsitf|bpp|comply|compliance|adhere|follow|ensure|confirm|verify|check|validate|obtain|prepare|complete|submit|deliver|present|demonstrate|prove|evidence|documentation|certificate|license|permit|approval|authorization|qualification|capability|competence|expertise|track record|reference|testimonial|portfolio|case study|methodology|approach|strategy|plan|schedule|timeline|milestone|deliverable|output|result|outcome|performance|quality|standard|specification|requirement|condition|term|provision|clause|article|section|paragraph|item|point)/i;

const evidenceDictionary = [
  {
    type: "CAC registration",
    patterns: [/cac/i, /corporate affairs/i, /registration/i],
  },
  {
    type: "Tax clearance",
    patterns: [/tax clearance/i, /\btin\b/i, /firs/i, /vat/i],
  },
  {
    type: "Audited financial statements",
    patterns: [/audited/i, /financial statement/i, /accounts/i],
  },
  {
    type: "Bid security",
    patterns: [/bid security/i, /bank guarantee/i, /tender security/i, /bond/i],
  },
  {
    type: "Company profile",
    patterns: [/company profile/i, /corporate profile/i],
  },
  {
    type: "Project experience",
    patterns: [
      /experience/i,
      /similar assignment/i,
      /past performance/i,
      /completion certificate/i,
    ],
  },
  {
    type: "Key personnel CVs",
    patterns: [/\bcv\b/i, /curriculum vitae/i, /key personnel/i, /team lead/i],
  },
  {
    type: "Technical methodology",
    patterns: [
      /methodology/i,
      /technical approach/i,
      /work plan/i,
      /implementation plan/i,
    ],
  },
  {
    type: "Financial proposal",
    patterns: [
      /financial proposal/i,
      /commercial proposal/i,
      /price schedule/i,
      /boq/i,
    ],
  },
  {
    type: "Conflict declaration",
    patterns: [/conflict/i, /anti[-\s]?corruption/i, /declaration/i],
  },
];

/**
 * A stem is a directive line ending in a colon — "Bidders must submit the
 * following:", "The technical proposal must include:". The obligation belongs
 * to the list items underneath it, not to the stem itself.
 *
 * Without this, the extractor kept the stem (it carries "must") and dropped
 * every bullet beneath it (they carry no directive verb of their own), which is
 * exactly inverted: the stem is not a requirement and the bullets are.
 */
function isStem(text: string) {
  return text.trim().endsWith(":") && directivePattern.test(text);
}

export function extractTenderClausesFromSections(
  sections: ParsedSection[],
): TenderClauseExtraction[] {
  const clauses: TenderClauseExtraction[] = [];

  for (const section of sections) {
    const candidates = splitIntoClauseCandidates(section.body);

    // A section title can be the stem for its own body — parseTenderSections
    // splits "Financial proposals must:" out as the title, leaving the bullets
    // it governs alone in the body.
    let stem: string | null = isStem(section.title) ? section.title : null;

    for (const candidate of candidates) {
      if (isStem(candidate)) {
        stem = candidate;
        continue;
      }

      // Prose closes a list. Bullets in a tender pack are fragments, so a
      // candidate ending in a full stop is a sentence that stands on its own.
      if (stem && candidate.trim().endsWith(".")) stem = null;

      const inherited = stem !== null;
      if (!inherited && !directivePattern.test(candidate)) continue;

      // The stem carries how binding the item is, not what it is about. Risk,
      // confidence and actions read it so "Company Profile" inherits "must
      // submit"; classifyClause deliberately does not, because a stem like
      // "Bidders must submit the following:" contains "submit" and would type
      // every bullet under it as `submission` — turning CAC from mandatory and
      // Audited Financial Statements from financial into submission items.
      //
      // originalText stays the candidate alone: it has to remain verbatim
      // document text for clause attribution to hold.
      const contextText = stem ? `${stem}\n${candidate}` : candidate;

      const clauseType = classifyClause(candidate, section.title);
      const riskLevel = classifyRisk(contextText, clauseType);
      const importance = riskLevel;
      const actionsRequired = buildActions(contextText, clauseType);
      clauses.push({
        title: buildClauseTitle(candidate, section.title),
        originalText: candidate,
        clauseType,
        importance,
        riskLevel,
        confidence: scoreClauseConfidence(contextText),
        actionsRequired,
        parsedSectionOrder: section.order,
      });
    }
  }

  return dedupeByText(clauses).slice(0, 80);
}

export function explainTenderClause(
  clause:
    | TenderClauseExtraction
    | { originalText: string; clauseType?: string | null },
) {
  const type = clause.clauseType ?? classifyClause(clause.originalText, "");
  const riskLevel = classifyRisk(clause.originalText, type);
  const action =
    buildActions(clause.originalText, type)[0] ??
    "Assign an owner and confirm evidence before submission.";

  return {
    plainEnglish: buildPlainEnglishExplanation(clause.originalText, type),
    riskLevel,
    action,
  };
}

export function extractRequirementsFromClauses(
  clauses: Array<TenderClauseExtraction & { id?: string }>,
): ExtractedRequirement[] {
  return clauses
    .filter((clause) => shouldBecomeRequirement(clause))
    .map((clause) => {
      const evidenceNeeded = detectEvidenceNeeded(
        clause.originalText,
        clause.clauseType,
      );
      return {
        sourceClauseId: clause.id,
        title: buildRequirementTitle(clause),
        description: clause.originalText,
        category: mapClauseTypeToRequirementCategory(clause.clauseType),
        sourceClause: clause.title || clause.originalText.slice(0, 120),
        priority: clause.importance,
        confidence: Math.min(0.98, Math.max(0.55, clause.confidence - 0.03)),
        evidenceNeeded,
      };
    })
    .slice(0, 120);
}

export function detectEvidenceMatchesForRequirements(input: {
  requirements: Array<{
    id: string;
    title: string;
    description: string;
    evidenceNeeded: unknown;
  }>;
  evidenceDocument: {
    id: string;
    originalName: string;
    extractedText?: string | null;
  };
}) {
  const haystack = `${input.evidenceDocument.originalName}\n${input.evidenceDocument.extractedText ?? ""}`;
  const matches: Array<{ requirementId: string; match: EvidenceMatch }> = [];

  for (const requirement of input.requirements) {
    const evidenceNeeded = normaliseEvidenceList(requirement.evidenceNeeded);
    const requirementText = `${requirement.title}\n${requirement.description}\n${evidenceNeeded.join("\n")}`;
    let best: EvidenceMatch | null = null;

    for (const item of evidenceDictionary) {
      const requirementNeedsItem = item.patterns.some((pattern) =>
        pattern.test(requirementText),
      );
      const documentLooksLikeItem = item.patterns.some((pattern) =>
        pattern.test(haystack),
      );
      if (!requirementNeedsItem || !documentLooksLikeItem) continue;

      const confidence =
        item.patterns.filter((pattern) => pattern.test(haystack)).length > 1
          ? 0.86
          : 0.72;
      if (!best || confidence > best.confidence) {
        best = {
          documentId: input.evidenceDocument.id,
          fileName: input.evidenceDocument.originalName,
          detectedType: item.type,
          confidence,
          reason: `${input.evidenceDocument.originalName} appears to satisfy ${item.type}.`,
        };
      }
    }

    if (best) {
      matches.push({ requirementId: requirement.id, match: best });
    }
  }

  return matches;
}

export function mergeEvidenceMatches(
  existing: unknown,
  incoming: EvidenceMatch,
) {
  const current = Array.isArray(existing) ? (existing as EvidenceMatch[]) : [];
  const withoutDuplicate = current.filter(
    (match) =>
      !(
        match.documentId &&
        incoming.documentId &&
        match.documentId === incoming.documentId
      ),
  );
  return [...withoutDuplicate, incoming];
}

export function calculateChecklistScore(
  requirements: Array<{ status: string; priority: string }>,
) {
  if (!requirements.length) return 0;
  const weighted = requirements.reduce(
    (acc, requirement) => {
      const weight =
        requirement.priority === "high"
          ? 1.35
          : requirement.priority === "medium"
            ? 1
            : 0.75;
      const statusScore =
        requirement.status === "met"
          ? 1
          : requirement.status === "waiver"
            ? 0.85
            : requirement.status === "in_progress"
              ? 0.45
              : requirement.status === "blocked"
                ? 0
                : 0.25;
      return {
        score: acc.score + weight * statusScore,
        max: acc.max + weight,
      };
    },
    { score: 0, max: 0 },
  );
  return Math.round((weighted.score / Math.max(weighted.max, 1)) * 100);
}

export function clauseExtractionToExplanation(
  clause: TenderClauseExtraction,
): ClauseExplanation {
  const explanation = explainTenderClause(clause);
  return {
    clause: clause.originalText,
    title: clause.title,
    plainEnglish: explanation.plainEnglish,
    riskLevel: explanation.riskLevel,
    action: explanation.action,
    clauseType: clause.clauseType,
    confidence: clause.confidence,
  };
}

function splitIntoClauseCandidates(body: string) {
  const paragraphs = body
    .split(/\n+|(?<=\.)\s+(?=[A-Z0-9])/)
    .map((part) => part.replace(/^[-•*\d.)\s]+/, "").trim())
    .filter((part) => part.length >= 12);

  const merged: string[] = [];
  for (const paragraph of paragraphs) {
    if (paragraph.length > 420) {
      merged.push(
        ...paragraph
          .split(/;\s+|(?<=,)\s+(?=and\b|or\b|provided\b)/i)
          .map((part) => part.trim())
          .filter(Boolean),
      );
    } else {
      merged.push(paragraph);
    }
  }

  return merged.map((part) => part.slice(0, 900));
}

function classifyClause(text: string, sectionTitle: string) {
  const value = `${sectionTitle}\n${text}`;
  if (/deadline|submission|submit|portal|sealed|envelope|late/i.test(value))
    return "submission";
  if (
    /financial|commercial|price|pricing|boq|payment|bid security|bank guarantee|bond/i.test(
      value,
    )
  )
    return "financial";
  if (
    /technical|methodology|work plan|scope|implementation|quality|personnel|cv/i.test(
      value,
    )
  )
    return "technical";
  if (/cac|tax|pencom|itf|nsitf|bpp|registration|eligib/i.test(value))
    return "eligibility";
  if (
    /experience|similar assignment|past performance|completion certificate/i.test(
      value,
    )
  )
    return "experience";
  if (
    /conflict|anti[-\s]?corruption|fraud|sanction|legal|contract/i.test(value)
  )
    return "legal";
  if (/evaluation|criteria|score|responsive/i.test(value)) return "evaluation";
  return "instruction";
}

function classifyRisk(
  text: string,
  clauseType: string,
): "high" | "medium" | "low" {
  if (
    /must|shall|required|mandatory|disqualif|reject|late|deadline|bid security|bank guarantee/i.test(
      text,
    )
  )
    return "high";
  if (["submission", "financial", "eligibility", "legal"].includes(clauseType))
    return "high";
  if (["technical", "experience", "evaluation"].includes(clauseType))
    return "medium";
  return "low";
}

function scoreClauseConfidence(text: string) {
  let score = 0.58;
  if (/\b(must|shall|required|submit|provide|attach|include)\b/i.test(text))
    score += 0.22;
  if (
    /(deadline|eligib|technical|financial|tax|cac|bid security|experience)/i.test(
      text,
    )
  )
    score += 0.12;
  if (text.length > 80) score += 0.06;
  return Math.min(0.97, score);
}

function buildActions(text: string, clauseType: string) {
  const actions: string[] = [];
  if (/submit|provide|attach|include/i.test(text))
    actions.push(
      `Create a checklist item for this ${clauseType} instruction and attach the exact evidence requested by the buyer.`,
    );
  if (/deadline|late/i.test(text))
    actions.push(
      "Record the deadline, submission channel, and an internal cut-off at least one working day earlier.",
    );
  if (/bid security|bank guarantee|bond/i.test(text))
    actions.push(
      "Request the bid security or bank guarantee and verify amount, beneficiary, and validity period against the tender.",
    );
  if (/technical|methodology|work plan/i.test(text))
    actions.push(
      "Reflect this instruction in the technical approach with a named method, deliverable, and evidence reference.",
    );
  if (/financial|commercial|price|boq/i.test(text))
    actions.push(
      "Check that the commercial response follows the required pricing format, taxes, currency, and assumptions.",
    );
  if (/cac|tax|pencom|itf|nsitf|bpp/i.test(text))
    actions.push(
      "Verify statutory documents are current, readable, and issued in the bidding entity's legal name.",
    );
  if (!actions.length)
    actions.push(
      `Assign this ${clauseType} clause to the proposal owner for review.`,
    );
  return actions;
}

function buildClauseTitle(text: string, sectionTitle: string) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (sectionTitle && sectionTitle.toLowerCase() !== "tender overview") {
    return `${sectionTitle}: ${cleaned.slice(0, 70)}${cleaned.length > 70 ? "..." : ""}`;
  }
  return `${cleaned.slice(0, 84)}${cleaned.length > 84 ? "..." : ""}`;
}

function buildPlainEnglishExplanation(text: string, clauseType: string) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  const base = `The buyer is giving a ${clauseType} instruction: ${summariseClause(cleaned)}.`;
  if (/disqualif|reject|late|deadline/i.test(text)) {
    return `${base} Treat it as a pass/fail control because missing the timing, format, or submission rule can make the bid non-responsive.`;
  }
  if (/bid security|bank guarantee|bond/i.test(text)) {
    return `${base} This affects commercial compliance. The proposal team should confirm the security amount, issuer, beneficiary, and validity period before submission.`;
  }
  if (/cac|tax|pencom|itf|nsitf|bpp|registration|eligib/i.test(text)) {
    return `${base} This is an eligibility gate. The bidder should attach current statutory evidence and ensure the names match the bidding entity.`;
  }
  if (/technical|methodology|work plan|scope|deliverable/i.test(text)) {
    return `${base} This belongs in the technical response. The draft should show how the bidder will meet the instruction, not merely repeat it.`;
  }
  if (/financial|commercial|price|boq/i.test(text)) {
    return `${base} This belongs in the commercial response. Pricing should follow the buyer's format and clearly state assumptions, taxes, and exclusions.`;
  }
  if (/submit|provide|attach|include|must|shall|required/i.test(text)) {
    return `${base} Convert it into a checklist item, assign an owner, and attach the requested proof before export.`;
  }
  return `${base} Keep it visible in the compliance matrix so reviewers can confirm it has been addressed.`;
}

function summariseClause(text: string) {
  const firstSentence = text.split(/(?<=[.!?])\s+/)[0] || text;
  return firstSentence.length > 180
    ? `${firstSentence.slice(0, 177).trim()}...`
    : firstSentence;
}

function shouldBecomeRequirement(clause: TenderClauseExtraction) {
  return (
    clause.importance === "high" ||
    /must|shall|required|submit|provide|attach|include|eligible|deadline|financial proposal|technical proposal/i.test(
      clause.originalText,
    )
  );
}

function mapClauseTypeToRequirementCategory(
  clauseType: string,
): ExtractedRequirement["category"] {
  if (clauseType === "eligibility") return "mandatory";
  if (clauseType === "evaluation") return "technical";
  if (
    ["technical", "financial", "submission", "legal", "experience"].includes(
      clauseType,
    )
  ) {
    return clauseType as ExtractedRequirement["category"];
  }
  return "mandatory";
}

function buildRequirementTitle(clause: TenderClauseExtraction) {
  const evidence = detectEvidenceNeeded(
    clause.originalText,
    clause.clauseType,
  )[0];
  if (evidence) return evidence;
  const type =
    clause.clauseType.charAt(0).toUpperCase() + clause.clauseType.slice(1);
  return `${type} requirement: ${clause.originalText.replace(/\s+/g, " ").slice(0, 72)}${
    clause.originalText.length > 72 ? "..." : ""
  }`;
}

function detectEvidenceNeeded(text: string, clauseType: string) {
  const evidence = evidenceDictionary
    .filter((item) => item.patterns.some((pattern) => pattern.test(text)))
    .map((item) => item.type);

  if (/technical proposal/i.test(text) || clauseType === "technical")
    evidence.push("Technical methodology");
  if (
    /financial proposal|commercial proposal/i.test(text) ||
    clauseType === "financial"
  )
    evidence.push("Financial proposal");
  if (/deadline|submit/i.test(text) || clauseType === "submission")
    evidence.push("Submission checklist");

  return [...new Set(evidence)].slice(0, 6);
}

function normaliseEvidenceList(value: unknown) {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") return [value];
  return [];
}

// Shared normalisation used to detect duplicate clauses/requirements both
// within a single extraction batch and across documents already stored in a
// project (e.g. the same tender pack uploaded twice, or an addendum that
// repeats text from the main pack).
export function buildTextDedupeKey(text: string, maxLength = 120) {
  return text
    .toLowerCase()
    .replace(/\W+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function dedupeByText(clauses: TenderClauseExtraction[]) {
  const seen = new Set<string>();
  return clauses.filter((clause) => {
    const key = buildTextDedupeKey(clause.originalText, 120);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
