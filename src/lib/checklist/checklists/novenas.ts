import type { ChecklistSeed } from "./index";
import { curatedChecklist } from "./from-curated";

/**
 * Novenas intentionally not curated yet (the authoring backlog).
 *
 * Empty: the three slugs that used to sit here name novenas the registry now
 * carries under a fuller slug — novena-infant-jesus-of-prague is curated as
 * `novena-infant-of-prague`, novena-saint-rita as `novena-saint-rita-of-cascia`
 * and christmas-novena as `novena-saint-andrew-christmas`. `curatedChecklist`
 * matches on slug, so leaving them would have seeded a SECOND, permanently
 * DISCOVERED row for each of those three novenas. Their names live on as
 * aliases in the overrides below.
 */
export const novenasExtras: ChecklistSeed[] = [];

/** Every curated novena (knowledge/novenas.ts) plus the extras above. */
export const novenasChecklist: ChecklistSeed[] = curatedChecklist("NOVENA", {
  metadataFields: ["associatedSaintSlug", "relatedFeastSlug"],
  overrides: {
    "novena-saint-therese": { aliases: ["Novena to St. Therese of Lisieux"] },
    "novena-saint-anthony": { aliases: ["Novena to St. Anthony of Padua"] },
    "novena-infant-of-prague": { aliases: ["Novena to the Infant Jesus of Prague"] },
    "novena-saint-rita-of-cascia": { aliases: ["Novena to St. Rita"] },
    "novena-saint-andrew-christmas": {
      aliases: ["Christmas Novena", "St. Andrew Christmas Novena"],
    },
  },
  extras: novenasExtras,
});
