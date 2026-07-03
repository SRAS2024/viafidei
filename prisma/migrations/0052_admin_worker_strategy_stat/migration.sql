-- Adaptive worker Phase C/D: per-method strategy memory.
-- Additive only: records how well each method performs within a dimension
-- (fetch/discovery/extraction/...) per content type, so the worker can rank
-- methods, switch strategy, and remember which method worked and why.

-- CreateTable
CREATE TABLE "AdminWorkerStrategyStat" (
    "id" TEXT NOT NULL,
    "dimension" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "contentType" TEXT NOT NULL DEFAULT '*',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "successes" INTEGER NOT NULL DEFAULT 0,
    "failures" INTEGER NOT NULL DEFAULT 0,
    "ewma" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "lastOutcome" TEXT,
    "lastReason" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminWorkerStrategyStat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminWorkerStrategyStat_dimension_method_contentType_key" ON "AdminWorkerStrategyStat"("dimension", "method", "contentType");
CREATE INDEX "AdminWorkerStrategyStat_dimension_contentType_idx" ON "AdminWorkerStrategyStat"("dimension", "contentType");
