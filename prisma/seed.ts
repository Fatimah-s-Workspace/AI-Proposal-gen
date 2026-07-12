import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { defaultProposalSections } from "../src/features/projects/default-sections";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for seeding.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

async function main() {
  const password = await hash("password123", 12);

  const user = await prisma.user.upsert({
    where: { email: "demo@tenderflow.ai" },
    update: {},
    create: {
      name: "Fatimah Demo",
      email: "demo@tenderflow.ai",
      companyName: "TenderFlow Advisory",
      country: "Nigeria",
      hashedPassword: password,
      subscription: {
        create: {
          plan: "starter",
          status: "trialing",
          monthlyProposalLimit: 10,
          monthlyUploadLimit: 100,
        },
      },
      usageTracking: {
        create: {
          period: new Date().toISOString().slice(0, 7),
          uploads: 1,
          aiGenerations: 6,
          exports: 1,
          tokensUsed: 2450,
        },
      },
    },
    include: {
      projects: true,
    },
  });

  const existingProject = await prisma.project.findFirst({
    where: {
      userId: user.id,
      title: "Solar Mini-Grid Grant Proposal",
    },
  });

  if (existingProject) return;

  await prisma.project.create({
    data: {
      userId: user.id,
      title: "Solar Mini-Grid Grant Proposal",
      clientName: "Rural Electrification Agency",
      opportunityType: "Grant",
      sector: "Energy",
      country: "Nigeria",
      authority: "Federal procurement programme",
      deadline: new Date(Date.now() + 1000 * 60 * 60 * 24 * 21),
      budgetRange: "NGN 45m - 70m",
      status: "active",
      stage: "drafting",
      complianceScore: 42,
      summary:
        "Grant opportunity for renewable energy access, community engagement, technical delivery, and monitoring in underserved communities.",
      documents: {
        create: {
          filename: "demo-solar-grant-rfp.txt",
          originalName: "Demo Solar Grant RFP.txt",
          mimeType: "text/plain",
          size: 6200,
          storagePath: "seed/demo-solar-grant-rfp.txt",
          status: "processed",
          extractedText:
            "Eligibility Requirements\nApplicants must provide CAC registration, tax clearance, audited accounts, and evidence of similar assignments.\nTechnical Scope\nThe proposal must describe mini-grid design, installation, community operations, maintenance, and training.\nSubmission Instructions\nSubmit signed technical and financial proposals before the deadline.",
          sections: [
            {
              title: "Eligibility Requirements",
              body: "Applicants must provide CAC registration, tax clearance, audited accounts, and evidence of similar assignments.",
              order: 1,
            },
            {
              title: "Technical Scope",
              body: "The proposal must describe mini-grid design, installation, community operations, maintenance, and training.",
              order: 2,
            },
          ],
        },
      },
      requirements: {
        create: [
          {
            title: "Company eligibility documentation",
            description:
              "Provide CAC, tax clearance, audited financials, and statutory compliance documents.",
            category: "Eligibility",
            sourceClause: "Eligibility Requirements",
            priority: "high",
            status: "met",
            evidenceNeeded: [
              "CAC certificate",
              "Tax clearance",
              "Audited accounts",
            ],
          },
          {
            title: "Technical implementation plan",
            description:
              "Describe design, procurement, installation, commissioning, operations, and training.",
            category: "Technical",
            sourceClause: "Technical Scope",
            priority: "high",
            status: "in_progress",
            evidenceNeeded: ["Methodology", "Work plan", "Team CVs"],
          },
          {
            title: "Signed financial proposal",
            description:
              "Submit priced commercial response with assumptions, taxes, and payment milestones.",
            category: "Commercial",
            sourceClause: "Submission Instructions",
            priority: "high",
            status: "open",
            evidenceNeeded: ["Pricing schedule", "Tax assumptions"],
          },
        ],
      },
      proposalSections: {
        create: defaultProposalSections.map((section) => ({
          title: section.title,
          slug: section.slug,
          order: section.order,
          sectionType: section.slug,
          status:
            section.slug === "executive-summary" ? "drafting" : "not_started",
          prompt: section.prompt,
          content:
            section.slug === "executive-summary"
              ? "<h2>Executive Summary</h2><p>TenderFlow Advisory proposes a practical, community-centred approach to deliver a solar mini-grid programme for underserved communities. The response aligns statutory eligibility, technical delivery, and grant reporting expectations with a clear implementation plan.</p>"
              : null,
          wordTarget: section.wordTarget,
        })),
      },
      generatedContents: {
        create: {
          provider: "mock",
          contentType: "clause_explanations",
          output: JSON.stringify(
            [
              {
                clause: "Eligibility Requirements",
                plainEnglish:
                  "This is mandatory. The evaluator can reject the proposal if statutory documents are missing or expired.",
                riskLevel: "high",
                action:
                  "Confirm CAC, tax clearance, and audited accounts before export.",
              },
              {
                clause: "Technical Scope",
                plainEnglish:
                  "The proposal must show how the team will design, install, maintain, and hand over the mini-grid.",
                riskLevel: "medium",
                action:
                  "Mirror these workstreams in the technical approach and implementation plan.",
              },
            ],
            null,
            2,
          ),
        },
      },
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
