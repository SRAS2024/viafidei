import type { ChecklistSeed } from "./index";

/**
 * Seed popes — well-documented pontiffs that anchor the chronological list.
 * The Admin Worker expands the list to the full line of popes from approved
 * sources; `metadata.papacyStart` is the chronological sort key.
 */
export const popesChecklist: ChecklistSeed[] = [
  {
    canonicalName: "Pope Saint Peter",
    canonicalSlug: "pope-saint-peter",
    priority: 5,
    authorityLevelHint: "VATICAN",
    metadata: { papacyStart: "30", papacyEnd: "64" },
  },
  {
    canonicalName: "Pope Saint John XXIII",
    canonicalSlug: "pope-saint-john-xxiii",
    priority: 20,
    authorityLevelHint: "VATICAN",
    metadata: { papacyStart: "1958", papacyEnd: "1963" },
  },
  {
    canonicalName: "Pope Saint John Paul II",
    canonicalSlug: "pope-saint-john-paul-ii",
    priority: 20,
    authorityLevelHint: "VATICAN",
    metadata: { papacyStart: "1978", papacyEnd: "2005" },
  },
  {
    canonicalName: "Pope Benedict XVI",
    canonicalSlug: "pope-benedict-xvi",
    priority: 20,
    authorityLevelHint: "VATICAN",
    metadata: { papacyStart: "2005", papacyEnd: "2013" },
  },
  {
    canonicalName: "Pope Francis",
    canonicalSlug: "pope-francis",
    priority: 10,
    authorityLevelHint: "VATICAN",
    metadata: { papacyStart: "2013" },
  },
];
