-- Admin Worker intelligence/escalation upgrade: escalation dedup memory +
-- system/code-update version memory. Additive only (two new tables); loose-
-- coupled (no cross-FKs), matching recent-migration convention.

-- CreateTable
CREATE TABLE "AdminWorkerEscalation" (
    "id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "severity" "AdminWorkerLogSeverity" NOT NULL DEFAULT 'WARN',
    "contentType" TEXT,
    "detail" TEXT NOT NULL,
    "signals" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "versionSha" TEXT,
    "emailSentAt" TIMESTAMP(3),
    "emailDelivery" TEXT,
    "occurrences" INTEGER NOT NULL DEFAULT 1,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminWorkerEscalation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminWorkerCodeVersion" (
    "id" TEXT NOT NULL,
    "sha" TEXT,
    "versionLabel" TEXT NOT NULL,
    "corpusHash" TEXT NOT NULL,
    "fileCount" INTEGER NOT NULL DEFAULT 0,
    "totalLines" INTEGER NOT NULL DEFAULT 0,
    "routeCount" INTEGER NOT NULL DEFAULT 0,
    "prismaModelCount" INTEGER NOT NULL DEFAULT 0,
    "changedSummary" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminWorkerCodeVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminWorkerEscalation_fingerprint_key" ON "AdminWorkerEscalation"("fingerprint");

-- CreateIndex
CREATE INDEX "AdminWorkerEscalation_resolvedAt_idx" ON "AdminWorkerEscalation"("resolvedAt");

-- CreateIndex
CREATE INDEX "AdminWorkerEscalation_kind_idx" ON "AdminWorkerEscalation"("kind");

-- CreateIndex
CREATE INDEX "AdminWorkerEscalation_createdAt_idx" ON "AdminWorkerEscalation"("createdAt");

-- CreateIndex
CREATE INDEX "AdminWorkerCodeVersion_capturedAt_idx" ON "AdminWorkerCodeVersion"("capturedAt");

-- CreateIndex
CREATE INDEX "AdminWorkerCodeVersion_corpusHash_idx" ON "AdminWorkerCodeVersion"("corpusHash");
