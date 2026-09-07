import type { ChecklistSeed } from "./index";
import { curatedChecklist } from "./from-curated";

/**
 * Guides intentionally not curated yet — the authoring backlog. GUIDE is a
 * curated-built type (no web extraction), so these rows are placeholders that
 * become buildable only when a curated entry with the same slug is written;
 * each is then dropped from this list automatically.
 */
export const guidesExtras: ChecklistSeed[] = [
  {
    canonicalName: "Discerning a Religious Vocation",
    canonicalSlug: "discerning-religious-vocation",
    priority: 30,
    authorityLevelHint: "USCCB",
  },
  {
    canonicalName: "Lent Preparation Guide",
    canonicalSlug: "lent-preparation-guide",
    priority: 20,
    authorityLevelHint: "USCCB",
  },
  {
    canonicalName: "Advent Preparation Guide",
    canonicalSlug: "advent-preparation-guide",
    priority: 20,
    authorityLevelHint: "USCCB",
  },
  {
    canonicalName: "OCIA / RCIA Overview",
    canonicalSlug: "ocia-rcia-overview",
    priority: 30,
    authorityLevelHint: "USCCB",
  },
  {
    canonicalName: "Preparing for Baptism (Infant)",
    canonicalSlug: "preparing-for-baptism-infant",
    priority: 35,
    authorityLevelHint: "USCCB",
  },
  {
    canonicalName: "Preparing for Marriage",
    canonicalSlug: "preparing-for-marriage",
    priority: 35,
    authorityLevelHint: "USCCB",
  },
  {
    canonicalName: "Preparing for First Communion",
    canonicalSlug: "preparing-for-first-communion",
    priority: 35,
    authorityLevelHint: "USCCB",
  },
  {
    canonicalName: "Preparing for Confirmation",
    canonicalSlug: "preparing-for-confirmation",
    priority: 35,
    authorityLevelHint: "USCCB",
  },
  {
    canonicalName: "How to Pray the Liturgy of the Hours",
    canonicalSlug: "how-to-pray-the-liturgy-of-the-hours",
    priority: 30,
    authorityLevelHint: "LITURGICAL_BOOK",
  },
];

/** Every curated guide (knowledge/guides.ts) plus the backlog above. */
export const guidesChecklist: ChecklistSeed[] = curatedChecklist("GUIDE", {
  metadataFields: ["kind", "sacramentKey", "category"],
  extras: guidesExtras,
});
