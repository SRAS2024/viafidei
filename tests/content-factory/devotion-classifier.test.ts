/**
 * Devotion + consecration classifier tests (spec §13).
 */

import { describe, expect, it } from "vitest";
import {
  classifyDevotionPage,
  detectMultiDayConsecrationHints,
} from "@/lib/content-factory/normalize/devotion-classifier";

describe("classifyDevotionPage()", () => {
  it("accepts a devotion with a practice structure", () => {
    const r = classifyDevotionPage({
      title: "Divine Mercy Devotion",
      body: "Recite the Divine Mercy Chaplet daily at 3pm. Begin with the Our Father, then pray five decades on the Rosary beads.",
    });
    expect(r.approved).toBe(true);
    expect(r.detectedKind).toBe("devotion");
  });

  it("rejects a devotion article without a practice structure", () => {
    const r = classifyDevotionPage({
      title: "The History of the Sacred Heart Devotion",
      body:
        "The devotion has a long history beginning in the 17th century. " +
        "Many saints have written about it.",
    });
    expect(r.approved).toBe(false);
  });

  it("rejects a livestream / event-listing page", () => {
    const r = classifyDevotionPage({
      title: "Watch Live: Divine Mercy",
      body: "Click here to register for tonight's livestream prayer service.",
    });
    expect(r.approved).toBe(false);
    expect(r.reason).toMatch(/livestream/i);
  });

  it("rejects a retreat registration", () => {
    const r = classifyDevotionPage({
      title: "Marian Consecration Retreat",
      body: "Register for our weekend retreat to consecrate yourself to Mary.",
    });
    expect(r.approved).toBe(false);
  });

  it("accepts a 33-day consecration with day-by-day structure", () => {
    const r = classifyDevotionPage({
      title: "33-Day Consecration to Jesus through Mary",
      body:
        "Day 1: Begin with the Spirit of the World meditation. Day 2: Pray the Litany. " +
        "Day 3 of 33: meditate on knowledge of self. Day 33 is the consecration day.",
      kind: "consecration",
    });
    expect(r.approved).toBe(true);
    expect(r.detectedKind).toBe("consecration");
  });

  it("rejects a single-page consecration article without a day structure", () => {
    const r = classifyDevotionPage({
      title: "About Marian Consecration",
      body: "Marian consecration is the act of dedicating oneself to Jesus through Mary.",
      kind: "consecration",
    });
    expect(r.approved).toBe(false);
  });
});

describe("detectMultiDayConsecrationHints()", () => {
  it("collects one hint per day-numbered link", () => {
    const hints = detectMultiDayConsecrationHints({
      links: [
        { url: "https://example.org/day-1", text: "Day 1" },
        { url: "https://example.org/day-2", text: "Day 2" },
        { url: "https://example.org/day-3", text: "Day 3" },
        { url: "https://example.org/about", text: "About" },
      ],
    });
    expect(hints.map((h) => h.dayNumber)).toEqual([1, 2, 3]);
  });

  it("supports up to 99 days (for 33-day consecrations and longer)", () => {
    const hints = detectMultiDayConsecrationHints({
      links: Array.from({ length: 33 }, (_, i) => ({
        url: `https://example.org/day-${i + 1}`,
        text: `Day ${i + 1}`,
      })),
    });
    expect(hints).toHaveLength(33);
    expect(hints[32].dayNumber).toBe(33);
  });
});
