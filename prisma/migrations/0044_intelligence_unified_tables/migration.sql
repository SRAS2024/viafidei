-- Unified intelligence: dedicated Postgres stores for the datasets the spec
-- assigns to "Postgres should own" that previously lived as event-keyed
-- AdminWorkerLog rows — SelfModel snapshots, mission state, capability scores,
-- calibration history, test-gap records, and stuckness records. Forward-only:
-- these become the source of truth; the audit log keeps only a timeline marker.

CREATE TABLE "AdminWorkerSelfModelSnapshot" (
    "id" TEXT NOT NULL,
    "passId" TEXT,
    "fileCount" INTEGER NOT NULL DEFAULT 0,
    "totalLines" INTEGER NOT NULL DEFAULT 0,
    "routeCount" INTEGER NOT NULL DEFAULT 0,
    "prismaModelCount" INTEGER NOT NULL DEFAULT 0,
    "scriptCount" INTEGER NOT NULL DEFAULT 0,
    "workerStageCount" INTEGER NOT NULL DEFAULT 0,
    "brainOpCount" INTEGER NOT NULL DEFAULT 0,
    "coverageRatio" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "weakCount" INTEGER NOT NULL DEFAULT 0,
    "untestedCount" INTEGER NOT NULL DEFAULT 0,
    "orphanCount" INTEGER NOT NULL DEFAULT 0,
    "duplicatePairs" INTEGER NOT NULL DEFAULT 0,
    "importCycles" INTEGER NOT NULL DEFAULT 0,
    "architecture" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "topUpgrades" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "model" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminWorkerSelfModelSnapshot_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AdminWorkerSelfModelSnapshot_createdAt_idx" ON "AdminWorkerSelfModelSnapshot"("createdAt");

CREATE TABLE "AdminWorkerMissionState" (
    "id" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "goal" TEXT,
    "existingContent" INTEGER NOT NULL DEFAULT 0,
    "target" INTEGER NOT NULL DEFAULT 0,
    "completionPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "blockers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "nextAction" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminWorkerMissionState_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AdminWorkerMissionState_contentType_key" ON "AdminWorkerMissionState"("contentType");
CREATE INDEX "AdminWorkerMissionState_status_idx" ON "AdminWorkerMissionState"("status");
CREATE INDEX "AdminWorkerMissionState_completionPct_idx" ON "AdminWorkerMissionState"("completionPct");

CREATE TABLE "AdminWorkerCapabilityScore" (
    "id" TEXT NOT NULL,
    "capability" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'untested',
    "calls" INTEGER NOT NULL DEFAULT 0,
    "failures" INTEGER NOT NULL DEFAULT 0,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminWorkerCapabilityScore_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AdminWorkerCapabilityScore_capability_key" ON "AdminWorkerCapabilityScore"("capability");
CREATE INDEX "AdminWorkerCapabilityScore_status_idx" ON "AdminWorkerCapabilityScore"("status");

CREATE TABLE "AdminWorkerCalibrationHistory" (
    "id" TEXT NOT NULL,
    "op" TEXT NOT NULL,
    "predicted" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actual" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sampleSize" INTEGER NOT NULL DEFAULT 0,
    "calibrated" BOOLEAN NOT NULL DEFAULT true,
    "gapDirection" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminWorkerCalibrationHistory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AdminWorkerCalibrationHistory_op_idx" ON "AdminWorkerCalibrationHistory"("op");
CREATE INDEX "AdminWorkerCalibrationHistory_createdAt_idx" ON "AdminWorkerCalibrationHistory"("createdAt");

CREATE TABLE "AdminWorkerTestGapRecord" (
    "id" TEXT NOT NULL,
    "failureKind" TEXT NOT NULL,
    "missingTest" TEXT NOT NULL,
    "occurrences" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "AdminWorkerTestGapRecord_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AdminWorkerTestGapRecord_failureKind_key" ON "AdminWorkerTestGapRecord"("failureKind");
CREATE INDEX "AdminWorkerTestGapRecord_status_idx" ON "AdminWorkerTestGapRecord"("status");

CREATE TABLE "AdminWorkerStucknessRecord" (
    "id" TEXT NOT NULL,
    "passId" TEXT,
    "signals" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "strategy" TEXT,
    "publishedDelta" INTEGER NOT NULL DEFAULT 0,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminWorkerStucknessRecord_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AdminWorkerStucknessRecord_resolved_idx" ON "AdminWorkerStucknessRecord"("resolved");
CREATE INDEX "AdminWorkerStucknessRecord_createdAt_idx" ON "AdminWorkerStucknessRecord"("createdAt");
