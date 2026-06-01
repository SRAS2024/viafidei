-- =============================================================================
-- 0033_admin_worker_action_score_reasoning_graph
--
-- Spec §5-7 + §23-45. Two durable tables that turn the brain's
-- in-memory reasoning into queryable, auditable rows:
--
--   AdminWorkerActionScore     — one row per ranked candidate action the
--                                brain scored on a pass (every action,
--                                not only the selected one).
--   AdminWorkerReasoningGraph  — a directed "why" graph connecting the
--                                pipeline entities (content goal →
--                                candidate → read → block → artifact →
--                                validation → strict QA → quality →
--                                published → post-publish, plus repair
--                                plans, memory outcomes, source-reputation
--                                changes). Each edge explains why one
--                                thing led to another.
-- =============================================================================

CREATE TABLE "AdminWorkerActionScore" (
  "id"                 TEXT             PRIMARY KEY,
  "decisionId"         TEXT,
  "passId"             TEXT,
  "rankIndex"          INTEGER          NOT NULL DEFAULT 0,
  "selected"           BOOLEAN          NOT NULL DEFAULT false,
  "actionType"         TEXT             NOT NULL,
  "missionStage"       TEXT             NOT NULL,
  "targetContentType"  TEXT,
  "targetSource"       TEXT,
  "targetCandidate"    TEXT,
  "expectedOutput"     TEXT             NOT NULL,
  "actionScore"        DOUBLE PRECISION NOT NULL DEFAULT 0,
  "confidenceScore"    DOUBLE PRECISION NOT NULL DEFAULT 0,
  "riskScore"          DOUBLE PRECISION NOT NULL DEFAULT 0,
  "sourceScore"        DOUBLE PRECISION NOT NULL DEFAULT 0,
  "repairScore"        DOUBLE PRECISION NOT NULL DEFAULT 0,
  "urgencyScore"       DOUBLE PRECISION NOT NULL DEFAULT 0,
  "qualityExpectation" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "safe"               BOOLEAN          NOT NULL DEFAULT true,
  "reason"             TEXT,
  "rejectedReason"     TEXT,
  "createdAt"          TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "AdminWorkerActionScore_decisionId_idx"   ON "AdminWorkerActionScore"("decisionId");
CREATE INDEX "AdminWorkerActionScore_passId_idx"       ON "AdminWorkerActionScore"("passId");
CREATE INDEX "AdminWorkerActionScore_missionStage_idx" ON "AdminWorkerActionScore"("missionStage");
CREATE INDEX "AdminWorkerActionScore_selected_idx"     ON "AdminWorkerActionScore"("selected");
CREATE INDEX "AdminWorkerActionScore_createdAt_idx"    ON "AdminWorkerActionScore"("createdAt");

CREATE TABLE "AdminWorkerReasoningGraph" (
  "id"            TEXT             PRIMARY KEY,
  "pipelineKey"   TEXT,
  "contentType"   TEXT,
  "contentId"     TEXT,
  "fromNodeType"  TEXT             NOT NULL,
  "fromNodeId"    TEXT,
  "fromNodeLabel" TEXT,
  "toNodeType"    TEXT             NOT NULL,
  "toNodeId"      TEXT,
  "toNodeLabel"   TEXT,
  "relation"      TEXT             NOT NULL,
  "explanation"   TEXT             NOT NULL,
  "confidence"    DOUBLE PRECISION NOT NULL DEFAULT 0,
  "passId"        TEXT,
  "decisionId"    TEXT,
  "metadata"      JSONB,
  "createdAt"     TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "AdminWorkerReasoningGraph_pipelineKey_idx"  ON "AdminWorkerReasoningGraph"("pipelineKey");
CREATE INDEX "AdminWorkerReasoningGraph_contentType_contentId_idx" ON "AdminWorkerReasoningGraph"("contentType", "contentId");
CREATE INDEX "AdminWorkerReasoningGraph_fromNodeType_fromNodeId_idx" ON "AdminWorkerReasoningGraph"("fromNodeType", "fromNodeId");
CREATE INDEX "AdminWorkerReasoningGraph_toNodeType_toNodeId_idx" ON "AdminWorkerReasoningGraph"("toNodeType", "toNodeId");
CREATE INDEX "AdminWorkerReasoningGraph_relation_idx"     ON "AdminWorkerReasoningGraph"("relation");
CREATE INDEX "AdminWorkerReasoningGraph_createdAt_idx"    ON "AdminWorkerReasoningGraph"("createdAt");
