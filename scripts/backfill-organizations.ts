import "dotenv/config";
import { randomBytes } from "node:crypto";
import { prisma } from "@/server/db";
import { slugifyOrganizationName } from "@/lib/utils";

// Prisma's @default(cuid()) is generated client-side, so the column has no
// database default and a raw INSERT has to supply one. Only the shape
// matters - these are opaque identifiers.
function cuid() {
  return `c${randomBytes(16).toString("hex").slice(0, 24)}`;
}

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
// Everything here is raw SQL, for one reason: this script runs against a
// database that is deliberately behind the local schema, so the generated
// Prisma Client and the target database disagree about what columns exist.
// That cuts both ways. The legacy userId columns exist in the database but
// not in the client - and the company-profile columns added later exist in
// the client but not in the database, so a `prisma.organization.create()`
// here fails on the RETURNING clause listing columns that aren't there yet.
// Raw SQL is the only form that depends on neither side being current.
//
// Found the hard way running this against production, where Organization
// still had just id/name/slug/createdAt/updatedAt.

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

    const organizationId = cuid();
    const slug = slugifyOrganizationName(orgName);

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO "Organization" (id, name, slug, "createdAt", "updatedAt")
        VALUES (${organizationId}, ${orgName}, ${slug}, now(), now())
      `;

      await tx.$executeRaw`
        INSERT INTO "Membership" (id, "userId", "organizationId", role, "createdAt")
        VALUES (${cuid()}, ${user.id}, ${organizationId}, 'owner', now())
      `;

      const [projects, subscriptions, payments, usageTracking, auditLogs] = await Promise.all([
        tx.$executeRaw`UPDATE "Project" SET "organizationId" = ${organizationId} WHERE "userId" = ${user.id} AND "organizationId" IS NULL`,
        tx.$executeRaw`UPDATE "Subscription" SET "organizationId" = ${organizationId} WHERE "userId" = ${user.id} AND "organizationId" IS NULL`,
        tx.$executeRaw`UPDATE "Payment" SET "organizationId" = ${organizationId}, "initiatedByUserId" = ${user.id} WHERE "userId" = ${user.id} AND "organizationId" IS NULL`,
        tx.$executeRaw`UPDATE "UsageTracking" SET "organizationId" = ${organizationId} WHERE "userId" = ${user.id} AND "organizationId" IS NULL`,
        tx.$executeRaw`UPDATE "AuditLog" SET "organizationId" = ${organizationId} WHERE "userId" = ${user.id} AND "organizationId" IS NULL`,
      ]);

      console.log(
        `✓ ${user.email} -> "${orgName}" (${slug}): ` +
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
