import { describe, expect, it } from "vitest";

import {
  assembleItem,
  looksUntranslatable,
  planItem,
  unitHash,
  type PlannableItem,
} from "@/lib/translation/segments";

const sources = (item: PlannableItem, depth: "full" | "card" = "full") =>
  planItem(item, depth).units.map((u) => u.source);

describe("planItem", () => {
  it("translates an English prayer line by line and keeps its Latin and Greek", () => {
    const item: PlannableItem = {
      contentType: "PRAYER",
      slug: "hail-mary",
      title: "Hail Mary",
      payload: {
        summary: "The angelic salutation.",
        body: "Hail Mary, full of grace,\nthe Lord is with thee.",
        latin: "Ave Maria, gratia plena, Dominus tecum.",
        greek: "Θεοτόκε Παρθένε, χαῖρε",
        language: "en",
        citations: ["https://www.vatican.va/archive/ENG0015/__P1.HTM"],
      },
    };
    expect(sources(item)).toEqual([
      "Hail Mary",
      "The angelic salutation.",
      "Hail Mary, full of grace,",
      "the Lord is with thee.",
    ]);
  });

  it("never plans a Latin, Greek or non-English prayer text, nor a Latin title", () => {
    expect(
      sources({
        contentType: "PRAYER",
        title: "Salve Regina",
        payload: {
          body: "Salve, Regina, mater misericordiae, vita, dulcedo, et spes nostra, salve.",
        },
      }),
    ).toEqual([]);
    expect(
      sources({
        contentType: "PRAYER",
        title: "Ave Maria",
        payload: { body: "Hail Mary", language: "la" },
      }),
    ).toEqual([]);
    expect(
      sources({ contentType: "PRAYER", title: "Trisagion", payload: { body: "Ἅγιος ὁ Θεός" } }),
    ).toEqual([]);
  });

  it("keeps Latin lines inside an English text as written", () => {
    const plan = planItem({
      contentType: "GUIDE",
      title: "How to Pray Compline",
      payload: {
        intro:
          "Begin with the sign of the cross.\nDeus, in adiutorium meum intende.\nThen examine your day.",
      },
    });
    expect(plan.units.map((u) => u.source)).toEqual([
      "How to Pray Compline",
      "Begin with the sign of the cross.",
      "Then examine your day.",
    ]);
  });

  it("protects the item's own Latin name and a saint's own name in its prose (rule c)", () => {
    const doc = planItem({
      contentType: "CHURCH_DOCUMENT",
      title: "Fratelli Tutti",
      payload: { summary: "In Fratelli Tutti the Pope speaks of fraternity." },
    });
    expect(doc.units).toEqual([
      expect.objectContaining({
        source: "In Fratelli Tutti the Pope speaks of fraternity.",
        protect: ["Fratelli Tutti"],
      }),
    ]);
    const saint = planItem({
      contentType: "SAINT",
      title: "Thérèse of Lisieux",
      payload: { biography: "Thérèse of Lisieux entered the Carmel at fifteen." },
    });
    expect(saint.units).toEqual([
      expect.objectContaining({ kind: "text", protect: ["Thérèse of Lisieux"] }),
    ]);
  });

  it("never plans a person's name as a unit, and lets a pope's name reach the model", () => {
    const pope = planItem({
      contentType: "POPE",
      title: "Leo XIII",
      subtitle: "Pope from 1878 to 1903",
      payload: { summary: "Leo XIII wrote Rerum Novarum." },
    });
    expect(pope.units.map((u) => u.source)).toEqual([
      "Pope from 1878 to 1903",
      "Leo XIII wrote Rerum Novarum.",
    ]);
    expect(pope.units[1]!.protect).toEqual(["Rerum Novarum"]);
  });

  it("plans nothing for a parish (names follow rule b, elsewhere)", () => {
    expect(
      planItem({ contentType: "PARISH", title: "St. Mary's", payload: { summary: "A church." } }),
    ).toEqual({
      fields: [],
      units: [],
    });
  });

  it("walks structured payloads and leaves identifiers, URLs and quotations alone", () => {
    const plan = planItem({
      contentType: "NOVENA",
      title: "Novena to the Holy Spirit",
      payload: {
        days: [
          {
            title: "Day One",
            prayer: "Come, Holy Spirit, fill our hearts.",
            scripture: "John 14:26",
          },
          { title: "Day Two", reflection: "Read more at https://www.vatican.va/ today." },
        ],
        relatedSaintSlugs: ["saint-joseph"],
        officialPrayer: "Come, Holy Spirit.",
      },
    });
    expect(plan.units.map((u) => u.source)).toEqual([
      "Novena to the Holy Spirit",
      "Day One",
      "Come, Holy Spirit, fill our hearts.",
      "Day Two",
      "Read more at",
      "today.",
    ]);
    const reflection = plan.fields.find((f) => f.path.join(".") === "payload.days.1.reflection")!;
    expect(reflection.lines[0]!.pieces).toContainEqual({ keep: "https://www.vatican.va/" });
  });

  it("plans only what a card shows at card depth", () => {
    expect(
      sources(
        {
          contentType: "DEVOTION",
          title: "The Miraculous Medal",
          subtitle: "A Marian sacramental",
          payload: { summary: "A medal of Our Lady.", background: "It began in Paris in 1830." },
        },
        "card",
      ),
    ).toEqual(["The Miraculous Medal", "A Marian sacramental", "A medal of Our Lady."]);
  });

  it("treats bare URLs, numbers and footnote markers as untranslatable", () => {
    for (const t of ["https://example.org/x", "1873–1897", "[1] [2]", "vatican.va"]) {
      expect(looksUntranslatable(t), t).toBe(true);
    }
    expect(looksUntranslatable("Pray daily.")).toBe(false);
  });
});

