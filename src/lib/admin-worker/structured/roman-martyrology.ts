/**
 * The Roman Martyrology of 1916 as a feast-day witness for the SAINT ingest,
 * and — narrowly — as the source of a short public-domain biography.
 *
 * The book is the Church's official roll of the saints commemorated on each
 * day, in the English edition printed at Baltimore in 1916 (public domain).
 * `data/roman-martyrology-1916.json` holds its announcements by day, built
 * from the Internet Archive's OCR (see `roman-martyrology-parse.ts`).
 *
 * WHAT IT MAY SAY. Only one thing: "on Wikidata's feast day, the 1916 book
 * commemorates this saint". The book is consulted for the P841 day alone, and
 * the saint must be named there UNAMBIGUOUSLY:
 *   - as a SUBJECT of an announcement — the person the announcement is about
 *     ("At Souvigny, St. Odilo, abbot of Cluny, who …"), never a person it
 *     merely mentions ("… the priest who converted St. Cyprian", "in the
 *     monastery of St. Claude", "under the governor Tiburtius");
 *   - by the English name Wikidata uses: the first name as a subject, and
 *     every other word of the label ("Cluny", "Chrysostom") in the same
 *     announcement;
 *   - exactly once on that day; and a one-word name must be a subject on at
 *     most three days of the whole year ("Eugendus" is on one), so a common
 *     name ("Felix" is on 52, "Peter" on 51) never matches on its own;
 *   - with the honorific Wikidata's stage implies: a Blessed must be
 *     "blessed" in the book (the 1916 translation also calls many saints
 *     "blessed", so a canonized saint may carry either).
 * An announcement that sends the saint's feast to ANOTHER day ("whose
 * festival is kept on the 14th of June") contradicts a P841 on this one: the
 * caller refuses the row. Anything less than all of this is silence, and
 * silence never corroborates.
 *
 * The 1916 days are the pre-1969 calendar's. The ingest asks this source only
 * when Wikipedia states no feast at all, and only accepts Wikidata's own day
 * — it can confirm P841, never supply or move a feast.
 *
 * AS A BIOGRAPHY the matched announcement is shown verbatim, and only when
 * the scan can be trusted to BE the book's text: no OCR debris or known
 * misreading, no word or name that looks misread, and no second announcement
 * run into it (`martyrologyBiography`). Short of that it may still
 * corroborate the feast; it is just not shown.
 */

import martyrologyJson from "./data/roman-martyrology-1916.json";
import { monthName, type ParsedFeast } from "./corroboration";
import type { CanonizationStatus } from "./saint-facts";

/** The source, as cited and credited. */
export const MARTYROLOGY_1916 = {
  id: "roman-martyrology-1916",
  title: "The Roman Martyrology (1916)",
  url: "https://archive.org/details/romanmartyrology00cathuoft",
} as const;

export interface MartyrologyIndex {
  /** "MM-DD" → that day's announcements, in the book's order. */
  days: Readonly<Record<string, readonly string[]>>;
}

const VENDORED = martyrologyJson as unknown as MartyrologyIndex;

/** The committed 1916 index. */
export function martyrology1916(): MartyrologyIndex {
  return VENDORED;
}

/* ── Names ─────────────────────────────────────────────────────────────── */

