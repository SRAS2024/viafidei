-- Adaptive worker Phase A: BUILD_READY-drain per-item gate diagnosis +
-- review-queue intelligence. Additive columns only (no data migration, no FKs).

-- AlterTable: per-artifact gate diagnosis from the BUILD_READY drain.
ALTER TABLE "AdminWorkerPackageArtifact" ADD COLUMN "gateDiagnosis" TEXT;
ALTER TABLE "AdminWorkerPackageArtifact" ADD COLUMN "gateCheckedAt" TIMESTAMP(3);

-- AlterTable: review-queue intelligence fields.
ALTER TABLE "HumanReviewQueue" ADD COLUMN "blockingGate" TEXT;
ALTER TABLE "HumanReviewQueue" ADD COLUMN "neededAction" TEXT;
ALTER TABLE "HumanReviewQueue" ADD COLUMN "repairSuggestion" TEXT;
ALTER TABLE "HumanReviewQueue" ADD COLUMN "nextAutomatedAction" TEXT;
