/**
 * Canonical prayer categories used by the /prayers filter. The Admin Worker
 * stores a free-form `category` on each prayer; until it emits one of these
 * canonical values we derive the category from the prayer's title, type, and
 * text so the filter is useful immediately. If the stored category already is
 * canonical, that wins.
 */
export interface PrayerCategory {
  value: string;
  label: string;
}

export const PRAYER_CATEGORIES: readonly PrayerCategory[] = [
  { value: "marian", label: "Marian" },
  { value: "angelic", label: "Angelic" },
  { value: "eucharistic", label: "Eucharistic" },
  { value: "trinitarian", label: "Trinitarian" },
  { value: "act", label: "Acts" },
  { value: "penitential", label: "Penitential" },
  { value: "litany", label: "Litany" },
  { value: "liturgical", label: "Liturgical" },
  { value: "saintly", label: "Saint-related" },
  { value: "novena", label: "Novena" },
  { value: "chaplet", label: "Chaplet" },
  { value: "consecration", label: "Consecration" },
  { value: "devotional", label: "Devotional" },
  { value: "general", label: "General" },
] as const;

const CANONICAL = new Set(PRAYER_CATEGORIES.map((c) => c.value));

/**
 * Descriptive categories the curated knowledge files store which are not
 * themselves filter chips. Mapping them here — rather than letting them fall
 * through to keyword derivation — is what stops "theological-virtue" and
 * "dominical" from reaching the homepage rail as raw labels, and keeps the
 * Acts of Faith, Hope and Love out of the Penitential chip.
 */
const CATEGORY_ALIASES: Record<string, string> = {
  "theological-virtue": "act",
  "theological-virtues": "act",
  dominical: "general",
  doxology: "trinitarian",
  creed: "liturgical",
  canticle: "liturgical",
  hymn: "liturgical",
  pentecost: "liturgical",
  "marian-intercession": "marian",
  "marian-seasonal": "marian",
  "marian-antiphon": "marian",
  morning: "devotional",
  evening: "devotional",
  meal: "devotional",
  peace: "devotional",
};

/**
 * Human label for a category value. Accepts the descriptive aliases the
 * curated files store as well as the canonical values, so no caller can print
 * a raw stored string.
 */
export function prayerCategoryLabel(value: string): string {
  const key = (value ?? "").toLowerCase().trim();
  const canonical = CANONICAL.has(key) ? key : (CATEGORY_ALIASES[key] ?? key);
  return PRAYER_CATEGORIES.find((c) => c.value === canonical)?.label ?? "General";
}

export function categorizePrayer(input: {
  title?: string | null;
  prayerType?: string | null;
  body?: string | null;
  category?: string | null;
}): string {
  const pt = (input.prayerType ?? "").toLowerCase();

  // Litanies (the /litanies tab) take priority over everything, INCLUDING a
  // stored thematic category — a "Litany of …" title or a `litany` prayerType
  // marks a litany regardless of its theme (the Litany of the Blessed Virgin
  // Mary is Marian and the Litany of Humility's stored category is "general",
  // but both belong in the Litany tab). This must run before the stored-category
  // shortcut below, or those litanies are hijacked into their theme and the
  // /litanies tab silently drops them.
  if (pt === "litany" || (input.title ?? "").toLowerCase().includes("litany")) {
    return "litany";
  }

  // Otherwise, prefer an already-canonical stored category, then a known
  // descriptive alias, before falling back to keyword derivation.
  const stored = (input.category ?? "").toLowerCase().trim();
  if (CANONICAL.has(stored)) return stored;
  if (stored && CATEGORY_ALIASES[stored]) return CATEGORY_ALIASES[stored];

  const hay = `${input.title ?? ""} ${input.body ?? ""}`.toLowerCase();
  const has = (...words: string[]) => words.some((w) => hay.includes(w));

  if (
    pt === "marian" ||
    pt === "rosary" ||
    has(
      "hail mary",
      "hail, holy queen",
      "salve regina",
      "memorare",
      "our lady",
      "blessed virgin",
      "mother of god",
      "regina caeli",
      "angelus",
      "rosary",
      "fatima",
      "magnificat",
    )
  ) {
    return "marian";
  }
  if (has("guardian angel", "st. michael", "saint michael", "holy angels", "angel of god")) {
    return "angelic";
  }
  if (
    has(
      "eucharist",
      "blessed sacrament",
      "holy communion",
      "adoration",
      "tantum ergo",
      "o salutaris",
      "corpus christi",
      "anima christi",
    )
  ) {
    return "eucharistic";
  }
  if (
    has("glory be", "gloria patri", "most holy trinity", "holy trinity", "o blessed trinity") ||
    (input.title ?? "").toLowerCase().includes("trinity")
  ) {
    return "trinitarian";
  }
  if (pt === "chaplet" || has("chaplet")) {
    return "chaplet";
  }
  if (pt === "consecration" || has("consecration", "i consecrate", "totus tuus")) {
    return "consecration";
  }
  if (pt === "novena" || has("novena")) {
    return "novena";
  }
  // Penitence is decided by penitential words, not by the "act" prayerType:
  // the Acts of Faith, Hope and Love are acts too, and they are not sorrow for
  // sin. Contrition is checked first so the Act of Contrition still lands here.
  if (has("act of contrition", "penance", "have mercy", "contrition", "confiteor", "forgive us")) {
    return "penitential";
  }
  if (pt === "act" || /^(an?\s+)?act of\b/.test((input.title ?? "").toLowerCase())) {
    return "act";
  }
  if (
    pt === "intercession" ||
    pt === "intercessory" ||
    has(
      "te deum",
      "gloria in excelsis",
      "agnus dei",
      "kyrie",
      "liturgy of the hours",
      "divine office",
    )
  ) {
    return "liturgical";
  }
  if (/\b(st\.?|saint)\s+[a-z]/.test((input.title ?? "").toLowerCase()) || has("intercession of")) {
    return "saintly";
  }
  if (has("sacred heart", "divine mercy", "immaculate heart", "devotion")) {
    return "devotional";
  }
  return "general";
}
