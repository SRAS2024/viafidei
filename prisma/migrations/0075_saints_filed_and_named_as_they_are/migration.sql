-- @idempotent-recoverable
--
-- Saints filed under what they were, and named as the Church names them.
--
-- WHY: the saint list's filters showed saints under the wrong calling. Under Popes stood two
-- bishops of Alexandria, whom the Coptic Church styles "Pope" (Dionysius the Great and
-- Alexander), the bishops Dionysius of Vienne, Peregrine of Auxerre, Eutropius of Saintes
-- and Hunfrid of Prum, the abbots Walter of Pontoise and Inigo of Ona, the hermit Menas of
-- Samnium and the Cristero martyr Manuel Morales: an early import read "Pope" in a
-- sentence such as "canonized by Pope John Paul II". Under Bishops stood Saint Olaf, a king
-- venerated as a martyr. Under Apostles and Evangelists stood Dubricius, a sixth-century
-- Welsh bishop, and disciples whom Wikidata gives the Eastern title "Apostle of the
-- Seventy": the Church calls the Twelve, Matthias, Paul and Barnabas Apostles, and Mark and
-- Luke the other Evangelists. The real Popes Mark and Dionysius keep their places. Each
-- record was checked against the Roman Martyrology (1916 and 2004) and the Catholic
-- Encyclopedia: a see the current Martyrology no longer gives (Epaphroditus at Terracina)
-- or no source gives (Joseph Barsabbas) is not claimed, and Eutropius is filed as the
-- bishop the current Martyrology names, without the martyrdom the 1916 edition gave him.
-- The import and the repair sweep now derive these types the same way (deriveSaintType in
-- src/lib/admin-worker/structured/saint-facts.ts), and the subtitle, which names the type,
-- is re-projected with it. Saints whose record the sweep cannot prove keep what is set here.
--
-- The names: "Pope Dionysius of Alexandria" was one of the homepage's featured saints, and
-- the Roman Martyrology calls him and Alexander bishops of Alexandria, so their titles drop
-- the Coptic style (the import now does the same). "Saint Sankt Villehad af Danmark"
-- carried the Danish word for Saint after the English one: he is Willehad of Denmark, one of
-- the Franciscans taken at Gorkum in 1572 (Catholic Encyclopedia, "The Martyrs of
-- Gorkum"), and his biography, which describes those martyrs, now says that he was one of
-- them. The checklist item's name moves with the title, as in migration 0070.
--
-- The freshness marker of a changed row is cleared rather than left stale: it is a hash that
-- only the application computes, the verifier accepts a row without one, and the next update
-- through the application stamps it again.
--
-- Deploy safety: short targeted updates, no schema change. Safe to run again: each row is
-- changed only while it still holds exactly the old type, title or opening words.
SET LOCAL lock_timeout = '5s';

WITH filed("slug", "oldType", "newType", "oldSubtitle", "newSubtitle") AS (VALUES
  ('saint-pope-dionysius-of-alexandria', 'pope', 'bishop',
   'Pope · Feast April 8',
   'Bishop · Feast April 8'),
  ('saint-pope-alexandros-of-alexandria', 'pope', 'bishop',
   'Pope · Feast February 26',
   'Bishop · Feast February 26'),
  ('saint-dionysius-of-vienne', 'pope', 'bishop',
   'Pope · Feast May 8',
   'Bishop · Feast May 8'),
  ('saint-peregrine-of-auxerre', 'pope', 'bishop',
   'Pope, patron of against snake bites · Feast May 16',
   'Bishop, patron against snake bites · Feast May 16'),
  ('saint-hunfrid-of-prum', 'pope', 'bishop',
   'Pope, patron of His specific patronages are not recorded · Feast March 8',
   'Bishop · Feast March 8'),
  ('saint-walter-of-pontoise', 'pope', 'religious',
   'Pope, patron of Prisoners · Feast March 23',
   'Religious, patron of Prisoners · Feast March 23'),
  ('saint-eutropius-of-saintes', 'pope', 'bishop',
   'Pope · Feast April 30',
   'Bishop · Feast April 30'),
  ('saint-inigo-of-ona', 'pope', 'religious',
   'Venerable · Pope · Feast June 1',
   'Venerable · Religious · Feast June 1'),
  ('saint-manuel-morales', 'pope', 'martyr',
   'Pope · Feast May 21',
   'Martyr · Feast May 21'),
  ('saint-menas-of-samnium', 'pope', 'religious',
   'Pope · Feast November 11',
   'Religious · Feast November 11'),
  ('saint-olaf-ii-of-norway', 'bishop', 'martyr',
   'Bishop · Feast July 29',
   'Martyr · Feast July 29'),
  ('saint-dubricius', 'evangelist', 'bishop',
   'Evangelist · Feast November 14',
   'Bishop · Feast November 14'),
  ('saint-phoebe', 'apostle', 'other',
   'Apostle · Feast September 3',
   'Saint · Feast September 3'),
  ('saint-junia', 'apostle', 'other',
   'Apostle · Feast May 17',
   'Saint · Feast May 17'),
  ('saint-apollos', 'apostle', 'other',
   'Apostle · Feast February 13',
   'Saint · Feast February 13'),
  ('saint-crescens', 'apostle', 'bishop',
   'Apostle · Feast June 27',
   'Bishop · Feast June 27'),
  ('saint-epaphroditus', 'apostle', 'other',
   'Apostle · Feast March 22',
   'Saint · Feast March 22'),
  ('saint-ephigenia-of-ethiopia', 'apostle', 'other',
   'Apostle · Feast September 21',
   'Saint · Feast September 21'),
  ('saint-joseph-barsabbas', 'apostle', 'other',
   'Apostle · Feast July 20',
   'Saint · Feast July 20'),
  ('saint-philip-the-evangelist', 'apostle', 'other',
   'Apostle · Feast October 11',
   'Saint · Feast October 11'),
  ('saint-prochorus', 'apostle', 'bishop',
   'Apostle · Feast July 28',
   'Bishop · Feast July 28'),
  ('saint-simeon-of-jerusalem', 'apostle', 'martyr',
   'Apostle · Feast April 27',
   'Martyr · Feast April 27')
)
UPDATE "PublishedContent" AS content
SET "payload" = jsonb_set(content."payload", '{saintType}', to_jsonb(filed."newType")),
    "subtype" = filed."newType",
    "subtitle" = CASE
      WHEN content."subtitle" = filed."oldSubtitle" THEN filed."newSubtitle"
      ELSE content."subtitle"
    END,
    "contentChecksum" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
FROM filed
WHERE content."contentType" = 'SAINT'::"ChecklistContentType"
  AND content."slug" = filed."slug"
  AND content."payload"->>'saintType' = filed."oldType";

WITH named("slug", "oldTitle", "newTitle", "oldName", "newName") AS (VALUES
  ('saint-pope-dionysius-of-alexandria', 'Pope Dionysius of Alexandria', 'Saint Dionysius of Alexandria',
   'Pope Dionysius of Alexandria', 'Pope Dionysius of Alexandria'),
  ('saint-pope-alexandros-of-alexandria', 'Pope Alexandros of Alexandria', 'Saint Alexander of Alexandria',
   'Pope Alexandros of Alexandria', 'Alexander of Alexandria'),
  ('saint-sankt-villehad-af-danmark', 'Saint Sankt Villehad af Danmark', 'Saint Willehad of Denmark',
   'Sankt Villehad af Danmark', 'Willehad of Denmark')
)
UPDATE "PublishedContent" AS content
SET "title" = named."newTitle",
    "payload" = content."payload"
      || CASE WHEN content."payload"->>'canonicalName' = named."oldName"
           THEN jsonb_build_object('canonicalName', named."newName") ELSE '{}'::jsonb END
      || CASE WHEN content."payload"->>'title' = named."oldTitle"
           THEN jsonb_build_object('title', named."newTitle") ELSE '{}'::jsonb END,
    "contentChecksum" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
FROM named
WHERE content."contentType" = 'SAINT'::"ChecklistContentType"
  AND content."slug" = named."slug"
  AND content."title" = named."oldTitle";

WITH named("slug", "oldTitle", "newTitle", "oldName") AS (VALUES
  ('saint-pope-dionysius-of-alexandria', 'Pope Dionysius of Alexandria', 'Saint Dionysius of Alexandria',
   'Pope Dionysius of Alexandria'),
  ('saint-pope-alexandros-of-alexandria', 'Pope Alexandros of Alexandria', 'Saint Alexander of Alexandria',
   'Pope Alexandros of Alexandria'),
  ('saint-sankt-villehad-af-danmark', 'Saint Sankt Villehad af Danmark', 'Saint Willehad of Denmark',
   'Sankt Villehad af Danmark')
)
UPDATE "ChecklistItem" AS item
SET "canonicalName" = named."newTitle",
    "updatedAt" = CURRENT_TIMESTAMP
FROM named
WHERE item."contentType" = 'SAINT'::"ChecklistContentType"
  AND item."canonicalSlug" = named."slug"
  AND item."canonicalName" IN (named."oldTitle", named."oldName");

UPDATE "PublishedContent"
SET "payload" = jsonb_set(
      "payload",
      '{biography}',
      to_jsonb('Willehad of Denmark, a Franciscan friar and priest, was one of the Martyrs of Gorkum. ' || ("payload"->>'biography'))
    ),
    "contentChecksum" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "contentType" = 'SAINT'::"ChecklistContentType"
  AND "slug" = 'saint-sankt-villehad-af-danmark'
  AND "payload"->>'biography' LIKE 'The Martyrs of Gorkum were a group of 19 %';
