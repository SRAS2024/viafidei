/**
 * The whole of what one press of the pray-along button says, in order: the Sign of the
 * Cross, the prayer (with every prayer it names prayed in full), and the Sign of the
 * Cross, as clips and pauses.
 *
 * Builders, one per kind of page:
 *   - `prayerScript`      a prayer or a litany, in the language shown;
 *   - `novenaDayScript`   one day of a novena (or of a devotion with days);
 *   - `rosaryScript`      the whole Rosary on one set of mysteries;
 *   - `sequenceScript`    a guide's or a devotion's prayers, in the order prayed.
 *
 * Which language each part is said in: a prayer the reader switched to Latin or
 * Greek (the session-wide chips) is said in that language when it has it; otherwise
 * in the language the page shows it in (the reader's, once translated, else English).
 *
 * Pure: no I/O, no React. The API route gathers the texts and hands them in.
 */

import { resolvePrayerLanguage, type PrayerVariant } from "@/lib/content-shared/prayer-language";
import { ROSARY_MYSTERY_SETS, type MysterySetKey } from "@/lib/content-shared/rosary";

import { toAudioLang, type AudioLang } from "./languages";
import { rosaryTextsFor } from "./rosary-texts";
import {
  closesWithSignOfTheCross,
  opensWithSignOfTheCross,
  SIGN_OF_THE_CROSS,
} from "./sign-of-the-cross";
import {
  normalizeForSpeech,
  PRAYER_PAUSE_MS,
  spokenSteps,
  STANZA_PAUSE_MS,
  type SpokenStep,
} from "./speech-text";

/** A clip to play, or a pause. `take` picks one of several recordings of a repeated prayer. */
export type ScriptItem =
  | { kind: "say"; text: string; lang: AudioLang; take?: number }
  | { kind: "pause"; ms: number };

export interface PrayAlongScript {
  /** The language most of it is said in (the Sign of the Cross's). */
  lang: AudioLang;
  items: ScriptItem[];
}

/** A prayer the builders can pray by name: its variants as the reader sees them. */
export interface PrayerSource {
  slug: string;
  title: string;
  /** As shown: the vernacular in the reader's language once translated, Latin, Greek. */
  variants: readonly PrayerVariant[];
  /** The stored English vernacular, line for line, to read a translation's instructions by. */
  english?: string;
}

export interface ScriptContext {
  /** The page's language, as the audio speaks it. */
  pageLang: AudioLang;
  /** The reader's chosen prayer language (the Latin / Greek chips), or null. */
  chosen: string | null;
  /** Every prayer a text may name (building blocks and the page's own prayers). */
  prayers: ReadonlyMap<string, PrayerSource>;
}

/** Recordings kept of a prayer said many times in a row, so a decade does not echo. */
export const TAKES = 3;

/** The longer silences of a Rosary. */
const ANNOUNCE_PAUSE_MS = 1300;
const DECADE_PAUSE_MS = 1800;

/* -------------------------------------------------------------------------- */
/* Assembling                                                                 */
/* -------------------------------------------------------------------------- */

class ScriptWriter {
  readonly items: ScriptItem[] = [];
  /** How many times each text has been said, to rotate the takes of a repeated prayer. */
  private readonly said = new Map<string, number>();

  say(text: string, lang: AudioLang, takes = false): void {
    const words = normalizeForSpeech(text, lang);
    if (!words) return;
    const key = `${lang}|${words}`;
    const n = this.said.get(key) ?? 0;
    this.said.set(key, n + 1);
    this.items.push({ kind: "say", text: words, lang, ...(takes ? { take: n % TAKES } : {}) });
  }

  pause(ms: number): void {
    const last = this.items[this.items.length - 1];
    if (!last) return;
    if (last.kind === "pause") last.ms = Math.max(last.ms, ms);
    else this.items.push({ kind: "pause", ms });
  }

  finish(lang: AudioLang): PrayAlongScript {
    while (this.items[this.items.length - 1]?.kind === "pause") this.items.pop();
    return { lang, items: this.items };
  }
}

/** The text of a named prayer as this reader prays it, with its language. */
function prayerText(
  source: PrayerSource,
  ctx: ScriptContext,
): { text: string; lang: AudioLang; english?: string } | null {
  const { vernacular, shown } = resolvePrayerLanguage(source.variants, ctx.chosen);
  if (!shown) return null;
  const lang = toAudioLang(shown.lang ?? shown.code) ?? "en";
  // The English to read a translation's instructions by, only for the vernacular.
  const english = shown === vernacular && lang !== "en" ? source.english : undefined;
  return { text: shown.text, lang, english };
}

