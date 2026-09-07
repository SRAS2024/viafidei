import type { ChecklistSeed } from "./index";
import { curatedChecklist } from "./from-curated";

/** Popes intentionally not curated — none: the worker expands the line from approved sources. */
export const popesExtras: ChecklistSeed[] = [];

/**
 * Every curated Roman Pontiff (knowledge/popes.ts); `metadata.papacyStart` is
 * the chronological sort key.
 */
export const popesChecklist: ChecklistSeed[] = curatedChecklist("POPE", {
  metadataFields: ["papacyStart", "papacyEnd"],
  extras: popesExtras,
});
