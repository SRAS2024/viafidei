/**
 * Church Documents category filters: Catechism, Code of Canon Law,
 * Encyclicals, Dogmas, Councils, Other. The list must split by category and
 * only show everything under "All".
 */

import { describe, expect, it } from "vitest";

import {
  DOCUMENT_CATEGORIES,
  documentCategory,
  filterDocuments,
} from "@/lib/content-shared/church-documents";

type Doc = { payload: Record<string, unknown> };
const doc = (payload: Record<string, unknown>): Doc => ({ payload });

const FIXTURES: Doc[] = [
  doc({ documentType: "encyclical", title: "Rerum Novarum" }),
  doc({ documentType: "catechism_section", title: "Catechism of the Catholic Church" }),
  doc({ title: "Code of Canon Law" }),
  doc({
    documentType: "dogmatic_definition",
    title: "Ineffabilis Deus (Immaculate Conception dogma)",
  }),
  doc({ documentType: "council_document", title: "Lumen Gentium" }),
  doc({ documentType: "decree", title: "Some decree" }),
];

describe("Church Document categories", () => {
  it("exposes the required categories", () => {
    const keys = DOCUMENT_CATEGORIES.map((c) => c.key);
    for (const required of [
      "all",
      "catechism",
      "canon-law",
      "encyclical",
      "dogma",
      "council",
      "other",
    ]) {
      expect(keys).toContain(required);
    }
  });

  it("Catechism filter returns only catechism content", () => {
    const out = filterDocuments(FIXTURES, "catechism");
    expect(out).toHaveLength(1);
    expect(out[0].payload.title).toMatch(/catechism/i);
  });

  it("Code of Canon Law is its own category", () => {
    const out = filterDocuments(FIXTURES, "canon-law");
    expect(out).toHaveLength(1);
    expect(out[0].payload.title).toMatch(/canon law/i);
  });

  it("Encyclicals filter returns only encyclicals", () => {
    const out = filterDocuments(FIXTURES, "encyclical");
    expect(out.every((d) => d.payload.documentType === "encyclical")).toBe(true);
    expect(out).toHaveLength(1);
  });

  it("Dogmas filter returns dogmatic content", () => {
    const out = filterDocuments(FIXTURES, "dogma");
    expect(out.length).toBeGreaterThanOrEqual(1);
    expect(out[0].payload.title).toMatch(/dogma|immaculate/i);
  });

  it("Councils filter returns council documents", () => {
    const out = filterDocuments(FIXTURES, "council");
    expect(out).toHaveLength(1);
    expect(out[0].payload.documentType).toBe("council_document");
  });

  it("'All' returns every document; a specific category never does", () => {
    expect(filterDocuments(FIXTURES, "all")).toHaveLength(FIXTURES.length);
    expect(filterDocuments(FIXTURES, "encyclical").length).toBeLessThan(FIXTURES.length);
  });

  it("falls back to 'All' for an unknown category", () => {
    expect(documentCategory("garbage").key).toBe("all");
  });
});