const MAX_DEPTH = 3;

/** Says spoken steps, praying each named prayer in full (and the prayers it names). */
function writeSteps(
  w: ScriptWriter,
  steps: readonly SpokenStep[],
  ctx: ScriptContext,
  depth: number,
  within: ReadonlySet<string>,
): void {
  for (const step of steps) {
    if (step.kind === "pause") w.pause(step.ms);
    else if (step.kind === "say") w.say(step.text, step.lang);
    else writePrayer(w, step.slug, step.count, ctx, depth + 1, within);
  }
}

/** Prays a named prayer `count` times. A prayer that names itself is not re-entered. */
function writePrayer(
  w: ScriptWriter,
  slug: string,
  count: number,
  ctx: ScriptContext,
  depth: number,
  within: ReadonlySet<string>,
): void {
  if (depth > MAX_DEPTH || within.has(slug)) return;
  if (slug === "sign-of-the-cross") {
    const lang = signLang(ctx, ctx.pageLang);
    for (let i = 0; i < count; i++) {
      w.pause(PRAYER_PAUSE_MS);
      w.say(SIGN_OF_THE_CROSS[lang], lang, count > 1);
    }
    w.pause(PRAYER_PAUSE_MS);
    return;
  }
  const source = ctx.prayers.get(slug);
  if (!source) return;
  const text = prayerText(source, ctx);
  if (!text) return;
  const inner = new Set(within).add(slug);
  const steps = spokenSteps(text.text, {
    lang: text.lang,
    english: text.english,
    prayers: [...ctx.prayers.values()],
  });
  for (let i = 0; i < count; i++) {
    w.pause(PRAYER_PAUSE_MS);
    if (count > 1 && steps.every((s) => s.kind !== "prayer")) {
      // A prayer said many times over: rotate its recordings.
      for (const step of steps) {
        if (step.kind === "say") w.say(step.text, step.lang, true);
        else if (step.kind === "pause") w.pause(step.ms);
      }
    } else {
      writeSteps(w, steps, ctx, depth, inner);
    }
  }
  w.pause(PRAYER_PAUSE_MS);
}

/** The language of the opening and closing Sign of the Cross. */
function signLang(ctx: ScriptContext, textLang: AudioLang): AudioLang {
  const chosen = toAudioLang(ctx.chosen);
  if (chosen === "la" || chosen === "el") return chosen;
  return textLang;
}

/** Wraps a body in the Sign of the Cross, unless the body already opens or closes with it. */
function wrapInSign(
  body: (w: ScriptWriter) => void,
  lang: AudioLang,
  firstText: string | null,
  lastText: string | null,
): PrayAlongScript {
  const w = new ScriptWriter();
  const opens = firstText ? opensWithSignOfTheCross(firstText, lang) : false;
  const closes = lastText ? closesWithSignOfTheCross(lastText, lang) : false;
  if (!opens) {
    w.say(SIGN_OF_THE_CROSS[lang], lang);
    w.pause(PRAYER_PAUSE_MS);
  }
  body(w);
  if (!closes) {
    w.pause(PRAYER_PAUSE_MS);
    w.say(SIGN_OF_THE_CROSS[lang], lang);
  }
  return w.finish(lang);
}

function firstSaid(steps: readonly SpokenStep[]): string | null {
  const s = steps.find((x) => x.kind === "say");
  return s && s.kind === "say" ? s.text : null;
}

