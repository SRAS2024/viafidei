-- @idempotent-recoverable
--
-- The novenas' Background, true where it now stands.
--
-- WHY: the novena pages now read title, facts, summary, days, prayers and then Background.
-- The stored backgrounds were written for the old order, so they point down at days that
-- are now above them ("the day-by-day subjects below are editorial"). Some send the reader
-- to a source the page does not print, and 22 of them carry a raw slug or the enum word
-- PRAYER in reader text, which a screen reader spells out. The curated knowledge base
-- (src/lib/checklist/knowledge/novenas) now says all this properly and the worker's curated
-- sync would carry it across on its next pass, but the pages must read right on the day
-- this deploys, whether or not a worker is running. Sentences about the day meditations
-- stay stored and are left out when the page is shown, in novenaBackgroundForDisplay
-- (src/lib/content-shared/structured-content.ts), so that they can come back.
--
-- Every change below was read by hand. A test holds this file to the curated entries
-- (tests/db/novena-background-migration.test.ts).
--
-- The freshness marker of a changed row is cleared rather than left stale: it is a hash
-- that only the application computes, the verifier accepts a row without one, and the next
-- update through the application stamps it again.
--
-- Deploy safety: short targeted updates, no schema change, no version row, nothing but the
-- words named here. Safe to run again, and a no-op on a row whose text does not match: once
-- a row is corrected the old words are no longer in it.
SET LOCAL lock_timeout = '5s';

-- Background reads after the days now, so "below" means above, and what follows is what came before.

UPDATE "PublishedContent"
SET "payload" = jsonb_set("payload", '{background}', to_jsonb(replace("payload"->>'background',
      'The day-by-day subjects below',
      'The day-by-day subjects above'))),
    "contentChecksum" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "contentType" = 'NOVENA'::"ChecklistContentType"
  AND "slug" IN (
    'novena-sacred-heart-of-jesus',
    'novena-saint-george',
    'novena-saint-blaise',
    'novena-saint-erasmus',
    'novena-saint-pantaleon',
    'novena-saint-vitus',
    'novena-saint-christopher',
    'novena-saint-denis',
    'novena-saint-cyriacus',
    'novena-saint-achatius',
    'novena-saint-eustace',
    'novena-saint-giles',
    'novena-saint-margaret-of-antioch',
    'novena-saint-catherine-of-alexandria',
    'novena-saint-barbara',
    'novena-nativity-of-our-lady'
  )
  AND strpos("payload"->>'background', 'The day-by-day subjects below') > 0;

UPDATE "PublishedContent"
SET "payload" = jsonb_set("payload", '{background}', to_jsonb(replace("payload"->>'background',
      'what follows names the day''s intention',
      'what is given above names the day''s intention'))),
    "contentChecksum" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "contentType" = 'NOVENA'::"ChecklistContentType"
  AND "slug" = 'divine-mercy-novena'
  AND strpos("payload"->>'background', 'what follows names the day''s intention') > 0;

UPDATE "PublishedContent"
SET "payload" = jsonb_set("payload", '{background}', to_jsonb(replace("payload"->>'background',
      'The nine prayers below',
      'The nine prayers above'))),
    "contentChecksum" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "contentType" = 'NOVENA'::"ChecklistContentType"
  AND "slug" = 'novena-saint-therese'
  AND strpos("payload"->>'background', 'The nine prayers below') > 0;

UPDATE "PublishedContent"
SET "payload" = jsonb_set("payload", '{background}', to_jsonb(replace("payload"->>'background',
      'given below, and',
      'given above, and'))),
    "contentChecksum" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "contentType" = 'NOVENA'::"ChecklistContentType"
  AND "slug" = 'novena-saint-joseph'
  AND strpos("payload"->>'background', 'given below, and') > 0;

