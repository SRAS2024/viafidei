/**
 * Render-readiness validator tests. Each public page template imports
 * the corresponding `check*Render` function and refuses to render
 * pages with empty required sections.
 */

import { describe, expect, it } from "vitest";
import {
  checkPrayerRender,
  checkSaintRender,
  checkApparitionRender,
  checkDevotionRender,
  checkNovenaRender,
  checkSacramentRender,
  checkRosaryRender,
  checkConsecrationRender,
  checkSpiritualGuidanceRender,
  checkLiturgyRender,
  checkHistoryRender,
  checkParishRender,
} from "@/lib/content-qa/render-readiness";

describe("render-readiness validators", () => {
  describe("Prayer", () => {
    it("ready when prayer type + name + text are present", () => {
      const r = checkPrayerRender({
        prayerType: "Marian prayer",
        defaultTitle: "Hail Mary",
        body: "Hail Mary, full of grace, the Lord is with thee. Blessed art thou. Amen.",
      });
      expect(r.ready).toBe(true);
      expect(r.missing).toHaveLength(0);
    });
    it("not ready when prayer text is empty", () => {
      const r = checkPrayerRender({
        prayerType: "Marian prayer",
        defaultTitle: "Hail Mary",
        body: "",
      });
      expect(r.ready).toBe(false);
      expect(r.missing).toContain("prayerText");
    });
  });

  describe("Saint", () => {
    it("ready when saintType + name + background present", () => {
      const r = checkSaintRender({
        saintType: "Saint",
        canonicalName: "Saint Anthony",
        biography:
          "Saint Anthony of Padua was born in 1195 in Lisbon. He became a Franciscan and died in 1231. He is a patron of lost things.",
        patronages: ["lost things"],
      });
      expect(r.ready).toBe(true);
    });
    it("not ready when biography is missing", () => {
      const r = checkSaintRender({
        saintType: "Saint",
        canonicalName: "Saint X",
        biography: "",
        patronages: [],
      });
      expect(r.ready).toBe(false);
      expect(r.missing).toContain("background");
    });
  });

  describe("Apparition", () => {
    it("not ready without location and country", () => {
      const r = checkApparitionRender({
        title: "Some apparition",
        summary: "Summary text long enough for the validator to consider this real.",
      });
      expect(r.ready).toBe(false);
      expect(r.missing).toContain("location");
      expect(r.missing).toContain("country");
    });
  });

  describe("Devotion", () => {
    it("not ready without practice instructions", () => {
      const r = checkDevotionRender({
        devotionType: "Marian devotion",
        title: "Marian Devotion",
        background: "Background text.",
        practiceInstructions: "",
        summary: "Summary text.",
      });
      expect(r.ready).toBe(false);
      expect(r.missing).toContain("practiceInstructions");
    });
  });

  describe("Novena", () => {
    it("not ready when days are missing", () => {
      const r = checkNovenaRender({
        title: "Novena",
        background: "Background.",
        purpose: "Purpose.",
        packageMetadata: { days: [] },
      });
      expect(r.ready).toBe(false);
    });
  });

  describe("Sacrament", () => {
    it("not ready when sacramentKey is missing", () => {
      const r = checkSacramentRender({
        sacramentKey: null,
        sacramentGroup: "Initiation",
        title: "Baptism",
        bodyText: "Body text",
      });
      expect(r.ready).toBe(false);
      expect(r.missing).toContain("sacramentKey");
    });
  });

  describe("Rosary", () => {
    it("not ready without core opening prayers", () => {
      const r = checkRosaryRender({
        title: "Rosary",
        background: "Background.",
        bodyText: "How to pray.",
        packageMetadata: { openingPrayers: [], mysterySets: [{}, {}, {}] },
      });
      expect(r.ready).toBe(false);
      expect(r.missing.some((m) => m.startsWith("coreOpeningPrayer"))).toBe(true);
    });
  });

  describe("Consecration", () => {
    it("not ready without daily prayers", () => {
      const r = checkConsecrationRender({
        title: "Consecration",
        background: "Background.",
        durationDays: 33,
        packageMetadata: { dailyPrayers: [], finalConsecrationPrayer: "Final prayer." },
      });
      expect(r.ready).toBe(false);
      expect(r.missing).toContain("dailyPrayers");
    });
  });

  describe("SpiritualGuidance", () => {
    it("not ready when steps are empty", () => {
      const r = checkSpiritualGuidanceRender({
        title: "Guide",
        summary: "Purpose.",
        steps: [],
      });
      expect(r.ready).toBe(false);
      expect(r.missing).toContain("steps");
    });
  });

  describe("Liturgy", () => {
    it("not ready without source", () => {
      const r = checkLiturgyRender({
        kind: "MASS_STRUCTURE",
        title: "Mass Structure",
        body: "Body text.",
        sourceUrl: null,
        externalSourceKey: null,
      });
      expect(r.ready).toBe(false);
      expect(r.missing).toContain("sourceUrl");
    });
  });

  describe("History", () => {
    it("not ready without an approved history type", () => {
      const r = checkHistoryRender({
        historyType: "Random",
        title: "Title",
        dateOrEra: "2026",
        summary: "Summary.",
        body: "Body.",
        sourceUrl: "https://www.vatican.va/x",
      });
      expect(r.ready).toBe(false);
      expect(r.missing).toContain("historyType");
    });
  });

  describe("Parish", () => {
    it("not ready without country", () => {
      const r = checkParishRender({
        name: "Saint Mary's",
        city: "Boston",
        country: null,
        sourceUrl: "https://parishesonline.com/x",
      });
      expect(r.ready).toBe(false);
      expect(r.missing).toContain("country");
    });
    it("not ready without source", () => {
      const r = checkParishRender({
        name: "Saint Mary's",
        city: "Boston",
        country: "USA",
      });
      expect(r.ready).toBe(false);
      expect(r.missing).toContain("sourceUrl");
    });
  });
});
