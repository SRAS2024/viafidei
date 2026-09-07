import type { ChecklistSeed } from "./index";
import { curatedChecklist } from "./from-curated";

/** Marian titles intentionally not curated yet (the authoring backlog). */
export const marianTitlesExtras: ChecklistSeed[] = [
  {
    canonicalName: "Mother of the Church",
    canonicalSlug: "mother-of-the-church",
    aliases: ["Mater Ecclesiae"],
    priority: 15,
    authorityLevelHint: "VATICAN",
  },
  {
    canonicalName: "Co-Redemptrix",
    canonicalSlug: "co-redemptrix",
    priority: 80,
    authorityLevelHint: "TRUSTED_PUBLISHER",
    needsHumanReview: true,
    humanReviewReason:
      "Not a defined dogma; theological status disputed. Strict editorial review required.",
  },
];

/** Every curated Marian title (knowledge/marian-titles.ts) plus the extras above. */
export const marianTitlesChecklist: ChecklistSeed[] = curatedChecklist("MARIAN_TITLE", {
  metadataFields: ["feastDay", "region"],
  overrides: {
    "mother-of-god": {
      aliases: ["Theotokos"],
      summary: "Defined dogma at the Council of Ephesus (431).",
    },
    "immaculate-conception": {
      summary: "Defined dogma by Pope Pius IX in 1854 (Ineffabilis Deus).",
    },
    "assumption-of-mary": {
      summary: "Defined dogma by Pope Pius XII in 1950 (Munificentissimus Deus).",
    },
    "our-lady-star-of-the-sea": { aliases: ["Stella Maris", "Star of the Sea"] },
    "our-lady-help-of-christians": { aliases: ["Help of Christians", "Auxilium Christianorum"] },
  },
  extras: marianTitlesExtras,
});
