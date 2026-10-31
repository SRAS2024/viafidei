/**
 * Latin/Greek prayer translations + guide prayer lists. Proves the canonical
 * prayers carry authentic Latin/Greek liturgical text (so the language toggle
 * renders them), the variants are marked preserve (never auto-translated), and
 * guides list their applicable prayers in prayed-order for the universal toggle.
 */

import { describe, expect, it } from "vitest";

import { prayerKnowledge } from "@/lib/checklist/knowledge/prayers";
import { litanyKnowledge } from "@/lib/checklist/knowledge/litanies";
import {
  PRAYER_TRANSLATIONS,
  withCuratedTranslation,
} from "@/lib/checklist/knowledge/prayer-translations";
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

  it("every curated translation reaches its prayer, whichever registry holds it", () => {
    // The merge used to run over the legacy list only: a translation keyed to
    // a batch-file or litany-file slug was silently dropped.
    const registry = new Map(
      [...prayerKnowledge, ...litanyKnowledge].map((e) => [e.slug, e.payload] as const),
    );
    for (const [slug, t] of Object.entries(PRAYER_TRANSLATIONS)) {
      const payload = registry.get(slug);
      expect(payload, `${slug} is not a curated prayer`).toBeDefined();
      if (t.latin) expect(payload!.latin, slug).toBe(t.latin);
      if (t.greek) expect(payload!.greek, slug).toBe(t.greek);
    }
  });

  it("gives the older 'Come, Holy Ghost' wording the received Latin of the same prayer", () => {
    // One prayer in two English wordings: Veni, Sancte Spiritus with its
    // versicle and the Pentecost collect. The older one (batch-2) had no Latin.
    const modern = prayer("prayer-to-the-holy-spirit")!.payload;
    const older = prayer("come-holy-spirit")!.payload;
    expect(older.body as string).toMatch(/^Come, Holy Ghost,\nfill the hearts of Thy faithful/);
    expect(modern.latin as string).toMatch(/^Veni, Sancte Spiritus, reple tuorum corda fidelium/);
    expect(older.latin).toBe(modern.latin);
    expect(buildPrayerVariants(older).map((v) => v.code)).toEqual(["en", "la"]);
  });

  it("withCuratedTranslation merges into any entry and leaves the rest untouched", () => {
    const batchEntry = { slug: "our-father", payload: { body: "Our Father…", latin: "old" } };
    const merged = withCuratedTranslation(batchEntry);
    expect(merged.payload.latin).toBe(PRAYER_TRANSLATIONS["our-father"]!.latin);
    expect(merged.payload.greek).toBe(PRAYER_TRANSLATIONS["our-father"]!.greek);
    expect(merged.payload.body).toBe("Our Father…");

    const untranslated = { slug: "litany-of-the-saints", payload: { body: "Lord, have mercy." } };
    expect(withCuratedTranslation(untranslated)).toBe(untranslated);
  });
});

describe("guide applicable prayers", () => {
  it("the Rosary guide lists its prayers in prayed-order", () => {
    const rosary = guideKnowledge.find((g) => g.slug === "how-to-pray-the-rosary")!;
    // The curated Rosary guide (knowledge/guides/rosary-chaplets.ts) now opens
    // the list with the Sign of the Cross, which is where the Rosary actually
    // begins; the old expectation predates the sign-of-the-cross prayer entry.
    expect(rosary.payload.relatedPrayers).toEqual([
      "sign-of-the-cross",
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
