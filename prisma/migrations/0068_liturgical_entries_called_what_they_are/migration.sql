-- @idempotent-recoverable
--
-- Liturgical entries the stored subtitle wrongly calls the Order of Mass.
--
-- WHY: the catalogue files the liturgy's books and its other rites under the kind
-- "mass_structure", and the subtitle generator called every one of them "Order of Mass".
-- Search results and suggestions print the stored subtitle, so a reader looking for the
-- Rite of Baptism heard "Order of Mass" under it. The generator now goes by the title
-- (src/lib/content-shared/content-subtitle.ts), and these are the same words it gives.
-- The worker's hygiene sweep would reach these rows in time, one small batch at a time
-- across the whole catalogue; a search result should not have to wait for it.
--
-- Deploy safety: one short targeted update, no schema change. Safe to run again: a row
-- already corrected no longer matches, and a row with any other subtitle is left alone.
SET LOCAL lock_timeout = '5s';

UPDATE "PublishedContent" AS entry
SET "subtitle" = corrected.subtitle,
    "updatedAt" = CURRENT_TIMESTAMP
FROM (VALUES
  ('rite-of-baptism-for-children', 'Liturgical rite'),
  ('rite-of-confirmation', 'Liturgical rite'),
  ('ocia-scrutinies-and-the-easter-vigil-sacraments', 'Liturgical rite'),
  ('exposition-and-benediction-of-the-blessed-sacrament', 'Liturgical rite'),
  ('the-roman-missal-third-edition', 'Liturgical book'),
  ('lectionary-cycles-and-the-order-of-readings', 'Liturgical book'),
  ('eucharistic-prayers-of-the-roman-missal', 'Part of the Mass'),
  ('structure-of-the-liturgy-of-the-hours', 'Prayer of the Church')
) AS corrected(slug, subtitle)
WHERE entry."contentType" = 'LITURGICAL'::"ChecklistContentType"
  AND entry."slug" = corrected.slug
  AND entry."subtitle" = 'Order of Mass';
