import { describe, expect, it } from "vitest";
import { cleanIngestedItem } from "@/lib/ingestion/clean";
import type { IngestedPrayer, IngestedSaint } from "@/lib/ingestion/types";

describe("cleanIngestedItem", () => {
  it("strips share-this / subscribe / cookie lines from prayer body", () => {
    const item: IngestedPrayer = {
      kind: "prayer",
      slug: "hail-mary",
      defaultTitle: "Hail Mary",
      category: "Marian",
      body: [
        "We use cookies to give you the best experience.",
        "Subscribe to our newsletter for daily prayers.",
        "Hail Mary, full of grace, the Lord is with thee.",
        "Blessed art thou amongst women, and blessed is the fruit of thy womb, Jesus.",
        "Share this prayer",
        "Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.",
        "Continue reading",
      ].join("\n\n"),
    };
    const out = cleanIngestedItem(item) as IngestedPrayer;
    expect(out.body).toContain("Hail Mary, full of grace");
    expect(out.body).toContain("Amen");
    expect(out.body).not.toContain("cookies");
    expect(out.body).not.toContain("Subscribe");
    expect(out.body).not.toContain("Share this");
    expect(out.body).not.toContain("Continue reading");
  });

  it("strips brand suffixes from inline titles", () => {
    const item: IngestedPrayer = {
      kind: "prayer",
      slug: "memorare",
      defaultTitle: "Memorare | USCCB",
      category: "Marian",
      body: "Remember, O most gracious Virgin Mary, that never was it known...Amen.",
    };
    const out = cleanIngestedItem(item) as IngestedPrayer;
    expect(out.defaultTitle).toBe("Memorare");
  });

  it("drops source-summary paragraphs from saint biography", () => {
    const item: IngestedSaint = {
      kind: "saint",
      slug: "francis-of-assisi",
      canonicalName: "Saint Francis of Assisi",
      patronages: [],
      biography: [
        "EWTN is the global Catholic Network.",
        "Saint Francis was born in 1181 in Assisi, Italy.",
        "He founded the Franciscan order in 1209 after a profound conversion.",
        "He died in 1226 and was canonized two years later.",
      ].join("\n\n"),
    };
    const out = cleanIngestedItem(item) as IngestedSaint;
    expect(out.biography).toContain("Saint Francis was born in 1181");
    expect(out.biography).toContain("died in 1226");
    expect(out.biography).not.toContain("EWTN is the global");
  });

  it("preserves an item that has no boilerplate", () => {
    const item: IngestedPrayer = {
      kind: "prayer",
      slug: "glory-be",
      defaultTitle: "Glory Be",
      category: "Trinitarian",
      body: "Glory be to the Father, and to the Son, and to the Holy Spirit, as it was in the beginning, is now, and ever shall be, world without end. Amen.",
    };
    const out = cleanIngestedItem(item) as IngestedPrayer;
    expect(out.body).toBe(item.body);
  });
});
