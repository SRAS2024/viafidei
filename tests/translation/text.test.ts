import { describe, expect, it } from "vitest";

import { maskSpans, unmaskSpans } from "@/lib/translation/mask";
import { romanize } from "@/lib/translation/romanize";
import {
  addsToSource,
  buildCaseStats,
  isTitleCase,
  limitLength,
  looksBroken,
  polishTranslation,
  prepareSource,
  sentenceCase,
  splitSentences,
} from "@/lib/translation/text";

const texts = (s: string) => splitSentences(s).map((x) => x.text);

describe("placeholders for protected spans", () => {
  it("masks every span, longest first, and puts them back", () => {
    const masked = maskSpans("Saint Bernard loved the Salve Regina; Saint Bernard sang it.", [
      "Salve Regina",
      "Saint Bernard",
    ]);
    expect(masked.text).toBe("X1 loved the X2; X1 sang it.");
    expect(unmaskSpans("X1 amaba la X2; X1 la cantaba.", masked)).toBe(
      "Saint Bernard amaba la Salve Regina; Saint Bernard la cantaba.",
    );
  });

  it("prefers the longer of two overlapping titles", () => {
    const masked = maskSpans("The Ave Maris Stella and the Ave Maria.", [
      "Ave Maria",
      "Ave Maris Stella",
    ]);
    expect(masked.text).toBe("The X1 and the X2.");
    expect(masked.slots).toEqual(["Ave Maris Stella", "Ave Maria"]);
  });

  it("matches whole words only", () => {
    expect(maskSpans("Credo quia absurdum; the credos differ.", ["Credo"]).text).toBe(
      "X1 quia absurdum; the credos differ.",
    );
  });

  it("rejects an output that lost, repeated or invented a placeholder", () => {
    const masked = maskSpans("Thérèse of Lisieux entered the Carmel.", ["Thérèse of Lisieux"]);
    expect(unmaskSpans("Teresa de Lisieux entró en el Carmelo.", masked)).toBeNull();
    expect(unmaskSpans("X1 entró, X1 entró.", masked)).toBeNull();
    expect(unmaskSpans("X1 y X2 entraron.", masked)).toBeNull();
    expect(unmaskSpans("X1 entró en el Carmelo.", masked)).toBe(
      "Thérèse of Lisieux entró en el Carmelo.",
    );
  });

  it("chooses another letter when the text already uses X1", () => {
    const masked = maskSpans("The X1 form cites the Te Deum.", ["Te Deum"]);
    expect(masked.prefix).toBe("Z");
    expect(masked.text).toBe("The X1 form cites the Z1.");
    expect(unmaskSpans("La forma X1 cita el Z1.", masked)).toBe("La forma X1 cita el Te Deum.");
  });

  it("leaves a text without spans untouched", () => {
    const masked = maskSpans("Pray daily.", []);
    expect(masked).toEqual({ text: "Pray daily.", slots: [], prefix: "X" });
    expect(unmaskSpans("Reza a diario.", masked)).toBe("Reza a diario.");
  });
});

describe("splitSentences", () => {
  it("splits ordinary sentences and keeps closing quotes", () => {
    expect(texts("He said, “Peace be with you.” Then he left. Was he afraid? No!")).toEqual([
      "He said, “Peace be with you.”",
      "Then he left.",
      "Was he afraid?",
      "No!",
    ]);
  });

  it("does not split after abbreviations, initials or Bible books", () => {
    expect(texts("St. Teresa of Ávila wrote it. See cf. Matt. 5:8 and Rom. 8:38.")).toEqual([
      "St. Teresa of Ávila wrote it.",
      "See cf. Matt. 5:8 and Rom. 8:38.",
    ]);
  });

  it("keeps the whitespace between sentences", () => {
    expect(splitSentences("One.  Two.")).toEqual([
      { text: "One.", after: "  " },
      { text: "Two.", after: "" },
    ]);
  });
});

describe("limitLength", () => {
  it("breaks very long sentences at a clause boundary, losing nothing", () => {
    const s = `${"a ".repeat(200)}; ${"b ".repeat(200)}`;
    const parts = limitLength(s, 480);
    expect(parts.length).toBeGreaterThanOrEqual(2);
    expect(parts.map((p) => p.text + p.after).join("")).toBe(s);
    for (const p of parts) expect(p.text.length).toBeLessThanOrEqual(480);
  });

  it("leaves short sentences alone", () => {
    expect(limitLength("Short.")).toEqual([{ text: "Short.", after: "" }]);
  });
});

