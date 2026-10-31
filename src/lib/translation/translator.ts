/**
 * The translator: fills the ContentTranslation cache the web server reads.
 *
 * It runs outside the web server (scripts/translate-content.ts, on the Mac
 * worker host) and does two things, visitors first:
 *
 *   1. DEMAND — units a visitor's page needed and did not find (filed by
 *      localize.ts as `pending` rows) are claimed oldest-first, one language
 *      at a time, translated and stored. The visitor's next view shows them.
 *   2. PRE-TRANSLATION — every published item (parishes aside) is planned
 *      exactly as a page plans it (segments.ts), and each unit not yet in the
 *      cache is translated, language by language, in small batches that
 *      yield to new demand between them. Parish names in a script other
 *      than the reader's (rule b) are pre-translated too.
 *
 * Every unit goes through the rules before a model sees it: protected spans
 * (Latin and Greek titles, saints' names) are replaced by placeholders that
 * must come back intact (mask.ts), and an output that is degenerate, adds to
 * the source or lost a placeholder is retried, then given up — the page keeps
 * the English. Nothing here is ever awaited by a page render.
 */

import { Prisma } from "@prisma/client";

import type { TranslationEngine } from "./engine/engine";
import type { Log } from "./engine/hub";
import type { LanguagePair } from "./engine/models";
import { hasContentModel, isMtLocale, MT_TARGET_LOCALES, type MtLocale } from "./languages";
import { maskSpans, unmaskSpans, type MaskedText } from "./mask";
import { decideParishName } from "./rules";
import { planItem, unitHash, type PlannableItem, type Unit } from "./segments";
import {
  claimPending,
  existingHashes,
  releaseClaims,
  storeResults,
  type Db,
  type PendingRow,
  type TranslationResult,
} from "./store";
import {
  buildCaseStats,
  isTitleCase,
  looksBroken,
  prepareSource,
  sentenceCase,
  type CaseStats,
} from "./text";

export interface TranslatorDeps {
  db: Db;
  engine: TranslationEngine;
  log?: Log;
  /** Written to claimedBy, e.g. "translator@mac-mini". */
  claimant?: string;
  /** Sentences per engine call (default 16). */
  batchSize?: number;
}

/** Name languages the engine reads (rules.ts NameSourceLang minus English). */
const NAME_SOURCES = new Set<string>(["zh", "ja", "ko", "ru", "uk", "el", "ar", "mul"]);

/* ------------------------------------------------------------------ */
/*  Preparing one unit                                                */
/* ------------------------------------------------------------------ */

/** Copy the exact casing of each protected span back over a sentence-cased text. */
function keepSpanCase(cased: string, original: string, spans: readonly string[]): string {
  if (cased.length !== original.length) return original;
  let out = cased;
  for (const span of spans) {
    if (!span) continue;
    for (let at = original.indexOf(span); at >= 0; at = original.indexOf(span, at + span.length)) {
      out = out.slice(0, at) + span + out.slice(at + span.length);
    }
  }
  return out;
}

/**
 * The text a model is given for a unit: a Title Case heading read as a
 * phrase ("To Bear One's Cross" → "To bear one's cross"), English conventions
 * the models mishandle rewritten, and every protected span masked.
 */
export function prepareUnit(unit: Unit, stats: CaseStats = new Map()): MaskedText {
  let text = unit.source;
  if (isTitleCase(text)) text = keepSpanCase(sentenceCase(text, stats), text, unit.protect);
  return maskSpans(prepareSource(text), unit.protect);
}

/** The model's output with the spans restored, or null when it must not be used. */
export function acceptTranslation(
  masked: MaskedText,
  output: string,
  lang: MtLocale | "en",
): string | null {
  if (looksBroken(masked.text, output, lang)) return null;
  const restored = unmaskSpans(output, masked);
  return restored === null ? null : restored.replace(/\s+/g, " ").trim() || null;
}

/** A name translation is usable when it is not broken and is in the reader's script. */
export function acceptName(source: string, output: string, lang: MtLocale | "en"): boolean {
  const out = output.replace(/\s+/g, " ").trim();
  if (!out || out === source.trim()) return false;
  if (lang === "en" || (lang !== "ko" && lang !== "zh")) {
    if (!/\p{Script=Latin}/u.test(out)) return false;
  }
  return !looksBroken(source, out, lang);
}

/* ------------------------------------------------------------------ */
/*  Translating units                                                 */
/* ------------------------------------------------------------------ */

export interface UnitOutcome {
  /** The translation, or null when no model produced an acceptable one. */
  text: string | null;
  /** The model(s) that produced it ("none" when nothing could run). */
  model: string;
}

