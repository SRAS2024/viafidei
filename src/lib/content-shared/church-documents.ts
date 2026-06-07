/**
 * Church Documents library (spec — "Church Documents tab: encyclicals,
 * Catechism, Canon Law with official links").
 *
 * Categorises published CHURCH_DOCUMENT items so the library can be filtered
 * by kind, and supplies readable labels for each document type. The
 * underlying content type is shared with the Church-history timeline; this
 * module is the single source of truth for document-type labelling.
 */
export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  encyclical: "Encyclical",
  apostolic_exhortation: "Apostolic Exhortation",
  apostolic_constitution: "Apostolic Constitution",
  motu_proprio: "Motu Proprio",
  apostolic_letter: "Apostolic Letter",
  decree: "Decree",
  declaration: "Declaration",
  council_document: "Council Document",
  catechism_section: "Catechism",
  dogmatic_definition: "Dogmatic Definition",
  dogmatic_constitution: "Dogmatic Constitution",
  instruction: "Instruction",
  vatican_document: "Vatican Document",
  uscb_pastoral_letter: "USCCB Pastoral Letter",
};

export function documentTypeLabel(documentType: unknown): string {
  return (typeof documentType === "string" && DOCUMENT_TYPE_LABELS[documentType]) || "Document";
}

export interface DocumentCategory {
  key: string;
  label: string;
  matches: (payload: Record<string, unknown>) => boolean;
}

function inTypes(payload: Record<string, unknown>, types: string[]): boolean {
  return typeof payload.documentType === "string" && types.includes(payload.documentType);
}

function titleMatches(payload: Record<string, unknown>, re: RegExp): boolean {
  return typeof payload.title === "string" && re.test(payload.title);
}

export const DOCUMENT_CATEGORIES: DocumentCategory[] = [
  { key: "all", label: "All", matches: () => true },
  { key: "encyclical", label: "Encyclicals", matches: (p) => inTypes(p, ["encyclical"]) },
  {
    key: "exhortation",
    label: "Apostolic Letters",
    matches: (p) =>
      inTypes(p, [
        "apostolic_exhortation",
        "apostolic_letter",
        "apostolic_constitution",
        "motu_proprio",
      ]),
  },
  { key: "council", label: "Council Documents", matches: (p) => inTypes(p, ["council_document"]) },
  {
    key: "catechism",
    label: "Catechism",
    matches: (p) => inTypes(p, ["catechism_section"]) || titleMatches(p, /catechism/i),
  },
  { key: "canon-law", label: "Canon Law", matches: (p) => titleMatches(p, /canon law/i) },
  {
    key: "dogma",
    label: "Dogmas",
    matches: (p) =>
      inTypes(p, ["dogmatic_definition", "dogma", "dogmatic_constitution"]) ||
      titleMatches(p, /\bdogma(tic)?\b/i),
  },
  {
    key: "other",
    label: "Other",
    matches: (p) =>
      inTypes(p, [
        "decree",
        "declaration",
        "instruction",
        "vatican_document",
        "uscb_pastoral_letter",
      ]),
  },
];

export function documentCategory(key: string | undefined): DocumentCategory {
  return DOCUMENT_CATEGORIES.find((c) => c.key === key) ?? DOCUMENT_CATEGORIES[0];
}

export function filterDocuments<T extends { payload: Record<string, unknown> }>(
  items: T[],
  key: string | undefined,
): T[] {
  const category = documentCategory(key);
  return items.filter((i) => category.matches(i.payload));
}
