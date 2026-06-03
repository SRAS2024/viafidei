import { describe, expect, it } from "vitest";

import {
  documentCategory,
  documentTypeLabel,
  filterDocuments,
} from "@/lib/content-shared/church-documents";

const item = (payload: Record<string, unknown>) => ({ payload });

describe("documentTypeLabel", () => {
  it("maps a document type to a readable label", () => {
    expect(documentTypeLabel("encyclical")).toBe("Encyclical");
    expect(documentTypeLabel("council_document")).toBe("Council Document");
    expect(documentTypeLabel("catechism_section")).toBe("Catechism");
    expect(documentTypeLabel(undefined)).toBe("Document");
    expect(documentTypeLabel("nonsense")).toBe("Document");
  });
});

describe("documentCategory", () => {
  it("defaults to 'all' for an unknown key", () => {
    expect(documentCategory(undefined).key).toBe("all");
    expect(documentCategory("nope").key).toBe("all");
    expect(documentCategory("encyclical").key).toBe("encyclical");
  });
});

describe("filterDocuments", () => {
  const docs = [
    item({ documentType: "encyclical", title: "Rerum Novarum" }),
    item({ documentType: "council_document", title: "Lumen Gentium" }),
    item({ documentType: "apostolic_exhortation", title: "Evangelii Gaudium" }),
    item({ documentType: "vatican_document", title: "The Code of Canon Law" }),
    item({ documentType: "catechism_section", title: "CCC 1" }),
  ];

  it("returns everything for 'all'", () => {
    expect(filterDocuments(docs, "all")).toHaveLength(5);
    expect(filterDocuments(docs, undefined)).toHaveLength(5);
  });

  it("filters by category", () => {
    expect(filterDocuments(docs, "encyclical").map((d) => d.payload.title)).toEqual([
      "Rerum Novarum",
    ]);
    expect(filterDocuments(docs, "council").map((d) => d.payload.title)).toEqual(["Lumen Gentium"]);
    expect(filterDocuments(docs, "exhortation").map((d) => d.payload.title)).toEqual([
      "Evangelii Gaudium",
    ]);
  });

  it("matches Catechism and Canon Law by title as well as type", () => {
    expect(filterDocuments(docs, "catechism").map((d) => d.payload.title)).toEqual(["CCC 1"]);
    expect(filterDocuments(docs, "canon-law").map((d) => d.payload.title)).toEqual([
      "The Code of Canon Law",
    ]);
  });
});
