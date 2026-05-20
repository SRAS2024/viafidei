/**
 * Content type → tab routing (spec §18, §23).
 *
 * Pins: every package built for ContentType X must reach the
 * canonical tab the user expects. The cache layer's
 * CONTENT_TYPE_TO_TAB map is the single source of truth; tests on
 * this table are how we prove "Every public package appears under
 * the correct tab" (spec §18 + §24 acceptance criterion).
 */

import { describe, expect, it } from "vitest";
import { CONTENT_TYPE_TO_TAB, tagsForRow } from "@/lib/cache/tags";

describe("Content type → tab routing", () => {
  it("Prayers map to the prayers tab", () => {
    expect(CONTENT_TYPE_TO_TAB.Prayer).toBe("prayers");
  });
  it("Saints map to the saints tab", () => {
    expect(CONTENT_TYPE_TO_TAB.Saint).toBe("saints");
  });
  it("Marian apparitions map to the apparitions tab", () => {
    expect(CONTENT_TYPE_TO_TAB.MarianApparition).toBe("apparitions");
  });
  it("Parishes map to the parishes tab", () => {
    expect(CONTENT_TYPE_TO_TAB.Parish).toBe("parishes");
  });
  it("Devotions map to the devotions tab", () => {
    expect(CONTENT_TYPE_TO_TAB.Devotion).toBe("devotions");
  });
  it("Novenas map to the novenas tab", () => {
    expect(CONTENT_TYPE_TO_TAB.Novena).toBe("novenas");
  });
  it("Sacraments map to the sacraments tab", () => {
    expect(CONTENT_TYPE_TO_TAB.Sacrament).toBe("sacraments");
  });
  it("Rosary content maps to the rosary tab", () => {
    expect(CONTENT_TYPE_TO_TAB.Rosary).toBe("rosary");
  });
  it("Consecrations map to the consecrations tab", () => {
    expect(CONTENT_TYPE_TO_TAB.Consecration).toBe("consecrations");
  });
  it("Liturgy content maps to the liturgy tab", () => {
    expect(CONTENT_TYPE_TO_TAB.Liturgy).toBe("liturgy");
  });
  it("History content maps to the history tab", () => {
    expect(CONTENT_TYPE_TO_TAB.History).toBe("history");
  });

  it("tagsForRow includes the right tab for every content type", () => {
    expect(tagsForRow("Prayer", "x")).toContain("tab:prayers");
    expect(tagsForRow("Saint", "x")).toContain("tab:saints");
    expect(tagsForRow("Novena", "x")).toContain("tab:novenas");
    expect(tagsForRow("Sacrament", "x")).toContain("tab:sacraments");
    expect(tagsForRow("Liturgy", "x")).toContain("tab:liturgy");
    expect(tagsForRow("History", "x")).toContain("tab:history");
  });
});
