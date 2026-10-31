-- @idempotent-recoverable
--
-- Translation cache for published content (the self-hosted translation
-- engine in src/lib/translation).
--
-- WHY: content is written in English and the site serves twelve locales. The
-- translator (scripts/translate-content.ts, run on the worker host) translates
-- each English sentence or phrase once per target language with pinned
-- OPUS-MT models and stores it here; the web server reads this table when it
-- renders a page in Spanish, Korean, … and shows the original for anything
-- not translated yet. When a visitor's page needs a missing unit, the web
-- server files a 'pending' row so the translator does that page first.
--
-- One row per (lang, sourceHash). `text` stays NULL while a row is pending.
-- Latin and Greek never become rows (src/lib/translation/rules.ts).
--
-- Deploy safety: this file only creates a NEW table and its indexes, so no
-- statement can queue behind readers of a live table; every statement is
-- guarded so a retried deploy cannot fail on "already exists". lock_timeout is
-- set anyway so a pathological catalog lock fails fast rather than stalling
-- scripts/start.sh, which takes the site down on a non-zero exit. The table is
-- deliberately NOT in scripts/validate-db.js's required set: a database
-- without it serves every page in its original language.
SET LOCAL lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS "ContentTranslation" (
    "id" TEXT NOT NULL,
    "lang" TEXT NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'text',
    "sourceLang" TEXT NOT NULL DEFAULT 'en',
    "source" TEXT NOT NULL,
    "protect" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "text" TEXT,
    "model" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "requestedAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "claimedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentTranslation_pkey" PRIMARY KEY ("id")
);

-- Page lookups read by (lang, sourceHash); the unique index also makes every
-- writer's upsert idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS "ContentTranslation_lang_sourceHash_key" ON "ContentTranslation"("lang", "sourceHash");
-- The translator claims visitor demand oldest-first.
CREATE INDEX IF NOT EXISTS "ContentTranslation_status_requestedAt_idx" ON "ContentTranslation"("status", "requestedAt");
