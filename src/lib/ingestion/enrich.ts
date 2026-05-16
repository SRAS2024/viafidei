import { categorizeDevotion, categorizePrayer } from "./sources/categorize";
import type {
  IngestedApparition,
  IngestedDevotion,
  IngestedGuide,
  IngestedItem,
  IngestedLiturgy,
  IngestedParish,
  IngestedPrayer,
  IngestedSaint,
} from "./types";

/**
 * Fill in missing fields on an IngestedItem from signals already
 * present in its text. The enricher never overwrites a field that
 * the adapter populated — it only fills gaps. This is the
 * "intelligently package content" stage: instead of bouncing an
 * item that's missing its category / feast day / location, we
 * derive the missing piece and keep the row.
 *
 * Per-kind:
 *
 *   prayer    — derive `category` from body keywords when missing.
 *   saint     — extract `patronages[]` from "patron of X" patterns;
 *               extract `feastDay`, `feastMonth`, `feastDayOfMonth`
 *               from "feast day is on X" patterns.
 *   apparition — extract `location` + `country` from named
 *               apparition sites; default `approvedStatus` to
 *               "Pending" so the item can reach the database for
 *               human review.
 *   parish    — extract `city` / `region` / `country` from the
 *               address line; derive `diocese` from URL hints.
 *   devotion  — derive `durationMinutes` from devotion type;
 *               derive `tagSlugs` from category.
 *   liturgy   — pick best `liturgyKind` from title + body.
 *   guide     — pick best `guideKind` from title + body.
 *
 * The enricher returns a new object — callers can compare before
 * and after, and the `kind` discriminator is preserved so type
 * narrowing keeps working.
 */

/* ------------------------------------------------------------------ */
/* Saint helpers                                                      */
/* ------------------------------------------------------------------ */

const PATRONAGE_PATTERNS: ReadonlyArray<RegExp> = [
  /\bpatron(?:ess)?\s+of\s+([^.;:\n]{3,120})/gi,
  /\bpatron(?:ess)?\s+saint\s+of\s+([^.;:\n]{3,120})/gi,
  /\bis\s+(?:invoked|honored|honoured)\s+as\s+(?:the\s+)?patron(?:ess)?\s+of\s+([^.;:\n]{3,120})/gi,
];

function extractPatronages(text: string): string[] {
  if (!text) return [];
  const out = new Set<string>();
  for (const re of PATRONAGE_PATTERNS) {
    const matches = Array.from(text.matchAll(re));
    for (const m of matches) {
      const raw = m[1]?.trim();
      if (!raw) continue;
      // Split on "," / ";" / "&" / "/" and standalone "and" so a
      // multi-patronage phrase like "animals, ecology, and Italy"
      // lifts into three separate entries.
      for (const piece of raw.split(/\s*[,;&/]\s*|\s+and\s+/i)) {
        const norm = piece
          .replace(/^(the|a|an)\s+/i, "")
          .replace(/^and\s+/i, "")
          .replace(/[.;:].*$/, "")
          .trim();
        if (norm.length >= 3 && norm.length <= 80) out.add(norm);
      }
    }
    if (out.size >= 8) break;
  }
  return Array.from(out).slice(0, 8);
}

const MONTH_NAMES = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

function parseFeastDay(text: string): { feastDay: string; month: number; day: number } | null {
  if (!text) return null;
  // "feast day is October 4" / "celebrated on October 4" / "Memorial: October 4"
  const re =
    /\b(?:feast\s+day(?:\s+is)?|celebrated\s+on|memorial(?:\s+of)?|commemorated\s+on|feast(?:\s+of)?)[:\s]+([a-z]+)\s+(\d{1,2})\b/i;
  const m = text.match(re);
  if (!m) return null;
  const monthName = m[1].toLowerCase();
  const day = parseInt(m[2], 10);
  const monthIdx = MONTH_NAMES.indexOf(monthName);
  if (monthIdx < 0 || !Number.isFinite(day) || day < 1 || day > 31) return null;
  return {
    feastDay: `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)} ${day}`,
    month: monthIdx + 1,
    day,
  };
}

