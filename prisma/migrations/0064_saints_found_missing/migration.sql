-- @idempotent-recoverable
--
-- Well-known saints the catalogue had no record of.
--
-- WHY: while the saint list was being put in the owner's order, these turned out to
-- be missing altogether: the Archangels Gabriel and Raphael, Saints Basil and Gregory
-- Nazianzen, the Baptist's parents, the Good Thief and others, and the great figures of
-- the Old Testament the list closes with (the records called only "Abraham", "Moses"
-- and "David" are other people). The curated knowledge base
-- (src/lib/checklist/knowledge/saints.ts) carries them all and the worker would publish
-- them on its next pass, but the list must read right on the day this deploys, whether
-- or not a worker is running. So the rows are written here exactly as the publish
-- orchestrator writes a curated saint. A test holds this file to the curated entries
-- (tests/db/saints-curated-migration.test.ts), so the worker's curated sync and hygiene
-- sweep both find nothing to change.
--
-- Deploy safety: plain inserts, no schema change. Every statement is safe to run again:
-- a row that already exists, however it got there, is left exactly as it is, and an item
-- a person has rejected gets no published row.
SET LOCAL lock_timeout = '5s';

-- The checklist items.
INSERT INTO "ChecklistItem" (
  "id", "contentType", "canonicalName", "canonicalSlug", "aliases", "approvalStatus", "priority",
  "needsHumanReview", "authorityLevelHint", "metadata", "discoveredAt", "createdAt", "updatedAt"
) VALUES
  ('cm9gphpbnguzcprr4x7d1xmc0', 'SAINT'::"ChecklistContentType", 'Saint Gabriel the Archangel', 'saint-gabriel-the-archangel', ARRAY[]::TEXT[], 'APPROVED_FOR_BUILD'::"ChecklistApprovalStatus", 63, false, 'VATICAN'::"SourceAuthorityLevel", '{"feastDay":"09-29","saintType":"other","canonizationStatus":"canonized"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cmyovmbxie14imzz6b7smiana', 'SAINT'::"ChecklistContentType", 'Saint Raphael the Archangel', 'saint-raphael-the-archangel', ARRAY[]::TEXT[], 'APPROVED_FOR_BUILD'::"ChecklistApprovalStatus", 64, false, 'VATICAN'::"SourceAuthorityLevel", '{"feastDay":"09-29","saintType":"other","canonizationStatus":"canonized"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cmwh5bdgyqcrbra2rjbfb5vfo', 'SAINT'::"ChecklistContentType", 'Saint Elizabeth, Mother of John the Baptist', 'saint-elizabeth-mother-of-john-the-baptist', ARRAY[]::TEXT[], 'APPROVED_FOR_BUILD'::"ChecklistApprovalStatus", 65, false, 'VATICAN'::"SourceAuthorityLevel", '{"feastDay":"09-23","saintType":"other","canonizationStatus":"canonized"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cmjrftk1jnfucvegc0opfkmuv', 'SAINT'::"ChecklistContentType", 'Saint Zechariah, Father of John the Baptist', 'saint-zechariah-father-of-john-the-baptist', ARRAY[]::TEXT[], 'APPROVED_FOR_BUILD'::"ChecklistApprovalStatus", 66, false, 'VATICAN'::"SourceAuthorityLevel", '{"feastDay":"09-23","saintType":"other","canonizationStatus":"canonized"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cmzjgui9hticticeyic82llbo', 'SAINT'::"ChecklistContentType", 'Saint Peregrine Laziosi', 'saint-peregrine-laziosi', ARRAY[]::TEXT[], 'APPROVED_FOR_BUILD'::"ChecklistApprovalStatus", 67, false, 'VATICAN'::"SourceAuthorityLevel", '{"feastDay":"05-01","saintType":"religious","canonizationStatus":"canonized"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cmfre7zktpafyvg14k8di7m8h', 'SAINT'::"ChecklistContentType", 'Saint Dismas, the Good Thief', 'saint-dismas', ARRAY[]::TEXT[], 'APPROVED_FOR_BUILD'::"ChecklistApprovalStatus", 68, false, 'VATICAN'::"SourceAuthorityLevel", '{"feastDay":"03-25","saintType":"other","canonizationStatus":"canonized"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cmept4wp6ck5gs0dkm5l95uln', 'SAINT'::"ChecklistContentType", 'Saint Basil the Great', 'saint-basil-the-great', ARRAY[]::TEXT[], 'APPROVED_FOR_BUILD'::"ChecklistApprovalStatus", 69, false, 'VATICAN'::"SourceAuthorityLevel", '{"feastDay":"01-02","saintType":"doctor_of_the_church","canonizationStatus":"canonized"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cmry1y25l7sybmsv7g743sm5s', 'SAINT'::"ChecklistContentType", 'Saint Gregory Nazianzen', 'saint-gregory-nazianzen', ARRAY[]::TEXT[], 'APPROVED_FOR_BUILD'::"ChecklistApprovalStatus", 70, false, 'VATICAN'::"SourceAuthorityLevel", '{"feastDay":"01-02","saintType":"doctor_of_the_church","canonizationStatus":"canonized"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cmh5i5l5fkpmajl0pcx7c1ogn', 'SAINT'::"ChecklistContentType", 'Saint Cuthbert of Lindisfarne', 'saint-cuthbert-of-lindisfarne', ARRAY[]::TEXT[], 'APPROVED_FOR_BUILD'::"ChecklistApprovalStatus", 71, false, 'VATICAN'::"SourceAuthorityLevel", '{"feastDay":"03-20","saintType":"bishop","canonizationStatus":"canonized"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cmh43bci6fbb3187wuye6w88s', 'SAINT'::"ChecklistContentType", 'Saint Margaret Clitherow', 'saint-margaret-clitherow', ARRAY[]::TEXT[], 'APPROVED_FOR_BUILD'::"ChecklistApprovalStatus", 72, false, 'VATICAN'::"SourceAuthorityLevel", '{"feastDay":"03-25","saintType":"martyr","canonizationStatus":"canonized"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cm5fsurzi19wnfxn26q79cgrk', 'SAINT'::"ChecklistContentType", 'Saint Isaac Jogues', 'saint-isaac-jogues', ARRAY[]::TEXT[], 'APPROVED_FOR_BUILD'::"ChecklistApprovalStatus", 73, false, 'VATICAN'::"SourceAuthorityLevel", '{"feastDay":"10-19","saintType":"martyr","canonizationStatus":"canonized"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cm9s6dqb1jvqeg31hap5nn1xo', 'SAINT'::"ChecklistContentType", 'Saint Joseph of Arimathea', 'saint-joseph-of-arimathea', ARRAY[]::TEXT[], 'APPROVED_FOR_BUILD'::"ChecklistApprovalStatus", 74, false, 'VATICAN'::"SourceAuthorityLevel", '{"feastDay":"08-31","saintType":"other","canonizationStatus":"canonized"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cmc5hpjrjj1fiai7vel3agvgp', 'SAINT'::"ChecklistContentType", 'Saint Abraham the Patriarch', 'saint-abraham-the-patriarch', ARRAY[]::TEXT[], 'APPROVED_FOR_BUILD'::"ChecklistApprovalStatus", 75, false, 'VATICAN'::"SourceAuthorityLevel", '{"feastDay":"10-09","saintType":"other","canonizationStatus":"canonized"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cmdgarkh366ntqoio82lw4r5n', 'SAINT'::"ChecklistContentType", 'Saint Moses the Lawgiver', 'saint-moses-the-lawgiver', ARRAY[]::TEXT[], 'APPROVED_FOR_BUILD'::"ChecklistApprovalStatus", 76, false, 'VATICAN'::"SourceAuthorityLevel", '{"feastDay":"09-04","saintType":"other","canonizationStatus":"canonized"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cmomuvc42ywzums0tbmydptrh', 'SAINT'::"ChecklistContentType", 'Saint David the King', 'saint-david-the-king', ARRAY[]::TEXT[], 'APPROVED_FOR_BUILD'::"ChecklistApprovalStatus", 77, false, 'VATICAN'::"SourceAuthorityLevel", '{"feastDay":"12-29","saintType":"other","canonizationStatus":"canonized"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cmkz27coaombgl3pcmeqpsduh', 'SAINT'::"ChecklistContentType", 'Saint Isaiah the Prophet', 'saint-isaiah-the-prophet', ARRAY[]::TEXT[], 'APPROVED_FOR_BUILD'::"ChecklistApprovalStatus", 78, false, 'VATICAN'::"SourceAuthorityLevel", '{"feastDay":"05-09","saintType":"other","canonizationStatus":"canonized"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cmbbzmcodcn2pugpxlhntbgeu', 'SAINT'::"ChecklistContentType", 'Saint Jeremiah the Prophet', 'saint-jeremiah-the-prophet', ARRAY[]::TEXT[], 'APPROVED_FOR_BUILD'::"ChecklistApprovalStatus", 79, false, 'VATICAN'::"SourceAuthorityLevel", '{"feastDay":"05-01","saintType":"other","canonizationStatus":"canonized"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cm1kvbvt3dbjjd1uatx6dbr25', 'SAINT'::"ChecklistContentType", 'Saint Ezekiel the Prophet', 'saint-ezekiel-the-prophet', ARRAY[]::TEXT[], 'APPROVED_FOR_BUILD'::"ChecklistApprovalStatus", 80, false, 'VATICAN'::"SourceAuthorityLevel", '{"feastDay":"07-23","saintType":"other","canonizationStatus":"canonized"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cmpzk2p4c5767tvtxqw39p9ds', 'SAINT'::"ChecklistContentType", 'Saint Daniel the Prophet', 'saint-daniel-the-prophet', ARRAY[]::TEXT[], 'APPROVED_FOR_BUILD'::"ChecklistApprovalStatus", 81, false, 'VATICAN'::"SourceAuthorityLevel", '{"feastDay":"07-21","saintType":"other","canonizationStatus":"canonized"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;

-- Their source citations, as the checklist seed files them.
INSERT INTO "ChecklistCitation" ("id", "checklistItemId", "sourceUrl", "sourceHost", "authorityLevel", "createdAt", "updatedAt")
SELECT 'cmss089buotbucgbrtgv9h93h', "id", 'https://www.vatican.va/', 'www.vatican.va', 'VATICAN'::"SourceAuthorityLevel", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ChecklistItem" WHERE "canonicalSlug" = 'saint-gabriel-the-archangel'
ON CONFLICT DO NOTHING;

INSERT INTO "ChecklistCitation" ("id", "checklistItemId", "sourceUrl", "sourceHost", "authorityLevel", "createdAt", "updatedAt")
SELECT 'cm6gxiovhhvrdr1pcti908z3j', "id", 'https://www.newadvent.org/cathen/', 'www.newadvent.org', 'VATICAN'::"SourceAuthorityLevel", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ChecklistItem" WHERE "canonicalSlug" = 'saint-gabriel-the-archangel'
ON CONFLICT DO NOTHING;

INSERT INTO "ChecklistCitation" ("id", "checklistItemId", "sourceUrl", "sourceHost", "authorityLevel", "createdAt", "updatedAt")
SELECT 'cm3w3kizi87lfrert186fihny', "id", 'https://www.vatican.va/', 'www.vatican.va', 'VATICAN'::"SourceAuthorityLevel", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ChecklistItem" WHERE "canonicalSlug" = 'saint-raphael-the-archangel'
ON CONFLICT DO NOTHING;

INSERT INTO "ChecklistCitation" ("id", "checklistItemId", "sourceUrl", "sourceHost", "authorityLevel", "createdAt", "updatedAt")
SELECT 'cmq8p92fp8snlw1g7j6pio2wi', "id", 'https://www.newadvent.org/cathen/', 'www.newadvent.org', 'VATICAN'::"SourceAuthorityLevel", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ChecklistItem" WHERE "canonicalSlug" = 'saint-raphael-the-archangel'
ON CONFLICT DO NOTHING;

INSERT INTO "ChecklistCitation" ("id", "checklistItemId", "sourceUrl", "sourceHost", "authorityLevel", "createdAt", "updatedAt")
SELECT 'cmriqviu9am7qgsnv0krdk225', "id", 'https://www.vatican.va/', 'www.vatican.va', 'VATICAN'::"SourceAuthorityLevel", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ChecklistItem" WHERE "canonicalSlug" = 'saint-elizabeth-mother-of-john-the-baptist'
ON CONFLICT DO NOTHING;

INSERT INTO "ChecklistCitation" ("id", "checklistItemId", "sourceUrl", "sourceHost", "authorityLevel", "createdAt", "updatedAt")
SELECT 'cm8kcieb7duvfsmgtaz68o84m', "id", 'https://www.newadvent.org/cathen/', 'www.newadvent.org', 'VATICAN'::"SourceAuthorityLevel", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ChecklistItem" WHERE "canonicalSlug" = 'saint-elizabeth-mother-of-john-the-baptist'
ON CONFLICT DO NOTHING;

INSERT INTO "ChecklistCitation" ("id", "checklistItemId", "sourceUrl", "sourceHost", "authorityLevel", "createdAt", "updatedAt")
SELECT 'cmf422mpnjnauzu8rqk7whnvp', "id", 'https://www.vatican.va/', 'www.vatican.va', 'VATICAN'::"SourceAuthorityLevel", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ChecklistItem" WHERE "canonicalSlug" = 'saint-zechariah-father-of-john-the-baptist'
ON CONFLICT DO NOTHING;

INSERT INTO "ChecklistCitation" ("id", "checklistItemId", "sourceUrl", "sourceHost", "authorityLevel", "createdAt", "updatedAt")
SELECT 'cmsba4ppxj25hjmib5i6uattp', "id", 'https://www.newadvent.org/cathen/', 'www.newadvent.org', 'VATICAN'::"SourceAuthorityLevel", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ChecklistItem" WHERE "canonicalSlug" = 'saint-zechariah-father-of-john-the-baptist'
ON CONFLICT DO NOTHING;

INSERT INTO "ChecklistCitation" ("id", "checklistItemId", "sourceUrl", "sourceHost", "authorityLevel", "createdAt", "updatedAt")
SELECT 'cmiiwr3sxur2n9k2qbdh64h5b', "id", 'https://www.vatican.va/', 'www.vatican.va', 'VATICAN'::"SourceAuthorityLevel", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ChecklistItem" WHERE "canonicalSlug" = 'saint-peregrine-laziosi'
ON CONFLICT DO NOTHING;

INSERT INTO "ChecklistCitation" ("id", "checklistItemId", "sourceUrl", "sourceHost", "authorityLevel", "createdAt", "updatedAt")
SELECT 'cm2tyhnzqk2yy1yc9vqn87sbm', "id", 'https://www.newadvent.org/cathen/', 'www.newadvent.org', 'VATICAN'::"SourceAuthorityLevel", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ChecklistItem" WHERE "canonicalSlug" = 'saint-peregrine-laziosi'
ON CONFLICT DO NOTHING;

INSERT INTO "ChecklistCitation" ("id", "checklistItemId", "sourceUrl", "sourceHost", "authorityLevel", "createdAt", "updatedAt")
SELECT 'cmj29f53hfk0eoualitcbwwzi', "id", 'https://www.vatican.va/', 'www.vatican.va', 'VATICAN'::"SourceAuthorityLevel", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ChecklistItem" WHERE "canonicalSlug" = 'saint-dismas'
ON CONFLICT DO NOTHING;

INSERT INTO "ChecklistCitation" ("id", "checklistItemId", "sourceUrl", "sourceHost", "authorityLevel", "createdAt", "updatedAt")
SELECT 'cmrtpy9y29u4nu6cdqsq4lb59', "id", 'https://www.newadvent.org/cathen/', 'www.newadvent.org', 'VATICAN'::"SourceAuthorityLevel", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ChecklistItem" WHERE "canonicalSlug" = 'saint-dismas'
ON CONFLICT DO NOTHING;

INSERT INTO "ChecklistCitation" ("id", "checklistItemId", "sourceUrl", "sourceHost", "authorityLevel", "createdAt", "updatedAt")
SELECT 'cmn5qbyq2mnjcv1dqrcs6y8uf', "id", 'https://www.vatican.va/', 'www.vatican.va', 'VATICAN'::"SourceAuthorityLevel", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ChecklistItem" WHERE "canonicalSlug" = 'saint-basil-the-great'
ON CONFLICT DO NOTHING;

INSERT INTO "ChecklistCitation" ("id", "checklistItemId", "sourceUrl", "sourceHost", "authorityLevel", "createdAt", "updatedAt")
SELECT 'cmyhc4fmnmz1l0c02bv3ohnqh', "id", 'https://www.newadvent.org/cathen/', 'www.newadvent.org', 'VATICAN'::"SourceAuthorityLevel", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ChecklistItem" WHERE "canonicalSlug" = 'saint-basil-the-great'
ON CONFLICT DO NOTHING;

INSERT INTO "ChecklistCitation" ("id", "checklistItemId", "sourceUrl", "sourceHost", "authorityLevel", "createdAt", "updatedAt")
SELECT 'cmb7ktymjiv8dkwrriuu2al3u', "id", 'https://www.vatican.va/', 'www.vatican.va', 'VATICAN'::"SourceAuthorityLevel", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ChecklistItem" WHERE "canonicalSlug" = 'saint-gregory-nazianzen'
ON CONFLICT DO NOTHING;

INSERT INTO "ChecklistCitation" ("id", "checklistItemId", "sourceUrl", "sourceHost", "authorityLevel", "createdAt", "updatedAt")
SELECT 'cmqogrvchgg4r7l421vkxx8ys', "id", 'https://www.newadvent.org/cathen/', 'www.newadvent.org', 'VATICAN'::"SourceAuthorityLevel", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ChecklistItem" WHERE "canonicalSlug" = 'saint-gregory-nazianzen'
ON CONFLICT DO NOTHING;

INSERT INTO "ChecklistCitation" ("id", "checklistItemId", "sourceUrl", "sourceHost", "authorityLevel", "createdAt", "updatedAt")
SELECT 'cm0e847u11mu0bizyzglai128', "id", 'https://www.vatican.va/', 'www.vatican.va', 'VATICAN'::"SourceAuthorityLevel", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ChecklistItem" WHERE "canonicalSlug" = 'saint-cuthbert-of-lindisfarne'
ON CONFLICT DO NOTHING;

INSERT INTO "ChecklistCitation" ("id", "checklistItemId", "sourceUrl", "sourceHost", "authorityLevel", "createdAt", "updatedAt")
SELECT 'cmhb0lomq9rwzp8f49zao25dm', "id", 'https://www.newadvent.org/cathen/', 'www.newadvent.org', 'VATICAN'::"SourceAuthorityLevel", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ChecklistItem" WHERE "canonicalSlug" = 'saint-cuthbert-of-lindisfarne'
ON CONFLICT DO NOTHING;

INSERT INTO "ChecklistCitation" ("id", "checklistItemId", "sourceUrl", "sourceHost", "authorityLevel", "createdAt", "updatedAt")
SELECT 'cmatuifb6lwyfk92wdtdon64g', "id", 'https://www.vatican.va/', 'www.vatican.va', 'VATICAN'::"SourceAuthorityLevel", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ChecklistItem" WHERE "canonicalSlug" = 'saint-margaret-clitherow'
ON CONFLICT DO NOTHING;

INSERT INTO "ChecklistCitation" ("id", "checklistItemId", "sourceUrl", "sourceHost", "authorityLevel", "createdAt", "updatedAt")
SELECT 'cmhu78fl9sxd1ibrkmxr15t7f', "id", 'https://www.newadvent.org/cathen/', 'www.newadvent.org', 'VATICAN'::"SourceAuthorityLevel", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ChecklistItem" WHERE "canonicalSlug" = 'saint-margaret-clitherow'
ON CONFLICT DO NOTHING;

INSERT INTO "ChecklistCitation" ("id", "checklistItemId", "sourceUrl", "sourceHost", "authorityLevel", "createdAt", "updatedAt")
SELECT 'cmxwi1hah0q5ukxzd4zvqtq1f', "id", 'https://www.vatican.va/', 'www.vatican.va', 'VATICAN'::"SourceAuthorityLevel", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ChecklistItem" WHERE "canonicalSlug" = 'saint-isaac-jogues'
ON CONFLICT DO NOTHING;

INSERT INTO "ChecklistCitation" ("id", "checklistItemId", "sourceUrl", "sourceHost", "authorityLevel", "createdAt", "updatedAt")
SELECT 'cm430e4cbtl4fawdapyu520hv', "id", 'https://www.newadvent.org/cathen/', 'www.newadvent.org', 'VATICAN'::"SourceAuthorityLevel", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ChecklistItem" WHERE "canonicalSlug" = 'saint-isaac-jogues'
ON CONFLICT DO NOTHING;

INSERT INTO "ChecklistCitation" ("id", "checklistItemId", "sourceUrl", "sourceHost", "authorityLevel", "createdAt", "updatedAt")
SELECT 'cm340l5da91j44i38ihm7ycn7', "id", 'https://www.vatican.va/', 'www.vatican.va', 'VATICAN'::"SourceAuthorityLevel", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ChecklistItem" WHERE "canonicalSlug" = 'saint-joseph-of-arimathea'
ON CONFLICT DO NOTHING;

INSERT INTO "ChecklistCitation" ("id", "checklistItemId", "sourceUrl", "sourceHost", "authorityLevel", "createdAt", "updatedAt")
SELECT 'cmqbj4e230xjl4r7kwazjha7g', "id", 'https://www.newadvent.org/cathen/', 'www.newadvent.org', 'VATICAN'::"SourceAuthorityLevel", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ChecklistItem" WHERE "canonicalSlug" = 'saint-joseph-of-arimathea'
ON CONFLICT DO NOTHING;

INSERT INTO "ChecklistCitation" ("id", "checklistItemId", "sourceUrl", "sourceHost", "authorityLevel", "createdAt", "updatedAt")
SELECT 'cmecngu03jhznm558wgm6mst7', "id", 'https://www.vatican.va/', 'www.vatican.va', 'VATICAN'::"SourceAuthorityLevel", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ChecklistItem" WHERE "canonicalSlug" = 'saint-abraham-the-patriarch'
ON CONFLICT DO NOTHING;

INSERT INTO "ChecklistCitation" ("id", "checklistItemId", "sourceUrl", "sourceHost", "authorityLevel", "createdAt", "updatedAt")
SELECT 'cmf4ttvhlm7iuuivnak7gjfc9', "id", 'https://www.newadvent.org/cathen/', 'www.newadvent.org', 'VATICAN'::"SourceAuthorityLevel", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ChecklistItem" WHERE "canonicalSlug" = 'saint-abraham-the-patriarch'
ON CONFLICT DO NOTHING;

INSERT INTO "ChecklistCitation" ("id", "checklistItemId", "sourceUrl", "sourceHost", "authorityLevel", "createdAt", "updatedAt")
SELECT 'cmk129wc3yy30ozrfxe2lo77p', "id", 'https://www.vatican.va/', 'www.vatican.va', 'VATICAN'::"SourceAuthorityLevel", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ChecklistItem" WHERE "canonicalSlug" = 'saint-moses-the-lawgiver'
ON CONFLICT DO NOTHING;

INSERT INTO "ChecklistCitation" ("id", "checklistItemId", "sourceUrl", "sourceHost", "authorityLevel", "createdAt", "updatedAt")
SELECT 'cm5qaqknk3kpq4s4pqytfmhgc', "id", 'https://www.newadvent.org/cathen/', 'www.newadvent.org', 'VATICAN'::"SourceAuthorityLevel", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ChecklistItem" WHERE "canonicalSlug" = 'saint-moses-the-lawgiver'
ON CONFLICT DO NOTHING;

INSERT INTO "ChecklistCitation" ("id", "checklistItemId", "sourceUrl", "sourceHost", "authorityLevel", "createdAt", "updatedAt")
SELECT 'cmiwyq96hyho7bk53kswu1tw4', "id", 'https://www.vatican.va/', 'www.vatican.va', 'VATICAN'::"SourceAuthorityLevel", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ChecklistItem" WHERE "canonicalSlug" = 'saint-david-the-king'
ON CONFLICT DO NOTHING;

INSERT INTO "ChecklistCitation" ("id", "checklistItemId", "sourceUrl", "sourceHost", "authorityLevel", "createdAt", "updatedAt")
SELECT 'cm1ghjatsftz316dw47ein4i4', "id", 'https://www.newadvent.org/cathen/', 'www.newadvent.org', 'VATICAN'::"SourceAuthorityLevel", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ChecklistItem" WHERE "canonicalSlug" = 'saint-david-the-king'
ON CONFLICT DO NOTHING;

INSERT INTO "ChecklistCitation" ("id", "checklistItemId", "sourceUrl", "sourceHost", "authorityLevel", "createdAt", "updatedAt")
SELECT 'cmu7ie0uqsjyjdzdwrxssh3c0', "id", 'https://www.vatican.va/', 'www.vatican.va', 'VATICAN'::"SourceAuthorityLevel", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ChecklistItem" WHERE "canonicalSlug" = 'saint-isaiah-the-prophet'
ON CONFLICT DO NOTHING;

INSERT INTO "ChecklistCitation" ("id", "checklistItemId", "sourceUrl", "sourceHost", "authorityLevel", "createdAt", "updatedAt")
SELECT 'cm1cx2xufz5gsq3ai0mhlsc7x', "id", 'https://www.newadvent.org/cathen/', 'www.newadvent.org', 'VATICAN'::"SourceAuthorityLevel", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ChecklistItem" WHERE "canonicalSlug" = 'saint-isaiah-the-prophet'
ON CONFLICT DO NOTHING;

INSERT INTO "ChecklistCitation" ("id", "checklistItemId", "sourceUrl", "sourceHost", "authorityLevel", "createdAt", "updatedAt")
SELECT 'cm2izyap77497xq7y1i9zwkzt', "id", 'https://www.vatican.va/', 'www.vatican.va', 'VATICAN'::"SourceAuthorityLevel", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ChecklistItem" WHERE "canonicalSlug" = 'saint-jeremiah-the-prophet'
ON CONFLICT DO NOTHING;

INSERT INTO "ChecklistCitation" ("id", "checklistItemId", "sourceUrl", "sourceHost", "authorityLevel", "createdAt", "updatedAt")
SELECT 'cmqvt5wetg4pvbb4rgcazntci', "id", 'https://www.newadvent.org/cathen/', 'www.newadvent.org', 'VATICAN'::"SourceAuthorityLevel", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ChecklistItem" WHERE "canonicalSlug" = 'saint-jeremiah-the-prophet'
ON CONFLICT DO NOTHING;

INSERT INTO "ChecklistCitation" ("id", "checklistItemId", "sourceUrl", "sourceHost", "authorityLevel", "createdAt", "updatedAt")
SELECT 'cmsfnn0fb6mrbrej6yeew72wy', "id", 'https://www.vatican.va/', 'www.vatican.va', 'VATICAN'::"SourceAuthorityLevel", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ChecklistItem" WHERE "canonicalSlug" = 'saint-ezekiel-the-prophet'
ON CONFLICT DO NOTHING;

INSERT INTO "ChecklistCitation" ("id", "checklistItemId", "sourceUrl", "sourceHost", "authorityLevel", "createdAt", "updatedAt")
SELECT 'cmqmpnj07nrh8zff07c8hsuag', "id", 'https://www.newadvent.org/cathen/', 'www.newadvent.org', 'VATICAN'::"SourceAuthorityLevel", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ChecklistItem" WHERE "canonicalSlug" = 'saint-ezekiel-the-prophet'
ON CONFLICT DO NOTHING;

INSERT INTO "ChecklistCitation" ("id", "checklistItemId", "sourceUrl", "sourceHost", "authorityLevel", "createdAt", "updatedAt")
SELECT 'cmn0w0s8n8d69cfcvl3r34muv', "id", 'https://www.vatican.va/', 'www.vatican.va', 'VATICAN'::"SourceAuthorityLevel", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ChecklistItem" WHERE "canonicalSlug" = 'saint-daniel-the-prophet'
ON CONFLICT DO NOTHING;

INSERT INTO "ChecklistCitation" ("id", "checklistItemId", "sourceUrl", "sourceHost", "authorityLevel", "createdAt", "updatedAt")
SELECT 'cm5on9418hb0fxxzasnckq0rw', "id", 'https://www.newadvent.org/cathen/', 'www.newadvent.org', 'VATICAN'::"SourceAuthorityLevel", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ChecklistItem" WHERE "canonicalSlug" = 'saint-daniel-the-prophet'
ON CONFLICT DO NOTHING;

-- The published rows, joined to whichever checklist item owns the slug.
INSERT INTO "PublishedContent" (
  "id", "checklistItemId", "contentType", "slug", "title", "subtitle", "payload", "authorityLevel",
  "isPublished", "publishedAt", "contentChecksum", "version",
  "feastMonth", "feastDayOfMonth", "sortYear", "subtype", "createdAt", "updatedAt"
)
SELECT 'cm7slqzij0exzmi907gvkhoak', "id", 'SAINT'::"ChecklistContentType", 'saint-gabriel-the-archangel', 'Saint Gabriel the Archangel', 'Saint, patron of messengers · Feast September 29',
  $payload${"slug":"saint-gabriel-the-archangel","canonicalName":"Saint Gabriel the Archangel","feastDay":"09-29","feastMonth":9,"feastDayOfMonth":29,"patronages":["messengers","telecommunications workers"],"biography":"Saint Gabriel is one of the three archangels named in Scripture, and his name means 'strength of God'. He explained visions to the prophet Daniel (Daniel 8:16; 9:21), announced the birth of John the Baptist to Zechariah in the Temple (Luke 1:19), and was sent to Nazareth to announce to the Blessed Virgin Mary that she would be the Mother of God, greeting her: 'Hail, full of grace, the Lord is with thee' (Luke 1:28). Pope Pius XII named him patron of telecommunications workers in 1951. The Church honors him with Saints Michael and Raphael on September 29.","saintType":"other","canonizationStatus":"canonized","titleLabel":"Archangel","relatedPrayers":[],"relatedDevotions":[],"citations":["https://www.vatican.va/","https://www.newadvent.org/cathen/"],"contentSubtype":"saint_biography"}$payload$::jsonb,
  'VATICAN'::"SourceAuthorityLevel",
  true, CURRENT_TIMESTAMP, '4c4a6aac9bd95212', 1,
  9, 29, NULL, 'other', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ChecklistItem"
WHERE "contentType" = 'SAINT'::"ChecklistContentType" AND "canonicalSlug" = 'saint-gabriel-the-archangel'
  AND "approvalStatus" <> 'REJECTED'::"ChecklistApprovalStatus"
ON CONFLICT DO NOTHING;

INSERT INTO "PublishedContent" (
  "id", "checklistItemId", "contentType", "slug", "title", "subtitle", "payload", "authorityLevel",
  "isPublished", "publishedAt", "contentChecksum", "version",
  "feastMonth", "feastDayOfMonth", "sortYear", "subtype", "createdAt", "updatedAt"
)
SELECT 'cm5cs7zi9sycudibs3rpqqspg', "id", 'SAINT'::"ChecklistContentType", 'saint-raphael-the-archangel', 'Saint Raphael the Archangel', 'Saint, patron of travelers · Feast September 29',
  $payload${"slug":"saint-raphael-the-archangel","canonicalName":"Saint Raphael the Archangel","feastDay":"09-29","feastMonth":9,"feastDayOfMonth":29,"patronages":["travelers","the blind","those who care for the sick"],"biography":"Saint Raphael is one of the three archangels named in Scripture, and his name means 'God heals'. In the Book of Tobit he travels, unrecognized, with the young Tobias and protects him on the road, frees Sarah from the demon who had slain her husbands, and restores the sight of the blind Tobit. At the end he reveals who he is: 'I am the angel Raphael, one of the seven, who stand before the Lord' (Tobit 12:15). The Church honors him with Saints Michael and Gabriel on September 29.","saintType":"other","canonizationStatus":"canonized","titleLabel":"Archangel","relatedPrayers":[],"relatedDevotions":[],"citations":["https://www.vatican.va/","https://www.newadvent.org/cathen/"],"contentSubtype":"saint_biography"}$payload$::jsonb,
  'VATICAN'::"SourceAuthorityLevel",
  true, CURRENT_TIMESTAMP, '5e8de83faa142a60', 1,
  9, 29, NULL, 'other', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ChecklistItem"
WHERE "contentType" = 'SAINT'::"ChecklistContentType" AND "canonicalSlug" = 'saint-raphael-the-archangel'
  AND "approvalStatus" <> 'REJECTED'::"ChecklistApprovalStatus"
ON CONFLICT DO NOTHING;

INSERT INTO "PublishedContent" (
  "id", "checklistItemId", "contentType", "slug", "title", "subtitle", "payload", "authorityLevel",
  "isPublished", "publishedAt", "contentChecksum", "version",
  "feastMonth", "feastDayOfMonth", "sortYear", "subtype", "createdAt", "updatedAt"
)
SELECT 'cmeqxes78ilb41xfugy3hxt1o', "id", 'SAINT'::"ChecklistContentType", 'saint-elizabeth-mother-of-john-the-baptist', 'Saint Elizabeth, Mother of John the Baptist', 'Saint, patron of expectant mothers · Feast September 23',
  $payload${"slug":"saint-elizabeth-mother-of-john-the-baptist","canonicalName":"Saint Elizabeth, Mother of John the Baptist","feastDay":"09-23","feastMonth":9,"feastDayOfMonth":23,"patronages":["expectant mothers"],"biography":"Saint Elizabeth, the wife of Zechariah and a kinswoman of the Blessed Virgin Mary, was, Scripture says, just before God and advanced in years without a child (Luke 1:6-7). According to the word of the angel she conceived John the Baptist in her old age. When Mary came to visit her the child leapt in her womb, and, filled with the Holy Spirit, she greeted Mary: 'Blessed art thou among women, and blessed is the fruit of thy womb' (Luke 1:42), words the Church still prays in the Hail Mary. The Roman Martyrology commemorates her with Zechariah on September 23.","saintType":"other","canonizationStatus":"canonized","titleLabel":"Mother of John the Baptist","relatedPrayers":[],"relatedDevotions":[],"citations":["https://www.vatican.va/","https://www.newadvent.org/cathen/"],"contentSubtype":"saint_biography"}$payload$::jsonb,
  'VATICAN'::"SourceAuthorityLevel",
  true, CURRENT_TIMESTAMP, '42b448dddc4e2af4', 1,
  9, 23, NULL, 'other', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ChecklistItem"
WHERE "contentType" = 'SAINT'::"ChecklistContentType" AND "canonicalSlug" = 'saint-elizabeth-mother-of-john-the-baptist'
  AND "approvalStatus" <> 'REJECTED'::"ChecklistApprovalStatus"
ON CONFLICT DO NOTHING;

INSERT INTO "PublishedContent" (
  "id", "checklistItemId", "contentType", "slug", "title", "subtitle", "payload", "authorityLevel",
  "isPublished", "publishedAt", "contentChecksum", "version",
  "feastMonth", "feastDayOfMonth", "sortYear", "subtype", "createdAt", "updatedAt"
)
SELECT 'cml4myzjgpi5hibvoi1sffsz8', "id", 'SAINT'::"ChecklistContentType", 'saint-zechariah-father-of-john-the-baptist', 'Saint Zechariah, Father of John the Baptist', 'Saint · Feast September 23',
  $payload${"slug":"saint-zechariah-father-of-john-the-baptist","canonicalName":"Saint Zechariah, Father of John the Baptist","feastDay":"09-23","feastMonth":9,"feastDayOfMonth":23,"patronages":[],"biography":"Saint Zechariah, a priest of the course of Abia, was the husband of Saint Elizabeth and the father of John the Baptist. As he served in the Temple, the Archangel Gabriel told him that his aged wife would bear a son; because he doubted, he was struck dumb until the child was named (Luke 1:5-22). When he named the boy John his speech returned, and, filled with the Holy Spirit, he sang the canticle the Church prays every morning, the Benedictus (Luke 1:68-79). The Roman Martyrology commemorates him with Elizabeth on September 23.","saintType":"other","canonizationStatus":"canonized","titleLabel":"Father of John the Baptist","relatedPrayers":[],"relatedDevotions":[],"citations":["https://www.vatican.va/","https://www.newadvent.org/cathen/"],"contentSubtype":"saint_biography"}$payload$::jsonb,
  'VATICAN'::"SourceAuthorityLevel",
  true, CURRENT_TIMESTAMP, '2e34cd21bf07a8de', 1,
  9, 23, NULL, 'other', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ChecklistItem"
WHERE "contentType" = 'SAINT'::"ChecklistContentType" AND "canonicalSlug" = 'saint-zechariah-father-of-john-the-baptist'
  AND "approvalStatus" <> 'REJECTED'::"ChecklistApprovalStatus"
ON CONFLICT DO NOTHING;

INSERT INTO "PublishedContent" (
  "id", "checklistItemId", "contentType", "slug", "title", "subtitle", "payload", "authorityLevel",
  "isPublished", "publishedAt", "contentChecksum", "version",
  "feastMonth", "feastDayOfMonth", "sortYear", "subtype", "createdAt", "updatedAt"
)
SELECT 'cmam5soe2huohg2kmre9awxq9', "id", 'SAINT'::"ChecklistContentType", 'saint-peregrine-laziosi', 'Saint Peregrine Laziosi', 'Religious, patron of people with cancer · Feast May 1',
  $payload${"slug":"saint-peregrine-laziosi","canonicalName":"Saint Peregrine Laziosi","feastDay":"05-01","feastMonth":5,"feastDayOfMonth":1,"patronages":["people with cancer","the sick"],"biography":"Saint Peregrine Laziosi (c. 1260-1345) was born at Forlì in Italy and as a young man opposed the Pope's authority in his city. Tradition holds that he struck Saint Philip Benizi, who forgave him, and that this mercy began his conversion. He entered the Servite Order at Siena, returned to Forlì, and became known for his penance, his care for the sick and the poor, and his counsel. When a cancerous wound on his leg was to be treated by amputation, he spent the night in prayer before the crucifix and was found healed in the morning. Pope Benedict XIII canonized him in 1726, and the faithful invoke him on behalf of those who suffer from cancer.","saintType":"religious","canonizationStatus":"canonized","relatedPrayers":[],"relatedDevotions":[],"citations":["https://www.vatican.va/","https://www.newadvent.org/cathen/"],"contentSubtype":"saint_biography"}$payload$::jsonb,
  'VATICAN'::"SourceAuthorityLevel",
  true, CURRENT_TIMESTAMP, 'fe54e8b469583ab2', 1,
  5, 1, NULL, 'religious', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ChecklistItem"
WHERE "contentType" = 'SAINT'::"ChecklistContentType" AND "canonicalSlug" = 'saint-peregrine-laziosi'
  AND "approvalStatus" <> 'REJECTED'::"ChecklistApprovalStatus"
ON CONFLICT DO NOTHING;

INSERT INTO "PublishedContent" (
  "id", "checklistItemId", "contentType", "slug", "title", "subtitle", "payload", "authorityLevel",
  "isPublished", "publishedAt", "contentChecksum", "version",
  "feastMonth", "feastDayOfMonth", "sortYear", "subtype", "createdAt", "updatedAt"
)
SELECT 'cmi3pdy2sxszs200v0lt3a8h3', "id", 'SAINT'::"ChecklistContentType", 'saint-dismas', 'Saint Dismas, the Good Thief', 'Saint, patron of prisoners · Feast March 25',
  $payload${"slug":"saint-dismas","canonicalName":"Saint Dismas, the Good Thief","feastDay":"03-25","feastMonth":3,"feastDayOfMonth":25,"patronages":["prisoners","the condemned"],"biography":"Saint Dismas is the name tradition gives to the Good Thief, one of the two men crucified with Jesus. While the other mocked the Lord, he rebuked him, confessed his own guilt and prayed: 'Lord, remember me when thou shalt come into thy kingdom.' Jesus answered him: 'Amen I say to thee, this day thou shalt be with me in paradise' (Luke 23:39-43). The Gospels do not give his name, which comes from an early apocryphal writing. The Roman Martyrology commemorates him on March 25.","saintType":"other","canonizationStatus":"canonized","titleLabel":"The Good Thief","relatedPrayers":[],"relatedDevotions":[],"citations":["https://www.vatican.va/","https://www.newadvent.org/cathen/"],"contentSubtype":"saint_biography"}$payload$::jsonb,
  'VATICAN'::"SourceAuthorityLevel",
  true, CURRENT_TIMESTAMP, 'e5b2afeb67adc5e1', 1,
  3, 25, NULL, 'other', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ChecklistItem"
WHERE "contentType" = 'SAINT'::"ChecklistContentType" AND "canonicalSlug" = 'saint-dismas'
  AND "approvalStatus" <> 'REJECTED'::"ChecklistApprovalStatus"
ON CONFLICT DO NOTHING;

INSERT INTO "PublishedContent" (
  "id", "checklistItemId", "contentType", "slug", "title", "subtitle", "payload", "authorityLevel",
  "isPublished", "publishedAt", "contentChecksum", "version",
  "feastMonth", "feastDayOfMonth", "sortYear", "subtype", "createdAt", "updatedAt"
)
SELECT 'cm8jfvl0ksfc2dlr62j3o10ae', "id", 'SAINT'::"ChecklistContentType", 'saint-basil-the-great', 'Saint Basil the Great', 'Doctor of the Church, patron of Cappadocia · Feast January 2',
  $payload${"slug":"saint-basil-the-great","canonicalName":"Saint Basil the Great","feastDay":"01-02","feastMonth":1,"feastDayOfMonth":2,"patronages":["Cappadocia","monks","hospital administrators"],"biography":"Saint Basil (c. 330-379), bishop of Caesarea in Cappadocia and Doctor of the Church, was born to a family of saints and studied at Constantinople and Athens before giving himself to the monastic life. His rules still guide the monks of the East. As bishop he defended the divinity of Christ and of the Holy Spirit against the Arians and stood firm before the Emperor Valens, and he built at Caesarea a great complex for the sick and the poor. With Saint Gregory Nazianzen, his friend from student days, and his brother Saint Gregory of Nyssa, he is honored as one of the Cappadocian Fathers. The Church keeps his memorial with Saint Gregory on January 2.","saintType":"doctor_of_the_church","canonizationStatus":"canonized","titleLabel":"Doctor of the Church","relatedPrayers":[],"relatedDevotions":[],"citations":["https://www.vatican.va/","https://www.newadvent.org/cathen/"],"contentSubtype":"saint_biography"}$payload$::jsonb,
  'VATICAN'::"SourceAuthorityLevel",
  true, CURRENT_TIMESTAMP, 'fd6fb17a6b498989', 1,
  1, 2, NULL, 'doctor_of_the_church', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ChecklistItem"
WHERE "contentType" = 'SAINT'::"ChecklistContentType" AND "canonicalSlug" = 'saint-basil-the-great'
  AND "approvalStatus" <> 'REJECTED'::"ChecklistApprovalStatus"
ON CONFLICT DO NOTHING;

INSERT INTO "PublishedContent" (
  "id", "checklistItemId", "contentType", "slug", "title", "subtitle", "payload", "authorityLevel",
  "isPublished", "publishedAt", "contentChecksum", "version",
  "feastMonth", "feastDayOfMonth", "sortYear", "subtype", "createdAt", "updatedAt"
)
SELECT 'cmhf0v2l7gnn8x63jo97gnyvc', "id", 'SAINT'::"ChecklistContentType", 'saint-gregory-nazianzen', 'Saint Gregory Nazianzen', 'Doctor of the Church, patron of poets · Feast January 2',
  $payload${"slug":"saint-gregory-nazianzen","canonicalName":"Saint Gregory Nazianzen","feastDay":"01-02","feastMonth":1,"feastDayOfMonth":2,"patronages":["poets"],"biography":"Saint Gregory of Nazianzus (c. 329-390), Archbishop of Constantinople and Doctor of the Church, is known in the East as 'the Theologian'. The son of a bishop of Nazianzus in Cappadocia, he studied at Athens with his friend Saint Basil the Great and longed for a life of prayer, but was called to the priesthood and the episcopate against his own wishes. At Constantinople his Five Theological Orations defended the doctrine of the Holy Trinity, which the Council of Constantinople confirmed in 381. He soon resigned his see for the sake of peace and spent his last years in retirement, writing poetry and letters. The Church keeps his memorial with Saint Basil on January 2.","saintType":"doctor_of_the_church","canonizationStatus":"canonized","titleLabel":"Doctor of the Church","relatedPrayers":[],"relatedDevotions":[],"citations":["https://www.vatican.va/","https://www.newadvent.org/cathen/"],"contentSubtype":"saint_biography"}$payload$::jsonb,
  'VATICAN'::"SourceAuthorityLevel",
  true, CURRENT_TIMESTAMP, 'ff9258f3a5504565', 1,
  1, 2, NULL, 'doctor_of_the_church', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ChecklistItem"
WHERE "contentType" = 'SAINT'::"ChecklistContentType" AND "canonicalSlug" = 'saint-gregory-nazianzen'
  AND "approvalStatus" <> 'REJECTED'::"ChecklistApprovalStatus"
ON CONFLICT DO NOTHING;

INSERT INTO "PublishedContent" (
  "id", "checklistItemId", "contentType", "slug", "title", "subtitle", "payload", "authorityLevel",
  "isPublished", "publishedAt", "contentChecksum", "version",
  "feastMonth", "feastDayOfMonth", "sortYear", "subtype", "createdAt", "updatedAt"
)
SELECT 'cm3gnk3el9fri5ginksjvirhv', "id", 'SAINT'::"ChecklistContentType", 'saint-cuthbert-of-lindisfarne', 'Saint Cuthbert of Lindisfarne', 'Bishop, patron of Northumbria · Feast March 20',
  $payload${"slug":"saint-cuthbert-of-lindisfarne","canonicalName":"Saint Cuthbert of Lindisfarne","feastDay":"03-20","feastMonth":3,"feastDayOfMonth":20,"patronages":["Northumbria","the north of England"],"biography":"Saint Cuthbert (c. 634-687), a shepherd boy of Northumbria, entered the monastery of Melrose after a vision at the death of Saint Aidan and became known as a tireless preacher in the remote villages of the north. He served as prior of Melrose and then of Lindisfarne, and about 676 he withdrew to live as a hermit on the island of Inner Farne. Made bishop of Lindisfarne in 685 at the urging of the king and the people, he cared for his flock and the sick until he returned to his hermitage to die on March 20, 687. Saint Bede wrote his life, and his relics rest in Durham Cathedral.","saintType":"bishop","canonizationStatus":"canonized","relatedPrayers":[],"relatedDevotions":[],"citations":["https://www.vatican.va/","https://www.newadvent.org/cathen/"],"contentSubtype":"saint_biography"}$payload$::jsonb,
  'VATICAN'::"SourceAuthorityLevel",
  true, CURRENT_TIMESTAMP, 'f39acf9bd4c50a04', 1,
  3, 20, NULL, 'bishop', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ChecklistItem"
WHERE "contentType" = 'SAINT'::"ChecklistContentType" AND "canonicalSlug" = 'saint-cuthbert-of-lindisfarne'
  AND "approvalStatus" <> 'REJECTED'::"ChecklistApprovalStatus"
ON CONFLICT DO NOTHING;

INSERT INTO "PublishedContent" (
  "id", "checklistItemId", "contentType", "slug", "title", "subtitle", "payload", "authorityLevel",
  "isPublished", "publishedAt", "contentChecksum", "version",
  "feastMonth", "feastDayOfMonth", "sortYear", "subtype", "createdAt", "updatedAt"
)
SELECT 'cm0u6p75i93ur5rdgf3pgf5g7', "id", 'SAINT'::"ChecklistContentType", 'saint-margaret-clitherow', 'Saint Margaret Clitherow', 'Martyr, patron of converts · Feast March 25',
  $payload${"slug":"saint-margaret-clitherow","canonicalName":"Saint Margaret Clitherow","feastDay":"03-25","feastMonth":3,"feastDayOfMonth":25,"patronages":["converts","businesswomen"],"biography":"Saint Margaret Clitherow (c. 1556-1586), called the Pearl of York, was the wife of a butcher of York and a mother, who became a Catholic about 1574 in the reign of Queen Elizabeth I. She sheltered hunted priests in her home, where Mass was offered in secret, and was imprisoned more than once for her faith. Arrested in 1586 for harboring priests, she refused to plead so that her children and servants would not be made to testify, and for this she was pressed to death at York on Good Friday, March 25. Pope Paul VI canonized her in 1970 among the Forty Martyrs of England and Wales.","saintType":"martyr","canonizationStatus":"canonized","relatedPrayers":[],"relatedDevotions":[],"citations":["https://www.vatican.va/","https://www.newadvent.org/cathen/"],"contentSubtype":"saint_biography"}$payload$::jsonb,
  'VATICAN'::"SourceAuthorityLevel",
  true, CURRENT_TIMESTAMP, '2a5be7f5967c0b61', 1,
  3, 25, NULL, 'martyr', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ChecklistItem"
WHERE "contentType" = 'SAINT'::"ChecklistContentType" AND "canonicalSlug" = 'saint-margaret-clitherow'
  AND "approvalStatus" <> 'REJECTED'::"ChecklistApprovalStatus"
ON CONFLICT DO NOTHING;

INSERT INTO "PublishedContent" (
  "id", "checklistItemId", "contentType", "slug", "title", "subtitle", "payload", "authorityLevel",
  "isPublished", "publishedAt", "contentChecksum", "version",
  "feastMonth", "feastDayOfMonth", "sortYear", "subtype", "createdAt", "updatedAt"
)
SELECT 'cm7mm71hx883o5n2ts6z7dvvw', "id", 'SAINT'::"ChecklistContentType", 'saint-isaac-jogues', 'Saint Isaac Jogues', 'Martyr, patron of North America · Feast October 19',
  $payload${"slug":"saint-isaac-jogues","canonicalName":"Saint Isaac Jogues","feastDay":"10-19","feastMonth":10,"feastDayOfMonth":19,"patronages":["North America","Canada"],"biography":"Saint Isaac Jogues (1607-1646), a French Jesuit priest, was sent to New France in 1636 and labored among the Huron people. Captured by the Iroquois in 1642, he endured a year of torture and slavery, in which he lost several fingers, before he escaped to France with Dutch help. Pope Urban VIII allowed him to say Mass despite his mutilated hands, and he soon returned to the mission by his own choice. In 1646, on a journey of peace into the Mohawk country, he was killed at Ossernenon, near what is now Auriesville, New York. Pope Pius XI canonized him with the other North American Martyrs in 1930, and the Church honors them on October 19.","saintType":"martyr","canonizationStatus":"canonized","relatedPrayers":[],"relatedDevotions":[],"citations":["https://www.vatican.va/","https://www.newadvent.org/cathen/"],"contentSubtype":"saint_biography"}$payload$::jsonb,
  'VATICAN'::"SourceAuthorityLevel",
  true, CURRENT_TIMESTAMP, '451b4425d7002be9', 1,
  10, 19, NULL, 'martyr', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ChecklistItem"
WHERE "contentType" = 'SAINT'::"ChecklistContentType" AND "canonicalSlug" = 'saint-isaac-jogues'
  AND "approvalStatus" <> 'REJECTED'::"ChecklistApprovalStatus"
ON CONFLICT DO NOTHING;

INSERT INTO "PublishedContent" (
  "id", "checklistItemId", "contentType", "slug", "title", "subtitle", "payload", "authorityLevel",
  "isPublished", "publishedAt", "contentChecksum", "version",
  "feastMonth", "feastDayOfMonth", "sortYear", "subtype", "createdAt", "updatedAt"
)
SELECT 'cmk9tw9s3f6n5a0oqhwsmz2m9', "id", 'SAINT'::"ChecklistContentType", 'saint-joseph-of-arimathea', 'Saint Joseph of Arimathea', 'Saint, patron of funeral directors · Feast August 31',
  $payload${"slug":"saint-joseph-of-arimathea","canonicalName":"Saint Joseph of Arimathea","feastDay":"08-31","feastMonth":8,"feastDayOfMonth":31,"patronages":["funeral directors","pallbearers"],"biography":"Saint Joseph of Arimathea, a respected member of the Sanhedrin and a secret disciple of Jesus, did not consent to the council's condemnation of the Lord (Luke 23:50-51). After the Crucifixion he went boldly to Pilate and asked for the body of Jesus, wrapped it in fine linen with the help of Nicodemus, and laid it in his own new tomb, cut in the rock (Matthew 27:57-60; Mark 15:43-46; John 19:38-42). The Roman Martyrology commemorates him with Saint Nicodemus on August 31.","saintType":"other","canonizationStatus":"canonized","relatedPrayers":[],"relatedDevotions":[],"citations":["https://www.vatican.va/","https://www.newadvent.org/cathen/"],"contentSubtype":"saint_biography"}$payload$::jsonb,
  'VATICAN'::"SourceAuthorityLevel",
  true, CURRENT_TIMESTAMP, '66a21713b37d16d0', 1,
  8, 31, NULL, 'other', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ChecklistItem"
WHERE "contentType" = 'SAINT'::"ChecklistContentType" AND "canonicalSlug" = 'saint-joseph-of-arimathea'
  AND "approvalStatus" <> 'REJECTED'::"ChecklistApprovalStatus"
ON CONFLICT DO NOTHING;

INSERT INTO "PublishedContent" (
  "id", "checklistItemId", "contentType", "slug", "title", "subtitle", "payload", "authorityLevel",
  "isPublished", "publishedAt", "contentChecksum", "version",
  "feastMonth", "feastDayOfMonth", "sortYear", "subtype", "createdAt", "updatedAt"
)
SELECT 'cmubdf113xfh8uq66h7ivu09y', "id", 'SAINT'::"ChecklistContentType", 'saint-abraham-the-patriarch', 'Saint Abraham the Patriarch', 'Saint · Feast October 9',
  $payload${"slug":"saint-abraham-the-patriarch","canonicalName":"Saint Abraham the Patriarch","feastDay":"10-09","feastMonth":10,"feastDayOfMonth":9,"patronages":[],"biography":"Abraham, the father of all who believe (Romans 4:11), was called by God out of Ur of the Chaldeans to a land he did not know, and God made a covenant with him, promising that in his seed all the nations of the earth would be blessed (Genesis 12; 15; 22:18). He believed the promise against all hope, received his son Isaac in his old age, and was ready to offer him to God on the mountain God showed him. The Roman Canon names him 'our patriarch Abraham', and the Roman Martyrology commemorates him on October 9.","saintType":"other","canonizationStatus":"canonized","titleLabel":"Patriarch","relatedPrayers":[],"relatedDevotions":[],"citations":["https://www.vatican.va/","https://www.newadvent.org/cathen/"],"contentSubtype":"saint_biography"}$payload$::jsonb,
  'VATICAN'::"SourceAuthorityLevel",
  true, CURRENT_TIMESTAMP, '819c769116aa11ab', 1,
  10, 9, NULL, 'other', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ChecklistItem"
WHERE "contentType" = 'SAINT'::"ChecklistContentType" AND "canonicalSlug" = 'saint-abraham-the-patriarch'
  AND "approvalStatus" <> 'REJECTED'::"ChecklistApprovalStatus"
ON CONFLICT DO NOTHING;

INSERT INTO "PublishedContent" (
  "id", "checklistItemId", "contentType", "slug", "title", "subtitle", "payload", "authorityLevel",
  "isPublished", "publishedAt", "contentChecksum", "version",
  "feastMonth", "feastDayOfMonth", "sortYear", "subtype", "createdAt", "updatedAt"
)
SELECT 'cmvutljc0apm7jzjjhc22vnxr', "id", 'SAINT'::"ChecklistContentType", 'saint-moses-the-lawgiver', 'Saint Moses the Lawgiver', 'Saint · Feast September 4',
  $payload${"slug":"saint-moses-the-lawgiver","canonicalName":"Saint Moses the Lawgiver","feastDay":"09-04","feastMonth":9,"feastDayOfMonth":4,"patronages":[],"biography":"Moses, whom God called from the burning bush, led the people of Israel out of slavery in Egypt, through the Red Sea and across the desert toward the promised land (Exodus 3-19). On Mount Sinai he received the Law and the Ten Commandments (Exodus 20), and Scripture says that the Lord spoke to him face to face, as a man speaks to his friend (Exodus 33:11). He appeared with Elijah beside Christ at the Transfiguration (Matthew 17:3). The Roman Martyrology commemorates him on September 4.","saintType":"other","canonizationStatus":"canonized","titleLabel":"Prophet and lawgiver","relatedPrayers":[],"relatedDevotions":[],"citations":["https://www.vatican.va/","https://www.newadvent.org/cathen/"],"contentSubtype":"saint_biography"}$payload$::jsonb,
  'VATICAN'::"SourceAuthorityLevel",
  true, CURRENT_TIMESTAMP, 'c1a161c366c1bead', 1,
  9, 4, NULL, 'other', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ChecklistItem"
WHERE "contentType" = 'SAINT'::"ChecklistContentType" AND "canonicalSlug" = 'saint-moses-the-lawgiver'
  AND "approvalStatus" <> 'REJECTED'::"ChecklistApprovalStatus"
ON CONFLICT DO NOTHING;

INSERT INTO "PublishedContent" (
  "id", "checklistItemId", "contentType", "slug", "title", "subtitle", "payload", "authorityLevel",
  "isPublished", "publishedAt", "contentChecksum", "version",
  "feastMonth", "feastDayOfMonth", "sortYear", "subtype", "createdAt", "updatedAt"
)
SELECT 'cmpsn9mdzqm1byq94lidlpcyu', "id", 'SAINT'::"ChecklistContentType", 'saint-david-the-king', 'Saint David the King', 'Saint, patron of musicians · Feast December 29',
  $payload${"slug":"saint-david-the-king","canonicalName":"Saint David the King","feastDay":"12-29","feastMonth":12,"feastDayOfMonth":29,"patronages":["musicians","poets"],"biography":"David, the youngest son of Jesse of Bethlehem, was a shepherd when the prophet Samuel anointed him king of Israel (1 Samuel 16). He overcame Goliath, made Jerusalem his capital and brought the Ark of the Covenant there. Though he fell gravely into sin, he repented with all his heart, and the Church still prays his sorrow in the psalm Miserere. The Psalms are prayed under his name, and God promised him a throne that would stand forever (2 Samuel 7), a promise fulfilled in Jesus Christ, the Son of David (Luke 1:32). The Roman Martyrology commemorates him on December 29.","saintType":"other","canonizationStatus":"canonized","titleLabel":"King and prophet","relatedPrayers":[],"relatedDevotions":[],"citations":["https://www.vatican.va/","https://www.newadvent.org/cathen/"],"contentSubtype":"saint_biography"}$payload$::jsonb,
  'VATICAN'::"SourceAuthorityLevel",
  true, CURRENT_TIMESTAMP, '70b20b1f493a0743', 1,
  12, 29, NULL, 'other', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ChecklistItem"
WHERE "contentType" = 'SAINT'::"ChecklistContentType" AND "canonicalSlug" = 'saint-david-the-king'
  AND "approvalStatus" <> 'REJECTED'::"ChecklistApprovalStatus"
ON CONFLICT DO NOTHING;

INSERT INTO "PublishedContent" (
  "id", "checklistItemId", "contentType", "slug", "title", "subtitle", "payload", "authorityLevel",
  "isPublished", "publishedAt", "contentChecksum", "version",
  "feastMonth", "feastDayOfMonth", "sortYear", "subtype", "createdAt", "updatedAt"
)
SELECT 'cmqt3n7ycgvqqdovab2d7qjun', "id", 'SAINT'::"ChecklistContentType", 'saint-isaiah-the-prophet', 'Saint Isaiah the Prophet', 'Saint · Feast May 9',
  $payload${"slug":"saint-isaiah-the-prophet","canonicalName":"Saint Isaiah the Prophet","feastDay":"05-09","feastMonth":5,"feastDayOfMonth":9,"patronages":[],"biography":"Isaiah, who prophesied in Jerusalem in the eighth century before Christ, saw the Lord enthroned in the Temple, heard the seraphim cry 'Holy, holy, holy', and answered God's call: 'Lo, here am I, send me' (Isaiah 6). He foretold that a virgin would conceive and bear a son called Emmanuel (Isaiah 7:14) and described the Servant who would be wounded for our iniquities (Isaiah 53), so that the Fathers called him the evangelist of the Old Testament. Tradition holds that he was martyred under King Manasseh. The Roman Martyrology commemorates him on May 9.","saintType":"other","canonizationStatus":"canonized","titleLabel":"Prophet","relatedPrayers":[],"relatedDevotions":[],"citations":["https://www.vatican.va/","https://www.newadvent.org/cathen/"],"contentSubtype":"saint_biography"}$payload$::jsonb,
  'VATICAN'::"SourceAuthorityLevel",
  true, CURRENT_TIMESTAMP, '588ef8116ceb838f', 1,
  5, 9, NULL, 'other', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ChecklistItem"
WHERE "contentType" = 'SAINT'::"ChecklistContentType" AND "canonicalSlug" = 'saint-isaiah-the-prophet'
  AND "approvalStatus" <> 'REJECTED'::"ChecklistApprovalStatus"
ON CONFLICT DO NOTHING;

INSERT INTO "PublishedContent" (
  "id", "checklistItemId", "contentType", "slug", "title", "subtitle", "payload", "authorityLevel",
  "isPublished", "publishedAt", "contentChecksum", "version",
  "feastMonth", "feastDayOfMonth", "sortYear", "subtype", "createdAt", "updatedAt"
)
SELECT 'cmzpeuff449ib003xn75eq6br', "id", 'SAINT'::"ChecklistContentType", 'saint-jeremiah-the-prophet', 'Saint Jeremiah the Prophet', 'Saint · Feast May 1',
  $payload${"slug":"saint-jeremiah-the-prophet","canonicalName":"Saint Jeremiah the Prophet","feastDay":"05-01","feastMonth":5,"feastDayOfMonth":1,"patronages":[],"biography":"Jeremiah, called by God as a young man (Jeremiah 1:4-10), prophesied in Jerusalem for some forty years before it fell to Babylon in 587 BC. He warned king and people to turn back to the Lord and suffered mockery, imprisonment and a cistern of mire for it, yet he also foretold the new covenant that God would write upon the heart (Jeremiah 31:31-34). Tradition holds that he died a martyr in Egypt. The Roman Martyrology commemorates him on May 1.","saintType":"other","canonizationStatus":"canonized","titleLabel":"Prophet","relatedPrayers":[],"relatedDevotions":[],"citations":["https://www.vatican.va/","https://www.newadvent.org/cathen/"],"contentSubtype":"saint_biography"}$payload$::jsonb,
  'VATICAN'::"SourceAuthorityLevel",
  true, CURRENT_TIMESTAMP, 'e8cb0e3e588b78c3', 1,
  5, 1, NULL, 'other', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ChecklistItem"
WHERE "contentType" = 'SAINT'::"ChecklistContentType" AND "canonicalSlug" = 'saint-jeremiah-the-prophet'
  AND "approvalStatus" <> 'REJECTED'::"ChecklistApprovalStatus"
ON CONFLICT DO NOTHING;

INSERT INTO "PublishedContent" (
  "id", "checklistItemId", "contentType", "slug", "title", "subtitle", "payload", "authorityLevel",
  "isPublished", "publishedAt", "contentChecksum", "version",
  "feastMonth", "feastDayOfMonth", "sortYear", "subtype", "createdAt", "updatedAt"
)
SELECT 'cmb4extdtkilga7s0yycx1rxn', "id", 'SAINT'::"ChecklistContentType", 'saint-ezekiel-the-prophet', 'Saint Ezekiel the Prophet', 'Saint · Feast July 23',
  $payload${"slug":"saint-ezekiel-the-prophet","canonicalName":"Saint Ezekiel the Prophet","feastDay":"07-23","feastMonth":7,"feastDayOfMonth":23,"patronages":[],"biography":"Ezekiel, a priest taken into exile in Babylon in 597 BC, was called to be a prophet beside the River Chebar, where he saw the glory of the Lord (Ezekiel 1). He told the exiles of the fall of Jerusalem and then of its restoration. He spoke of God as the shepherd who seeks his lost sheep (Ezekiel 34), promised a new heart and a new spirit (Ezekiel 36:26), and saw the dry bones live again (Ezekiel 37). The Roman Martyrology commemorates him on July 23.","saintType":"other","canonizationStatus":"canonized","titleLabel":"Prophet","relatedPrayers":[],"relatedDevotions":[],"citations":["https://www.vatican.va/","https://www.newadvent.org/cathen/"],"contentSubtype":"saint_biography"}$payload$::jsonb,
  'VATICAN'::"SourceAuthorityLevel",
  true, CURRENT_TIMESTAMP, '5fb6ffab71fd1fd3', 1,
  7, 23, NULL, 'other', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ChecklistItem"
WHERE "contentType" = 'SAINT'::"ChecklistContentType" AND "canonicalSlug" = 'saint-ezekiel-the-prophet'
  AND "approvalStatus" <> 'REJECTED'::"ChecklistApprovalStatus"
ON CONFLICT DO NOTHING;

INSERT INTO "PublishedContent" (
  "id", "checklistItemId", "contentType", "slug", "title", "subtitle", "payload", "authorityLevel",
  "isPublished", "publishedAt", "contentChecksum", "version",
  "feastMonth", "feastDayOfMonth", "sortYear", "subtype", "createdAt", "updatedAt"
)
SELECT 'cmxymlmq0l5xwf03rxiadgxk3', "id", 'SAINT'::"ChecklistContentType", 'saint-daniel-the-prophet', 'Saint Daniel the Prophet', 'Saint · Feast July 21',
  $payload${"slug":"saint-daniel-the-prophet","canonicalName":"Saint Daniel the Prophet","feastDay":"07-21","feastMonth":7,"feastDayOfMonth":21,"patronages":[],"biography":"Daniel, a young man of Judah taken to Babylon in the exile, stayed faithful to the Law of God at the court of its kings. God gave him understanding of dreams and visions. He was cast into the lions' den for praying to the Lord and came out unharmed (Daniel 6), and he saw one like the son of man coming with the clouds of heaven, to whom an everlasting kingdom was given (Daniel 7:13-14), the title Jesus took for himself. Earlier editions of the Roman Martyrology commemorated him on July 21.","saintType":"other","canonizationStatus":"canonized","titleLabel":"Prophet","relatedPrayers":[],"relatedDevotions":[],"citations":["https://www.vatican.va/","https://www.newadvent.org/cathen/"],"contentSubtype":"saint_biography"}$payload$::jsonb,
  'VATICAN'::"SourceAuthorityLevel",
  true, CURRENT_TIMESTAMP, '8b2284e4bc7a7cc8', 1,
  7, 21, NULL, 'other', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ChecklistItem"
WHERE "contentType" = 'SAINT'::"ChecklistContentType" AND "canonicalSlug" = 'saint-daniel-the-prophet'
  AND "approvalStatus" <> 'REJECTED'::"ChecklistApprovalStatus"
ON CONFLICT DO NOTHING;
