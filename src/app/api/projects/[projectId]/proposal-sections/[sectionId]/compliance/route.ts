import { prisma } from "@/server/db";
import { requireApiUser } from "@/server/session";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { unauthorized } from "@/server/responses";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string; sectionId: string }> },
) {
  const user = await requireApiUser();
  if (!user) return unauthorized();

  const { projectId, sectionId } = await params;
  const limit = await rateLimit(
    `ai:live-compliance:${user.id}:${projectId}`,
    30,
    60_000, // 30 requests per minute
  );
  if (!limit.allowed) return rateLimitResponse();

  const { content } = await request.json();

  if (!content || typeof content !== "string") {
    return Response.json({ error: "Content is required" }, { status: 400 });
  }

  // Get project context
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: user.organizationId },
    include: {
      requirements: true,
      proposalSections: {
        where: { id: sectionId },
        include: { generatedContents: true },
      },
    },
  });

  if (!project || !project.proposalSections[0]) {
    return Response.json({ error: "Section not found" }, { status: 404 });
  }

  const section = project.proposalSections[0];

  // Perform live compliance analysis
  const analysis = await analyzeLiveCompliance(content, section, project.requirements);

  return Response.json(analysis);
}

type LiveSection = {
  sectionType: string;
};

type LiveRequirement = {
  title: string;
  category: string;
  priority: string;
};

async function analyzeLiveCompliance(
  content: string,
  section: LiveSection,
  requirements: LiveRequirement[],
) {
  // Mock AI analysis - in real implementation, this would call an AI service
  const issues: Array<{
    type: "missing_requirement" | "weak_response" | "vague_wording";
    severity: "high" | "medium" | "low";
    message: string;
    suggestion: string;
    position?: { start: number; end: number };
  }> = [];

  // Check for missing requirements
  const sectionRequirements = requirements.filter((req) =>
    req.category === section.sectionType ||
    section.sectionType.includes(req.category) ||
    req.title.toLowerCase().includes(section.sectionType.replace(/-/g, " "))
  );

  for (const req of sectionRequirements) {
    const requirementWords = req.title.toLowerCase().split(/\s+/);
    const contentLower = content.toLowerCase();

    // Check if requirement is mentioned
    const mentioned = requirementWords.some((word: string) =>
      word.length > 3 && contentLower.includes(word)
    );

    if (!mentioned) {
      issues.push({
        type: "missing_requirement",
        severity: req.priority === "high" ? "high" : "medium",
        message: `Missing requirement: ${req.title}`,
        suggestion: `Add specific reference to ${req.title} and how you meet this requirement.`,
      });
    }
  }

  // Check for vague wording
  const vagueWords = [
    "good", "excellent", "best", "quality", "professional",
    "experienced", "competent", "reliable", "efficient", "effective"
  ];

  for (const word of vagueWords) {
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    let match;
    while ((match = regex.exec(content)) !== null) {
      // Check if it's not part of a more specific phrase
      const context = content.substring(Math.max(0, match.index - 20), match.index + match[0].length + 20);
      if (!/\b(specifically|particularly|demonstrated|proven|achieved|delivered|completed)\b/i.test(context)) {
        issues.push({
          type: "vague_wording",
          severity: "low",
          message: `Vague word: "${word}"`,
          suggestion: `Replace with specific evidence or measurable achievement.`,
          position: { start: match.index, end: match.index + match[0].length },
        });
      }
    }
  }

  // Check for weak responses (short paragraphs, lack of evidence)
  const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);

  for (const paragraph of paragraphs) {
    if (paragraph.length < 100) {
      issues.push({
        type: "weak_response",
        severity: "medium",
        message: "Short paragraph may indicate insufficient detail",
        suggestion: "Expand with specific examples, evidence, or detailed explanations.",
      });
    }

    // Check for lack of evidence words
    const evidenceWords = ["demonstrated", "achieved", "delivered", "completed", "proven", "certified"];
    const hasEvidence = evidenceWords.some(word => paragraph.toLowerCase().includes(word));

    if (!hasEvidence && paragraph.length > 200) {
      issues.push({
        type: "weak_response",
        severity: "low",
        message: "Paragraph lacks evidence or specific achievements",
        suggestion: "Add specific examples of past performance or measurable outcomes.",
      });
    }
  }

  // Calculate compliance score
  const complianceScore = Math.max(0, 100 - (issues.length * 5));

  return {
    complianceScore,
    issues: issues.slice(0, 10), // Limit to 10 issues
    wordCount: content.split(/\s+/).filter(word => word.length > 0).length,
    characterCount: content.length,
  };
}