async function translateContent(
  deps: TranslatorDeps,
  lang: MtLocale,
  units: readonly Unit[],
  stats?: CaseStats,
): Promise<UnitOutcome[]> {
  const pair = `en>${lang}` as LanguagePair;
  if (!deps.engine.supports(pair)) return units.map(() => ({ text: null, model: "none" }));
  const prepared = units.map((unit) => prepareUnit(unit, stats));
  const accepted: Array<string | null> = units.map(() => null);
  const res = await deps.engine.translate(
    pair,
    prepared.map((p) => p.text),
    {
      accept: (i, out) => {
        const ok = acceptTranslation(prepared[i]!, out, lang);
        if (ok !== null) accepted[i] = ok;
        return ok !== null;
      },
    },
  );
  return units.map((_, i) => ({
    text: res.outputs[i] === null ? null : accepted[i]!,
    model: res.models[i] ?? "none",
  }));
}

function cleanName(source: string, output: string): string {
  const out = output.replace(/\s+/g, " ").trim();
  return /[.。]$/u.test(source.trim()) ? out : out.replace(/(?<!\b(?:St|Sts|Mt|Ste))[.。]$/u, "");
}

/** Translate `texts` for a pair with name acceptance; untranslatable pairs give nulls. */
async function translateNameTexts(
  deps: TranslatorDeps,
  pair: LanguagePair,
  texts: readonly string[],
  target: MtLocale | "en",
): Promise<{ outputs: Array<string | null>; models: Array<string | null> }> {
  if (!texts.length || !deps.engine.supports(pair)) {
    return { outputs: texts.map(() => null), models: texts.map(() => null) };
  }
  const res = await deps.engine.translate(pair, texts, {
    accept: (i, out) => acceptName(texts[i]!, out, target),
  });
  return {
    // A name gets no full stop the source does not have ("圣若瑟堂" → "St. Joseph's Hall.").
    outputs: res.outputs.map((o, i) => (o === null ? null : cleanName(texts[i]!, o))),
    models: res.models,
  };
}

/**
 * English renderings already made in this process, so the pivot for one name
 * runs once, not once per reader language ("ko\u0001명동대성당" → text).
 */
const englishNames = new Map<string, { text: string; model: string }>();
const ENGLISH_NAMES_MAX = 50_000;

/** Test hook. */
export function resetTranslatorState(): void {
  englishNames.clear();
}

/**
 * Parish names (rule b): into English with the name's own model, then into
 * the reader's language with the English model, unless the reader reads
 * English (or Latin, which is served the English rendering).
 */
async function translateNames(
  deps: TranslatorDeps,
  lang: MtLocale | "en",
  units: readonly Unit[],
): Promise<UnitOutcome[]> {
  const out: UnitOutcome[] = units.map(() => ({ text: null, model: "none" }));
  const english: Array<string | null> = units.map((u) => (u.sourceLang === "en" ? u.source : null));
  const firstModel: Array<string | null> = units.map(() => null);
  const bySource = new Map<string, number[]>();
  units.forEach((u, i) => {
    if (u.sourceLang === "en" || !NAME_SOURCES.has(u.sourceLang)) return;
    const known = englishNames.get(`${u.sourceLang}\u0001${u.source}`);
    if (known) {
      english[i] = known.text;
      firstModel[i] = known.model;
      return;
    }
    bySource.set(u.sourceLang, [...(bySource.get(u.sourceLang) ?? []), i]);
  });
  for (const [source, indexes] of bySource) {
    const res = await translateNameTexts(
      deps,
      `${source}>en` as LanguagePair,
      indexes.map((i) => units[i]!.source),
      "en",
    );
    indexes.forEach((index, j) => {
      english[index] = res.outputs[j]!;
      firstModel[index] = res.models[j]!;
      const text = res.outputs[j];
      if (text && res.models[j]) {
        if (englishNames.size >= ENGLISH_NAMES_MAX) englishNames.clear();
        englishNames.set(`${source}\u0001${units[index]!.source}`, { text, model: res.models[j]! });
      }
    });
  }
  if (lang === "en") {
    units.forEach((_, i) => {
      if (english[i] !== null && firstModel[i])
        out[i] = { text: english[i], model: firstModel[i]! };
    });
    return out;
  }
  const ready = units.map((_, i) => i).filter((i) => english[i] !== null);
  const res = await translateNameTexts(
    deps,
    `en>${lang}` as LanguagePair,
    ready.map((i) => english[i]!),
    lang,
  );
  ready.forEach((index, j) => {
    const text = res.outputs[j];
    if (text === null || text === undefined) return;
    const models = [firstModel[index], res.models[j]].filter(Boolean).join(" + ");
    out[index] = { text, model: models || "none" };
  });
  return out;
}

