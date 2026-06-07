/**
 * Our Lady section filters (Marian Titles vs Apparitions). The page must not
 * mix the two unless the user selects "All".
 */

import { describe, expect, it } from "vitest";

import { resolveOurLadyFilter, OUR_LADY_FILTERS } from "@/lib/content-shared/our-lady";

describe("resolveOurLadyFilter", () => {
  it("defaults to Marian Titles only (never mixes by default)", () => {
    const view = resolveOurLadyFilter(undefined);
    expect(view.active).toBe("titles");
    expect(view.showTitles).toBe(true);
    expect(view.showApparitions).toBe(false);
  });

  it("Marian Titles filter shows only titles", () => {
    const view = resolveOurLadyFilter("titles");
    expect(view.showTitles).toBe(true);
    expect(view.showApparitions).toBe(false);
  });

  it("Apparitions filter shows only apparitions", () => {
    const view = resolveOurLadyFilter("apparitions");
    expect(view.active).toBe("apparitions");
    expect(view.showApparitions).toBe(true);
    expect(view.showTitles).toBe(false);
  });

  it("only the 'All' filter mixes titles and apparitions", () => {
    const all = resolveOurLadyFilter("all");
    expect(all.active).toBe("all");
    expect(all.showTitles).toBe(true);
    expect(all.showApparitions).toBe(true);
    // every non-all filter shows exactly one category
    for (const f of OUR_LADY_FILTERS.filter((x) => x.key !== "all")) {
      const v = resolveOurLadyFilter(f.key);
      expect(v.showTitles && v.showApparitions).toBe(false);
    }
  });

  it("falls back to the default for an unknown filter value", () => {
    expect(resolveOurLadyFilter("garbage").active).toBe("titles");
  });
});
