/**
 * Latin/Greek prayer translations + guide prayer lists. Proves the canonical
 * prayers carry authentic Latin/Greek liturgical text (so the language toggle
 * renders them), the variants are marked preserve (never auto-translated), and
 * guides list their applicable prayers in prayed-order for the universal toggle.
 */

import { describe, expect, it } from "vitest";

import { prayerKnowledge } from "@/lib/checklist/knowledge/prayers";
import { guideKnowledge } from "@/lib/checklist/knowledge/guides";
import { buildPrayerVariants } from "@/lib/content-shared/prayer-language";

function prayer(slug: string) {
  return prayerKnowledge.find((p) => p.slug === slug);
}

describe("prayer translations", () => {
  it("the Our Father carries authentic Latin AND Greek", () => {
    const p = prayer("our-father")!;
    expect(p.payload.latin as string).toMatch(/^Pater noster, qui es in caelis/);
    expect(p.payload.greek as string).toMatch(/^Πάτερ ἡμῶν/);
  });

  it("the Hail Mary and Glory Be carry Latin (and the toggle exposes them, preserved)", () => {
    expect(prayer("hail-mary")!.payload.latin as string).toMatch(/^Ave Maria, gratia plena/);
    expect(prayer("glory-be")!.payload.latin as string).toMatch(/^Gloria Patri/);

    const variants = buildPrayerVariants(prayer("our-father")!.payload);
    const codes = variants.map((v) => v.code);
    expect(codes).toContain("en");
    expect(codes).toContain("la");
    expect(codes).toContain("el");
    // Latin + Greek must never be auto-translated.
    expect(variants.find((v) => v.code === "la")!.preserve).toBe(true);
    expect(variants.find((v) => v.code === "el")!.preserve).toBe(true);
    expect(variants.find((v) => v.code === "en")!.preserve).toBe(false);
  });

  it("at least the core liturgical prayers are translated", () => {
    const translated = prayerKnowledge.filter(
      (p) => typeof p.payload.latin === "string" || typeof p.payload.greek === "string",
    );
    expect(translated.length).toBeGreaterThanOrEqual(20);
  });
});

describe("guide applicable prayers", () => {
  it("the Rosary guide lists its prayers in prayed-order", () => {
    const rosary = guideKnowledge.find((g) => g.slug === "how-to-pray-the-rosary")!;
    expect(rosary.payload.relatedPrayers).toEqual([
      "apostles-creed",
      "our-father",
      "hail-mary",
      "glory-be",
      "fatima-prayer",
      "salve-regina",
      "prayer-to-saint-michael",
    ]);
  });

  it("the Divine Mercy chaplet and confession guides list their prayers", () => {
    const chaplet = guideKnowledge.find((g) => g.slug === "how-to-pray-the-divine-mercy-chaplet")!;
    expect(chaplet.payload.relatedPrayers).toContain("our-father");
    const confession = guideKnowledge.find((g) => g.slug === "how-to-go-to-confession")!;
    expect(confession.payload.relatedPrayers).toContain("act-of-contrition");
  });
});
