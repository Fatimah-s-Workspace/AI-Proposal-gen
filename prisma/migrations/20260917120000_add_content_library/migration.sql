-- CreateTable
CREATE TABLE "ContentLibraryEntry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "sectionType" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sourceProjectId" TEXT,
    "sourceSectionId" TEXT,
    "createdById" TEXT,
    "timesUsed" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentLibraryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContentLibraryEntry_organizationId_idx" ON "ContentLibraryEntry"("organizationId");

-- CreateIndex
CREATE INDEX "ContentLibraryEntry_organizationId_sectionType_idx" ON "ContentLibraryEntry"("organizationId", "sectionType");

-- CreateIndex
CREATE INDEX "ContentLibraryEntry_sourceProjectId_idx" ON "ContentLibraryEntry"("sourceProjectId");

-- CreateIndex
CREATE INDEX "ContentLibraryEntry_sourceSectionId_idx" ON "ContentLibraryEntry"("sourceSectionId");

-- CreateIndex
CREATE INDEX "ContentLibraryEntry_createdById_idx" ON "ContentLibraryEntry"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "ContentLibraryEntry_organizationId_fingerprint_key" ON "ContentLibraryEntry"("organizationId", "fingerprint");

-- AddForeignKey
ALTER TABLE "ContentLibraryEntry" ADD CONSTRAINT "ContentLibraryEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentLibraryEntry" ADD CONSTRAINT "ContentLibraryEntry_sourceProjectId_fkey" FOREIGN KEY ("sourceProjectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentLibraryEntry" ADD CONSTRAINT "ContentLibraryEntry_sourceSectionId_fkey" FOREIGN KEY ("sourceSectionId") REFERENCES "ProposalSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentLibraryEntry" ADD CONSTRAINT "ContentLibraryEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

