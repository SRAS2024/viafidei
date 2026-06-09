-- Certified Admin Skill Runtime: durable skill-execution ledger + capability
-- matrix. Additive only (two new tables); loose-coupled (no cross-FKs).

-- CreateTable
CREATE TABLE "AdminWorkerSkillExecution" (
    "id" TEXT NOT NULL,
    "passId" TEXT,
    "decisionId" TEXT,
    "taskId" TEXT,
    "skillName" TEXT NOT NULL,
    "skillVersion" TEXT NOT NULL DEFAULT '1',
    "contentType" TEXT,
    "contentSubtype" TEXT,
    "targetEntityType" TEXT,
    "targetEntityId" TEXT,
    "inputHash" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "preflightStatus" TEXT NOT NULL,
    "executionStatus" TEXT NOT NULL,
    "verificationStatus" TEXT NOT NULL,
    "rollbackStatus" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL DEFAULT 'low',
    "safeToAutoExecute" BOOLEAN NOT NULL DEFAULT false,
    "humanReviewRequired" BOOLEAN NOT NULL DEFAULT false,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "failureReason" TEXT,
    "brainOpUsed" TEXT,
    "outputEntityType" TEXT,
    "outputEntityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminWorkerSkillExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminWorkerSkillCapability" (
    "id" TEXT NOT NULL,
    "capability" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "contentType" TEXT,
    "contentSubtype" TEXT,
    "coverageStatus" TEXT NOT NULL,
    "certifiedSkillName" TEXT,
    "lastSuccessfulAt" TIMESTAMP(3),
    "lastFailedAt" TIMESTAMP(3),
    "successRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "verificationRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rollbackAvailable" BOOLEAN NOT NULL DEFAULT false,
    "humanReviewRequired" BOOLEAN NOT NULL DEFAULT false,
    "missingReason" TEXT,
    "developerRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminWorkerSkillCapability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminWorkerSkillExecution_skillName_idx" ON "AdminWorkerSkillExecution"("skillName");
CREATE INDEX "AdminWorkerSkillExecution_passId_idx" ON "AdminWorkerSkillExecution"("passId");
CREATE INDEX "AdminWorkerSkillExecution_executionStatus_idx" ON "AdminWorkerSkillExecution"("executionStatus");
CREATE INDEX "AdminWorkerSkillExecution_contentType_idx" ON "AdminWorkerSkillExecution"("contentType");
CREATE INDEX "AdminWorkerSkillExecution_idempotencyKey_idx" ON "AdminWorkerSkillExecution"("idempotencyKey");
CREATE INDEX "AdminWorkerSkillExecution_createdAt_idx" ON "AdminWorkerSkillExecution"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdminWorkerSkillCapability_capability_key" ON "AdminWorkerSkillCapability"("capability");
CREATE INDEX "AdminWorkerSkillCapability_coverageStatus_idx" ON "AdminWorkerSkillCapability"("coverageStatus");
CREATE INDEX "AdminWorkerSkillCapability_category_idx" ON "AdminWorkerSkillCapability"("category");
CREATE INDEX "AdminWorkerSkillCapability_contentType_idx" ON "AdminWorkerSkillCapability"("contentType");
