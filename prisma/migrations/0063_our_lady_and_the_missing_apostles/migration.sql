-- @idempotent-recoverable
--
-- Our Lady and the three Apostles the saint list had no record for.
--
-- WHY: the owner set the saint list to open with the Blessed Virgin Mary and the
-- Twelve, but production has no record of Mary herself (the Wikidata guard rightly
-- keeps her titles and images off the list) and none of Philip, James the Less or
-- Simon the Zealot. The curated knowledge base (src/lib/checklist/knowledge/saints.ts)
-- now carries all four, and the worker would publish them on its next pass, but the
-- list must not open without them on the day this deploys, whether or not a worker
-- is running. So the rows are written here, exactly as the publish orchestrator
-- writes a curated saint: the parsed payload with its stamped contentSubtype, the
-- generated subtitle, the checksum and the derived query columns. A test holds this
-- file to the curated entries (tests/db/saints-curated-migration.test.ts), so the
-- worker's curated sync and hygiene sweep both find nothing to change.
--
-- It also corrects the sort year of a saint whose death date was stored as an ISO
-- date with an era. parseYear read the day of "542-08-27 AD" as the year 27, which
-- put Caesarius of Arles at the head of the chronological list. The code is fixed;
-- the hygiene sweep only reaches a row when its rolling cursor does, and across the
-- whole catalog that can take many passes, so these rows are put right now.
--
-- Deploy safety: plain inserts and a short targeted update, no schema change. Every
-- statement is safe to run again: a row that already exists, however it got there,
-- is left exactly as it is. lock_timeout bounds any wait on a row the worker holds.
SET LOCAL lock_timeout = '5s';

