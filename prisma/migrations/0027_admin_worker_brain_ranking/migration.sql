-- =============================================================================
-- 0027_admin_worker_brain_ranking
--
-- Foundational changes for the action-based AdminWorkerBrain (spec §1,
-- §2, §6, §7, §11).
--
-- 1. AdminWorkerDecision gains structured fields the brain now emits:
--      rankedAlternatives  full scored list of candidate actions the
--                          brain considered (highest score first; the
--                          chosen action is at index 0)
--      brainExplanation    short human-readable summary the admin UI
--                          surfaces beside the chosen action
--      brainFailure        non-null when the brain could not find any
--                          safe action and explicitly declined to act
--      riskScore           the brain's risk estimate for the chosen
--                          action
--      expectedResult      a one-line description of what success looks
--                          like for the chosen action
--      contentType         the content type the action targets, if any
--      missionStage        the pipeline stage the action advances
--
-- 2. AdminWorkerFetchResult records one row per fetch attempt against
--    an approved source. Drives source reputation and lets the brain
--    decide whether a refetch is worth doing.
--
-- 3. AdminWorkerSourceBlock stores structured blocks (headings,
--    paragraphs, lists, prayer blocks, day sections, tables, location
--    blocks) extracted from a source read. Extractors consume blocks
--    instead of raw body text so they can ignore navigation, ads, and
--    unrelated sidebars.
--
-- 4. AdminWorkerCrossSourceVerification records the outcome of each
--    sensitive-field cross-source check. The publishing gate requires
--    a matching verification row before approving doctrinally
--    sensitive content.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- AdminWorkerDecision additions
-- -----------------------------------------------------------------------------

ALTER TABLE "AdminWorkerDecision"
  ADD COLUMN "rankedAlternatives" JSONB,
  ADD COLUMN "brainExplanation"   TEXT,
  ADD COLUMN "brainFailure"       TEXT,
  ADD COLUMN "riskScore"          DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "expectedResult"     TEXT,
  ADD COLUMN "contentType"        TEXT,
  ADD COLUMN "missionStage"       TEXT;

CREATE INDEX "AdminWorkerDecision_missionStage_idx"
  ON "AdminWorkerDecision"("missionStage");

-- -----------------------------------------------------------------------------
-- AdminWorkerFetchResult
-- -----------------------------------------------------------------------------

CREATE TABLE "AdminWorkerFetchResult" (
  "id"                 TEXT             PRIMARY KEY,
  "sourceUrl"          TEXT             NOT NULL,
  "sourceHost"         TEXT             NOT NULL,
  "candidateUrlId"     TEXT,
  "httpStatus"         INTEGER,
  "contentType"        TEXT,
  "contentLength"      INTEGER,
  "checksum"           TEXT,
  "etag"               TEXT,
  "lastModifiedHeader" TEXT,
  "redirectChain"      TEXT[]           NOT NULL DEFAULT ARRAY[]::TEXT[],
  "durationMs"         INTEGER,
  "attempt"            INTEGER          NOT NULL DEFAULT 1,
  "succeeded"          BOOLEAN          NOT NULL DEFAULT FALSE,
  "unchanged"          BOOLEAN          NOT NULL DEFAULT FALSE,
  "rejectionReason"    TEXT,
  "errorClass"         TEXT,
  "errorMessage"       TEXT,
  "createdAt"          TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "AdminWorkerFetchResult_sourceUrl_idx"      ON "AdminWorkerFetchResult"("sourceUrl");
CREATE INDEX "AdminWorkerFetchResult_sourceHost_idx"     ON "AdminWorkerFetchResult"("sourceHost");
CREATE INDEX "AdminWorkerFetchResult_candidateUrlId_idx" ON "AdminWorkerFetchResult"("candidateUrlId");
CREATE INDEX "AdminWorkerFetchResult_succeeded_idx"      ON "AdminWorkerFetchResult"("succeeded");
CREATE INDEX "AdminWorkerFetchResult_createdAt_idx"      ON "AdminWorkerFetchResult"("createdAt");

-- -----------------------------------------------------------------------------
-- AdminWorkerSourceBlock
-- -----------------------------------------------------------------------------

CREATE TABLE "AdminWorkerSourceBlock" (
  "id"              TEXT             PRIMARY KEY,
  "sourceReadId"    TEXT             NOT NULL,
  "blockType"       TEXT             NOT NULL,
  "blockOrder"      INTEGER          NOT NULL,
  "text"            TEXT             NOT NULL,
  "headingLevel"    INTEGER,
  "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "isRejected"      BOOLEAN          NOT NULL DEFAULT FALSE,
  "rejectionReason" TEXT,
  "metadata"        JSONB,
  "createdAt"       TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "AdminWorkerSourceBlock_sourceReadId_blockOrder_idx"
  ON "AdminWorkerSourceBlock"("sourceReadId", "blockOrder");
CREATE INDEX "AdminWorkerSourceBlock_blockType_idx"  ON "AdminWorkerSourceBlock"("blockType");
CREATE INDEX "AdminWorkerSourceBlock_isRejected_idx" ON "AdminWorkerSourceBlock"("isRejected");

-- -----------------------------------------------------------------------------
-- AdminWorkerCrossSourceVerification
-- -----------------------------------------------------------------------------

CREATE TABLE "AdminWorkerCrossSourceVerification" (
  "id"                   TEXT             PRIMARY KEY,
  "contentType"          TEXT             NOT NULL,
  "contentId"            TEXT,
  "packageChecksum"      TEXT,
  "fieldName"            TEXT             NOT NULL,
  "valueChecked"         TEXT             NOT NULL,
  "validationSourceHost" TEXT             NOT NULL,
  "validationSourceUrl"  TEXT,
  "matchResult"          TEXT             NOT NULL,
  "mismatchReason"       TEXT,
  "confidenceScore"      DOUBLE PRECISION NOT NULL DEFAULT 0,
  "conflictReason"       TEXT,
  "finalDecision"        TEXT             NOT NULL,
  "createdAt"            TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "AdminWorkerCrossSourceVerification_contentType_contentId_idx"
  ON "AdminWorkerCrossSourceVerification"("contentType", "contentId");
CREATE INDEX "AdminWorkerCrossSourceVerification_validationSourceHost_idx"
  ON "AdminWorkerCrossSourceVerification"("validationSourceHost");
CREATE INDEX "AdminWorkerCrossSourceVerification_matchResult_idx"
  ON "AdminWorkerCrossSourceVerification"("matchResult");
CREATE INDEX "AdminWorkerCrossSourceVerification_createdAt_idx"
  ON "AdminWorkerCrossSourceVerification"("createdAt");
