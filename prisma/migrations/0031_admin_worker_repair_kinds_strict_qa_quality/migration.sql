-- Spec §3 + §4 + §9 follow-up: add STRICT_QA_FAILED and QUALITY_SCORE_FAILED
-- to AdminWorkerRepairKind. The dispatcher's STRICT_QA stage files
-- STRICT_QA_FAILED plans when an artifact is NEEDS_REPAIR / REJECTED,
-- and the publish orchestrator files QUALITY_SCORE_FAILED plans when
-- a ContentQualityScore is below the per-content-type threshold.

ALTER TYPE "AdminWorkerRepairKind" ADD VALUE IF NOT EXISTS 'STRICT_QA_FAILED';
ALTER TYPE "AdminWorkerRepairKind" ADD VALUE IF NOT EXISTS 'QUALITY_SCORE_FAILED';