-- The checklist items.
INSERT INTO "ChecklistItem" (
  "id", "contentType", "canonicalName", "canonicalSlug", "aliases", "approvalStatus", "priority",
  "needsHumanReview", "authorityLevelHint", "metadata", "discoveredAt", "createdAt", "updatedAt"
) VALUES
  ('cmxfbk7y2ax0lod1afxoxw63q', 'SAINT'::"ChecklistContentType", 'The Blessed Virgin Mary', 'saint-blessed-virgin-mary', ARRAY[]::TEXT[], 'APPROVED_FOR_BUILD'::"ChecklistApprovalStatus", 10, false, 'VATICAN'::"SourceAuthorityLevel", '{"feastDay":"01-01","saintType":"virgin","canonizationStatus":"canonized"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cmkhd0lj536ux25dhde5601ey', 'SAINT'::"ChecklistContentType", 'Saint Philip the Apostle', 'saint-philip-the-apostle', ARRAY[]::TEXT[], 'APPROVED_FOR_BUILD'::"ChecklistApprovalStatus", 60, false, 'VATICAN'::"SourceAuthorityLevel", '{"feastDay":"05-03","saintType":"apostle","canonizationStatus":"canonized"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cmn3asj085vejkeqhh41s0q8e', 'SAINT'::"ChecklistContentType", 'Saint James the Less', 'saint-james-the-less', ARRAY[]::TEXT[], 'APPROVED_FOR_BUILD'::"ChecklistApprovalStatus", 61, false, 'VATICAN'::"SourceAuthorityLevel", '{"feastDay":"05-03","saintType":"apostle","canonizationStatus":"canonized"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cmun3rni2wxuee9pr0zh7e9th', 'SAINT'::"ChecklistContentType", 'Saint Simon the Zealot', 'saint-simon-the-zealot', ARRAY[]::TEXT[], 'APPROVED_FOR_BUILD'::"ChecklistApprovalStatus", 62, false, 'VATICAN'::"SourceAuthorityLevel", '{"feastDay":"10-28","saintType":"apostle","canonizationStatus":"canonized"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;

-- Their source citations, as the checklist seed files them.
INSERT INTO "ChecklistCitation" ("id", "checklistItemId", "sourceUrl", "sourceHost", "authorityLevel", "createdAt", "updatedAt")
SELECT 'cm1w913hwge66ot4ip4snyyb3', "id", 'https://www.vatican.va/', 'www.vatican.va', 'VATICAN'::"SourceAuthorityLevel", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ChecklistItem" WHERE "canonicalSlug" = 'saint-blessed-virgin-mary'
ON CONFLICT DO NOTHING;

INSERT INTO "ChecklistCitation" ("id", "checklistItemId", "sourceUrl", "sourceHost", "authorityLevel", "createdAt", "updatedAt")
SELECT 'cmwwuek4elsqjyglf0dehonnl', "id", 'https://www.newadvent.org/cathen/', 'www.newadvent.org', 'VATICAN'::"SourceAuthorityLevel", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ChecklistItem" WHERE "canonicalSlug" = 'saint-blessed-virgin-mary'
ON CONFLICT DO NOTHING;

INSERT INTO "ChecklistCitation" ("id", "checklistItemId", "sourceUrl", "sourceHost", "authorityLevel", "createdAt", "updatedAt")
SELECT 'cm2earqqbkpt8a2qfkp4r9hnc', "id", 'https://www.vatican.va/', 'www.vatican.va', 'VATICAN'::"SourceAuthorityLevel", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ChecklistItem" WHERE "canonicalSlug" = 'saint-philip-the-apostle'
ON CONFLICT DO NOTHING;

INSERT INTO "ChecklistCitation" ("id", "checklistItemId", "sourceUrl", "sourceHost", "authorityLevel", "createdAt", "updatedAt")
SELECT 'cme21mukkb27gf9af6tb1eiuu', "id", 'https://www.newadvent.org/cathen/', 'www.newadvent.org', 'VATICAN'::"SourceAuthorityLevel", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ChecklistItem" WHERE "canonicalSlug" = 'saint-philip-the-apostle'
ON CONFLICT DO NOTHING;

INSERT INTO "ChecklistCitation" ("id", "checklistItemId", "sourceUrl", "sourceHost", "authorityLevel", "createdAt", "updatedAt")
SELECT 'cmyrbq8g41vvjit6ii9w03a8g', "id", 'https://www.vatican.va/', 'www.vatican.va', 'VATICAN'::"SourceAuthorityLevel", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ChecklistItem" WHERE "canonicalSlug" = 'saint-james-the-less'
ON CONFLICT DO NOTHING;

INSERT INTO "ChecklistCitation" ("id", "checklistItemId", "sourceUrl", "sourceHost", "authorityLevel", "createdAt", "updatedAt")
SELECT 'cmuwamez7gb7pzeg4smb8b1d2', "id", 'https://www.newadvent.org/cathen/', 'www.newadvent.org', 'VATICAN'::"SourceAuthorityLevel", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ChecklistItem" WHERE "canonicalSlug" = 'saint-james-the-less'
ON CONFLICT DO NOTHING;

INSERT INTO "ChecklistCitation" ("id", "checklistItemId", "sourceUrl", "sourceHost", "authorityLevel", "createdAt", "updatedAt")
SELECT 'cmhosv9kqhnnxbjs0kgsgos78', "id", 'https://www.vatican.va/', 'www.vatican.va', 'VATICAN'::"SourceAuthorityLevel", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ChecklistItem" WHERE "canonicalSlug" = 'saint-simon-the-zealot'
ON CONFLICT DO NOTHING;

INSERT INTO "ChecklistCitation" ("id", "checklistItemId", "sourceUrl", "sourceHost", "authorityLevel", "createdAt", "updatedAt")
SELECT 'cmvwfky0nailimcw4ajxsepcf', "id", 'https://www.newadvent.org/cathen/', 'www.newadvent.org', 'VATICAN'::"SourceAuthorityLevel", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ChecklistItem" WHERE "canonicalSlug" = 'saint-simon-the-zealot'
ON CONFLICT DO NOTHING;

-- The published rows, joined to whichever checklist item owns the slug.
INSERT INTO "PublishedContent" (
  "id", "checklistItemId", "contentType", "slug", "title", "subtitle", "payload", "authorityLevel",
  "isPublished", "publishedAt", "contentChecksum", "version",
  "feastMonth", "feastDayOfMonth", "sortYear", "subtype", "createdAt", "updatedAt"
)
SELECT 'cmnt83rtn61qqf6y1n91sp0jl', "id", 'SAINT'::"ChecklistContentType", 'saint-blessed-virgin-mary', 'The Blessed Virgin Mary', 'Virgin, patron of the Americas · Feast January 1',
  $payload${"slug":"saint-blessed-virgin-mary","canonicalName":"The Blessed Virgin Mary","feastDay":"01-01","feastMonth":1,"feastDayOfMonth":1,"patronages":["the Americas","the United States","France","Portugal"],"biography":"The Blessed Virgin Mary is the Mother of Jesus Christ, the Son of God, and so truly the Mother of God (Theotokos), as the Council of Ephesus taught in 431. By ancient tradition the daughter of Saints Joachim and Anne, she was preserved from all stain of original sin from the first moment of her conception, as Pope Pius IX defined in 1854, and remained ever a virgin, before, during and after the birth of her Son. At the Annunciation she answered the angel, 'Be it done to me according to thy word' (Luke 1:38). She stood beneath the Cross (John 19:25) and prayed with the Apostles before Pentecost (Acts 1:14). When the course of her earthly life was finished she was assumed body and soul into heavenly glory, as Pope Pius XII defined in 1950. The Church honors her as Mother of the Church and Queen of Heaven, and keeps her solemnity as Mother of God on January 1.","saintType":"virgin","canonizationStatus":"canonized","titleLabel":"Mother of God","relatedPrayers":[],"relatedDevotions":[],"citations":["https://www.vatican.va/","https://www.newadvent.org/cathen/"],"contentSubtype":"saint_biography"}$payload$::jsonb,
  'VATICAN'::"SourceAuthorityLevel",
  true, CURRENT_TIMESTAMP, '03eb2385e2e3bef0', 1,
  1, 1, NULL, 'virgin', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ChecklistItem"
WHERE "contentType" = 'SAINT'::"ChecklistContentType" AND "canonicalSlug" = 'saint-blessed-virgin-mary'
ON CONFLICT DO NOTHING;

INSERT INTO "PublishedContent" (
  "id", "checklistItemId", "contentType", "slug", "title", "subtitle", "payload", "authorityLevel",
  "isPublished", "publishedAt", "contentChecksum", "version",
  "feastMonth", "feastDayOfMonth", "sortYear", "subtype", "createdAt", "updatedAt"
)
SELECT 'cmv1x9u2gua6brov8dnz8bavk', "id", 'SAINT'::"ChecklistContentType", 'saint-philip-the-apostle', 'Saint Philip the Apostle', 'Apostle, patron of Uruguay · Feast May 3',
  $payload${"slug":"saint-philip-the-apostle","canonicalName":"Saint Philip the Apostle","feastDay":"05-03","feastMonth":5,"feastDayOfMonth":3,"patronages":["Uruguay","hatters"],"biography":"Saint Philip, of Bethsaida, was among the first disciples Jesus called and one of the Twelve Apostles (John 1:43). He led Nathanael to the Lord, and at the Last Supper he asked, 'Lord, show us the Father' (John 14:8). Tradition holds that he preached the Gospel in Asia Minor and died at Hierapolis in Phrygia. He is not the Philip who was one of the seven deacons (Acts 6:5). His relics rest with those of Saint James the Less in the Basilica of the Holy Apostles in Rome, and the two are honored together on May 3.","saintType":"apostle","canonizationStatus":"canonized","relatedPrayers":[],"relatedDevotions":[],"citations":["https://www.vatican.va/","https://www.newadvent.org/cathen/"],"contentSubtype":"saint_biography"}$payload$::jsonb,
  'VATICAN'::"SourceAuthorityLevel",
  true, CURRENT_TIMESTAMP, 'bb68f1669a231acf', 1,
  5, 3, NULL, 'apostle', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ChecklistItem"
WHERE "contentType" = 'SAINT'::"ChecklistContentType" AND "canonicalSlug" = 'saint-philip-the-apostle'
ON CONFLICT DO NOTHING;

INSERT INTO "PublishedContent" (
  "id", "checklistItemId", "contentType", "slug", "title", "subtitle", "payload", "authorityLevel",
  "isPublished", "publishedAt", "contentChecksum", "version",
  "feastMonth", "feastDayOfMonth", "sortYear", "subtype", "createdAt", "updatedAt"
)
SELECT 'cmn6j1hsu4wjcv994efewfqik', "id", 'SAINT'::"ChecklistContentType", 'saint-james-the-less', 'Saint James the Less', 'Apostle, patron of the dying · Feast May 3',
  $payload${"slug":"saint-james-the-less","canonicalName":"Saint James the Less","feastDay":"05-03","feastMonth":5,"feastDayOfMonth":3,"patronages":["the dying","pharmacists","Uruguay"],"biography":"Saint James the Less, son of Alphaeus, was one of the Twelve Apostles (Matthew 10:3). The Latin tradition, following Saint Jerome, identifies him with James 'the brother of the Lord' (Galatians 1:19), that is, his close kinsman, who became the first bishop of Jerusalem, spoke at the council held there (Acts 15), and is honored as the author of the Letter of James. He was martyred in Jerusalem around AD 62. His relics rest with those of Saint Philip in the Basilica of the Holy Apostles in Rome, and the two are honored together on May 3.","saintType":"apostle","canonizationStatus":"canonized","relatedPrayers":[],"relatedDevotions":[],"citations":["https://www.vatican.va/","https://www.newadvent.org/cathen/"],"contentSubtype":"saint_biography"}$payload$::jsonb,
  'VATICAN'::"SourceAuthorityLevel",
  true, CURRENT_TIMESTAMP, 'b729cc46e9aa7b34', 1,
  5, 3, NULL, 'apostle', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ChecklistItem"
WHERE "contentType" = 'SAINT'::"ChecklistContentType" AND "canonicalSlug" = 'saint-james-the-less'
ON CONFLICT DO NOTHING;

INSERT INTO "PublishedContent" (
  "id", "checklistItemId", "contentType", "slug", "title", "subtitle", "payload", "authorityLevel",
  "isPublished", "publishedAt", "contentChecksum", "version",
  "feastMonth", "feastDayOfMonth", "sortYear", "subtype", "createdAt", "updatedAt"
)
SELECT 'cm4hdvehqenpj13lz4wnja7a8', "id", 'SAINT'::"ChecklistContentType", 'saint-simon-the-zealot', 'Saint Simon the Zealot', 'Apostle, patron of sawyers · Feast October 28',
  $payload${"slug":"saint-simon-the-zealot","canonicalName":"Saint Simon the Zealot","feastDay":"10-28","feastMonth":10,"feastDayOfMonth":28,"patronages":["sawyers","tanners"],"biography":"Saint Simon, called the Zealot (Luke 6:15) and the Cananean (Matthew 10:4), was one of the Twelve Apostles and was with them in the upper room after the Ascension (Acts 1:13). Scripture records little else of him. Tradition holds that he preached the Gospel in Persia with Saint Jude Thaddeus and that both died there as martyrs. The two are honored together on October 28.","saintType":"apostle","canonizationStatus":"canonized","relatedPrayers":[],"relatedDevotions":[],"citations":["https://www.vatican.va/","https://www.newadvent.org/cathen/"],"contentSubtype":"saint_biography"}$payload$::jsonb,
  'VATICAN'::"SourceAuthorityLevel",
  true, CURRENT_TIMESTAMP, '936154a6923bd055', 1,
  10, 28, NULL, 'apostle', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ChecklistItem"
WHERE "contentType" = 'SAINT'::"ChecklistContentType" AND "canonicalSlug" = 'saint-simon-the-zealot'
ON CONFLICT DO NOTHING;

-- The year of a death date stored as an ISO date with an era ("542-08-27 AD").
UPDATE "PublishedContent"
SET "sortYear" = substring(payload->>'deathDate' from '^\s*(\d{1,4})-')::int,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "contentType" = 'SAINT'::"ChecklistContentType"
  AND payload->>'deathDate' ~ '^\s*\d{1,4}-\d{2}-\d{2}\s+(AD|CE|A\.D\.|C\.E\.)\s*$'
  AND "sortYear" IS DISTINCT FROM substring(payload->>'deathDate' from '^\s*(\d{1,4})-')::int;
