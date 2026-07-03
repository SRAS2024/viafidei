-- Adaptive worker Phase E: published-content protection.
-- Additive only: a version-history snapshot table so every automated edit to
-- live published content is reversible (prior payload preserved).

-- CreateTable
CREATE TABLE "PublishedContentVersion" (
    "id" TEXT NOT NULL,
    "publishedContentId" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "payload" JSONB NOT NULL,
    "contentChecksum" TEXT,
    "changeSummary" TEXT,
    "reason" TEXT,
    "changeKind" TEXT,
    "qualityScore" DOUBLE PRECISION,
    "evidenceCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublishedContentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PublishedContentVersion_publishedContentId_version_idx" ON "PublishedContentVersion"("publishedContentId", "version");
CREATE INDEX "PublishedContentVersion_contentType_slug_idx" ON "PublishedContentVersion"("contentType", "slug");
CREATE INDEX "PublishedContentVersion_createdAt_idx" ON "PublishedContentVersion"("createdAt");
