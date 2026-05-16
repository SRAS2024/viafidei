import { describe, expect, it } from "vitest";
import { enrichDecision } from "@/lib/ingestion/enrich-decision";
import type { IngestedPrayer, IngestedSaint } from "@/lib/ingestion/types";

const tier1Prayer: IngestedPrayer = {
  kind: "prayer",
  slug: "our-father",
  defaultTitle: "Our Father",
  category: "traditional",
  body: "Our Father, who art in heaven, hallowed be thy name. Thy kingdom come, thy will be done on earth as it is in heaven. Give us this day our daily bread. Amen.",
  externalSourceKey: "vatican.va:/prayers/our-father",
};

const tier3Prayer: IngestedPrayer = {
  ...tier1Prayer,
  externalSourceKey: "some-random-blog.net:/prayers/our-father",
};

describe("enrichDecision", () => {
  it("returns publish + tier 1 for Vatican prayer", () => {
    const d = enrichDecision(tier1Prayer);
    expect(d.action).toBe("publish");
    expect(d.status).toBe("PUBLISHED");
    expect(d.sourceTier).toBe(1);
    expect(d.sourceConfidence).toBeGreaterThan(0.5);
    expect(d.qualityScore).toBeGreaterThan(0.5);
    expect(d.outcomeReason).toMatch(/Tier 1/);
  });

  it("returns review for Tier 3 prayer at normal confidence", () => {
    const d = enrichDecision(tier3Prayer);
    expect(d.action).toBe("review");
    expect(d.status).toBe("REVIEW");
    expect(d.sourceTier).toBe(3);
    expect(d.outcomeReason).toMatch(/Tier 3/);
  });

  it("flags saints with theologicalReviewFlag", () => {
    const saint: IngestedSaint = {
      kind: "saint",
      slug: "saint-augustine",
      canonicalName: "Saint Augustine of Hippo",
      feastDay: "August 28",
      feastMonth: 8,
      feastDayOfMonth: 28,
      patronages: ["theologians"],
      biography:
        "Saint Augustine of Hippo was a Christian theologian and philosopher of Berber origin who served as bishop of Hippo Regius and is one of the most important Church Fathers in Western Christianity.",
      externalSourceKey: "vatican.va:/saints/augustine",
    };
    const d = enrichDecision(saint);
    expect(d.theologicalReviewFlag).toBe(true);
    expect(d.status).toBe("REVIEW");
    expect(d.outcomeReason).toMatch(/theological/i);
  });

  it("rejects an item with too-short body", () => {
    const bad = { ...tier1Prayer, body: "Short." };
    const d = enrichDecision(bad);
    expect(d.action).toBe("reject");
    expect(d.qualityScore).toBe(0);
  });

  it("populates formattingConfidence between 0 and 1", () => {
    const d = enrichDecision(tier1Prayer);
    expect(d.formattingConfidence).toBeGreaterThan(0);
    expect(d.formattingConfidence).toBeLessThanOrEqual(1);
  });
});
