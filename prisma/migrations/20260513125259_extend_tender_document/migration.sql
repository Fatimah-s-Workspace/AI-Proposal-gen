-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TenderDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "extractedText" TEXT,
    "parsingStatus" TEXT NOT NULL DEFAULT 'pending',
    "parsingError" TEXT,
    "parsedAt" DATETIME,
    "sections" JSONB,
    "status" TEXT NOT NULL DEFAULT 'uploaded',
    "documentType" TEXT NOT NULL DEFAULT 'tender_pack',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "parentId" TEXT,
    "revisionNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TenderDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TenderDocument" ("createdAt", "extractedText", "filename", "id", "mimeType", "originalName", "parsedAt", "parsingError", "parsingStatus", "projectId", "sections", "size", "status", "storagePath", "updatedAt") SELECT "createdAt", "extractedText", "filename", "id", "mimeType", "originalName", "parsedAt", "parsingError", "parsingStatus", "projectId", "sections", "size", "status", "storagePath", "updatedAt" FROM "TenderDocument";
DROP TABLE "TenderDocument";
ALTER TABLE "new_TenderDocument" RENAME TO "TenderDocument";
CREATE INDEX "TenderDocument_projectId_idx" ON "TenderDocument"("projectId");
CREATE INDEX "TenderDocument_documentType_idx" ON "TenderDocument"("documentType");
CREATE INDEX "TenderDocument_isPrimary_idx" ON "TenderDocument"("isPrimary");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
