/**
 * The prayer lists behind every surface that shows prayers with the Latin /
 * Greek chips (src/lib/data/prayer-sets.ts).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PublishedItem } from "@/lib/data/published";

const listPublishedBySlugs = vi.fn();
/** A failed lookup is a plain rejected promise, outside the spy's bookkeeping. */
let lookupFails = false;
vi.mock("@/lib/data/published", () => ({
  listPublishedBySlugs: (...args: unknown[]) =>
    lookupFails ? Promise.reject(new Error("db down")) : listPublishedBySlugs(...args),
}));

import { loadNamedPrayers, loadPrayerSet } from "@/lib/data/prayer-sets";

function prayer(slug: string, title: string, payload: Record<string, unknown>): PublishedItem {
  return { id: slug, contentType: "PRAYER", slug, title, subtitle: "", payload } as PublishedItem;
}

const OUR_FATHER = prayer("our-father", "Our Father", {
  body: "Our Father, who art in heaven...",
  latin: "Pater noster...",
  greek: "Πάτερ ἡμῶν...",
});
const HAIL_MARY = prayer("hail-mary", "Hail Mary", { body: "Hail Mary, full of grace..." });
const TITLE_ONLY = prayer("prayer-videos", "Prayer Videos", {});

beforeEach(() => {
  listPublishedBySlugs.mockReset();
  lookupFails = false;
});

describe("loadPrayerSet", () => {
  it("returns each published prayer with its language variants, in the order given", async () => {
    listPublishedBySlugs.mockResolvedValue([OUR_FATHER, HAIL_MARY]);
    const set = await loadPrayerSet(["our-father", "hail-mary"]);
    expect(listPublishedBySlugs).toHaveBeenCalledWith("PRAYER", ["our-father", "hail-mary"]);
    expect(set.map((p) => p.slug)).toEqual(["our-father", "hail-mary"]);
    expect(set[0]!.variants.map((v) => v.code)).toEqual(["en", "la", "el"]);
  });

  it("drops a prayer with no text, ignores junk input, and survives a failed lookup", async () => {
    listPublishedBySlugs.mockResolvedValue([TITLE_ONLY, HAIL_MARY]);
    expect((await loadPrayerSet(["prayer-videos", "hail-mary"])).map((p) => p.slug)).toEqual([
      "hail-mary",
    ]);
    expect(await loadPrayerSet("our-father")).toEqual([]);
    expect(await loadPrayerSet([42, ""])).toEqual([]);
    lookupFails = true;
    expect(await loadPrayerSet(["our-father"])).toEqual([]);
  });
});

describe("loadNamedPrayers", () => {
  it("finds the building-block prayers a text names, in the order it names them", async () => {
    listPublishedBySlugs.mockResolvedValue([OUR_FATHER, HAIL_MARY]);
    const named = await loadNamedPrayers(["Pray three Hail Marys, then one Our Father."], {
      matchCase: true,
    });
    expect(named.map((p) => p.slug)).toEqual(["hail-mary", "our-father"]);
  });

  it("never links a prayer to itself", async () => {
    listPublishedBySlugs.mockResolvedValue([OUR_FATHER, HAIL_MARY]);
    const named = await loadNamedPrayers(["Our Father, who art in heaven"], {
      matchCase: true,
      exclude: "our-father",
    });
    expect(named).toEqual([]);
  });

  it("does not query at all for empty text", async () => {
    expect(await loadNamedPrayers(["", " "])).toEqual([]);
    expect(listPublishedBySlugs).not.toHaveBeenCalled();
  });
});
