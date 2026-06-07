-- Consolidate ContentQualityScore onto the full ten-dimension model.
--
-- The reduced-model columns are removed: `sourceEvidenceScore` was a pure
-- duplicate of `fieldProvenanceScore`, and `validationScore` / `renderScore`
-- are renamed to their full-model names so every stored dimension matches the
-- spec (validation evidence, public rendering readiness). Renames preserve
-- data; the dropped duplicate carried no unique information.

ALTER TABLE "ContentQualityScore" RENAME COLUMN "validationScore" TO "validationEvidenceScore";
ALTER TABLE "ContentQualityScore" RENAME COLUMN "renderScore" TO "publicRenderingScore";
ALTER TABLE "ContentQualityScore" DROP COLUMN "sourceEvidenceScore";