UPDATE "PublishedContent"
SET "payload" = jsonb_set("payload", '{background}', to_jsonb(replace("payload"->>'background',
      'the day-by-day distinction below lies in the meditation,',
      'the day-by-day distinction above lies in the subject for meditation,'))),
    "contentChecksum" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "contentType" = 'NOVENA'::"ChecklistContentType"
  AND "slug" = 'novena-immaculate-conception'
  AND strpos("payload"->>'background', 'the day-by-day distinction below lies in the meditation,') > 0;

UPDATE "PublishedContent"
SET "payload" = jsonb_set("payload", '{background}', to_jsonb(replace("payload"->>'background',
      'the nine meditation subjects below',
      'the nine meditation subjects above'))),
    "contentChecksum" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "contentType" = 'NOVENA'::"ChecklistContentType"
  AND "slug" = 'novena-our-lady-of-perpetual-help'
  AND strpos("payload"->>'background', 'the nine meditation subjects below') > 0;

UPDATE "PublishedContent"
SET "payload" = jsonb_set("payload", '{background}', to_jsonb(replace("payload"->>'background',
      'the nine subjects below',
      'the nine subjects above'))),
    "contentChecksum" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "contentType" = 'NOVENA'::"ChecklistContentType"
  AND "slug" = 'novena-saint-andrew-christmas'
  AND strpos("payload"->>'background', 'the nine subjects below') > 0;

UPDATE "PublishedContent"
SET "payload" = jsonb_set("payload", '{background}', to_jsonb(replace("payload"->>'background',
      'the nine days below',
      'the nine days above'))),
    "contentChecksum" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "contentType" = 'NOVENA'::"ChecklistContentType"
  AND "slug" = 'novena-fifty-four-day-rosary'
  AND strpos("payload"->>'background', 'the nine days below') > 0;

UPDATE "PublishedContent"
SET "payload" = jsonb_set("payload", '{background}', to_jsonb(replace("payload"->>'background',
      'The prayer below is said',
      'The prayer above is said'))),
    "contentChecksum" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "contentType" = 'NOVENA'::"ChecklistContentType"
  AND "slug" = 'novena-holy-family'
  AND strpos("payload"->>'background', 'The prayer below is said') > 0;

UPDATE "PublishedContent"
SET "payload" = jsonb_set("payload", '{background}', to_jsonb(replace("payload"->>'background',
      'the day-by-day subjects below',
      'the day-by-day subjects above'))),
    "contentChecksum" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "contentType" = 'NOVENA'::"ChecklistContentType"
  AND "slug" IN (
    'novena-holy-souls-in-purgatory',
    'novena-holy-name-of-jesus',
    'novena-christ-the-king',
    'novena-corpus-christi',
    'novena-of-grace-saint-francis-xavier',
    'novena-saint-rita-of-cascia',
    'novena-saint-peregrine',
    'novena-saint-gerard-majella',
    'novena-saint-francis-of-assisi',
    'novena-saint-benedict',
    'novena-saint-patrick'
  )
  AND strpos("payload"->>'background', 'the day-by-day subjects below') > 0;

UPDATE "PublishedContent"
SET "payload" = jsonb_set("payload", '{background}', to_jsonb(replace("payload"->>'background',
      'the subjects below',
      'the subjects above'))),
    "contentChecksum" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "contentType" = 'NOVENA'::"ChecklistContentType"
  AND "slug" IN (
    'novena-saint-michael-the-archangel',
    'novena-guardian-angel',
    'novena-precious-blood'
  )
  AND strpos("payload"->>'background', 'the subjects below') > 0;

UPDATE "PublishedContent"
SET "payload" = jsonb_set("payload", '{background}', to_jsonb(replace("payload"->>'background',
      'The prayers below are',
      'The prayers above are'))),
    "contentChecksum" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "contentType" = 'NOVENA'::"ChecklistContentType"
  AND "slug" IN (
    'novena-saint-anne',
    'novena-saint-jude'
  )
  AND strpos("payload"->>'background', 'The prayers below are') > 0;

UPDATE "PublishedContent"
SET "payload" = jsonb_set("payload", '{background}', to_jsonb(replace("payload"->>'background',
      'The prayer below comes',
      'The prayer above comes'))),
    "contentChecksum" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "contentType" = 'NOVENA'::"ChecklistContentType"
  AND "slug" = 'novena-saint-patrick'
  AND strpos("payload"->>'background', 'The prayer below comes') > 0;

