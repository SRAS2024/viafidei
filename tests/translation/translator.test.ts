import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EngineResult, TranslationEngine } from "@/lib/translation/engine/engine";
import type { LanguagePair } from "@/lib/translation/engine/models";
import type { Db, PendingRow, TranslationResult } from "@/lib/translation/store";

const store = vi.hoisted(() => ({
  claimPending: vi.fn(),
  existingHashes: vi.fn(),
  storeResults: vi.fn(),
  releaseClaims: vi.fn(),
}));
vi.mock("@/lib/translation/store", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...store,
}));

const {
  acceptName,
  acceptTranslation,
  contentUnits,
  nameUnits,
  prepareUnit,
  resetTranslatorState,
  runDemand,
  runPretranslation,
  translateUnits,
} = await import("@/lib/translation/translator");
const { planItem, unitHash } = await import("@/lib/translation/segments");

/* ------------------------------------------------------------------ */
/*  A stub engine: a dictionary per pair, recording every call        */
/* ------------------------------------------------------------------ */

type Calls = Array<{ pair: LanguagePair; texts: string[] }>;

function stubEngine(
  tables: Partial<Record<LanguagePair, (text: string) => string>>,
  calls: Calls = [],
): TranslationEngine & { calls: Calls } {
  return {
    calls,
    supports: (pair) => pair in tables,
    async translate(pair, texts, call = {}): Promise<EngineResult> {
      calls.push({ pair, texts: [...texts] });
      const table = tables[pair];
      if (!table) throw new Error(`No translation model could be loaded for ${pair}`);
      const outputs = texts.map((t, i) => {
        const out = table(t);
        return (call.accept ?? (() => true))(i, out) ? out : null;
      });
      return {
        outputs,
        models: outputs.map((o) => (o === null ? null : `stub/${pair}@000000000000`)),
      };
    },
    async release() {},
  };
}

/** Pretend-Spanish that copies placeholders the way OPUS-MT does. */
const spanish: Record<string, string> = {
  "X1 entered the Carmel at fifteen.": "X1 entró en el Carmelo a los quince años.",
  "The X1 is sung after Compline.": "La X1 se canta después de Completas.",
  "Pray daily.": "Reza a diario.",
  "To bear one's cross": "Llevar la propia cruz",
  "Saint Joseph Church": "Iglesia de San José",
  "Myeongdong Cathedral": "Catedral de Myeongdong",
  // The model "translated" the protected name instead of copying X1.
  "X1 knows this one.": "Nadie sabe esto.",
};
const es = (t: string) => spanish[t] ?? `?${t}`;

const db = {} as Db;

beforeEach(() => {
  vi.clearAllMocks();
  resetTranslatorState();
  store.storeResults.mockResolvedValue(undefined);
  store.releaseClaims.mockResolvedValue(undefined);
  store.existingHashes.mockResolvedValue(new Set());
  store.claimPending.mockResolvedValue([]);
});

describe("preparing a unit for the model", () => {
  it("masks protected spans and reads a Title Case heading as a phrase", () => {
    expect(
      prepareUnit({
        kind: "text",
        source: "Thérèse of Lisieux entered the Carmel at fifteen.",
        sourceLang: "en",
        protect: ["Thérèse of Lisieux"],
      }).text,
    ).toBe("X1 entered the Carmel at fifteen.");
    expect(
      prepareUnit({ kind: "title", source: "To Bear One's Cross", sourceLang: "en", protect: [] })
        .text,
    ).toBe("To bear one's cross");
    // A protected span keeps its capitals while the rest is sentence-cased.
    expect(
      prepareUnit({
        kind: "title",
        source: "Novena to Saint Thérèse of Lisieux",
        sourceLang: "en",
        protect: ["Saint Thérèse of Lisieux"],
      }).text,
    ).toBe("Novena to X1");
  });

  it("accepts a translation only with every placeholder back and nothing broken", () => {
    const masked = prepareUnit({
      kind: "text",
      source: "The Salve Regina is sung after Compline.",
      sourceLang: "en",
      protect: ["Salve Regina"],
    });
    expect(acceptTranslation(masked, "La X1 se canta después de Completas.", "es")).toBe(
      "La Salve Regina se canta después de Completas.",
    );
    expect(
      acceptTranslation(masked, "La Salve Reina se canta después de Completas.", "es"),
    ).toBeNull();
    expect(acceptTranslation(masked, "", "es")).toBeNull();
  });

  it("accepts a name only when it changed and is in the reader's script", () => {
    expect(acceptName("명동대성당", "Myeongdong Cathedral", "en")).toBe(true);
    expect(acceptName("명동대성당", "명동대성당", "en")).toBe(false);
    expect(acceptName("명동대성당", "大教堂", "en")).toBe(false);
    expect(acceptName("Myeongdong Cathedral", "明洞大教堂", "zh")).toBe(true);
  });
});

