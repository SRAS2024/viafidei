/**
 * Deterministic transliteration of names into Latin letters.
 *
 * Used for parish names written in a script the visitor does not read when a
 * translation is not meaningful (or not ready yet): Cyrillic (Russian BGN/
 * PCGN, Ukrainian and Belarusian national systems, Serbian/Macedonian
 * letters), Greek (ELOT 743), Hangul (Revised Romanization) and kana
 * (Hepburn). Pure table lookups — no model, no network — so a transliteration
 * is never wrong in a misleading way.
 *
 * `romanize` returns null when it cannot transliterate EVERY letter (a
 * Japanese name with kanji, say): a half-romanized name is worse than the
 * original, so the caller keeps the original instead.
 */

import { detectScript, scriptCounts, type Script } from "./rules";

function capitalizeWords(text: string): string {
  return text.replace(
    /(^|[\s\-‐(/])(\p{Ll})/gu,
    (_, pre: string, ch: string) => pre + ch.toUpperCase(),
  );
}

function applyCase(source: string, latin: string): string {
  if (!latin) return latin;
  if (source !== source.toLowerCase() && source === source.toUpperCase()) {
    return latin.charAt(0).toUpperCase() + latin.slice(1);
  }
  return latin;
}

/* ------------------------------------------------------------------ */
/*  Cyrillic                                                          */
/* ------------------------------------------------------------------ */

const RUSSIAN: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "yo",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "kh",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "shch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
  // Serbian and Macedonian letters.
  ђ: "dj",
  ј: "j",
  љ: "lj",
  њ: "nj",
  ћ: "c",
  џ: "dz",
  ѓ: "gj",
  ќ: "kj",
  ѕ: "dz",
  // Ukrainian and Belarusian letters, for names outside UA/BY.
  і: "i",
  ї: "yi",
  є: "ye",
  ґ: "g",
  ў: "w",
};

/** Ukrainian national transliteration (2010): word-initial and other forms. */
const UKRAINIAN: Record<string, [string, string]> = {
  г: ["h", "h"],
  ґ: ["g", "g"],
  е: ["e", "e"],
  є: ["ye", "ie"],
  и: ["y", "y"],
  і: ["i", "i"],
  ї: ["yi", "i"],
  й: ["y", "i"],
  х: ["kh", "kh"],
  щ: ["shch", "shch"],
  ю: ["yu", "iu"],
  я: ["ya", "ia"],
  ь: ["", ""],
  "'": ["", ""],
  "’": ["", ""],
};

const BELARUSIAN: Record<string, string> = { г: "h", і: "i", ў: "w", е: "ye", ё: "yo" };
const BULGARIAN: Record<string, string> = { щ: "sht", ъ: "a", х: "h", й: "y", ю: "yu", я: "ya" };

function romanizeCyrillic(text: string, country: string): string | null {
  let out = "";
  let wordStart = true;
  const chars = Array.from(text);
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]!;
    const lower = ch.toLowerCase();
    let latin: string | undefined;
    if (country === "UA" && UKRAINIAN[lower]) latin = UKRAINIAN[lower]![wordStart ? 0 : 1];
    else if (country === "BY" && BELARUSIAN[lower] !== undefined) latin = BELARUSIAN[lower];
    else if (country === "BG" && BULGARIAN[lower] !== undefined) latin = BULGARIAN[lower];
    else latin = RUSSIAN[lower];
    if (latin === undefined) {
      if (/\p{Script=Cyrillic}/u.test(ch)) return null;
      out += ch;
      wordStart = !/\p{L}/u.test(ch);
      continue;
    }
    out += ch === lower ? latin : applyCase(ch, latin);
    wordStart = false;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/*  Greek (ELOT 743, simplified)                                      */
/* ------------------------------------------------------------------ */