/** Translate units (all of one target language). Throws only when a model cannot run at all. */
export async function translateUnits(
  deps: TranslatorDeps,
  lang: string,
  units: readonly Unit[],
  stats?: CaseStats,
): Promise<UnitOutcome[]> {
  const out: UnitOutcome[] = units.map(() => ({ text: null, model: "none" }));
  const target: MtLocale | "en" | null = isMtLocale(lang) ? lang : lang === "en" ? "en" : null;
  if (!target) return out;
  const names = units.map((u, i) => (u.kind === "name" ? i : -1)).filter((i) => i >= 0);
  const content = units.map((u, i) => (u.kind !== "name" ? i : -1)).filter((i) => i >= 0);
  if (content.length && target !== "en") {
    const res = await translateContent(
      deps,
      target,
      content.map((i) => units[i]!),
      stats,
    );
    content.forEach((index, j) => (out[index] = res[j]!));
  }
  if (names.length) {
    const res = await translateNames(
      deps,
      target,
      names.map((i) => units[i]!),
    );
    names.forEach((index, j) => (out[index] = res[j]!));
  }
  return out;
}

/* ------------------------------------------------------------------ */
/*  1. Visitor demand                                                 */
/* ------------------------------------------------------------------ */

function rowUnit(row: PendingRow): Unit {
  const kind = row.kind === "title" || row.kind === "name" ? row.kind : "text";
  return {
    kind,
    source: row.source,
    sourceLang: row.sourceLang || "en",
    protect: Array.isArray(row.protect) ? row.protect : [],
  };
}

/**
 * Claim and translate up to `limit` units visitors asked for (one language
 * per call). Returns how many rows were handled; 0 when there is no demand.
 */
export async function runDemand(deps: TranslatorDeps, limit = 64): Promise<number> {
  const rows = await claimPending(deps.db, {
    claimant: deps.claimant ?? "translator",
    limit,
  });
  if (!rows.length) return 0;
  const lang = rows[0]!.lang;
  const units = rows.map(rowUnit);
  try {
    const outcomes = await translateUnits(deps, lang, units);
    await storeResults(
      deps.db,
      rows.map((row, i) => ({
        lang: row.lang,
        hash: row.sourceHash,
        unit: units[i]!,
        text: outcomes[i]!.text,
        model: outcomes[i]!.model,
      })),
    );
  } catch (err) {
    deps.log?.(`[translation] demand batch for ${lang} failed: ${(err as Error).message}`);
    await releaseClaims(
      deps.db,
      rows.map((r) => r.id),
    );
  }
  return rows.length;
}

/* ------------------------------------------------------------------ */
/*  2. Pre-translation                                                */
/* ------------------------------------------------------------------ */

type ItemRow = {
  contentType: string;
  slug: string;
  title: string;
  subtitle: string | null;
  payload: Record<string, unknown> | null;
};

/** Every published item a page can show, parishes aside (their names are below). */
export async function loadPublishedItems(db: Db): Promise<PlannableItem[]> {
  const rows = await db.$queryRaw<ItemRow[]>(Prisma.sql`
    SELECT "contentType"::text AS "contentType", "slug", "title", "subtitle", "payload"
    FROM "PublishedContent"
    WHERE "isPublished" = true AND "contentType"::text <> 'PARISH'
    ORDER BY "contentType", "slug"`);
  return rows.map((r) => ({
    contentType: r.contentType,
    slug: r.slug,
    title: r.title,
    subtitle: r.subtitle,
    payload: r.payload && typeof r.payload === "object" ? r.payload : {},
  }));
}

/** A character outside the Latin script and common punctuation. */
const NON_LATIN_PATTERN = "[^\t-ɏḀ-ỿ -⁯₠-⃏℀-⅏]";

/** Published parish names written (at least partly) in a non-Latin script. */
export async function loadForeignScriptParishNames(
  db: Db,
): Promise<Array<{ title: string; countryCode: string | null }>> {
  return db.$queryRaw<Array<{ title: string; countryCode: string | null }>>(Prisma.sql`
    SELECT DISTINCT "title", "payload"->>'countryCode' AS "countryCode"
    FROM "PublishedContent"
    WHERE "contentType"::text = 'PARISH' AND "isPublished" = true
      AND "title" ~ ${NON_LATIN_PATTERN}`);
}

/** Every unit of every item for one language, deduplicated by hash. */
export function contentUnits(items: readonly PlannableItem[], lang: string): Map<string, Unit> {
  const units = new Map<string, Unit>();
  for (const item of items) {
    for (const unit of planItem(item, "full").units) {
      const hash = unitHash(lang, unit);
      if (!units.has(hash)) units.set(hash, unit);
    }
  }
  return units;
}

