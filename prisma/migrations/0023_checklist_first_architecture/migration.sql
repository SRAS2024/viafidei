-- =============================================================================
-- 0023_checklist_first_architecture
-- Adds the approved-checklist-first architecture: master checklists,
-- authority sources, citations, worker build queue, build logs, QA reports,
-- version history, content relationships, and the published content store.
-- =============================================================================

-- New enums
CREATE TYPE "ChecklistContentType" AS ENUM (
  'PRAYER',
  'DEVOTION',
  'SAINT',
  'MARIAN_TITLE',
  'APPARITION',
  'NOVENA',
  'SACRAMENT',
  'GUIDE',
  'CHURCH_DOCUMENT',
  'LITURGICAL',
  'SPIRITUAL_PRACTICE'
);

CREATE TYPE "ChecklistApprovalStatus" AS ENUM (
  'DISCOVERED',
  'SOURCE_VERIFIED',
  'APPROVED_FOR_BUILD',
  'BUILT',
  'QA_PENDING',
  'APPROVED',
  'REJECTED',
  'PUBLISHED',
  'NEEDS_HUMAN_REVIEW'
);

CREATE TYPE "SourceAuthorityLevel" AS ENUM (
  'VATICAN',
  'CATECHISM',
  'LITURGICAL_BOOK',
  'USCCB',
  'DIOCESAN',
  'RELIGIOUS_ORDER',
  'TRUSTED_PUBLISHER',
  'ACADEMIC',
  'COMMUNITY'
);

CREATE TYPE "WorkerBuildStatus" AS ENUM (
  'pending',
  'running',
  'partial',
  'succeeded',
  'failed',
  'retrying',
  'cancelled'
);