/** Case-, accent- and ligature-folded form of a name or word. */
export function foldName(s: string): string {
  return s
    .replace(/æ/g, "ae")
    .replace(/Æ/g, "Ae")
    .replace(/œ/g, "oe")
    .replace(/Œ/g, "Oe")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

const LABEL_HONORIFICS = new Set([
  "saint",
  "saints",
  "st",
  "sts",
  "ss",
  "blessed",
  "bl",
  "venerable",
  "ven",
  "pope",
]);
const NAME_PARTICLES = new Set([
  "of",
  "the",
  "de",
  "da",
  "di",
  "del",
  "della",
  "dei",
  "degli",
  "von",
  "van",
  "der",
  "den",
  "du",
  "des",
  "la",
  "le",
  "y",
  "e",
  "and",
  "et",
  "el",
  "al",
]);

export interface LabelName {
  /** The first name, folded ("odilo"). */
  given: string;
  /** Every other significant word of the label, folded (["cluny"]). */
  others: string[];
}

/**
 * The words of a Wikidata label the Martyrology must show: "Odilo of Cluny"
 * → given "odilo", others ["cluny"]. Honorifics and particles are not
 * names; a parenthesis ("John Felton (martyr)") is a disambiguator, not part
 * of the name. Null when nothing usable remains.
 */
export function labelName(label: string): LabelName | null {
  const tokens = foldName(label)
    .replace(/\([^)]*\)/g, " ")
    .replace(/\bservant of god\b/g, " ")
    .split(/[^a-z]+/)
    .filter(Boolean);
  while (tokens.length > 0 && LABEL_HONORIFICS.has(tokens[0])) tokens.shift();
  const given = tokens[0];
  if (!given || given.length < 3) return null;
  const others = tokens
    .slice(1)
    .filter((t) => !NAME_PARTICLES.has(t) && !LABEL_HONORIFICS.has(t))
    .filter((t) => t.length >= 3 || /^[ivx]+$/.test(t));
  return { given, others };
}

/* ── Who an announcement is about ──────────────────────────────────────── */

export interface AnnouncementSubjects {
  /** Folded names of the people the announcement is about. */
  names: string[];
  /** The honorific the book gives them. */
  honorific: "saint" | "blessed";
}

/** Words that open a group of subjects: "St.", "the Saints", "blessed", "holy". */
const TRIGGER_RE = /(^|[\s(,])(Sts?\.?|SS\.|Saints?|Bl\.|[Bb]lessed|[Hh]oly|[Ss]aintly)(?=\s)/g;
/**
 * A trigger right after one of these words names a place, a feast, a relic or
 * a relation — "the monastery of St. Claude", "the Octave of St. Stephen",
 * "the translation of St. Ignatius", "converted by St. Germanus" — not the
 * person the announcement is about.
 */
const NOT_A_SUBJECT_BEFORE_RE =
  /\b(?:(?:monastery|monasteries|church|churches|basilica|abbey|order|octave|feast|festival|vigil|oratory|cemetery|chapel|convent|hospital|diocese|priory|college|congregation|rule|isle|island|town|village|city|mount|hill|district|territory|institute|society|translation|relics|body|bodies|head|tomb|shrine|altar|disciple|disciples|successor|sister|brother|mother|father|son|daughter|wife|husband|pupil|companion|companions|nephew|niece)\s+of|by|from|to|with|through|under|before|after|upon)\s+(?:the\s+)?(?:(?:pope|bishop|apostle|abbot|holy|blessed)\s+)?$/i;

/** Lower-case words allowed between the trigger and the names, and among them. */
const SUBJECT_FILLER = new Set([
  "a",
  "an",
  "the",
  "his",
  "her",
  "their",
  "and",
  "also",
  "pope",
  "bishop",
  "bishops",
  "archbishop",
  "priest",
  "priests",
  "presbyter",
  "deacon",
  "deacons",
  "subdeacon",
  "archdeacon",
  "lector",
  "exorcist",
  "acolyte",
  "cleric",
  "monk",
  "monks",
  "nun",
  "hermit",
  "anchoret",
  "anchorite",
  "abbot",
  "abbess",
  "prior",
  "virgin",
  "virgins",
  "martyr",
  "martyrs",
  "confessor",
  "confessors",
  "widow",
  "matron",
  "soldier",
  "soldiers",
  "centurion",
  "tribune",
  "officer",
  "notary",
  "king",
  "queen",
  "physician",
  "physicians",
  "brother",
  "brothers",
  "sister",
  "sisters",
  "son",
  "sons",
  "daughter",
  "daughters",
  "wife",
  "husband",
  "mother",
  "father",
  "children",
  "child",
  "boys",
  "boy",
  "girls",
  "maiden",
  "youth",
  "young",
  "man",
  "men",
  "woman",
  "women",
  "companions",
  "companion",
  "others",
  "disciple",
  "disciples",
  "apostle",
  "apostles",
  "evangelist",
  "prophet",
  "prophets",
  "doctor",
  "patriarch",
  "cardinal",
  "prince",
  "princess",
  "citizen",
  "citizens",
  "senator",
  "layman",
  "infant",
  "infants",
  "holy",
  "blessed",
  "saintly",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "many",
  "several",
  // Name particles, kept only when a capitalised word follows ("John de Matha").
  "de",
  "da",
  "di",
  "del",
  "della",
  "von",
  "van",
  "du",
  "le",
  "la",
]);

/** Abbreviations whose full stop does not end the sentence. */
const ABBREVIATIONS = new Set(["st", "sts", "ss", "bl", "ven", "mt", "fr"]);

/** Capitalised words inside a subject group that are honorifics, not names. */
const NOT_A_NAME = new Set(["st", "sts", "ss", "saint", "saints", "bl", "the", "our", "lord"]);

const WORD_RE = /[A-Za-zÀ-ÖØ-öø-ÿĀ-ž'’]+(?:-[A-Za-zÀ-ÖØ-öø-ÿĀ-ž'’]+)*\.?|[,;:()]|\S/g;

