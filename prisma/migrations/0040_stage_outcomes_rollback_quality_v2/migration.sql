-- AdminWorkerActionScore: persist the fallback action the brain planned.
ALTER TABLE "AdminWorkerActionScore" ADD COLUMN "fallbackAction" TEXT;

-- PublishedContent: freshness marker / checksum written at publish time.
ALTER TABLE "PublishedContent" ADD COLUMN "contentChecksum" TEXT;

-- ContentQualityScore: full quality model (all dimensions + threshold +
-- pass/fail + failed-dimension list).
ALTER TABLE "ContentQualityScore" ADD COLUMN "sourceAuthorityScore" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "ContentQualityScore" ADD COLUMN "fieldProvenanceScore" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "ContentQualityScore" ADD COLUMN "duplicateSafetyScore" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "ContentQualityScore" ADD COLUMN "doctrinalSensitivityScore" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "ContentQualityScore" ADD COLUMN "packageConsistencyScore" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "ContentQualityScore" ADD COLUMN "threshold" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "ContentQualityScore" ADD COLUMN "passed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ContentQualityScore" ADD COLUMN "failedDimensions" TEXT[] DEFAULT ARRAY[]::TEXT[];
CREATE INDEX "ContentQualityScore_passed_idx" ON "ContentQualityScore"("passed");

-- AdminWorkerStageOutcome: exact per-stage outcome ledger.
CREATE TABLE "AdminWorkerStageOutcome" (
    "id" TEXT NOT NULL,
    "passId" TEXT,
    "stage" TEXT NOT NULL,
    "action" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "contentType" TEXT,
    "result" TEXT NOT NULL,
    "resultType" TEXT NOT NULL,
    "failureReason" TEXT,
    "downstreamStage" TEXT,
    "durationMs" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "confidenceBefore" DOUBLE PRECISION,
    "actualOutcome" TEXT,
    "repairCreated" BOOLEAN NOT NULL DEFAULT false,
    "repairPlanId" TEXT,
    "nextAction" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminWorkerStageOutcome_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AdminWorkerStageOutcome_passId_idx" ON "AdminWorkerStageOutcome"("passId");
CREATE INDEX "AdminWorkerStageOutcome_stage_idx" ON "AdminWorkerStageOutcome"("stage");
CREATE INDEX "AdminWorkerStageOutcome_entityType_entityId_idx" ON "AdminWorkerStageOutcome"("entityType", "entityId");
CREATE INDEX "AdminWorkerStageOutcome_contentType_idx" ON "AdminWorkerStageOutcome"("contentType");
CREATE INDEX "AdminWorkerStageOutcome_resultType_idx" ON "AdminWorkerStageOutcome"("resultType");
CREATE INDEX "AdminWorkerStageOutcome_createdAt_idx" ON "AdminWorkerStageOutcome"("createdAt");

-- AdminWorkerRollbackLedger: durable rollback record.
CREATE TABLE "AdminWorkerRollbackLedger" (
    "id" TEXT NOT NULL,
    "contentId" TEXT,
    "contentType" TEXT,
    "slug" TEXT,
    "previousPublicState" TEXT NOT NULL,
    "failedVerificationReason" TEXT,
    "rollbackAction" TEXT NOT NULL,
    "relatedPackageArtifactId" TEXT,
    "relatedRepairPlanId" TEXT,
    "humanReviewCreated" BOOLEAN NOT NULL DEFAULT false,
    "rollbackResult" TEXT NOT NULL,
    "restorable" BOOLEAN NOT NULL DEFAULT false,
    "passId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminWorkerRollbackLedger_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AdminWorkerRollbackLedger_contentType_idx" ON "AdminWorkerRollbackLedger"("contentType");
CREATE INDEX "AdminWorkerRollbackLedger_contentId_idx" ON "AdminWorkerRollbackLedger"("contentId");
CREATE INDEX "AdminWorkerRollbackLedger_rollbackResult_idx" ON "AdminWorkerRollbackLedger"("rollbackResult");
CREATE INDEX "AdminWorkerRollbackLedger_createdAt_idx" ON "AdminWorkerRollbackLedger"("createdAt");
