/**
 * Content catalog — the admin worker console's complete list of user-facing
 * content categories, including the view-based ones that are not their own
 * content type (Litanies, Our Lady, Liturgical Calendar, History).
 * Guards that none of these go missing and that counts are computed correctly.
 */

import { describe, expect, it } from "vitest";

import {
  CONTENT_CATALOG,
  CATALOG_DERIVED_TYPES,
  computeContentCatalog,
} from "@/lib/content-shared/content-catalog";

describe("content catalog", () => {
  it("includes every page the user named, including the view-based ones", () => {
    const keys = CONTENT_CATALOG.map((c) => c.key);
    for (const required of [
      "prayers",
      "litanies",
      "saints",
      "our-lady",
      "doctors",
      "popes",
      "sacraments",
      "parishes",
      "spiritual-life",
      "guides",
      "liturgy",
      "liturgical-calendar",
      "rites",
      "history",
      "church-documents",
    ]) {
      expect(keys, `missing catalog category: ${required}`).toContain(required);
    }
  });

  it("lists the primary pages in the site's navigation order", () => {
    const order = CONTENT_CATALOG.slice(0, 15).map((c) => c.key);
    expect(order).toEqual([
      "prayers",
      "litanies",
      "saints",
      "our-lady",
      "doctors",
      "popes",
      "sacraments",
      "parishes",
      "spiritual-life",
      "guides",
      "liturgy",
      "liturgical-calendar",
      "rites",
      "history",
      "church-documents",
    ]);
  });

  it("gives every category a growth target; only Sacraments are hard-capped", () => {
    for (const c of CONTENT_CATALOG) {
      expect(c.target, `${c.key} target`).toBeGreaterThan(0);
    }
    const sacraments = CONTENT_CATALOG.find((c) => c.key === "sacraments")!;
    expect(sacraments.hardMax).toBe(7);
    expect(CONTENT_CATALOG.filter((c) => c.hardMax != null)).toHaveLength(1);
  });

  it("flags derived (view) categories and lists their base types", () => {
    const litanies = CONTENT_CATALOG.find((c) => c.key === "litanies")!;
    expect(litanies.derived).toBe(true);
    expect(litanies.types).toEqual(["PRAYER"]);
    expect(CATALOG_DERIVED_TYPES).toContain("PRAYER");
    expect(CATALOG_DERIVED_TYPES).toContain("LITURGICAL");
  });

  it("counts direct, combined, and derived categories correctly", () => {
    const grouped = [
      { contentType: "PRAYER", count: 28 },
      { contentType: "MARIAN_TITLE", count: 14 },
      { contentType: "APPARITION", count: 8 },
      { contentType: "GUIDE", count: 4 },
      { contentType: "LITURGICAL", count: 18 },
      { contentType: "SAINT", count: 46 },
    ];
    const derivedRows = [
      // Litanies (PRAYER with prayerType litany)
      { contentType: "PRAYER", payload: { prayerType: "litany", title: "Litany of the Saints" } },
      { contentType: "PRAYER", payload: { prayerType: "litany", title: "Litany of Humility" } },
      { contentType: "PRAYER", payload: { prayerType: "general", title: "Our Father" } },
      // Liturgical-calendar entries
      { contentType: "LITURGICAL", payload: { kind: "solemnity", title: "Easter" } },
      { contentType: "LITURGICAL", payload: { kind: "glossary_term", title: "Ambo" } },
    ];
    const catalog = computeContentCatalog(grouped, derivedRows);
    const get = (k: string) => catalog.find((c) => c.key === k)!;

    expect(get("prayers").count).toBe(28); // direct
    expect(get("saints").count).toBe(46); // direct
    expect(get("our-lady").count).toBe(22); // combined 14 + 8
    expect(get("litanies").count).toBe(2); // derived predicate
    expect(get("liturgical-calendar").count).toBe(1); // derived predicate
    expect(get("history").count).toBe(0); // CHURCH_DOCUMENT not in grouped → 0
  });

  it("treats a missing type as zero, never throwing", () => {
    const catalog = computeContentCatalog([], []);
    expect(catalog.every((c) => c.count === 0)).toBe(true);
    expect(catalog).toHaveLength(CONTENT_CATALOG.length);
  });
});