const GREEK_PAIRS: Record<string, string> = {
  αι: "ai",
  ει: "ei",
  οι: "oi",
  ου: "ou",
  υι: "yi",
  αυ: "av",
  ευ: "ev",
  ηυ: "iv",
  γγ: "ng",
  γκ: "gk",
  γξ: "nx",
  γχ: "nch",
};

const GREEK: Record<string, string> = {
  α: "a",
  β: "v",
  γ: "g",
  δ: "d",
  ε: "e",
  ζ: "z",
  η: "i",
  θ: "th",
  ι: "i",
  κ: "k",
  λ: "l",
  μ: "m",
  ν: "n",
  ξ: "x",
  ο: "o",
  π: "p",
  ρ: "r",
  σ: "s",
  ς: "s",
  τ: "t",
  υ: "y",
  φ: "f",
  χ: "ch",
  ψ: "ps",
  ω: "o",
};

function romanizeGreek(text: string): string | null {
  // Accents and breathings carry no Latin-letter information here.
  const chars = Array.from(
    text
      .normalize("NFD")
      .replace(/\p{M}+/gu, "")
      .normalize("NFC"),
  );
  let out = "";
  let wordStart = true;
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]!;
    const lower = ch.toLowerCase();
    const next = (chars[i + 1] ?? "").toLowerCase();
    const upper = ch !== lower;
    const pair = GREEK_PAIRS[lower + next];
    if (pair) {
      out += upper ? applyCase(ch, pair) : pair;
      i++;
      wordStart = false;
      continue;
    }
    if (lower === "μ" && next === "π") {
      const latin = wordStart ? "b" : "mp";
      out += upper ? applyCase(ch, latin) : latin;
      i++;
      wordStart = false;
      continue;
    }
    if (lower === "ν" && next === "τ") {
      const latin = wordStart ? "d" : "nt";
      out += upper ? applyCase(ch, latin) : latin;
      i++;
      wordStart = false;
      continue;
    }
    const latin = GREEK[lower];
    if (latin === undefined) {
      if (/\p{Script=Greek}/u.test(ch)) return null;
      out += ch;
      wordStart = !/\p{L}/u.test(ch);
      continue;
    }
    out += upper ? applyCase(ch, latin) : latin;
    wordStart = false;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/*  Hangul (Revised Romanization)                                     */
/* ------------------------------------------------------------------ */

const INITIALS = [
  "g",
  "kk",
  "n",
  "d",
  "tt",
  "r",
  "m",
  "b",
  "pp",
  "s",
  "ss",
  "",
  "j",
  "jj",
  "ch",
  "k",
  "t",
  "p",
  "h",
];
const MEDIALS = [
  "a",
  "ae",
  "ya",
  "yae",
  "eo",
  "e",
  "yeo",
  "ye",
  "o",
  "wa",
  "wae",
  "oe",
  "yo",
  "u",
  "wo",
  "we",
  "wi",
  "yu",
  "eu",
  "ui",
  "i",
];
const FINALS = [
  "",
  "k",
  "k",
  "k",
  "n",
  "n",
  "n",
  "t",
  "l",
  "k",
  "m",
  "l",
  "l",
  "l",
  "p",
  "l",
  "m",
  "p",
  "p",
  "t",
  "t",
  "ng",
  "t",
  "t",
  "k",
  "t",
  "p",
  "t",
];
/** A final consonant carried onto a following vowel (ㅇ initial) is voiced. */
const LIAISON: Record<number, string> = {
  1: "g",
  2: "kk",
  4: "n",
  7: "d",
  8: "r",
  16: "m",
  17: "b",
  19: "s",
  20: "ss",
  22: "j",
  23: "ch",
  24: "k",
  25: "t",
  26: "p",
  27: "",
};

/** Words Korean church names end in; a space before them makes the name readable. */
const KOREAN_CHURCH_WORDS = [
  "기념성당",
  "주교좌",
  "대성당",
  "성당",
  "본당",
  "공소",
  "성지",
  "수도원",
  "수녀원",
  "교회",
];