describe("unitHash", () => {
  const unit = { kind: "text" as const, source: "Pray daily.", sourceLang: "en", protect: [] };
  it("is stable, and differs by language, kind and protected spans", () => {
    expect(unitHash("es", unit)).toBe(unitHash("es", { ...unit }));
    expect(unitHash("es", unit)).not.toBe(unitHash("fr", unit));
    expect(unitHash("es", unit)).not.toBe(unitHash("es", { ...unit, kind: "title" }));
    expect(unitHash("es", unit)).not.toBe(unitHash("es", { ...unit, protect: ["daily"] }));
    expect(unitHash("es", { ...unit, protect: ["a", "b"] })).toBe(
      unitHash("es", { ...unit, protect: ["b", "a"] }),
    );
    expect(unitHash("es", unit)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("assembleItem", () => {
  const item: PlannableItem = {
    contentType: "DEVOTION",
    title: "The Holy Hour",
    payload: {
      summary: "Watch one hour. Pray with Christ.\nKeep silence.",
      steps: ["Kneel before the tabernacle."],
      devotionType: "eucharistic",
    },
  };

  it("replaces a line only when every sentence in it is translated", () => {
    const plan = planItem(item);
    const index = (s: string) => plan.units.findIndex((u) => u.source === s);
    const partial = new Map([
      [index("Watch one hour."), "Velad una hora."],
      [index("Keep silence."), "Guardad silencio."],
    ]);
    const out = assembleItem(item, plan, partial);
    expect(out.payload.summary).toBe("Watch one hour. Pray with Christ.\nGuardad silencio.");
    expect(out.translated).toBe(2);
    expect(out.missing).toBe(3);

    const full = new Map(partial);
    full.set(index("Pray with Christ."), "Orad con Cristo.");
    full.set(index("The Holy Hour"), "La Hora Santa");
    full.set(index("Kneel before the tabernacle."), "Arrodíllate ante el sagrario.");
    const done = assembleItem(item, plan, full);
    expect(done.title).toBe("La Hora Santa");
    expect(done.payload).toEqual({
      summary: "Velad una hora. Orad con Cristo.\nGuardad silencio.",
      steps: ["Arrodíllate ante el sagrario."],
      devotionType: "eucharistic",
    });
    expect(done.missing).toBe(0);
  });

  it("copies only what it translates", () => {
    const citations = ["https://www.vatican.va/"];
    const withRefs: PlannableItem = { ...item, payload: { ...item.payload, citations } };
    const plan = planItem(withRefs);
    const out = assembleItem(withRefs, plan, new Map(plan.units.map((_, i) => [i, "x"])));
    expect(out.payload).not.toBe(withRefs.payload);
    expect(out.payload.steps).not.toBe(withRefs.payload!.steps);
    expect(out.payload.citations).toBe(citations);
    expect(withRefs.payload!.steps).toEqual(["Kneel before the tabernacle."]);
  });

  it("never mutates the item", () => {
    const before = structuredClone(item);
    const plan = planItem(item);
    assembleItem(item, plan, new Map(plan.units.map((_, i) => [i, "x"])));
    expect(item).toEqual(before);
  });
});
