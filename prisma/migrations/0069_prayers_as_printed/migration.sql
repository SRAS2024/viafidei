-- @idempotent-recoverable
--
-- The psalms and canticles of the prayer library, as the Douay-Rheims is printed.
--
-- WHY: these prayers were copied from drbo.org, which shares scanning errors with the text it
-- was made from: "hath exulted me" for "hath exalted me", "in the name Lord" for "in the name
-- of the Lord". VoiceOver reads them aloud on the prayer's page. Each reading below was checked
-- against the 13 scanned printings the Scripture store was corrected from
-- (src/lib/content-shared/bible/README.md), and every printing that has the verse legibly has
-- the new words. The curated knowledge base (src/lib/checklist/knowledge/prayers) now carries
-- them and the worker's curated sync would carry them across on its next pass, but the pages
-- must read right on the day this deploys, whether or not a worker is running. A test holds
-- this file to the curated entries and to the Scripture store
-- (tests/db/prayers-as-printed-migration.test.ts).
--
-- The freshness marker of a changed row is cleared rather than left stale: it is a hash that
-- only the application computes, the verifier accepts a row without one, and the next update
-- through the application stamps it again.
--
-- Deploy safety: short targeted updates, no schema change, no version row, nothing but the
-- words named here. Safe to run again, and a no-op on a row whose text does not match: once a
-- row is corrected the old words are no longer in it.
SET LOCAL lock_timeout = '5s';

UPDATE "PublishedContent"
SET "payload" = jsonb_set("payload", '{body}', to_jsonb(replace("payload"->>'body',
      'for all the things he hath rendered unto me?',
      'for all the things that he hath rendered to me?'))),
    "contentChecksum" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "contentType" = 'PRAYER'::"ChecklistContentType"
  AND "slug" = 'psalm-115'
  AND strpos("payload"->>'body', 'for all the things he hath rendered unto me?') > 0;

UPDATE "PublishedContent"
SET "payload" = jsonb_set("payload", '{body}', to_jsonb(replace("payload"->>'body',
      'hath exulted me',
      'hath exalted me'))),
    "contentChecksum" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "contentType" = 'PRAYER'::"ChecklistContentType"
  AND "slug" = 'psalm-117'
  AND strpos("payload"->>'body', 'hath exulted me') > 0;

UPDATE "PublishedContent"
SET "payload" = jsonb_set("payload", '{body}', to_jsonb(replace("payload"->>'body',
      'I will go into them,',
      'I will go in to them,'))),
    "contentChecksum" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "contentType" = 'PRAYER'::"ChecklistContentType"
  AND "slug" = 'psalm-117'
  AND strpos("payload"->>'body', 'I will go into them,') > 0;

UPDATE "PublishedContent"
SET "payload" = jsonb_set("payload", '{body}', to_jsonb(replace("payload"->>'body',
      'in the name Lord. We have blessed',
      'in the name of the Lord. We have blessed'))),
    "contentChecksum" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "contentType" = 'PRAYER'::"ChecklistContentType"
  AND "slug" = 'psalm-117'
  AND strpos("payload"->>'body', 'in the name Lord. We have blessed') > 0;

UPDATE "PublishedContent"
SET "payload" = jsonb_set("payload", '{body}', to_jsonb(replace("payload"->>'body',
      'night shall be light as day:',
      'night shall be light as the day:'))),
    "contentChecksum" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "contentType" = 'PRAYER'::"ChecklistContentType"
  AND "slug" = 'psalm-138'
  AND strpos("payload"->>'body', 'night shall be light as day:') > 0;

UPDATE "PublishedContent"
SET "payload" = jsonb_set("payload", '{body}', to_jsonb(replace("payload"->>'body',
      'The high praise of God',
      'The high praises of God'))),
    "contentChecksum" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "contentType" = 'PRAYER'::"ChecklistContentType"
  AND "slug" = 'psalm-149'
  AND strpos("payload"->>'body', 'The high praise of God') > 0;

UPDATE "PublishedContent"
SET "payload" = jsonb_set("payload", '{body}', to_jsonb(replace("payload"->>'body',
      'will not fear: O because',
      'will not fear: because'))),
    "contentChecksum" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "contentType" = 'PRAYER'::"ChecklistContentType"
  AND "slug" = 'canticle-of-isaiah-12'
  AND strpos("payload"->>'body', 'will not fear: O because') > 0;

UPDATE "PublishedContent"
SET "payload" = jsonb_set("payload", '{body}', to_jsonb(replace("payload"->>'body',
      'they shall be called children of God.',
      'they shall be called the children of God.'))),
    "contentChecksum" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "contentType" = 'PRAYER'::"ChecklistContentType"
  AND "slug" = 'beatitudes'
  AND strpos("payload"->>'body', 'they shall be called children of God.') > 0;

UPDATE "PublishedContent"
SET "payload" = jsonb_set("payload", '{body}', to_jsonb(replace("payload"->>'body',
      'and are not of his children',
      'and are none of his children'))),
    "contentChecksum" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "contentType" = 'PRAYER'::"ChecklistContentType"
  AND "slug" = 'canticle-of-moses-deuteronomy-32'
  AND strpos("payload"->>'body', 'and are not of his children') > 0;
