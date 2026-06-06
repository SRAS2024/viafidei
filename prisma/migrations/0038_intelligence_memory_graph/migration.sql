-- Intelligence brain foundation: semantic memory / vector store,
-- knowledge-graph nodes + edges, structured developer requests, and the
-- brain-call audit trail. TypeScript owns every write to these tables;
-- the Python intelligence brain only computes over rows passed to it.

-- CreateTable
CREATE TABLE "AdminWorkerEmbedding" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "contentType" TEXT,
    "title" TEXT,
    "textSnapshot" TEXT,
    "embeddingJson" TEXT NOT NULL,
    "dims" INTEGER NOT NULL DEFAULT 512,
    "model" TEXT NOT NULL DEFAULT 'hash-v1',
    "contentHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminWorkerEmbedding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminWorkerGraphNode" (
    "id" TEXT NOT NULL,
    "nodeType" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "label" TEXT NOT NULL,
    "embeddingJson" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminWorkerGraphNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminWorkerGraphEdge" (
    "id" TEXT NOT NULL,
    "fromNodeId" TEXT NOT NULL,
    "toNodeId" TEXT NOT NULL,
    "edgeType" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PROPOSED',
    "source" TEXT,
    "explanation" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminWorkerGraphEdge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminWorkerDeveloperRequest" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "evidence" TEXT,
    "occurrences" INTEGER NOT NULL DEFAULT 1,
    "source" TEXT,
    "fingerprint" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "AdminWorkerDeveloperRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminWorkerBrainCall" (
    "id" TEXT NOT NULL,
    "op" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL DEFAULT true,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "riskLevel" TEXT NOT NULL DEFAULT 'low',
    "recommendedNextAction" TEXT,
    "safeToAutoExecute" BOOLEAN NOT NULL DEFAULT false,
    "reasoning" TEXT,
    "evidence" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sourcesUsed" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "entityType" TEXT,
    "entityId" TEXT,
    "contentType" TEXT,
    "passId" TEXT,
    "decisionId" TEXT,
    "elapsedMs" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminWorkerBrainCall_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminWorkerEmbedding_entityType_idx" ON "AdminWorkerEmbedding"("entityType");

-- CreateIndex
CREATE INDEX "AdminWorkerEmbedding_contentType_idx" ON "AdminWorkerEmbedding"("contentType");

-- CreateIndex
CREATE INDEX "AdminWorkerEmbedding_contentHash_idx" ON "AdminWorkerEmbedding"("contentHash");

-- CreateIndex
CREATE INDEX "AdminWorkerEmbedding_updatedAt_idx" ON "AdminWorkerEmbedding"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdminWorkerEmbedding_entityType_entityId_model_key" ON "AdminWorkerEmbedding"("entityType", "entityId", "model");

-- CreateIndex
CREATE INDEX "AdminWorkerGraphNode_nodeType_idx" ON "AdminWorkerGraphNode"("nodeType");

-- CreateIndex
CREATE INDEX "AdminWorkerGraphNode_entityType_entityId_idx" ON "AdminWorkerGraphNode"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AdminWorkerGraphNode_label_idx" ON "AdminWorkerGraphNode"("label");

-- CreateIndex
CREATE UNIQUE INDEX "AdminWorkerGraphNode_nodeType_entityType_entityId_key" ON "AdminWorkerGraphNode"("nodeType", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "AdminWorkerGraphEdge_status_idx" ON "AdminWorkerGraphEdge"("status");

-- CreateIndex
CREATE INDEX "AdminWorkerGraphEdge_edgeType_idx" ON "AdminWorkerGraphEdge"("edgeType");

-- CreateIndex
CREATE INDEX "AdminWorkerGraphEdge_confidence_idx" ON "AdminWorkerGraphEdge"("confidence");

-- CreateIndex
CREATE INDEX "AdminWorkerGraphEdge_fromNodeId_idx" ON "AdminWorkerGraphEdge"("fromNodeId");

-- CreateIndex
CREATE INDEX "AdminWorkerGraphEdge_toNodeId_idx" ON "AdminWorkerGraphEdge"("toNodeId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminWorkerGraphEdge_fromNodeId_toNodeId_edgeType_key" ON "AdminWorkerGraphEdge"("fromNodeId", "toNodeId", "edgeType");

-- CreateIndex
CREATE UNIQUE INDEX "AdminWorkerDeveloperRequest_fingerprint_key" ON "AdminWorkerDeveloperRequest"("fingerprint");

-- CreateIndex
CREATE INDEX "AdminWorkerDeveloperRequest_status_idx" ON "AdminWorkerDeveloperRequest"("status");

-- CreateIndex
CREATE INDEX "AdminWorkerDeveloperRequest_kind_idx" ON "AdminWorkerDeveloperRequest"("kind");

-- CreateIndex
CREATE INDEX "AdminWorkerDeveloperRequest_severity_idx" ON "AdminWorkerDeveloperRequest"("severity");

-- CreateIndex
CREATE INDEX "AdminWorkerDeveloperRequest_updatedAt_idx" ON "AdminWorkerDeveloperRequest"("updatedAt");

-- CreateIndex
CREATE INDEX "AdminWorkerBrainCall_op_idx" ON "AdminWorkerBrainCall"("op");

-- CreateIndex
CREATE INDEX "AdminWorkerBrainCall_ok_idx" ON "AdminWorkerBrainCall"("ok");

-- CreateIndex
CREATE INDEX "AdminWorkerBrainCall_entityType_entityId_idx" ON "AdminWorkerBrainCall"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AdminWorkerBrainCall_contentType_idx" ON "AdminWorkerBrainCall"("contentType");

-- CreateIndex
CREATE INDEX "AdminWorkerBrainCall_passId_idx" ON "AdminWorkerBrainCall"("passId");

-- CreateIndex
CREATE INDEX "AdminWorkerBrainCall_createdAt_idx" ON "AdminWorkerBrainCall"("createdAt");

-- AddForeignKey
ALTER TABLE "AdminWorkerGraphEdge" ADD CONSTRAINT "AdminWorkerGraphEdge_fromNodeId_fkey" FOREIGN KEY ("fromNodeId") REFERENCES "AdminWorkerGraphNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminWorkerGraphEdge" ADD CONSTRAINT "AdminWorkerGraphEdge_toNodeId_fkey" FOREIGN KEY ("toNodeId") REFERENCES "AdminWorkerGraphNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
