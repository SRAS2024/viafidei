/**
 * Content-page filters for Saints, Guides, Rites, Liturgy, and Spiritual Life.
 * Each tab splits its published items into categories; "All" shows everything
 * and a specific category never does. Mirrors church-documents-filter.test.ts.
 */

import { describe, expect, it } from "vitest";

import {
  applyPayloadFilter,
  resolvePayloadFilter,
  type PayloadFilter,
} from "@/lib/content-shared/payload-filter";
import { SAINT_FILTERS } from "@/lib/content-shared/saint-categories";
import { GUIDE_FILTERS } from "@/lib/content-shared/guide-categories";
import { RITE_FILTERS } from "@/lib/content-shared/rite-categories";
import { LITURGICAL_FILTERS } from "@/lib/content-shared/liturgical-categories";
import { SPIRITUAL_FILTERS } from "@/lib/content-shared/spiritual-categories";

type Item = { payload: Record<string, unknown> };
const item = (payload: Record<string, unknown>): Item => ({ payload });

function keyFor(filters: readonly PayloadFilter[], it: Item, exclude = "all"): string | undefined {
  return filters.find((f) => f.key !== exclude && f.matches(it.payload))?.key;
}

describe("shared payload-filter factory", () => {
  const filters = SAINT_FILTERS;
  it("resolves unknown/undefined keys to the first (All) filter", () => {
    expect(resolvePayloadFilter(filters, undefined).key).toBe("all");
    expect(resolvePayloadFilter(filters, "garbage").key).toBe("all");
    expect(filters[0].key).toBe("all");
  });
  it("applyPayloadFilter('all') returns everything", () => {
    const items = [item({ saintType: "martyr" }), item({ saintType: "pope" })];
    expect(applyPayloadFilter(filters, items, "all")).toHaveLength(2);
  });
});

describe("Saint categories", () => {
  it("routes each saintType to its category", () => {
    expect(keyFor(SAINT_FILTERS, item({ saintType: "martyr" }))).toBe("martyrs");
    expect(keyFor(SAINT_FILTERS, item({ saintType: "apostle" }))).toBe("apostles");
    expect(keyFor(SAINT_FILTERS, item({ saintType: "evangelist" }))).toBe("apostles");
    expect(keyFor(SAINT_FILTERS, item({ saintType: "pope" }))).toBe("popes");
    expect(keyFor(SAINT_FILTERS, item({ saintType: "founder" }))).toBe("religious");
    expect(keyFor(SAINT_FILTERS, item({ saintType: "virgin" }))).toBe("virgins");
    expect(keyFor(SAINT_FILTERS, item({ saintType: "lay" }))).toBe("laity");
  });

  it("does NOT offer Doctors or Our Lady as Saints filters (each has its own tab)", () => {
    // Doctors of the Church have a dedicated /doctors tab — a doctor-saint still
    // shows under All but matches no Saints category filter.
    expect(SAINT_FILTERS.some((f) => f.key === "doctors")).toBe(false);
    expect(keyFor(SAINT_FILTERS, item({ saintType: "doctor_of_the_church" }))).toBeUndefined();
    // Our Lady (Marian titles + apparitions) lives only under /our-lady.
    expect(SAINT_FILTERS.some((f) => f.key === "lady" || f.key === "marian")).toBe(false);
  });
  it("a specific category is a strict subset of All", () => {
    const items = [
      item({ saintType: "martyr" }),
      item({ saintType: "pope" }),
      item({ saintType: "virgin" }),
    ];
    expect(applyPayloadFilter(SAINT_FILTERS, items, "all")).toHaveLength(3);
    expect(applyPayloadFilter(SAINT_FILTERS, items, "popes")).toHaveLength(1);
  });
});

