/**
 * ConfusionDetector (spec §8). Verifies that easily-confused pages
 * are caught even when the URL/title classifier would have picked
 * the wrong type.
 */

import { describe, expect, it } from "vitest";

import { CONFUSION_RULE_NAMES, detectConfusion } from "@/lib/admin-worker/confusion-detector";

describe("detectConfusion — confusion patterns (spec §8)", () => {
  it("flags saint-named schools", () => {
    const r = detectConfusion({
      url: "https://example.org/saint-marys-school/about",
      title: "Saint Mary's Academy — A Catholic K-12 School",
      bodyText: "Welcome to Saint Mary's School. Enrollment is open for Fall.",
      proposedContentType: "SAINT",
    });
    expect(r.confused).toBe(true);
    expect(r.rules).toContain("saint-named-school");
    expect(r.explanation.toLowerCase()).toContain("school");
  });

  it("flags saint-named hospitals", () => {
    const r = detectConfusion({
      url: "https://example.org/saint-josephs-hospital",
      title: "Saint Joseph's Hospital — Patient Services",
      bodyText: "Our hospital provides excellent care.",
      proposedContentType: "SAINT",
    });
    expect(r.confused).toBe(true);
    expect(r.rules).toContain("saint-named-hospital");
  });

  it("flags prayer livestreams", () => {
    const r = detectConfusion({
      url: "https://example.org/livestream/daily-prayer",
      title: "Daily Prayer Livestream",
      bodyText: "Watch the daily prayer livestream every morning at 8 AM.",
      proposedContentType: "PRAYER",
    });
    expect(r.confused).toBe(true);
    expect(r.rules).toContain("prayer-livestream");
  });

  it("flags novena articles that don't include the actual day prayers", () => {
    const r = detectConfusion({
      url: "https://example.org/novena-to-st-jude",
      title: "Novena to Saint Jude",
      bodyText:
        "This is the history of the Novena to Saint Jude. Many people pray it. It is very popular.",
      proposedContentType: "NOVENA",
    });
    expect(r.confused).toBe(true);
    expect(r.rules).toContain("novena-article-no-days");
  });

  it("does NOT flag a novena page that contains day 1 / day 9 markers", () => {
    const r = detectConfusion({
      url: "https://example.org/novena-to-st-jude",
      title: "Novena to Saint Jude",
      bodyText:
        "Day 1 — O most holy apostle. Day 2 — Saint Jude. Day 3 — Pray for me. Day 9 — Amen.",
      proposedContentType: "NOVENA",
    });
    expect(r.confused).toBe(false);
  });

  it("flags devotion articles without practice instructions", () => {
    const r = detectConfusion({
      url: "https://example.org/devotion-to-sacred-heart",
      title: "Devotion to the Sacred Heart",
      bodyText: "This devotion has a long history rooted in the visions of Saint Margaret Mary.",
      proposedContentType: "DEVOTION",
    });
    expect(r.confused).toBe(true);
    expect(r.rules).toContain("devotion-no-instructions");
  });

  it("flags Mass schedule pages mistaken for liturgy formation", () => {
    const r = detectConfusion({
      url: "https://example.org/mass-schedule",
      title: "Mass Schedule",
      bodyText: "Monday: 8 AM. Tuesday: 8 AM. Wednesday: 8 AM.",
      proposedContentType: "LITURGICAL",
    });
    expect(r.confused).toBe(true);
    expect(r.rules).toContain("liturgy-schedule");
  });

  it("flags Church news mistaken for history", () => {
    const r = detectConfusion({
      url: "https://example.org/news/2024/01/pope-meets-leaders",
      title: "Pope meets world leaders",
      bodyText: "Today the Pope met with world leaders.",
      proposedContentType: "CHURCH_DOCUMENT",
    });
    expect(r.confused).toBe(true);
    expect(r.rules).toContain("history-is-news");
  });

  it("flags parish bulletins mistaken for parish records", () => {
    const r = detectConfusion({
      url: "https://example.org/parish/bulletin-2024-01",
      title: "Parish Bulletin",
      bodyText: "Welcome to this week's bulletin.",
      proposedContentType: "PARISH",
    });
    expect(r.confused).toBe(true);
    expect(r.rules).toContain("parish-bulletin");
  });

  it("returns a non-empty rule list available for the audit view", () => {
    expect(CONFUSION_RULE_NAMES.length).toBeGreaterThan(0);
    expect(CONFUSION_RULE_NAMES).toContain("saint-named-school");
    expect(CONFUSION_RULE_NAMES).toContain("prayer-livestream");
  });

  it("emits a penalty proportional to the confidence to subtract", () => {
    const r = detectConfusion({
      url: "https://example.org/saint-marys-school",
      title: "Saint Mary's Academy",
      bodyText: "School information.",
      proposedContentType: "SAINT",
    });
    expect(r.penalty).toBeGreaterThan(0);
    expect(r.penalty).toBeLessThanOrEqual(1);
  });
});
