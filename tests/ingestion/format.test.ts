import { describe, expect, it } from "vitest";
import { formatIngestedItem, formatIngestedItems } from "@/lib/ingestion/format";
import type { IngestedItem, IngestedPrayer, IngestedSaint } from "@/lib/ingestion/types";

describe("formatIngestedItem prayer", () => {
  it("decodes HTML entities in body and title", () => {
    const item: IngestedPrayer = {
      kind: "prayer",
      slug: "hail-mary",
      defaultTitle: "Hail&nbsp;Mary",
      category: "Marian",
      body: "Hail Mary, full of grace, the Lord is with thee.&nbsp;Amen.",
    };
    const out = formatIngestedItem(item) as IngestedPrayer;
    expect(out.defaultTitle).toBe("Hail Mary");
    expect(out.body).toContain("Hail Mary, full of grace");
  });

  it("collapses multiple blank lines in body but preserves paragraph breaks", () => {
    const item: IngestedPrayer = {
      kind: "prayer",
      slug: "test",
      defaultTitle: "Test",
      category: "Marian",
      body: "Line one.\n\n\n\nLine two.\n\n\nLine three.",
    };
    const out = formatIngestedItem(item) as IngestedPrayer;
    expect(out.body).toBe("Line one.\n\nLine two.\n\nLine three.");
  });

  it("folds smart quotes to ASCII", () => {
    const item: IngestedPrayer = {
      kind: "prayer",
      slug: "test",
      defaultTitle: "“Test”",
      category: "Marian",
      body: "He said, “Pray now”—and so we did. Amen.",
    };
    const out = formatIngestedItem(item) as IngestedPrayer;
    expect(out.defaultTitle).toBe('"Test"');
    expect(out.body).toContain('"Pray now"');
    expect(out.body).toContain("-");
  });
});

describe("formatIngestedItem saint", () => {
  it("normalises whitespace in canonical name + biography", () => {
    const item: IngestedSaint = {
      kind: "saint",
      slug: "francis",
      canonicalName: "  Saint   Francis  of Assisi  ",
      biography: "  Francis was born in 1181.\n\n\n\n  He died in 1226. ",
      patronages: ["animals"],
    };
    const out = formatIngestedItem(item) as IngestedSaint;
    expect(out.canonicalName).toBe("Saint Francis of Assisi");
    expect(out.biography).toBe("Francis was born in 1181.\n\nHe died in 1226.");
  });
});

describe("formatIngestedItems", () => {
  it("formats every item in a batch", () => {
    const items: IngestedItem[] = [
      {
        kind: "prayer",
        slug: "p",
        defaultTitle: "  Title  ",
        category: "Marian",
        body: "Hail Mary. Amen.",
      },
      {
        kind: "saint",
        slug: "s",
        canonicalName: "  Saint  X  ",
        biography: "He was a saint born in 1500.",
        patronages: [],
      },
    ];
    const out = formatIngestedItems(items);
    expect(out[0].kind).toBe("prayer");
    expect(out[1].kind).toBe("saint");
    if (out[0].kind === "prayer") expect(out[0].defaultTitle).toBe("Title");
    if (out[1].kind === "saint") expect(out[1].canonicalName).toBe("Saint X");
  });
});
