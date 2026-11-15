/**
 * What a prayer's text says aloud.
 *
 * The audio prays the prayer and nothing else (the owner's rule): no headings, no
 * instructions, no references, no "V." or "R.", no printed crosses. What each line is
 * comes from `parsePrayerText`, the reading the page itself is set by, so the audio and
 * the page agree on what is prayer:
 *   - spoken, versicle and response lines are said, without their markers;
 *   - a heading ("First Decade."), a note ("(Lk 1:28)") or a symbol is left out;
 *   - an instruction that names prayers is PRAYED, not read: "Our Father, Hail Mary,
 *     Glory Be." becomes those three prayers, "Ave Maria." or "Ave." at the end of a
 *     petition becomes a Hail Mary, "three Hail Marys" three of them;
 *   - "(Thrice.)" says its line three times; any other instruction is left out.
 *
 * A text shown in the reader's language keeps the stored English line for line
 * (src/lib/translation keeps every line break), so a line is judged by its English and
 * said in the reader's words: a translated "Padre Nuestro, Ave María, Gloria." is an
 * instruction because its English line is one.
 *
 * Pure: no I/O, no React.
 */

import { parsePrayerText, type PrayerLine } from "@/lib/content-shared/prayer-format";
import {
  tokenizePrayerMentions,
  type MentionablePrayer,
} from "@/lib/content-shared/prayer-mentions";

import type { AudioLang } from "./languages";

/** One thing the audio does: say some words, pray a named prayer, or pause. */
export type SpokenStep =
  | { kind: "say"; text: string; lang: AudioLang }
  | { kind: "prayer"; slug: string; count: number }
  | { kind: "pause"; ms: number };

/** Pauses, in milliseconds: between stanzas, and between whole prayers. */
export const STANZA_PAUSE_MS = 700;
export const PRAYER_PAUSE_MS = 1100;

/** The longest stretch one clip speaks; longer stanzas are cut at lines, then sentences. */
export const MAX_CLIP_CHARS = 300;

/* -------------------------------------------------------------------------- */
/* Normalising words for a voice                                              */
/* -------------------------------------------------------------------------- */

const ENGLISH_ORDINALS: Record<string, string> = {
  II: "the Second",
  III: "the Third",
  IV: "the Fourth",
  V: "the Fifth",
  VI: "the Sixth",
  VII: "the Seventh",
  VIII: "the Eighth",
  IX: "the Ninth",
  X: "the Tenth",
  XI: "the Eleventh",
  XII: "the Twelfth",
  XIII: "the Thirteenth",
  XIV: "the Fourteenth",
  XV: "the Fifteenth",
  XVI: "the Sixteenth",
  XXIII: "the Twenty-third",
};

/**
 * Polytonic Greek as modern Greek writes it: breathings and the iota subscript go,
 * grave and circumflex become the one stress accent. Modern Greek pronunciation, which
 * is how the Church in Greece prays these texts, is unchanged by it, and a voice reads
 * monotonic text more reliably.
 */
export function toMonotonicGreek(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0313\u0314\u0345\u0304\u0306]/g, "")
    .replace(/[\u0300\u0342]/g, "\u0301")
    .replace(/\u0301(?=\u0301)/g, "")
    .normalize("NFC");
}

/**
 * Words a voice would misread, as a person says them. Only what prayers actually
 * carry: "St." before a name, "Bl.", a pope's number. The voice engine reads numbers
 * and the rest itself.
 */
/**
 * A citation inside a prayer's text: "(St Thomas of Villanova)", "(S. Aug. Sermo de
 * Sanct.)", "(\"No creature could be in closer union with God.\" B. Albertus Magnus)",
 * "(Lk 1:28)". It tells the reader where words come from; it is not prayed.
 */
