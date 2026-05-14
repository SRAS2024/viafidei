import { normalizeSlug } from "../slug";

/**
 * Categories used by the /prayers tab filters. The set mirrors the
 * PRAYER_CATEGORIES list at src/app/prayers/page.tsx and is intentionally
 * Catholic-prayer-typology aware: Marian, Christ-centered, Angelic,
 * Sacramental, Seasonal, Daily, Liturgical, Novenas, Litanies, Rosary,
 * Chaplets, and Traditional Prayers.
 */
export type PrayerCategory =
  | "Marian"
  | "Christ"
  | "Angelic"
  | "Sacramental"
  | "Seasonal"
  | "Daily"
  | "Dominical"
  | "Eucharistic"
  | "Liturgical"
  | "Novena"
  | "Litany"
  | "Rosary"
  | "Chaplet"
  | "Traditional";

const MARIAN_KEYWORDS = [
  "mary",
  "marian",
  "ave maria",
  "hail mary",
  "our lady",
  "salve regina",
  "regina caeli",
  "regina cæli",
  "memorare",
  "magnificat",
  "angelus",
  "stella maris",
  "sub tuum",
  "fatima",
  "guadalupe",
  "lourdes",
  "immaculate",
  "blessed virgin",
  "theotokos",
];
const CHRIST_KEYWORDS = [
  "jesus",
  "christ",
  "sacred heart",
  "divine mercy",
  "stations of the cross",
  "via crucis",
  "passion",
  "holy name",
  "infant of prague",
  "precious blood",
];
const ANGELIC_KEYWORDS = [
  "angel",
  "guardian angel",
  "st. michael",
  "saint michael",
  "michael the archangel",
  "gabriel",
  "raphael",
  "archangel",
  "seraphim",
  "cherubim",
];
const SACRAMENTAL_KEYWORDS = [
  "baptism",
  "confirmation",
  "confession",
  "reconciliation",
  "matrimony",
  "marriage",
  "anointing",
  "ordination",
  "holy orders",
  "before confession",
  "after confession",
  "before communion",
  "after communion",
  "act of contrition",
];
const SEASONAL_KEYWORDS = [
  "advent",
  "christmas",
  "lent",
  "easter",
  "pentecost",
  "epiphany",
  "ordinary time",
  "ash wednesday",
  "good friday",
  "holy week",
  "triduum",
];
const DAILY_KEYWORDS = [
  "morning offering",
  "morning prayer",
  "evening prayer",
  "night prayer",
  "before meals",
  "after meals",
  "grace before",
  "grace after",
  "compline",
  "lauds",
  "vespers",
  "examen",
  "examination of conscience",
];
const DOMINICAL_KEYWORDS = ["our father", "pater noster", "lord's prayer", "lords prayer"];
const EUCHARISTIC_KEYWORDS = [
  "anima christi",
  "eucharist",
  "eucharistic",
  "blessed sacrament",
  "communion",
  "tantum ergo",
  "panis angelicus",
  "o salutaris",
  "adoration",
  "benediction",
];
const LITURGICAL_KEYWORDS = [
  "te deum",
  "gloria",
  "sanctus",
  "kyrie",
  "veni creator",
  "asperges",
  "vidi aquam",
  "liturgy of the hours",
  "divine office",
  "breviary",
];
const NOVENA_KEYWORDS = ["novena", "nine-day prayer", "nine day prayer", "9 days"];
const LITANY_KEYWORDS = ["litany"];
const ROSARY_KEYWORDS = [
  "rosary",
  "rosario",
  "joyful mysteries",
  "sorrowful mysteries",
  "glorious mysteries",
  "luminous mysteries",
];
const CHAPLET_KEYWORDS = ["chaplet"];
const TRADITIONAL_KEYWORDS = [
  "creed",
  "credo",
  "apostles' creed",
  "apostles creed",
  "nicene creed",
  "athanasian",
  "gloria patri",
  "sign of the cross",
  "act of faith",
  "act of hope",
  "act of love",
  "act of contrition",
  "suscipe",
];

function matches(haystack: string, needles: string[]): boolean {
  const lower = haystack.toLowerCase();
  return needles.some((n) => lower.includes(n));
}

/**
 * Heuristically place a prayer into one of the catalog filter buckets.
 *
 * Order of precedence matters: a "Litany of the Blessed Virgin Mary" is a
 * Litany first and Marian second, because the user is looking at the
 * Litanies tab when they search for it. Likewise, "Joyful Mysteries of
 * the Rosary" is a Rosary entry, "Chaplet of Divine Mercy" is a Chaplet,
 * and so on. The Trinitarian / Dominical / Eucharistic special cases come
 * before broader Christ-centered matching so the Sign of the Cross does
 * not get filed as a Christ-centered prayer.
 */
export function categorizePrayer(input: {
  title: string;
  body?: string;
  category?: string;
}): PrayerCategory {
  // Trust an explicit category supplied by the seed/ingestion when it
  // is one of the recognised buckets — we only override garbage values.
  if (input.category) {
    const c = input.category.trim();
    const recognised: Record<string, PrayerCategory> = {
      Marian: "Marian",
      Christ: "Christ",
      Christological: "Christ",
      Angelic: "Angelic",
      Sacramental: "Sacramental",
      Seasonal: "Seasonal",
      Daily: "Daily",
      Dominical: "Dominical",
      Eucharistic: "Eucharistic",
      Liturgical: "Liturgical",
      Novena: "Novena",
      Litany: "Litany",
      Rosary: "Rosary",
      Chaplet: "Chaplet",
      Traditional: "Traditional",
      Trinitarian: "Traditional",
      Creedal: "Traditional",
      Penitential: "Sacramental",
      "Theological Virtue": "Traditional",
      Devotional: "Traditional",
      Pneumatological: "Traditional",
    };
    if (recognised[c]) return recognised[c];
  }
  const blob = `${input.title} ${input.body ?? ""}`;
  // Most specific buckets first.
  if (matches(blob, LITANY_KEYWORDS)) return "Litany";
  if (matches(blob, CHAPLET_KEYWORDS)) return "Chaplet";
  if (matches(blob, ROSARY_KEYWORDS)) return "Rosary";
  if (matches(blob, NOVENA_KEYWORDS)) return "Novena";
  if (matches(blob, DOMINICAL_KEYWORDS)) return "Dominical";
  if (matches(blob, ANGELIC_KEYWORDS)) return "Angelic";
  if (matches(blob, EUCHARISTIC_KEYWORDS)) return "Eucharistic";
  if (matches(blob, MARIAN_KEYWORDS)) return "Marian";
  if (matches(blob, SACRAMENTAL_KEYWORDS)) return "Sacramental";
  if (matches(blob, SEASONAL_KEYWORDS)) return "Seasonal";
  if (matches(blob, LITURGICAL_KEYWORDS)) return "Liturgical";
  if (matches(blob, TRADITIONAL_KEYWORDS)) return "Traditional";
  if (matches(blob, DAILY_KEYWORDS)) return "Daily";
  if (matches(blob, CHRIST_KEYWORDS)) return "Christ";
  return "Traditional";
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

/**
 * The canonical list of categories rendered as filter chips on
 * /prayers. Stored alongside the categorizer so the UI cannot drift
 * out of sync.
 */
export const PRAYER_CATEGORY_ORDER: ReadonlyArray<PrayerCategory> = [
  "Marian",
  "Christ",
  "Angelic",
  "Eucharistic",
  "Sacramental",
  "Rosary",
  "Chaplet",
  "Novena",
  "Litany",
  "Liturgical",
  "Seasonal",
  "Daily",
  "Dominical",
  "Traditional",
];