function enrichSaint(item: IngestedSaint): IngestedSaint {
  const enriched: IngestedSaint = { ...item };

  if (!enriched.patronages || enriched.patronages.length === 0) {
    const derived = extractPatronages(item.biography ?? "");
    if (derived.length > 0) enriched.patronages = derived;
    else enriched.patronages = [];
  }

  if (!enriched.feastDay || !enriched.feastMonth || !enriched.feastDayOfMonth) {
    const parsed = parseFeastDay(item.biography ?? "");
    if (parsed) {
      if (!enriched.feastDay) enriched.feastDay = parsed.feastDay;
      if (!enriched.feastMonth) enriched.feastMonth = parsed.month;
      if (!enriched.feastDayOfMonth) enriched.feastDayOfMonth = parsed.day;
    }
  }

  return enriched;
}

/* ------------------------------------------------------------------ */
/* Apparition helpers                                                 */
/* ------------------------------------------------------------------ */

type ApparitionSite = {
  pattern: RegExp;
  location: string;
  country: string;
  approved: string;
};

const APPARITION_SITES: ApparitionSite[] = [
  { pattern: /\blourdes\b/i, location: "Lourdes", country: "France", approved: "Approved" },
  { pattern: /\bfatima\b/i, location: "Fátima", country: "Portugal", approved: "Approved" },
  {
    pattern: /\bguadalupe\b/i,
    location: "Guadalupe",
    country: "Mexico",
    approved: "Approved",
  },
  { pattern: /\bknock\b/i, location: "Knock", country: "Ireland", approved: "Approved" },
  { pattern: /\bakita\b/i, location: "Akita", country: "Japan", approved: "Approved" },
  {
    pattern: /\bla\s+salette\b/i,
    location: "La Salette",
    country: "France",
    approved: "Approved",
  },
  {
    pattern: /\bbanneux\b/i,
    location: "Banneux",
    country: "Belgium",
    approved: "Approved",
  },
  {
    pattern: /\bbeauraing\b/i,
    location: "Beauraing",
    country: "Belgium",
    approved: "Approved",
  },
  { pattern: /\bkibeho\b/i, location: "Kibeho", country: "Rwanda", approved: "Approved" },
  {
    pattern: /\bczestochowa\b/i,
    location: "Częstochowa",
    country: "Poland",
    approved: "Approved",
  },
];

function enrichApparition(item: IngestedApparition): IngestedApparition {
  const enriched: IngestedApparition = { ...item };
  const blob = `${item.title ?? ""} ${item.summary ?? ""}`;
  for (const site of APPARITION_SITES) {
    if (site.pattern.test(blob)) {
      if (!enriched.location) enriched.location = site.location;
      if (!enriched.country) enriched.country = site.country;
      // Default to the site's known status only when the adapter left it blank.
      if (!enriched.approvedStatus || enriched.approvedStatus.trim().length === 0) {
        enriched.approvedStatus = site.approved;
      }
      break;
    }
  }
  // Catch-all: if approvedStatus is still empty, default to Pending so
  // the row passes the validator and lands in REVIEW for an admin.
  if (!enriched.approvedStatus || enriched.approvedStatus.trim().length === 0) {
    enriched.approvedStatus = "Pending";
  }
  return enriched;
}

/* ------------------------------------------------------------------ */
/* Prayer helpers                                                     */
/* ------------------------------------------------------------------ */

function enrichPrayer(item: IngestedPrayer): IngestedPrayer {
  const enriched: IngestedPrayer = { ...item };
  if (!enriched.category || enriched.category.trim().length === 0) {
    enriched.category = categorizePrayer({
      title: item.defaultTitle ?? "",
      body: item.body ?? "",
    });
  }
  return enriched;
}

/* ------------------------------------------------------------------ */
/* Devotion helpers                                                   */
/* ------------------------------------------------------------------ */

