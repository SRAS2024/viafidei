import type { ChecklistSeed } from "./index";
import { curatedChecklist } from "./from-curated";

/**
 * Church documents intentionally not curated yet (the authoring backlog).
 * Lumen Fidei and Amoris Laetitia were removed: both are curated now
 * (knowledge/church-documents/group-*.ts). Ineffabilis Deus and Pastores Dabo
 * Vobis were removed for the same reason (group-3.ts).
 */
export const churchDocumentsExtras: ChecklistSeed[] = [
  {
    canonicalName: "Munificentissimus Deus",
    canonicalSlug: "munificentissimus-deus",
    priority: 25,
    authorityLevelHint: "VATICAN",
    metadata: { documentType: "apostolic_constitution" },
  },
];

/**
 * Every curated Church document (knowledge/church-documents.ts) and council
 * (knowledge/church-history.ts) plus the backlog above.
 */
export const churchDocumentsChecklist: ChecklistSeed[] = curatedChecklist("CHURCH_DOCUMENT", {
  metadataFields: ["documentType", "issuingAuthority", "issuedDate"],
  overrides: {
    "catechism-of-the-catholic-church": { priority: 5, authorityLevelHint: "CATECHISM" },
  },
  extras: churchDocumentsExtras,
});
