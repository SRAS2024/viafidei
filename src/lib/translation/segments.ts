/**
 * Turning a published item into translatable units, and back.
 *
 * `planItem` walks the parts of an item a page displays (title, subtitle and
 * the prose fields of the payload), applies the rules (rules.ts) and returns:
 *   - `units`: the English sentences and phrases the engine translates, each
 *     with the Latin/Greek spans that must survive verbatim;
 *   - `fields`: where every unit sits, line by line, with the text around it
 *     that is kept as written (Latin lines, Greek, URLs, punctuation).
 *
 * `assembleItem` rebuilds the item from whatever translations exist. A line
 * (paragraph) is replaced only when EVERY unit in it is translated, so a page
 * that is still being translated never mixes languages inside a paragraph —
 * the untranslated lines simply stay English until the translator catches up.
 *
 * The web server and the translator both plan with this module, so the hash
 * a page looks up is exactly the hash the translator stored.
 */

import { createHash } from "node:crypto";

import {
  decideTitle,
  detectScript,
  findPersonNames,
  findProtectedSpans,
  isPersonContentType,
  isTranslatableKey,
  isTranslatablePrayerText,
  looksLatin,
  personNameForms,
} from "./rules";
import { limitLength, splitSentences } from "./text";

/** Bump to re-key (and so re-translate) every unit after a segmentation change. */
export const SEGMENT_FORMAT_VERSION = 1;

export type UnitKind = "title" | "text";

export interface Unit {
  kind: UnitKind;
  /** The exact English text sent to the engine. */
  source: string;
  /** Language of `source`: always "en" (content is authored in English). */
  sourceLang: string;
  /** Spans that must come back verbatim (Latin/Greek titles, Greek script). */
  protect: string[];
}

type Piece = { keep: string } | { unit: number; lead: string; trail: string };

interface LinePlan {
  pieces: Piece[];
}

export type FieldPath = ReadonlyArray<string | number>;

export interface FieldPlan {
  path: FieldPath;
  /** Line breaks are kept exactly: `lines` alternate with `breaks`. */
  lines: LinePlan[];
  breaks: string[];
}

export interface ItemPlan {
  fields: FieldPlan[];
  units: Unit[];
}

/** The parts of a published item the planner reads. */
export interface PlannableItem {
  contentType: string;
  slug?: string;
  title: string;
  subtitle?: string | null;
  payload?: Record<string, unknown> | null;
}

export type PlanDepth = "full" | "card";

/** Payload fields a list card shows. */
const CARD_PAYLOAD_KEYS = new Set(["summary", "description"]);

/** At most this many units per item: a pathological payload cannot flood the engine. */
const MAX_UNITS_PER_ITEM = 1500;

const URL_RE =
  /\b(?:https?:\/\/|www\.)[^\s<>"“”‘’]*[^\s<>"“”‘’.,;:!?)\]]|\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/gi;

/**
 * Text with nothing to translate: no letters, a URL alone, footnote markers, a
 * bare domain, a code ("after-communion", "march-19", "ROMAN_RITE") or an
 * acronym ("MSPS") — a tag the payload stores, which a model would only mangle.
 */
export function looksUntranslatable(text: string): boolean {
  const t = text.trim();
  if (!/\p{L}/u.test(t)) return true;
  if (/^[a-z0-9]+(?:[-_][a-z0-9]+)+$/.test(t) || /^[A-Z0-9]+(?:_[A-Z0-9]+)+$/.test(t)) return true;
  if (/^[A-Z]{2,6}$/.test(t)) return true;
  URL_RE.lastIndex = 0;
  const m = URL_RE.exec(t);
  if (m && m[0].length === t.length) return true;
  if (/^(?:\[[^\]]*\]\s*)+$/.test(t)) return true;
  return /^[\w-]+(\.[\w-]+)+\/?$/.test(t);
}

/** Should this sentence stay exactly as written (Latin, Greek or another script)? */
function keepAsWritten(text: string): boolean {
  return looksLatin(text) || detectScript(text) !== "latin";
}

class Planner {
  readonly units: Unit[] = [];
  readonly fields: FieldPlan[] = [];
  private readonly byKey = new Map<string, number>();

  constructor(private readonly extraProtect: string[]) {}

  private unit(kind: UnitKind, source: string, protect: string[]): number | null {
    const key = `${kind}\u0001${source}`;
    const existing = this.byKey.get(key);
    if (existing !== undefined) return existing;
    if (this.units.length >= MAX_UNITS_PER_ITEM) return null;
    this.units.push({ kind, source, sourceLang: "en", protect });
    this.byKey.set(key, this.units.length - 1);
    return this.units.length - 1;
  }

