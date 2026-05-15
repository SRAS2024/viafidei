-- Add structured feast-date columns (feastMonth, feastDayOfMonth) to
-- the Saint table so the homepage "Today's Feast Day Saints" lookup
-- can be done with a SQL filter instead of a JS post-pass over a
-- freeform `feastDay` string. The legacy `feastDay` text stays as
-- the display value; the new integer columns are derived from it.
--
-- Every statement is idempotent so the migration can be re-applied
-- safely on a database where it already ran.

ALTER TABLE "Saint"
  ADD COLUMN IF NOT EXISTS "feastMonth" INTEGER,
  ADD COLUMN IF NOT EXISTS "feastDayOfMonth" INTEGER;

CREATE INDEX IF NOT EXISTS "Saint_feastMonth_feastDayOfMonth_idx"
  ON "Saint"("feastMonth", "feastDayOfMonth");

-- Backfill the structured columns from the existing freeform
-- `feastDay` text. We only handle rows that haven't been populated
-- already so re-running the migration is a no-op. The match is
-- intentionally tolerant: full month names, three-letter abbreviations,
-- and the first numeric day (1-31) anywhere in the string. Multi-feast
-- strings ("August 4 / 5") keep the first day; the JS helper still
-- handles every part for `feastDayMatchesDate`.

WITH parsed AS (
  SELECT
    id,
    -- The month is identified by the first long-form name (or three-
    -- letter abbreviation followed by a non-letter) we see in the string.
    -- The order of the WHEN clauses matters: longer names first so
    -- "Marchant" or "April fool" cannot accidentally short-circuit.
    CASE
      WHEN "feastDay" ~* '\yjanuary\y|\yjan\.' OR "feastDay" ~* '\yjan\y[^a-z]' THEN 1
      WHEN "feastDay" ~* '\yfebruary\y|\yfeb\.' OR "feastDay" ~* '\yfeb\y[^a-z]' THEN 2
      WHEN "feastDay" ~* '\ymarch\y|\ymar\.' OR "feastDay" ~* '\ymar\y[^a-z]' THEN 3
      WHEN "feastDay" ~* '\yapril\y|\yapr\.' OR "feastDay" ~* '\yapr\y[^a-z]' THEN 4
      WHEN "feastDay" ~* '\ymay\y' THEN 5
      WHEN "feastDay" ~* '\yjune\y|\yjun\.' OR "feastDay" ~* '\yjun\y[^a-z]' THEN 6
      WHEN "feastDay" ~* '\yjuly\y|\yjul\.' OR "feastDay" ~* '\yjul\y[^a-z]' THEN 7
      WHEN "feastDay" ~* '\yaugust\y|\yaug\.' OR "feastDay" ~* '\yaug\y[^a-z]' THEN 8
      WHEN "feastDay" ~* '\yseptember\y|\ysept?\.' OR "feastDay" ~* '\ysept?\y[^a-z]' THEN 9
      WHEN "feastDay" ~* '\yoctober\y|\yoct\.' OR "feastDay" ~* '\yoct\y[^a-z]' THEN 10
      WHEN "feastDay" ~* '\ynovember\y|\ynov\.' OR "feastDay" ~* '\ynov\y[^a-z]' THEN 11
      WHEN "feastDay" ~* '\ydecember\y|\ydec\.' OR "feastDay" ~* '\ydec\y[^a-z]' THEN 12
      ELSE NULL
    END AS m,
    -- First 1-31 number in the string. Postgres regex extraction is
    -- greedy by default; we constrain to 1-2 digits with `{1,2}`.
    NULLIF(
      (regexp_match("feastDay", '\m([1-9]|[12][0-9]|3[01])\M'))[1],
      ''
    )::integer AS d
  FROM "Saint"
  WHERE "feastDay" IS NOT NULL
    AND ("feastMonth" IS NULL OR "feastDayOfMonth" IS NULL)
)
UPDATE "Saint"
SET
  "feastMonth"      = COALESCE("Saint"."feastMonth", parsed.m),
  "feastDayOfMonth" = COALESCE("Saint"."feastDayOfMonth", parsed.d)
FROM parsed
WHERE "Saint".id = parsed.id;