const DEVOTION_DURATIONS: Array<{ pattern: RegExp; minutes: number }> = [
  { pattern: /\b(rosary|five[- ]decade)\b/i, minutes: 20 },
  { pattern: /\b(chaplet of divine mercy|chaplet)\b/i, minutes: 10 },
  { pattern: /\bnovena\b/i, minutes: 15 },
  { pattern: /\b(stations of the cross|via crucis)\b/i, minutes: 30 },
  { pattern: /\b(holy hour|adoration)\b/i, minutes: 60 },
  { pattern: /\b(litany)\b/i, minutes: 10 },
];

function enrichDevotion(item: IngestedDevotion): IngestedDevotion {
  const enriched: IngestedDevotion = { ...item };
  const blob = `${item.title ?? ""} ${item.summary ?? ""}`;
  if (!enriched.durationMinutes || enriched.durationMinutes <= 0) {
    for (const d of DEVOTION_DURATIONS) {
      if (d.pattern.test(blob)) {
        enriched.durationMinutes = d.minutes;
        break;
      }
    }
  }
  if (!enriched.tagSlugs || enriched.tagSlugs.length === 0) {
    const cat = categorizeDevotion({
      title: item.title ?? "",
      summary: item.summary ?? "",
    });
    if (cat !== "general") enriched.tagSlugs = [cat];
  }
  return enriched;
}

/* ------------------------------------------------------------------ */
/* Parish helpers                                                     */
/* ------------------------------------------------------------------ */

const HOST_DIOCESE_MAP: ReadonlyArray<{ pattern: RegExp; diocese: string }> = [
  { pattern: /archny\.org/i, diocese: "Archdiocese of New York" },
  { pattern: /archchicago\.org/i, diocese: "Archdiocese of Chicago" },
  { pattern: /rcab\.org/i, diocese: "Archdiocese of Boston" },
  { pattern: /archmil\.org/i, diocese: "Archdiocese of Milwaukee" },
  { pattern: /rcdow\.org\.uk/i, diocese: "Archdiocese of Westminster" },
  { pattern: /lacatholics\.org|rcaola\.org/i, diocese: "Archdiocese of Los Angeles" },
  { pattern: /archphila\.org/i, diocese: "Archdiocese of Philadelphia" },
  { pattern: /archatl\.com/i, diocese: "Archdiocese of Atlanta" },
  { pattern: /archbalt\.org/i, diocese: "Archdiocese of Baltimore" },
  { pattern: /archstl\.org/i, diocese: "Archdiocese of Saint Louis" },
  { pattern: /archden\.org/i, diocese: "Archdiocese of Denver" },
  { pattern: /miamiarch\.org/i, diocese: "Archdiocese of Miami" },
  { pattern: /archsa\.org/i, diocese: "Archdiocese of San Antonio" },
  { pattern: /sfarchdiocese\.org/i, diocese: "Archdiocese of San Francisco" },
  { pattern: /seattlearchdiocese\.org/i, diocese: "Archdiocese of Seattle" },
  { pattern: /archtoronto\.org/i, diocese: "Archdiocese of Toronto" },
  { pattern: /diomelb\.org\.au/i, diocese: "Archdiocese of Melbourne" },
  { pattern: /sydneycatholic\.org/i, diocese: "Archdiocese of Sydney" },
  { pattern: /dublindiocese\.ie/i, diocese: "Archdiocese of Dublin" },
];

function inferDiocese(item: IngestedParish): string | undefined {
  const key = item.externalSourceKey ?? "";
  for (const e of HOST_DIOCESE_MAP) {
    if (e.pattern.test(key)) return e.diocese;
  }
  return undefined;
}

// US state abbreviations / common country tokens. Captures the city
// (single or multi-word, e.g. "New York", "Los Angeles"), the
// optional two-letter state code, and optional country suffix.
// Accepts addresses like:
//   "St Patrick's Church, Boston, MA 02118"
//   "5th Avenue, New York, NY 10022"
//   "1 Main St, Saint Louis, MO 63101, USA"
const US_STATE_RE =
  /,\s*([A-Z][A-Za-z. ]+?)(?:,?\s+([A-Z]{2}))?(?:\s+\d{5}(?:-\d{4})?)?\s*(?:,\s*(USA|United States))?\s*$/;

