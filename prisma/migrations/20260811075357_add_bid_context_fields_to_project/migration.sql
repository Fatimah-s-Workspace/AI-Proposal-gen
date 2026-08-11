-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "contractDuration" TEXT,
ADD COLUMN     "evaluationCriteria" TEXT,
ADD COLUMN     "incumbent" TEXT,
ADD COLUMN     "referenceNumber" TEXT,
ADD COLUMN     "submissionLanguage" TEXT NOT NULL DEFAULT 'English',
ADD COLUMN     "winThemes" TEXT;
