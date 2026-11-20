import { describe, expect, it } from "vitest";

import { wholeWordExcerpt } from "@/lib/content-shared/excerpt";

const BACKGROUND =
  "The First Saturdays Devotion, also called the Communion of Reparation to the Immaculate Heart of Mary, is a Catholic devotion which, according to Lúcia dos Santos, was requested by the Virgin Mary during the apparitions of Our Lady of Fátima in Fátima, Portugal, on 13 May 1917, as well as during apparitions in Pontevedra.";

describe("wholeWordExcerpt (a card's description)", () => {
  it("ends a summary the import cut mid-word on its last whole word, marked as cut", () => {
    const cut = BACKGROUND.slice(0, 280);
    expect(cut.endsWith("1917, a")).toBe(true);
    const excerpt = wholeWordExcerpt(cut, { background: BACKGROUND });
    expect(excerpt.endsWith("on 13 May 1917…")).toBe(true);
    expect(BACKGROUND.startsWith(excerpt.slice(0, -1))).toBe(true);
  });

  it("marks a cut that fell between words, without the dangling comma", () => {
    const cut = BACKGROUND.slice(0, BACKGROUND.indexOf(" as well"));
    expect(wholeWordExcerpt(cut, { practiceInstructions: BACKGROUND })).toBe(
      `${cut.slice(0, -1)}…`,
    );
  });

  it("leaves a cut that ends a sentence as it is", () => {
    const text = "A first sentence. A second sentence follows it.";
    expect(wholeWordExcerpt("A first sentence.", { background: text })).toBe("A first sentence.");
  });

  it("shows a summary of the record's own words as written", () => {
    // Not the opening of a longer field: nothing says it was cut.
    expect(
      wholeWordExcerpt("A bead devotion honouring Saint Joseph", { background: BACKGROUND }),
    ).toBe("A bead devotion honouring Saint Joseph");
    expect(wholeWordExcerpt("Short and whole", null)).toBe("Short and whole");
    expect(wholeWordExcerpt("Already marked…", { background: "Already marked… and more" })).toBe(
      "Already marked…",
    );
    // The whole text is the summary: nothing was cut.
    expect(wholeWordExcerpt(BACKGROUND, { background: BACKGROUND })).toBe(BACKGROUND);
  });

  it("reads the opening across the source's line breaks", () => {
    const source = "Line one of the devotion\nand line two goes on for a while.";
    expect(wholeWordExcerpt("Line one of the devotion and li", { background: source })).toBe(
      "Line one of the devotion and…",
    );
  });
});

describe("wholeWordExcerpt in Chinese and on odd data", () => {
  it("ends a Chinese cut at its sentence end, with no stray ellipsis", () => {
    const background = "他们向三位牧童显现，请求念玫瑰经。后来又在庞特维德拉显现。";
    expect(wholeWordExcerpt("他们向三位牧童显现，请求念玫瑰经。", { background })).toBe(
      "他们向三位牧童显现，请求念玫瑰经。",
    );
  });

  it("does not take a Chinese character after the cut for a broken word", () => {
    const background = "他们向三位牧童显现，请求念玫瑰经。后来又在庞特维德拉显现。";
    expect(wholeWordExcerpt("他们向三位牧童显现，请求念", { background })).toBe(
      "他们向三位牧童显现，请求念…",
    );
    expect(wholeWordExcerpt("他们向三位牧童显现，", { background })).toBe("他们向三位牧童显现…");
  });

  it("returns a summary that is not text as it is, never throwing", () => {
    expect(wholeWordExcerpt(42 as unknown as string, { background: "x" })).toBe(42);
    expect(wholeWordExcerpt(["a"] as unknown as string, { background: "x" })).toEqual(["a"]);
  });
});
