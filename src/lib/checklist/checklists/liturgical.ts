import type { ChecklistSeed } from "./index";
import { curatedChecklist } from "./from-curated";

/** Liturgical entries intentionally not curated yet (the authoring backlog). */
export const liturgicalExtras: ChecklistSeed[] = [
  {
    canonicalName: "The Rite of Funerals",
    canonicalSlug: "rite-of-funerals",
    priority: 25,
    authorityLevelHint: "LITURGICAL_BOOK",
    metadata: { kind: "funeral_rite" },
  },
  {
    canonicalName: "The Rite of Ordination",
    canonicalSlug: "rite-of-ordination",
    priority: 25,
    authorityLevelHint: "LITURGICAL_BOOK",
    metadata: { kind: "ordination_rite" },
  },
];

/** Every curated liturgical entry (knowledge/liturgical.ts) plus the extras above. */
export const liturgicalChecklist: ChecklistSeed[] = curatedChecklist("LITURGICAL", {
  metadataFields: ["kind", "feastDate", "movableFeast", "season"],
  extras: liturgicalExtras,
});
