/**
 * Pure helpers for checking the liturgical-calendar engine against external
 * ground truth (the USCCB annual liturgical calendars and the USCCB-derived
 * daily-readings dataset). Shared by scripts/lectionary/check-calendar.ts and
 * the golden tests; no I/O here.
 *
 * Two independent agreement signals are used per date:
 *   1. the celebration TITLE (fuzzy: rank prefixes, Mass variants, spelled
 *      ordinals, diacritics and stop-words are normalised away);
 *   2. the LECTIONARY NUMBER of the Mass (the Lectionary for Mass numbers its
 *      formularies; the Proper of Time numbers follow arithmetic patterns and
 *      the Proper of Saints numbers are a fixed table).
 */

import type { LiturgicalDayDetail } from "../../src/lib/content-shared/liturgical-calendar";

// ─────────────────────────────────────────────────────────────────────────────
// Title normalisation
// ─────────────────────────────────────────────────────────────────────────────

const ORDINAL_WORDS: Record<string, number> = {
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  tenth: 10,
  eleventh: 11,
  twelfth: 12,
  thirteenth: 13,
  fourteenth: 14,
  fifteenth: 15,
  sixteenth: 16,
  seventeenth: 17,
  eighteenth: 18,
  nineteenth: 19,
  twentieth: 20,
  thirtieth: 30,
};
const TENS: Record<string, number> = { twenty: 20, thirty: 30 };

const STOP_WORDS = new Set([
  "the",
  "of",
  "in",
  "and",
  "a",
  "an",
  "or",
  "to",
  "for",
  "at",
  "on",
  "with",
  "within",
  "our",
  "its",
]);

const PHRASE_ALIASES: Array<[RegExp, string]> = [
  [/&#0?39;|’|‘/g, "'"],
  [/\busa:\s*/g, ""],
  [/\bst\.\s*/g, "saint "],
  [/\bsts\.\s*/g, "saints "],
  [/\[[^\]]*\]/g, " "],
  [/\([^)]*\)/g, " "],
  [/\bnativity of the lord\b/g, "christmas"],
  [/\boctave day of christmas\b/g, ""],
  [/\boctave day of the christmas\b/g, ""],
  [/\bmass during the (day|night)\b/g, " "],
  [/\bmass at dawn\b/g, " "],
  [/\bextended vigil\b/g, " "],
  [/\bvigil mass\b/g, " "],
  [/\bat the easter vigil in the holy night of easter\b/g, " easter vigil "],
  [/\bthe mass of easter day\b/g, " "],
  [/\bthe resurrection of the lord\b/g, " easter sunday "],
  [/\bevening mass of the lord's supper\b/g, " "],
  [/\bchrism mass\b/g, " "],
  [/\bus celebration\b/g, " "],
  [/\bin the dioceses of the united states\b/g, " "],
  [/\bthanksgiving day\b/g, " thanksgiving "],
  [/^\s*(the\s+)?(solemnity|feast|memorial|optional memorial|commemoration)\s+of\s+(the\s+)?/, ""],
  [/\bkateri tekakwitha\b/g, "kateri tekakwitha"],
];

/** Lower-case, strip diacritics, apply phrase aliases, numeralise ordinals. */
export function normaliseTitle(raw: string): string {
  let s = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/([a-z)])\d+\b/g, "$1")
    .replace(/\boprdinary\b/g, "ordinary") // typo in the USCCB 2028 calendar PDF
    .replace(/\s+/g, " ")
    .trim();
  for (const [re, rep] of PHRASE_ALIASES) s = s.replace(re, rep);
  // "twenty-third" / "twenty third" → 23; "thirtieth" → 30; "3rd" → 3.
  s = s.replace(/\b(twenty|thirty)[- ]([a-z]+)\b/g, (m, tens: string, unit: string) => {
    const u = ORDINAL_WORDS[unit];
    return u !== undefined && u < 10 ? String(TENS[tens] + u) : m;
  });
  s = s.replace(/\b([a-z]+)\b/g, (m) =>
    ORDINAL_WORDS[m] !== undefined ? String(ORDINAL_WORDS[m]) : m,
  );
  s = s.replace(/\b(\d+)(st|nd|rd|th)\b/g, "$1");
  return s
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function titleTokens(raw: string): string[] {
  const seen = new Set<string>();
  for (const tok of normaliseTitle(raw).split(" ")) {
    if (tok && !STOP_WORDS.has(tok)) seen.add(tok);
  }
  return [...seen];
}

