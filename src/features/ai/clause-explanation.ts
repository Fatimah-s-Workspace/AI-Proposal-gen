import { z } from "zod";

export const clauseExplanationSchema = z.object({
  summary: z.string(),
  importance: z.enum(["high", "medium", "low"]),
  actions: z.array(z.string()),
});

export type ClauseExplanation = z.infer<typeof clauseExplanationSchema>;

export interface ClauseExplanationRequest {
  clauseText: string;
  context?: string;
  projectType?: string;
}

export interface ClauseExplanationResponse {
  explanation: ClauseExplanation;
  confidence: number;
}

/**
 * Service for explaining procurement clauses in business-friendly terms
 */
export class ClauseExplanationService {
  /**
   * Explain a procurement clause
   */
  static async explainClause(
    request: ClauseExplanationRequest
  ): Promise<ClauseExplanationResponse> {
    const { clauseText } = request;

    try {
      // For now, return mock response - replace with actual AI call
      const mockResponse = await this.generateMockExplanation(clauseText);

      return {
        explanation: mockResponse,
        confidence: 0.85,
      };
    } catch (error) {
      console.error("Error explaining clause:", error);
      throw new Error("Failed to explain clause");
    }
  }

  /**
   * Build the prompt for clause explanation
   */
  private static buildExplanationPrompt(
    clauseText: string,
    context?: string,
    projectType?: string
  ): string {
    return `
You are an expert procurement consultant. Explain the following procurement clause in simple, business-friendly English.

CLAUSE TEXT:
${clauseText}

${context ? `CONTEXT: ${context}` : ""}

${projectType ? `PROJECT TYPE: ${projectType}` : ""}

Provide your response in the following JSON format:
{
  "summary": "A clear, concise explanation of what this clause means in practical terms",
  "importance": "high|medium|low - how critical this clause is for compliance",
  "actions": ["Specific action items required to comply with this clause"]
}

Focus on:
- What the clause requires in practical terms
- Why it matters for the business
- What specific actions need to be taken
- Any potential risks or implications
`;
  }

  /**
   * Generate mock explanation for development
   */
  private static async generateMockExplanation(
    clauseText: string
  ): Promise<ClauseExplanation> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Mock responses based on common clause patterns
    const lowerText = clauseText.toLowerCase();

    if (lowerText.includes("insurance") || lowerText.includes("liability")) {
      return {
        summary: "This clause requires the contractor to maintain appropriate insurance coverage to protect against financial losses from accidents, damages, or legal claims during the project.",
        importance: "high",
        actions: [
          "Obtain professional liability insurance with coverage limits specified",
          "Provide proof of insurance to the client before project start",
          "Maintain continuous coverage throughout the project duration",
          "Notify client immediately if insurance is cancelled or modified"
        ]
      };
    }

    if (lowerText.includes("deadline") || lowerText.includes("timeline") || lowerText.includes("schedule")) {
      return {
        summary: "This clause establishes strict timelines and deadlines for project deliverables and milestones, with potential penalties for delays.",
        importance: "high",
        actions: [
          "Create detailed project schedule with all milestones",
          "Identify critical path items that could impact deadlines",
          "Build buffer time into schedule for unexpected delays",
          "Set up regular progress monitoring and reporting"
        ]
      };
    }

    if (lowerText.includes("confidential") || lowerText.includes("proprietary")) {
      return {
        summary: "This clause protects sensitive information shared during the project and prevents unauthorized disclosure or use.",
        importance: "medium",
        actions: [
          "Identify what information is considered confidential",
          "Implement secure storage and access controls for sensitive data",
          "Train team members on confidentiality requirements",
          "Use non-disclosure agreements for subcontractors if needed"
        ]
      };
    }

    // Default response
    return {
      summary: "This clause outlines specific requirements and obligations that must be met during the project execution.",
      importance: "medium",
      actions: [
        "Review the clause carefully to understand all requirements",
        "Document how your company will meet these requirements",
        "Include compliance measures in your project plan",
        "Monitor compliance throughout the project"
      ]
    };
  }

  /**
   * Batch explain multiple clauses
   */
  static async explainClauses(
    requests: ClauseExplanationRequest[]
  ): Promise<ClauseExplanationResponse[]> {
    const results = await Promise.all(
      requests.map(request => this.explainClause(request))
    );
    return results;
  }
}
