import "dotenv/config";
import { prisma } from "@/server/db";
import { slugifyOrganizationName } from "@/lib/utils";

// Bridges the two-step organizationId migration:
// 20260807091040_add_organizations adds nullable organizationId columns;
// 20260807094550_require_organization_scoping drops the legacy userId
// columns (Project/Subscription/Payment/UsageTracking) and makes
// organizationId required.
//
// This script MUST run against a database that has migration 1 applied but
// NOT YET migration 2 - i.e. deploy migration 1, run this script, verify,
// THEN deploy migration 2. Never apply both migrations in the same deploy
// without running this in between, or existing rows will have no
// organizationId when migration 2 tries to make it required.
//
// Uses raw SQL for the legacy userId columns specifically, so this script
// keeps compiling (and keeps working, if ever re-run against a database
// still in the pre-migration-2 state) even after schema.prisma has moved on
// to the post-migration-2 shape locally, where those columns no longer
// exist in the generated Prisma Client's types.

type LegacyUserRow = { id: string; name: string | null; email: string; companyName: string | null };

async function main() {
  const users = await prisma.$queryRaw<LegacyUserRow[]>`
    SELECT u.id, u.name, u.email, u."companyName"
    FROM "User" u
    WHERE NOT EXISTS (SELECT 1 FROM "Membership" m WHERE m."userId" = u.id)
  `;

  console.log(`Found ${users.length} user(s) without an organization.`);

  for (const user of users) {
    const orgName = user.companyName || `${user.name || user.email}'s workspace`;

    await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: { name: orgName, slug: slugifyOrganizationName(orgName) },
      });

      await tx.membership.create({
        data: { userId: user.id, organizationId: organization.id, role: "owner" },
      });

      const [projects, subscriptions, payments, usageTracking, auditLogs] = await Promise.all([
        tx.$executeRaw`UPDATE "Project" SET "organizationId" = ${organization.id} WHERE "userId" = ${user.id} AND "organizationId" IS NULL`,
        tx.$executeRaw`UPDATE "Subscription" SET "organizationId" = ${organization.id} WHERE "userId" = ${user.id} AND "organizationId" IS NULL`,
        tx.$executeRaw`UPDATE "Payment" SET "organizationId" = ${organization.id}, "initiatedByUserId" = ${user.id} WHERE "userId" = ${user.id} AND "organizationId" IS NULL`,
        tx.$executeRaw`UPDATE "UsageTracking" SET "organizationId" = ${organization.id} WHERE "userId" = ${user.id} AND "organizationId" IS NULL`,
        tx.$executeRaw`UPDATE "AuditLog" SET "organizationId" = ${organization.id} WHERE "userId" = ${user.id} AND "organizationId" IS NULL`,
      ]);

      console.log(
        `✓ ${user.email} -> "${orgName}" (${organization.slug}): ` +
          `${projects} project(s), ${subscriptions} subscription(s), ` +
          `${payments} payment(s), ${usageTracking} usage row(s), ` +
          `${auditLogs} audit log(s).`,
      );
    });
  }

  console.log("Backfill complete.");
}

main()
  .catch((error) => {
    console.error("Backfill failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