/** Alternative names the sources use for some Proper-of-Time keys. */
const KEY_ALIASES: Record<string, string[]> = {
  "easter-sunday": ["Easter Sunday", "The Resurrection of the Lord"],
  "easter-vigil": ["Holy Saturday", "Easter Vigil"],
  "holy-thursday": ["Holy Thursday", "Thursday of Holy Week", "Chrism Mass"],
  "good-friday": ["Good Friday", "Friday of the Passion of the Lord"],
  // USCCB pages for the US Sunday Ascension also carry the 7th Sunday of
  // Easter (the Thursday provinces), and vice versa on the Thursday.
  ascension: ["Ascension", "Seventh Sunday of Easter"],
  "palm-sunday": ["Palm Sunday"],
  "christ-the-king": ["Christ the King", "Our Lord Jesus Christ, King of the Universe"],
  "corpus-christi": ["Corpus Christi", "Body and Blood of Christ"],
  "sacred-heart": ["Sacred Heart of Jesus"],
  "mary-mother-of-god": ["Mary, the Holy Mother of God", "Mary, Mother of God"],
  "immaculate-heart": ["Immaculate Heart of Mary"],
  "st-joseph": ["Saint Joseph, husband of the Blessed Virgin Mary"],
  "all-souls": ["All Souls", "Commemoration of All the Faithful Departed"],
  "mary-mother-of-the-church": ["Blessed Virgin Mary, Mother of the Church"],
  "guardian-angels": ["Guardian Angels"],
  "sts-cornelius-and-cyprian": ["Saints Cornelius, Pope, and Saint Cyprian, Bishop, Martyrs"],
  "st-irenaeus": ["Saint Irenaeus, Bishop and Martyr and Doctor of the Church"],
};

/** Words that carry no identity on their own (titles, ranks, honorifics). */
const GENERIC_TOKENS = new Set([
  "saint",
  "saints",
  "st",
  "blessed",
  "virgin",
  "virgins",
  "martyr",
  "martyrs",
  "bishop",
  "bishops",
  "priest",
  "priests",
  "doctor",
  "doctors",
  "church",
  "religious",
  "pope",
  "abbot",
  "apostle",
  "apostles",
  "evangelist",
  "deacon",
  "companions",
  "lord",
  "holy",
  "most",
  "jesus",
  "mary",
  "sunday",
  "week",
  "weekday",
  "day",
  "mass",
  "solemnity",
  "feast",
  "memorial",
  "commemoration",
  "parents",
  "monk",
  "first",
]);

// "sunday" is deliberately not an anchor: Sunday pages combine titles
// ("… Easter Vigil … Easter Sunday …") and the week number anchors them anyway.
const DOW_TOKENS = new Set(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]);

function anchorTokens(tokens: string[]): string[] {
  return tokens.filter((t) => /^\d+$/.test(t) || DOW_TOKENS.has(t));
}

function distinctive(tokens: string[]): string[] {
  return tokens.filter((t) => !GENERIC_TOKENS.has(t));
}

function subset(a: string[], b: Set<string>): boolean {
  return a.length > 0 && a.every((t) => b.has(t));
}

