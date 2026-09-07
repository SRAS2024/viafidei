import type { ChecklistSeed } from "./index";
import { curatedChecklist } from "./from-curated";

/** Saints intentionally not curated yet — none: the worker grows SAINT from approved sources. */
export const saintsExtras: ChecklistSeed[] = [];

/** Every curated saint (knowledge/saints.ts); `metadata.feastDay` is MM-DD. */
export const saintsChecklist: ChecklistSeed[] = curatedChecklist("SAINT", {
  metadataFields: ["feastDay", "saintType", "canonizationStatus"],
  overrides: {
    "saint-therese-of-lisieux": { aliases: ["Little Flower"] },
  },
  extras: saintsExtras,
});
