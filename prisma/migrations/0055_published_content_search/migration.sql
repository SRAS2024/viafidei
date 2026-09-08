-- Full-text search for the public site.
--
-- Search was an unindexed `ILIKE '%q%'` over title/slug with no ranking and no
-- multi-word support: "st john" missed "Saint John", "mary" returned fifty
-- arbitrary rows in heap order, and every keystroke of the header autocomplete
-- was a sequential scan of the whole table. This migration gives
-- PublishedContent a weighted `tsvector` (title > subtitle > payload prose)
-- maintained by trigger, a GIN index for it, and — where the extension is
-- available — a trigram index on title for typo tolerance.
--
-- Fail-open by design. Railway's managed Postgres may refuse CREATE EXTENSION,
-- so pg_trgm is attempted inside a DO block that swallows the privilege error
-- and the trigram index is only created when the extension actually exists.
-- The application (src/lib/data/published.ts) probes for both the column and
-- the extension at runtime and falls back to the previous Prisma predicate, so
-- a database that has neither still serves search.
--
-- Idempotent: every statement is IF NOT EXISTS / OR REPLACE / DROP-then-CREATE,
-- and the backfill only touches rows whose vector is still null. Certified
-- re-runnable for scripts/migrate-deploy.sh's P3009 self-heal:
-- @idempotent-recoverable

-- 0. Bound every lock this file takes.
--
-- `prisma migrate deploy` runs this whole file in ONE transaction, so step 2's
-- ACCESS EXCLUSIVE on PublishedContent is held until COMMIT — through the
-- functions, the trigger, the backfill and both index builds. A QUEUED
-- ACCESS EXCLUSIVE request blocks every reader that arrives behind it, and
-- every public page reads PublishedContent (src/lib/data/published.ts), so a
-- migration that merely WAITS on the Admin Worker's own write transaction
-- takes the live site's reads down with it. This is the first deploy where the
-- Mac worker is actually pointed at production, i.e. the first time there is a
-- second writer during a migration.
--
-- Failing fast is strictly better than waiting: a lock timeout rolls the file
-- back completely, migrate-deploy.sh's P3009 self-heal retries once, and
-- Railway retries the deploy — while the OLD container keeps serving. SET
-- LOCAL scopes to the migration's own transaction and reverts on commit.
--
-- Operationally: turn the master switch OFF and confirm the worker process has
-- exited before deploying.
SET LOCAL lock_timeout = '5s';

-- 1. pg_trgm (optional).
--
-- WHEN OTHERS, deliberately. This is the single statement in the file that a
-- production role may simply not be allowed to run, and scripts/start.sh exits
-- non-zero on a failed migration — i.e. an unhandled error here takes the site
-- down. Naming individual SQLSTATEs is a guess about how a given managed
-- Postgres refuses: Railway/RDS raise insufficient_privilege (42501), a build
-- without the contrib package raises undefined_file (58P01), providers that
-- gate extensions with an event trigger raise raise_exception (P0001) with
-- their own message, and two containers deploying at once can race to
-- unique_violation (23505) on pg_extension_name_index despite IF NOT EXISTS.
-- The extension is OPTIONAL — src/lib/data/published.ts probes pg_extension at
-- runtime and drops the trigram terms when it is absent — so NO failure mode of
-- this statement is worth failing a deploy over.
DO $$
BEGIN
  EXECUTE 'CREATE EXTENSION IF NOT EXISTS pg_trgm';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'pg_trgm not available (%: %); trigram search fallback stays disabled',
      SQLSTATE, SQLERRM;
END $$;

-- 2. The stored vector.
ALTER TABLE "PublishedContent" ADD COLUMN IF NOT EXISTS "searchVector" tsvector;