function jaccard(a: string[], b: string[]): number {
  const A = new Set(a);
  const B = new Set(b);
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

/**
 * Do two token sets denote the same celebration?
 *  - one is a subset of the other, provided every number/weekday "anchor" of
 *    the larger set is present in the smaller one ("Easter Monday" ⊂ "Monday
 *    within the Octave of Easter", but "Easter Sunday" ⊄ "2nd Sunday of
 *    Easter");
 *  - otherwise, for names without anchors, the distinctive (non-generic)
 *    tokens overlap by at least half and share at least one token ("Saint
 *    Agnes, Virgin and Martyr" never matches "Saint Agatha, Virgin and
 *    Martyr").
 */
function tokensMatch(eng: string[], src: string[]): boolean {
  const engSet = new Set(eng);
  const srcSet = new Set(src);
  if (subset(eng, srcSet) && anchorTokens(src).every((t) => engSet.has(t))) return true;
  if (subset(src, engSet) && anchorTokens(eng).every((t) => srcSet.has(t))) return true;
  if (anchorTokens(eng).length > 0 || anchorTokens(src).length > 0) return false;
  const de = distinctive(eng);
  const ds = distinctive(src);
  if (de.length === 0 || ds.length === 0) return false;
  return jaccard(de, ds) >= 0.5;
}

/** Does a source title denote the same celebration as the engine's day? */
export function titleMatches(day: LiturgicalDayDetail, sourceTitle: string): boolean {
  if (genericFerialSeason(sourceTitle)) return false; // judged with the season + number
  const src = titleTokens(sourceTitle);
  if (src.length === 0) return false;
  const candidates = [day.celebration, ...(KEY_ALIASES[day.lectionaryKey] ?? [])];
  if (day.sanctoral) candidates.push(...(KEY_ALIASES[day.sanctoral.key] ?? []));
  for (const cand of candidates) {
    const eng = titleTokens(cand);
    if (eng.length > 0 && tokensMatch(eng, src)) return true;
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Lectionary numbers (Lectionary for Mass, 2nd typical edition, USA)
// ─────────────────────────────────────────────────────────────────────────────

const DOW_INDEX: Record<string, number> = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const SANCTORAL_NUMBERS: Record<string, number[]> = {
  "st-stephen": [696],
  "st-john-apostle": [697],
  "holy-innocents": [698],
  "conversion-of-st-paul": [519],
  "sts-timothy-and-titus": [520],
  presentation: [524],
  "chair-of-st-peter": [535],
  "st-joseph": [543],
  annunciation: [545],
  "st-mark": [555],
  "sts-philip-and-james": [561],
  "st-matthias": [564],
  visitation: [572],
  "mary-mother-of-the-church": [572],
  "immaculate-heart": [573],
  "st-barnabas": [580],
  "nativity-of-john-the-baptist": [586, 587],
  "sts-peter-and-paul": [590, 591],
  "st-thomas-apostle": [593],
  "st-mary-magdalene": [603],
  "st-james": [605],
  "sts-martha-mary-and-lazarus": [607],
  transfiguration: [614],
  "st-lawrence": [618],
  assumption: [621, 622],
  "st-bartholomew": [629],
  "passion-of-john-the-baptist": [634],
  "nativity-of-mary": [636],
  "exaltation-of-the-cross": [638],
  "our-lady-of-sorrows": [639],
  "st-matthew": [643],
  archangels: [647],
  "guardian-angels": [650],
  "st-luke": [661],
  "sts-simon-and-jude": [666],
  "all-saints": [667],
  "all-souls": [668],
  "lateran-basilica": [671],
  "st-andrew": [684],
  "immaculate-conception": [689],
  "our-lady-of-guadalupe": [690],
};

function cycleIndex(c: string): number {
  return c === "A" ? 0 : c === "B" ? 1 : 2;
}

/** Lectionary numbers a Proper-of-Time key may carry (empty when unknown). */
export function temporalLectionaryNumbers(temporalKey: string, sundayCycle: string): number[] {
  const cyc = cycleIndex(sundayCycle);
  let m: RegExpMatchArray | null;
  if ((m = temporalKey.match(/^advent-(\d)-sunday$/))) return [1 + 3 * (Number(m[1]) - 1) + cyc];
  if ((m = temporalKey.match(/^advent-(\d)-([a-z]+)$/))) {
    return [175 + 6 * (Number(m[1]) - 1) + (DOW_INDEX[m[2]] - 1)];
  }
  if ((m = temporalKey.match(/^advent-12(\d\d)$/))) return [193 + (Number(m[1]) - 17)];
  if (temporalKey === "nativity") return [13, 14, 15, 16];
  if (temporalKey === "holy-family") return [17];
  if ((m = temporalKey.match(/^christmas-12(\d\d)$/))) {
    const d = Number(m[1]);
    return d >= 29 ? [202 + (d - 29)] : [];
  }
  if (temporalKey === "mary-mother-of-god") return [18];
  if (temporalKey === "christmas-2-sunday") return [19];
  if ((m = temporalKey.match(/^christmas-01(\d\d)$/))) return [205 + (Number(m[1]) - 2)];
  if (temporalKey === "epiphany") return [20];
  if ((m = temporalKey.match(/^after-epiphany-([a-z]+)$/))) return [212 + (DOW_INDEX[m[1]] - 1)];
  if (temporalKey === "baptism-of-the-lord") return [21];
  if (temporalKey === "ash-wednesday") return [219];
  if ((m = temporalKey.match(/^after-ashes-([a-z]+)$/))) return [216 + DOW_INDEX[m[1]]];
  if ((m = temporalKey.match(/^lent-(\d)-sunday$/))) {
    const w = Number(m[1]);
    // The Year A readings of the 3rd–5th Sundays of Lent (the scrutinies)
    // may be used in any year, and the USCCB pages list them.
    return w >= 3 ? [22 + 3 * (w - 1) + cyc, 22 + 3 * (w - 1)] : [22 + 3 * (w - 1) + cyc];
  }
  if ((m = temporalKey.match(/^lent-(\d)-([a-z]+)$/))) {
    return [[224, 230, 237, 244, 251][Number(m[1]) - 1] + (DOW_INDEX[m[2]] - 1)];
  }
  if (temporalKey === "palm-sunday") return [37, 38];
  if ((m = temporalKey.match(/^holy-week-([a-z]+)$/))) return [256 + DOW_INDEX[m[1]]];
  if (temporalKey === "holy-thursday") return [39, 260];
  if (temporalKey === "good-friday") return [40];
  if (temporalKey === "easter-vigil") return [41];
  if (temporalKey === "easter-sunday") return [42];
  if ((m = temporalKey.match(/^easter-octave-([a-z]+)$/))) return [260 + DOW_INDEX[m[1]]];
  if ((m = temporalKey.match(/^easter-(\d)-sunday$/))) {
    const w = Number(m[1]);
    return [(w === 7 ? 59 : 43 + 3 * (w - 2)) + cyc];
  }
  if ((m = temporalKey.match(/^easter-(\d)-([a-z]+)$/))) {
    const n = 267 + 6 * (Number(m[1]) - 2) + (DOW_INDEX[m[2]] - 1);
    // Thursday of the 6th week is Easter + 39: the USCCB page also carries the
    // Ascension (58) for the provinces that keep it on Thursday.
    return temporalKey === "easter-6-thursday" ? [n, 58] : [n];
  }
  if (temporalKey === "ascension") return [58];
  if (temporalKey === "pentecost") return [62, 63];
  if (temporalKey === "trinity-sunday") return [164 + cyc];
  if (temporalKey === "corpus-christi") return [167 + cyc];
  if (temporalKey === "sacred-heart") return [170 + cyc];
  if (temporalKey === "christ-the-king") return [160 + cyc];
  if ((m = temporalKey.match(/^ordinary-(\d+)-sunday$/)))
    return [64 + 3 * (Number(m[1]) - 2) + cyc];
  if ((m = temporalKey.match(/^ordinary-(\d+)-([a-z]+)$/))) {
    return [305 + 6 * (Number(m[1]) - 1) + (DOW_INDEX[m[2]] - 1)];
  }
  return [];
}

/** Every lectionary number a source may legitimately show for the engine's day. */
export function expectedLectionaryNumbers(day: LiturgicalDayDetail): number[] {
  const out = new Set<number>(temporalLectionaryNumbers(day.temporalKey, day.sundayCycle));
  if (day.temporalKey === "ascension" && day.isSunday) {
    out.add(59 + cycleIndex(day.sundayCycle)); // 7th Sunday of Easter (Thursday provinces)
  }
  if (day.sanctoral) {
    for (const n of SANCTORAL_NUMBERS[day.sanctoral.key] ?? []) out.add(n);
  } else {
    for (const n of SANCTORAL_NUMBERS[day.lectionaryKey] ?? []) out.add(n);
  }
  return [...out];
}

// ─────────────────────────────────────────────────────────────────────────────
// Agreement verdict
// ─────────────────────────────────────────────────────────────────────────────

export interface SourceDay {
  /** Titles the source shows for the date (several when it lists variants). */
  titles: string[];
  /** Lectionary numbers the source shows for the date. */
  numbers: number[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Source parsers (pure)
// ─────────────────────────────────────────────────────────────────────────────

const MONTHS = [
  "JANUARY",
  "FEBRUARY",
  "MARCH",
  "APRIL",
  "MAY",
  "JUNE",
  "JULY",
  "AUGUST",
  "SEPTEMBER",
  "OCTOBER",
  "NOVEMBER",
  "DECEMBER",
];

const COLOR_TAIL =
  /\s*(?:\b(?:white|green|red|violet|rose|black|gold)\b(?:\s*(?:or|\/)\s*)?)+\s*$/i;
const CITATION_START = /\s(?:[1-3]\s)?[A-Z][a-z]{0,4}\s\d+(?::\d|[,\s]\d)/;
const RANK_LINE = /^(?:Solemnity|Feast|Memorial|Optional Memorial)(?:\s*\[.*\])?\s*$/;
const RANK_TAIL = /\s+(?:Solemnity|Feast|Memorial)(?:\s*\[[^\]]*\])?\s*$/;
const DAY_LINE = /^(\d{1,2}) (SUN|Mon|Tue|Wed|Thu|Fri|Sat) (.*)$/;

/** Parse one USCCB calendar text file into date → titles/numbers. */
export function parseUsccbText(text: string): Map<string, SourceDay> {
  const out = new Map<string, SourceDay>();
  let year = 0;
  let month = 0;
  let current: SourceDay | null = null;
  let titleOpen = false;

  const lines = text.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (/^(CALENDARIO|DICIEMBRE|ENERO)\b/.test(line)) break;
    const header = line.match(/^([A-Z]+) (\d{4})$/);
    if (header && MONTHS.includes(header[1])) {
      month = MONTHS.indexOf(header[1]) + 1;
      year = Number(header[2]);
      current = null;
      continue;
    }
    if (!year) continue;

    const day = line.match(DAY_LINE);
    if (day) {
      const date = `${year}-${String(month).padStart(2, "0")}-${day[1].padStart(2, "0")}`;
      let block = out.get(date);
      if (!block) {
        block = { titles: [], numbers: [] };
        out.set(date, block);
      }
      let title = day[3];
      const cit = title.search(CITATION_START);
      if (cit > 0) title = title.slice(0, cit);
      title = title.replace(RANK_TAIL, "").replace(COLOR_TAIL, "").trim();
      if (!/[A-Za-z]{3}/.test(title)) {
        // PDF extraction sometimes emits the citations before the title.
        const tail = day[3].split(/\(\d+[A-Z]?\)/).pop() ?? "";
        title = tail
          .replace(/\bPss\b.*$/, "")
          .replace(COLOR_TAIL, "")
          .trim();
      }
      block.titles.push(title);
      current = block;
      titleOpen = !CITATION_START.test(day[3]) && !/\(\d+[A-Z]?\)/.test(day[3]);
      collectNumbers(block, day[3]);
      continue;
    }
    if (!current) continue;

    collectNumbers(current, line);
    if (!titleOpen) continue;
    const continuation =
      line.length > 0 &&
      !RANK_LINE.test(line) &&
      !line.startsWith("[") &&
      !line.startsWith("(") &&
      !/^or\b/i.test(line) &&
      !/^Any\b/.test(line) &&
      !/\bno\.\s*\d+/.test(line) &&
      !/^Pss\b/.test(line) &&
      !/^\d+$/.test(line) &&
      !/^\d+ [A-Z]/.test(line) &&
      !/Ecclesiastical Provinces/.test(line) &&
      !CITATION_START.test(` ${line}`) &&
      !/\(\d+[A-Z]?\)/.test(line) &&
      !/^(Vigil|Day|Morning|Evening|Night|Dawn):/.test(line);
    if (continuation) {
      const idx = current.titles.length - 1;
      const extra = line.replace(RANK_TAIL, "").replace(COLOR_TAIL, "").trim();
      if (extra) current.titles[idx] = `${current.titles[idx]} ${extra}`.trim();
    } else {
      titleOpen = false;
    }
  }
  return out;
}

function collectNumbers(block: SourceDay, line: string): void {
  for (const m of line.matchAll(/(?:\((\d{1,4})[A-Z]?\)|\bno\.\s*(\d{1,4})\b)/g)) {
    const n = Number(m[1] ?? m[2]);
    if (!block.numbers.includes(n)) block.numbers.push(n);
  }
}

interface WesthongMass {
  feast?: string;
  lectionary_number?: number | string;
  mass?: string;
}

/** Load the westhong dataset into date → titles/numbers. */
export function parseWesthong(json: string): Map<string, SourceDay> {
  const data = JSON.parse(json) as Record<string, WesthongMass[]>;
  const out = new Map<string, SourceDay>();
  for (const [date, masses] of Object.entries(data)) {
    const titles: string[] = [];
    const numbers: number[] = [];
    for (const m of masses ?? []) {
      const feast = (m.feast ?? "").trim();
      // Some rows carry the date itself as the title — treat as untitled.
      if (feast && !/^\d{4}-\d{2}-\d{2}$/.test(feast)) titles.push(feast);
      const n = Number(m.lectionary_number);
      if (Number.isFinite(n) && n > 0 && !numbers.includes(n)) numbers.push(n);
    }
    out.set(date, { titles, numbers });
  }
  return out;
}

export type Verdict =
  | { kind: "title" }
  | { kind: "number" }
  | { kind: "soft"; reason: string }
  | { kind: "hard"; reason: string };

const GENERIC_FERIAL: Array<[RegExp, string]> = [
  [/^lenten weekday$/, "lent"],
  [/^easter weekday$/, "easter"],
  [/^advent weekday$/, "advent"],
  [/^christmas weekday$/, "christmas"],
  [/^weekday$/, "ordinary"],
];

/** The season a generic USCCB ferial title ("Lenten Weekday", "Weekday") denotes, if any. */
export function genericFerialSeason(title: string): string | null {
  const n = normaliseTitle(title);
  for (const [re, season] of GENERIC_FERIAL) if (re.test(n)) return season;
  return null;
}

/**
 * Compare the engine's day with what a source shows. "title" / "number" are
 * agreements; "soft" is a memorial-level difference (the weekday itself
 * agrees); "hard" is a real disagreement about the day.
 */
export function judge(day: LiturgicalDayDetail, src: SourceDay): Verdict {
  const titles = src.titles.map((t) => t.trim()).filter((t) => t.length > 0);
  if (titles.some((t) => titleMatches(day, t))) return { kind: "title" };

  const expected = expectedLectionaryNumbers(day);
  const numberAgrees = src.numbers.some((n) => expected.includes(n));
  const genericFerial = titles.some((t) => genericFerialSeason(t) === day.season);
  if (genericFerial && !day.sanctoral && day.rank === "WEEKDAY") {
    // "Weekday" / "Lenten Weekday" … carry no week number; the lectionary
    // number is the only way to confirm the week.
    if (numberAgrees || src.numbers.length === 0) return { kind: "title" };
    return {
      kind: "hard",
      reason: `generic ferial title; lectionary number ${src.numbers.join("/")} not in expected ${expected.join("/")} for ${day.lectionaryKey}`,
    };
  }
  if (titles.length === 0) {
    if (numberAgrees) return { kind: "number" };
    return {
      kind: "hard",
      reason: `no title; lectionary number ${src.numbers.join("/") || "?"} not in expected ${expected.join("/") || "?"}`,
    };
  }

  const temporalAgrees =
    genericFerial ||
    titles.some((t) => {
      const probe = { ...day, celebration: day.temporalCelebration, sanctoral: undefined };
      return titleMatches(probe, t);
    });
  if (day.sanctoral && day.rank === "MEMORIAL" && (temporalAgrees || numberAgrees)) {
    return {
      kind: "soft",
      reason: `engine shows memorial "${day.celebration}", source shows the weekday`,
    };
  }
  if (!day.sanctoral && numberAgrees && titles.every((t) => /memorial|saint|blessed/i.test(t))) {
    return {
      kind: "soft",
      reason: `source shows a memorial the engine does not model: "${titles[0]}"`,
    };
  }
  return {
    kind: "hard",
    reason: `engine "${day.celebration}" [${day.lectionaryKey}] vs source "${titles.join(" | ")}" (n=${src.numbers.join("/") || "?"}; expected ${expected.join("/") || "?"})`,
  };
}
