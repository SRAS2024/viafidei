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
  { value: "penitential", label: "Penitential" },
  { value: "liturgical", label: "Liturgical" },
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
    pt === "act" ||
    has("act of contrition", "penance", "have mercy", "contrition", "confiteor", "forgive us")
  ) {
    return "penitential";
  }
  if (
    pt === "litany" ||
    pt === "intercession" ||
    pt === "intercessory" ||
    has(
      "litany",
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
  if (
    pt === "consecration" ||
    pt === "novena" ||
    has("consecration", "novena", "sacred heart", "divine mercy", "chaplet", "devotion")
  ) {
    return "devotional";
  }
  return "general";
}