  /** One sentence-sized piece: a unit, or kept as written. */
  private piece(text: string, kind: UnitKind): Piece[] {
    const out: Piece[] = [];
    // URLs and e-mail addresses are never translated: split them out.
    let last = 0;
    const parts: Array<{ text: string; literal: boolean }> = [];
    for (const m of text.matchAll(URL_RE)) {
      if (m.index > last) parts.push({ text: text.slice(last, m.index), literal: false });
      parts.push({ text: m[0], literal: true });
      last = m.index + m[0].length;
    }
    if (last < text.length) parts.push({ text: text.slice(last), literal: false });

    for (const part of parts) {
      if (part.literal) {
        out.push({ keep: part.text });
        continue;
      }
      const lead = part.text.match(/^\s*/)![0];
      const core = part.text.trim();
      const trail = core ? part.text.match(/\s*$/)![0] : "";
      if (!core || looksUntranslatable(core) || keepAsWritten(core)) {
        out.push({ keep: part.text });
        continue;
      }
      const protect = [...new Set(findProtectedSpans(core, this.extraProtect).map((s) => s.text))];
      const index = this.unit(kind, core, protect);
      out.push(index === null ? { keep: part.text } : { unit: index, lead, trail });
    }
    return out;
  }

  /** Plan a free-text field, line by line, sentence by sentence. */
  text(path: FieldPath, value: string, kind: UnitKind = "text"): void {
    const segments = value.split(/(\r?\n+)/);
    const lines: LinePlan[] = [];
    const breaks: string[] = [];
    for (let i = 0; i < segments.length; i++) {
      if (i % 2 === 1) {
        breaks.push(segments[i]!);
        continue;
      }
      const line = segments[i]!;
      if (!line.trim() || keepAsWritten(line)) {
        lines.push({ pieces: [{ keep: line }] });
        continue;
      }
      const pieces: Piece[] = [];
      const lead = line.match(/^\s*/)![0];
      if (lead) pieces.push({ keep: lead });
      for (const sentence of splitSentences(line.trim())) {
        const parts = limitLength(sentence.text);
        parts.forEach((part) => {
          pieces.push(...this.piece(part.text, kind));
          if (part.after) pieces.push({ keep: part.after });
        });
        if (sentence.after) pieces.push({ keep: sentence.after });
      }
      const trail = line.match(/\s*$/)![0];
      if (trail && line.trim()) pieces.push({ keep: trail });
      lines.push({ pieces });
    }
    if (lines.some((l) => l.pieces.some((p) => "unit" in p))) {
      this.fields.push({ path, lines, breaks });
    }
  }

  /** A short label or a title: one unit, never split into sentences. */
  phrase(path: FieldPath, value: string, kind: UnitKind, protect: string[] = []): void {
    const core = value.trim();
    if (!core || looksUntranslatable(core) || keepAsWritten(core)) return;
    const spans = new Set([
      ...findProtectedSpans(core, this.extraProtect).map((s) => s.text),
      ...protect,
    ]);
    const index = this.unit(kind, core, [...spans]);
    if (index === null) return;
    const lead = value.match(/^\s*/)![0];
    const trail = value.match(/\s*$/)![0];
    this.fields.push({ path, lines: [{ pieces: [{ unit: index, lead, trail }] }], breaks: [] });
  }
}

/** A short single-line string (a chip, a label) is one phrase, not prose. */
function isPhrase(value: string): boolean {
  return (
    value.length <= 80 &&
    !/\n/.test(value) &&
    !/[.!?]\s+\p{Lu}/u.test(value) &&
    // A URL is split out of the text it sits in, which only prose planning does.
    !new RegExp(URL_RE.source, "i").test(value)
  );
}

function walk(
  planner: Planner,
  value: unknown,
  key: string,
  path: FieldPath,
  nested: boolean,
  payload: Record<string, unknown>,
): void {
  if (!isTranslatableKey(key, nested)) return;
  if (typeof value === "string") {
    if (!value.trim()) return;
    // A prayer's own text is translated only when it is English.
    if ((key === "body" || key === "prayerText" || key === "prayer") && !nested) {
      if (!isTranslatablePrayerText(payload, value)) return;
    }
    if (isPhrase(value)) planner.phrase(path, value, nested && key === "title" ? "title" : "text");
    else planner.text(path, value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, i) => {
      if (typeof entry === "string") {
        if (!entry.trim()) return;
        if (isPhrase(entry)) planner.phrase([...path, i], entry, "text");
        else planner.text([...path, i], entry);
      } else if (entry && typeof entry === "object") {
        for (const [k, v] of Object.entries(entry as Record<string, unknown>)) {
          walk(planner, v, k, [...path, i, k], true, payload);
        }
      }
    });
    return;
  }
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      walk(planner, v, k, [...path, k], true, payload);
    }
  }
}

/**
 * Plan an item's translatable units. Parish items contribute nothing here —
 * their names are transliterated on the page, never translated
 * (`decideParishName`) — and people's names (saints, Doctors, popes) are
 * never units: rule (c).
 */