-- ChecklistItem
CREATE TABLE "ChecklistItem" (
  "id" TEXT NOT NULL,
  "contentType" "ChecklistContentType" NOT NULL,
  "canonicalName" TEXT NOT NULL,
  "canonicalSlug" TEXT NOT NULL,
  "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "summary" TEXT,
  "approvalStatus" "ChecklistApprovalStatus" NOT NULL DEFAULT 'DISCOVERED',
  "priority" INTEGER NOT NULL DEFAULT 100,
  "needsHumanReview" BOOLEAN NOT NULL DEFAULT false,
  "humanReviewReason" TEXT,
  "authorityLevelHint" "SourceAuthorityLevel",
  "duplicateOfId" TEXT,
  "notes" TEXT,
  "metadata" JSONB,
  "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sourceVerifiedAt" TIMESTAMP(3),
  "approvedForBuildAt" TIMESTAMP(3),
  "builtAt" TIMESTAMP(3),
  "qaPendingAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "rejectedReason" TEXT,
  "publishedContentRef" TEXT,
  "approvedByUsername" TEXT,
  "rejectedByUsername" TEXT,
  "publishedByUsername" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChecklistItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChecklistItem_canonicalSlug_key" ON "ChecklistItem"("canonicalSlug");
CREATE UNIQUE INDEX "ChecklistItem_contentType_canonicalSlug_key" ON "ChecklistItem"("contentType", "canonicalSlug");
CREATE INDEX "ChecklistItem_contentType_approvalStatus_idx" ON "ChecklistItem"("contentType", "approvalStatus");
CREATE INDEX "ChecklistItem_approvalStatus_idx" ON "ChecklistItem"("approvalStatus");
CREATE INDEX "ChecklistItem_priority_idx" ON "ChecklistItem"("priority");
CREATE INDEX "ChecklistItem_needsHumanReview_idx" ON "ChecklistItem"("needsHumanReview");
CREATE INDEX "ChecklistItem_canonicalSlug_idx" ON "ChecklistItem"("canonicalSlug");

ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_duplicateOfId_fkey"
  FOREIGN KEY ("duplicateOfId") REFERENCES "ChecklistItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AuthoritySource
CREATE TABLE "AuthoritySource" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "host" TEXT NOT NULL,
  "baseUrl" TEXT NOT NULL,
  "authorityLevel" "SourceAuthorityLevel" NOT NULL,
  "description" TEXT,
  "notes" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "contentTypes" "ChecklistContentType"[] DEFAULT ARRAY[]::"ChecklistContentType"[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AuthoritySource_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AuthoritySource_host_key" ON "AuthoritySource"("host");
CREATE INDEX "AuthoritySource_authorityLevel_idx" ON "AuthoritySource"("authorityLevel");
CREATE INDEX "AuthoritySource_isActive_idx" ON "AuthoritySource"("isActive");

-- ChecklistCitation
CREATE TABLE "ChecklistCitation" (
  "id" TEXT NOT NULL,
  "checklistItemId" TEXT NOT NULL,
  "authoritySourceId" TEXT,
  "sourceUrl" TEXT NOT NULL,
  "sourceHost" TEXT NOT NULL,
  "authorityLevel" "SourceAuthorityLevel" NOT NULL,
  "title" TEXT,
  "excerpt" TEXT,
  "contentChecksum" TEXT,
  "validated" BOOLEAN NOT NULL DEFAULT false,
  "validationNotes" TEXT,
  "validatedAt" TIMESTAMP(3),
  "fetchedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChecklistCitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChecklistCitation_checklistItemId_sourceUrl_key" ON "ChecklistCitation"("checklistItemId", "sourceUrl");
CREATE INDEX "ChecklistCitation_authorityLevel_idx" ON "ChecklistCitation"("authorityLevel");
CREATE INDEX "ChecklistCitation_validated_idx" ON "ChecklistCitation"("validated");
CREATE INDEX "ChecklistCitation_sourceHost_idx" ON "ChecklistCitation"("sourceHost");

ALTER TABLE "ChecklistCitation" ADD CONSTRAINT "ChecklistCitation_checklistItemId_fkey"
  FOREIGN KEY ("checklistItemId") REFERENCES "ChecklistItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChecklistCitation" ADD CONSTRAINT "ChecklistCitation_authoritySourceId_fkey"
  FOREIGN KEY ("authoritySourceId") REFERENCES "AuthoritySource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- WorkerBuildJob
CREATE TABLE "WorkerBuildJob" (
  "id" TEXT NOT NULL,
  "checklistItemId" TEXT NOT NULL,
  "status" "WorkerBuildStatus" NOT NULL DEFAULT 'pending',
  "attempt" INTEGER NOT NULL DEFAULT 1,
  "maxAttempts" INTEGER NOT NULL DEFAULT 5,
  "priority" INTEGER NOT NULL DEFAULT 100,
  "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "durationMs" INTEGER,
  "leaseExpiresAt" TIMESTAMP(3),
  "leasedBy" TEXT,
  "partialPayload" JSONB,
  "resultPayload" JSONB,
  "errorMessage" TEXT,
  "confidence" DOUBLE PRECISION,
  "triggeredBy" TEXT NOT NULL DEFAULT 'automatic',
  "actorUsername" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkerBuildJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkerBuildJob_status_priority_runAt_idx" ON "WorkerBuildJob"("status", "priority", "runAt");
CREATE INDEX "WorkerBuildJob_checklistItemId_attempt_idx" ON "WorkerBuildJob"("checklistItemId", "attempt");
CREATE INDEX "WorkerBuildJob_status_leaseExpiresAt_idx" ON "WorkerBuildJob"("status", "leaseExpiresAt");

ALTER TABLE "WorkerBuildJob" ADD CONSTRAINT "WorkerBuildJob_checklistItemId_fkey"
  FOREIGN KEY ("checklistItemId") REFERENCES "ChecklistItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- WorkerBuildLog
CREATE TABLE "WorkerBuildLog" (
  "id" TEXT NOT NULL,
  "buildJobId" TEXT NOT NULL,
  "step" TEXT NOT NULL,
  "level" TEXT NOT NULL DEFAULT 'info',
  "message" TEXT NOT NULL,
  "fieldName" TEXT,
  "sourceUrl" TEXT,
  "warnings" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "confidence" DOUBLE PRECISION,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkerBuildLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkerBuildLog_buildJobId_createdAt_idx" ON "WorkerBuildLog"("buildJobId", "createdAt");
CREATE INDEX "WorkerBuildLog_level_idx" ON "WorkerBuildLog"("level");
CREATE INDEX "WorkerBuildLog_step_idx" ON "WorkerBuildLog"("step");

ALTER TABLE "WorkerBuildLog" ADD CONSTRAINT "WorkerBuildLog_buildJobId_fkey"
  FOREIGN KEY ("buildJobId") REFERENCES "WorkerBuildJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ChecklistQAReport
CREATE TABLE "ChecklistQAReport" (
  "id" TEXT NOT NULL,
  "checklistItemId" TEXT NOT NULL,
  "buildJobId" TEXT,
  "passed" BOOLEAN NOT NULL,
  "completenessScore" DOUBLE PRECISION NOT NULL,
  "accuracyScore" DOUBLE PRECISION NOT NULL,
  "sourceCoverageScore" DOUBLE PRECISION NOT NULL,
  "formattingScore" DOUBLE PRECISION NOT NULL,
  "readabilityScore" DOUBLE PRECISION NOT NULL,
  "appCompatScore" DOUBLE PRECISION NOT NULL,
  "overallScore" DOUBLE PRECISION NOT NULL,
  "issues" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "warnings" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "fieldsValidated" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "recommendation" TEXT NOT NULL,
  "needsHumanReview" BOOLEAN NOT NULL DEFAULT false,
  "reviewedByUsername" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewerNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChecklistQAReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ChecklistQAReport_checklistItemId_createdAt_idx" ON "ChecklistQAReport"("checklistItemId", "createdAt");
CREATE INDEX "ChecklistQAReport_passed_idx" ON "ChecklistQAReport"("passed");
CREATE INDEX "ChecklistQAReport_needsHumanReview_idx" ON "ChecklistQAReport"("needsHumanReview");
CREATE INDEX "ChecklistQAReport_overallScore_idx" ON "ChecklistQAReport"("overallScore");

ALTER TABLE "ChecklistQAReport" ADD CONSTRAINT "ChecklistQAReport_checklistItemId_fkey"
  FOREIGN KEY ("checklistItemId") REFERENCES "ChecklistItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChecklistQAReport" ADD CONSTRAINT "ChecklistQAReport_buildJobId_fkey"
  FOREIGN KEY ("buildJobId") REFERENCES "WorkerBuildJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ChecklistVersion
CREATE TABLE "ChecklistVersion" (
  "id" TEXT NOT NULL,
  "checklistItemId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "payload" JSONB NOT NULL,
  "buildJobId" TEXT,
  "authorUsername" TEXT,
  "changeSummary" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChecklistVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChecklistVersion_checklistItemId_version_key" ON "ChecklistVersion"("checklistItemId", "version");
CREATE INDEX "ChecklistVersion_checklistItemId_createdAt_idx" ON "ChecklistVersion"("checklistItemId", "createdAt");

ALTER TABLE "ChecklistVersion" ADD CONSTRAINT "ChecklistVersion_checklistItemId_fkey"
  FOREIGN KEY ("checklistItemId") REFERENCES "ChecklistItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ChecklistRelation
CREATE TABLE "ChecklistRelation" (
  "id" TEXT NOT NULL,
  "fromItemId" TEXT NOT NULL,
  "toItemId" TEXT NOT NULL,
  "relationType" TEXT NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChecklistRelation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChecklistRelation_fromItemId_toItemId_relationType_key" ON "ChecklistRelation"("fromItemId", "toItemId", "relationType");
CREATE INDEX "ChecklistRelation_fromItemId_idx" ON "ChecklistRelation"("fromItemId");
CREATE INDEX "ChecklistRelation_toItemId_idx" ON "ChecklistRelation"("toItemId");
CREATE INDEX "ChecklistRelation_relationType_idx" ON "ChecklistRelation"("relationType");

ALTER TABLE "ChecklistRelation" ADD CONSTRAINT "ChecklistRelation_fromItemId_fkey"
  FOREIGN KEY ("fromItemId") REFERENCES "ChecklistItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChecklistRelation" ADD CONSTRAINT "ChecklistRelation_toItemId_fkey"
  FOREIGN KEY ("toItemId") REFERENCES "ChecklistItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- PublishedContent
CREATE TABLE "PublishedContent" (
  "id" TEXT NOT NULL,
  "checklistItemId" TEXT NOT NULL,
  "contentType" "ChecklistContentType" NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "authorityLevel" "SourceAuthorityLevel" NOT NULL,
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "publishedAt" TIMESTAMP(3),
  "unpublishedAt" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PublishedContent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PublishedContent_checklistItemId_key" ON "PublishedContent"("checklistItemId");
CREATE UNIQUE INDEX "PublishedContent_contentType_slug_key" ON "PublishedContent"("contentType", "slug");
CREATE INDEX "PublishedContent_contentType_isPublished_idx" ON "PublishedContent"("contentType", "isPublished");
CREATE INDEX "PublishedContent_isPublished_idx" ON "PublishedContent"("isPublished");
CREATE INDEX "PublishedContent_authorityLevel_idx" ON "PublishedContent"("authorityLevel");
