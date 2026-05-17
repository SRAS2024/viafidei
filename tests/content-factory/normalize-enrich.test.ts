/**
 * Normalization + enrichment tests.
 */

import { describe, expect, it } from "vitest";
import { normalizePackage, enrichPackage, type ContentPackage } from "@/lib/content-factory";

function pkg(over: Partial<ContentPackage>): ContentPackage {
  return {
    contentType: "Prayer",
    slug: "test",
    title: "Test",
    sourceUrl: "https://vatican.va/p",
    sourceHost: "vatican.va",
    payload: {},
    provenance: {},
    ...over,
  };
}

describe("normalizePackage", () => {
  it("strips brand suffixes from titles", () => {
    const p = pkg({ title: "Hail Mary | EWTN", contentType: "Prayer" });
    normalizePackage(p);
    expect(p.title).toBe("Hail Mary");
  });

  it("normalizes feast day from saint payload", () => {
    const p = pkg({
      contentType: "Saint",
      payload: { saintName: "St. Thomas Aquinas", feastDay: "Jan 28" },
    });
    normalizePackage(p);
    expect(p.payload.feastMonth).toBe(1);
    expect(p.payload.feastDayOfMonth).toBe(28);
    expect(p.payload.feastDay).toBe("January 28");
  });

  it("normalizes sacrament aliases", () => {
    const p = pkg({
      contentType: "Sacrament",
      payload: { sacramentKey: "Confession", sacramentName: "Confession" },
    });
    normalizePackage(p);
    expect(p.payload.sacramentKey).toBe("reconciliation");
  });

  it("normalizes prayer types", () => {
    const p = pkg({ contentType: "Prayer", payload: { prayerType: "marian" } });
    normalizePackage(p);
    expect(p.payload.prayerType).toBe("Marian prayer");
  });
});

describe("enrichPackage", () => {
  it("fills sacrament group from canonical map", () => {
    const p = pkg({
      contentType: "Sacrament",
      payload: { sacramentKey: "reconciliation" },
    });
    enrichPackage(p, "1.0.0");
    expect(p.payload.sacramentGroup).toBe("Healing");
    expect(p.provenance.sacramentGroup).toBeDefined();
    expect(p.provenance.sacramentGroup.extractionMethod).toMatch(/deterministic/);
  });

  it("does not invent values it has no source for", () => {
    const p = pkg({
      contentType: "Saint",
      slug: "unknown-saint-9999",
      payload: { saintName: "St. Nobody" },
    });
    enrichPackage(p, "1.0.0");
    expect(p.payload.feastDay).toBeUndefined();
  });
});
