/**
 * The master checklists are DERIVED from the curated knowledge base: one seed
 * per curated entry (carrying the entry's citations) plus an explicit
 * allow-list of hand-written extras for items intentionally not curated yet.
 * These tests make drift between the two impossible.
 */

import { describe, expect, it } from "vitest";

import type { ChecklistContentType } from "@prisma/client";

import { ALL_CURATED_ENTRIES, findCuratedEntry } from "@/lib/checklist";
import {
  CHECKLIST_EXTRAS,
  MASTER_CHECKLISTS,
  curatedChecklist,
  seedFromCurated,
  uncuratedExtras,
} from "@/lib/checklist/checklists";

const TYPES = Object.keys(MASTER_CHECKLISTS) as ChecklistContentType[];

function curatedSlugs(type: ChecklistContentType): Set<string> {
  return new Set(ALL_CURATED_ENTRIES.filter((e) => e.contentType === type).map((e) => e.slug));
}

describe("master checklists derived from the curated registry", () => {
  it("every checklist slug for a type with curated entries is curated or on the allow-list", () => {
    for (const type of TYPES) {
      const curated = curatedSlugs(type);
      if (curated.size === 0) continue;
      const allowList = new Set(CHECKLIST_EXTRAS[type].map((s) => s.canonicalSlug));
      for (const seed of MASTER_CHECKLISTS[type]) {
        expect(
          curated.has(seed.canonicalSlug) || allowList.has(seed.canonicalSlug),
          `${type}/${seed.canonicalSlug} is neither curated nor allow-listed`,
        ).toBe(true);
      }
    }
  });

  it("every curated entry is on its type's master checklist", () => {
    for (const entry of ALL_CURATED_ENTRIES) {
      const slugs = new Set(MASTER_CHECKLISTS[entry.contentType].map((s) => s.canonicalSlug));
      expect(slugs.has(entry.slug), `${entry.contentType}/${entry.slug}`).toBe(true);
    }
  });

  it("every curated row ships the curated citations and authority level", () => {
    for (const type of TYPES) {
      for (const seed of MASTER_CHECKLISTS[type]) {
        const entry = findCuratedEntry(type, seed.canonicalSlug);
        if (!entry) continue;
        expect(seed.seedCitations?.map((c) => c.sourceUrl)).toEqual(entry.citations);
        expect(seed.seedCitations?.every((c) => c.authorityLevel === entry.authorityLevel)).toBe(
          true,
        );
        expect(seed.authorityLevelHint).toBeDefined();
        expect(seed.canonicalName.length).toBeGreaterThan(0);
      }
    }
  });

  it("allow-listed extras are genuinely not curated (an extra that becomes curated is dropped)", () => {
    for (const type of TYPES) {
      const curated = curatedSlugs(type);
      for (const extra of CHECKLIST_EXTRAS[type]) {
        expect(curated.has(extra.canonicalSlug), `${type}/${extra.canonicalSlug}`).toBe(false);
      }
      expect(uncuratedExtras(type, CHECKLIST_EXTRAS[type]).sort()).toEqual(
        CHECKLIST_EXTRAS[type].map((e) => e.canonicalSlug).sort(),
      );
    }
    // A hand-written extra that duplicates a curated slug never doubles the row.
    const list = curatedChecklist("PRAYER", {
      extras: [{ canonicalName: "Dup", canonicalSlug: "our-father" }],
    });
    expect(list.filter((s) => s.canonicalSlug === "our-father")).toHaveLength(1);
    expect(list.find((s) => s.canonicalSlug === "our-father")!.canonicalName).toBe("Our Father");
  });

  it("never reuses a slug across content types (canonicalSlug is globally unique)", () => {
    const seen = new Map<string, string>();
    for (const type of TYPES) {
      for (const seed of MASTER_CHECKLISTS[type]) {
        const prior = seen.get(seed.canonicalSlug);
        expect(prior, `${seed.canonicalSlug} in both ${prior} and ${type}`).toBeUndefined();
        seen.set(seed.canonicalSlug, type);
      }
    }
  });

  it("uses the payload's display name and copies the requested metadata", () => {
    const peter = findCuratedEntry("SAINT", "saint-peter")!;
    const seed = seedFromCurated(peter, 1, { metadataFields: ["feastDay", "saintType"] });
    expect(seed.canonicalName).toBe("Saint Peter the Apostle");
    expect(seed.metadata).toEqual({ feastDay: "06-29", saintType: "apostle" });
    expect(seed.priority).toBe(11);
    const overridden = seedFromCurated(peter, 1, {
      overrides: { "saint-peter": { aliases: ["Simon Peter"], priority: 5 } },
    });
    expect(overridden.aliases).toEqual(["Simon Peter"]);
    expect(overridden.priority).toBe(5);
  });

  it("no longer carries the drifted duplicate slugs of the old hand-written lists", () => {
    const all = new Set(
      Object.values(MASTER_CHECKLISTS)
        .flat()
        .map((s) => s.canonicalSlug),
    );
    for (const drifted of [
      "how-to-prepare-for-adoration",
      "how-to-make-marian-consecration",
      "how-to-pray-liturgy-of-the-hours",
      "first-friday-devotion",
      "brown-scapular-devotion",
      "stations-of-the-cross-practice",
      "apparition-our-lady-of-champion",
      "stella-maris",
      "saint-nicholas-of-myra",
      "litany-of-the-sacred-heart",
    ]) {
      expect(all.has(drifted), drifted).toBe(false);
    }
  });

  it("GUIDE: the checklist is the curated guides plus the authoring backlog", () => {
    const curated = curatedSlugs("GUIDE");
    const slugs = MASTER_CHECKLISTS.GUIDE.map((s) => s.canonicalSlug);
    for (const slug of curated) expect(slugs).toContain(slug);
    expect(slugs).toContain("how-to-pray-the-rosary");
    expect(slugs).toContain("how-to-make-a-holy-hour");
    expect(slugs).toContain("how-to-make-a-marian-consecration");
  });

  it("seeds the recognized rites with their rite keys", () => {
    for (const seed of MASTER_CHECKLISTS.RITE) {
      expect(typeof seed.metadata?.riteKey).toBe("string");
    }
  });
});
