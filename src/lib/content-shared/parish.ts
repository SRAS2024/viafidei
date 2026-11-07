/**
 * Parish classification filters.
 *
 * Parish records carry a single `designation` (parish / chapel / shrine /
 * cathedral / major-basilica / minor-basilica). The directory groups these
 * into the classifications the user can filter by — Parish, Cathedral,
 * Basilica, Shrine, Chapel — so cathedrals, basilicas, shrines and chapels are
 * clearly distinct from ordinary parishes. A church that is also a basilica,
 * cathedral, or shrine surfaces under that classification (its specific
 * designation label is still shown on the card).
 */

export type ParishClassification = "parish" | "cathedral" | "basilica" | "shrine" | "chapel";
export type ParishFilter = ParishClassification | "all";

export const PARISH_FILTERS: ReadonlyArray<{ key: ParishFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "parish", label: "Parishes" },
  { key: "cathedral", label: "Cathedrals" },
  { key: "basilica", label: "Basilicas" },
  { key: "shrine", label: "Shrines" },
  { key: "chapel", label: "Chapels" },
];

const CLASSIFICATIONS: ReadonlySet<string> = new Set([
  "parish",
  "cathedral",
  "basilica",
  "shrine",
  "chapel",
]);

/** Group a raw designation into one of the filterable classifications. */
export function classifyParish(designation: unknown): ParishClassification {
  const d = typeof designation === "string" ? designation.toLowerCase() : "";
  if (d === "cathedral") return "cathedral";
  if (d.includes("basilica")) return "basilica";
  if (d === "shrine") return "shrine";
  // An oratory, like a chapel, is a place of worship that is not a parish church.
  if (d === "chapel" || d === "oratory") return "chapel";
  return "parish";
}

/** Resolve a `?class=` value into the active filter (defaults to "all"). */
export function resolveParishFilter(param: string | null | undefined): ParishFilter {
  return param && CLASSIFICATIONS.has(param) ? (param as ParishClassification) : "all";
}

/** Whether a record with the given designation matches the active filter. */
export function parishMatchesFilter(designation: unknown, filter: ParishFilter): boolean {
  return filter === "all" || classifyParish(designation) === filter;
}

/**
 * Parish card presentation helpers.
 *
 * These exist so the parish card is a pure RENDERING concern: reformatting the
 * card reformats all 9,731 published parishes at once, with no worker pass, no
 * database write and no republish. Nothing here reads or reshapes stored data.
 */

/** The place parts of a parish record: town, region and country. */
export type ParishPlaceParts = {
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postalCode?: string | null;
  /** ISO-3166 alpha-2: decides where the postal code goes. */
  countryCode?: string | null;
};