UPDATE "PublishedContent"
SET "payload" = jsonb_set("payload", '{background}', to_jsonb(replace("payload"->>'background',
      'The meditations below are',
      'The meditations above are'))),
    "contentChecksum" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "contentType" = 'NOVENA'::"ChecklistContentType"
  AND "slug" = 'novena-fourteen-holy-helpers'
  AND strpos("payload"->>'background', 'The meditations below are') > 0;

UPDATE "PublishedContent"
SET "payload" = jsonb_set("payload", '{background}', to_jsonb(replace("payload"->>'background',
      'in the day meditations below',
      'in the day meditations above'))),
    "contentChecksum" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "contentType" = 'NOVENA'::"ChecklistContentType"
  AND "slug" IN (
    'novena-sacred-heart-saint-alphonsus',
    'novena-our-lady-of-lourdes'
  )
  AND strpos("payload"->>'background', 'in the day meditations below') > 0;

UPDATE "PublishedContent"
SET "payload" = jsonb_set("payload", '{background}', to_jsonb(replace("payload"->>'background',
      'his own meditations and the prayers below are in the cited source.',
      'his own meditations are not reproduced here, and the prayers above are his own.'))),
    "contentChecksum" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "contentType" = 'NOVENA'::"ChecklistContentType"
  AND "slug" = 'novena-christmas-saint-alphonsus'
  AND strpos("payload"->>'background', 'his own meditations and the prayers below are in the cited source.') > 0;

-- A source the page does not print is no longer called cited.

UPDATE "PublishedContent"
SET "payload" = jsonb_set("payload", '{background}', to_jsonb(replace("payload"->>'background',
      'are printed with it in the cited source and may be added',
      'are printed with it elsewhere and may be added'))),
    "contentChecksum" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "contentType" = 'NOVENA'::"ChecklistContentType"
  AND "slug" = 'novena-holy-family'
  AND strpos("payload"->>'background', 'are printed with it in the cited source and may be added') > 0;

UPDATE "PublishedContent"
SET "payload" = jsonb_set("payload", '{background}', to_jsonb(replace("payload"->>'background',
      'The cited source rightly adds',
      'The source of this novena rightly adds'))),
    "contentChecksum" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "contentType" = 'NOVENA'::"ChecklistContentType"
  AND "slug" = 'novena-holy-souls-in-purgatory'
  AND strpos("payload"->>'background', 'The cited source rightly adds') > 0;

UPDATE "PublishedContent"
SET "payload" = jsonb_set("payload", '{background}', to_jsonb(replace("payload"->>'background',
      'in the cited edition',
      'in that edition'))),
    "contentChecksum" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "contentType" = 'NOVENA'::"ChecklistContentType"
  AND "slug" = 'novena-saint-philip-neri'
  AND strpos("payload"->>'background', 'in the cited edition') > 0;

UPDATE "PublishedContent"
SET "payload" = jsonb_set("payload", '{background}', to_jsonb(replace("payload"->>'background',
      'the copy cited catalogued',
      'the copy used catalogued'))),
    "contentChecksum" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "contentType" = 'NOVENA'::"ChecklistContentType"
  AND "slug" IN (
    'novena-blessed-virgin-golden-manual',
    'novena-saint-john-the-baptist',
    'novena-sacred-heart-golden-manual'
  )
  AND strpos("payload"->>'background', 'the copy cited catalogued') > 0;

-- A raw slug or the enum word PRAYER becomes the item's title.

UPDATE "PublishedContent"
SET "payload" = jsonb_set("payload", '{background}', to_jsonb(replace("payload"->>'background',
      'as the PRAYER tota-pulchra-es-maria.',
      'as the prayer Tota Pulchra Es, Maria (All Fair Art Thou, O Mary).'))),
    "contentChecksum" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "contentType" = 'NOVENA'::"ChecklistContentType"
  AND "slug" = 'novena-immaculate-conception-raccolta'
  AND strpos("payload"->>'background', 'as the PRAYER tota-pulchra-es-maria.') > 0;

