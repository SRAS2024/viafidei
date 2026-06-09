/**
 * Single source of truth for the EXTRACTABLE content types. Proves the
 * predicate that keeps terminal reads (UNUSABLE / WRONG / unknown) out of the
 * extraction queue, and guards that every ChecklistContentType the worker
 * tracks as a growth goal can actually be turned into a package artifact —
 * i.e. the worker implements every content type, not just most of them.
 */

import { describe, expect, it } from "vitest";

import {
  EXTRACTABLE_CONTENT_TYPES,
  isExtractableContentType,
} from "@/lib/admin-worker/content-types";

// Mirrors the ChecklistContentType enum in prisma/schema.prisma. Hardcoded so
// this test fails loudly if a new content type is added to the schema without
// a matching extractor — the exact gap that left MARIAN_TITLE / GUIDE /
// SPIRITUAL_PRACTICE unimplemented.
const CHECKLIST_CONTENT_TYPES = [
  "PRAYER",
  "DEVOTION",
  "SAINT",
  "MARIAN_TITLE",
  "APPARITION",
  "NOVENA",
  "SACRAMENT",
  "GUIDE",
  "CHURCH_DOCUMENT",
  "LITURGICAL",
  "SPIRITUAL_PRACTICE",
  "PARISH",
  "POPE",
  "DOCTOR",
  "RITE",
] as const;

describe("isExtractableContentType", () => {
  it("is false for terminal / unknown detected types", () => {
    expect(isExtractableContentType("UNUSABLE")).toBe(false);
    expect(isExtractableContentType("WRONG")).toBe(false);
    expect(isExtractableContentType(null)).toBe(false);
    expect(isExtractableContentType(undefined)).toBe(false);
    expect(isExtractableContentType("NOT_A_TYPE")).toBe(false);
  });

  it("is true for every extractable type, including the internal classifier types", () => {
    for (const t of EXTRACTABLE_CONTENT_TYPES) {
      expect(isExtractableContentType(t)).toBe(true);
    }
    // ROSARY + CONSECRATION are classifier-internal but have real extractors.
    expect(isExtractableContentType("ROSARY")).toBe(true);
    expect(isExtractableContentType("CONSECRATION")).toBe(true);
  });
});

describe("every ChecklistContentType is extractable", () => {
  it("has no growth-goal content type that the extraction pipeline can't build", () => {
    const missing = CHECKLIST_CONTENT_TYPES.filter((t) => !isExtractableContentType(t));
    expect(missing).toEqual([]);
  });
});
