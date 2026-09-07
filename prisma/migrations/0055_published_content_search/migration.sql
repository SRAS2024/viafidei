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

-- 3. One immutable expression shared by the trigger and the backfill so the two
--    can never drift. Title is indexed twice — 'simple' keeps proper names
--    searchable verbatim ("Ælfheah"), 'english' adds stemming ("blessing" →
--    "bless"). Payload prose is truncated so one enormous document cannot make
--    a row's vector dominate the index.
CREATE OR REPLACE FUNCTION "publishedContentSearchDoc"(
  p_title text,
  p_subtitle text,
  p_payload jsonb
) RETURNS tsvector LANGUAGE sql IMMUTABLE AS $$
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
$$;

CREATE OR REPLACE FUNCTION "publishedContentSearchVectorTrigger"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."searchVector" := "publishedContentSearchDoc"(NEW.title, NEW.subtitle, NEW.payload);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS "PublishedContent_searchVector_tgr" ON "PublishedContent";
CREATE TRIGGER "PublishedContent_searchVector_tgr"
BEFORE INSERT OR UPDATE ON "PublishedContent"
FOR EACH ROW EXECUTE FUNCTION "publishedContentSearchVectorTrigger"();

-- 4. Backfill rows published before the column existed.
UPDATE "PublishedContent"
SET "searchVector" = "publishedContentSearchDoc"(title, subtitle, payload)
WHERE "searchVector" IS NULL;

-- 5. Indexes. Partial on isPublished: the public site never searches drafts.
CREATE INDEX IF NOT EXISTS "PublishedContent_search_gin"
  ON "PublishedContent" USING GIN ("searchVector") WHERE "isPublished";

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