UPDATE "PublishedContent"
SET "payload" = jsonb_set("payload", '{background}', to_jsonb(replace("payload"->>'background',
      'that the Raccolta translates separately (the PRAYERs prayer-to-saint-philip-neri-for-humility-sunday, -for-the-love-of-god-wednesday, -for-purity-tuesday and -for-patience-monday).',
      'that the Raccolta translates separately: the Prayer to St Philip Neri for Humility (for Sunday), the Prayer to St Philip Neri for the Love of God (for Wednesday), the Prayer to St Philip Neri for Purity (for Tuesday) and the Prayer to St Philip Neri for Patience (for Monday).'))),
    "contentChecksum" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "contentType" = 'NOVENA'::"ChecklistContentType"
  AND "slug" = 'novena-saint-philip-neri'
  AND strpos("payload"->>'background', 'that the Raccolta translates separately (the PRAYERs prayer-to-saint-philip-neri-for-humility-sunday, -for-the-love-of-god-wednesday, -for-purity-tuesday and -for-patience-monday).') > 0;

UPDATE "PublishedContent"
SET "payload" = jsonb_set("payload", '{background}', to_jsonb(replace("payload"->>'background',
      'the Novena to Saint Anthony of Padua (novena-saint-anthony) in this catalogue',
      'the Novena to Saint Anthony of Padua in this catalogue'))),
    "contentChecksum" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "contentType" = 'NOVENA'::"ChecklistContentType"
  AND "slug" = 'novena-nine-tuesdays-saint-anthony'
  AND strpos("payload"->>'background', 'the Novena to Saint Anthony of Padua (novena-saint-anthony) in this catalogue') > 0;

UPDATE "PublishedContent"
SET "payload" = jsonb_set("payload", '{background}', to_jsonb(replace("payload"->>'background',
      'as the PRAYER si-quaeris-miracula.',
      'as the prayer Si Quaeris Miracula (Responsory of St. Anthony).'))),
    "contentChecksum" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "contentType" = 'NOVENA'::"ChecklistContentType"
  AND "slug" = 'novena-nine-tuesdays-saint-anthony'
  AND strpos("payload"->>'background', 'as the PRAYER si-quaeris-miracula.') > 0;

UPDATE "PublishedContent"
SET "payload" = jsonb_set("payload", '{background}', to_jsonb(replace("payload"->>'background',
      'as the PRAYER devotion-to-the-sorrowful-heart-of-mary.',
      'as the prayer Devotion to the Sorrowful Heart of Mary (I Compassionate Thee).'))),
    "contentChecksum" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "contentType" = 'NOVENA'::"ChecklistContentType"
  AND "slug" = 'novena-seven-sorrows-of-mary'
  AND strpos("payload"->>'background', 'as the PRAYER devotion-to-the-sorrowful-heart-of-mary.') > 0;

UPDATE "PublishedContent"
SET "payload" = jsonb_set("payload", '{background}', to_jsonb(replace("payload"->>'background',
      'the Novena to Saint Francis of Assisi (novena-saint-francis-of-assisi) in this catalogue',
      'the Novena to Saint Francis of Assisi in this catalogue'))),
    "contentChecksum" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "contentType" = 'NOVENA'::"ChecklistContentType"
  AND "slug" = 'novena-saint-francis-of-assisi-ara-coeli'
  AND strpos("payload"->>'background', 'the Novena to Saint Francis of Assisi (novena-saint-francis-of-assisi) in this catalogue') > 0;

UPDATE "PublishedContent"
SET "payload" = jsonb_set("payload", '{background}', to_jsonb(replace("payload"->>'background',
      'as the PRAYER pressi-malorum-pondere-responsory-of-saint-paul.',
      'as the prayer Pressi Malorum Pondere (Responsory of St Paul).'))),
    "contentChecksum" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "contentType" = 'NOVENA'::"ChecklistContentType"
  AND "slug" = 'novena-saint-paul-the-apostle'
  AND strpos("payload"->>'background', 'as the PRAYER pressi-malorum-pondere-responsory-of-saint-paul.') > 0;

