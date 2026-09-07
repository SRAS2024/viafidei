import type { ChecklistSeed } from "./index";
import { curatedChecklist } from "./from-curated";

/** There are exactly seven sacraments — nothing is ever added here. */
export const sacramentsExtras: ChecklistSeed[] = [];

/** The seven curated sacraments (knowledge/sacraments.ts); `metadata.sacramentKey` is the key. */
export const sacramentsChecklist: ChecklistSeed[] = curatedChecklist("SACRAMENT", {
  metadataFields: ["sacramentKey"],
  overrides: {
    eucharist: { aliases: ["Holy Communion", "Mass"], priority: 5 },
    reconciliation: { aliases: ["Confession", "Penance"], priority: 5 },
    matrimony: { aliases: ["Marriage"], priority: 5 },
    baptism: { priority: 5 },
    confirmation: { priority: 5 },
    "anointing-of-the-sick": { priority: 5 },
    "holy-orders": { priority: 5 },
  },
  extras: sacramentsExtras,
});
