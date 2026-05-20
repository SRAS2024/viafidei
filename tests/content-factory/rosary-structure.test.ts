/**
 * Canonical Rosary structure tests (spec §9).
 */

import { describe, expect, it } from "vitest";
import {
  CANONICAL_ROSARY_STRUCTURE,
  ROSARY_MYSTERY_SETS,
  diffRosaryStructure,
  isRosaryArticleOrLivestream,
  matchMysterySet,
} from "@/lib/content-factory/normalize/rosary-structure";

describe("Canonical Rosary structure", () => {
  it("has four mystery sets, each with five mysteries", () => {
    expect(ROSARY_MYSTERY_SETS).toEqual(["joyful", "sorrowful", "glorious", "luminous"]);
    for (const set of ROSARY_MYSTERY_SETS) {
      expect(CANONICAL_ROSARY_STRUCTURE[set]).toHaveLength(5);
    }
  });

  it("matchMysterySet identifies set headings", () => {
    expect(matchMysterySet("The Joyful Mysteries")).toBe("joyful");
    expect(matchMysterySet("The Sorrowful Mysteries")).toBe("sorrowful");
    expect(matchMysterySet("The Glorious Mysteries")).toBe("glorious");
    expect(matchMysterySet("The Luminous Mysteries")).toBe("luminous");
    expect(matchMysterySet("Mysteries of Light")).toBe("luminous");
    expect(matchMysterySet("About the Rosary")).toBeNull();
  });

  it("diffRosaryStructure reports zero missing for a complete set", () => {
    const diff = diffRosaryStructure({
      set: "joyful",
      mysteryTitles: [
        "The Annunciation",
        "The Visitation",
        "The Nativity",
        "The Presentation in the Temple",
        "The Finding in the Temple",
      ],
    });
    expect(diff.matches).toBe(5);
    expect(diff.missingTitles).toEqual([]);
    expect(diff.extraTitles).toEqual([]);
  });

  it("diffRosaryStructure reports missing titles when partial", () => {
    const diff = diffRosaryStructure({
      set: "sorrowful",
      mysteryTitles: ["The Agony in the Garden", "The Scourging at the Pillar"],
    });
    expect(diff.matches).toBe(2);
    expect(diff.missingTitles).toContain("The Crucifixion");
  });
});

describe("isRosaryArticleOrLivestream()", () => {
  it("rejects a livestream page", () => {
    expect(
      isRosaryArticleOrLivestream({
        title: "Live Rosary at St. Patrick's",
        body: "Join us live every Sunday at 7pm. Click here to join.",
      }),
    ).toBe(true);
  });

  it("rejects an article about the Rosary", () => {
    expect(
      isRosaryArticleOrLivestream({
        title: "How to Pray the Rosary",
        body:
          "According to theologians, the Rosary developed over many centuries. " +
          "As theologian John Smith writes in his book on the Rosary, the prayer is...",
      }),
    ).toBe(true);
  });

  it("accepts a Rosary guide", () => {
    expect(
      isRosaryArticleOrLivestream({
        title: "The Rosary",
        body: "Begin with the Sign of the Cross. Then pray the Apostles' Creed, the Our Father...",
      }),
    ).toBe(false);
  });
});
