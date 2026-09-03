import { prisma } from "@/server/db";
import { requireApiUser } from "@/server/session";
import { createProjectSchema } from "@/lib/validations";
import { defaultProposalSections } from "@/features/projects/default-sections";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { unauthorized } from "@/server/responses";

export async function GET() {
  const user = await requireApiUser();
  if (!user) return unauthorized();

  const projects = await prisma.project.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: {
        select: {
          documents: true,
          requirements: true,
          proposalSections: true,
        },
      },
    },
  });

  return Response.json({ projects });
}

export async function POST(request: Request) {
  const user = await requireApiUser();
  if (!user) return unauthorized();

  const limit = await rateLimit(`project:create:${user.id}`, 20, 60_000);
  if (!limit.allowed) return rateLimitResponse();

  const body = await request.json();
  const parsed = createProjectSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "Invalid project details", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const project = await prisma.project.create({
    data: {
      organizationId: user.organizationId,
      title: parsed.data.title,
      clientName: parsed.data.clientName,
      opportunityType: parsed.data.opportunityType,
      sector: parsed.data.sector,
      country: parsed.data.country,
      authority: parsed.data.authority || null,
      deadline: parsed.data.deadline ? new Date(parsed.data.deadline) : null,
      budgetRange: parsed.data.budgetRange || null,
      summary: parsed.data.summary || null,
      referenceNumber: parsed.data.referenceNumber || null,
      evaluationCriteria: parsed.data.evaluationCriteria || null,
      winThemes: parsed.data.winThemes || null,
      contractDuration: parsed.data.contractDuration || null,
      incumbent: parsed.data.incumbent || null,
      submissionLanguage: parsed.data.submissionLanguage,
      proposalSections: {
        create: defaultProposalSections,
      },
    },
    include: {
      proposalSections: true,
    },
  });

  return Response.json({ project }, { status: 201 });
}
