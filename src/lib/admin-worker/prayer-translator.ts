/**
 * Deterministic liturgical translation engine for the Admin Worker.
 *
 * The worker gives every prayer a Latin and (where it authentically exists) a
 * Greek text WITHOUT any AI/LLM and WITHOUT a network call. It does this the
 * way the Church herself does: it does not re-derive the Pater Noster from
 * grammar — it uses the *received* text. So every token this engine emits comes
 * from an authoritative liturgical source already curated in the repo
 * (`PRAYER_TRANSLATIONS`, the Vulgate / Missale Romanum / received Greek), never
 * from word-substitution or guessed declensions.
 *
 * Two resolution strategies, strongest first:
 *   1. Whole-prayer match — the English body is normalised and looked up against
 *      the curated corpus; an exact match emits that prayer's authentic Latin /
 *      Greek verbatim. This covers the canonical prayers (which are exactly the
 *      ones the site publishes).
 *   2. Segment assembly — the English is split into liturgical segments (the
 *      embedded sub-prayers and the stock responses / closings / doxologies) and
 *      each is translated from the authoritative segment memory. The result is
 *      only returned as ACCURATE when every segment resolves; a single
 *      unresolved segment means we refuse to emit a fabricated text and instead
 *      report the gap so it routes to human review.
 *
 * `accurate === true` therefore guarantees: the entire output is authentic
 * received liturgical text. The worker only auto-publishes accurate output.
 */

import { prayerKnowledge } from "@/lib/checklist/knowledge/prayers";

export type TargetLang = "la" | "el";

export interface TranslationResult {
  /** The assembled translation, or null when it cannot be produced authentically. */
  text: string | null;
  /** How the text was produced. */
  matched: "whole-prayer" | "segments" | "none";
  /** Fraction (0..1) of source segments resolved from authentic memory. */
  coverage: number;
  /**
   * True only when the whole text is authentic received liturgical text (a
   * whole-prayer match, or every segment resolved). Only accurate output is
   * ever auto-published.
   */
  accurate: boolean;
  /** English segments that could not be resolved (drives the review task). */
  unresolved: string[];
}

/* ── Normalisation ─────────────────────────────────────────────────────────
 * Fold a piece of English prayer text to a comparison key: lowercase, normalise
 * quotes/dashes, drop rubric scaffolding (V./R. cues, "(Hail Mary)" stage
 * directions, "Let us pray"), strip punctuation, and collapse whitespace. This
 * makes matching robust to line-break and punctuation differences without ever
 * changing which prayer a text *is*.
 */
