/**
 * What a prayer's text says aloud.
 *
 * The audio LITERALLY PRAYS THE PRAYER and nothing else (the owner's rule): no
 * instructions, rubrics, headings, notes, citations, references or placeholders are
 * read aloud, and a prayer the text tells the reader to pray is prayed in full, as many
 * times as it says. What each line is comes first from `parsePrayerText`, the reading
 * the page itself is set by; on top of it these rules decide what is said (English
 * words are judged in English, Latin ones in Latin):
 *
 *   1. "etc." is never said. A prayer named before it ("Glory be, etc.", "Pater, Ave,
 *      &c.") is prayed in full; the opening of a collect's conclusion ("Through our
 *      Lord Jesus Christ, etc.", "Per Dominum nostrum, etc.") is said whole; any other
 *      opening ("O victim, etc.", "Si est dolor, etc.") repeats, in full, the passage it
 *      opens earlier in the same text, and says nothing when there is none.
 *   2. Prayers named as instructions are prayed with their counts: "Pater, Ave, Gloria,
 *      thrice" is the three together three times, "Five Our Fathers and Hail Marys" five
 *      pairs, "Ave Maria thrice, and after each:" a Hail Mary before each saying of what
 *      follows; "Then say three times," says what follows three times.
 *   3. Placeholders are dropped ("N.", "St. ——", "(or she)", "his (her)", "[or trial]");
 *      where the reader names a request ("(state your intention)") the audio is silent
 *      for a moment instead.
 *   4. Citations are dropped ("(John xvi. 24)", "Ps. 66.", "(St Thomas of Villanova)").
 *   5. Headings are dropped (title lines, "Act of Thanksgiving.", "Invocation.—", psalm
 *      titles), and so are instructions written as prose ("For Christmas Day and its
 *      Octave.", "On the single bead, pray the Our Father." — whose Our Father is prayed)
 *      and the narrative that introduces a canticle ("Then Judith sung this canticle to
 *      the Lord, saying:").
 *   6. A refrain marked "R." at a verse's end is said there in full.
 *   7. A clip never cuts a sentence: a stanza's lines are joined (a line with no closing
 *      punctuation gets a comma before a capitalised line), split into sentences and
 *      packed whole into clips of about MAX_CLIP_CHARS; only a sentence longer than
 *      LONG_SENTENCE_CHARS is cut, at the semicolon or comma nearest its middle.
 *
 * A text shown in the reader's language keeps the stored English line for line
 * (src/lib/translation keeps every line break), so a line is judged by its English and
 * said in the reader's words: a translated "Padre Nuestro, Ave María, Gloria." is an
 * instruction because its English line is one.
 *
 * A few texts no general rule can read right are listed in OVERRIDES, by page.
 *
 * Pure: no I/O, no React, and no regex lookbehind (a Safari before 16.4 cannot even
 * parse one, and this module must never be what breaks a page).
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

/** Pauses, in milliseconds: between stanzas, between whole prayers, for a request. */
export const STANZA_PAUSE_MS = 700;
export const PRAYER_PAUSE_MS = 1100;
export const INTENTION_PAUSE_MS = 3000;

/** Whole sentences are packed into clips of about this many characters. */
export const MAX_CLIP_CHARS = 350;
/** Only a sentence longer than this is cut, at the semicolon or comma nearest its middle. */
export const LONG_SENTENCE_CHARS = 600;
/** A clip this short ("O immaculate Mary!") always takes the sentence after it. */
const SHORT_OPENING_CHARS = 60;

/** Marks, in words being read, the place where the reader names their own request. */
const INTENTION = "‖";

/* -------------------------------------------------------------------------- */
/* Words a voice would misread                                                */
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
    .replace(/[̓̔̄̆ͅ]/g, "")
    .replace(/[̀͂]/g, "́")
    .replace(/́(?=́)/g, "")
    .normalize("NFC");
}

/** Letters only, for "does this text open with these words?". */
export function foldForCompare(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/œ/g, "oe")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/**
 * A reference in brackets: "(John xvi. 24)", "(Isaiah lxiv. 4; I Corinthians ii. 9)",
 * "(Lk 1:28)", "(1 Cor. 13)", or an attribution: "(St Thomas of Villanova)", "(S. Aug.
 * Sermo de Sanct.)", "(\"No creature …\" B. Albertus Magnus)". It is not prayed.
 */
