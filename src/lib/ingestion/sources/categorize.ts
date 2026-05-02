import { normalizeSlug } from "../slug";

/**
 * Buckets prayers into the categories that the /prayers tab renders.
 * Mirrors the keys in PRAYER_CATEGORIES at src/app/prayers/page.tsx.
 */
export type PrayerCategory =
  | "Marian"
  | "Christ"
  | "Angelic"
  | "Sacramental"
  | "Seasonal"
  | "Daily"
  | "Dominical"
  | "Eucharistic";

const MARIAN_KEYWORDS = [
  "mary",
  "marian",
  "ave maria",
  "hail mary",
  "rosary",
  "our lady",
  "salve regina",
  "regina",
  "memorare",
  "magnificat",
  "angelus",
];
const CHRIST_KEYWORDS = [
  "jesus",
  "christ",
  "sacred heart",
  "divine mercy",
  "stations of the cross",
  "via crucis",
  "passion",
];
const ANGELIC_KEYWORDS = [
  "angel",
  "guardian angel",
  "michael",
  "gabriel",
  "raphael",
  "archangel",
];
const SACRAMENTAL_KEYWORDS = [
  "baptism",
  "confirmation",
  "confession",
  "reconciliation",
  "matrimony",
  "anointing",
  "ordination",
  "sacrament",
];
const SEASONAL_KEYWORDS = [
  "advent",
  "christmas",
  "lent",
  "easter",
  "pentecost",
  "epiphany",
  "ordinary time",
];
const DAILY_KEYWORDS = [
  "morning",
  "evening",
  "night",
  "before meals",
  "after meals",
  "grace",
  "compline",
  "lauds",
  "vespers",
  "examen",
];
const DOMINICAL_KEYWORDS = [
  "our father",
  "pater noster",
  "lord's prayer",
  "lords prayer",
];
const EUCHARISTIC_KEYWORDS = [
  "anima christi",
  "eucharist",
  "blessed sacrament",
  "communion",
  "tantum ergo",
  "panis angelicus",
  "o salutaris",
  "adoration",
];

function matches(haystack: string, needles: string[]): boolean {
  const lower = haystack.toLowerCase();
  return needles.some((n) => lower.includes(n));
}

export function categorizePrayer(input: { title: string; body?: string }): PrayerCategory {
  const blob = `${input.title} ${input.body ?? ""}`;
  if (matches(blob, DOMINICAL_KEYWORDS)) return "Dominical";
  if (matches(blob, MARIAN_KEYWORDS)) return "Marian";
  if (matches(blob, EUCHARISTIC_KEYWORDS)) return "Eucharistic";
  if (matches(blob, ANGELIC_KEYWORDS)) return "Angelic";
  if (matches(blob, SACRAMENTAL_KEYWORDS)) return "Sacramental";
  if (matches(blob, SEASONAL_KEYWORDS)) return "Seasonal";
  if (matches(blob, DAILY_KEYWORDS)) return "Daily";
  return "Daily";
}

/**
 * Buckets devotions onto the formation cards displayed by /spiritual-life.
 * Returns one of the FormationItem ids, or "general" if no match.
 */
export type DevotionCategory =
  | "rosary"
  | "confession"
  | "adoration"
  | "consecration"
  | "vocations"
  | "general";

export function categorizeDevotion(input: { title: string; summary?: string }): DevotionCategory {
  const blob = `${input.title} ${input.summary ?? ""}`.toLowerCase();
  if (blob.includes("rosary") || blob.includes("rosario")) return "rosary";
  if (blob.includes("confession") || blob.includes("reconciliation")) return "confession";
  if (blob.includes("adoration") || blob.includes("blessed sacrament")) return "adoration";
  if (blob.includes("consecration")) return "consecration";
  if (blob.includes("vocation")) return "vocations";
  return "general";
}

/** Build a deterministic, dedupable slug from a title, with a stable suffix. */
export function buildSlug(title: string, suffix?: string): string {
  const base = normalizeSlug(title);
  if (!suffix) return base;
  return `${base}-${normalizeSlug(suffix)}`.replace(/-+$/g, "");
}
