-- Link JournalEntry rows to optional Goal rows so a user can keep a
-- journal of reflections, struggles, graces, and completion notes
-- directly inside the goal they are pursuing. The column is nullable
-- because most journal entries are still free-standing.
--
-- Every statement is `IF NOT EXISTS` so the migration can be re-applied
-- safely on a database where it already ran.

ALTER TABLE "JournalEntry"
  ADD COLUMN IF NOT EXISTS "goalId" TEXT;

CREATE INDEX IF NOT EXISTS "JournalEntry_goalId_idx"
  ON "JournalEntry"("goalId");

-- ALTER TABLE ... ADD CONSTRAINT does NOT support `IF NOT EXISTS` in
-- Postgres, so wrap it in a DO block that checks pg_constraint first.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'JournalEntry_goalId_fkey'
  ) THEN
    ALTER TABLE "JournalEntry"
      ADD CONSTRAINT "JournalEntry_goalId_fkey"
      FOREIGN KEY ("goalId")
      REFERENCES "Goal"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;