function isCapitalised(word: string): boolean {
  return /^[A-ZÀ-ÖØ-ÞĀ-Ž]/.test(word);
}

/**
 * Read the names of a subject group from `text`, which starts just after the
 * group's trigger. Stops at the end of the sentence, at ";" or ":", at a
 * relative clause or verb ("who", "whose", "was"), or at a preposition
 * ("under", "in", "with"). Capitalised words after "of" are a qualifier
 * ("abbot of Cluny"), not subjects.
 */
function readSubjectNames(text: string): string[] {
  const names: string[] = [];
  let afterOf = false;
  for (const m of text.matchAll(WORD_RE)) {
    const raw = m[0];
    if (raw === "," || raw === "(" || raw === ")") {
      afterOf = false;
      continue;
    }
    if (raw === ";" || raw === ":") break;
    const endsWithStop = raw.length > 1 && raw.endsWith(".");
    const word = endsWithStop ? raw.slice(0, -1) : raw;
    if (!/[A-Za-zÀ-ž]/.test(word)) break;
    const lower = foldName(word);
    const abbreviation = ABBREVIATIONS.has(lower) || /^[IVX]+$/.test(word);
    if (lower === "of") {
      afterOf = true;
      continue;
    }
    if (isCapitalised(word)) {
      // A capitalised title ("the holy Apostles Peter and Paul") is not a name.
      if (!afterOf && !NOT_A_NAME.has(lower) && !SUBJECT_FILLER.has(lower)) names.push(lower);
    } else if (afterOf) {
      // "bishop of that city": an uncapitalised qualifier ends the group.
      break;
    } else if (!SUBJECT_FILLER.has(lower)) {
      break;
    }
    if (endsWithStop && !abbreviation) break;
  }
  return names;
}

/**
 * Who an announcement is ABOUT: the first group of names introduced by a
 * saint's honorific that is not a place, feast, relic or relation. Also reads
 * the day's first announcement, whose opening the drop capital mangles ("T.
 * JOHN of Capistran" for "ST. JOHN …"). Null when it names nobody.
 */
export function announcementSubjects(
  entry: string,
  firstOfDay = false,
): AnnouncementSubjects | null {
  if (firstOfDay) {
    const m = /^[^A-Za-z]*(?:S?T\.|\.|0\s*T\.)\s*([A-Z]{3,})\b/.exec(entry);
    if (m) {
      const rest = entry.slice((m.index ?? 0) + m[0].length - m[1].length);
      const names = readSubjectNames(rest);
      if (names.length > 0) return { names, honorific: "saint" };
    }
  }
  for (const m of entry.matchAll(TRIGGER_RE)) {
    const at = (m.index ?? 0) + m[1].length;
    const before = entry.slice(Math.max(0, at - 60), at);
    if (NOT_A_SUBJECT_BEFORE_RE.test(before)) continue;
    const names = readSubjectNames(entry.slice(at + m[2].length));
    if (names.length === 0) continue;
    const honorific = /^(?:bl\.|blessed)$/i.test(m[2]) ? "blessed" : "saint";
    return { names, honorific };
  }
  return null;
}

/* ── The feast-day verdict ─────────────────────────────────────────────── */

