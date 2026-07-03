-- Adaptive worker Phase B: internal lanes + concurrency controls.
-- Additive only: a lane-state table + artifact lease columns (task ownership).

-- CreateTable
CREATE TABLE "AdminWorkerLaneState" (
    "id" TEXT NOT NULL,
    "lane" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'idle',
    "currentItem" TEXT,
    "currentStrategy" TEXT,
    "currentGate" TEXT,
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "concurrentTasks" INTEGER NOT NULL DEFAULT 0,
    "lastOutcome" TEXT,
    "lastError" TEXT,
    "lastDurationMs" INTEGER,
    "lastStartedAt" TIMESTAMP(3),
    "lastFinishedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminWorkerLaneState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminWorkerLaneState_lane_key" ON "AdminWorkerLaneState"("lane");
CREATE INDEX "AdminWorkerLaneState_status_idx" ON "AdminWorkerLaneState"("status");

-- AlterTable: artifact lease (task ownership) columns.
ALTER TABLE "AdminWorkerPackageArtifact" ADD COLUMN "leasedBy" TEXT;
ALTER TABLE "AdminWorkerPackageArtifact" ADD COLUMN "leaseExpiresAt" TIMESTAMP(3);
CREATE INDEX "AdminWorkerPackageArtifact_leaseExpiresAt_idx" ON "AdminWorkerPackageArtifact"("leaseExpiresAt");