describe("Guide categories", () => {
  it("surfaces chaplets (the Divine Mercy Chaplet) under Chaplets", () => {
    expect(keyFor(GUIDE_FILTERS, item({ kind: "chaplet" }))).toBe("chaplets");
    expect(
      keyFor(GUIDE_FILTERS, item({ kind: "general", title: "Divine Mercy Chaplet guide" })),
    ).toBe("chaplets");
  });
  it("routes other kinds correctly", () => {
    expect(keyFor(GUIDE_FILTERS, item({ kind: "rosary" }))).toBe("rosary");
    expect(keyFor(GUIDE_FILTERS, item({ kind: "confession" }))).toBe("sacramental");
    expect(keyFor(GUIDE_FILTERS, item({ kind: "consecration" }))).toBe("sacramental");
    expect(keyFor(GUIDE_FILTERS, item({ kind: "discernment" }))).toBe("discernment");
    expect(keyFor(GUIDE_FILTERS, item({ kind: "advent_preparation" }))).toBe("seasonal");
    expect(keyFor(GUIDE_FILTERS, item({ kind: "rcia" }))).toBe("rcia");
    expect(keyFor(GUIDE_FILTERS, item({ kind: "general" }))).toBe("general");
  });
});

describe("Rite families", () => {
  it("splits Latin and Eastern by riteKey", () => {
    expect(keyFor(RITE_FILTERS, item({ riteKey: "roman" }))).toBe("latin");
    expect(keyFor(RITE_FILTERS, item({ riteKey: "byzantine" }))).toBe("eastern");
    expect(keyFor(RITE_FILTERS, item({ riteKey: "maronite" }))).toBe("eastern");
  });
  it("All includes both; Eastern excludes the Latin rite", () => {
    const items = [item({ riteKey: "roman" }), item({ riteKey: "byzantine" })];
    expect(applyPayloadFilter(RITE_FILTERS, items, "all")).toHaveLength(2);
    const eastern = applyPayloadFilter(RITE_FILTERS, items, "eastern");
    expect(eastern).toHaveLength(1);
    expect(eastern[0].payload.riteKey).toBe("byzantine");
  });
});

describe("Liturgy categories", () => {
  it("routes each kind to its category", () => {
    expect(keyFor(LITURGICAL_FILTERS, item({ kind: "solemnity" }))).toBe("feasts");
    expect(keyFor(LITURGICAL_FILTERS, item({ kind: "memorial" }))).toBe("memorials");
    expect(keyFor(LITURGICAL_FILTERS, item({ kind: "liturgical_season" }))).toBe("seasons");
    expect(keyFor(LITURGICAL_FILTERS, item({ kind: "mass_structure" }))).toBe("mass-rites");
    expect(keyFor(LITURGICAL_FILTERS, item({ kind: "glossary_term" }))).toBe("explained");
  });
});

describe("Spiritual-life categories", () => {
  it("routes each practiceKind to its category", () => {
    expect(keyFor(SPIRITUAL_FILTERS, item({ practiceKind: "lectio_divina" }))).toBe("prayer");
    expect(keyFor(SPIRITUAL_FILTERS, item({ practiceKind: "fasting" }))).toBe("penance");
    expect(keyFor(SPIRITUAL_FILTERS, item({ practiceKind: "pilgrimage" }))).toBe("pilgrimage");
    expect(keyFor(SPIRITUAL_FILTERS, item({ practiceKind: "spiritual_direction" }))).toBe(
      "discernment",
    );
  });
});

describe("every filter set is well-formed", () => {
  const sets: Array<[string, readonly PayloadFilter[]]> = [
    ["saints", SAINT_FILTERS],
    ["guides", GUIDE_FILTERS],
    ["rites", RITE_FILTERS],
    ["liturgy", LITURGICAL_FILTERS],
    ["spiritual", SPIRITUAL_FILTERS],
  ];
  it("each begins with an 'all' filter that matches anything", () => {
    for (const [name, set] of sets) {
      expect(set[0].key, name).toBe("all");
      expect(set[0].matches({}), name).toBe(true);
    }
  });
  it("filter keys are unique within each set", () => {
    for (const [name, set] of sets) {
      const keys = set.map((f) => f.key);
      expect(new Set(keys).size, name).toBe(keys.length);
    }
  });
});