const MONTH_INDEX: Record<string, number> = Object.fromEntries(
  Array.from({ length: 12 }, (_, i) => [monthName(i + 1).toLowerCase(), i + 1]),
);

/** "on the 14th of June" / "on the 30th of this month" / "on the 17th". */
const ON_THE_DAY = String.raw`on\s+the\s+(\d{1,2})(?:st|nd|rd|d|th)\b(?:\s+of\s+(this month|[A-Za-z]+))?`;
/**
 * "whose festival is kept on …", "His feast is more especially celebrated
 * on …", "ordered his festival to be kept on …", "permitted her feast to be
 * celebrated on …".
 */
const FEAST_KEPT_ON_RE = new RegExp(
  String.raw`\b(?:feast|festival|solemnity)\b[^.;]{0,60}?\b(?:(?:is|are)\s+(?:(?:now|more|especially|chiefly|principally|particularly|also)\s+)*|to\s+be\s+)(?:kept|celebrated|observed|held)\b[^.;]{0,25}?\b${ON_THE_DAY}`,
  "i",
);
/** "St. Adrian is especially commemorated on the 8th of September". */
const ESPECIALLY_ON_RE = new RegExp(
  String.raw`\b(?:is|are)\s+(?:more\s+)?(?:especially|chiefly|principally|particularly)\s+(?:commemorated|celebrated|honou?red|venerated|kept)\b[^.;]{0,25}?\b${ON_THE_DAY}`,
  "i",
);

/**
 * The day an announcement sends this saint's feast to, when it says so:
 * "whose festival is kept on the 14th of June", "Her feast is kept on the
 * 30th of this month", "His feast, by order of Pope Innocent XI., is
 * celebrated on the 13th of October", "St. Adrian is especially commemorated
 * on the 8th of September", "permitted her feast to be celebrated on the 17th
 * of this month". ("Who is mentioned on the 23d of October", or "the festival
 * of St. Jane … who is commemorated on the 13th of December", is the
 * opposite: the announcement IS the feast, and the death-day notice is
 * elsewhere.) `day` is the announcement's own "MM-DD".
 */
