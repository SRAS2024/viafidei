/**
 * Filter chips are now decided by indexed COUNTS, not by scanning every
 * published payload (PUB-3). That only works while each chip's stored-subtype
 * list says exactly what its `matches()` predicate says — if the two drift, a
 * chip either disappears while it has content or appears empty. These tests
 * pin them together.
 */
import { describe, expect, it } from "vitest";

import { GUIDE_KINDS } from "@/lib/checklist/schemas/guide";
import { GUIDE_FILTERS, GUIDE_FILTER_SUBTYPES } from "@/lib/content-shared/guide-categories";
import {
  SAINT_FILTERS,
  SAINT_FILTER_SUBTYPES,
  saintSubtypeLabel,
} from "@/lib/content-shared/saint-categories";

/** Every `saintType` the published catalogue actually stores. */
const STORED_SAINT_TYPES = [
  "apostle",
  "bishop",
  "confessor",
  "doctor_of_the_church",
  "evangelist",
  "founder",
  "lay",
  "martyr",
  "missionary",
  "other",
  "pope",
  "religious",
  "virgin",
] as const;

describe("SAINT_FILTER_SUBTYPES", () => {
  it("covers every chip except All", () => {
    for (const f of SAINT_FILTERS) {
      if (f.key === "all") continue;
      expect(SAINT_FILTER_SUBTYPES[f.key], f.key).toBeTruthy();
      expect(SAINT_FILTER_SUBTYPES[f.key].length).toBeGreaterThan(0);
    }
  });

  it("agrees with each chip's matches() for every stored saintType", () => {
    for (const f of SAINT_FILTERS) {
      if (f.key === "all") continue;
      const listed = new Set(SAINT_FILTER_SUBTYPES[f.key]);
      for (const saintType of STORED_SAINT_TYPES) {
        expect(f.matches({ saintType }), `${f.key} / ${saintType}`).toBe(listed.has(saintType));
      }
    }
  });

  it("leaves the unclassified types out of every chip, so they only show under All", () => {
    const claimed = new Set(Object.values(SAINT_FILTER_SUBTYPES).flat());
    // "other" and "confessor" are deliberately not chips (see saint-categories).
    expect(claimed.has("other")).toBe(false);
    expect(claimed.has("confessor")).toBe(false);
    // Doctors have their own tab and must not become a Saints chip.
    expect(claimed.has("doctor_of_the_church")).toBe(false);
  });
});

describe("saintSubtypeLabel", () => {
  it("labels only the types the spec permits a title for", () => {
    expect(saintSubtypeLabel("apostle")).toBe("Apostle and Disciple of Jesus");
    expect(saintSubtypeLabel("doctor_of_the_church")).toBe("Doctor of the Church");
    expect(saintSubtypeLabel("evangelist")).toBe("Evangelist");
  });

  it("returns nothing rather than printing a stored enum", () => {
    for (const t of ["martyr", "virgin", "bishop", "religious", "other", "confessor", "lay"]) {
      expect(saintSubtypeLabel(t), t).toBeUndefined();
    }
    expect(saintSubtypeLabel(null)).toBeUndefined();
    expect(saintSubtypeLabel(undefined)).toBeUndefined();
  });

  it("never emits a machine-shaped token", () => {
    for (const t of STORED_SAINT_TYPES) {
      const label = saintSubtypeLabel(t);
      if (label) expect(label).not.toMatch(/[_-]/);
    }
  });
});

describe("GUIDE_FILTER_SUBTYPES", () => {
  it("covers every chip except All", () => {
    for (const f of GUIDE_FILTERS) {
      if (f.key === "all") continue;
      expect(GUIDE_FILTER_SUBTYPES[f.key], f.key).toBeTruthy();
    }
  });

  it("agrees with each chip's matches() for every guide `kind` in the schema", () => {
    for (const f of GUIDE_FILTERS) {
      if (f.key === "all") continue;
      const listed = new Set(GUIDE_FILTER_SUBTYPES[f.key]);
      for (const kind of GUIDE_KINDS) {
        expect(f.matches({ kind }), `${f.key} / ${kind}`).toBe(listed.has(kind));
      }
    }
  });

  it("claims every kind, so no guide is invisible to the chip counts", () => {
    const claimed = new Set(Object.values(GUIDE_FILTER_SUBTYPES).flat());
    for (const kind of GUIDE_KINDS) expect(claimed.has(kind), kind).toBe(true);
  });
});
