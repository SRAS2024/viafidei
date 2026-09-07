import type { ChecklistSeed } from "./index";
import { curatedChecklist } from "./from-curated";

/** Devotions intentionally not curated yet — none: every devotion is curated. */
export const devotionsExtras: ChecklistSeed[] = [];

/** Every curated devotion (knowledge/devotions.ts), with the traditional aliases. */
export const devotionsChecklist: ChecklistSeed[] = curatedChecklist("DEVOTION", {
  metadataFields: ["devotionType"],
  overrides: {
    "holy-rosary": { summary: "The most prominent Marian devotion of the Latin Church." },
    "stations-of-the-cross": { aliases: ["Way of the Cross", "Via Crucis"] },
    "nine-first-fridays": {
      aliases: ["First Friday Devotion"],
      needsHumanReview: true,
      humanReviewReason: "Twelve Promises require careful sourcing.",
    },
    "five-first-saturdays": { aliases: ["First Saturday Devotion"] },
    "consecration-to-mary": {
      aliases: [
        "Total Consecration to Jesus through Mary",
        "Saint Louis de Montfort Consecration",
        "33 Day Consecration",
      ],
    },
    "liturgy-of-the-hours": { aliases: ["Divine Office", "Breviary"] },
  },
  extras: devotionsExtras,
});