function trimmed(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** The values of a semicolon list, unless the semicolon only ends an HTML entity. */
function listValues(text: string): string[] {
  if (/&[a-z0-9#]+;/i.test(text)) return [text];
  return text
    .split(";")
    .map((value) => value.trim())
    .filter(Boolean);
}

/**
 * One value for a line of an address. The map data behind the directory writes a
 * second value after a semicolon ("New York;Manhattan"), which is no use on an
 * envelope, so the first is the one shown.
 */
function firstValue(value: unknown): string {
  return listValues(trimmed(value))[0] ?? "";
}

/**
 * A church's name as a reader sees it. The map data behind the directory lists a second
 * name after a semicolon ("Saint Rose of Lima Catholic Church;Iglesia Católica Santa Rosa
 * de Lima"), and both are the church's, so the others stand beside the first, the way a
 * name in another script stands beside its transliteration.
 */
export function parishDisplayName(name: string): string {
  const [first, ...others] = [...new Set(listValues(trimmed(name)))];
  if (!first) return trimmed(name);
  return others.length > 0 ? `${first} (${others.join(", ")})` : first;
}

/** House numbers and nothing else: "14-18", "12A", "5/7". */
const HOUSE_NUMBER = /^\d[\d\s/-]*[a-z]?$/i;

/**
 * The street line, the same way. Several house numbers come before the one street
 * ("14-18;18 Belvidere Street"), so the first number keeps the street it leads to:
 * "14-18 Belvidere Street".
 */
function firstStreet(value: unknown): string {
  const values = listValues(trimmed(value));
  const first = values[0] ?? "";
  if (values.length < 2 || !HOUSE_NUMBER.test(first)) return first;
  const street = values[values.length - 1]!.replace(/^\d\S*\s+/, "");
  return HOUSE_NUMBER.test(street) ? first : `${first} ${street}`;
}

/**
 * The street address out of a projected directory row. `ParishListItem.location`
 * is "address, city, state" already joined, but the card prints the place on
 * its own line, so the trailing place parts are stripped here instead of
 * being repeated one line apart. Returns null when nothing but the place is
 * left (the record has no postal address at all).
 */
export function parishStreetAddress(
  row: ParishPlaceParts & { location?: string | null },
): string | null {
  const parts = trimmed(row.location)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  // Peel from the end: location is built address-first, so country/state/city
  // can only ever be the trailing segments.
  for (const tail of [row.country, row.state, row.city]) {
    const want = trimmed(tail).toLowerCase();
    if (want && parts.length > 0 && parts[parts.length - 1]!.toLowerCase() === want) parts.pop();
  }
  return parts.join(", ") || null;
}

/**
 * The destination handed to Maps: the whole address the card shows (street,
 * postal code, town, region, country), so "123 Main St" resolves to the right
 * "123 Main St" on earth. MapsAddressLink still prefers exact coordinates when
 * the record carries them.
 */
export function parishDirectionsAddress(parts: ParishAddressParts): string {
  return parishAddressLines(parts).join(", ");
}

/**
 * What a church is, as its card says it under the name: "Parish",
 * "Cathedral", "Shrine", "Chapel", "Oratory", and always "Minor Basilica" or
 * "Major Basilica" — the stored designations are `minor-basilica` /
 * `major-basilica`. A bare "basilica" (no record carries one today) says only
 * "Basilica" rather than guess which. A designation this list does not know
 * returns null, so a raw token never reaches the card.
 */
const DESIGNATION_LABELS: Readonly<Record<string, string>> = {
  parish: "Parish",
  cathedral: "Cathedral",
  shrine: "Shrine",
  chapel: "Chapel",
  oratory: "Oratory",
  "minor-basilica": "Minor Basilica",
  "major-basilica": "Major Basilica",
  basilica: "Basilica",
};

export function parishDesignationLabel(designation: unknown): string | null {
  const key =
    typeof designation === "string"
      ? designation
          .trim()
          .toLowerCase()
          .replace(/[\s_]+/g, "-")
      : "";
  return DESIGNATION_LABELS[key] ?? null;
}

/** Every part of a church's postal address a record may carry. */
export type ParishAddressParts = ParishPlaceParts & {
  /** The street line ("6135 South Austin Avenue"). */
  address?: string | null;
  postalCode?: string | null;
  /** ISO 3166-1 alpha-2, which decides where the postal code goes. */
  countryCode?: string | null;
};

/**
 * Countries whose addresses put the postal code after the town and region
 * ("Chicago, IL 60629", "Singapore 048616"); everywhere else it leads the town
 * ("00184 Roma").
 */
const POSTCODE_AFTER_LOCALITY: ReadonlySet<string> = new Set([
  "US",
  "CA",
  "GB",
  "IE",
  "AU",
  "NZ",
  "IN",
  "PH",
  "ZA",
  "SG",
  "BR",
]);

/** The same, for a record that names its country but carries no code. */
const COUNTRY_CODES_BY_NAME: Readonly<Record<string, string>> = {
  "united states": "US",
  "united states of america": "US",
  usa: "US",
  canada: "CA",
  australia: "AU",
  "new zealand": "NZ",
  "united kingdom": "GB",
  ireland: "IE",
  india: "IN",
  philippines: "PH",
  "south africa": "ZA",
  singapore: "SG",
  brazil: "BR",
  brasil: "BR",
};

const BARE_COUNTRY_CODE = /^[A-Za-z]{2}$/;

/**
 * A country line in words. Some early records stored the country as its bare
 * ISO code ("AT"), which is no use on an envelope; the name comes from the
 * platform's own region data, and anything it does not know stays as stored.
 */
function countryInWords(country: string): string {
  if (!BARE_COUNTRY_CODE.test(country)) return country;
  try {
    const name = new Intl.DisplayNames(["en"], { type: "region" }).of(country.toUpperCase());
    return name && name !== "Unknown Region" ? name : country;
  } catch {
    return country;
  }
}

/**
 * A church's address as the lines of an envelope: the street, then the
 * locality (postal code, town and region, in the country's own order), then
 * the country in words. Missing parts are dropped, and a record with none of
 * them yields []. Nothing is looked up beyond the name of a bare country code:
 * only what the record stores.
 */
export function parishAddressLines(parts: ParishAddressParts): string[] {
  const street = firstStreet(parts.address);
  const postal = firstValue(parts.postalCode);
  const city = firstValue(parts.city);
  const region = firstValue(parts.state);
  const country = firstValue(parts.country);
  const code =
    trimmed(parts.countryCode).toUpperCase() ||
    (BARE_COUNTRY_CODE.test(country) ? country.toUpperCase() : "") ||
    COUNTRY_CODES_BY_NAME[country.toLowerCase()] ||
    "";

  let locality: string;
  if (postal && POSTCODE_AFTER_LOCALITY.has(code)) {
    const place = [city, region].filter(Boolean).join(", ");
    locality = place ? `${place} ${postal}` : postal;
  } else {
    const town = [postal, city].filter(Boolean).join(" ");
    locality = [town, region].filter(Boolean).join(", ");
  }
  return [street, locality, countryInWords(country)].filter(Boolean);
}

/**
 * The letters that carry no accent to take off, by the plain letters a reader types
 * for them: the Polish ł, the Vietnamese đ, the Icelandic þ, the hooked letters of
 * Hausa and Ewe. Unicode decomposes every other accented letter.
 */
const PLAIN_FOR: Readonly<Record<string, string>> = {
  ß: "ss",
  æ: "ae",
  œ: "oe",
  þ: "th",
  ƀ: "b",
  ɓ: "b",
  ð: "d",
  đ: "d",
  ɖ: "d",
  ɗ: "d",
  ɛ: "e",
  ƒ: "f",
  ɣ: "g",
  ħ: "h",
  ı: "i",
  ĸ: "k",
  ƙ: "k",
  ŀ: "l",
  ł: "l",
  ŉ: "n",
  ŋ: "n",
  ø: "o",
  ɔ: "o",
  ſ: "s",
  ŧ: "t",
  ʋ: "v",
  ƴ: "y",
};

/** The plain letters a Latin letter is read as: "ờ" is "o", "Đ" is "d", "ß" is "ss". */
function plainLatin(letter: string): string {
  const base = letter.normalize("NFD")[0]!.toLowerCase();
  return /[a-z]/.test(base) ? base : (PLAIN_FOR[base] ?? letter.toLowerCase());
}

/** Whether a letter has an accent or a mark to take off, by the reckoning above. */
function isAccentedLatin(letter: string): boolean {
  return plainLatin(letter) !== letter.toLowerCase();
}

/**
 * Every accented Latin letter, by the plain letters it is read as, in both cases, so
 * nothing relies on the database's locale to fold them. Built from Unicode's own tables,
 * because a list by hand left out most of Vietnamese.
 */
const FORMS_OF: ReadonlyMap<string, string> = (() => {
  const forms = new Map<string, string>();
  const add = (letter: string) => {
    const plain = plainLatin(letter);
    forms.set(plain, (forms.get(plain) ?? "") + letter);
  };
  // Latin-1, Extended-A and -B, and Extended Additional, where Vietnamese lives.
  for (const [first, last] of [
    [0xc0, 0x24f],
    [0x1e00, 0x1eff],
  ] as const) {
    for (let code = first; code <= last; code++) {
      const letter = String.fromCodePoint(code);
      if (/\p{L}/u.test(letter) && isAccentedLatin(letter)) add(letter);
    }
  }
  // The hooked letters' small forms lie past those blocks, with their capitals inside.
  for (const letter of Object.keys(PLAIN_FOR)) {
    if (letter.codePointAt(0)! > 0x24f) add(letter);
  }
  return forms;
})();

/** Combining accents after a letter: a record may store "ộ" as an "o" and two marks. */
const COMBINING_MARK = /[\u0300-\u036f]/;
const MARKS_AFTER = "[\u0300-\u036f]*";

/** Spellings with two plain letters of a letter that is one in a language's own hand. */
const SPELLED_OUT: Readonly<Record<string, string>> = { ä: "ae", ö: "oe", ü: "ue" };

/** What a typed plain letter may be in a record: itself, in either case, with any accent. */
function anyFormOf(letter: string): string {
  if (/[a-z]/.test(letter)) {
    return `[${letter}${letter.toUpperCase()}${FORMS_OF.get(letter) ?? ""}]${MARKS_AFTER}`;
  }
  // Another script, or a digit: as typed, in either case.
  const upper = letter.toUpperCase();
  return upper !== letter && [...upper].length === 1 ? `[${letter}${upper}]` : letter;
}

/**
 * Plain letters as typed, in any form a record may write them, a pair of them also as
 * the one letter it spells: "Strasse" finds "Straße", and "Muenchen" finds "München".
 */
function plainPattern(plain: string): string {
  return plain.replace(/ss|ae|oe|ue|th|./gsu, (part) => {
    if ([...part].length === 1) return anyFormOf(part);
    const one = Object.entries(SPELLED_OUT).find(([, two]) => two === part)?.[0];
    const single = (FORMS_OF.get(part) ?? "") + (one ? one + one.toUpperCase() : "");
    const pair = [...part].map(anyFormOf).join("");
    return single ? `(?:${pair}|[${single}])` : pair;
  });
}

/**
 * A letter the reader typed with its accent: that accent in either case, and, when
 * `orPlain`, its plain form. A spelled-out form stands either way: "Straße" and "Strasse",
 * "Köln" and "Koeln" are one word written two ways, where "thờ" and "tho" are not.
 */
function accentedPattern(letter: string, orPlain: boolean): string {
  const lower = letter.toLowerCase();
  const plain = plainLatin(letter);
  const upper = letter.toUpperCase();
  const own = lower + ([...upper].length === 1 && upper !== lower ? upper : "");
  const asPlain = orPlain && plain.length === 1 ? plain + plain.toUpperCase() : "";
  const spelled = plain.length > 1 ? plain : SPELLED_OUT[lower];
  const single = `[${own}${asPlain}]${MARKS_AFTER}`;
  return spelled ? `(?:${single}|${plainPattern(spelled)})` : single;
}

/** Past this no word in a name is still being told from another, and each letter costs. */
const LETTERS_READ = 40;

/** A word's letters in one reading, the plain ones run together so that pairs are seen. */
function lettersPattern(letters: readonly string[], orPlain: boolean): string {
  let pattern = "";
  let plain = "";
  for (const letter of letters) {
    const combining = COMBINING_MARK.test(letter);
    if (combining || isAccentedLatin(letter)) {
      pattern += plainPattern(plain);
      plain = "";
      // A mark left after composing ("ẹ́" has no one letter): what a plain reading leaves off.
      if (!combining) pattern += accentedPattern(letter, orPlain);
      else if (!orPlain) pattern += letter;
    } else {
      plain += letter.toLowerCase();
    }
  }
  return pattern + plainPattern(plain);
}

/**
 * A word as a POSIX regular expression that finds it however a record or a reader
 * writes its accents, with no extension or new column: the columns are compared as
 * they are. Most of the directory's names are in the local language, and most readers
 * will not type the accent.
 *
 * A word typed plain finds every accent: "Krakow" finds "Kraków", "Ha Noi" finds
 * "Hà Nội". A word typed with its accents means them, and is found as part of a longer
 * word, as a search has always worked; its plain spelling counts only as the whole word.
 * So "Kraków" also finds "Krakow", and "thờ" also finds "tho", but not the "tho" in
 * "Catholic", nor "thọ", which is another word. A word in another script is matched as
 * typed, in either case. A word holds only letters, digits and their marks, so nothing
 * in it is a metacharacter.
 */
export function accentBlindPattern(word: string): string {
  const letters = [...word.normalize("NFC")].slice(0, LETTERS_READ);
  const accented = letters.some((l) => COMBINING_MARK.test(l) || isAccentedLatin(l));
  if (!accented) return lettersPattern(letters, true);
  return `(?:${lettersPattern(letters, false)}|\\m${lettersPattern(letters, true)}\\M)`;
}

/**
 * The directory's other scripts and the language each is read in, with the
 * countries where a neighbouring language writes it.
 */
const SCRIPT_LANGUAGES: ReadonlyArray<
  readonly [RegExp, string, Readonly<Record<string, string>>?]
> = [
  [/\p{Script=Hangul}/gu, "ko"],
  [/\p{Script=Greek}/gu, "el"],
  [/\p{Script=Cyrillic}/gu, "ru", { UA: "uk", BG: "bg" }],
  [/\p{Script=Arabic}/gu, "ar"],
  [/\p{Script=Hebrew}/gu, "he"],
  [/\p{Script=Thai}/gu, "th"],
  [/\p{Script=Lao}/gu, "lo"],
  [/\p{Script=Myanmar}/gu, "my"],
  [/\p{Script=Devanagari}/gu, "hi", { NP: "ne" }],
  [/\p{Script=Bengali}/gu, "bn"],
  [/\p{Script=Tamil}/gu, "ta"],
  [/\p{Script=Malayalam}/gu, "ml"],
  [/\p{Script=Georgian}/gu, "ka"],
  [/\p{Script=Armenian}/gu, "hy"],
  [/\p{Script=Ethiopic}/gu, "am"],
];
const HAN = /\p{Script=Han}/gu;
const KANA = /[\p{Script=Hiragana}\p{Script=Katakana}]/gu;
const ANY_LETTER = /\p{L}/gu;

function countOf(text: string, pattern: RegExp): number {
  return text.match(pattern)?.length ?? 0;
}

/**
 * The language a church's name or a line of its address is written in, when
 * most of its letters settle it. VoiceOver reads such a line in that language's
 * voice instead of spelling Hangul or Hebrew through an English one, and the
 * browser draws Han in the country's own forms. Latin script settles nothing
 * ("Via Roma" and "Main Street" look alike), and a mixed line ("Dae Seongdang
 * (대성당)") keeps the page's language: most of it is meant to be read that way.
 */
export function parishTextLanguage(
  text: string | null | undefined,
  countryCode?: string | null,
): string | undefined {
  const value = trimmed(text);
  if (!value) return undefined;
  const letters = countOf(value, ANY_LETTER);
  const han = countOf(value, HAN);
  const kana = countOf(value, KANA);
  const code = trimmed(countryCode).toUpperCase();
  if (2 * (han + kana) > letters) {
    if (kana > 0 || code === "JP") return "ja";
    if (code === "KR") return "ko";
    return code === "TW" || code === "HK" || code === "MO" ? "zh-Hant" : "zh";
  }
  for (const [script, language, byCountry] of SCRIPT_LANGUAGES) {
    if (2 * countOf(value, script) > letters) return byCountry?.[code] ?? language;
  }
  return undefined;
}
