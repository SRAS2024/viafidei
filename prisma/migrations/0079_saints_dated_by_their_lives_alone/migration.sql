-- @idempotent-recoverable
--
-- Saints placed in the saint list by the years they lived, never by their canonization.
--
-- WHY: after the saints the owner names, the saint list runs in the order the saints
-- lived, by the year each died, else was born. A saint whose record has neither date
-- was placed by the year of the canonization instead, so about fourteen saints of no
-- known date stood among the saints of the century that canonized them. The application
-- no longer reads the canonization (saintSortYear in src/lib/content-shared/saints.ts):
-- such a saint now waits with the other undated saints after the dated ones.
--
-- The stored sort year is the application's (derived-columns.ts), and the worker's hygiene
-- sweep keeps it in step: a date the application can read has a digit in it, so a row
-- whose birth and death dates hold none has no sort year. A date with digits but no year
-- in them ("27 August") is left for the sweep, which reads it with the application's own
-- rule.
--
-- Deploy safety: one targeted update of a derived column, no schema change. Safe to run
-- again: a row already without a sort year no longer matches.
SET LOCAL lock_timeout = '5s';

UPDATE "PublishedContent"
SET "sortYear" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "contentType" = 'SAINT'::"ChecklistContentType"
  AND "sortYear" IS NOT NULL
  AND NOT COALESCE(jsonb_typeof("payload"->'deathDate') = 'string' AND "payload"->>'deathDate' ~ '[0-9]', false)
  AND NOT COALESCE(jsonb_typeof("payload"->'birthDate') = 'string' AND "payload"->>'birthDate' ~ '[0-9]', false);
