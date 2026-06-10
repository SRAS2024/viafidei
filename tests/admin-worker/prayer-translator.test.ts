/**
 * The deterministic liturgical translation engine the Admin Worker uses to build
 * Latin/Greek itself. Proves three things that matter for sacred text:
 *   1. It emits the AUTHENTIC received text for canonical prayers (whole-prayer
 *      match), not a guessed/word-substituted text.
 *   2. It can assemble a composite devotion from authoritative segments and only
 *      calls the result accurate when every segment resolves.
 *   3. It REFUSES to fabricate: when no authentic form is derivable it returns
 *      no text and accurate=false, reporting the unresolved lines for review.
 */

import { describe, expect, it } from "vitest";

import { prayerKnowledge } from "@/lib/checklist/knowledge/prayers";
import { translatePrayer, translatePrayerLanguages } from "@/lib/admin-worker/prayer-translator";

function body(slug: string): string {
  return String(
    (prayerKnowledge.find((p) => p.slug === slug)!.payload as Record<string, unknown>).body,
  );
}

describe("prayer translation engine — authentic whole-prayer match", () => {
  it("builds the Our Father's authentic Latin AND Greek from its English body", () => {
    const en = body("our-father");
    const la = translatePrayer(en, "la");
    expect(la.accurate).toBe(true);
    expect(la.matched).toBe("whole-prayer");
    expect(la.text).toMatch(/^Pater noster, qui es in caelis/);

    const el = translatePrayer(en, "el");
    expect(el.accurate).toBe(true);
    expect(el.text).toMatch(/^Πάτερ ἡμῶν/);
  });

  it("matches even when the vernacular uses thee/thou/thy (folding)", () => {
    // The Hail Mary body uses archaic pronouns; folding must still match it.
    const la = translatePrayer(body("hail-mary"), "la");
    expect(la.accurate).toBe(true);
    expect(la.text).toMatch(/^Ave Maria, gratia plena/);
  });

  it("translatePrayerLanguages returns both languages where authentic", () => {
    const t = translatePrayerLanguages(body("our-father"));
    expect(t.latin).toMatch(/Pater noster/);
    expect(t.greek).toMatch(/Πάτερ/);
  });
});

describe("prayer translation engine — composite assembly", () => {
  it("assembles a composite of canonical prayers into authentic Latin", () => {
    const composite = [body("our-father"), body("hail-mary"), body("glory-be")].join("\n\n");
    const la = translatePrayer(composite, "la");
    expect(la.accurate).toBe(true);
    expect(la.matched).toBe("segments");
    expect(la.text).toContain("Pater noster");
    expect(la.text).toContain("Ave Maria");
    expect(la.text).toContain("Gloria Patri");
  });

  it("resolves stock liturgical units (Amen, Through Christ our Lord)", () => {
    expect(translatePrayer("Amen.", "la").text).toBe("Amen.");
    expect(translatePrayer("Through Christ our Lord. Amen.", "la").accurate).toBe(true);
  });
});

describe("prayer translation engine — refuses to fabricate", () => {
  it("returns no text for a Latin-Rite prayer that has no authentic Greek form", () => {
    // The Salve Regina has authentic Latin but no received Greek liturgical text.
    const el = translatePrayer(body("salve-regina"), "el");
    expect(el.accurate).toBe(false);
    expect(el.text).toBeNull();
  });

  it("returns no text and lists unresolved lines for novel free prose", () => {
    const novel = "Lord, please bless my new job interview tomorrow morning.";
    const la = translatePrayer(novel, "la");
    expect(la.accurate).toBe(false);
    expect(la.text).toBeNull();
    expect(la.unresolved.length).toBeGreaterThan(0);
  });

  it("never invents Greek for a prayer the worker only has in Latin", () => {
    const t = translatePrayerLanguages(body("anima-christi"));
    expect(t.latin).toMatch(/Anima Christi/);
    expect(t.greek).toBeUndefined();
  });
});