const CITATION =
  /\s*\(\s*(?:["\u201c][^"\u201d()]*["\u201d]\s*)?(?:(?:St|S|SS|Sts|B|Bl|Ven|Saint|Pope|cf|Cf|see|See|Sermo|Serm|Hom|Ep|Ps|Lib|lib|cap)\.?\s[^()]{0,90}|[^()]*\d+\s*[:,.]\s*\d+[^()]*)\)/g;

/** A name placeholder: "thy servant N., whom…" is prayed "thy servant, whom…". */
const NAME_PLACEHOLDER = /(?:^|\s)N\.(?:\s?N\.)?(?=[\s,.;:]|$)/g;

export function normalizeForSpeech(text: string, lang: AudioLang): string {
  let s = text
    .replace(CITATION, "")
    .replace(NAME_PLACEHOLDER, "")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/[\u2720\u271D\u271E\u2020\u2021\u2629]/g, " ")
    .replace(/[\u2123\u211F]\.?/g, " ")
    .replace(/\s*\/\s+(?=\S)/g, ", ")
    .replace(/\s+/g, " ")
    .trim();
  if (lang === "en") {
    s = s
      .replace(/\bSts\.\s+(?=\p{Lu})/gu, "Saints ")
      .replace(/\bSt\.\s+(?=\p{Lu})/gu, "Saint ")
      .replace(/\bBl\.\s+(?=\p{Lu})/gu, "Blessed ")
      .replace(/\bVen\.\s+(?=\p{Lu})/gu, "Venerable ")
      .replace(/\bB\.\s?V\.\s?M\.?/g, "Blessed Virgin Mary")
      .replace(/\s&\s/g, " and ")
      .replace(
        /\b(\p{Lu}\p{Ll}+) (II|III|IV|VI|VII|VIII|IX|XI|XII|XIII|XIV|XV|XVI|XXIII)\b/gu,
        (_m, name: string, numeral: string) => `${name} ${ENGLISH_ORDINALS[numeral] ?? numeral}`,
      );
  } else if (lang === "fr") {
    s = s.replace(/\bSte\s+(?=\p{Lu})/gu, "Sainte ").replace(/\bSt\s+(?=\p{Lu})/gu, "Saint ");
  } else if (lang === "es" || lang === "pt" || lang === "it") {
    s = s.replace(/\bSta\.\s+(?=\p{Lu})/gu, "Santa ").replace(/\bSto\.\s+(?=\p{Lu})/gu, "Santo ");
  } else if (lang === "la") {
    s = s.replace(/æ/g, "ae").replace(/Æ/g, "Ae").replace(/œ/g, "oe").replace(/Œ/g, "Oe");
  } else if (lang === "el") {
    s = toMonotonicGreek(s);
  }
  return s;
}

/** Letters only, for "does this text open with the Sign of the Cross?". */
export function foldForCompare(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/* -------------------------------------------------------------------------- */
/* Counting                                                                   */
/* -------------------------------------------------------------------------- */

const COUNT_WORDS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fifteen: 15,
  thirty: 30,
  thirty_three: 33,
};

function countWord(word: string): number | null {
  const w = word.toLowerCase().replace(/-/g, "_");
  if (/^\d{1,2}$/.test(w)) return Number(w);
  return COUNT_WORDS[w] ?? null;
}

const TIMES_WORDS: Record<string, number> = { once: 1, twice: 2, thrice: 3 };

/** "three times", "thrice", "(3x)", "x3" right after a name or at a line's end. */
function timesAfter(text: string): number | null {
  const m =
    /^\s*[,(]?\s*(?:(once|twice|thrice)|(\w+(?:-\w+)?)\s+times|(\d{1,2})\s*x|x\s*(\d{1,2}))\b/i.exec(
      text,
    );
  if (!m) return null;
  if (m[1]) return TIMES_WORDS[m[1].toLowerCase()] ?? null;
  if (m[2]) return countWord(m[2]);
  return Number(m[3] ?? m[4]);
}

/** "one", "three", "ten", "10" right before a name. */
function countBefore(text: string): number | null {
  const m = /(?:^|\s)(\w+(?:-\w+)?)\s*$/.exec(text);
  return m?.[1] ? countWord(m[1]) : null;
}

/** A bracketed instruction that only repeats its line: "(Thrice.)", "(3 times)". */
function repeatRubric(text: string): number | null {
  const m = /^\(?\s*(once|twice|thrice|(\w+(?:-\w+)?)\s+times|(\d{1,2})\s*x)\s*\.?\s*\)?\.?$/i.exec(
    text.trim(),
  );
  if (!m) return null;
  if (m[3]) return Number(m[3]);
  if (m[2]) return countWord(m[2]);
  return TIMES_WORDS[(m[1] ?? "").toLowerCase()] ?? null;
}

/* -------------------------------------------------------------------------- */
/* Instructions                                                               */
/* -------------------------------------------------------------------------- */

/** A lone incipit used as an instruction: "Ave.", "Ave Maria.", "Pater noster.", "Gloria Patri." */
const INCIPIT_RUBRICS: ReadonlyArray<[RegExp, string]> = [
  [/^Ave(?:\s+Maria)?\.?$/i, "hail-mary"],
  [/^Pater(?:\s+noster)?\.?$/i, "our-father"],
  [/^Gloria(?:\s+Patri)?\.?$/i, "glory-be"],
  [/^Credo\.?$/i, "apostles-creed"],
  [/^Salve(?:\s+Regina)?\.?$/i, "salve-regina"],
];

/**
 * The prayers an instruction names, in order, each with how many times to pray it.
 * "Begin with the Sign of the Cross, one Our Father, three Hail Marys" gives
 * sign-of-the-cross 1, our-father 1, hail-mary 3. Nothing else of the instruction is
 * said.
 */
export function prayersNamedIn(
  instruction: string,
  prayers: readonly MentionablePrayer[],
): Array<{ slug: string; count: number }> {
  const trimmed = instruction.trim();
  for (const [re, slug] of INCIPIT_RUBRICS) if (re.test(trimmed)) return [{ slug, count: 1 }];
  const { segments } = tokenizePrayerMentions(instruction, prayers);
  const out: Array<{ slug: string; count: number }> = [];
  segments.forEach((seg, i) => {
    if (!seg.prayer) return;
    const before = segments[i - 1]?.prayer ? "" : (segments[i - 1]?.text ?? "");
    const after = segments[i + 1]?.prayer ? "" : (segments[i + 1]?.text ?? "");
    const count = timesAfter(after) ?? countBefore(before) ?? 1;
    out.push({ slug: seg.prayer.slug, count: Math.max(1, Math.min(count, 60)) });
  });
  return out;
}

/* -------------------------------------------------------------------------- */
/* Lines                                                                      */
/* -------------------------------------------------------------------------- */

interface JudgedLine {
  /** The words of the line that are said (markers, symbols, notes, rubrics removed). */
  said: string;
  /** Prayers the line's instructions name, prayed after the line's words. */
  prayers: Array<{ slug: string; count: number }>;
  /** How many times the line's words are said ("(Thrice.)"). */
  times: number;
  /** The line was a heading: it ends a stanza's run of words like a blank line. */
  heading: boolean;
}

function judgeParsedLine(line: PrayerLine, prayers: readonly MentionablePrayer[]): JudgedLine {
  const judged: JudgedLine = { said: "", prayers: [], times: 1, heading: false };
  if (line.kind === "heading") return { ...judged, heading: true };
  if (line.kind === "note") return judged;
  if (line.kind === "rubric") {
    const text = line.runs.map((r) => r.text).join("");
    const repeat = repeatRubric(text);
    if (repeat == null) judged.prayers = prayersNamedIn(text, prayers);
    return judged;
  }
  const words: string[] = [];
  for (const run of line.runs) {
    if (run.role === "text" || run.role === "response") words.push(run.text);
    else if (run.role === "rubric") {
      const repeat = repeatRubric(run.text);
      if (repeat != null) judged.times = repeat;
      else judged.prayers.push(...prayersNamedIn(run.text, prayers));
    }
  }
  judged.said = words.join("").replace(/\s+/g, " ").trim();
  return judged;
}

/** Each raw line of a text, judged on its own (a line's kind rarely needs its neighbours). */
function judgeRawLines(text: string, prayers: readonly MentionablePrayer[]): JudgedLine[] {
  return text.split("\n").map((raw) => {
    if (!raw.trim()) return { said: "", prayers: [], times: 1, heading: false };
    const stanzas = parsePrayerText(raw);
    const lines = stanzas.flatMap((s) => s.lines);
    const merged: JudgedLine = { said: "", prayers: [], times: 1, heading: false };
    const said: string[] = [];
    for (const line of lines) {
      const j = judgeParsedLine(line, prayers);
      if (j.heading) merged.heading = true;
      if (j.said) said.push(j.said);
      merged.prayers.push(...j.prayers);
      if (j.times > 1) merged.times = j.times;
    }
    merged.said = said.join(" ");
    return merged;
  });
}

/**
 * The words a translated line says once its English line's instructions are taken
 * out. A Latin incipit ("Ave Maria.") is kept verbatim by the translator, so it is cut
 * where it stands; otherwise the line's last sentence goes when the English ended on
 * an instruction sentence.
 */
function sayTranslated(englishRaw: string, englishSaid: string, shownRaw: string): string {
  const shown = shownRaw.trim();
  if (!englishSaid) return "";
  if (foldForCompare(englishSaid) === foldForCompare(englishRaw)) return shown;
  // Instructions were cut from the English line: cut the same from the translation.
  const removed = englishRaw.replace(englishSaid, "").trim();
  if (removed && shown.endsWith(removed)) return shown.slice(0, -removed.length).trim();
  if (removed && shown.includes(removed))
    return shown.replace(removed, " ").replace(/\s+/g, " ").trim();
  const sentences = splitSentences(shown, /([.!?。！？])\s+/g);
  if (sentences.length > 1 && englishRaw.trim().endsWith(removed)) {
    return sentences.slice(0, -1).join(" ").trim();
  }
  return shown;
}

/**
 * Sentences, split after the given end marks. No lookbehind: a Safari before 16.4
 * cannot even parse one, and this module must never be what breaks a page.
 */
function splitSentences(text: string, ends: RegExp): string[] {
  return text
    .replace(ends, "$1\u0000")
    .split("\u0000")
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Split a stanza's words into clips no longer than MAX_CLIP_CHARS, at lines then sentences. */
export function splitForClips(lines: readonly string[], max = MAX_CLIP_CHARS): string[] {
  const clips: string[] = [];
  let current = "";
  const push = () => {
    if (current.trim()) clips.push(current.trim());
    current = "";
  };
  for (const line of lines) {
    const pieces = line.length > max ? splitSentences(line, /([.!?;:。！？；])\s+/g) : [line];
    for (const piece of pieces) {
      // A short opening ("O immaculate Mary!") stays with what follows it, even past
      // the limit: on its own it would be said as a fragment.
      const short = current.length > 0 && current.length < 60;
      if (current && current.length + 1 + piece.length > (short ? max * 1.8 : max)) push();
      current = current ? `${current} ${piece}` : piece;
    }
  }
  push();
  return clips;
}

export interface SpokenOptions {
  /** The language the text is in. */
  lang: AudioLang;
  /**
   * The stored English of a translated text, line for line, so instructions are found
   * by their English. Omit when the text is itself the stored text.
   */
  english?: string;
  /** The prayers the text may name; their names become the prayers themselves. */
  prayers: readonly MentionablePrayer[];
}

/**
 * The steps that pray `text`: its words, stanza by stanza and cut into clips, with the
 * prayers its instructions name prayed in place, and a pause between stanzas.
 */
export function spokenSteps(text: string, opts: SpokenOptions): SpokenStep[] {
  const shownLines = text.split("\n");
  const englishLines = opts.english?.split("\n");
  const aligned = !!englishLines && englishLines.length === shownLines.length;
  const judged = judgeRawLines(aligned ? opts.english! : text, opts.prayers);

  const steps: SpokenStep[] = [];
  let stanza: string[] = [];
  let stanzaLang: AudioLang = opts.lang;
  const flushStanza = () => {
    if (stanza.length === 0) return;
    for (const clip of splitForClips(stanza)) {
      const said = normalizeForSpeech(clip, stanzaLang);
      if (said) steps.push({ kind: "say", text: said, lang: stanzaLang });
    }
    stanza = [];
  };
  const pause = (ms: number) => {
    const last = steps[steps.length - 1];
    if (!last) return;
    if (last.kind === "pause") last.ms = Math.max(last.ms, ms);
    else steps.push({ kind: "pause", ms });
  };

  judged.forEach((line, i) => {
    const raw = shownLines[i] ?? "";
    if (!raw.trim() || line.heading) {
      flushStanza();
      pause(STANZA_PAUSE_MS);
      return;
    }
    const said = aligned ? sayTranslated(englishLines![i] ?? "", line.said, raw) : line.said;
    // A line the translator has not reached yet is still the English, and is said in English.
    const lineLang: AudioLang =
      aligned && opts.lang !== "en" && raw.trim() === (englishLines![i] ?? "").trim()
        ? "en"
        : opts.lang;
    if (said && lineLang !== stanzaLang) {
      flushStanza();
      stanzaLang = lineLang;
    }
    if (said) for (let n = 0; n < line.times; n++) stanza.push(said);
    if (line.prayers.length > 0) {
      flushStanza();
      for (const p of line.prayers) {
        pause(PRAYER_PAUSE_MS);
        steps.push({ kind: "prayer", slug: p.slug, count: p.count });
      }
      pause(PRAYER_PAUSE_MS);
    }
  });
  flushStanza();
  while (steps[steps.length - 1]?.kind === "pause") steps.pop();
  return steps;
}