function splitKoreanChurchWords(word: string): string {
  for (const suffix of KOREAN_CHURCH_WORDS) {
    if (word.length > suffix.length && word.endsWith(suffix)) {
      return `${splitKoreanChurchWords(word.slice(0, -suffix.length))} ${suffix}`;
    }
  }
  if (word.startsWith("천주교") && word.length > 3) return `천주교 ${word.slice(3)}`;
  return word;
}

const HANGUL_SYLLABLE = /[가-힣]/;

function romanizeHangulWord(word: string): string {
  const syllables = Array.from(word).map((ch) => {
    const code = ch.codePointAt(0)! - 0xac00;
    return { l: Math.floor(code / 588), v: Math.floor((code % 588) / 28), t: code % 28 };
  });
  // ㄴ+ㄹ, ㄹ+ㄴ and ㄹ+ㄹ are all pronounced (and romanized) "ll": 신라 Silla.
  const lateral = (a: { t: number } | undefined, b: { l: number } | undefined) =>
    !!a && !!b && ((a.t === 4 && b.l === 5) || (a.t === 8 && (b.l === 2 || b.l === 5)));
  let out = "";
  for (let i = 0; i < syllables.length; i++) {
    const s = syllables[i]!;
    const prev = syllables[i - 1];
    const next = syllables[i + 1];
    let initial = INITIALS[s.l]!;
    if (prev && prev.t !== 0 && s.l === 11 && LIAISON[prev.t] !== undefined)
      initial = LIAISON[prev.t]!;
    if (lateral(prev, s)) initial = "l";
    out += initial + MEDIALS[s.v]!;
    const carried = next && s.t !== 0 && next.l === 11 && LIAISON[s.t] !== undefined;
    if (lateral(s, next)) out += "l";
    else if (!carried) out += FINALS[s.t]!;
  }
  return out;
}

function romanizeHangul(text: string): string | null {
  const spaced = text.replace(/[가-힣]+/g, (run) => splitKoreanChurchWords(run));
  let out = "";
  for (const part of spaced.split(/([가-힣]+)/)) {
    if (!part) continue;
    if (HANGUL_SYLLABLE.test(part)) out += romanizeHangulWord(part);
    else if (/\p{Script=Hangul}/u.test(part))
      return null; // bare jamo
    else out += part;
  }
  return capitalizeWords(out);
}

/* ------------------------------------------------------------------ */
/*  Kana (Hepburn)                                                    */
/* ------------------------------------------------------------------ */

const KANA: Record<string, string> = {
  あ: "a",
  い: "i",
  う: "u",
  え: "e",
  お: "o",
  か: "ka",
  き: "ki",
  く: "ku",
  け: "ke",
  こ: "ko",
  さ: "sa",
  し: "shi",
  す: "su",
  せ: "se",
  そ: "so",
  た: "ta",
  ち: "chi",
  つ: "tsu",
  て: "te",
  と: "to",
  な: "na",
  に: "ni",
  ぬ: "nu",
  ね: "ne",
  の: "no",
  は: "ha",
  ひ: "hi",
  ふ: "fu",
  へ: "he",
  ほ: "ho",
  ま: "ma",
  み: "mi",
  む: "mu",
  め: "me",
  も: "mo",
  や: "ya",
  ゆ: "yu",
  よ: "yo",
  ら: "ra",
  り: "ri",
  る: "ru",
  れ: "re",
  ろ: "ro",
  わ: "wa",
  ゐ: "i",
  ゑ: "e",
  を: "o",
  ん: "n",
  が: "ga",
  ぎ: "gi",
  ぐ: "gu",
  げ: "ge",
  ご: "go",
  ざ: "za",
  じ: "ji",
  ず: "zu",
  ぜ: "ze",
  ぞ: "zo",
  だ: "da",
  ぢ: "ji",
  づ: "zu",
  で: "de",
  ど: "do",
  ば: "ba",
  び: "bi",
  ぶ: "bu",
  べ: "be",
  ぼ: "bo",
  ぱ: "pa",
  ぴ: "pi",
  ぷ: "pu",
  ぺ: "pe",
  ぽ: "po",
  ぁ: "a",
  ぃ: "i",
  ぅ: "u",
  ぇ: "e",
  ぉ: "o",
  ゔ: "vu",
};