function fold(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/\bthou\b/g, "you")
    .replace(/\bthee\b/g, "you")
    .replace(/\bthy\b/g, "your")
    .replace(/\bthine\b/g, "your")
    .replace(/[.,;:!?"'()\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Lines that are pure rubric/scaffolding and carry no translatable text. */
const RUBRIC_LINE = /^(v|r)\s*[.:]/i;
// A stage direction is a line that is ONLY a reference token — e.g. "(Hail Mary)"
// or "Glory be…" used as a placeholder. The trailing `[^a-z]*$` guard means a
// real prayer that merely *begins* with those words ("Our Father, who art…") is
// NOT treated as a stage direction.
const STAGE_DIRECTION = /^\(?\s*(hail mary|our father|glory be|repeat|pause)\b[^a-z]*$/i;

/* ── Authoritative segment memory ──────────────────────────────────────────
 * Small, reusable units of *received* liturgical text — the stock responses,
 * doxologies and closings that recur across devotions, plus the embedded
 * sub-prayers. Keyed by folded English; values are the verbatim Latin / Greek.
 * Greek is supplied only where an authentic Greek liturgical form exists; a
 * missing Greek value means the segment cannot be rendered in Greek (it is left
 * unresolved rather than invented).
 */
interface Segment {
  en: string;
  la: string;
  el?: string;
}

const STOCK_SEGMENTS: Segment[] = [
  { en: "Amen.", la: "Amen.", el: "Ἀμήν." },
  { en: "Alleluia.", la: "Alleluia.", el: "Ἀλληλούϊα." },
  { en: "Lord, have mercy.", la: "Kyrie, eleison.", el: "Κύριε, ἐλέησον." },
  { en: "Christ, have mercy.", la: "Christe, eleison.", el: "Χριστέ, ἐλέησον." },
  { en: "Have mercy on us.", la: "Miserere nobis." },
  { en: "Pray for us.", la: "Ora pro nobis." },
  { en: "Let us pray.", la: "Oremus." },
  // Stock litany invocations / responses — the verbatim received forms that
  // recur across the approved litanies, so segment assembly can render them.
  { en: "Christ, hear us.", la: "Christe, audi nos." },
  { en: "Christ, graciously hear us.", la: "Christe, exaudi nos." },
  {
    en: "Christ, hear us. Christ, graciously hear us.",
    la: "Christe, audi nos. Christe, exaudi nos.",
  },
  { en: "Spare us, O Lord.", la: "Parce nobis, Domine." },
  { en: "Graciously hear us, O Lord.", la: "Exaudi nos, Domine." },
  { en: "We beseech Thee, hear us.", la: "Te rogamus, audi nos." },
  {
    en: "Lamb of God, who takest away the sins of the world, spare us, O Lord.",
    la: "Agnus Dei, qui tollis peccata mundi, parce nobis, Domine.",
  },
  {
    en: "Lamb of God, who takest away the sins of the world, graciously hear us, O Lord.",
    la: "Agnus Dei, qui tollis peccata mundi, exaudi nos, Domine.",
  },
  {
    en: "Lamb of God, who takest away the sins of the world, have mercy on us.",
    la: "Agnus Dei, qui tollis peccata mundi, miserere nobis.",
  },
  { en: "Through Christ our Lord. Amen.", la: "Per Christum Dominum nostrum. Amen." },
  {
    en: "Through the same Christ our Lord. Amen.",
    la: "Per eundem Christum Dominum nostrum. Amen.",
  },
  {
    en: "Pray for us, O holy Mother of God.",
    la: "Ora pro nobis, sancta Dei Genetrix.",
  },
  {
    en: "That we may be made worthy of the promises of Christ.",
    la: "Ut digni efficiamur promissionibus Christi.",
  },
];

/* ── Memory built from the curated corpus ──────────────────────────────────
 * Every curated prayer that carries an authentic Latin / Greek text becomes a
 * whole-prayer entry (folded English body → verbatim translation) and also a
 * segment entry, so a devotion that embeds it (e.g. a novena that prays the
 * Our Father) resolves that block.
 */
interface WholePrayer {
  slug: string;
  folded: string;
  la?: string;
  el?: string;
}

function buildCorpus(): { whole: WholePrayer[]; segments: Map<string, Segment> } {
  const whole: WholePrayer[] = [];
  const segments = new Map<string, Segment>();

  const addSegment = (en: string, la: string | undefined, el: string | undefined) => {
    const key = fold(en);
    if (!key || !la) return;
    if (!segments.has(key)) segments.set(key, { en, la, el });
  };

  for (const seg of STOCK_SEGMENTS) addSegment(seg.en, seg.la, seg.el);

  for (const entry of prayerKnowledge) {
    const p = entry.payload as Record<string, unknown>;
    const body = typeof p.body === "string" ? p.body : "";
    const la = typeof p.latin === "string" ? p.latin : undefined;
    const el = typeof p.greek === "string" ? p.greek : undefined;
    if (!body || (!la && !el)) continue;
    const folded = fold(body);
    whole.push({ slug: entry.slug, folded, la, el });
    addSegment(body, la, el);
  }

  return { whole, segments };
}

const CORPUS = buildCorpus();

/** Split a prayer into translatable segments, dropping pure rubric lines. */
function segmentize(english: string): string[] {
  // Split on blank lines first (stanzas), then fall back to single lines so a
  // run-on body still yields its embedded sub-prayers / closings.
  const blocks = english
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  const units = blocks.length > 1 ? blocks : english.split(/\n/);
  return units
    .map((u) => u.trim())
    .filter((u) => u.length > 0 && !RUBRIC_LINE.test(u) && !STAGE_DIRECTION.test(u));
}

/**
 * Translate an English prayer into Latin or Greek using only authentic received
 * text. Returns an honest coverage report; callers auto-publish only when
 * `accurate` is true.
 */
export function translatePrayer(english: string, target: TargetLang): TranslationResult {
  const none: TranslationResult = {
    text: null,
    matched: "none",
    coverage: 0,
    accurate: false,
    unresolved: [],
  };
  if (typeof english !== "string" || !english.trim()) return none;

  // 1) Whole-prayer match — the strongest, most faithful path.
  const foldedAll = fold(english);
  for (const w of CORPUS.whole) {
    if (w.folded === foldedAll) {
      const text = target === "la" ? w.la : w.el;
      if (text && text.trim()) {
        return { text, matched: "whole-prayer", coverage: 1, accurate: true, unresolved: [] };
      }
    }
  }

  // 2) Segment assembly — translate each liturgical unit from authentic memory.
  const units = segmentize(english);
  if (units.length === 0) return none;

  const pieces: string[] = [];
  const unresolved: string[] = [];
  let resolved = 0;
  for (const unit of units) {
    const seg = CORPUS.segments.get(fold(unit));
    const text = seg ? (target === "la" ? seg.la : seg.el) : undefined;
    if (text && text.trim()) {
      pieces.push(text);
      resolved += 1;
    } else {
      unresolved.push(unit);
    }
  }

  const coverage = resolved / units.length;
  const accurate = coverage === 1 && pieces.length > 0;
  return {
    text: accurate ? pieces.join("\n") : null,
    matched: accurate ? "segments" : "none",
    coverage,
    accurate,
    unresolved,
  };
}

/**
 * Convenience for the worker: produce whatever authentic translations a prayer
 * can have right now. Only languages that resolve accurately are returned.
 */
export function translatePrayerLanguages(english: string): {
  latin?: string;
  greek?: string;
  latinResult: TranslationResult;
  greekResult: TranslationResult;
} {
  const latinResult = translatePrayer(english, "la");
  const greekResult = translatePrayer(english, "el");
  return {
    ...(latinResult.accurate && latinResult.text ? { latin: latinResult.text } : {}),
    ...(greekResult.accurate && greekResult.text ? { greek: greekResult.text } : {}),
    latinResult,
    greekResult,
  };
}
