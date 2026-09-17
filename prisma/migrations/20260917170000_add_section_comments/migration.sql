-- CreateTable
CREATE TABLE "SectionComment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "authorId" TEXT,
    "body" TEXT NOT NULL,
    "parentId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SectionComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SectionComment_projectId_idx" ON "SectionComment"("projectId");

-- CreateIndex
CREATE INDEX "SectionComment_sectionId_createdAt_idx" ON "SectionComment"("sectionId", "createdAt");

-- CreateIndex
CREATE INDEX "SectionComment_parentId_idx" ON "SectionComment"("parentId");

-- CreateIndex
CREATE INDEX "SectionComment_authorId_idx" ON "SectionComment"("authorId");

-- CreateIndex
CREATE INDEX "SectionComment_resolvedById_idx" ON "SectionComment"("resolvedById");

-- AddForeignKey
ALTER TABLE "SectionComment" ADD CONSTRAINT "SectionComment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectionComment" ADD CONSTRAINT "SectionComment_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "ProposalSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectionComment" ADD CONSTRAINT "SectionComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectionComment" ADD CONSTRAINT "SectionComment_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectionComment" ADD CONSTRAINT "SectionComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "SectionComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

