-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "hashedPassword" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "companyName" TEXT,
    "country" TEXT NOT NULL DEFAULT 'Nigeria',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "opportunityType" TEXT NOT NULL DEFAULT 'Tender',
    "sector" TEXT NOT NULL DEFAULT 'General',
    "country" TEXT NOT NULL DEFAULT 'Nigeria',
    "authority" TEXT,
    "deadline" TIMESTAMP(3),
    "budgetRange" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "stage" TEXT NOT NULL DEFAULT 'intake',
    "complianceScore" INTEGER NOT NULL DEFAULT 0,
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenderDocument" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "extractedText" TEXT,
    "parsingStatus" TEXT NOT NULL DEFAULT 'pending',
    "parsingError" TEXT,
    "parsedAt" TIMESTAMP(3),
    "sections" JSONB,
    "status" TEXT NOT NULL DEFAULT 'uploaded',
    "documentType" TEXT NOT NULL DEFAULT 'tender_pack',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "parentId" TEXT,
    "revisionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenderDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParsedSection" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParsedSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Requirement" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "documentId" TEXT,
    "sourceClauseId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'mandatory',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "sourceClause" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "dueDate" TIMESTAMP(3),
    "evidenceNeeded" JSONB,
    "evidenceMatches" JSONB,
    "reviewNotes" TEXT,
    "owner" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Requirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenderClause" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "parsedSectionId" TEXT,
    "title" TEXT,
    "originalText" TEXT NOT NULL,
    "explanation" TEXT,
    "clauseType" TEXT,
    "importance" TEXT,
    "riskLevel" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "actions" JSONB,
    "actionsRequired" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenderClause_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportingEvidence" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "requirementId" TEXT,
    "detectedType" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "status" TEXT NOT NULL DEFAULT 'detected',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportingEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalSection" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "content" TEXT,
    "sectionType" TEXT NOT NULL DEFAULT 'custom',
    "version" INTEGER NOT NULL DEFAULT 1,
    "generatedAt" TIMESTAMP(3),
    "prompt" TEXT,
    "status" TEXT NOT NULL DEFAULT 'not_started',
    "wordTarget" INTEGER NOT NULL DEFAULT 350,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProposalSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequirementMapping" (
    "id" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "proposalSectionId" TEXT NOT NULL,
    "mappingStrength" TEXT NOT NULL DEFAULT 'moderate',
    "status" TEXT NOT NULL DEFAULT 'mapped',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RequirementMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceAnalysis" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "overall" INTEGER NOT NULL,
    "technical" INTEGER NOT NULL,
    "completeness" INTEGER NOT NULL,
    "documentation" INTEGER NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalQualityReview" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sectionId" TEXT,
    "qualityScore" INTEGER NOT NULL,
    "repetitivenessScore" INTEGER NOT NULL,
    "genericLanguageScore" INTEGER NOT NULL,
    "weakStatementScore" INTEGER NOT NULL,
    "recommendations" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProposalQualityReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalIssue" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sectionId" TEXT,
    "qualityReviewId" TEXT,
    "issueType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "affectedText" TEXT NOT NULL,
    "recommendation" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProposalIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalGeneration" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sectionId" TEXT,
    "userId" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'gemini',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "prompt" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProposalGeneration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedContent" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sectionId" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'mock',
    "contentType" TEXT NOT NULL,
    "prompt" TEXT,
    "output" TEXT NOT NULL,
    "metadata" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeneratedContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExportHistory" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExportHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'starter',
    "status" TEXT NOT NULL DEFAULT 'trialing',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "renewsAt" TIMESTAMP(3),
    "monthlyProposalLimit" INTEGER NOT NULL DEFAULT 10,
    "monthlyUploadLimit" INTEGER NOT NULL DEFAULT 100,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "plan" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageTracking" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "period" TEXT NOT NULL,
    "uploads" INTEGER NOT NULL DEFAULT 0,
    "aiGenerations" INTEGER NOT NULL DEFAULT 0,
    "exports" INTEGER NOT NULL DEFAULT 0,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsageTracking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "Project_userId_idx" ON "Project"("userId");

-- CreateIndex
CREATE INDEX "Project_status_idx" ON "Project"("status");

-- CreateIndex
CREATE INDEX "TenderDocument_projectId_idx" ON "TenderDocument"("projectId");

-- CreateIndex
CREATE INDEX "TenderDocument_documentType_idx" ON "TenderDocument"("documentType");

-- CreateIndex
CREATE INDEX "TenderDocument_isPrimary_idx" ON "TenderDocument"("isPrimary");

-- CreateIndex
CREATE INDEX "ParsedSection_projectId_idx" ON "ParsedSection"("projectId");

-- CreateIndex
CREATE INDEX "ParsedSection_documentId_idx" ON "ParsedSection"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "ParsedSection_documentId_order_key" ON "ParsedSection"("documentId", "order");

-- CreateIndex
CREATE INDEX "Requirement_projectId_idx" ON "Requirement"("projectId");

-- CreateIndex
CREATE INDEX "Requirement_documentId_idx" ON "Requirement"("documentId");

-- CreateIndex
CREATE INDEX "Requirement_sourceClauseId_idx" ON "Requirement"("sourceClauseId");

-- CreateIndex
CREATE INDEX "Requirement_status_idx" ON "Requirement"("status");

-- CreateIndex
CREATE INDEX "TenderClause_projectId_idx" ON "TenderClause"("projectId");

-- CreateIndex
CREATE INDEX "TenderClause_documentId_idx" ON "TenderClause"("documentId");

-- CreateIndex
CREATE INDEX "TenderClause_parsedSectionId_idx" ON "TenderClause"("parsedSectionId");