export function feastSentElsewhere(entry: string, day: string): string | null {
  // An abbreviation's full stop ("Innocent XI.", "St.") does not end the
  // sentence the feast is named in.
  const text = entry.replace(/\b([IVXLC]+|Sts?|SS|Bl|Ven|Mt|Fr)\./g, "$1");
  const m = FEAST_KEPT_ON_RE.exec(text) ?? ESPECIALLY_ON_RE.exec(text);
  if (!m) return null;
  const d = Number(m[1]);
  const monthWord = (m[2] ?? "this month").toLowerCase();
  const month = monthWord === "this month" ? Number(day.slice(0, 2)) : MONTH_INDEX[monthWord];
  if (!month || d < 1 || d > 31) return "elsewhere";
  return `${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export interface MartyrologyMatch {
  /** "MM-DD" of the announcement. */
  day: string;
  /** The announcement, as printed (OCR text). */
  entry: string;
  /** Its position in the day (0 = the day's first, drop-capital announcement). */
  position: number;
  honorific: "saint" | "blessed";
}

export type MartyrologyVerdict =
  | { kind: "corroborated"; match: MartyrologyMatch }
  | { kind: "contradicted"; match: MartyrologyMatch; detail: string }
  | { kind: "silent"; detail: string };

/** Per index: folded name → the days on which it is a subject. */
const subjectDaysCache = new WeakMap<MartyrologyIndex, Map<string, Set<string>>>();

function subjectDays(index: MartyrologyIndex): Map<string, Set<string>> {
  let map = subjectDaysCache.get(index);
  if (map) return map;
  map = new Map();
  for (const [day, entries] of Object.entries(index.days)) {
    entries.forEach((entry, i) => {
      for (const name of announcementSubjects(entry, i === 0)?.names ?? []) {
        const days = map!.get(name) ?? new Set<string>();
        days.add(day);
        map!.set(name, days);
      }
    });
  }
  subjectDaysCache.set(index, map);
  return map;
}

function entryWords(entry: string): Set<string> {
  return new Set(
    foldName(entry)
      .split(/[^a-z]+/)
      .filter(Boolean),
  );
}

/**
 * The 1916 translation's spelling of places Wikidata's labels spell the
 * modern way ("Severus of Trier" — "At Treves, St. Severus").
 */
const PLACE_SPELLINGS: Readonly<Record<string, readonly string[]>> = {
  trier: ["treves"],
  lyon: ["lyons"],
  reims: ["rheims"],
  cordoba: ["cordova"],
  sevilla: ["seville"],
  castille: ["castile"],
  montecassino: ["cassino"],
  canosa: ["canossa"],
  fiesole: ["fiesoli"],
  urgell: ["urgel"],
  marseille: ["marseilles"],
};

function wordPresent(words: ReadonlySet<string>, word: string): boolean {
  return words.has(word) || (PLACE_SPELLINGS[word] ?? []).some((w) => words.has(w));
}

/**
 * How many days a one-word name may be a subject on and still identify its
 * saint. Four or more ("Felix" is on 52 days, "Mark" on 15) and the day alone
 * would be what picked the person; up to three, Wikidata's own feast day plus
 * the name single out one announcement.
 */
export const MAX_DAYS_FOR_A_BARE_NAME = 3;

/**
 * Does the 1916 Martyrology commemorate this saint on Wikidata's feast day?
 * See the module comment for every condition. `feast` is the ONE P841 value
 * being tested — the caller never asks with several.
 */
export function martyrologyFeastVerdict(input: {
  label: string;
  feast: ParsedFeast;
  status: CanonizationStatus;
  index?: MartyrologyIndex;
}): MartyrologyVerdict {
  const index = input.index ?? VENDORED;
  const name = labelName(input.label);
  if (!name) return { kind: "silent", detail: "label has no usable name" };
  const day = input.feast.feastDay;
  const entries = index.days[day] ?? [];

  const hits: MartyrologyMatch[] = [];
  let repeated = false;
  entries.forEach((entry, position) => {
    const subjects = announcementSubjects(entry, position === 0);
    if (!subjects) return;
    const times = subjects.names.filter((n) => n === name.given).length;
    if (times === 0) return;
    // Two people of the name in one announcement ("the holy martyrs Felix,
    // bishop, and Felix, priest") is as ambiguous as two announcements.
    if (times > 1) repeated = true;
    hits.push({ day, entry, position, honorific: subjects.honorific });
  });
  if (hits.length === 0) {
    return { kind: "silent", detail: `no announcement on ${day} is about ${name.given}` };
  }
  if (hits.length > 1 || repeated) {
    return { kind: "silent", detail: `${day} names ${name.given} more than once` };
  }
  const match = hits[0];

  const words = entryWords(match.entry);
  const missing = name.others.filter((w) => !wordPresent(words, w));
  if (missing.length > 0) {
    return { kind: "silent", detail: `${day} names ${name.given} without ${missing.join(", ")}` };
  }
  if (name.others.length === 0) {
    const daysNamed = subjectDays(index).get(name.given)?.size ?? 0;
    if (daysNamed > MAX_DAYS_FOR_A_BARE_NAME) {
      return { kind: "silent", detail: `${name.given} is a subject on ${daysNamed} days` };
    }
  }
  if (input.status === "beatified" && match.honorific !== "blessed") {
    return { kind: "silent", detail: `Wikidata says Blessed, the book says Saint (${day})` };
  }
  const elsewhere = feastSentElsewhere(match.entry, day);
  if (elsewhere && elsewhere !== day) {
    return {
      kind: "contradicted",
      match,
      detail: `the 1916 Martyrology keeps the feast on ${elsewhere}, not ${day}`,
    };
  }
  return { kind: "corroborated", match };
}

/* ── The announcement as a biography ───────────────────────────────────── */

/**
 * Can this announcement be shown as printed? Its OCR must read cleanly: an
 * ordinary opening ("At Rome,", "In Africa,", "The same day,", "St."), no
 * scanner debris, no letters mixed with digits or capitals inside a word
 * ("ErmiDus"), no word broken across a line the OCR could not mend ("Alba-
 * Begale"), and none of the OCR's known misreadings — the æ ligature read as
 * "se" ("Csesarea"), R read as K, E or H ("Kome", "Eoman", "At Home"), "Ni"
 * read as "Mc" ("Mcomedia"), Æ read as "JE" ("JEtherius"), and the common
 * misreadings of "the", "and", "his", "who", "of". Proper nouns misread in
 * other ways are `capitalisedMisreadings`' business.
 */
export function announcementReadsCleanly(entry: string): boolean {
  if (!/^(?:[A-Z][a-z]+[\s,]|St\.\s)/.test(entry)) return false;
  if (/[^A-Za-zÀ-ÖØ-öø-ÿĀ-ž0-9\s.,;:'’"“”()!?-]/.test(entry)) return false;
  if (/[a-z][A-Z]/.test(entry)) return false;
  // Two capitals opening a lower-case word: "JEtherius", "OJympiades" (Æ, l).
  if (/\b[A-Z]{2,}[a-z]/.test(entry)) return false;
  // "Ni" read as "Mc": "Mcomedia", "Mcaea", "Mcopolis".
  if (/\bMc[a-z]/.test(entry)) return false;
  if (/[A-Za-z]\d|\d(?!(?:st|nd|rd|d|th)\b)[A-Za-z]/.test(entry)) return false;
  if (/[A-Za-z]- [A-Za-z]/.test(entry)) return false;
  if (
    /Cs[aeiou]|\b(?:Eom|Kom|Hom)[ae]n|\b(?:Eome|Kome)\b|\bAt Home\b|\b(?:tlie|tbe|aiid|liis|wlio|wliich|ol)\b/.test(
      entry,
    )
  ) {
    return false;
  }
  // Two spaced capitals: a drop capital the OCR split ("A T Carthage").
  if (/\b[A-Z] [A-Z]\b/.test(entry)) return false;
  return true;
}

/** Per index: how often each lower-case word occurs in the whole book. */
const wordCountCache = new WeakMap<MartyrologyIndex, Map<string, number>>();

function bookWordCounts(index: MartyrologyIndex): Map<string, number> {
  let counts = wordCountCache.get(index);
  if (counts) return counts;
  counts = new Map();
  for (const entries of Object.values(index.days)) {
    for (const entry of entries) {
      for (const w of entry.match(/\b[a-z]+\b/g) ?? []) counts.set(w, (counts.get(w) ?? 0) + 1);
    }
  }
  wordCountCache.set(index, counts);
  return counts;
}

/**
 * Lower-case words of an announcement that occur nowhere else in the book.
 * The OCR's misreadings are mostly one-offs ("the abboc St. Stephen", "his
 * sould"), while the book's own vocabulary repeats; a word seen once is
 * treated as a possible misreading. This also holds back some correct rare
 * words — the announcement then corroborates, but is not shown.
 */
export function wordsSeenOnce(entry: string, index: MartyrologyIndex = VENDORED): string[] {
  const counts = bookWordCounts(index);
  return (entry.match(/\b[a-z]{3,}\b/g) ?? []).filter((w) => (counts.get(w) ?? 0) < 2);
}

/**
 * A word with the glyphs the scan confuses collapsed to one form, so that a
 * misread name meets the name it was misread from: R or N read as K, B, E, H
 * or M at the start of a word ("Kouen", "Borne", "Eavenna", "Kicaea"), "Mc"
 * for "Ni", Y for V ("Yalens"), u and n ("Panl", "Donatns", "Columbau"), m
 * read as rn, in or ni ("Korne", "Koine", "Doinitian"), the æ and œ
 * ligatures read as se, ce or te ("Csesarea", "Ctesar"), and a final c read
 * as e ("Habacue").
 */
export function ocrSkeleton(word: string): string {
  return foldName(word)
    .replace(/^mc/, "ni")
    .replace(/^[behkmnr]/, "r")
    .replace(/^y/, "v")
    .replace(/u/g, "n")
    .replace(/rn|in|ni/g, "m")
    .replace(/ae|oe|se|ce|te/g, "e")
    .replace(/c$/, "e");
}

const CAPITALISED_WORD_RE = /\b[A-Z][a-z]+\b/g;

interface CapitalisedVocabulary {
  /** How often each capitalised word occurs in the whole book. */
  counts: Map<string, number>;
  /** Per OCR skeleton, the capitalised word the book prints most often. */
  commonest: Map<string, { word: string; count: number }>;
}

const capitalisedCache = new WeakMap<MartyrologyIndex, CapitalisedVocabulary>();

function capitalisedVocabulary(index: MartyrologyIndex): CapitalisedVocabulary {
  let vocabulary = capitalisedCache.get(index);
  if (vocabulary) return vocabulary;
  const counts = new Map<string, number>();
  for (const entries of Object.values(index.days)) {
    for (const entry of entries) {
      for (const w of entry.match(CAPITALISED_WORD_RE) ?? [])
        counts.set(w, (counts.get(w) ?? 0) + 1);
    }
  }
  const commonest = new Map<string, { word: string; count: number }>();
  for (const [word, count] of counts) {
    const key = ocrSkeleton(word);
    const best = commonest.get(key);
    if (!best || count > best.count) commonest.set(key, { word, count });
  }
  vocabulary = { counts, commonest };
  capitalisedCache.set(index, vocabulary);
  return vocabulary;
}

/**
 * Capitalised words of an announcement that are probably the OCR's misreading
 * of a name the book prints more often in another form: "At Borne" (20 times
 * in the index, "Rome" 270), "Kogatus" (Rogatus), "Yalens" (Valens), "Kicaea"
 * (Nicaea). Names are what `wordsSeenOnce` cannot judge — a place may well be
 * named once — so a name is held suspect only when it is a scan-confusion of a
 * commoner one. That also holds back a few correct spellings whose misreading
 * happens to be commoner ("Robert" beside "Kobert"): such an announcement
 * still corroborates a feast, it is only not shown.
 */
export function capitalisedMisreadings(
  entry: string,
  index: MartyrologyIndex = VENDORED,
): string[] {
  const { counts, commonest } = capitalisedVocabulary(index);
  const out: string[] = [];
  for (const word of entry.match(CAPITALISED_WORD_RE) ?? []) {
    const best = commonest.get(ocrSkeleton(word));
    if (best && best.word !== word && best.count > (counts.get(word) ?? 0)) out.push(word);
  }
  return out;
}

/**
 * A sentence that opens a NEW announcement — on a place ("In Pannonia, …",
 * "At Riez, …"), a monastery or "the same city", or "Also, …" / "The same
 * day, …" — inside what the parser read as one: the dash between two
 * announcements was lost in the scan, and the text after it is about other
 * people. ("In the persecution of …", "At last …", "At the age of …" go on
 * with the same announcement.)
 */
const NEXT_ANNOUNCEMENT_RE =
  /[.!?]["')]?\s+(?:(?:At|In|Near)\s+(?:[A-Z]|the\s+(?:same\s+(?:city|place|country|town|island|province|territory|day)|monastery|diocese|territory|neighbou?rhood|province|island|city|town|village)\b)|(?:Also|The same day|On the same day)\b)/;

/** Does the announcement run on into the next one (see NEXT_ANNOUNCEMENT_RE)? */
export function runsIntoNextAnnouncement(entry: string): boolean {
  return NEXT_ANNOUNCEMENT_RE.test(entry);
}

/** Shortest announcement shown as a biography (the SAINT schema's floor). */
export const MARTYROLOGY_BIOGRAPHY_MIN_CHARS = 100;

/**
 * The announcement as a biography, verbatim — only when it reaches the
 * biography floor, reads cleanly, carries no word the book uses only once
 * and no name that looks like a misreading of a commoner one, and is ONE
 * announcement (not two the scan ran together). Null otherwise: such an
 * announcement can still corroborate a feast, but it is never shown — the
 * page credits the text to the 1916 book, so it must be the book's text.
 */
export function martyrologyBiography(
  match: MartyrologyMatch,
  index: MartyrologyIndex = VENDORED,
): string | null {
  const text = match.entry.trim();
  if (text.length < MARTYROLOGY_BIOGRAPHY_MIN_CHARS) return null;
  if (!announcementReadsCleanly(text)) return null;
  if (wordsSeenOnce(text, index).length > 0) return null;
  if (capitalisedMisreadings(text, index).length > 0) return null;
  if (runsIntoNextAnnouncement(text)) return null;
  return text;
}
