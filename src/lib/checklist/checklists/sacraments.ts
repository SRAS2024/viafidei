import type { ChecklistSeed } from "./index";

export const sacramentsChecklist: ChecklistSeed[] = [
  {
    canonicalName: "Baptism",
    canonicalSlug: "baptism",
    priority: 5,
    authorityLevelHint: "CATECHISM",
    metadata: { sacramentKey: "baptism" },
  },
  {
    canonicalName: "Confirmation",
    canonicalSlug: "confirmation",
    priority: 5,
    authorityLevelHint: "CATECHISM",
    metadata: { sacramentKey: "confirmation" },
  },
  {
    canonicalName: "Eucharist",
    canonicalSlug: "eucharist",
    aliases: ["Holy Communion", "Mass"],
    priority: 5,
    authorityLevelHint: "CATECHISM",
    metadata: { sacramentKey: "eucharist" },
  },
  {
    canonicalName: "Reconciliation",
    canonicalSlug: "reconciliation",
    aliases: ["Confession", "Penance"],
    priority: 5,
    authorityLevelHint: "CATECHISM",
    metadata: { sacramentKey: "reconciliation" },
  },
  {
    canonicalName: "Anointing of the Sick",
    canonicalSlug: "anointing-of-the-sick",
    priority: 5,
    authorityLevelHint: "CATECHISM",
    metadata: { sacramentKey: "anointing_of_the_sick" },
  },
  {
    canonicalName: "Holy Orders",
    canonicalSlug: "holy-orders",
    priority: 5,
    authorityLevelHint: "CATECHISM",
    metadata: { sacramentKey: "holy_orders" },
  },
  {
    canonicalName: "Matrimony",
    canonicalSlug: "matrimony",
    aliases: ["Marriage"],
    priority: 5,
    authorityLevelHint: "CATECHISM",
    metadata: { sacramentKey: "matrimony" },
  },
];