export function planItem(item: PlannableItem, depth: PlanDepth = "full"): ItemPlan {
  if (item.contentType === "PARISH") return { fields: [], units: [] };
  const title = String(item.title ?? "");
  const decision = decideTitle(item.contentType, title);
  // The item's own Latin/Greek name — and a saint's or Doctor's own name
  // (rule c) — is protected wherever its prose mentions it. A pope's regnal
  // name is not: the model renders it as each language does.
  const ownName =
    decision.mode === "keep" &&
    decision.reason !== "parish" &&
    (decision.reason !== "person-name" || item.contentType !== "POPE");
  // The saint a page is about, in every form its prose uses: "Saint Aaron of
  // Aleth" is "Aaron of Aleth" and "Aaron" in his biography, and the saint of
  // "Novena to Saint Thérèse of Lisieux" is "Thérèse" in the novena's days.
  const saints =
    item.contentType === "SAINT" || item.contentType === "DOCTOR"
      ? [title.trim()]
      : isPersonContentType(item.contentType)
        ? []
        : findPersonNames(title).map((n) => n.text);
  const names = saints.flatMap(personNameForms);
  const extra = ownName
    ? [title.trim(), ...names]
    : decision.mode === "translate"
      ? [...decision.protect, ...names]
      : [];
  const planner = new Planner(extra.filter(Boolean));

  if (decision.mode === "translate") planner.phrase(["title"], title, "title", decision.protect);
  if (item.subtitle) planner.phrase(["subtitle"], item.subtitle, "text");

  const payload = item.payload ?? {};
  for (const [key, value] of Object.entries(payload)) {
    if (depth === "card" && !CARD_PAYLOAD_KEYS.has(key)) continue;
    walk(planner, value, key, ["payload", key], false, payload);
  }
  return { fields: planner.fields, units: planner.units };
}

/* ------------------------------------------------------------------ */
/*  Hashing                                                           */
/* ------------------------------------------------------------------ */

/** The cache key of one unit in one target language. */
export function unitHash(lang: string, unit: Unit): string {
  return createHash("sha256")
    .update(
      [
        `v${SEGMENT_FORMAT_VERSION}`,
        lang,
        unit.kind,
        unit.sourceLang,
        [...unit.protect].sort().join("\u0001"),
        unit.source,
      ].join("\n"),
    )
    .digest("hex");
}

/* ------------------------------------------------------------------ */
/*  Reassembly                                                        */
/* ------------------------------------------------------------------ */

export interface AssembledItem {
  title: string;
  subtitle: string | null;
  payload: Record<string, unknown>;
  /** Units that had a translation. */
  translated: number;
  /** Units still waiting for one. */
  missing: number;
}

/**
 * Set `value` at `path`, copying each container on the way the first time it
 * is written (copy-on-write): the item's own payload is never changed, and a
 * large payload is not cloned to replace one summary on a list card.
 */
function setAt(
  root: Record<string, unknown>,
  path: FieldPath,
  value: string,
  copies: WeakSet<object>,
): void {
  let node = root as Record<string | number, unknown>;
  for (let i = 0; i < path.length - 1; i++) {
    const child = node[path[i]!];
    if (child == null || typeof child !== "object") return;
    let next = child as Record<string | number, unknown>;
    if (!copies.has(next)) {
      next = (Array.isArray(child) ? [...child] : { ...next }) as Record<string | number, unknown>;
      copies.add(next);
      node[path[i]!] = next;
    }
    node = next;
  }
  node[path[path.length - 1]!] = value;
}

function getAt(root: Record<string, unknown>, path: FieldPath): unknown {
  let node: unknown = root;
  for (const key of path) {
    if (node == null || typeof node !== "object") return undefined;
    node = (node as Record<string | number, unknown>)[key];
  }
  return node;
}

/**
 * Rebuild the displayed parts of an item from the available translations
 * (`translations.get(unitIndex)` → finished text). The input item is never
 * mutated: containers on a translated path are copied, the rest is shared.
 */
export function assembleItem(
  item: PlannableItem,
  plan: ItemPlan,
  translations: ReadonlyMap<number, string>,
): AssembledItem {
  const doc: Record<string, unknown> = {
    title: item.title,
    subtitle: item.subtitle ?? null,
    payload: item.payload ?? {},
  };
  const copies = new WeakSet<object>([doc]);
  let translated = 0;
  let missing = 0;
  const counted = new Set<number>();
  for (const field of plan.fields) {
    const original = getAt(doc, field.path);
    if (typeof original !== "string") continue;
    const sourceLines = original.split(/\r?\n+/);
    let out = "";
    field.lines.forEach((line, i) => {
      const units = line.pieces.filter((p): p is Extract<Piece, { unit: number }> => "unit" in p);
      const complete = units.every((p) => translations.has(p.unit));
      for (const p of units) {
        if (counted.has(p.unit)) continue;
        counted.add(p.unit);
        if (translations.has(p.unit)) translated++;
        else missing++;
      }
      if (complete && units.length) {
        for (const p of line.pieces) {
          out += "unit" in p ? p.lead + translations.get(p.unit)! + p.trail : p.keep;
        }
      } else {
        // Not every sentence is ready: the whole line stays as written.
        out += sourceLines[i] ?? "";
      }
      if (i < field.breaks.length) out += field.breaks[i];
    });
    setAt(doc, field.path, out, copies);
  }
  return {
    title: doc.title as string,
    subtitle: (doc.subtitle as string | null) ?? null,
    payload: doc.payload as Record<string, unknown>,
    translated,
    missing,
  };
}