UPDATE "PublishedContent"
SET "payload" = jsonb_set("payload", '{background}', to_jsonb(replace("payload"->>'background',
      'as the PRAYER act-of-reparation-for-blasphemies-against-our-lady.',
      'as the prayer Act of Reparation for Blasphemies against Our Lady.'))),
    "contentChecksum" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "contentType" = 'NOVENA'::"ChecklistContentType"
  AND "slug" = 'novena-our-lady-of-sorrows-lings'
  AND strpos("payload"->>'background', 'as the PRAYER act-of-reparation-for-blasphemies-against-our-lady.') > 0;

UPDATE "PublishedContent"
SET "payload" = jsonb_set("payload", '{background}', to_jsonb(replace("payload"->>'background',
      'the Novena in Honour of Saint Joseph (novena-saint-joseph) in this catalogue',
      'the Novena in Honour of Saint Joseph in this catalogue'))),
    "contentChecksum" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "contentType" = 'NOVENA'::"ChecklistContentType"
  AND "slug" = 'novena-saint-joseph-lings'
  AND strpos("payload"->>'background', 'the Novena in Honour of Saint Joseph (novena-saint-joseph) in this catalogue') > 0;

UPDATE "PublishedContent"
SET "payload" = jsonb_set("payload", '{background}', to_jsonb(replace("payload"->>'background',
      'published in another version as the PRAYER memorare-to-saint-joseph.',
      'published in another version under that title.'))),
    "contentChecksum" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "contentType" = 'NOVENA'::"ChecklistContentType"
  AND "slug" = 'novena-saint-joseph-lings'
  AND strpos("payload"->>'background', 'published in another version as the PRAYER memorare-to-saint-joseph.') > 0;

UPDATE "PublishedContent"
SET "payload" = jsonb_set("payload", '{background}', to_jsonb(replace("payload"->>'background',
      'as the PRAYER prayer-to-saint-anne-with-deep-and-heartfelt-veneration;',
      'as the Prayer to St Anne (With Deep and Heartfelt Veneration);'))),
    "contentChecksum" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "contentType" = 'NOVENA'::"ChecklistContentType"
  AND "slug" = 'novena-saint-anne-lings'
  AND strpos("payload"->>'background', 'as the PRAYER prayer-to-saint-anne-with-deep-and-heartfelt-veneration;') > 0;

UPDATE "PublishedContent"
SET "payload" = jsonb_set("payload", '{background}', to_jsonb(replace("payload"->>'background',
      'the Novena to Saint Anne (novena-saint-anne) in this catalogue',
      'the Novena to Saint Anne in this catalogue'))),
    "contentChecksum" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "contentType" = 'NOVENA'::"ChecklistContentType"
  AND "slug" = 'novena-saint-anne-lings'
  AND strpos("payload"->>'background', 'the Novena to Saint Anne (novena-saint-anne) in this catalogue') > 0;

UPDATE "PublishedContent"
SET "payload" = jsonb_set("payload", '{background}', to_jsonb(replace("payload"->>'background',
      'as the PRAYER si-vis-patronum-responsory-of-saint-peter.',
      'as the prayer Si Vis Patronum Quærere (Responsory of St Peter).'))),
    "contentChecksum" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "contentType" = 'NOVENA'::"ChecklistContentType"
  AND "slug" = 'novena-saint-peter'
  AND strpos("payload"->>'background', 'as the PRAYER si-vis-patronum-responsory-of-saint-peter.') > 0;

