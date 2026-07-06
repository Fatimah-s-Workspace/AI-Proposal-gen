export type ParsedSection = {
  id?: string;
  title: string;
  body: string;
  order: number;
};

export type ExtractedRequirement = {
  id?: string;
  sourceClauseId?: string;
  title: string;
  description: string;
  category:
    | "mandatory"
    | "technical"
    | "financial"
    | "submission"
    | "legal"
    | "experience"
    | "optional";
  sourceClause: string | null;
  priority: "high" | "medium" | "low";
  confidence: number;
  evidenceNeeded: string[];
  evidenceMatches?: EvidenceMatch[];
};

export type ClauseExplanation = {
  id?: string;
  clause: string;
  title?: string;
  plainEnglish: string;
  riskLevel: "high" | "medium" | "low";
  action: string;
  clauseType?: string;
  confidence?: number;
  sourceSectionTitle?: string;
};

export type TenderClauseExtraction = {
  title: string;
  originalText: string;
  clauseType: string;
  importance: "high" | "medium" | "low";
  riskLevel: "high" | "medium" | "low";
  confidence: number;
  actionsRequired: string[];
  parsedSectionOrder: number;
};

export type EvidenceMatch = {
  documentId?: string;
  fileName: string;
  detectedType: string;
  confidence: number;
  reason: string;
};

export type ComplianceAnalysis = {
  score: number;
  summary: string;
  gaps: Array<{
    requirement: string;
    severity: "high" | "medium" | "low";
    recommendation: string;
  }>;
};

export type ProposalDraft = {
  slug: string;
  title: string;
  content: string;
  rationale: string;
};

export type RequirementCoverage = {
  requirementId: string;
  title: string;
  status: "covered" | "weak" | "missing" | "blocked";
  reason: string;
  recommendation: string;
};

export type RequirementMappingResult = {
  requirementId: string;
  proposalSectionType: string;
  mappingStrength: "strong" | "moderate" | "weak";
  status: "mapped" | "unmapped";
  notes: string;
};

export type QualityIssue = {
  issueType: string;
  severity: "critical" | "major" | "minor";
  affectedText: string;
  recommendation: string;
};

export type QualityReviewSummary = {
  qualityScore: number;
  repetitivenessScore: number;
  genericLanguageScore: number;
  weakStatementScore: number;
  recommendations: string[];
  issues: QualityIssue[];
};

export type SectionComplianceMetrics = {
  sectionType: string;
  coverage: number; // percentage of requirements covered
  missing: number; // count of missing requirements
  weak: number; // count of weakly covered requirements
  strong: number; // count of strongly covered requirements
  complianceScore: number; // overall compliance score
  qualityIssues: QualityIssue[];
  mappedRequirements: string[]; // requirement IDs mapped to this section
};

export type DraftAgainstChecklistResult = {
  mappings: RequirementMappingResult[];
  draftSections: ProposalDraft[];
  coverage: RequirementCoverage[];
  sectionMetrics: SectionComplianceMetrics[];
  complianceScores: {
    overall: number;
    technical: number;
    completeness: number;
    documentation: number;
  };
  qualityReview: QualityReviewSummary;
  recommendations: string[];
};
