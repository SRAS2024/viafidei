-- Content goal model: replace the single hard "max" with a target goal plus
-- a canonicalMax that exists ONLY for closed content types (today only
-- SACRAMENT = 7). Open content types keep canonicalMax NULL and grow past
-- their target at a maintenance pace.

ALTER TABLE "ContentGoal" ADD COLUMN "canonicalMax" INTEGER;

-- New goal statuses. TARGET_REACHED for open types (never "complete"),
-- CANONICAL_COMPLETE for closed types at their hard maximum.
ALTER TYPE "ContentGoalStatus" ADD VALUE IF NOT EXISTS 'TARGET_REACHED';
ALTER TYPE "ContentGoalStatus" ADD VALUE IF NOT EXISTS 'CANONICAL_COMPLETE';
ALTER TYPE "ContentGoalStatus" ADD VALUE IF NOT EXISTS 'NEEDS_VERIFICATION';
ALTER TYPE "ContentGoalStatus" ADD VALUE IF NOT EXISTS 'SOURCE_BLOCKED';
ALTER TYPE "ContentGoalStatus" ADD VALUE IF NOT EXISTS 'STALLED';