/** Name units a reader of `target` needs pre-translated (English-source names wait for demand). */
export function nameUnits(
  names: ReadonlyArray<{ title: string; countryCode: string | null }>,
  target: MtLocale | "en",
): Map<string, Unit> {
  const units = new Map<string, Unit>();
  for (const { title, countryCode } of names) {
    const decision = decideParishName(title, target, { countryCode });
    if (decision.action !== "translate" || decision.from === "en") continue;
    const unit: Unit = {
      kind: "name",
      source: title,
      sourceLang: decision.from,
      protect: [],
    };
    units.set(unitHash(target, unit), unit);
  }
  return units;
}

export interface PretranslateOptions {
  /** Stop after this many units (default: no limit). */
  maxUnits?: number;
  /** Languages to fill (default: all ten). */
  langs?: readonly MtLocale[];
  /** Skip the parish-name pass. */
  skipNames?: boolean;
  /** Serve visitor demand after every this many batches (default 4). */
  demandEvery?: number;
}

export interface PretranslateReport {
  translated: number;
  untranslated: number;
  /** Units still missing when the budget ran out (0 = everything is cached). */
  remaining: number;
}

/**
 * Translate whatever published content is not cached yet. Idempotent and
 * resumable: a later pass starts by asking the cache what already exists.
 */
export async function runPretranslation(
  deps: TranslatorDeps,
  opts: PretranslateOptions = {},
): Promise<PretranslateReport> {
  const report: PretranslateReport = { translated: 0, untranslated: 0, remaining: 0 };
  const batchSize = Math.max(1, deps.batchSize ?? 16);
  const demandEvery = Math.max(1, opts.demandEvery ?? 4);
  let budget = opts.maxUnits ?? Number.POSITIVE_INFINITY;
  let batches = 0;

  const items = await loadPublishedItems(deps.db);
  const stats = buildCaseStats(
    items.flatMap((item) =>
      Object.values(item.payload ?? {}).filter((v): v is string => typeof v === "string"),
    ),
  );
  const names = opts.skipNames ? [] : await loadForeignScriptParishNames(deps.db);

  const jobs: Array<{ lang: MtLocale | "en"; units: Map<string, Unit> }> = [];
  if (names.length) jobs.push({ lang: "en", units: nameUnits(names, "en") });
  // A language without a content model (Korean) reads names in English.
  for (const lang of (opts.langs ?? MT_TARGET_LOCALES).filter((l) => hasContentModel(l))) {
    jobs.push({ lang, units: contentUnits(items, lang) });
    if (names.length) jobs.push({ lang, units: nameUnits(names, lang) });
  }

  for (const job of jobs) {
    const hashes = [...job.units.keys()];
    if (!hashes.length) continue;
    const done = await existingHashes(deps.db, job.lang, hashes);
    const missing = hashes.filter((h) => !done.has(h));
    for (let i = 0; i < missing.length; i += batchSize) {
      if (budget <= 0) {
        report.remaining += missing.length - i;
        break;
      }
      const slice = missing.slice(i, i + Math.min(batchSize, budget));
      const units = slice.map((h) => job.units.get(h)!);
      const outcomes = await translateUnits(deps, job.lang, units, stats);
      const results: TranslationResult[] = slice.map((hash, j) => ({
        lang: job.lang,
        hash,
        unit: units[j]!,
        text: outcomes[j]!.text,
        model: outcomes[j]!.model,
      }));
      await storeResults(deps.db, results);
      for (const r of results) {
        if (r.text === null) report.untranslated++;
        else report.translated++;
      }
      budget -= slice.length;
      if (slice.length < Math.min(batchSize, missing.length - i)) {
        report.remaining += missing.length - i - slice.length;
        break;
      }
      if (++batches % demandEvery === 0) {
        while ((await runDemand(deps)) > 0) {
          /* visitors first */
        }
      }
    }
  }
  return report;
}

/** One translator pass: all pending visitor demand, then a slice of pre-translation. */
export async function runTranslatorPass(
  deps: TranslatorDeps,
  opts: PretranslateOptions & { demandOnly?: boolean } = {},
): Promise<{ demand: number; pretranslation: PretranslateReport | null }> {
  let demand = 0;
  for (let n = await runDemand(deps); n > 0; n = await runDemand(deps)) demand += n;
  if (opts.demandOnly) return { demand, pretranslation: null };
  const pretranslation = await runPretranslation(deps, opts);
  return { demand, pretranslation };
}
