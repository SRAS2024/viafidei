-- Drop the legacy build/QA/version/relation tables.
--
-- The pre-Admin-Worker build/QA/publish engine was deleted, so nothing
-- writes these tables anymore. The autonomous Admin Worker records strict
-- QA in "AdminWorkerStrictQAResult" and activity in "AdminWorkerLog".
-- All four tables are empty; dropping them removes the last legacy schema.

DROP TABLE IF EXISTS "WorkerBuildLog" CASCADE;
DROP TABLE IF EXISTS "ChecklistQAReport" CASCADE;
DROP TABLE IF EXISTS "ChecklistVersion" CASCADE;
DROP TABLE IF EXISTS "ChecklistRelation" CASCADE;
