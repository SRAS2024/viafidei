import type { ChecklistSeed } from "./index";
import { curatedChecklist } from "./from-curated";

/** Apparitions intentionally not curated yet — none: every seeded apparition is curated. */
export const apparitionsExtras: ChecklistSeed[] = [];

/** Every curated apparition (knowledge/apparitions.ts). */
export const apparitionsChecklist: ChecklistSeed[] = curatedChecklist("APPARITION", {
  metadataFields: ["location", "country", "yearOfApparition", "approvedStatus"],
  overrides: {
    "apparition-our-lady-of-akita": {
      needsHumanReview: true,
      humanReviewReason: "Approved at diocesan level; verify status in Vatican commentary.",
    },
    "apparition-our-lady-of-good-help": {
      aliases: ["Our Lady of Champion", "Apparition of Our Lady of Champion (Good Help)"],
    },
  },
  extras: apparitionsExtras,
});