describe("Title Case handling", () => {
  const stats = buildCaseStats(["We must bear our cross daily. The face of God shines."]);

  it("detects headings written in Title Case", () => {
    expect(isTitleCase("To Bear One’s Cross")).toBe(true);
    expect(isTitleCase("Check out our latest post")).toBe(false);
  });

  it("lower-cases common words but keeps proper nouns", () => {
    expect(sentenceCase("To Bear One’s Cross", stats)).toBe("To bear one’s cross");
    expect(sentenceCase("The Face of God", stats)).toBe("The face of God");
  });
});

describe("source preparation", () => {
  it("hyphenates written-out verse ranges", () => {
    expect(prepareSource("(cf. Luke 12:51 through 53) and John 21:15 to 17")).toBe(
      "(cf. Luke 12:51-53) and John 21:15-17",
    );
  });

  it("reads the Advocate as the Paraclete, nothing else", () => {
    expect(prepareSource("Christ promised the Advocate. We advocate for peace.")).toBe(
      "Christ promised the Paraclete. We advocate for peace.",
    );
  });
});

describe("polishTranslation", () => {
  it("uses each language's quotation marks", () => {
    expect(polishTranslation("He said “peace”.", 'Er sagte "Friede".', "de")).toBe(
      "Er sagte „Friede“.",
    );
    expect(polishTranslation("He said “peace”.", 'Disse "pace".', "it")).toBe("Disse «pace».");
  });

  it("follows the source's capitalization and missing final period", () => {
    expect(polishTranslation("To bear", "carregar a cruz", "pt")).toBe("Carregar a cruz");
    expect(polishTranslation("read more at", "Lea más en.", "es")).toBe("lea más en");
  });

  it("joins Chinese characters the model spaced apart", () => {
    expect(polishTranslation("Pray.", "祈 祷 。", "zh")).toBe("祈祷。");
  });
});

describe("looksBroken and addsToSource", () => {
  it("accepts repetition that is in the source", () => {
    const src =
      "Sin does not have the final word, death does not have the final word, and failure does not have the final word.";
    const out =
      "El pecado no tiene la última palabra, la muerte no tiene la última palabra y el fracaso no tiene la última palabra.";
    expect(looksBroken(src, out, "es")).toBe(false);
  });

  it("rejects empty, truncated and looping output", () => {
    expect(looksBroken("Hello there, my friend.", "", "es")).toBe(true);
    expect(
      looksBroken("This is a fairly long sentence about grace and mercy.", "Esto.", "es"),
    ).toBe(true);
    expect(
      looksBroken(
        "He went home.",
        "y se fue a casa y se fue a casa y se fue a casa y se fue a casa y se fue a casa",
        "es",
      ),
    ).toBe(true);
  });

  it("rejects Korean and Chinese output in the wrong script", () => {
    expect(looksBroken("Pray for us.", "Pray for us.", "ko")).toBe(true);
    expect(looksBroken("Pray for us.", "为我们祈祷。", "zh")).toBe(false);
  });

  it("rejects additions: an aside, a new Bible reference, Islamic wording", () => {
    expect(addsToSource("Peace be with you.", "La paz sea con ustedes (Juan 20).")).toBe(true);
    expect(addsToSource("As John 3:16 says.", "Como dice Juan 3:17.")).toBe(true);
    expect(addsToSource("God is love.", "Allah es amor.")).toBe(true);
    expect(addsToSource("The Qur'an names Allah.", "El Corán nombra a Allah.")).toBe(false);
    expect(addsToSource("As John 3:16 says.", "Como dice Juan 3:16.")).toBe(false);
  });
});

describe("romanize (the fallback while a name waits for the translator)", () => {
  it.each([
    ["명동대성당", "KR", "Myeongdong Daeseongdang"],
    ["Церква Святого Миколая", "UA", "Tserkva Sviatoho Mykolaia"],
    ["Храм Святого Николая", "RU", "Khram Svyatogo Nikolaya"],
    ["Καθολική εκκλησία Αγίου Ιωάννου", "GR", "Katholiki ekklisia Agiou Ioannou"],
  ])("%s (%s) → %s", (name, cc, out) => {
    expect(romanize(name, { countryCode: cc })).toBe(out);
  });

  it("gives up rather than guess (Han, kanji, Arabic)", () => {
    expect(romanize("北京圣母无染原罪主教座堂")).toBeNull();
    expect(romanize("東京カテドラル聖マリア大聖堂")).toBeNull();
    expect(romanize("كنيسة مار الياس")).toBeNull();
    expect(romanize("")).toBeNull();
  });
});
