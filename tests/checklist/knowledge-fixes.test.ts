/**
 * Data-quality guards on the curated knowledge base: the Annunciation is a
 * Lenten solemnity, Christmas has four Masses, the Divine Mercy Chaplet is a
 * devotion to Christ, the Holy Hour and the Stations live under DEVOTION only,
 * and every Doctor of the Church carries a MM-DD feast and a state of life.
 */

import { describe, expect, it } from "vitest";

import { ALL_CURATED_ENTRIES, findCuratedEntry } from "@/lib/checklist";
import { validatePayload } from "@/lib/checklist/schemas";

describe("curated knowledge fixes", () => {
  it("files the Annunciation under Lent (March 25 never falls in Ordinary Time)", () => {
    const entry = findCuratedEntry("LITURGICAL", "solemnity-annunciation")!;
    expect(entry.payload.season).toBe("lent");
    expect(entry.payload.feastDate).toBe("03-25");
  });

  it("lists the four Masses of Christmas", () => {
    const entry = findCuratedEntry("LITURGICAL", "solemnity-christmas")!;
    expect(entry.payload.body).toMatch(/Four Masses are provided/);
    expect(entry.payload.body).not.toMatch(/Three Masses/);
  });

  it("types the Divine Mercy Chaplet as a devotion to Christ, not a Marian devotion", () => {
    const entry = findCuratedEntry("DEVOTION", "divine-mercy-chaplet")!;
    expect(entry.payload.devotionType).toBe("christological");
  });

  it("gives the Holy Hour and the Stations one canonical home (DEVOTION)", () => {
    expect(findCuratedEntry("SPIRITUAL_PRACTICE", "the-holy-hour")).toBeUndefined();
    expect(
      findCuratedEntry("SPIRITUAL_PRACTICE", "praying-the-stations-of-the-cross"),
    ).toBeUndefined();
    expect(findCuratedEntry("DEVOTION", "holy-hour")).toBeDefined();
    expect(findCuratedEntry("DEVOTION", "stations-of-the-cross")).toBeDefined();
    // No two curated entries of different types share a title.
    const titles = new Map<string, string>();
    for (const e of ALL_CURATED_ENTRIES) {
      if (e.contentType !== "DEVOTION" && e.contentType !== "SPIRITUAL_PRACTICE") continue;
      const title = String(e.payload.title).toLowerCase().replace(/^the /, "");
      expect(
        titles.get(title),
        `${e.contentType}/${e.slug} duplicates ${titles.get(title)}`,
      ).toBeUndefined();
      titles.set(title, `${e.contentType}/${e.slug}`);
    }
  });

  it("gives all 37 Doctors a MM-DD feast, feastMonth/feastDayOfMonth, and an ecclesialRole", () => {
    const doctors = ALL_CURATED_ENTRIES.filter((e) => e.contentType === "DOCTOR");
    expect(doctors).toHaveLength(37);
    const roles = new Set(["pope", "bishop", "priest", "deacon", "religious", "lay"]);
    for (const d of doctors) {
      const feast = String(d.payload.feastDay);
      expect(feast, d.slug).toMatch(/^\d{2}-\d{2}$/);
      const [mm, dd] = feast.split("-").map((s) => parseInt(s, 10));
      expect(d.payload.feastMonth, d.slug).toBe(mm);
      expect(d.payload.feastDayOfMonth, d.slug).toBe(dd);
      expect(roles.has(String(d.payload.ecclesialRole)), d.slug).toBe(true);
      expect(validatePayload("DOCTOR", d.payload).ok).toBe(true);
    }
    // Sixteen of the thirty-seven were not bishops.
    const nonBishops = doctors.filter(
      (d) => d.payload.ecclesialRole !== "bishop" && d.payload.ecclesialRole !== "pope",
    );
    expect(nonBishops).toHaveLength(16);
    expect(findCuratedEntry("DOCTOR", "doctor-ephrem-the-syrian")!.payload.ecclesialRole).toBe(
      "deacon",
    );
    expect(findCuratedEntry("DOCTOR", "doctor-catherine-of-siena")!.payload.ecclesialRole).toBe(
      "lay",
    );
    expect(findCuratedEntry("DOCTOR", "doctor-augustine-of-hippo")!.payload.feastDay).toBe("08-28");
    expect(findCuratedEntry("DOCTOR", "doctor-leo-the-great")!.payload.ecclesialRole).toBe("pope");
  });

  it("publishes the parsed (validated) payload: zod defaults are present after validation", () => {
    const entry = findCuratedEntry("NOVENA", "divine-mercy-novena")!;
    const parsed = validatePayload("NOVENA", entry.payload);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.data.days).toHaveLength(9);
    const guide = validatePayload(
      "GUIDE",
      findCuratedEntry("GUIDE", "how-to-pray-the-rosary")!.payload,
    );
    expect(guide.ok && Array.isArray(guide.data.whatYouNeed)).toBe(true);
  });
});