function enrichParish(item: IngestedParish): IngestedParish {
  const enriched: IngestedParish = { ...item };
  if (item.address && (!item.city || !item.region || !item.country)) {
    const m = item.address.match(US_STATE_RE);
    if (m) {
      if (!enriched.city) enriched.city = m[1];
      if (!enriched.region && m[2]) enriched.region = m[2];
      if (!enriched.country) enriched.country = m[3] ?? "USA";
    }
  }
  if (!enriched.diocese) {
    const d = inferDiocese(item);
    if (d) enriched.diocese = d;
  }
  return enriched;
}

/* ------------------------------------------------------------------ */
/* Liturgy + Guide helpers                                            */
/* ------------------------------------------------------------------ */

function pickLiturgyKind(item: IngestedLiturgy): IngestedLiturgy["liturgyKind"] {
  const blob = `${item.title ?? ""} ${item.body ?? ""}`.toLowerCase();
  if (
    /council|nicaea|trent|vatican\s+i|vatican\s+ii|chalcedon|ephesus|lateran|florence|constance/.test(
      blob,
    )
  ) {
    return "COUNCIL_TIMELINE";
  }
  if (/marriage|matrimony|wedding/.test(blob)) return "MARRIAGE_RITE";
  if (/funeral|burial/.test(blob)) return "FUNERAL_RITE";
  if (/\bordin(?:ation|ed)\b/.test(blob)) return "ORDINATION_RITE";
  if (/liturgical[- ]year|advent|lent|christmas|easter|paschal/.test(blob)) {
    return "LITURGICAL_YEAR";
  }
  if (/mass|eucharist/.test(blob)) return "MASS_STRUCTURE";
  if (/symbol|sign|vestment|chasuble|alb|stole|chalice|paten/.test(blob)) return "SYMBOLISM";
  if (/glossary|dictionary|terminology/.test(blob)) return "GLOSSARY";
  return "GENERAL";
}

function enrichLiturgy(item: IngestedLiturgy): IngestedLiturgy {
  const enriched: IngestedLiturgy = { ...item };
  if (!enriched.liturgyKind || enriched.liturgyKind === "GENERAL") {
    enriched.liturgyKind = pickLiturgyKind(item);
  }
  return enriched;
}

function pickGuideKind(item: IngestedGuide): IngestedGuide["guideKind"] {
  const blob = `${item.title ?? ""} ${item.summary ?? ""}`.toLowerCase();
  if (/rosary|rosario/.test(blob)) return "ROSARY";
  if (/confession|reconciliation|penance/.test(blob)) return "CONFESSION";
  if (/adoration|eucharist/.test(blob)) return "ADORATION";
  if (/consecration|marian/.test(blob)) return "CONSECRATION";
  if (/vocation|discern/.test(blob)) return "VOCATION";
  if (/devotion|novena|chaplet/.test(blob)) return "DEVOTION";
  return "GENERAL";
}

function enrichGuide(item: IngestedGuide): IngestedGuide {
  const enriched: IngestedGuide = { ...item };
  if (!enriched.guideKind || enriched.guideKind === "GENERAL") {
    enriched.guideKind = pickGuideKind(item);
  }
  return enriched;
}

/* ------------------------------------------------------------------ */
/* Top-level dispatch                                                 */
/* ------------------------------------------------------------------ */

export function enrichIngestedItem(item: IngestedItem): IngestedItem {
  switch (item.kind) {
    case "prayer":
      return enrichPrayer(item);
    case "saint":
      return enrichSaint(item);
    case "apparition":
      return enrichApparition(item);
    case "parish":
      return enrichParish(item);
    case "devotion":
      return enrichDevotion(item);
    case "liturgy":
      return enrichLiturgy(item);
    case "guide":
      return enrichGuide(item);
  }
}

export function enrichIngestedItems(items: IngestedItem[]): IngestedItem[] {
  return items.map(enrichIngestedItem);
}
