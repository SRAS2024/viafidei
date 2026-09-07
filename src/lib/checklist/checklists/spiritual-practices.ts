import type { ChecklistSeed } from "./index";
import { curatedChecklist } from "./from-curated";

/**
 * Spiritual practices intentionally not curated yet (the authoring backlog).
 * The Stations and the Holy Hour are NOT listed: their canonical home is the
 * DEVOTION type (stations-of-the-cross, holy-hour) and their how-to is a GUIDE.
 */
export const spiritualPracticesExtras: ChecklistSeed[] = [
  {
    canonicalName: "Vocational Discernment",
    canonicalSlug: "vocational-discernment",
    priority: 30,
    authorityLevelHint: "USCCB",
  },
];

/** Every curated practice (knowledge/spiritual-practices.ts) plus the extras above. */
export const spiritualPracticesChecklist: ChecklistSeed[] = curatedChecklist("SPIRITUAL_PRACTICE", {
  metadataFields: ["practiceKind", "tradition"],
  overrides: {
    "mental-prayer": { aliases: ["Meditation"] },
    "christian-mortification": { aliases: ["Mortification"] },
  },
  extras: spiritualPracticesExtras,
});