-- CreateIndex
CREATE INDEX "TenderClause_importance_idx" ON "TenderClause"("importance");

-- CreateIndex
CREATE INDEX "SupportingEvidence_projectId_idx" ON "SupportingEvidence"("projectId");

-- CreateIndex
CREATE INDEX "SupportingEvidence_documentId_idx" ON "SupportingEvidence"("documentId");

-- CreateIndex
CREATE INDEX "SupportingEvidence_requirementId_idx" ON "SupportingEvidence"("requirementId");

-- CreateIndex
CREATE INDEX "ProposalSection_projectId_idx" ON "ProposalSection"("projectId");

-- CreateIndex
CREATE INDEX "ProposalSection_sectionType_idx" ON "ProposalSection"("sectionType");

-- CreateIndex
CREATE INDEX "RequirementMapping_requirementId_idx" ON "RequirementMapping"("requirementId");

-- CreateIndex
CREATE INDEX "RequirementMapping_proposalSectionId_idx" ON "RequirementMapping"("proposalSectionId");

-- CreateIndex
CREATE INDEX "ComplianceAnalysis_projectId_idx" ON "ComplianceAnalysis"("projectId");

-- CreateIndex
CREATE INDEX "ProposalQualityReview_projectId_idx" ON "ProposalQualityReview"("projectId");

-- CreateIndex
CREATE INDEX "ProposalQualityReview_sectionId_idx" ON "ProposalQualityReview"("sectionId");

-- CreateIndex
CREATE INDEX "ProposalIssue_projectId_idx" ON "ProposalIssue"("projectId");

-- CreateIndex
CREATE INDEX "ProposalIssue_sectionId_idx" ON "ProposalIssue"("sectionId");

-- CreateIndex
CREATE INDEX "ProposalIssue_qualityReviewId_idx" ON "ProposalIssue"("qualityReviewId");

-- CreateIndex
CREATE INDEX "ProposalGeneration_projectId_idx" ON "ProposalGeneration"("projectId");

-- CreateIndex
CREATE INDEX "ProposalGeneration_sectionId_idx" ON "ProposalGeneration"("sectionId");

-- CreateIndex
CREATE INDEX "ProposalGeneration_userId_idx" ON "ProposalGeneration"("userId");

-- CreateIndex
CREATE INDEX "ProposalGeneration_status_idx" ON "ProposalGeneration"("status");

-- CreateIndex
CREATE INDEX "GeneratedContent_projectId_idx" ON "GeneratedContent"("projectId");

-- CreateIndex
CREATE INDEX "GeneratedContent_sectionId_idx" ON "GeneratedContent"("sectionId");

-- CreateIndex
CREATE INDEX "ExportHistory_projectId_idx" ON "ExportHistory"("projectId");

-- CreateIndex
CREATE INDEX "ExportHistory_userId_idx" ON "ExportHistory"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_reference_key" ON "Payment"("reference");

-- CreateIndex
CREATE INDEX "Payment_userId_idx" ON "Payment"("userId");

-- CreateIndex
CREATE INDEX "UsageTracking_userId_idx" ON "UsageTracking"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UsageTracking_userId_projectId_period_key" ON "UsageTracking"("userId", "projectId", "period");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderDocument" ADD CONSTRAINT "TenderDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParsedSection" ADD CONSTRAINT "ParsedSection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParsedSection" ADD CONSTRAINT "ParsedSection_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "TenderDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requirement" ADD CONSTRAINT "Requirement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requirement" ADD CONSTRAINT "Requirement_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "TenderDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requirement" ADD CONSTRAINT "Requirement_sourceClauseId_fkey" FOREIGN KEY ("sourceClauseId") REFERENCES "TenderClause"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderClause" ADD CONSTRAINT "TenderClause_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderClause" ADD CONSTRAINT "TenderClause_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "TenderDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderClause" ADD CONSTRAINT "TenderClause_parsedSectionId_fkey" FOREIGN KEY ("parsedSectionId") REFERENCES "ParsedSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportingEvidence" ADD CONSTRAINT "SupportingEvidence_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportingEvidence" ADD CONSTRAINT "SupportingEvidence_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "TenderDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportingEvidence" ADD CONSTRAINT "SupportingEvidence_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalSection" ADD CONSTRAINT "ProposalSection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementMapping" ADD CONSTRAINT "RequirementMapping_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementMapping" ADD CONSTRAINT "RequirementMapping_proposalSectionId_fkey" FOREIGN KEY ("proposalSectionId") REFERENCES "ProposalSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceAnalysis" ADD CONSTRAINT "ComplianceAnalysis_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalQualityReview" ADD CONSTRAINT "ProposalQualityReview_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalQualityReview" ADD CONSTRAINT "ProposalQualityReview_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "ProposalSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalIssue" ADD CONSTRAINT "ProposalIssue_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalIssue" ADD CONSTRAINT "ProposalIssue_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "ProposalSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalIssue" ADD CONSTRAINT "ProposalIssue_qualityReviewId_fkey" FOREIGN KEY ("qualityReviewId") REFERENCES "ProposalQualityReview"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalGeneration" ADD CONSTRAINT "ProposalGeneration_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalGeneration" ADD CONSTRAINT "ProposalGeneration_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "ProposalSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalGeneration" ADD CONSTRAINT "ProposalGeneration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedContent" ADD CONSTRAINT "GeneratedContent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedContent" ADD CONSTRAINT "GeneratedContent_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "ProposalSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportHistory" ADD CONSTRAINT "ExportHistory_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportHistory" ADD CONSTRAINT "ExportHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageTracking" ADD CONSTRAINT "UsageTracking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageTracking" ADD CONSTRAINT "UsageTracking_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