UPDATE "PublishedContent"
SET "payload" = jsonb_set("payload", '{background}', to_jsonb(replace("payload"->>'background',
      'as the PRAYER prayer-to-the-eternal-father-offering-the-sacred-heart.',
      'as the Prayer to the Eternal Father Offering the Sacred Heart of Jesus.'))),
    "contentChecksum" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "contentType" = 'NOVENA'::"ChecklistContentType"
  AND "slug" = 'novena-feast-of-the-sacred-heart-lings'
  AND strpos("payload"->>'background', 'as the PRAYER prayer-to-the-eternal-father-offering-the-sacred-heart.') > 0;

UPDATE "PublishedContent"
SET "payload" = jsonb_set("payload", '{background}', to_jsonb(replace("payload"->>'background',
      'the Raccolta''s novena for Our Lady''s Nativity in this catalogue (novena-nativity-of-our-lady),',
      'the Novena for the Nativity of Our Lady (Raccolta) in this catalogue,'))),
    "contentChecksum" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "contentType" = 'NOVENA'::"ChecklistContentType"
  AND "slug" = 'novena-nativity-of-our-lady-pagani'
  AND strpos("payload"->>'background', 'the Raccolta''s novena for Our Lady''s Nativity in this catalogue (novena-nativity-of-our-lady),') > 0;

UPDATE "PublishedContent"
SET "payload" = jsonb_set("payload", '{background}', to_jsonb(replace("payload"->>'background',
      'the novena for the feast of the Presentation in this catalogue (novena-presentation-of-our-lady),',
      'the Novena for the Feast of the Presentation of Our Lady in this catalogue,'))),
    "contentChecksum" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "contentType" = 'NOVENA'::"ChecklistContentType"
  AND "slug" = 'novena-presentation-of-our-lady-pagani'
  AND strpos("payload"->>'background', 'the novena for the feast of the Presentation in this catalogue (novena-presentation-of-our-lady),') > 0;

UPDATE "PublishedContent"
SET "payload" = jsonb_set("payload", '{background}', to_jsonb(replace("payload"->>'background',
      'the Raccolta''s novena for the Annunciation in this catalogue (novena-annunciation),',
      'the Novena for the Annunciation (Raccolta) in this catalogue,'))),
    "contentChecksum" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "contentType" = 'NOVENA'::"ChecklistContentType"
  AND "slug" = 'novena-annunciation-pagani'
  AND strpos("payload"->>'background', 'the Raccolta''s novena for the Annunciation in this catalogue (novena-annunciation),') > 0;

UPDATE "PublishedContent"
SET "payload" = jsonb_set("payload", '{background}', to_jsonb(replace("payload"->>'background',
      'the novena for the feast of the Visitation in this catalogue (novena-visitation-of-our-lady),',
      'the Novena for the Feast of the Visitation in this catalogue,'))),
    "contentChecksum" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "contentType" = 'NOVENA'::"ChecklistContentType"
  AND "slug" = 'novena-visitation-pagani'
  AND strpos("payload"->>'background', 'the novena for the feast of the Visitation in this catalogue (novena-visitation-of-our-lady),') > 0;

UPDATE "PublishedContent"
SET "payload" = jsonb_set("payload", '{background}', to_jsonb(replace("payload"->>'background',
      'the Raccolta''s novena for the Purification in this catalogue (novena-purification-of-our-lady),',
      'the Novena for the Purification of Our Lady (Raccolta) in this catalogue,'))),
    "contentChecksum" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "contentType" = 'NOVENA'::"ChecklistContentType"
  AND "slug" = 'novena-purification-pagani'
  AND strpos("payload"->>'background', 'the Raccolta''s novena for the Purification in this catalogue (novena-purification-of-our-lady),') > 0;

UPDATE "PublishedContent"
SET "payload" = jsonb_set("payload", '{background}', to_jsonb(replace("payload"->>'background',
      'the Raccolta''s novena for the Assumption in this catalogue (novena-assumption),',
      'the Novena for the Assumption (Raccolta) in this catalogue,'))),
    "contentChecksum" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "contentType" = 'NOVENA'::"ChecklistContentType"
  AND "slug" = 'novena-assumption-pagani'
  AND strpos("payload"->>'background', 'the Raccolta''s novena for the Assumption in this catalogue (novena-assumption),') > 0;