function isCitation(inner: string): boolean {
  const t = inner.trim();
  if (
    /^(?:["“][^"”]*["”]\s*)?(?:St|S|SS|Sts|B|Bl|Ven|Saint|Pope|cf|Cf|see|See|Sermo|Serm|Hom|Ep|Ps|Lib|lib|cap)\.?\s/.test(
      t,
    )
  ) {
    return true;
  }
  if (/\d+\s*[:,.]\s*\d+/.test(t)) return true;
  return /^(?:(?:[1-4]|I{1,3})\s*)?\p{Lu}\p{L}*\.?(?:\s+\p{Lu}\p{L}*\.?)?\s+(?:[ivxlc]+|[IVXLC]+|\d+)(?![\p{L}])[\s\divxlcIVXLC.,:;–-]*(?:;.*)?$/u.test(
    t,
  );
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
  fourteen: 14,
  fifteen: 15,
  twenty: 20,
  thirty: 30,
  thirty_three: 33,
  fifty: 50,
};

const TIMES_WORDS: Record<string, number> = { once: 1, twice: 2, thrice: 3 };

const ORDINAL_WORDS: Record<string, number> = {
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  tenth: 10,
};

function countWord(word: string): number | null {
  const w = word.toLowerCase().replace(/-/g, "_");
  if (/^\d{1,2}$/.test(w)) return Number(w);
  return COUNT_WORDS[w] ?? TIMES_WORDS[w] ?? null;
}

/** An instruction that only repeats: "(Thrice.)", "(3 times)", "(Repeat three times.)". */
function repeatCount(text: string): number | null {
  const t = text
    .trim()
    .replace(/^[([{]\s*/, "")
    .replace(/\s*[)\]}]\s*[.:;,]?$/, "")
    .replace(/[.:;,]+$/, "")
    .trim();
  const m =
    /^(?:(?:repeat|say|said|recite)\s+(?:(?:this|it)\s+)?)?(?:(once|twice|thrice)|(\w+(?:-\w+)?)\s+times|(\d{1,2})\s*x|x\s*(\d{1,2}))$/i.exec(
      t,
    );
  if (!m) return null;
  if (m[1]) return TIMES_WORDS[m[1].toLowerCase()] ?? null;
  if (m[2]) return countWord(m[2]);
  return Number(m[3] ?? m[4]);
}

/* -------------------------------------------------------------------------- */
/* Brackets                                                                   */
/* -------------------------------------------------------------------------- */

type BracketKind = "drop" | "keep" | "intention" | "repeat" | "prayers";

/** Where the reader names their own request: "(state your intention)", "[Specify it.]". */
const REQUEST_WORDS =
  /\b(?:intentions?|requests?|petitions?|needs?|favou?rs? needed|grace required|specify|mention|insert|recall|recommend yourself|name (?:it|them|your)|express (?:his|her|the|their) name)\b/i;

/** A pronoun given for the other sex: "his (her)", "he (or she)". */
const PRONOUN_ALTERNATIVE =
  /^(?:or\s+)?(?:he|she|him|her|his|hers|they|them|their|theirs|himself|herself|themselves|it|its)$/i;

/**
 * What a bracket holds, and so what becomes of it. Square brackets with words that are
 * not an instruction are an editor's insertion and are read ("Christ in the poop
 * [deck]"); so is a round bracket that is part of the prayer's own sentence ("(for Thou
 * hast given us all things;)").
 */
function classifyBracket(inner: string, square: boolean): BracketKind {
  const t = inner
    .trim()
    .replace(/[.:;,]+$/, "")
    .trim();
  if (!t || /^N\.?(?:\s*N\.?)?$/.test(t) || /^(?:name|s|es)$/i.test(t)) return "drop";
  if (isCitation(t)) return "drop";
  if (repeatCount(t) != null) return "repeat";
  if (/^request$/i.test(t) || REQUEST_WORDS.test(t) || /^here\b/i.test(t) || /\bpause\b/i.test(t)) {
    return "intention";
  }
  if (/^(?:or|vel)\b/i.test(t) || /^(?:famul|defunct)/i.test(t)) return "drop";
  if (!square && PRONOUN_ALTERNATIVE.test(t)) return "drop";
  if (/^if\s+(?:he|she|they|said|offered)\b/i.test(t)) return "drop";
  if (t.split(/\s+/).length <= 4 && /\s(?:or|vel)\s/i.test(t)) return "drop";
  if (/\b(?:as above|as before)\b/i.test(t) && !/\bif\b/i.test(t)) return "prayers";
  if (
    /\b(?:repeat|kneel|genuflect|sprinkled|silently|in the case of|if said|said for|step \d|decades?|beads?)\b/i.test(
      t,
    )
  ) {
    return "drop";
  }
  if (/^commemoration$/i.test(t)) return "drop";
  const hits = findPrayerNames(t, []);
  if (hits.length > 0 && isPointer(t, hits)) return "prayers";
  return "keep";
}

/**
 * Brackets read as `classifyBracket` says: kept words lose their brackets, the rest
 * goes. With `marks`, the place of a request is kept as INTENTION for a silence.
 */
function stripBrackets(text: string, marks: boolean): string {
  return text.replace(/\(([^()]*)\)|\[([^[\]]*)\]/g, (_whole, round?: string, sq?: string) => {
    const inner = round ?? sq ?? "";
    const kind = classifyBracket(inner, sq !== undefined);
    if (kind === "keep") return inner;
    if (kind === "intention") return marks ? ` ${INTENTION} ` : " ";
    return " ";
  });
}

/* -------------------------------------------------------------------------- */
/* Normalising words for a voice                                              */
/* -------------------------------------------------------------------------- */

/** Spaces and punctuation left right after words were taken out. */
function tidy(text: string): string {
  return text
    .replace(/\s+([,.;:!?…])/g, "$1")
    .replace(/,(?:\s*,)+/g, ",")
    .replace(/,\s*([;:.!?])/g, "$1")
    .replace(/([;:])\s*,/g, "$1")
    .replace(/:\s*\./g, ".")
    .replace(/\(\s*\)|\[\s*\]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[,;:.]\s*/, "");
}

/**
 * Words made ready to read: placeholders, references and printed signs go, and the
 * abbreviations a voice would misread are written out ("St Joseph" is "Saint Joseph",
 * "viz." is "namely", a pope's number is said). "etc.", a responsory's "*" and the
 * INTENTION mark stay, for the rules that read them.
 */
function prepareWords(text: string, lang: AudioLang): string {
  let s = text
    .replace(/&c\.?/g, "etc.")
    .replace(/[✠✝✞†‡☩]/g, " ")
    .replace(/[℣℟]\.?/g, " ")
    // The blank for a name: "My dear patron, St. ——, …", "Pope ________".
    .replace(/(?:\s*\b(?:Sts?|SS|Saint)\.?)?\s*(?:[—–]{2,}|_{2,})/g, " ")
    .replace(/\s*\.\s+\.\s+\.(?:\s+\.)*/g, "…")
    .replace(/\.{3,}/g, "…")
    // An attribution after a dash: "…crown him when he is victorious.”—Saint Aug. in Ps. 32."
    .replace(
      /\s*[—–]\s*(?:Saint|St\.?|S\.|Bl\.?|Blessed|Ven\.?)\s+[\p{L}.]+(?:\s+[\p{L}.\d]+){0,6}\.?\s*$/u,
      "",
    )
    // A psalm's label before its verse: "… with joy. Ps. 66. Deus misereatur nostri".
    .replace(/(^|[.!?:;]\s+)Ps\.\s*(?:\d+\.?\s+)?(?=\p{Lu})/gu, "$1")
    // Name placeholders: "for us, for N., and for all", "the grace of N—", "thy servant N.".
    .replace(/(,\s*)(?:for|and|with|to|of|on|upon)\s+N\.(?:\s*N\.)?,\s*/g, "$1")
    .replace(/\s+(?:of|for)\s+N(?:\.|[—–]+)(?=[\s,;.:]|$)/g, "")
    .replace(/(\p{L})\s+N\.(?:\s?N\.)?(?=\s+\p{Lu})/gu, "$1.")
    .replace(/(^|\s)N\.(?:\s?N\.)?(?=[\s,.;:]|$)/g, "$1")
    .replace(/(^|\s)N[—–]+/g, "$1")
    .replace(/\s*\/\s+(?=\S)/g, ", ");
  if (lang === "en") {
    s = s
      .replace(/\bSts\.?\s+(?=\p{Lu})/gu, "Saints ")
      .replace(/\bSS\.\s+(?=\p{Lu})/gu, "Saints ")
      .replace(/\bSt\.?\s+(?=\p{Lu})/gu, "Saint ")
      .replace(/\bBl\.\s+(?=\p{Lu})/gu, "Blessed ")
      .replace(/\bVen\.\s+(?=\p{Lu})/gu, "Venerable ")
      .replace(/\bMt\.?\s+(?=\p{Lu})/gu, "Mount ")
      .replace(/\bB\.\s?V\.\s?M\.?/g, "Blessed Virgin Mary")
      .replace(/\bviz\.\s*,?\s*/g, "namely ")
      .replace(/\bi\.\s?e\.\s*,?\s*/g, "that is, ")
      .replace(/\b([Tt])hro'/g, "$1hrough")
      .replace(/\b([Tt])ho'/g, "$1hough")
      .replace(/æ/g, "ae")
      .replace(/Æ/g, "Ae")
      .replace(/œ/g, "oe")
      .replace(/Œ/g, "Oe")
      .replace(/\s&\s/g, " and ")
      .replace(
        /\b(\p{Lu}\p{Ll}+) (II|III|IV|VI|VII|VIII|IX|XI|XII|XIII|XIV|XV|XVI|XXIII)\b(?:\.(?=\s*[,;:]|\s+\p{Ll}))?/gu,
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
  return tidy(s);
}

/** The last of it: no "etc.", no responsory "*", no marks. */
function finishWords(text: string): string {
  return tidy(
    text
      .replace(/,?\s*\betc\b\.?(?:,?\s*as\s+(?:above|before))?/gi, "")
      .replace(/\s*\*\s*/g, " ")
      .split(INTENTION)
      .join(" ")
      .replace(/(?:^|\s)R\.$/, ""),
  );
}

/**
 * Words as a voice should read them. Safe on any text and on its own output: the
 * builders run every clip through it.
 */
export function normalizeForSpeech(text: string, lang: AudioLang): string {
  return finishWords(prepareWords(stripBrackets(text, false), lang));
}

/* -------------------------------------------------------------------------- */
/* Sentences and clips                                                        */
/* -------------------------------------------------------------------------- */

/** A full stop after these is an abbreviation's, not a sentence's: "St.", "Mt.", "B. V. M.". */
const ABBREVIATION_BEFORE_DOT =
  /(?:^|[\s("“‘'[])(?:St|Sts|SS|Ste|Sta|Sto|Bl|Ven|Mt|Mr|Mrs|Dr|Fr|Rev|Br|Sr|No|Nos|vs|cf|Cf|viz|ibid|Ps|Pss|ch|vol|pp?|[A-Z])$/;

/** Does a sentence open here? Not before a small letter: "O Mary! which you exhibited". */
function opensSentence(next: string): boolean {
  const ch = next.replace(/^["'“‘«([*‖\s]+/, "").charAt(0);
  return !ch || !/\p{Ll}/u.test(ch);
}

/**
 * Sentences: split after ". ! ? …" (and ";" in Greek, its question mark; "。！？" in
 * Chinese) where a new sentence opens, never after an abbreviation, never before a
 * small letter. A semicolon or colon never ends a sentence.
 */
export function splitSentences(text: string, lang: AudioLang = "en"): string[] {
  const out: string[] = [];
  let start = 0;
  const re = /[.!?;…。！？]["'”’»)\]]*/g;
  for (const m of text.matchAll(re)) {
    const mark = m[0].charAt(0);
    const at = m.index ?? 0;
    const end = at + m[0].length;
    const rest = text.slice(end);
    const cjk = mark === "。" || mark === "！" || mark === "？";
    if (!cjk) {
      if (mark === ";" && lang !== "el") continue;
      if (rest && !/^\s/.test(rest)) continue;
      if (!opensSentence(rest)) continue;
      if (mark === "." && ABBREVIATION_BEFORE_DOT.test(text.slice(start, at))) continue;
    }
    const piece = text.slice(start, end).trim();
    if (piece) out.push(piece);
    start = end;
  }
  const tail = text.slice(start).trim();
  if (tail) out.push(tail);
  return out;
}

/** A line already ends its thought, or leads into the next: it needs no comma. */
const CLOSING_PUNCTUATION = /[.!?;:,…—–\-)\]"”’'»*‖]$/;

/**
 * A stanza's lines as one text. A line with no closing punctuation before a line that
 * opens with a capital is a verse that pauses there: it gets a comma, so the voice does
 * not run "your glory proclaim On earth we" together.
 */
export function joinLines(lines: readonly string[]): string {
  let out = "";
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (!out) {
      out = line;
      continue;
    }
    const pause = !CLOSING_PUNCTUATION.test(out) && /^["'“‘(]*\p{Lu}/u.test(line);
    out += pause ? `, ${line}` : ` ${line}`;
  }
  return out;
}

/** A sentence too long for one clip, cut at the semicolon (else comma) nearest its middle. */
function splitLongSentence(sentence: string, long: number): string[] {
  if (sentence.length <= long) return [sentence];
  const mid = sentence.length / 2;
  let best = -1;
  let bestStrong = -1;
  for (const m of sentence.matchAll(/[;:,]\s+/g)) {
    const at = (m.index ?? 0) + m[0].length;
    if (at < 20 || at > sentence.length - 20) continue;
    const off = Math.abs(at - mid);
    if (m[0].charAt(0) !== "," && off < sentence.length / 4) {
      if (bestStrong < 0 || off < Math.abs(bestStrong - mid)) bestStrong = at;
    }
    if (best < 0 || off < Math.abs(best - mid)) best = at;
  }
  let cut = bestStrong >= 0 ? bestStrong : best;
  if (cut < 0) cut = sentence.lastIndexOf(" ", Math.round(mid));
  if (cut <= 0) return [sentence];
  return [
    ...splitLongSentence(sentence.slice(0, cut).trim(), long),
    ...splitLongSentence(sentence.slice(cut).trim(), long),
  ];
}

/**
 * A stanza's words as clips: whole sentences packed up to `max` characters. A sentence
 * is cut only when it alone is far too long (LONG_SENTENCE_CHARS for the default
 * `max`), and a short opening stays with the sentence after it.
 */
export function splitForClips(
  lines: readonly string[],
  max = MAX_CLIP_CHARS,
  lang: AudioLang = "en",
): string[] {
  const long = Math.max(max, Math.round((max * LONG_SENTENCE_CHARS) / MAX_CLIP_CHARS));
  const sentences = splitSentences(joinLines(lines), lang).flatMap((s) =>
    splitLongSentence(s, long),
  );
  const clips: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    if (
      current &&
      current.length >= SHORT_OPENING_CHARS &&
      current.length + 1 + sentence.length > max
    ) {
      clips.push(current);
      current = sentence;
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
  }
  if (current) clips.push(current);
  return clips;
}

/* -------------------------------------------------------------------------- */
/* Names of prayers                                                           */
/* -------------------------------------------------------------------------- */

/**
 * The names rubrics give prayers, beyond their titles: Latin incipits ("Pater, Ave,
 * Gloria"), plurals ("three Glorys"), traditional names ("Litany of Loretto").
 */
const NAME_ALIASES: ReadonlyArray<readonly [RegExp, string]> = [
  [/\b(?:Our\s+Fathers?|Paters?(?:\s+[Nn]osters?)?|Lord's\s+Prayer)\b/g, "our-father"],
  [/\b(?:Hail\s+Marys?|Ave\s+Marias?|Aves?)\b/g, "hail-mary"],
  [
    /\b(?:Glory\s+[Bb]e\s+to\s+the\s+Father|Glory\s+[Bb]e|Gloria\s+Patris?|Glorias?|Glorys|Glories|Doxology)\b/g,
    "glory-be",
  ],
  [/\b(?:Apostles'?\s+Creed|Apostle's\s+Creed|Creed|Credo)\b/g, "apostles-creed"],
  [/\b(?:Requiem\s+(?:ae|æ)ternam|Requiem|Eternal\s+[Rr]est)\b/g, "eternal-rest"],
  [/\b(?:Hail,?\s+[Hh]oly\s+Queen|Salve,?\s+Regina|Salve)\b/g, "salve-regina"],
  [/\bMemorare\b/g, "memorare"],
  [/\bAngelus\b/g, "angelus"],
  [/\b[Aa]ct\s+of\s+[Cc]ontrition\b/g, "act-of-contrition"],
  [/\bFatima\s+Prayer\b/g, "fatima-prayer"],
  [/\bSign\s+of\s+the\s+(?:Holy\s+)?Cross\b/g, "sign-of-the-cross"],
  [/\bMagnificat\b/g, "magnificat"],
  [
    /\b(?:Benedictus|Canticle\s+of\s+Zach(?:ary|arias|ariah)|Canticle\s+of\s+Zechariah)\b/g,
    "benedictus-canticle-of-zechariah",
  ],
  [/\bNunc\s+[Dd]imittis\b/g, "nunc-dimittis"],
  [/\bDe\s+[Pp]rofundis\b/g, "de-profundis"],
  [/\bMiserere\b/g, "psalm-50"],
  [/\bTe\s+Deum\b/g, "te-deum"],
  [
    /\b(?:Veni,?\s+Creator(?:\s+Spiritus)?|Come,?\s+O\s+Creator\s+Spirit(?:,?\s+blest)?)\b/g,
    "veni-creator-spiritus",
  ],
  [/\bStabat\s+Mater\b/g, "stabat-mater"],
  [/\bTantum\s+[Ee]rgo\b/g, "tantum-ergo"],
  [
    /\bLitany\s+of\s+(?:Loreto|Loretto|the\s+Blessed\s+Virgin(?:\s+Mary)?|Our\s+Lady)\b/g,
    "litany-of-the-blessed-virgin-mary",
  ],
  [/\bLitany\s+of\s+(?:Saint|St\.?)\s+Joseph\b/g, "litany-of-saint-joseph"],
  [/\bLitany\s+of\s+the\s+(?:Holy\s+)?Angels\b/g, "litany-of-the-holy-angels"],
  [/\bLitany\s+of\s+(?:the\s+|All\s+)?Saints\b/g, "litany-of-the-saints"],
  [
    /\bLitany\s+of\s+the\s+Sacred\s+Heart(?:\s+of\s+Jesus)?\b/g,
    "litany-of-the-sacred-heart-of-jesus",
  ],
  [
    /\bLitany\s+of\s+the\s+(?:Most\s+)?Holy\s+Name(?:\s+of\s+Jesus)?\b/g,
    "litany-of-the-holy-name-of-jesus",
  ],
  [/\bLitany\s+of\s+the\s+(?:Most\s+)?Precious\s+Blood\b/g, "litany-of-the-precious-blood"],
  [/\bLitany\s+of\s+the\s+Holy\s+(?:Ghost|Spirit)\b/g, "litany-of-the-holy-spirit"],
];

/**
 * The prayers beyond the building blocks that texts tell the reader to pray by name.
 * The server loads these for a text that names them, so they can be prayed in full.
 */
export function namedPrayerSlugsIn(text: string): string[] {
  const out = new Set<string>();
  for (const [re, slug] of NAME_ALIASES) if (new RegExp(re.source).test(text)) out.add(slug);
  return [...out];
}

/** Plural forms: "Hail Marys", "Paters", "Glorias", "three Glorys". */
const PLURAL_NAME = /(?:Fathers|Marys|Marias|Paters|nosters|Aves|Glorias|Patris|Glorys|Glories)$/i;

interface NameHit {
  start: number;
  end: number;
  slug: string;
  plural: boolean;
}

/** Where `text` names prayers: by the names rubrics use, and by the titles of `prayers`. */
function findPrayerNames(
  text: string,
  prayers: readonly MentionablePrayer[],
  self?: string,
): NameHit[] {
  const hits: NameHit[] = [];
  for (const [re, slug] of NAME_ALIASES) {
    for (const m of text.matchAll(re)) {
      const start = m.index ?? 0;
      hits.push({ start, end: start + m[0].length, slug, plural: PLURAL_NAME.test(m[0]) });
    }
  }
  if (prayers.length > 0) {
    let at = 0;
    for (const seg of tokenizePrayerMentions(text, prayers).segments) {
      if (seg.prayer)
        hits.push({ start: at, end: at + seg.text.length, slug: seg.prayer.slug, plural: false });
      at += seg.text.length;
    }
  }
  hits.sort((a, b) => a.start - b.start || b.end - a.end);
  const out: NameHit[] = [];
  for (const h of hits) {
    const last = out[out.length - 1];
    if (last && h.start < last.end) continue;
    // "Canticle of Zachary (Benedictus)" names one prayer, twice.
    if (last && last.slug === h.slug && /^\s*\($/.test(text.slice(last.end, h.start))) {
      if (text.charAt(h.end) === ")") last.end = h.end + 1;
      continue;
    }
    out.push(h);
  }
  return self ? out.filter((h) => h.slug !== self) : out;
}

interface Named {
  slug: string;
  count: number;
}

interface HitCounts {
  hit: NameHit;
  before: number | null;
  beforeLen: number;
  article: boolean;
  after: number | null;
  afterLen: number;
}

/** The count written before a name ("three Hail Marys", "nine times the Hail Mary") and after it. */
function countsAround(text: string, hit: NameHit): HitCounts {
  const out: HitCounts = {
    hit,
    before: null,
    beforeLen: 0,
    article: false,
    after: null,
    afterLen: 0,
  };
  const pre = text.slice(0, hit.start);
  const times = /\b(\w+(?:-\w+)?)\s+times\s+(?:the\s+)?$/i.exec(pre);
  if (times && countWord(times[1] ?? "") != null) {
    out.before = countWord(times[1] ?? "");
    out.beforeLen = times[0].length;
  } else {
    const word = /\b(\w+(?:-\w+)?)\s+$/.exec(pre);
    const w = word?.[1]?.toLowerCase() ?? "";
    if (w === "the") {
      out.article = true;
      out.beforeLen = word?.[0].length ?? 0;
    } else if (word && countWord(w) != null) {
      out.before = countWord(w);
      out.beforeLen = word[0].length;
      out.article = w === "a" || w === "an";
    }
  }
  const post = text.slice(hit.end);
  const after =
    /^\s*,?\s*(?:etc\.?,?\s*)?(?:(once|twice|thrice)|(\w+(?:-\w+)?)\s+times|\(?(\d{1,2})\s*x\)?|x\s*(\d{1,2}))(?![\w])/i.exec(
      post,
    );
  if (after) {
    const n = after[1]
      ? (TIMES_WORDS[after[1].toLowerCase()] ?? null)
      : after[2]
        ? countWord(after[2])
        : Number(after[3] ?? after[4]);
    if (n != null && Number.isFinite(n)) {
      out.after = n;
      out.afterLen = after[0].length;
    }
  }
  return out;
}

/** What may stand between two names of one list: "Pater, Ave and Gloria", "—Hail Mary". */
const CONNECTOR = /^[\s,;—–-]*(?:(?:and|then|with|or|also)\s+)?(?:(?:the|a|an)\s+)?$/i;

/**
 * The prayers a run of names asks for, in the order prayed. A count after the last of
 * several names is the whole set's ("Pater, Ave, Gloria, thrice"), as is a count before
 * the first that the next names share ("Five Our Fathers and Hail Marys"); a count of a
 * name's own is its alone ("one Our Father, three Hail Marys and the Glory Be").
 */
function namedSequence(text: string, hits: readonly NameHit[]): Named[] {
  const info = hits.map((h) => countsAround(text, h));
  const runs: HitCounts[][] = [];
  info.forEach((cur, i) => {
    const prev = info[i - 1];
    if (prev) {
      const from = prev.hit.end + prev.afterLen;
      const to = cur.hit.start - cur.beforeLen;
      if (to >= from && CONNECTOR.test(text.slice(from, to))) {
        runs[runs.length - 1]!.push(cur);
        return;
      }
    }
    runs.push([cur]);
  });
  const out: Named[] = [];
  const push = (set: readonly HitCounts[], times: number) => {
    const n = Math.max(1, Math.min(times, 60));
    if (set.length === 1) {
      out.push({ slug: set[0]!.hit.slug, count: n });
      return;
    }
    for (let k = 0; k < n; k++) for (const m of set) out.push({ slug: m.hit.slug, count: 1 });
  };
  for (const run of runs) {
    const last = run[run.length - 1]!;
    const shared =
      run.length > 1 &&
      last.after != null &&
      run.slice(0, -1).every((r) => r.after == null && (r.before == null || r.article));
    if (shared) {
      push(run, last.after ?? 1);
      continue;
    }
    let i = 0;
    while (i < run.length) {
      const head = run[i]!;
      if (head.after != null) {
        push([head], head.after);
        i++;
        continue;
      }
      const set = [head];
      let j = i + 1;
      if (head.before != null) {
        while (j < run.length) {
          const next = run[j]!;
          if (next.after != null || next.before != null || next.article) break;
          set.push(next);
          j++;
        }
      }
      push(set, head.before ?? 1);
      i = j;
    }
  }
  return out;
}

/** A lone incipit used as an instruction: "Ave.", "Pater noster.", "Gloria Patri.", "Glory." */
const INCIPIT_RUBRICS: ReadonlyArray<[RegExp, string]> = [
  [/^Ave(?:\s+Maria)?\.?$/i, "hail-mary"],
  [/^Pater(?:\s+noster)?\.?$/i, "our-father"],
  [/^Gloria(?:\s+Patri)?\.?$/i, "glory-be"],
  [/^Glory(?:\s+be)?\.?$/i, "glory-be"],
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
  return namedSequence(trimmed, findPrayerNames(trimmed, prayers));
}

/** Second-person words, or a call ("O Lord", "O most holy …"): words spoken TO someone. */
const ADDRESS =
  /\b(?:[Tt]hee|[Tt]hou|[Tt]hy|[Tt]hine|[Tt]hyself)\b|\bO\s+\p{Lu}|\bO\s+(?:my|most|holy|blessed|glorious|sweet|dear|great|loving|good)\b/u;

/** "in honour of the Passion", "for the holy souls", "to the most holy Blood": why, not words. */
const DEDICATION =
  /\b(?:in\s+(?:honou?r|memory|reparation|thanksgiving|union)\b|for\s+the\s+(?:holy\s+|poor\s+|suffering\s+)?souls\b|for\s+the\s+(?:dying|departed|sick|intentions?|Pope|Sovereign\s+Pontiff|Church|conversion)\b|to\s+(?:the\s+)?(?:most\s+|Most\s+)?(?:holy|Holy|Blessed|blessed|Sacred|Immaculate|eternal|Eternal|adorable)\b)/;

/** Words a list of prayers to pray may have around its names. */
const POINTER_FILLER =
  /\b(?:and|or|then|with|the|a|an|also|again|each|after|followed|by|say|said|pray|recite|add|once|twice|thrice|times|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|twenty|thirty|fifty|daily|etc|as|above|before|here|x)\b|\d+/gi;

/**
 * A sentence that only names prayers to pray: "Pater, Ave, Gloria, thrice.", "Five
 * Paters, Aves, and Glorias, in honour of the passion.", "Glory be, etc.", "The
 * Memorare." Never words of a prayer ("Glory be to the Father, and to the Son"), never a
 * refrain that repeats a name ("Ave, Ave, Ave Maria!").
 */
function isPointer(text: string, hits: readonly NameHit[]): boolean {
  if (hits.length === 0 || /!/.test(text) || /,\s*$/.test(text)) return false;
  for (let i = 1; i < hits.length; i++) {
    const a = hits[i - 1]!;
    const b = hits[i]!;
    if (
      a.slug === b.slug &&
      !/\d|\b(?:times|once|twice|thrice)\b/i.test(text.slice(a.end, b.start))
    ) {
      return false;
    }
  }
  let rest = "";
  let at = 0;
  for (const h of hits) {
    rest += `${text.slice(at, h.start)} `;
    at = h.end;
  }
  rest += text.slice(at);
  if (ADDRESS.test(rest)) return false;
  const dedication = DEDICATION.exec(rest);
  if (dedication) rest = rest.slice(0, dedication.index);
  rest = rest
    .replace(
      /[—–]\s*(?:hymn|versicles?|responses?|prayers?|antiphons?|collects?|of|the|saint|and|[,\s])+\.?\s*$/i,
      " ",
    )
    .replace(POINTER_FILLER, " ");
  return !/\p{L}/u.test(rest);
}

/* -------------------------------------------------------------------------- */
/* Instructions, headings, narrative                                          */
/* -------------------------------------------------------------------------- */

/** How an instruction's sentence opens. */
const INSTRUCTION_OPENER =
  /^(?:Then|Next|Afterwards|After\s+(?:this|that|which|each|every|the)|Here|Now|Finally|Lastly|At\s+the\s+(?:beginning|end|close)|On\s+(?:the|each|every)|Holding|Still\s+on|Starting\s+(?:on|with)|While|During|Before|Kneel|Stand|Rise|Make|Say|Pray|Recite|Repeat|Add|Sing|Conclude|Begin|End|Finish|Close|Announce|Meditate|Reflect|Pause|Mention|State|Specify|Offer|Honou?r|Profess|Continue|Adore|Passing)\b/i;

/** What an instruction speaks of. */
const INSTRUCTION_WORDS =
  /\b(?:say|says|said|saying|pray|prays|prayed|praying|recite|recited|repeat|repeated|add|added|sing|sung|follows?|followed|announce|kneel|genuflect|make|profess|honou?r|meditate|mention|omit|omitted|beads?|decades?|crucifix|times|once|twice|thrice|following|as above|as before|litany|hymn|visit|reflection|call to mind|adore)\b/i;

/** "For Christmas Day and its Octave.": when a part is said, not a word of it. */
const SEASONAL =
  /^(?:For|During|In|From|On|Throughout)\s+(?:the\s+)?(?:[A-Z][\w']*\s+){0,4}(?:and\s+its\s+Octave|Octave|Advent|Lent|Paschaltide|Paschal\s+[Tt]ime|Eastertide|Christmastide|Passiontide|Septuagesima|Pentecost)\b[^.!?]{0,40}\.?$/;

/**
 * An English sentence that tells the reader what to do, written as prose: "On the single
 * bead, pray the Our Father.", "Here follows the Litany.", "The Alleluia is omitted
 * during the rest of the year.", "Then, …, let us say:". Words spoken to God or a saint
 * are never one ("Pray for us, O holy Mother of God").
 */
function isInstruction(text: string, namesPrayers: boolean): boolean {
  const t = text.trim();
  if (ADDRESS.test(t)) return false;
  if (
    /^(?:Pray(?:,|\s+for\b)|Make\s+(?:me|us|my|our|haste)\b|Say\s+to\b|Let\s+us\s+pray\b|Repeat\s+after\b)/i.test(
      t,
    )
  ) {
    return false;
  }
  if (/^Let\s+us\s+(?:now\s+)?(?:meditate|consider|reflect|give\s+praise|turn)\b/i.test(t))
    return true;
  if (/^(?:The\s+)?Litany\b/.test(t)) return true;
  if (
    /^(?:Say|Pray|Recite|Repeat|Add|Sing)\b/i.test(t) &&
    !namesPrayers &&
    !/\b(?:times|once|twice|thrice|following|daily)\b/i.test(t)
  ) {
    return false;
  }
  if (INSTRUCTION_OPENER.test(t) && INSTRUCTION_WORDS.test(t)) return true;
  if (
    /\b(?:is|are)\s+(?:to\s+be\s+)?(?:omitted|said|added|repeated|recited|sung|prayed)\b/i.test(t)
  ) {
    return true;
  }
  if (/\b(?:beads?|decades?)\b/i.test(t)) return true;
  if (SEASONAL.test(t)) return true;
  return /^(?:During|Before|After)\b.{0,60}\b(?:Mass|Communion|Confession|Office|meals?)\.?$/.test(
    t,
  );
}

/** Words that stay small in a title. */
const TITLE_SMALL_WORDS = new Set([
  "a",
  "an",
  "the",
  "of",
  "to",
  "in",
  "on",
  "at",
  "by",
  "for",
  "and",
  "or",
  "with",
  "from",
  "into",
  "upon",
  "as",
]);

function titleCased(text: string): boolean {
  const words = text
    .replace(/[—–-]/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""))
    .filter(Boolean);
  if (words.length === 0 || words.length > 9) return false;
  return words.every(
    (w, i) => (i > 0 && TITLE_SMALL_WORDS.has(w.toLowerCase())) || /^[\p{Lu}\p{N}]/u.test(w),
  );
}

/** One word that is prayed on a line of its own. */
const SPOKEN_ALONE = /^(?:Amen|Alleluia|Alleluja|Hallelujah|Hosanna|Maranatha)[.!]?$/i;

/** "O Sapientia - December 17th": a heading by its date. */
const DATED_TITLE =
  /\s[—–-]\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d/;

/** How a titled heading opens: "Act of Thanksgiving.", "Prayers at the conclusion of the novena." */
const HEADING_WORD =
  /^(?:(?:The|A|An|Another)\s+)?(?:Act|Acts|Prayers?|Litany|Hymn|Antiphon|Invocations?|Offering|Oblation|Petitions?|Meditation|Consideration|Reflection|Ejaculations?|Aspirations?|Collect|Versicle|Responsory|Canticle|Psalm|Conclusion|Introduction|Opening|Closing|Concluding|Preparatory|Morning|Evening|Night|Daily|First|Second|Third|Fourth|Fifth|Sixth|Seventh|Eighth|Ninth|Tenth|Last)\b|^To\s+(?:the|our|Our|Saint|St\.?)\s/;

/** A heading closed by a full stop: "Act of Self-Oblation.", "To the Most Blessed Virgin.", "Second Set." */
function isTitledHeading(sentence: string): boolean {
  const t = sentence.trim();
  if (t.length > 80 || !/[.:]$/.test(t)) return false;
  if (ADDRESS.test(t)) return false;
  if (
    /\b(?:is|are|was|were|be|hast|hath|art|grant|give|pray|bless|say|said|have|has|let)\b/i.test(t)
  ) {
    return false;
  }
  const body = t.replace(/[.:]$/, "");
  if (/^Psalm\s+(?:[ivxlc]+|[IVXLC]+|\d+)$/.test(body)) return true;
  if (!HEADING_WORD.test(body) || body.split(/\s+/).length > 12) return false;
  return (
    titleCased(body) ||
    /^(?:(?:Another|The)\s+)?(?:Prayers?|Litany|Hymn|Acts?|Invocations?)\s/.test(body) ||
    /^To\s/.test(body)
  );
}

/** A label a part runs in with: "Invocation.—", "ANT.", "Prayer.—". */
const RUN_IN_LABEL =
  /^(?:(?:ANT|Ant|ANTIPHON|Antiphon|Invocation|Ejaculation|Aspiration|Petition|Response|Resp|Versicle|Vers|Offering|Resolution|Practice|Prayer)\s*[.:]?\s*[—–]\s*|(?:ANT|ANTIPHON)[.:]\s+)/;

/** A title given in Latin and then in English: `Turris Davidica. "Tower of David."`. */
const TWO_TONGUE_TITLE =
  /^([^"\u201c\u201d]{2,40}?[.!])\s+["\u201c]([^"\u201c\u201d]{2,50}?[.!]?)["\u201d]\.?$/;

/** A weekday leading the prayer for that day: "Sunday. O great High-Priest, …". */
const WEEKDAY_LABEL = /^(?:Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\.\s+(?=[A-Z])/;

/** A psalm's or canticle's title: "Unto the end, a psalm for David.", "A prayer of Habacuc …". */
const SUPERSCRIPTION =
  /^(?:Unto the end\b|A psalm\b|A canticle\b|A gradual canticle\b|A prayer of\b|The prayer of\b|The psalm of\b|The praise of a canticle\b|For David\b|Of David\b|To David\b|For the sons of Core\b|Understanding for\b|On the first day of the week\b|The inscription of a title\b|In finem\b|Psalmus\b|Canticum\b)/i;

/** How Scripture's narrative opens: "And", "Then", "These things Jesus spoke". */
const NARRATIVE_OPENER =
  /^(?:And|Then|But|So|Now|When|After|At that time|In that day|These things|Who having|She|He|They|Saying)\b|^(?:and|but|then)\b/;

/** The narrative that hands over to the words prayed: "…, saying:", "And he said:". */
const LEAD_IN_END =
  /(?:\b(?:said|saying|sung|sang|spoke|cried|answered)\b[^:]*|\bthou shalt (?:say|speak)\b[^:]*|\bafter this manner):$/i;

/** "In that day shall this canticle be sung in the land of Juda." */
const CANTICLE_NOTE = /\bcanticle\b.*\b(?:sung|sang)\b|\b(?:sung|sang)\b.*\bcanticle\b/i;

/**
 * Where the prayer starts in text that opens with a title or a narrative: "Unto the
 * end. A psalm for David.", "Then Judith sung this canticle to the Lord, saying:", "And
 * the Lord spoke to Moses, saying: Say to Aaron and his sons: …, and you shall say to
 * them:". Returns the length to leave out (0 for none).
 */
function leadInLength(text: string, english: boolean): number {
  const units: Array<{ text: string; end: number }> = [];
  for (const m of text.matchAll(/[^.!?:]+(?:[.!?:]+["”’']?|$)\s*/g)) {
    const end = (m.index ?? 0) + m[0].length;
    if (m[0].trim()) units.push({ text: m[0].trim(), end });
  }
  let k = 0;
  let cut = 0;
  while (k < units.length && SUPERSCRIPTION.test(units[k]!.text)) {
    cut = units[k]!.end;
    k++;
  }
  if (!english) return cut;
  const narrative = (u: string) =>
    NARRATIVE_OPENER.test(u) && (!ADDRESS.test(u) || /\bthou shalt\b/i.test(u));
  for (let j = k; j < Math.min(units.length, k + 4); j++) {
    if (!units.slice(k, j + 1).every((u) => narrative(u.text))) break;
    const u = units[j]!.text;
    if (LEAD_IN_END.test(u) || (CANTICLE_NOTE.test(u) && /\.$/.test(u))) {
      cut = units[j]!.end;
      let n = j + 1;
      while (
        n < units.length &&
        /\b(?:say|speak|said|saying)\b[^:]*:$/i.test(units[n]!.text) &&
        !/\bO\s+\p{Lu}/u.test(units[n]!.text)
      ) {
        cut = units[n]!.end;
        n++;
      }
      break;
    }
  }
  return cut;
}

/** A speaker named in the middle of Scripture: "And again they said:", "Sara also said:". */
const SPEAKER_TAG =
  /^(?:(?:And|Then|After these things)\b[^:;.!?]{0,160}?,?\s+saying[,:]|Saying\b[^:;.!?]{0,40}:|(?:And\s+)?(?:again\s+)?(?:they|[A-Z][a-z]+)(?:\s+also)?\s+said:)\s*/;

const DIVINE_SPEAKERS = /^(?:And\s+)?(?:Jesus|Christ|God|Lord|Mary)\b/;

/* -------------------------------------------------------------------------- */
/* Collect conclusions                                                        */
/* -------------------------------------------------------------------------- */

interface Style {
  modern: boolean;
  thy: string;
  thee: string;
  ghost: string;
  jesum: string;
}

function styleOf(text: string): Style {
  const traditional = (text.match(/\b(?:[Tt]hee|[Tt]hou|[Tt]hy|[Tt]hine)\b/g) ?? []).length;
  const modern = (text.match(/\b(?:[Yy]ou|[Yy]our)\b/g) ?? []).length > traditional;
  const capital = (text.match(/\b(?:Thee|Thy)\b/g) ?? []).length;
  const small = (text.match(/\b(?:thee|thy)\b/g) ?? []).length;
  const spirit = /\bHoly Spirit\b/.test(text) && !/\bHoly Ghost\b/.test(text);
  return {
    modern,
    thy: capital >= small ? "Thy" : "thy",
    thee: capital >= small ? "Thee" : "thee",
    ghost: modern || spirit ? "Spirit" : "Ghost",
    jesum: /\bJes(?:u|us|um)\b/.test(text) ? "Jesum" : "Iesum",
  };
}

/**
 * The whole conclusion of a collect that a text abbreviates: "Through our Lord Jesus
 * Christ, etc." is "Through our Lord Jesus Christ, Thy Son, who liveth and reigneth with
 * Thee in the unity of the Holy Ghost, God, world without end." Said as the Church says
 * it, in the text's own English (or Latin), with "the same Holy Ghost" when the prayer
 * names Him.
 */
function conclusionFor(cue: string, before: string, style: Style, lang: AudioLang): string | null {
  const c = cue.replace(/\s+/g, " ").trim();
  const sameSpirit =
    /\b(?:Holy (?:Ghost|Spirit)|Paraclete|Spiritu|Spiritus Sanct|Spiritum Sanct)/i.test(before);
  if (lang === "la") {
    const unity = `in unitate ${sameSpirit ? "ejusdem " : ""}Spiritus Sancti, Deus, per omnia saecula saeculorum.`;
    if (/^Per D[oó]minum(?: n[oó]strum)?(?: (?:J|I)esum Christum)?$/i.test(c)) {
      return `Per Dominum nostrum ${style.jesum} Christum, Filium tuum, qui tecum vivit et regnat ${unity}`;
    }
    if (/^Per eundem(?: D[oó]minum(?: n[oó]strum)?(?: (?:J|I)esum Christum)?)?$/i.test(c)) {
      return `Per eundem Dominum nostrum ${style.jesum} Christum, Filium tuum, qui tecum vivit et regnat ${unity}`;
    }
    const christ = /^Per (eundem )?Christum(?: D[oó]minum(?: n[oó]strum)?)?$/i.exec(c);
    if (christ) return `Per ${christ[1] ?? ""}Christum Dominum nostrum.`;
    if (/^Qui vivis(?: et regnas)?$/i.test(c)) {
      return "Qui vivis et regnas cum Deo Patre in unitate Spiritus Sancti, Deus, per omnia saecula saeculorum.";
    }
    if (/^Qui tecum vivit(?: et regnat)?$/i.test(c)) {
      return `Qui tecum vivit et regnat ${unity}`;
    }
    return null;
  }
  if (lang !== "en") return null;
  const same = sameSpirit ? "the same " : "the ";
  if (style.modern) {
    if (/^Through(?: (?:our|Our) Lord(?: Jesus Christ)?(?:,? your Son)?)?$/i.test(c)) {
      return `Through our Lord Jesus Christ, your Son, who lives and reigns with you in the unity of ${same}Holy Spirit, God, for ever and ever.`;
    }
    if (/(?:^|, )who live(?:s)? and reign(?:s)?$/i.test(c)) {
      return `${c} with God the Father in the unity of the Holy Spirit, God, for ever and ever.`;
    }
    return null;
  }
  const end = `in the unity of ${same}Holy ${style.ghost}, God, world without end.`;
  if (/^Through(?: (?:our|Our) Lord(?: Jesus Christ)?(?:,? (?:T|t)hy Son)?)?$/.test(c)) {
    return `Through our Lord Jesus Christ, ${style.thy} Son, who liveth and reigneth with ${style.thee} ${end}`;
  }
  if (/^Through the same (?:our )?Lord(?: Jesus Christ)?(?:,? (?:T|t)hy Son)?$/i.test(c)) {
    return `Through the same our Lord Jesus Christ, ${style.thy} Son, who liveth and reigneth with ${style.thee} ${end}`;
  }
  if (/^Through the same Jesus Christ$/i.test(c)) {
    return `Through the same Jesus Christ, ${style.thy} Son, our Lord, who liveth and reigneth with ${style.thee} ${end}`;
  }
  const christ = /^Through (the same )?Christ(?: our Lord)?$/i.exec(c);
  if (christ) return `Through ${christ[1] ?? ""}Christ our Lord.`;
  if (/(?:^|, )[Ww]ho livest(?: and reignest)?$/.test(c)) {
    const head = c.replace(/livest(?: and reignest)?$/, "livest and reignest");
    return `${head} with God the Father, in the unity of the Holy ${style.ghost}, God, world without end.`;
  }
  if (/^[Ww]ho liveth(?: and reigneth)?$/.test(c)) {
    return `Who liveth and reigneth with ${style.thee} ${end.replace(`${same}`, "the ")}`;
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* The few texts no rule can read right                                       */
/* -------------------------------------------------------------------------- */

interface Override {
  /** The stored English line (trimmed). */
  line: RegExp;
  /** Its replacement ("$1" allowed); without one, the line is left out. */
  replace?: string;
}

/**
 * By page ("prayer:<slug>", or "novena:<slug>" for every day of a novena). Each entry
 * says why no general rule can be right there.
 */
const OVERRIDES: Readonly<Record<string, readonly Override[]>> = {
  // Seasonal alternatives: the rubric gives the Christmas versicle, without its
  // Alleluias, for the rest of the year, and the Epiphany one only in its octave.
  "prayer:mysteries-of-the-holy-childhood": [
    { line: /^For the Epiphany and its Octave\.$/ },
    { line: /^V\. Christ hath manifested Himself to us\. Alleluia\.$/ },
    { line: /^R\. Come, let us adore\. Alleluia\.$/ },
    { line: /^V\. The Word was made flesh\. Alleluia\.$/, replace: "V. The Word was made flesh." },
    { line: /^R\. And dwelt among us\. Alleluia\.$/, replace: "R. And dwelt among us." },
  ],
  // Tobias 8:4-6 is narrative and Tobias's words to Sara, not prayer to God.
  "prayer:prayer-of-tobias-and-sara": [
    { line: /^Then Tobias exhorted the virgin\b/ },
    { line: /^For we are the children of saints\b/ },
    { line: /^So they both arose\b/ },
  ],
  // Numbers 6:27 is God's word about the blessing, not part of it.
  "prayer:priestly-blessing-of-aaron": [{ line: /^And they shall invoke my name\b/ }],
  // Nehemias's own note to the reader, after his prayer ends.
  "prayer:prayer-of-nehemias": [
    { line: /^(.*\S)\s+For I was the king's cupbearer\.$/, replace: "$1" },
  ],
  // Newman's Latin headings of his three parts (Romans 11:36).
  "prayer:newman-the-infinite-perfection-of-god": [
    { line: /^(\d+\.\s+)(?:Ex ipso|Per ipsum|In ipso)\.\s+/, replace: "$1" },
  ],
  // Days 2-9 abbreviate the first day's "Five Paters, Aves, and Glorias".
  "novena:novena-saint-clare-of-assisi": [
    { line: /^Pater, Ave, (?:&c|etc)\.$/, replace: "Five Paters, Aves, and Glorias." },
  ],
  // Days 2-9 abbreviate the first day's "Three Our Fathers—Hail Mary, and Gloria".
  "novena:novena-saint-francis-of-assisi-ara-coeli": [
    {
      line: /^Our Father, (?:Hail Mary, )?(?:&c|etc)\.$/,
      replace: "Three Our Fathers, Hail Marys and Glorias.",
    },
  ],
};

function overridesFor(page: string | undefined): readonly Override[] {
  if (!page) return [];
  const [kind, slug] = page.split(":");
  return OVERRIDES[`${kind}:${slug}`] ?? [];
}

/* -------------------------------------------------------------------------- */
/* Reading a text                                                             */
/* -------------------------------------------------------------------------- */

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
  /** The page ("prayer:<slug>", "novena:<slug>:<day>"), for the texts in OVERRIDES. */
  page?: string;
  /** The prayer this text is, when it is one: its own name in it is its words, not a rubric. */
  self?: string;
}

/** A stretch of a line: words, an instruction inside it, or its refrain mark. */
type LinePart =
  | { t: "say"; rule: string; shown: string }
  | { t: "rubric"; text: string }
  | { t: "refrain" };

interface DocLine {
  index: number;
  rule: string;
  shown: string;
  translated: boolean;
  /** The language its words are said in. */
  lang: AudioLang;
  blank: boolean;
  block: number;
  first: boolean;
  last: boolean;
  kind: PrayerLine["kind"];
  marker?: string;
  heading: boolean;
  parts: LinePart[];
  /** Its said words in the rule language, prepared, for finding a passage it repeats. */
  said: string;
}

/** Something that applies to what follows: "Then say three times,", "after each:". */
interface Effect {
  prayers: Named[];
  /** Say the next part this many times. */
  times?: number;
  /** …with these prayers after every n-th saying. */
  everyN?: { n: number; prayers: Named[] };
  /** The prayers once before each of `count` sayings of the next part. */
  beforeEach?: { prayers: Named[]; count: number };
  /** The prayers after each of the next `count` parts. */
  afterEach?: { prayers: Named[]; count: number };
  /** Repeat everything up to "End of Decade" this many times. */
  block?: number;
  endBlock?: boolean;
  /** The prayers are a total with the same prayer just prayed ("is to be repeated three times"). */
  merge?: boolean;
  /** Repeat the line before ("(Thrice.)" on a line of its own). */
  repeatPrevious?: number;
}

type Out =
  | { t: "say"; text: string; lang: AudioLang }
  | { t: "pause"; ms: number }
  | { t: "prayer"; slug: string; count: number; merge?: boolean }
  | { t: "effect"; effect: Effect };

/** A passage found earlier in the text, in both the rule language and the words shown. */
interface Passage {
  rule: string;
  shown: string;
}

/** Collects steps; a stanza's words become clips when something else is said or prayed. */
class StepBuilder {
  readonly steps: SpokenStep[] = [];
  private words: string[] = [];
  private wordsLang: AudioLang = "en";

  say(text: string, lang: AudioLang): void {
    if (!text.trim()) return;
    if (this.words.length > 0 && lang !== this.wordsLang) this.flush();
    this.wordsLang = lang;
    this.words.push(text);
  }

  /** The words waiting to be said, last first: does a sentence still go on? */
  pendingTail(): string {
    return this.words[this.words.length - 1] ?? "";
  }

  flush(): void {
    if (this.words.length === 0) return;
    for (const clip of splitForClips(this.words, MAX_CLIP_CHARS, this.wordsLang)) {
      const said = normalizeForSpeech(clip, this.wordsLang);
      if (said && /[\p{L}\p{N}]/u.test(said))
        this.steps.push({ kind: "say", text: said, lang: this.wordsLang });
    }
    this.words = [];
  }

  pause(ms: number): void {
    this.flush();
    const last = this.steps[this.steps.length - 1];
    if (!last) return;
    if (last.kind === "pause") last.ms = Math.max(last.ms, ms);
    else this.steps.push({ kind: "pause", ms });
  }

  prayer(slug: string, count: number, merge = false): void {
    this.flush();
    if (merge) {
      for (let i = this.steps.length - 1; i >= 0; i--) {
        const s = this.steps[i]!;
        if (s.kind === "pause") continue;
        if (s.kind === "prayer" && s.slug === slug) {
          s.count = Math.max(s.count, count);
          return;
        }
        break;
      }
    }
    this.pause(PRAYER_PAUSE_MS);
    this.steps.push({ kind: "prayer", slug, count });
    this.pause(PRAYER_PAUSE_MS);
  }

  mark(): number {
    this.flush();
    return this.steps.length;
  }

  take(from: number): SpokenStep[] {
    this.flush();
    return this.steps.splice(from);
  }

  put(steps: readonly SpokenStep[]): void {
    this.flush();
    for (const s of steps) {
      if (s.kind === "pause") this.pause(s.ms);
      else this.steps.push({ ...s });
    }
  }

  done(): SpokenStep[] {
    this.flush();
    while (this.steps[this.steps.length - 1]?.kind === "pause") this.steps.pop();
    while (this.steps[0]?.kind === "pause") this.steps.shift();
    return this.steps;
  }
}

/** The shown words of a translated line once its English line's instructions are out. */
function sayTranslated(englishRaw: string, englishSaid: string, shownRaw: string): string {
  const shown = shownRaw.trim();
  if (!englishSaid) return "";
  if (foldForCompare(englishSaid) === foldForCompare(englishRaw)) return shown;
  const removed = englishRaw.replace(englishSaid, "").trim();
  if (removed && shown.endsWith(removed)) return shown.slice(0, -removed.length).trim();
  if (removed && shown.includes(removed))
    return shown.replace(removed, " ").replace(/\s+/g, " ").trim();
  const sentences = splitSentences(shown, "en");
  if (sentences.length > 1 && englishRaw.trim().endsWith(removed)) {
    return sentences.slice(0, -1).join(" ").trim();
  }
  return shown;
}

/** The words of a parsed line, and its instructions and refrain mark, in order. */
function partsOf(parsed: readonly PrayerLine[]): { parts: LinePart[]; said: string } {
  const parts: LinePart[] = [];
  let words = "";
  const flush = () => {
    if (words.trim()) parts.push({ t: "say", rule: words.trim(), shown: "" });
    words = "";
  };
  for (const line of parsed) {
    if (line.kind === "note" || line.kind === "heading") continue;
    if (line.kind === "rubric") {
      flush();
      parts.push({ t: "rubric", text: line.runs.map((r) => r.text).join("") });
      continue;
    }
    line.runs.forEach((run, i) => {
      if (run.role === "text" || run.role === "response") {
        if (run.role === "response" && run.text.trim() === "R." && i === line.runs.length - 1) {
          flush();
          parts.push({ t: "refrain" });
        } else {
          words += run.text;
        }
      } else if (run.role === "symbol" && run.text === "*") {
        words += " * ";
      } else if (run.role === "rubric") {
        flush();
        parts.push({ t: "rubric", text: run.text });
      }
    });
    words += " ";
  }
  flush();
  const said = parts
    .flatMap((p) => (p.t === "say" ? [p.rule] : []))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return { parts, said };
}

/** Is the stored line a cue that repeats a passage ("O victim, etc.")? */
const CUE_END = /(?:^|[,\s])\s*etc\.?(?:,?\s*as\s+(?:above|before))?\s*[.:]?$/i;

/** The words of a prayer as one passes them in, when the caller gives its text. */
function textOf(p: MentionablePrayer): string {
  const q = p as MentionablePrayer & {
    english?: string;
    variants?: ReadonlyArray<{ text: string }>;
  };
  return q.english ?? q.variants?.[0]?.text ?? "";
}

/** Prayers whose name on a line of its own may be the heading of their printed text. */
const NEVER_A_HEADING = new Set([
  "our-father",
  "hail-mary",
  "glory-be",
  "apostles-creed",
  "sign-of-the-cross",
  "eternal-rest",
  "fatima-prayer",
]);

/**
 * The steps that pray `text`: its words, stanza by stanza and cut into clips, with the
 * prayers its instructions name prayed in place, and a pause between stanzas.
 */
export function spokenSteps(text: string, opts: SpokenOptions): SpokenStep[] {
  const shownLines = text.split("\n");
  const englishLines = opts.english?.split("\n");
  const aligned = !!englishLines && englishLines.length === shownLines.length;
  const ruleLang: AudioLang = aligned ? "en" : opts.lang;
  const english = ruleLang === "en";
  const latin = ruleLang === "la";
  const prayers = opts.prayers.filter((p) => p.slug !== opts.self);
  const overrides = english && !aligned ? overridesFor(opts.page) : [];

  /* ---- Pass 1: the lines, their kinds and words --------------------------------- */
  const lines: DocLine[] = [];
  let block = 0;
  let followsNumberedFour = false;
  shownLines.forEach((shownRaw, index) => {
    let rule = (aligned ? (englishLines![index] ?? "") : shownRaw).trim();
    let shown = shownRaw.trim();
    for (const o of overrides) {
      if (!o.line.test(rule)) continue;
      if (o.replace === undefined) {
        rule = "";
        shown = "";
      } else {
        rule = rule.replace(o.line, o.replace).trim();
        shown = rule;
      }
    }
    const blank = !rule && !shown;
    const translated = aligned && shown !== rule;
    const lang: AudioLang = aligned && opts.lang !== "en" && !translated ? "en" : opts.lang;
    const line: DocLine = {
      index,
      rule,
      shown,
      translated,
      lang,
      blank,
      block,
      first: false,
      last: false,
      kind: "spoken",
      heading: false,
      parts: [],
      said: "",
    };
    if (blank) {
      block++;
      lines.push(line);
      return;
    }
    // A line of its own is parsed on its own; "V." after "IV." is the next entry.
    const source = followsNumberedFour && /^V\.\s/.test(rule) ? `IV. x\n${rule}` : rule;
    const parsed = parsePrayerText(source)
      .flatMap((s) => s.lines)
      .slice(source === rule ? 0 : 1);
    if (/^IV\.\s/.test(rule)) followsNumberedFour = true;
    else if (/^V\.\s/.test(rule)) followsNumberedFour = false;
    const first = parsed[0];
    line.kind = first?.kind ?? "spoken";
    line.marker = first?.marker;
    line.heading = parsed.length > 0 && parsed.every((l) => l.kind === "heading");
    if (line.heading) {
      // "First Word: Father, forgive them; …", "First Mystery. Jesus was conceived …":
      // the label is a heading, the words after it are said.
      const label =
        /^(?:\S+\s+(?:Word|Mystery|Sorrow|Joy|Station)\b[^:.]*[:.]|Station\s+[IVXLC]+\.)\s+(\S.*)$/.exec(
          rule,
        );
      if (label?.[1] && !/^[IVXLC]+\.?$/.test(rule)) {
        line.heading = false;
        line.parts = [{ t: "say", rule: label[1], shown: "" }];
        line.said = label[1];
      }
    } else {
      const read = partsOf(parsed);
      line.parts = read.parts;
      line.said = read.said;
    }
    lines.push(line);
  });
  lines.forEach((l, i) => {
    if (l.blank) return;
    const prev = lines[i - 1];
    const next = lines[i + 1];
    l.first = !prev || prev.blank;
    l.last = !next || next.blank;
  });

  const ruleText = lines.map((l) => l.rule).join("\n");
  const style = styleOf(ruleText);
  const marian =
    (ruleText.match(/\b(?:Mary|Virgin|Mother of God|Our Lady|Maria)\b/g) ?? []).length >= 2;

  // Prepared words: brackets read (a request becomes a silence), abbreviations out. A
  // bracket that repeats the words ("(Repeat three times.)") or names prayers ("(Eternal
  // rest, etc., as above.)") becomes an instruction of its own, where it stands.
  for (const l of lines) {
    if (l.blank || l.heading) continue;
    const parts: LinePart[] = [];
    for (const p of l.parts) {
      if (p.t !== "say") {
        parts.push(p);
        continue;
      }
      let last = 0;
      for (const m of p.rule.matchAll(/\(([^()]*)\)|\[([^[\]]*)\]/g)) {
        const kind = classifyBracket(m[1] ?? m[2] ?? "", m[2] !== undefined);
        if (kind !== "repeat" && kind !== "prayers") continue;
        const at = m.index ?? 0;
        const before = p.rule.slice(last, at);
        if (before.trim()) parts.push({ t: "say", rule: before, shown: "" });
        parts.push({ t: "rubric", text: m[0] });
        last = at + m[0].length;
      }
      const tail = p.rule.slice(last);
      if (tail.trim()) parts.push({ t: "say", rule: tail, shown: "" });
    }
    l.parts = parts;
    for (const p of l.parts) {
      if (p.t !== "say") continue;
      p.rule = prepareWords(stripBrackets(p.rule, true), ruleLang);
    }
    l.said = l.parts
      .flatMap((p) => (p.t === "say" ? [p.rule] : []))
      .join(" ")
      .trim();
    if (l.translated) {
      const shownSaid = prepareWords(
        stripBrackets(sayTranslated(l.rule, l.said, l.shown), true),
        l.lang,
      );
      let given = false;
      for (const p of l.parts) {
        if (p.t !== "say") continue;
        p.shown = given ? "" : shownSaid;
        given = true;
      }
    } else {
      for (const p of l.parts) if (p.t === "say") p.shown = p.rule;
    }
  }

  // Headings the parser leaves to the page: title lines, "Act of Praise.", labels.
  /** Every line of the block is a bare title: a list of headings ("First Joyful Mystery: …"). */
  const titleBlock = (block: number) => {
    const ls = lines.filter((x) => !x.blank && x.block === block);
    return (
      ls.length > 1 &&
      ls.every(
        (x) => x.kind === "spoken" && !x.marker && !/[.!?;:,]$/.test(x.rule) && titleCased(x.rule),
      )
    );
  };
  lines.forEach((l, i) => {
    if (l.blank || l.heading || l.kind !== "spoken" || l.marker) return;
    const next = lines[i + 1];
    const t = l.rule;
    if (DATED_TITLE.test(t)) {
      l.heading = true;
      return;
    }
    if (!english) return;
    // "Let Us Pray" on a line of its own is said before the collect, as a sentence.
    if (/^Let us pray[.:,]?$/i.test(t)) {
      for (const p of l.parts) if (p.t === "say") p.rule = "Let us pray.";
      if (!l.translated) for (const p of l.parts) if (p.t === "say") p.shown = p.rule;
      return;
    }
    if (titleBlock(l.block)) {
      l.heading = true;
      return;
    }
    const hits = findPrayerNames(t, prayers, opts.self);
    const pointer = hits.length > 0 && isPointer(t, hits);
    if (pointer) {
      // "Litany of Loretto." over the litany printed below it is its heading.
      const slug = hits[0]?.slug ?? "";
      if (!NEVER_A_HEADING.has(slug) && hits.length === 1 && printedBelow(i, slug))
        l.heading = true;
      return;
    }
    const bare =
      t.length <= 70 &&
      !/[.!?;:,]["”’)]?$/.test(t) &&
      !SPOKEN_ALONE.test(t) &&
      !ADDRESS.test(t) &&
      titleCased(t) &&
      l.first &&
      (l.last || /^["'“‘(]*\p{Lu}/u.test(next?.rule ?? ""));
    if (
      bare ||
      (isTitledHeading(t) && (l.last ? !!next : true) && splitSentences(t).length === 1)
    ) {
      l.heading = true;
      return;
    }
    const twoTongue = TWO_TONGUE_TITLE.exec(t);
    if (twoTongue && (twoTongue[1] ?? "").split(/\s+/).length <= 5 && !ADDRESS.test(t)) {
      l.heading = true;
      return;
    }
    const label = RUN_IN_LABEL.exec(t) ?? WEEKDAY_LABEL.exec(t);
    if (label) {
      for (const p of l.parts) {
        if (p.t === "say") p.rule = p.rule.replace(RUN_IN_LABEL, "").replace(WEEKDAY_LABEL, "");
      }
      if (!l.translated) for (const p of l.parts) if (p.t === "say") p.shown = p.rule;
    }
  });

  /** Is the prayer `slug` printed in the lines after line `i` (so its name heads it)? */
  function printedBelow(i: number, slug: string): boolean {
    const source = prayers.find((p) => p.slug === slug);
    const known = source ? textOf(source) : "";
    const below: string[] = [];
    for (let j = i + 1; j < lines.length && below.length < 30; j++) {
      if (lines[j]!.blank && below.length > 0 && !known) break;
      if (!lines[j]!.blank) below.push(lines[j]!.rule);
    }
    if (known) {
      const want = known
        .split("\n")
        .map((x) => foldForCompare(x))
        .filter((x) => x.length > 8)
        .slice(0, 6);
      const have = new Set(below.map((x) => foldForCompare(x).replace(/^(?:ant|v|r)\s+/, "")));
      return want.filter((w) => have.has(w)).length >= 2;
    }
    if (
      !/^(?:litany-|te-deum|stabat-mater|tantum-ergo|veni-creator|magnificat|benedictus|nunc-dimittis|de-profundis|psalm-50)/.test(
        slug,
      )
    ) {
      return false;
    }
    const block = lines[i]!.block;
    return lines.filter((l) => !l.blank && l.block === block && l.index > i).length >= 3;
  }

  // The refrain a verse's closing "R." stands for: the first line marked as the people's.
  let refrain: Passage | null = null;
  if (lines.some((l) => l.parts.some((p) => p.t === "refrain"))) {
    const at = lines.findIndex((l) => l.kind === "response" && !!l.marker && !!l.said);
    if (at >= 0) {
      const head = lines[at]!;
      const rules = [head.said];
      const shows = [head.parts.find((p) => p.t === "say")?.shown ?? head.said];
      for (let j = at + 1; j < lines.length; j++) {
        const l = lines[j]!;
        if (l.blank || l.block !== head.block || l.marker || l.kind !== "spoken" || l.heading)
          break;
        rules.push(l.said);
        shows.push(l.parts.find((p) => p.t === "say")?.shown ?? l.said);
      }
      refrain = { rule: joinLines(rules), shown: joinLines(shows) };
    }
  }

  // Where the prayer starts in a text that opens with a title or Scripture's narrative.
  const leadCut = new Map<number, number>();
  if (english || latin) {
    const opening: Array<{ index: number; start: number; text: string }> = [];
    let joined = "";
    for (const l of lines) {
      if (l.blank) continue;
      if (l.heading || opening.length >= 6) break;
      const say = l.parts.find((p) => p.t === "say");
      if (!say || say.t !== "say") break;
      opening.push({ index: l.index, start: joined.length, text: say.rule });
      joined += `${say.rule} `;
    }
    const cut = leadInLength(joined, english);
    for (const o of opening) {
      if (cut <= o.start) break;
      leadCut.set(o.index, Math.min(o.text.length, cut - o.start));
    }
  }

  /* ---- Finding passages that cues repeat ----------------------------------------- */

  /** The passage earlier in the text that `cue` opens, in full. */
  function findPassage(cue: string, lineIndex: number, before: string): Passage | null {
    const want = foldForCompare(cue);
    if (!want) return null;
    const candidates = lines.filter((l) => !l.blank && !l.heading && l.index < lineIndex && l.said);
    const sources: Array<{ line: DocLine | null; text: string }> = [
      ...candidates.map((l) => ({ line: l, text: l.said })),
      { line: null, text: before },
    ];
    for (const { line, text: said } of sources) {
      for (const start of passageStarts(said)) {
        const from = said.slice(start).replace(/^\*\s*/, "");
        const folded = foldForCompare(from);
        if (!folded.startsWith(want) || folded === want) continue;
        const passage = passageFrom(line, said, start);
        const got = passage ? foldForCompare(passage.rule) : "";
        if (!passage || !got.startsWith(want) || got === want || CUE_END.test(passage.rule))
          continue;
        return passage;
      }
    }
    return null;
  }

  /** Where a passage may begin in a line's words: its start, after "*", at a sentence. */
  function passageStarts(said: string): number[] {
    const starts = new Set<number>([0]);
    for (const m of said.matchAll(/\*\s*/g)) starts.add((m.index ?? 0) + m[0].length);
    let at = 0;
    for (const s of splitSentences(said, ruleLang)) {
      const i = said.indexOf(s, at);
      if (i >= 0) {
        starts.add(i);
        at = i + s.length;
      }
    }
    return [...starts].sort((a, b) => a - b);
  }

  /** The extent of a passage: a verse with its lines, a line's rest after "*", or a sentence. */
  function passageFrom(line: DocLine | null, said: string, start: number): Passage | null {
    const cutCue = (s: string) => {
      const m = /(?:^|[\s,])[^.!?*]*\betc\b\.?.*$/i.exec(s);
      return (m ? s.slice(0, m.index) : s).trim();
    };
    if (!line) {
      const s = splitSentences(said.slice(start), ruleLang)[0] ?? "";
      return s ? { rule: s, shown: s } : null;
    }
    const shownOf = (l: DocLine) =>
      l.translated ? (l.parts.find((p) => p.t === "say")?.shown ?? "") : "";
    if (start === 0) {
      const taken = [line];
      if (line.first || line.marker) {
        for (let j = line.index + 1; j < lines.length; j++) {
          const l = lines[j]!;
          if (l.blank || l.block !== line.block || l.marker || l.kind !== "spoken" || l.heading)
            break;
          if (!l.said || CUE_END.test(l.said)) break;
          taken.push(l);
        }
      }
      // A versicle repeated by its opening words brings its response with it.
      const next = lines[line.index + 1];
      if (
        taken.length === 1 &&
        line.kind === "versicle" &&
        next &&
        !next.blank &&
        next.kind === "response"
      ) {
        taken.push(next);
      }
      const rule = joinLines(taken.map((l, i) => (i === 0 ? cutCue(said) : l.said)));
      const translated = taken.some((l) => l.translated);
      return { rule, shown: translated ? joinLines(taken.map(shownOf)) : rule };
    }
    const afterStar = /\*\s*$/.test(said.slice(0, start));
    const rest = said.slice(start);
    const text = afterStar ? cutCue(rest) : (splitSentences(rest, ruleLang)[0] ?? "");
    if (!text) return null;
    // In a translation only a whole line can be matched; a part of one is not said.
    return { rule: text, shown: line.translated ? "" : text };
  }

  /* ---- Pass 2: what is said and prayed ------------------------------------------- */

  const b = new StepBuilder();
  const groups: Named[][] = [];
  let lastPrayer: string | null = null;

  /** Applies a prayer list or a pending repeat as instructions ask. */
  interface Pending {
    effect: Effect;
    block: number;
    start: number | null;
  }
  let pending: Pending | null = null;
  let blockRepeat: { times: number; start: number } | null = null;
  let previousLine: Out[] = [];

  const sayOut = (out: Out[], text: string, lang: AudioLang) => {
    const pieces = text.split(INTENTION);
    pieces.forEach((piece, i) => {
      if (i > 0) out.push({ t: "pause", ms: INTENTION_PAUSE_MS });
      if (piece.trim() && /[\p{L}\p{N}]/u.test(piece))
        out.push({ t: "say", text: piece.trim(), lang });
    });
  };

  const prayerOuts = (named: readonly Named[], merge = false): Out[] => {
    if (named.length > 0) {
      groups.push([...named]);
      lastPrayer = named[named.length - 1]!.slug;
    }
    return named.map((n) => ({ t: "prayer" as const, slug: n.slug, count: n.count, merge }));
  };

  /** What an instruction asks for: prayers now, or a repeat of what follows. */
  function readInstruction(text: string, hits: readonly NameHit[]): Out[] {
    const t = text.trim();
    if (/^End of (?:the )?Decade\b/i.test(t))
      return [{ t: "effect", effect: { prayers: [], endBlock: true } }];
    if (/\bas often as\b/i.test(t) || /,?\s*or else[,:]?\s*$/i.test(t) || /^or\b/i.test(t))
      return [];
    const named = hits.filter(
      (h) => !/\b(?:after|before|during)\s+(?:the\s+)?$/i.test(t.slice(0, h.start)),
    );
    let list = namedSequence(t, named);
    const litany = /\bthe Litany\b(?!\s+of\b)/.exec(t);
    if (litany && marian && !named.some((h) => /^litany-/.test(h.slug))) {
      if (!/\b(?:after|before|during)\s+(?:the\s+)?$/i.test(t.slice(0, litany.index))) {
        list = [...list, { slug: "litany-of-the-blessed-virgin-mary", count: 1 }];
      }
    }
    const below = /\bbelow\b.*?\b(?:recited|said|repeated|prayed)\s+(\w+)\s+times\b/i.exec(t);
    if (
      below &&
      list.length === 0 &&
      lines.some((l) => /^End of (?:the )?Decade\b/i.test(l.rule))
    ) {
      const n = countWord(below[1] ?? "") ?? 1;
      return [{ t: "effect", effect: { prayers: [], block: n } }];
    }
    const every =
      /\b(\w+(?:-\w+)?)\s+times\b.*\bevery\s+(second|third|fourth|fifth|sixth)\s+(?:repetition|time)\b/i.exec(
        t,
      );
    if (every) {
      const times = countWord(every[1] ?? "") ?? 1;
      const n = ORDINAL_WORDS[(every[2] ?? "").toLowerCase()] ?? 1;
      return [{ t: "effect", effect: { prayers: [], times, everyN: { n, prayers: list } } }];
    }
    const each = /\bafter each of the following\s+(\w+)\b/i.exec(t);
    if (each) {
      const count = countWord(each[1] ?? "") ?? 1;
      const own = namedSequence(
        t.slice(0, each.index),
        named.filter((h) => h.start < each.index),
      );
      return [{ t: "effect", effect: { prayers: [], afterEach: { prayers: own, count } } }];
    }
    if (/\bafter each\s*[:,]?\s*$/i.test(t) && list.length > 0) {
      const count = list.reduce((s, n) => s + n.count, 0);
      const one = list.map((n) => ({ slug: n.slug, count: 1 }));
      const distinct = new Set(list.map((n) => n.slug)).size === 1;
      return [
        {
          t: "effect",
          effect: {
            prayers: [],
            beforeEach: { prayers: distinct ? one.slice(0, 1) : one, count: distinct ? count : 1 },
          },
        },
      ];
    }
    const repeated =
      /\b(?:is|are)\s+(?:to\s+be\s+)?(?:repeated|said|recited)\s+(\w+(?:-\w+)?)\s+times\b/i.exec(t);
    if (repeated && list.length > 0) {
      const n = countWord(repeated[1] ?? "") ?? 1;
      return prayerOuts(
        list.map((x) => ({ slug: x.slug, count: n })),
        true,
      );
    }
    if (list.length === 0) {
      const times =
        /\b(?:say|said|recite|recited|repeat|repeated|sing|sung)\b[^.;]*?\b(?:(once|twice|thrice)|(\w+(?:-\w+)?)\s+times)\b/i.exec(
          t,
        );
      if (times) {
        const n = times[1]
          ? (TIMES_WORDS[times[1].toLowerCase()] ?? 1)
          : (countWord(times[2] ?? "") ?? 1);
        if (n > 1) return [{ t: "effect", effect: { prayers: [], times: n } }];
      }
      return [];
    }
    return prayerOuts(list);
  }

  /** Where a clause stands: its line, what came before it, what follows it. */
  interface ClauseCtx {
    lineIndex: number;
    /** The text before it, lines before included: the collect a conclusion closes. */
    context: string;
    /** Its own line's words before it, where a passage it repeats may stand. */
    prefix: string;
    /** What follows it, to know whether an "Amen." does. */
    after: string;
    firstOfLine: boolean;
    translated: boolean;
    /** The words shown for its sentence, in a translation. */
    shown: string;
  }

  /** A cue ending "etc.": a collect's conclusion, the passage it opens, or a prayer. */
  function readCue(words: string, asBefore: boolean, c: ClauseCtx): Out[] {
    const w = words
      .replace(/^[*\s]+/, "")
      .replace(/[,\s]+$/, "")
      .trim();
    if (!w) return [];
    const out: Out[] = [];
    if (!c.translated) {
      const conclusion = conclusionFor(w, c.context, style, ruleLang);
      if (conclusion) {
        const amen = /^\s*(?:R\.\s*)?(?:Amen|Amén)\b/i.test(c.after) ? "" : " Amen.";
        sayOut(out, `${conclusion}${amen}`, ruleLang);
        return out;
      }
    } else if (/^(?:Through|Who liv|Per |Qui )/i.test(w)) {
      // A translation's own conclusion stays as its translator wrote it.
      sayOut(out, c.shown, opts.lang);
      return out;
    }
    if (/^(?:As it was|Sicut erat)\b/i.test(w)) {
      return lastPrayer === "glory-be" ? [] : prayerOuts([{ slug: "glory-be", count: 1 }]);
    }
    const passage = findPassage(w, c.lineIndex, c.prefix);
    if (passage) {
      const said = passage.shown || (c.translated ? "" : passage.rule);
      if (said) sayOut(out, said, c.translated && passage.shown ? opts.lang : ruleLang);
      return out;
    }
    const hits = findPrayerNames(w, prayers, opts.self);
    if (hits.length > 0 && isPointer(w, hits)) {
      if (asBefore) {
        const first = hits[0]!.slug;
        const earlier = [...groups].reverse().find((g) => g[0]?.slug === first && g.length > 1);
        if (earlier) return prayerOuts(earlier);
      }
      return prayerOuts(namedSequence(w, hits));
    }
    const tail = tailPointer(w, hits);
    if (tail) {
      sayOut(out, tail.head, c.translated ? opts.lang : ruleLang);
      return [...out, ...readInstruction(tail.tail, tail.hits)];
    }
    if (hits.length > 0 && hits[0]!.start === 0) {
      // A prayer's opening words: "Gloria Patri, et Filio, etc.", "Hail Mary, full of grace, etc."
      const rest = w.slice(hits[0]!.end).replace(/^[,\s]+/, "");
      if (rest.split(/\s+/).filter(Boolean).length <= 4) {
        return prayerOuts([{ slug: hits[0]!.slug, count: 1 }]);
      }
    }
    // Prose that happens to end "etc." is kept; a cue's opening words are not.
    if (w.split(/\s+/).length > 8)
      return [{ t: "say", text: w, lang: c.translated ? opts.lang : ruleLang }];
    return [];
  }

  /** What becomes of one clause of words. */
  function readClause(clause: string, c: ClauseCtx): Array<Out | { keep: string }> {
    let t = clause.trim().replace(/;$/, "");
    if (!t) return [];
    if (english) {
      const tag = SPEAKER_TAG.exec(t);
      if (tag && !ADDRESS.test(tag[0]) && !DIVINE_SPEAKERS.test(tag[0])) {
        t = t.slice(tag[0].length).trim();
        if (!t) return [];
        return [{ keep: t }];
      }
    }
    if (!english && !latin) return [{ keep: clause.trim() }];
    const cue = CUE_END.exec(t);
    if (cue) return readCue(t.slice(0, cue.index), /\bas\s+(?:above|before)\b/i.test(cue[0]), c);
    const repeat = (cueWords: string) => {
      const passage = findPassage(cueWords, c.lineIndex, c.prefix);
      if (!passage) return null;
      const out: Out[] = [];
      sayOut(
        out,
        passage.shown || passage.rule,
        c.translated && passage.shown ? opts.lang : ruleLang,
      );
      return out;
    };
    // "* Vos.": a responsory's repeat, by its first word.
    const star = /^\*\s*([^*]{1,40}?)\.?$/.exec(t);
    if (star && (star[1] ?? "").split(/\s+/).length <= 3) {
      const out = repeat(star[1] ?? "");
      if (out) return out;
    }
    // "Ant: The sea withdraws...": a refrain by its opening words.
    if (/…["”’']?$/.test(t) && !/^["“‘']/.test(t)) {
      const out = repeat(t.replace(/…["”’']?$/, ""));
      if (out) return out;
    }
    // A quoted opening that stands for a prayer prayed in full: "“I believe in God …”".
    if (/^["“‘'][^"”’]*…\s*["”’']?\.?$/.test(t)) return [];
    for (const [re, slug] of INCIPIT_RUBRICS)
      if (re.test(t)) return prayerOuts([{ slug, count: 1 }]);
    const hits = findPrayerNames(t, prayers, opts.self);
    if (hits.length > 0 && isPointer(t, hits)) return readInstruction(t, hits);
    if (english && isInstruction(t, hits.length > 0)) return readInstruction(t, hits);
    if (english && c.firstOfLine && isTitledHeading(t)) return [];
    const tail = tailPointer(t, hits);
    if (tail) return [{ keep: tail.head }, ...readInstruction(tail.tail, tail.hits)];
    return [{ keep: clause.trim() }];
  }

  /** "I salute Thee, saying, Hail Mary, &c.": the words, then the prayers named after them. */
  function tailPointer(
    t: string,
    hits: readonly NameHit[],
  ): { head: string; tail: string; hits: NameHit[] } | null {
    for (let i = 0; i < hits.length; i++) {
      let s = hits[i]!.start;
      const pre = /(\b\w+(?:-\w+)?\s+)$/.exec(t.slice(0, s));
      if (pre && countWord((pre[1] ?? "").trim()) != null) s -= (pre[1] ?? "").length;
      const head = t.slice(0, s).trimEnd();
      if (!head || !/(?:[,:]|\b(?:say|saying|says|pray|recite|add))$/i.test(head)) continue;
      const tail = t.slice(s);
      const tailHits = hits.slice(i).map((h) => ({ ...h, start: h.start - s, end: h.end - s }));
      if (isPointer(tail, tailHits)) return { head, tail, hits: tailHits };
    }
    return null;
  }

  /** A stretch of words: its sentences read by the rules, said in the words shown. */
  function readSay(
    line: DocLine,
    rule: string,
    shown: string,
    firstPart: boolean,
    context: string,
    after: string,
  ): Out[] {
    const out: Out[] = [];
    if (!english && !latin) {
      sayOut(out, shown, line.lang);
      return out;
    }
    // An instruction leading into a prayer's words in quotation marks: say the words,
    // or, when they are only its opening ("“I believe in God …”"), pray what it names.
    const quote = english && !line.translated ? /^([^"“]*?[:,])\s*["“](.*)$/.exec(rule) : null;
    if (quote) {
      const lead = quote[1] ?? "";
      const leadHits = findPrayerNames(lead, prayers, opts.self);
      if (isInstruction(lead, leadHits.length > 0)) {
        const words = (quote[2] ?? "").replace(/["”]\s*\.?\s*$/, "").trim();
        if (!words || /…$/.test(words)) out.push(...readInstruction(lead, leadHits));
        else sayOut(out, words, line.lang);
        return out;
      }
    }
    const ruleSentences = splitSentences(rule, ruleLang);
    const shownSentences = line.translated ? splitSentences(shown, line.lang) : ruleSentences;
    const sentenceAligned = !line.translated || ruleSentences.length === shownSentences.length;
    let shownLeft: string | null = line.translated && !sentenceAligned ? shown : null;
    const keepShown = (k: number, text: string) => {
      if (!line.translated) sayOut(out, text, line.lang);
      else if (sentenceAligned) sayOut(out, shownSentences[k] ?? "", line.lang);
      else if (shownLeft !== null) {
        sayOut(out, shownLeft, line.lang);
        shownLeft = null;
      }
    };
    let prefix = "";
    for (let k = 0; k < ruleSentences.length; k++) {
      const sentence = ruleSentences[k]!;
      const whole: ClauseCtx = {
        lineIndex: line.index,
        context: `${context} ${prefix}`,
        prefix,
        after: `${ruleSentences.slice(k + 1).join(" ")} ${after}`.trim(),
        firstOfLine: firstPart && k === 0,
        translated: line.translated,
        shown: shownSentences[k] ?? "",
      };
      const asOne = readClause(sentence, whole);
      const plain = asOne.length === 1 && "keep" in asOne[0]! && asOne[0].keep === sentence.trim();
      const parts = plain ? splitClauses(sentence) : [sentence];
      const clauses = parts.length > 1 ? parts : [sentence];
      const items =
        parts.length > 1
          ? clauses.flatMap((clause, ci) =>
              readClause(clause, {
                ...whole,
                after: `${clauses.slice(ci + 1).join(" ")} ${whole.after}`.trim(),
                firstOfLine: whole.firstOfLine && ci === 0,
              }),
            )
          : asOne;
      const keptAll =
        items.length === clauses.length &&
        items.every((it, i) => "keep" in it && it.keep === clauses[i]!.trim());
      if (keptAll) keepShown(k, sentence);
      else {
        let shownUsed = false;
        for (const it of items) {
          if (!("keep" in it)) out.push(it);
          else if (!line.translated) sayOut(out, it.keep, line.lang);
          else if (!shownUsed) {
            keepShown(k, it.keep);
            shownUsed = true;
          }
        }
      }
      prefix += ` ${sentence}`;
    }
    return out;
  }

  /** A sentence's clauses at its semicolons, when one of them is an instruction or a cue. */
  function splitClauses(sentence: string): string[] {
    const parts: string[] = [];
    let at = 0;
    for (const m of sentence.matchAll(/;\s+/g)) {
      const end = (m.index ?? 0) + 1;
      parts.push(sentence.slice(at, end).trim());
      at = (m.index ?? 0) + m[0].length;
    }
    parts.push(sentence.slice(at).trim());
    if (parts.length === 1) return [sentence];
    const special = parts.some((p) => {
      const t = p.replace(/;$/, "");
      const hits = findPrayerNames(t, prayers, opts.self);
      return (
        CUE_END.test(t) ||
        (hits.length > 0 && isPointer(t, hits)) ||
        (english && isInstruction(t, hits.length > 0))
      );
    });
    return special ? parts : [sentence];
  }

  /** An instruction on a line or in brackets: prayers, a repeat, a silence, a cue. */
  function readRubric(line: DocLine, text: string, after: string): Out[] {
    const t = text.trim();
    const bracketed = /^[([]/.test(t) && /[)\]][.:;]?$/.test(t);
    const inner = bracketed ? t.replace(/^[([]\s*|\s*[)\]][.:;]?$/g, "") : t;
    const kind = bracketed ? classifyBracket(inner, t.startsWith("[")) : null;
    if (kind === "intention") return [{ t: "pause", ms: INTENTION_PAUSE_MS }];
    const repeat = repeatCount(t);
    if (repeat != null) return [{ t: "effect", effect: { prayers: [], repeatPrevious: repeat } }];
    if (kind === "drop" && !/\bafter each\b/i.test(inner)) return [];
    const out: Out[] = [];
    // "V. and R. as above.": the versicle and response said last.
    if (/\bV\.\s+and\s+R\.\s+as\s+above\b/.test(inner)) {
      const v = lines
        .slice(0, line.index)
        .reverse()
        .find((l) => l.kind === "versicle" && !!l.said);
      if (v) {
        const r = lines[v.index + 1];
        sayOut(out, joinLines([v.said, r && r.kind === "response" ? r.said : ""]), ruleLang);
      }
    }
    const sentences = splitSentences(
      inner.replace(/\bV\.\s+and\s+R\.\s+as\s+above\.?/, ""),
      ruleLang,
    );
    sentences.forEach((sentence, k) => {
      const c: ClauseCtx = {
        lineIndex: line.index,
        context: line.said,
        prefix: line.said,
        after: `${sentences.slice(k + 1).join(" ")} ${after}`.trim(),
        firstOfLine: false,
        translated: line.translated,
        shown: "",
      };
      const cue = CUE_END.exec(sentence);
      if (cue)
        out.push(
          ...readCue(sentence.slice(0, cue.index), /\bas\s+(?:above|before)\b/i.test(cue[0]), c),
        );
      else {
        const bare = sentence.trim();
        const incipit = INCIPIT_RUBRICS.find(([re]) => re.test(bare));
        if (incipit) out.push(...prayerOuts([{ slug: incipit[1], count: 1 }]));
        else out.push(...readInstruction(sentence, findPrayerNames(sentence, prayers, opts.self)));
      }
    });
    return out;
  }

  /** Ends a pending repeat once the part it repeats has been said. */
  function finishPending(): void {
    if (!pending || pending.start == null) return;
    const { effect } = pending;
    const once = b.take(pending.start);
    const again = () => b.put(once.map((s) => ({ ...s })));
    const pray = (named: readonly Named[]) => {
      for (const n of named) {
        b.prayer(n.slug, n.count);
        lastPrayer = n.slug;
      }
    };
    pending = null;
    if (effect.beforeEach) {
      for (let k = 0; k < effect.beforeEach.count; k++) {
        pray(effect.beforeEach.prayers);
        again();
      }
    } else if (effect.afterEach) {
      again();
      pray(effect.afterEach.prayers);
      if (effect.afterEach.count > 1) {
        pending = {
          effect: {
            ...effect,
            afterEach: { ...effect.afterEach, count: effect.afterEach.count - 1 },
          },
          block: -1,
          start: null,
        };
      }
    } else {
      const times = effect.times ?? 1;
      for (let k = 1; k <= times; k++) {
        if (k > 1) b.pause(PRAYER_PAUSE_MS);
        again();
        if (effect.everyN && k % effect.everyN.n === 0) pray(effect.everyN.prayers);
      }
    }
  }

  function emit(outs: readonly Out[], line: DocLine): void {
    for (const o of outs) {
      if (o.t === "effect") {
        const e = o.effect;
        if (e.endBlock) {
          finishPending();
          if (blockRepeat) {
            const once = b.take(blockRepeat.start);
            for (let k = 0; k < blockRepeat.times; k++) {
              if (k > 0) b.pause(PRAYER_PAUSE_MS);
              b.put(once.map((s) => ({ ...s })));
            }
            blockRepeat = null;
          }
        } else if (e.block) {
          blockRepeat = { times: e.block, start: b.mark() };
        } else if (e.repeatPrevious) {
          for (let k = 1; k < e.repeatPrevious; k++) emit(previousLine, line);
        } else if (e.times || e.beforeEach || e.afterEach) {
          finishPending();
          pending = { effect: e, block: line.last ? -1 : line.block, start: null };
        }
        continue;
      }
      if (pending && pending.start == null) {
        if (pending.block === -1) pending.block = line.block;
        if (pending.block === line.block) pending.start = b.mark();
      }
      if (o.t === "say") b.say(o.text, o.lang);
      else if (o.t === "pause") b.pause(o.ms);
      else {
        b.prayer(o.slug, o.count, o.merge);
        lastPrayer = o.slug;
      }
    }
  }

  lines.forEach((line, li) => {
    if (line.blank) {
      // A blank line in the middle of a sentence ("Dear Saint Patrick," … "in your
      // humility …") does not end it.
      const nextLine = lines.slice(li + 1).find((l) => !l.blank);
      const tail = b.pendingTail().trim();
      if (
        tail &&
        !/[.!?\u2026"\u201d\u2019)\]]$/.test(tail) &&
        nextLine &&
        /^\p{Ll}/u.test(nextLine.said)
      ) {
        return;
      }
    }
    if (line.blank || line.heading) {
      if (pending && pending.start != null && (line.heading || line.block >= pending.block)) {
        finishPending();
      }
      b.pause(STANZA_PAUSE_MS);
      return;
    }
    if (line.kind === "note") {
      // "Application. … Pater and Ave once, Gloria seven times.": the meditation is read
      // in silence, the prayers it ends by naming are prayed.
      if (english || latin) {
        const tail: Out[] = [];
        for (const sentence of splitSentences(line.rule, ruleLang).reverse()) {
          const hits = findPrayerNames(sentence, prayers, opts.self);
          if (!(hits.length > 0 && isPointer(sentence, hits))) break;
          tail.unshift(...readInstruction(sentence, hits));
        }
        emit(tail, line);
      }
      return;
    }
    const outs: Out[] = [];
    const next = lines[li + 1];
    const nextSaid = next && !next.blank ? next.said : "";
    let context = lines
      .slice(Math.max(0, li - 3), li)
      .map((l) => l.said)
      .join(" ");
    let firstSay = true;
    line.parts.forEach((part, pi) => {
      const after = `${line.parts
        .slice(pi + 1)
        .map((p) => (p.t === "say" ? p.rule : p.t === "rubric" ? p.text : ""))
        .join(" ")} ${nextSaid}`.trim();
      if (part.t === "rubric") {
        outs.push(...readRubric(line, part.text, after));
        return;
      }
      if (part.t === "refrain") {
        if (refrain)
          sayOut(outs, line.translated ? refrain.shown || refrain.rule : refrain.rule, line.lang);
        return;
      }
      let rule = part.rule;
      let shown = part.shown;
      const cut = firstSay ? leadCut.get(line.index) : undefined;
      if (cut) {
        rule = rule.slice(cut).trim();
        if (!line.translated || !rule) shown = rule;
        else {
          const marks = (part.rule.slice(0, cut).match(/[:.!?]/g) ?? []).length;
          let n = 0;
          let i = 0;
          while (i < shown.length && n < marks) {
            if (/[:.!?]/.test(shown.charAt(i))) n++;
            i++;
          }
          shown = shown.slice(i).trim();
        }
      }
      if (rule) outs.push(...readSay(line, rule, shown, firstSay, context, after));
      context += ` ${rule}`;
      firstSay = false;
    });
    // "(Thrice.)" after a line's words says them that many times.
    const at = outs.findIndex((o, i) => i > 0 && o.t === "effect" && !!o.effect.repeatPrevious);
    if (at > 0) {
      const times = (outs[at] as { t: "effect"; effect: Effect }).effect.repeatPrevious ?? 1;
      const words = outs.slice(0, at);
      const rest = outs.slice(at + 1);
      outs.length = 0;
      for (let k = 0; k < times; k++) outs.push(...words);
      outs.push(...rest);
    }
    emit(outs, line);
    const words = outs.filter((o) => o.t === "say");
    if (words.length > 0) previousLine = words;
  });
  finishPending();
  if (blockRepeat)
    emit([{ t: "effect", effect: { prayers: [], endBlock: true } }], lines[lines.length - 1]!);
  return b.done();
}
