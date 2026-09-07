/**
 * Canonical table of the 73 books of the Catholic Bible.
 *
 * Every book carries its Paratext/USFM code (the key of the vendored
 * Douay-Rheims JSON store), its modern English name (as the USCCB lectionary
 * and the NAB use it), the Douay-Rheims name, and every abbreviation the
 * USCCB lectionary citations use plus the common Douay-era alternates.
 *
 * Modern names are canonical. The Douay-Rheims calls 1–2 Samuel "1–2 Kings"
 * and 1–2 Kings "3–4 Kings"; "1 Kings"/"2 Kings" therefore ALWAYS mean the
 * modern books here, and only the unambiguous "3 Kings"/"4 Kings" are
 * accepted as Douay aliases.
 */

export type BookCode =
  | "GEN"
  | "EXO"
  | "LEV"
  | "NUM"
  | "DEU"
  | "JOS"
  | "JDG"
  | "RUT"
  | "1SA"
  | "2SA"
  | "1KI"
  | "2KI"
  | "1CH"
  | "2CH"
  | "EZR"
  | "NEH"
  | "TOB"
  | "JDT"
  | "EST"
  | "1MA"
  | "2MA"
  | "JOB"
  | "PSA"
  | "PRO"
  | "ECC"
  | "SNG"
  | "WIS"
  | "SIR"
  | "ISA"
  | "JER"
  | "LAM"
  | "BAR"
  | "EZK"
  | "DAN"
  | "HOS"
  | "JOL"
  | "AMO"
  | "OBA"
  | "JON"
  | "MIC"
  | "NAM"
  | "HAB"
  | "ZEP"
  | "HAG"
  | "ZEC"
  | "MAL"
  | "MAT"
  | "MRK"
  | "LUK"
  | "JHN"
  | "ACT"
  | "ROM"
  | "1CO"
  | "2CO"
  | "GAL"
  | "EPH"
  | "PHP"
  | "COL"
  | "1TH"
  | "2TH"
  | "1TI"
  | "2TI"
  | "TIT"
  | "PHM"
  | "HEB"
  | "JAS"
  | "1PE"
  | "2PE"
  | "1JN"
  | "2JN"
  | "3JN"
  | "JUD"
  | "REV";

export interface BookInfo {
  code: BookCode;
  /** Modern English name (NAB / USCCB lectionary). */
  name: string;
  /** Name used by the Douay-Rheims Bible. */
  douayName: string;
  testament: "OT" | "NT";
  /** Abbreviations and alternate names (matched case-insensitively). */
  abbreviations: readonly string[];
}

const b = (
  code: BookCode,
  name: string,
  douayName: string,
  testament: "OT" | "NT",
  abbreviations: readonly string[],
): BookInfo => ({ code, name, douayName, testament, abbreviations });

