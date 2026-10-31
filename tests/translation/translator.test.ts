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
  acceptTranslation,
  contentUnits,
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

  it("returns nulls, never throws, for a language it has no model for or a unit that is not English", async () => {
    const engine = stubEngine({ "en>es": es });
    const pray = { kind: "text" as const, source: "Pray daily.", sourceLang: "en", protect: [] };
    for (const lang of ["la", "en", "ko", "xx"]) {
      expect(await translateUnits({ db, engine }, lang, [pray]), lang).toEqual([
        { text: null, model: "none" },
      ]);
    }
    // A row that is not English content (a parish name from an older build, say)
    // never reaches a model.
    expect(
      await translateUnits({ db, engine }, "es", [
        { ...pray, source: "명동대성당", sourceLang: "ko" },
      ]),
    ).toEqual([{ text: null, model: "none" }]);
    expect(engine.calls).toEqual([]);
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
  const fakeDb = {
    $queryRaw: vi.fn(async () => items),
    $executeRaw: vi.fn(),
  } as unknown as Db;

  it("fills every missing unit, skips cached ones, and never plans parish names", async () => {
    const plan = planItem(items[0]!, "full");
    expect(planItem(items[1]!, "full").units[0]!.protect).toEqual(["Thérèse of Lisieux"]);
    store.existingHashes.mockImplementation(
      async (_db: Db, lang: string, hashes: readonly string[]) => {
        const cached = unitHash("es", plan.units.find((u) => u.source === "Pray daily.")!);
        return lang === "es" && hashes.includes(cached) ? new Set([cached]) : new Set();
      },
    );
    const engine = stubEngine({ "en>es": es });
    const report = await runPretranslation({ db: fakeDb, engine }, { langs: ["es"] });
    const stored = store.storeResults.mock.calls.flatMap((c) => c[1] as TranslationResult[]);
    expect(stored.map((r) => [r.lang, r.unit.source, r.text])).toEqual([
      ["es", "Holy Hour", "?Holy hour"],
      [
        "es",
        "Thérèse of Lisieux entered the Carmel at fifteen.",
        "Thérèse of Lisieux entró en el Carmelo a los quince años.",
      ],
    ]);
    expect(report).toEqual({ translated: 2, untranslated: 0, remaining: 0 });
    // Only published content is read: parish names are transliterated on the page.
    const sql = (fakeDb.$queryRaw as ReturnType<typeof vi.fn>).mock.calls
      .map((c) => ((c[0] as { strings?: string[] }).strings ?? []).join(" "))
      .join("\n");
    expect(sql).toMatch(/"contentType"::text <> 'PARISH'/);
  });

  it("asks the database only about units it does not already know are finished", async () => {
    const engine = stubEngine({ "en>es": es });
    await runPretranslation({ db: fakeDb, engine }, { langs: ["es"] });
    const firstAsk = store.existingHashes.mock.calls[0]![2] as string[];
    expect(firstAsk.length).toBe(contentUnits(items, "es").size);
    store.existingHashes.mockClear();
    store.storeResults.mockClear();
    // Everything was stored by the first pass: the second has nothing to ask or do.
    const again = await runPretranslation({ db: fakeDb, engine }, { langs: ["es"] });
    expect(store.existingHashes).not.toHaveBeenCalled();
    expect(store.storeResults).not.toHaveBeenCalled();
    expect(again).toEqual({ translated: 0, untranslated: 0, remaining: 0 });
  });

  it("stops at its budget and reports what is left", async () => {
    const engine = stubEngine({ "en>es": es });
    const report = await runPretranslation(
      { db: fakeDb, engine, batchSize: 1 },
      { langs: ["es"], maxUnits: 2 },
    );
    expect(report.translated + report.untranslated).toBe(2);
    expect(report.remaining).toBeGreaterThan(0);
  });

  it("plans units exactly as the web server hashes them", () => {
    const units = contentUnits(items, "fr");
    expect(units.size).toBeGreaterThan(0);
    for (const [hash, unit] of units) expect(unitHash("fr", unit)).toBe(hash);
  });
});
