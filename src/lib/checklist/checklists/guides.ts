import type { ChecklistSeed } from "./index";
import { curatedChecklist } from "./from-curated";

/**
 * Guides intentionally not curated yet — the authoring backlog.
 *
 * Empty: every slug that used to be listed here (the OCIA/RCIA overview, the
 * Lent and Advent preparation guides, the four sacrament-preparation guides,
 * the religious-vocation guide and the Liturgy of the Hours guide) has since
 * been written into a `knowledge/guides/*` file, so `curatedChecklist` would
 * have dropped every one of them as "now curated". The home page quick link
 * /guides/ocia-rcia-overview resolves to the curated GUIDE of that slug.
 */
export const guidesExtras: ChecklistSeed[] = [];

/** Every curated guide (knowledge/guides.ts) plus the backlog above. */
export const guidesChecklist: ChecklistSeed[] = curatedChecklist("GUIDE", {
  metadataFields: ["kind", "sacramentKey", "category"],
  extras: guidesExtras,
});