export const BOOKS: readonly BookInfo[] = [
  b("GEN", "Genesis", "Genesis", "OT", ["Gn", "Gen"]),
  b("EXO", "Exodus", "Exodus", "OT", ["Ex", "Exod"]),
  b("LEV", "Leviticus", "Leviticus", "OT", ["Lv", "Lev"]),
  b("NUM", "Numbers", "Numbers", "OT", ["Nm", "Num"]),
  b("DEU", "Deuteronomy", "Deuteronomy", "OT", ["Dt", "Deut"]),
  b("JOS", "Joshua", "Josue", "OT", ["Jos", "Josh"]),
  b("JDG", "Judges", "Judges", "OT", ["Jgs", "Jdg", "Judg"]),
  b("RUT", "Ruth", "Ruth", "OT", ["Ru", "Rt"]),
  b("1SA", "1 Samuel", "1 Kings", "OT", ["1 Sm", "1 Sam"]),
  b("2SA", "2 Samuel", "2 Kings", "OT", ["2 Sm", "2 Sam"]),
  b("1KI", "1 Kings", "3 Kings", "OT", ["1 Kgs", "3 Kgs"]),
  b("2KI", "2 Kings", "4 Kings", "OT", ["2 Kgs", "4 Kgs"]),
  b("1CH", "1 Chronicles", "1 Paralipomenon", "OT", ["1 Chr", "1 Chron", "1 Par"]),
  b("2CH", "2 Chronicles", "2 Paralipomenon", "OT", ["2 Chr", "2 Chron", "2 Par"]),
  b("EZR", "Ezra", "1 Esdras", "OT", ["Ezr", "Esdras", "1 Esd"]),
  b("NEH", "Nehemiah", "2 Esdras", "OT", ["Neh", "2 Esd"]),
  b("TOB", "Tobit", "Tobias", "OT", ["Tb", "Tob"]),
  b("JDT", "Judith", "Judith", "OT", ["Jdt", "Jth"]),
  b("EST", "Esther", "Esther", "OT", ["Est", "Esth"]),
  b("1MA", "1 Maccabees", "1 Machabees", "OT", ["1 Mc", "1 Mac", "1 Macc"]),
  b("2MA", "2 Maccabees", "2 Machabees", "OT", ["2 Mc", "2 Mac", "2 Macc"]),
  b("JOB", "Job", "Job", "OT", ["Jb"]),
  b("PSA", "Psalm", "Psalm", "OT", ["Ps", "Pss", "Psa", "Psalms"]),
  b("PRO", "Proverbs", "Proverbs", "OT", ["Prv", "Prov", "Pr"]),
  b("ECC", "Ecclesiastes", "Ecclesiastes", "OT", ["Eccl", "Eccles", "Ecc", "Qoheleth", "Qoh"]),
  b("SNG", "Song of Songs", "Canticle of Canticles", "OT", [
    "Sg",
    "Song",
    "Song of Solomon",
    "Cant",
    "Canticles",
    "Ct",
  ]),
  b("WIS", "Wisdom", "Wisdom", "OT", ["Wis", "Ws", "Wisdom of Solomon"]),
  b("SIR", "Sirach", "Ecclesiasticus", "OT", ["Sir", "Ecclus", "Ben Sira"]),
  b("ISA", "Isaiah", "Isaias", "OT", ["Is", "Isa"]),
  b("JER", "Jeremiah", "Jeremias", "OT", ["Jer"]),
  b("LAM", "Lamentations", "Lamentations", "OT", ["Lam"]),
  b("BAR", "Baruch", "Baruch", "OT", ["Bar"]),
  b("EZK", "Ezekiel", "Ezechiel", "OT", ["Ez", "Ezek", "Ezk"]),
  b("DAN", "Daniel", "Daniel", "OT", ["Dn", "Dan"]),
  b("HOS", "Hosea", "Osee", "OT", ["Hos"]),
  b("JOL", "Joel", "Joel", "OT", ["Jl"]),
  b("AMO", "Amos", "Amos", "OT", ["Am"]),
  b("OBA", "Obadiah", "Abdias", "OT", ["Ob", "Obad"]),
  b("JON", "Jonah", "Jonas", "OT", ["Jon"]),
  b("MIC", "Micah", "Micheas", "OT", ["Mi", "Mic"]),
  b("NAM", "Nahum", "Nahum", "OT", ["Na", "Nah"]),
  b("HAB", "Habakkuk", "Habacuc", "OT", ["Hb", "Hab"]),
  b("ZEP", "Zephaniah", "Sophonias", "OT", ["Zep", "Zeph"]),
  b("HAG", "Haggai", "Aggeus", "OT", ["Hg", "Hag"]),
  b("ZEC", "Zechariah", "Zacharias", "OT", ["Zec", "Zech"]),
  b("MAL", "Malachi", "Malachias", "OT", ["Mal"]),
  b("MAT", "Matthew", "Matthew", "NT", ["Mt", "Matt"]),
  b("MRK", "Mark", "Mark", "NT", ["Mk"]),
  b("LUK", "Luke", "Luke", "NT", ["Lk"]),
  b("JHN", "John", "John", "NT", ["Jn"]),
  b("ACT", "Acts", "Acts", "NT", ["Acts of the Apostles"]),
  b("ROM", "Romans", "Romans", "NT", ["Rom"]),
  b("1CO", "1 Corinthians", "1 Corinthians", "NT", ["1 Cor"]),
  b("2CO", "2 Corinthians", "2 Corinthians", "NT", ["2 Cor"]),
  b("GAL", "Galatians", "Galatians", "NT", ["Gal"]),
  b("EPH", "Ephesians", "Ephesians", "NT", ["Eph"]),
  b("PHP", "Philippians", "Philippians", "NT", ["Phil", "Philip"]),
  b("COL", "Colossians", "Colossians", "NT", ["Col"]),
  b("1TH", "1 Thessalonians", "1 Thessalonians", "NT", ["1 Thes", "1 Thess"]),
  b("2TH", "2 Thessalonians", "2 Thessalonians", "NT", ["2 Thes", "2 Thess"]),
  b("1TI", "1 Timothy", "1 Timothy", "NT", ["1 Tm", "1 Tim"]),
  b("2TI", "2 Timothy", "2 Timothy", "NT", ["2 Tm", "2 Tim"]),
  b("TIT", "Titus", "Titus", "NT", ["Ti", "Tit"]),
  b("PHM", "Philemon", "Philemon", "NT", ["Phlm", "Philem", "Phm"]),
  b("HEB", "Hebrews", "Hebrews", "NT", ["Heb"]),
  b("JAS", "James", "James", "NT", ["Jas"]),
  b("1PE", "1 Peter", "1 Peter", "NT", ["1 Pt", "1 Pet"]),
  b("2PE", "2 Peter", "2 Peter", "NT", ["2 Pt", "2 Pet"]),
  b("1JN", "1 John", "1 John", "NT", ["1 Jn"]),
  b("2JN", "2 John", "2 John", "NT", ["2 Jn"]),
  b("3JN", "3 John", "3 John", "NT", ["3 Jn"]),
  b("JUD", "Jude", "Jude", "NT", []),
  b("REV", "Revelation", "Apocalypse", "NT", ["Rv", "Rev", "Apoc"]),
];

