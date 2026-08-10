-- AlterTable
ALTER TABLE "OrganizationInvite" ALTER COLUMN "invitedByUserId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "role";

-- CreateIndex
CREATE INDEX "OrganizationInvite_invitedByUserId_idx" ON "OrganizationInvite"("invitedByUserId");

-- AddForeignKey
ALTER TABLE "OrganizationInvite" ADD CONSTRAINT "OrganizationInvite_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

