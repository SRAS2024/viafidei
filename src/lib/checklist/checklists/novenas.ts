import type { ChecklistSeed } from "./index";
import { curatedChecklist } from "./from-curated";

/**
 * Novenas intentionally not curated yet (the authoring backlog — each needs
 * its verbatim, public-domain day texts before it can be curated).
 */
export const novenasExtras: ChecklistSeed[] = [
  {
    canonicalName: "Novena to the Infant Jesus of Prague",
    canonicalSlug: "novena-infant-jesus-of-prague",
    priority: 35,
    authorityLevelHint: "RELIGIOUS_ORDER",
  },
  {
    canonicalName: "Novena to St. Rita",
    canonicalSlug: "novena-saint-rita",
    priority: 35,
    authorityLevelHint: "RELIGIOUS_ORDER",
  },
  {
    canonicalName: "Christmas Novena",
    canonicalSlug: "christmas-novena",
    aliases: ["St. Andrew Christmas Novena"],
    priority: 30,
    authorityLevelHint: "TRUSTED_PUBLISHER",
  },
];

/** Every curated novena (knowledge/novenas.ts) plus the extras above. */
export const novenasChecklist: ChecklistSeed[] = curatedChecklist("NOVENA", {
  metadataFields: ["associatedSaintSlug", "relatedFeastSlug"],
  overrides: {
    "novena-saint-therese": { aliases: ["Novena to St. Therese of Lisieux"] },
    "novena-saint-anthony": { aliases: ["Novena to St. Anthony of Padua"] },
  },
  extras: novenasExtras,
});