const ORDINAL_WORDS: Record<string, string> = {
  i: "1",
  ii: "2",
  iii: "3",
  first: "1",
  second: "2",
  third: "3",
};

/**
 * Normalise a book token for lookup: case-insensitive, trailing periods
 * dropped, whitespace collapsed, Roman/word ordinals folded to digits and
 * "1Cor" style tokens split so "1Cor", "I Cor." and "1 cor" all match.
 */
export function normaliseBookToken(token: string): string {
  let t = token
    .replace(/\u00a0/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\.+$/g, "")
    .replace(/\./g, "")
    .replace(/\s+/g, " ");
  t = t.replace(/^(\d)(?=[a-z])/, "$1 ");
  const m = t.match(/^([a-z]+)\s+(.+)$/);
  if (m && ORDINAL_WORDS[m[1]] !== undefined) t = `${ORDINAL_WORDS[m[1]]} ${m[2]}`;
  return t;
}

const LOOKUP: Map<string, BookInfo> = (() => {
  const map = new Map<string, BookInfo>();
  const add = (key: string, info: BookInfo) => {
    const k = normaliseBookToken(key);
    const existing = map.get(k);
    if (existing && existing.code !== info.code) {
      throw new Error(`Ambiguous book alias "${key}": ${existing.code} vs ${info.code}`);
    }
    map.set(k, info);
  };
  for (const info of BOOKS) {
    add(info.name, info);
    add(info.code, info);
    if (info.douayName !== "1 Kings" && info.douayName !== "2 Kings") add(info.douayName, info);
    for (const a of info.abbreviations) add(a, info);
  }
  return map;
})();

/** Find a book by name, Douay name, code or abbreviation; null if unknown. */
export function findBook(token: string): BookInfo | null {
  return LOOKUP.get(normaliseBookToken(token)) ?? null;
}

const BY_CODE: Record<BookCode, BookInfo> = Object.fromEntries(
  BOOKS.map((info) => [info.code, info]),
) as Record<BookCode, BookInfo>;

export function bookByCode(code: BookCode): BookInfo {
  return BY_CODE[code];
}