-- 3-4. The maintaining machinery: two functions, the trigger, and the backfill.
--
-- GUARDED, for the same reason step 1 is. This is the FIRST migration in the
-- project's history to CREATE a FUNCTION or a TRIGGER. Migrations 0001-0054
-- only ever did CREATE TABLE / ALTER TABLE / CREATE INDEX / CREATE TYPE, which
-- need table OWNERSHIP; CREATE FUNCTION needs CREATE on schema public, and
-- since PostgreSQL 15 the public schema no longer grants CREATE to PUBLIC. So
-- "this role has owned these tables for a year" does NOT imply "this role can
-- create a function", and scripts/start.sh exits non-zero on a failed
-- migration — an unguarded refusal here takes the container down on its next
-- restart. Railway's managed Postgres usually hands out a superuser role, so
-- this most likely passes; it is guarded because the cost of being wrong is the
-- site and the cost of the guard is nothing.
--
-- Degrading is SAFE because src/lib/data/published.ts probes for the column AND
-- this trigger before it will use the indexed path: without the trigger every
-- searchVector is NULL and `@@` matches nothing, so the probe reports
-- vector=false and search runs the ILIKE fallback it ran before this migration.
--
-- Step 3 is one immutable expression shared by the trigger and the backfill so
-- the two can never drift. Title is indexed twice — 'simple' keeps proper names
-- searchable verbatim ("AElfheah"), 'english' adds stemming ("blessing" ->
-- "bless"). Payload prose is truncated so one enormous document cannot make a
-- row's vector dominate the index.
DO $guard$
BEGIN
  EXECUTE $fn$
    CREATE OR REPLACE FUNCTION "publishedContentSearchDoc"(
      p_title text,
      p_subtitle text,
      p_payload jsonb
    ) RETURNS tsvector LANGUAGE sql IMMUTABLE AS $body$
      SELECT setweight(to_tsvector('simple',  coalesce(p_title, '')),    'A')
          || setweight(to_tsvector('english', coalesce(p_title, '')),    'A')
          || setweight(to_tsvector('simple',  coalesce(p_subtitle, '')), 'B')
          || setweight(
               to_tsvector(
                 'english',
                 left(
                   concat_ws(
                     ' ',
                     p_payload->>'summary',
                     p_payload->>'biography',
                     p_payload->>'body',
                     p_payload->>'prayerText',
                     p_payload->>'description',
                     p_payload->>'patronages',
                     p_payload->>'titleLabel',
                     p_payload->>'city',
                     p_payload->>'state',
                     p_payload->>'country'
                   ),
                   4000
                 )
               ),
               'C'
             );
    $body$
  $fn$;

  EXECUTE $fn$
    CREATE OR REPLACE FUNCTION "publishedContentSearchVectorTrigger"() RETURNS trigger
    LANGUAGE plpgsql AS $body$
    BEGIN
      NEW."searchVector" := "publishedContentSearchDoc"(NEW.title, NEW.subtitle, NEW.payload);
      RETURN NEW;
    END $body$
  $fn$;

  EXECUTE 'DROP TRIGGER IF EXISTS "PublishedContent_searchVector_tgr" ON "PublishedContent"';
  EXECUTE 'CREATE TRIGGER "PublishedContent_searchVector_tgr" '
       || 'BEFORE INSERT OR UPDATE ON "PublishedContent" '
       || 'FOR EACH ROW EXECUTE FUNCTION "publishedContentSearchVectorTrigger"()';

  -- Backfill rows published before the column existed. Inside the guard
  -- because it calls the function created above.
  EXECUTE 'UPDATE "PublishedContent" '
       || 'SET "searchVector" = "publishedContentSearchDoc"(title, subtitle, payload) '
       || 'WHERE "searchVector" IS NULL';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'search vector machinery not created (%: %); the app probes for the trigger and falls back to ILIKE search',
      SQLSTATE, SQLERRM;
END $guard$;

-- 5. Indexes. Partial on isPublished: the public site never searches drafts.
--
-- Guarded too. An index is a SCHEMA object, so CREATE INDEX needs CREATE on
-- schema public exactly as CREATE FUNCTION does — verified against a role with
-- that privilege revoked, where this statement is the one that failed the file.
-- A missing index makes the tsvector search slower, never wrong.
DO $guard$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS "PublishedContent_search_gin" '
       || 'ON "PublishedContent" USING GIN ("searchVector") WHERE "isPublished"';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'search GIN index not created (%: %); ranked search still works, unindexed',
      SQLSTATE, SQLERRM;
END $guard$;

-- Same reasoning as step 1: the trigram index is a pure optimisation, so a role
-- that can see pg_trgm but cannot use its operator class (or an index build that
-- fails for any other reason) must degrade, not fail the deploy.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS "PublishedContent_title_trgm" '
         || 'ON "PublishedContent" USING GIN (title gin_trgm_ops) WHERE "isPublished"';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'trigram index not created (%: %); search falls back to the tsvector index',
      SQLSTATE, SQLERRM;
END $$;