describe("translateUnits", () => {
  it("translates content with the spans restored, and keeps the English when a span is lost", async () => {
    const engine = stubEngine({ "en>es": es });
    const out = await translateUnits({ db, engine }, "es", [
      {
        kind: "text",
        source: "Thérèse of Lisieux entered the Carmel at fifteen.",
        sourceLang: "en",
        protect: ["Thérèse of Lisieux"],
      },
      {
        kind: "text",
        source: "The Salve Regina is sung after Compline.",
        sourceLang: "en",
        protect: ["Salve Regina"],
      },
      { kind: "text", source: "Pray daily.", sourceLang: "en", protect: [] },
      { kind: "text", source: "Nobody knows this one.", sourceLang: "en", protect: ["Nobody"] },
    ]);
    expect(out.map((o) => o.text)).toEqual([
      "Thérèse of Lisieux entró en el Carmelo a los quince años.",
      "La Salve Regina se canta después de Completas.",
      "Reza a diario.",
      null,
    ]);
    expect(out[0]!.model).toBe("stub/en>es@000000000000");
    expect(out[3]!.model).toBe("none");
    expect(engine.calls[0]!.texts).toContain("X1 entered the Carmel at fifteen.");
  });

  it("translates a parish name into English, then into the reader's language", async () => {
    const engine = stubEngine({
      "ko>en": (t) => (t === "명동대성당" ? "Myeongdong Cathedral" : "?"),
      "en>es": es,
    });
    const unit = { kind: "name" as const, source: "명동대성당", sourceLang: "ko", protect: [] };
    const [en] = await translateUnits({ db, engine }, "en", [unit]);
    expect(en).toEqual({ text: "Myeongdong Cathedral", model: "stub/ko>en@000000000000" });
    const [toEs] = await translateUnits({ db, engine }, "es", [unit]);
    expect(toEs).toEqual({
      text: "Catedral de Myeongdong",
      model: "stub/ko>en@000000000000 + stub/en>es@000000000000",
    });
    // The English pivot is made once per name, not once per reader language.
    expect(engine.calls.filter((c) => c.pair === "ko>en")).toHaveLength(1);
    const [dotted] = await translateUnits(
      { db, engine: stubEngine({ "zh>en": () => "St. Joseph's Hall." }) },
      "en",
      [{ kind: "name", source: "圣若瑟堂", sourceLang: "zh", protect: [] }],
    );
    expect(dotted!.text).toBe("St. Joseph's Hall");
    const [english] = await translateUnits({ db, engine }, "es", [
      { kind: "name", source: "Saint Joseph Church", sourceLang: "en", protect: [] },
    ]);
    expect(english!.text).toBe("Iglesia de San José");
  });

  it("returns nulls, never throws, for a language or name source it has no model for", async () => {
    const engine = stubEngine({});
    expect(
      await translateUnits({ db, engine }, "la", [
        { kind: "text", source: "Pray.", sourceLang: "en", protect: [] },
      ]),
    ).toEqual([{ text: null, model: "none" }]);
    expect(
      await translateUnits({ db, engine }, "es", [
        { kind: "name", source: "כנסייה", sourceLang: "mul", protect: [] },
      ]),
    ).toEqual([{ text: null, model: "none" }]);
  });
});

