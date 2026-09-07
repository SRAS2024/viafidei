import type { ChecklistSeed } from "./index";
import { curatedChecklist } from "./from-curated";

/**
 * Prayers intentionally not curated yet (the authoring backlog). Removed from
 * this list automatically the moment a curated entry with the same slug lands.
 */
export const prayersExtras: ChecklistSeed[] = [
  {
    canonicalName: "Litany of the Saints",
    canonicalSlug: "litany-of-the-saints",
    priority: 40,
    authorityLevelHint: "LITURGICAL_BOOK",
  },
  {
    canonicalName: "Pange Lingua",
    canonicalSlug: "pange-lingua",
    priority: 45,
    authorityLevelHint: "LITURGICAL_BOOK",
  },
];

/** Every curated prayer (prayers.ts + litanies.ts) plus the extras above. */
export const prayersChecklist: ChecklistSeed[] = curatedChecklist("PRAYER", {
  metadataFields: ["prayerType", "category", "language"],
  overrides: {
    "our-father": { aliases: ["The Lord's Prayer", "Pater Noster"] },
    "hail-mary": { aliases: ["Ave Maria"] },
    "glory-be": { aliases: ["Doxology", "Gloria Patri"] },
    "act-of-love": { aliases: ["Act of Charity"] },
    "regina-caeli": { aliases: ["Queen of Heaven"] },
    "salve-regina": { aliases: ["Hail Holy Queen"] },
    "prayer-to-saint-michael": { aliases: ["Saint Michael Prayer", "Leonine Prayer"] },
    "anima-christi": { aliases: ["Soul of Christ"] },
    "prayer-of-saint-francis": {
      aliases: ["Peace Prayer", "Make me a channel of your peace"],
      notes:
        "Attribution to St. Francis is traditional but not historically certain — note this in body.",
    },
    "veni-creator-spiritus": { aliases: ["Come Holy Spirit"] },
    "litany-of-the-blessed-virgin-mary": { aliases: ["Litany of Loreto"] },
    "prayer-before-a-crucifix": { aliases: ["En Ego, O bone et dulcissime Iesu"] },
    "adoro-te-devote": { aliases: ["Hidden God Devoutly I Adore Thee"] },
  },
  extras: prayersExtras,
});
