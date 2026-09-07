import type { ChecklistSeed } from "./index";
import { curatedChecklist } from "./from-curated";

/**
 * Spiritual practices intentionally not curated yet (the authoring backlog).
 * The Stations and the Holy Hour are NOT listed: their canonical home is the
 * DEVOTION type (stations-of-the-cross, holy-hour) and their how-to is a GUIDE
 * (how-to-pray-the-stations-of-the-cross, how-to-make-a-holy-hour), and the
 * SPIRITUAL_PRACTICE registry deliberately carries neither slug.
 *
 * Empty: vocational-discernment, the only entry that used to be here, is
 * curated now (knowledge/spiritual-practices/group-1.ts).
 */
export const spiritualPracticesExtras: ChecklistSeed[] = [];

/** Every curated practice (knowledge/spiritual-practices.ts) plus the extras above. */
export const spiritualPracticesChecklist: ChecklistSeed[] = curatedChecklist("SPIRITUAL_PRACTICE", {
  metadataFields: ["practiceKind", "tradition"],
  overrides: {
    "mental-prayer": { aliases: ["Meditation"] },
    "christian-mortification": { aliases: ["Mortification"] },
  },
  extras: spiritualPracticesExtras,
});
