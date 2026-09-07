import type { ChecklistSeed } from "./index";
import { curatedChecklist } from "./from-curated";

/** Rites intentionally not curated yet — none: every seeded rite is curated. */
export const ritesExtras: ChecklistSeed[] = [];

/**
 * Every curated rite (knowledge/rites.ts): the twelve canonical rite keys of
 * content-shared/rites.ts plus the Latin uses (Ambrosian, Mozarabic). Each
 * carries `metadata.riteKey`.
 */
export const ritesChecklist: ChecklistSeed[] = curatedChecklist("RITE", {
  metadataFields: ["riteKey", "family", "entryKind"],
  extras: ritesExtras,
});