UPDATE "PublishedContent"
SET "payload" = jsonb_set("payload", '{background}', to_jsonb(replace("payload"->>'background',
      'the novena to Our Lady of Mount Carmel already in this catalogue (novena-our-lady-of-mount-carmel),',
      'the Novena to Our Lady of Mount Carmel already in this catalogue,'))),
    "contentChecksum" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "contentType" = 'NOVENA'::"ChecklistContentType"
  AND "slug" = 'novena-our-lady-of-mount-carmel-brown-scapular'
  AND strpos("payload"->>'background', 'the novena to Our Lady of Mount Carmel already in this catalogue (novena-our-lady-of-mount-carmel),') > 0;

UPDATE "PublishedContent"
SET "payload" = jsonb_set("payload", '{background}', to_jsonb(replace("payload"->>'background',
      'which the catalogue also publishes on its own as the PRAYER memorare.',
      'which the catalogue also publishes on its own.'))),
    "contentChecksum" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "contentType" = 'NOVENA'::"ChecklistContentType"
  AND "slug" = 'novena-our-lady-of-mount-carmel-brown-scapular'
  AND strpos("payload"->>'background', 'which the catalogue also publishes on its own as the PRAYER memorare.') > 0;

UPDATE "PublishedContent"
SET "payload" = jsonb_set("payload", '{background}', to_jsonb(replace("payload"->>'background',
      'the novena for the Holy Souls in this catalogue (novena-holy-souls-in-purgatory),',
      'the Novena for the Holy Souls in Purgatory in this catalogue,'))),
    "contentChecksum" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "contentType" = 'NOVENA'::"ChecklistContentType"
  AND "slug" = 'novena-feast-of-all-saints'
  AND strpos("payload"->>'background', 'the novena for the Holy Souls in this catalogue (novena-holy-souls-in-purgatory),') > 0;

UPDATE "PublishedContent"
SET "payload" = jsonb_set("payload", '{background}', to_jsonb(replace("payload"->>'background',
      'the novena in honour of the Blessed Virgin already in this catalogue (novena-blessed-virgin-mary),',
      'the Novena in Honor of the Blessed Virgin already in this catalogue,'))),
    "contentChecksum" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "contentType" = 'NOVENA'::"ChecklistContentType"
  AND "slug" = 'novena-blessed-virgin-golden-manual'
  AND strpos("payload"->>'background', 'the novena in honour of the Blessed Virgin already in this catalogue (novena-blessed-virgin-mary),') > 0;

UPDATE "PublishedContent"
SET "payload" = jsonb_set("payload", '{background}', to_jsonb(replace("payload"->>'background',
      'which the catalogue publishes separately as litany-of-saint-john-the-baptist;',
      'which the catalogue publishes separately;'))),
    "contentChecksum" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "contentType" = 'NOVENA'::"ChecklistContentType"
  AND "slug" = 'novena-saint-john-the-baptist'
  AND strpos("payload"->>'background', 'which the catalogue publishes separately as litany-of-saint-john-the-baptist;') > 0;

UPDATE "PublishedContent"
SET "payload" = jsonb_set("payload", '{background}', to_jsonb(replace("payload"->>'background',
      'the other novenas to the Sacred Heart in this catalogue (novena-sacred-heart-of-jesus, novena-sacred-heart-saint-alphonsus and novena-feast-of-the-sacred-heart-lings),',
      'the Novena to the Sacred Heart of Jesus, the Novena to the Sacred Heart (Saint Alphonsus Liguori) and the Novena for the Feast of the Sacred Heart (Our Favorite Novenas) in this catalogue,'))),
    "contentChecksum" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "contentType" = 'NOVENA'::"ChecklistContentType"
  AND "slug" = 'novena-sacred-heart-golden-manual'
  AND strpos("payload"->>'background', 'the other novenas to the Sacred Heart in this catalogue (novena-sacred-heart-of-jesus, novena-sacred-heart-saint-alphonsus and novena-feast-of-the-sacred-heart-lings),') > 0;