function lastSaid(steps: readonly SpokenStep[]): string | null {
  for (let i = steps.length - 1; i >= 0; i--) {
    const s = steps[i]!;
    if (s.kind === "say") return s.text;
    if (s.kind === "prayer") return null;
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* A prayer or a litany                                                       */
/* -------------------------------------------------------------------------- */

export interface ShownText {
  /** The words as the page shows them. */
  text: string;
  /** Their language. */
  lang: AudioLang;
  /** The stored English, line for line, when `text` is a translation of it. */
  english?: string;
}

/**
 * A prayer page: the Sign of the Cross, the prayer as shown (every prayer it names
 * prayed in full), the Sign of the Cross. The Sign of the Cross's own page says it once.
 */
export function prayerScript(slug: string, shown: ShownText, ctx: ScriptContext): PrayAlongScript {
  // The chaplet's own page holds its instructions with its prayers: it prays the chaplet.
  const chaplet = /\bbeads?\b|\bdecades?\b/i.test(shown.english ?? shown.text)
    ? divineMercyPrayers(shown)
    : null;
  if (chaplet) return divineMercyScript(chaplet, ctx);
  const steps = spokenSteps(shown.text, {
    lang: shown.lang,
    english: shown.english,
    prayers: [...ctx.prayers.values()],
  });
  const within = new Set([slug]);
  if (slug === "sign-of-the-cross") {
    const w = new ScriptWriter();
    writeSteps(w, steps, ctx, 0, within);
    return w.finish(shown.lang);
  }
  return wrapInSign(
    (w) => writeSteps(w, steps, ctx, 0, within),
    shown.lang,
    firstSaid(steps),
    lastSaid(steps),
  );
}

/* -------------------------------------------------------------------------- */
/* A novena day                                                               */
/* -------------------------------------------------------------------------- */

/** Quoted words in a text, in order, whatever the quotation marks. */
export function quotedPassages(text: string): string[] {
  const out: string[] = [];
  const re = /["“„«「『]([^"“”„«»「」『』]{6,})["”»」』“]/g;
  for (const m of text.matchAll(re)) out.push(m[1]!.trim());
  return out;
}

/** The Divine Mercy chaplet's own prayers, in one language. */
export interface ChapletPrayers {
  eternal: string;
  passion: string;
  holy: string;
  /** The closing prayer, when the text gives it ("Eternal God, in whom mercy is endless"). */
  closing?: string;
  lang: AudioLang;
}

/**
 * The Chaplet of the Divine Mercy as its instructions describe it: the Our Father, the
 * Hail Mary and the Creed; on each of five decades the "Eternal Father" once and the
 * "For the sake of His sorrowful Passion" ten times; then the "Holy God" three times,
 * and the closing prayer when the text gives one.
 */
function writeDivineMercyChaplet(
  w: ScriptWriter,
  prayers: ChapletPrayers,
  ctx: ScriptContext,
): void {
  for (const slug of ["our-father", "hail-mary", "apostles-creed"]) {
    writePrayer(w, slug, 1, ctx, 1, new Set());
  }
  for (let decade = 0; decade < 5; decade++) {
    w.pause(DECADE_PAUSE_MS);
    w.say(prayers.eternal, prayers.lang, true);
    for (let bead = 0; bead < 10; bead++) {
      w.pause(PRAYER_PAUSE_MS);
      w.say(prayers.passion, prayers.lang, true);
    }
  }
  w.pause(DECADE_PAUSE_MS);
  for (let i = 0; i < 3; i++) {
    w.say(prayers.holy, prayers.lang, true);
    w.pause(PRAYER_PAUSE_MS);
  }
  if (prayers.closing) w.say(prayers.closing, prayers.lang);
}

/** Quoted passages and whole lines: where a text may hold a chaplet prayer. */
function passages(text: string): string[] {
  return [
    ...quotedPassages(text),
    ...text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean),
  ];
}

/**
 * The Divine Mercy chaplet's prayers, when `shown` is a text that prays the chaplet (a
 * novena day, a guide's steps, the chaplet's own prayer page). They are found in the
 * English (quoted, or on lines of their own) and said in the reader's words when the
 * translation kept the same quotations or lines, else in English.
 */
export function divineMercyPrayers(shown: ShownText): ChapletPrayers | null {
  const english = shown.english ?? shown.text;
  if (
    !/Chaplet of (?:the )?Divine Mercy|Divine Mercy Chaplet|Eternal Father, I offer You/i.test(
      english,
    )
  ) {
    return null;
  }
  const en = passages(english);
  const pick = (re: RegExp) => en.find((q) => re.test(q));
  const eternal = pick(/^Eternal Father, I offer/i);
  const passion = pick(/^For the sake of His sorrowful Passion/i);
  const holy = pick(/^Holy God, Holy Mighty One/i);
  const closing = pick(/^Eternal God, in whom mercy is endless/i);
  if (!eternal || !passion || !holy) return null;
  if (shown.english && shown.lang !== "en") {
    const enQuotes = quotedPassages(english);
    const trQuotes = quotedPassages(shown.text);
    const enLines = english.split("\n").map((l) => l.trim());
    const trLines = shown.text.split("\n").map((l) => l.trim());
    const inReader = (q: string): string | null => {
      const qi = enQuotes.indexOf(q);
      if (qi >= 0 && trQuotes.length === enQuotes.length) return trQuotes[qi] ?? null;
      const li = enLines.indexOf(q);
      if (li >= 0 && trLines.length === enLines.length) return trLines[li] || null;
      return null;
    };
    const t = { eternal: inReader(eternal), passion: inReader(passion), holy: inReader(holy) };
    if (t.eternal && t.passion && t.holy) {
      const c = closing ? inReader(closing) : null;
      return {
        eternal: t.eternal,
        passion: t.passion,
        holy: t.holy,
        ...(c ? { closing: c } : {}),
        lang: shown.lang,
      };
    }
  }
  return { eternal, passion, holy, ...(closing ? { closing } : {}), lang: "en" };
}

/** The Chaplet of the Divine Mercy on its own, between the Sign of the Cross. */
export function divineMercyScript(prayers: ChapletPrayers, ctx: ScriptContext): PrayAlongScript {
  const lang = signLang(ctx, prayedLang("our-father", ctx) ?? prayers.lang);
  return wrapInSign((w) => writeDivineMercyChaplet(w, prayers, ctx), lang, null, null);
}

/**
 * One day of a novena: the Sign of the Cross, the day's prayer as shown (its named
 * prayers prayed in full, its "(Thrice.)" said three times), the Sign of the Cross. A
 * day that only says how to pray the Chaplet of the Divine Mercy prays the chaplet.
 */
export function novenaDayScript(shown: ShownText, ctx: ScriptContext): PrayAlongScript {
  const lang = signLang(ctx, shown.lang);
  const chaplet = divineMercyPrayers(shown);
  if (chaplet) return divineMercyScript(chaplet, ctx);
  const steps = spokenSteps(shown.text, {
    lang: shown.lang,
    english: shown.english,
    prayers: [...ctx.prayers.values()],
  });
  return wrapInSign(
    (w) => writeSteps(w, steps, ctx, 0, new Set()),
    lang,
    firstSaid(steps),
    lastSaid(steps),
  );
}

/* -------------------------------------------------------------------------- */
/* The Rosary                                                                 */
/* -------------------------------------------------------------------------- */

/** The language a named prayer is prayed in for this reader, or null when it is missing. */
function prayedLang(slug: string, ctx: ScriptContext): AudioLang | null {
  const source = ctx.prayers.get(slug);
  return source ? (prayerText(source, ctx)?.lang ?? null) : null;
}

/**
 * The language the Rosary's own words (announcements, closing prayer) are said in: the
 * language its Hail Marys are prayed in, so one Rosary never mixes two languages, or
 * English when there are no checked texts in that language.
 */
function rosaryLang(ctx: ScriptContext): AudioLang {
  const lang = prayedLang("hail-mary", ctx);
  return lang && rosaryTextsFor(lang) ? lang : "en";
}

/**
 * The Rosary as the site's guide prays it, on one set of mysteries: the Creed, the Our
 * Father, three Hail Marys and the Glory Be; then five decades, each announced, with
 * the Our Father, ten Hail Marys, the Glory Be and the Fatima Prayer; then the Hail,
 * Holy Queen, its versicle and response, and the closing prayer, all between the Sign
 * of the Cross.
 */
export function rosaryScript(set: MysterySetKey, ctx: ScriptContext): PrayAlongScript {
  const lang = rosaryLang(ctx);
  return wrapInSign((w) => writeRosary(w, set, ctx), signLang(ctx, lang), null, null);
}

/** The Rosary's body, without the Sign of the Cross around it. */
function writeRosary(w: ScriptWriter, set: MysterySetKey, ctx: ScriptContext): void {
  const lang = rosaryLang(ctx);
  const texts = rosaryTextsFor(lang)!;
  const mysterySet = ROSARY_MYSTERY_SETS.find((s) => s.key === set) ?? ROSARY_MYSTERY_SETS[0]!;
  const announcements = texts.announcements[mysterySet.key];
  writePrayer(w, "apostles-creed", 1, ctx, 1, new Set());
  writePrayer(w, "our-father", 1, ctx, 1, new Set());
  writePrayer(w, "hail-mary", 3, ctx, 1, new Set());
  writePrayer(w, "glory-be", 1, ctx, 1, new Set());
  for (let m = 0; m < 5; m++) {
    w.pause(DECADE_PAUSE_MS);
    w.say(announcements[m]!, lang);
    w.pause(ANNOUNCE_PAUSE_MS);
    writePrayer(w, "our-father", 1, ctx, 1, new Set());
    writePrayer(w, "hail-mary", 10, ctx, 1, new Set());
    writePrayer(w, "glory-be", 1, ctx, 1, new Set());
    writePrayer(w, "fatima-prayer", 1, ctx, 1, new Set());
  }
  w.pause(DECADE_PAUSE_MS);
  writePrayer(w, "salve-regina", 1, ctx, 1, new Set());
  // The Hail, Holy Queen's English carries its versicle and response; a text that
  // does not (the Latin) has them said here, so they are prayed exactly once.
  // A translation keeps its English lines, so it is judged by its English; the Latin
  // or Greek by its own words.
  const salve = ctx.prayers.get("salve-regina");
  const said = salve ? prayerText(salve, ctx) : null;
  const carries = said?.english
    ? /promises of Christ/i.test(said.english)
    : /promis|promess|promes|Christi|Χριστ|基督|그리스도|Kristo|Kitô|Chrystus/i.test(
        said?.text ?? "",
      );
  if (!carries) {
    w.say(texts.versicle, lang);
    w.pause(STANZA_PAUSE_MS);
    w.say(texts.response, lang);
    w.pause(PRAYER_PAUSE_MS);
  }
  w.say(`${texts.letUsPray} ${texts.closingPrayer}`, lang);
}

/* -------------------------------------------------------------------------- */
/* A guide's or a devotion's prayers                                          */
/* -------------------------------------------------------------------------- */

/** A step of a prayed sequence: a named prayer some number of times. */
export interface SequenceStep {
  slug: string;
  count?: number;
}

/**
 * Prayers in the order they are prayed, between the Sign of the Cross: a prayer guide
 * or a devotion prayed through in full. A listed Sign of the Cross is the one the
 * audio opens and closes with, so it is not said again in the middle.
 */
export function sequenceScript(
  steps: readonly SequenceStep[],
  ctx: ScriptContext,
): PrayAlongScript {
  const first = steps.find((s) => s.slug !== "sign-of-the-cross");
  const lang = signLang(ctx, (first && prayedLang(first.slug, ctx)) ?? ctx.pageLang);
  return wrapInSign(
    (w) => {
      for (const step of steps) {
        if (step.slug === "sign-of-the-cross") continue;
        writePrayer(w, step.slug, step.count ?? 1, ctx, 1, new Set());
      }
    },
    lang,
    null,
    null,
  );
}

/* -------------------------------------------------------------------------- */
/* A guide's own plan                                                         */
/* -------------------------------------------------------------------------- */

/**
 * What a guide prays, step by step, as checked for it (guide-plans.json): a named
 * prayer, words its steps quote, a repeated block (decades, stations), or the whole
 * Rosary or Divine Mercy chaplet. The Sign of the Cross around it is added here.
 */
export type PlanItem =
  | { prayer: string; count?: number }
  | { quote: { step: number; index: number }; count?: number }
  | { repeat: number; items: PlanItem[] }
  | { template: "rosary" | "divine-mercy-chaplet" };

export interface PlanInputs {
  /** The words a step quotes, in the reader's language when the translation kept them. */
  quote: (step: number, index: number) => { text: string; lang: AudioLang } | null;
  /** The set the Rosary is prayed on. */
  rosarySet: MysterySetKey;
  /** The Divine Mercy chaplet's prayers, when the guide gives them. */
  chaplet: ChapletPrayers | null;
}

/** Plans nest; a runaway one is cut off rather than allowed to build forever. */
const MAX_PLAN_ITEMS = 2000;

export function planScript(
  plan: readonly PlanItem[],
  inputs: PlanInputs,
  ctx: ScriptContext,
): PrayAlongScript {
  const firstPrayer = plan.find((i): i is { prayer: string } => "prayer" in i);
  const lang = signLang(
    ctx,
    (firstPrayer && prayedLang(firstPrayer.prayer, ctx)) ??
      prayedLang("our-father", ctx) ??
      ctx.pageLang,
  );
  let budget = MAX_PLAN_ITEMS;
  const run = (w: ScriptWriter, items: readonly PlanItem[]) => {
    for (const item of items) {
      if (--budget < 0) return;
      if ("repeat" in item) {
        const times = Math.max(1, Math.min(60, Math.trunc(item.repeat)));
        for (let i = 0; i < times; i++) run(w, item.items ?? []);
      } else if ("template" in item) {
        if (item.template === "rosary") writeRosary(w, inputs.rosarySet, ctx);
        else if (inputs.chaplet) writeDivineMercyChaplet(w, inputs.chaplet, ctx);
      } else if ("prayer" in item) {
        if (item.prayer === "sign-of-the-cross") continue;
        writePrayer(w, item.prayer, Math.max(1, item.count ?? 1), ctx, 1, new Set());
      } else if ("quote" in item) {
        const q = inputs.quote(item.quote.step, item.quote.index);
        if (!q) continue;
        const times = Math.max(1, item.count ?? 1);
        for (let i = 0; i < times; i++) {
          w.pause(PRAYER_PAUSE_MS);
          w.say(q.text, q.lang, times > 1);
        }
        w.pause(PRAYER_PAUSE_MS);
      }
    }
  };
  return wrapInSign((w) => run(w, plan), lang, null, null);
}
