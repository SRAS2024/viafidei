/**
 * Tests that the curated knowledge base is well-formed and validates against
 * the strict content schemas. If any entry fails to validate it means a
 * developer bug — the curated content is the worker's ground truth.
 */

import { describe, it, expect } from "vitest";

import {
  ALL_CURATED_ENTRIES,
  curatedKnowledgeByType,
  curatedKnowledgeSize,
  findCuratedEntry,
} from "@/lib/checklist";
import { validatePayload } from "@/lib/checklist/schemas";
import { prayerKnowledge } from "@/lib/checklist/knowledge/prayers";
import { guideKnowledge } from "@/lib/checklist/knowledge/guides";

describe("curated knowledge base", () => {
  it("contains many entries", () => {
    // Was `> 40` when the registry was nine hand-written files. Every content
    // type now aggregates its per-group files as well, so this guards against
    // a group file silently falling out of its type's registry export.
    expect(curatedKnowledgeSize()).toBeGreaterThan(1000);
  });

  /**
   * `knowledge/prayers.ts` and `knowledge/guides.ts` each sit beside a
   * DIRECTORY of the same name. Node, tsx, vite and webpack all try extension
   * resolution before directory resolution, so the bare specifier must reach
   * the FILE — if it ever reached the directory instead, the registry would
   * lose every prayer and guide silently rather than failing to build. This is
   * a real import, not an argument: it fails the moment resolution changes.
   */
  it("resolves the bare ./prayers and ./guides specifiers to the aggregating FILE", () => {
    // Legacy entries that live only in prayers.ts / (formerly) guides.ts…
    expect(prayerKnowledge.some((e) => e.slug === "our-father")).toBe(true);
    // …alongside entries that live only in the same-named directory.
    expect(prayerKnowledge.some((e) => e.slug === "sign-of-the-cross")).toBe(true);
    expect(guideKnowledge.some((e) => e.slug === "ocia-rcia-overview")).toBe(true);
    expect(prayerKnowledge.length).toBeGreaterThan(200);
    expect(guideKnowledge.length).toBeGreaterThan(100);
  });

  it("never reuses one slug across two content types", () => {
    const owner = new Map<string, string>();
    for (const e of ALL_CURATED_ENTRIES) {
      const prior = owner.get(e.slug);
      expect(prior, `${e.slug} is both ${prior} and ${e.contentType}`).toBeUndefined();
      owner.set(e.slug, e.contentType);
    }
  });

  it("resolves every related-slug reference to an entry of the right type", () => {
    const known = new Map<string, Set<string>>();
    for (const e of ALL_CURATED_ENTRIES)
      known.set(e.contentType, (known.get(e.contentType) ?? new Set()).add(e.slug));
    const dangling: string[] = [];
    for (const e of ALL_CURATED_ENTRIES) {
      const p = e.payload as Record<string, unknown>;
      const refs: Array<[string, string]> = [];
      const list = (key: string, type: string) => {
        for (const s of (p[key] as unknown[]) ?? []) refs.push([type, String(s)]);
      };
      list("relatedPrayers", "PRAYER");
      list("associatedPrayers", "PRAYER");
      list("relatedSaints", "SAINT");
      list("relatedDevotions", "DEVOTION");
      list("relatedPractices", "SPIRITUAL_PRACTICE");
      const one = (key: string, type: string) => {
        if (typeof p[key] === "string") refs.push([type, p[key] as string]);
      };
      one("associatedSaintSlug", "SAINT");
      one("associatedDevotionSlug", "DEVOTION");
      one("associatedMarianTitleSlug", "MARIAN_TITLE");
      one("associatedApparitionSlug", "APPARITION");
      for (const [type, slug] of refs)
        if (!known.get(type)?.has(slug))
          dangling.push(`${e.contentType}/${e.slug} -> unknown ${type} "${slug}"`);
    }
    expect(dangling).toEqual([]);
  });

  it("covers all 15 content types with at least one entry each", () => {
    const counts = curatedKnowledgeByType();
    const types = [
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
    for (const t of types) {
      expect(counts[t] ?? 0).toBeGreaterThan(0);
    }
  });

  it("locates the canonical Doctor, Pope, Rite, and Parish slugs", () => {
    expect(findCuratedEntry("DOCTOR", "doctor-thomas-aquinas")).toBeDefined();
    expect(findCuratedEntry("POPE", "pope-saint-john-paul-ii")).toBeDefined();
    expect(findCuratedEntry("RITE", "rite-roman")).toBeDefined();
    expect(findCuratedEntry("PARISH", "basilica-saint-peter-vatican")).toBeDefined();
  });

  it("every entry validates against its content schema", () => {
    for (const entry of ALL_CURATED_ENTRIES) {
      const result = validatePayload(entry.contentType, entry.payload);
      if (!result.ok) {
        // Surface the first error so the test report is useful.
        throw new Error(
          `Curated entry ${entry.contentType}:${entry.slug} failed validation: ${result.errors.join("; ")}`,
        );
      }
      expect(result.ok).toBe(true);
    }
  });

  it("every entry has a non-empty citation list", () => {
    for (const entry of ALL_CURATED_ENTRIES) {
      expect(entry.citations.length).toBeGreaterThan(0);
    }
  });

  it("findCuratedEntry locates the seven sacraments", () => {
    const slugs = [
      "baptism",
      "confirmation",
      "eucharist",
      "reconciliation",
      "anointing-of-the-sick",
      "holy-orders",
      "matrimony",
    ];
    for (const slug of slugs) {
      const entry = findCuratedEntry("SACRAMENT", slug);
      expect(entry, `missing sacrament ${slug}`).toBeDefined();
      expect(entry!.authorityLevel).toBe("CATECHISM");
    }
  });

  it("findCuratedEntry locates Our Father and Hail Mary", () => {
    expect(findCuratedEntry("PRAYER", "our-father")).toBeDefined();
    expect(findCuratedEntry("PRAYER", "hail-mary")).toBeDefined();
  });

  it("returns undefined for an unknown slug", () => {
    expect(findCuratedEntry("PRAYER", "nonexistent-prayer-slug")).toBeUndefined();
  });
});