describe("runDemand", () => {
  const row = (over: Partial<PendingRow> = {}): PendingRow => ({
    id: "r1",
    lang: "es",
    sourceHash: "h1",
    kind: "text",
    sourceLang: "en",
    source: "Pray daily.",
    protect: [],
    attempts: 0,
    ...over,
  });

  it("claims visitor demand, translates it and stores the results", async () => {
    store.claimPending.mockResolvedValueOnce([
      row(),
      row({ id: "r2", sourceHash: "h2", source: "Unknown words." }),
    ]);
    const n = await runDemand({ db, engine: stubEngine({ "en>es": es }), claimant: "test" });
    expect(n).toBe(2);
    expect(store.claimPending).toHaveBeenCalledWith(db, { claimant: "test", limit: 64 });
    const stored = store.storeResults.mock.calls[0]![1] as TranslationResult[];
    expect(stored.map((r) => [r.hash, r.text])).toEqual([
      ["h1", "Reza a diario."],
      ["h2", "?Unknown words."],
    ]);
  });

  it("releases the claim when the model cannot run, so the rows are retried later", async () => {
    store.claimPending.mockResolvedValueOnce([row()]);
    const engine = stubEngine({});
    engine.supports = () => true; // the pair is configured, but the model fails to load
    expect(await runDemand({ db, engine })).toBe(1);
    expect(store.storeResults).not.toHaveBeenCalled();
    expect(store.releaseClaims).toHaveBeenCalledWith(db, ["r1"]);
  });

  it("does nothing without demand", async () => {
    expect(await runDemand({ db, engine: stubEngine({}) })).toBe(0);
  });
});

describe("runPretranslation", () => {
  const items = [
    {
      contentType: "DEVOTION",
      slug: "holy-hour",
      title: "Holy Hour",
      subtitle: null,
      payload: { summary: "Pray daily." },
    },
    {
      contentType: "SAINT",
      slug: "therese-of-lisieux",
      title: "Thérèse of Lisieux",
      subtitle: null,
      payload: { biography: "Thérèse of Lisieux entered the Carmel at fifteen." },
    },
  ];
  const parishNames = [
    { title: "명동대성당", countryCode: "KR" },
    { title: "Parroquia San José", countryCode: "ES" },
  ];
  const fakeDb = {
    $queryRaw: vi.fn(async (sql: { sql?: string; strings?: string[] }) => {
      const text = (sql.strings ?? [sql.sql ?? ""]).join(" ");
      return /DISTINCT "title"/.test(text) ? parishNames : items;
    }),
    $executeRaw: vi.fn(),
  } as unknown as Db;

  it("fills every missing unit, skips cached ones, and pre-translates foreign-script parish names", async () => {
    const plan = planItem(items[0]!, "full");
    expect(planItem(items[1]!, "full").units[0]!.protect).toEqual(["Thérèse of Lisieux"]);
    store.existingHashes.mockImplementation(async (_db: Db, lang: string) =>
      lang === "es"
        ? new Set([unitHash("es", plan.units.find((u) => u.source === "Pray daily.")!)])
        : new Set(),
    );
    const engine = stubEngine({ "en>es": es, "ko>en": () => "Myeongdong Cathedral" });
    const report = await runPretranslation({ db: fakeDb, engine }, { langs: ["es"] });
    const stored = store.storeResults.mock.calls.flatMap((c) => c[1] as TranslationResult[]);
    expect(stored.map((r) => [r.lang, r.unit.source, r.text])).toEqual([
      ["en", "명동대성당", "Myeongdong Cathedral"],
      ["es", "Holy Hour", "?Holy hour"],
      [
        "es",
        "Thérèse of Lisieux entered the Carmel at fifteen.",
        "Thérèse of Lisieux entró en el Carmelo a los quince años.",
      ],
      ["es", "명동대성당", "Catedral de Myeongdong"],
    ]);
    expect(report).toEqual({ translated: 4, untranslated: 0, remaining: 0 });
  });

  it("stops at its budget and reports what is left", async () => {
    const engine = stubEngine({ "en>es": es, "ko>en": () => "Myeongdong Cathedral" });
    const report = await runPretranslation(
      { db: fakeDb, engine, batchSize: 1 },
      { langs: ["es"], maxUnits: 2 },
    );
    expect(report.translated + report.untranslated).toBe(2);
    expect(report.remaining).toBeGreaterThan(0);
  });

  it("plans units exactly as the web server hashes them", () => {
    const units = contentUnits(items, "fr");
    for (const [hash, unit] of units) expect(unitHash("fr", unit)).toBe(hash);
    const names = nameUnits(parishNames, "fr");
    expect([...names.values()].map((u) => [u.source, u.sourceLang])).toEqual([
      ["명동대성당", "ko"],
    ]);
  });
});
