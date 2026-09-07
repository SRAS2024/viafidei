import type { ChecklistSeed } from "./index";
import { curatedChecklist } from "./from-curated";

/** Parishes intentionally not curated — none: the directory grows from approved sources. */
export const parishesExtras: ChecklistSeed[] = [];

/**
 * Every curated parish, basilica, cathedral, and shrine (knowledge/parishes.ts)
 * — notable, unambiguously real records that anchor the directory the Admin
 * Worker expands from approved sources.
 */
export const parishesChecklist: ChecklistSeed[] = curatedChecklist("PARISH", {
  metadataFields: ["designation", "city", "state", "country", "diocese"],
  extras: parishesExtras,
});
