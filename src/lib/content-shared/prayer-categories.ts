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

export function prayerCategoryLabel(value: string): string {
  return PRAYER_CATEGORIES.find((c) => c.value === value)?.label ?? "General";
}

export function categorizePrayer(input: {
  title?: string | null;
  prayerType?: string | null;
  body?: string | null;
  category?: string | null;
}): string {
  // Prefer an already-canonical stored category.
  const stored = (input.category ?? "").toLowerCase().trim();
  if (CANONICAL.has(stored)) return stored;

  const pt = (input.prayerType ?? "").toLowerCase();
  const hay = `${input.title ?? ""} ${input.body ?? ""}`.toLowerCase();
  const has = (...words: string[]) => words.some((w) => hay.includes(w));

  // Litanies (the /litanies tab) take priority — a "Litany of …" title or a
  // litany prayerType marks a litany regardless of its thematic content (e.g.
  // the Litany of Loreto is Marian, but it belongs in the Litany tab).
  if (pt === "litany" || (input.title ?? "").toLowerCase().includes("litany")) {
    return "litany";
  }

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
  if (
    pt === "act" ||
    has("act of contrition", "penance", "have mercy", "contrition", "confiteor", "forgive us")
  ) {
    return "penitential";
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