const SMALL_Y: Record<string, string> = { ゃ: "a", ゅ: "u", ょ: "o" };
const SMALL_VOWEL: Record<string, string> = { ぁ: "a", ぃ: "i", ぅ: "u", ぇ: "e", ぉ: "o" };

/** Katakana → hiragana (the two blocks are parallel). */
function toHiragana(ch: string): string {
  const cp = ch.codePointAt(0)!;
  return cp >= 0x30a1 && cp <= 0x30f6 ? String.fromCodePoint(cp - 0x60) : ch;
}

function romanizeKana(text: string): string | null {
  if (/\p{Script=Han}/u.test(text)) return null; // kanji need a dictionary
  const chars = Array.from(text).map(toHiragana);
  let out = "";
  let geminate = false;
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]!;
    if (ch === "っ") {
      geminate = true;
      continue;
    }
    if (ch === "ー") {
      const vowel = /[aeiou](?=[^aeiou]*$)/.exec(out)?.[0];
      if (vowel) out += vowel;
      continue;
    }
    if (ch === "・") {
      out += " ";
      continue;
    }
    let latin = KANA[ch];
    if (latin === undefined) {
      if (/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(ch)) return null;
      out += ch;
      geminate = false;
      continue;
    }
    const next = chars[i + 1] ?? "";
    if (SMALL_Y[next] && latin.length > 1 && latin.endsWith("i")) {
      const base = latin.slice(0, -1);
      latin = /^(sh|ch|j)$/.test(base) ? base + SMALL_Y[next] : `${base}y${SMALL_Y[next]}`;
      i++;
    } else if (SMALL_VOWEL[next] && latin.length > 1) {
      // Katakana extensions: ファ fa, ティ ti, シェ she, ウィ wi …
      const base = latin === "fu" ? "f" : latin.replace(/[aeiou]+$/, "") || "w";
      latin = base + SMALL_VOWEL[next];
      i++;
    } else if (SMALL_VOWEL[next] && latin === "u") {
      latin = `w${SMALL_VOWEL[next]}`;
      i++;
    }
    if (geminate) {
      latin = latin.startsWith("ch") ? `t${latin}` : latin.charAt(0) + latin;
      geminate = false;
    }
    out += latin;
  }
  return capitalizeWords(out);
}

/* ------------------------------------------------------------------ */
/*  Entry point                                                       */
/* ------------------------------------------------------------------ */

/**
 * Transliterate a name into Latin letters. `script` defaults to the name's
 * dominant script; `countryCode` picks the Cyrillic system (UA, BY, BG).
 * Returns null when the name cannot be fully transliterated.
 */
export function romanize(
  text: string,
  opts: { script?: Script; countryCode?: string | null } = {},
): string | null {
  const source = String(text ?? "").trim();
  if (!source) return null;
  const script = opts.script ?? detectScript(source);
  const country = (opts.countryCode ?? "").toUpperCase();
  let out: string | null;
  switch (script) {
    case "cyrillic":
      out = romanizeCyrillic(source, country);
      break;
    case "greek":
      out = romanizeGreek(source);
      break;
    case "hangul":
      out = romanizeHangul(source);
      break;
    case "japanese":
      out = romanizeKana(source);
      break;
    default:
      return null;
  }
  if (out == null) return null;
  const cleaned = out.replace(/\s+/g, " ").trim();
  // Only Latin letters may remain — nothing of the source script, no kanji.
  for (const s of scriptCounts(cleaned).keys()) if (s !== "latin") return null;
  return cleaned || null;
}
