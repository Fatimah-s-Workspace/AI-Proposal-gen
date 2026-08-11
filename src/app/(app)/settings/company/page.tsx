import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CompanyProfile } from "@/components/organization/company-profile";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/session";
import { canManageMembers } from "@/server/permissions";

export const metadata: Metadata = { title: "Company profile" };
export const dynamic = "force-dynamic";

export default async function CompanyProfilePage() {
  const user = await requireUser();

  const organization = await prisma.organization.findUnique({
    where: { id: user.organizationId },
    select: {
      name: true,
      legalName: true,
      registrationNumber: true,
      foundedYear: true,
      teamSize: true,
      profileSummary: true,
      capabilities: true,
      certifications: true,
      pastPerformance: true,
    },
  });

  if (!organization) notFound();

  const { name, ...profile } = organization;

  return (
    <CompanyProfile
      organizationId={user.organizationId}
      workspaceName={name}
      profile={profile}
      canEdit={canManageMembers(user.organizationRole)}
    />
  );
}
