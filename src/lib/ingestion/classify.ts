import { buildSlug } from "./sources/categorize";
import type {
  IngestedApparition,
  IngestedDevotion,
  IngestedGuide,
  IngestedItem,
  IngestedKind,
  IngestedLiturgy,
  IngestedPrayer,
  IngestedSaint,
} from "./types";

/**
 * Re-classifier for ingested items. The adapter tags every item with
 * a `kind` based on which adapter discovered it, but adapters often
 * make mistakes — a "prayer" adapter can pull a saint biography, a
 * "saints" adapter can pull a Marian apparition page. Bouncing the
 * item would lose the content; routing it to the correct kind keeps
 * it.
 *
 * The classifier scores every kind against the item's textual
 * content and re-routes when another kind is a meaningfully better
 * fit. "Meaningfully better" = the new kind scores at least 4 points
 * higher than the original, so noisy ties don't flip the kind.
 *
 * Five buckets are considered:
 *   - prayer (vocative direct address, "Amen", liturgical formulas)
 *   - saint (biographical markers, dates, patronage references)
 *   - apparition (Marian vocabulary, visionary language)
 *   - devotion (devotional practice names + verbs)
 *   - liturgy (council / sacrament / encyclical / catechetical markers)
 *   - guide (how-to / examination / preparation patterns)
 *
 * Parishes are not re-classified — a parish listing has a very
 * different shape (name + address + phone) and the parish adapter
 * keys off URL paths, so re-routing into / out of `parish` would
 * cause far more confusion than it solves.
 */

type Scores = Partial<Record<IngestedKind, number>>;

const PRAYER_MARKERS = [
  /\bamen\b/i,
  /\b(o\s+lord|o\s+god|o\s+jesus|o\s+holy|o\s+mary|o\s+father|o\s+sacred)\b/i,
  /\b(hail\s+mary|our\s+father|glory\s+be|let\s+us\s+pray|lord\s+have\s+mercy|kyrie\s+eleison|soul\s+of\s+christ|mother\s+of\s+(god|mercy))\b/i,
  /\b(pray|grant|hear|have\s+mercy|deliver\s+us|hallowed|we\s+beseech|veni|magnificat|sanctify|preserve\s+us|protect\s+us|come\s+holy)\b/i,
  /\bin\s+the\s+name\s+of\s+the\s+(father|son|holy\s+spirit)\b/i,
];

const SAINT_MARKERS = [
  /\b(saint|st\.?|santo|santa|san|blessed|bl\.?|venerable|martyr|virgin|priest|monk|nun|abbot|bishop|pope|doctor\s+of\s+the\s+church)\b/i,
  /\b(born|died|canonized|canonised|beatified|beatification|feast\s+day|patron(ess)?\s+(of|saint))\b/i,
  /\b(century|in\s+\d{3,4}|\d{3,4}\s*(AD|BC|CE))\b/i,
  /\b(was\s+ordained|was\s+consecrated|entered\s+the\s+(order|monastery|convent))\b/i,
];

const APPARITION_MARKERS = [
  /\b(our\s+lady|blessed\s+virgin|virgin\s+mary|madonna|theotokos|nuestra\s+señora|notre\s+dame)\b/i,
  /\b(appear(ed|ance|ing)|apparition|vision|visionary|seer)\b/i,
  /\b(lourdes|fatima|guadalupe|knock|akita|la\s+salette|banneux|beauraing|kibeho|champion)\b/i,
];

const DEVOTION_MARKERS = [
  /\b(devotion|rosary|novena|chaplet|consecration|adoration|holy\s+hour|stations\s+of\s+the\s+cross|via\s+crucis|first\s+(friday|saturday)|scapular|brown\s+scapular|miraculous\s+medal|divine\s+mercy)\b/i,
  /\b(daily\s+prayer\s+practice|monthly\s+devotion|spiritual\s+exercise)\b/i,
];

const LITURGY_MARKERS = [
  /\b(catechism|encyclical|council|synod|sacrament|mass|eucharist|baptism|confirmation|matrimony|holy\s+orders|anointing|reconciliation|liturgical\s+year|advent|lent|paschal|nicaea|chalcedon|trent|vatican\s+(i|ii))\b/i,
  /\b(apostolic\s+exhortation|apostolic\s+letter|motu\s+proprio|canon\s+law)\b/i,
];

const GUIDE_MARKERS = [
  /\b(how\s+to|step[- ]by[- ]step|preparing\s+(for|to)|preparation\s+for|examination\s+of\s+conscience|a\s+guide\s+to|practical\s+guide|guidelines\s+for)\b/i,
  /\b(daily\s+routine|weekly\s+plan|month-long|forty-day|33[- ]day|nine[- ]day)\b/i,
];

function countMatches(haystack: string, patterns: RegExp[]): number {
  let n = 0;
  for (const re of patterns) if (re.test(haystack)) n += 1;
  return n;
}

/**
 * Compute a per-kind score for a given text blob. Each matched
 * marker adds points; the highest-scoring kind is the suggested
 * re-route target.
 */
function scoreBlob(blob: string): Scores {
  const lower = blob.toLowerCase();
  return {
    prayer: countMatches(lower, PRAYER_MARKERS) * 3,
    saint: countMatches(lower, SAINT_MARKERS) * 2,
    apparition: countMatches(lower, APPARITION_MARKERS) * 4,
    devotion: countMatches(lower, DEVOTION_MARKERS) * 3,
    liturgy: countMatches(lower, LITURGY_MARKERS) * 2,
    guide: countMatches(lower, GUIDE_MARKERS) * 3,
  };
}

function pickBestKind(scores: Scores, original: IngestedKind): IngestedKind {
  let best: IngestedKind = original;
  let bestScore = scores[original] ?? 0;
  for (const [kind, score] of Object.entries(scores) as Array<[IngestedKind, number]>) {
    if (kind === original) continue;
    if (kind === "parish") continue;
    // Only re-route when the alternative is meaningfully better. A
    // gap of 4 means roughly two extra unique marker categories, not
    // just one noisy keyword match.
    if (score > bestScore + 3) {
      best = kind;
      bestScore = score;
    }
  }
  return best;
}

function blobFromItem(item: IngestedItem): string {
  switch (item.kind) {
    case "prayer":
      return `${item.defaultTitle ?? ""}\n${item.body ?? ""}`;
    case "saint":
      return `${item.canonicalName ?? ""}\n${item.biography ?? ""}`;
    case "apparition":
      return `${item.title ?? ""}\n${item.summary ?? ""}`;
    case "parish":
      return `${item.name ?? ""}\n${item.address ?? ""}`;
    case "devotion":
      return `${item.title ?? ""}\n${item.summary ?? ""}\n${item.practiceText ?? ""}`;
    case "liturgy":
      return `${item.title ?? ""}\n${item.summary ?? ""}\n${item.body ?? ""}`;
    case "guide":
      return `${item.title ?? ""}\n${item.summary ?? ""}\n${item.bodyText ?? ""}`;
  }
}

/**
 * Re-shape an item to a new kind. The original `slug` and
 * `externalSourceKey` are preserved (so dedup keeps working), and
 * fields that don't exist on the target kind are dropped with
 * sensible defaults filled in where the new kind requires them.
 */
function reshape(item: IngestedItem, target: IngestedKind): IngestedItem {
  const slug = item.slug;
  const externalSourceKey = (item as { externalSourceKey?: string }).externalSourceKey;
  const tagSlugs = (item as { tagSlugs?: string[] }).tagSlugs;

  // Pull the best title + body text the original item carries.
  let title = "";
  let body = "";
  switch (item.kind) {
    case "prayer":
      title = item.defaultTitle ?? "";
      body = item.body ?? "";
      break;
    case "saint":
      title = item.canonicalName ?? "";
      body = item.biography ?? "";
      break;
    case "apparition":
      title = item.title ?? "";
      body = item.summary ?? "";
      break;
    case "parish":
      title = item.name ?? "";
      body = item.address ?? "";
      break;
    case "devotion":
      title = item.title ?? "";
      body = item.summary ?? "";
      break;
    case "liturgy":
      title = item.title ?? "";
      body = item.body ?? "";
      break;
    case "guide":
      title = item.title ?? "";
      body = item.summary ?? "";
      break;
  }

  switch (target) {
    case "prayer": {
      const out: IngestedPrayer = {
        kind: "prayer",
        slug,
        defaultTitle: title || "Untitled prayer",
        category: "Devotional",
        body,
        externalSourceKey,
        tagSlugs,
      };
      return out;
    }
    case "saint": {
      const out: IngestedSaint = {
        kind: "saint",
        slug,
        canonicalName: title || "Unnamed",
        patronages: [],
        biography: body,
        externalSourceKey,
        tagSlugs,
      };
      return out;
    }
    case "apparition": {
      const out: IngestedApparition = {
        kind: "apparition",
        slug,
        title: title || "Untitled apparition",
        approvedStatus: "Pending",
        summary: body,
        externalSourceKey,
        tagSlugs,
      };
      return out;
    }
    case "devotion": {
      const out: IngestedDevotion = {
        kind: "devotion",
        slug,
        title: title || "Untitled devotion",
        summary: body.slice(0, 800),
        practiceText: body.length > 800 ? body : undefined,
        externalSourceKey,
        tagSlugs,
      };
      return out;
    }
    case "liturgy": {
      const out: IngestedLiturgy = {
        kind: "liturgy",
        slug,
        liturgyKind: "GENERAL",
        title: title || "Untitled liturgy entry",
        body,
        externalSourceKey,
        tagSlugs,
      };
      return out;
    }
    case "guide": {
      const out: IngestedGuide = {
        kind: "guide",
        slug,
        guideKind: "GENERAL",
        title: title || "Untitled guide",
        summary: body.slice(0, 800),
        bodyText: body.length > 800 ? body : undefined,
        externalSourceKey,
        tagSlugs,
      };
      return out;
    }
    case "parish":
      // We never re-route INTO parish: parishes have a structurally
      // different shape (address/city/country/phone). Return original.
      return item;
  }
}

export type ClassifyResult = {
  /** Item after re-classification (same kind if no re-route was needed). */
  item: IngestedItem;
  /** Original kind, for logging. */
  originalKind: IngestedKind;
  /** Re-routed kind. Same as originalKind when no change. */
  newKind: IngestedKind;
  /** Per-kind score breakdown. */
  scores: Scores;
};

/**
 * Score the item against every kind and re-route if another kind is
 * meaningfully better. Parishes are pass-through (we never re-route
 * a non-parish into parish, and re-routing a parish to anything else
 * would lose location data).
 */
export function classifyIngestedItem(item: IngestedItem): ClassifyResult {
  if (item.kind === "parish") {
    return {
      item,
      originalKind: "parish",
      newKind: "parish",
      scores: { parish: 1 },
    };
  }
  const blob = blobFromItem(item);
  if (blob.trim().length === 0) {
    return {
      item,
      originalKind: item.kind,
      newKind: item.kind,
      scores: {},
    };
  }
  const scores = scoreBlob(blob);
  const best = pickBestKind(scores, item.kind);
  if (best === item.kind) {
    return { item, originalKind: item.kind, newKind: item.kind, scores };
  }
  // Re-shape: bring fields the new kind needs across, drop fields it
  // doesn't have. Also re-stamp the slug with the new kind's
  // conventional prefix so it's not confused with the old bucket.
  const reshaped = reshape(item, best);
  const newSlug = ensureKindPrefix(reshaped.slug, best);
  const slugged = { ...reshaped, slug: newSlug };
  return {
    item: slugged,
    originalKind: item.kind,
    newKind: best,
    scores,
  };
}

/**
 * Optional prefix-stamp so a re-routed item gets a slug that won't
 * collide with the source kind's namespace. We only prefix when the
 * slug doesn't already start with the right marker — this is purely
 * a defensive cleanup and the persister still enforces uniqueness.
 */
function ensureKindPrefix(slug: string, kind: IngestedKind): string {
  const prefixes: Partial<Record<IngestedKind, string>> = {
    apparition: "apparition-",
    devotion: "devotion-",
    guide: "guide-",
    liturgy: "liturgy-",
  };
  const want = prefixes[kind];
  if (!want) return slug;
  if (slug.startsWith(want)) return slug;
  return buildSlug(`${want}${slug}`);
}

export function classifyIngestedItems(items: IngestedItem[]): ClassifyResult[] {
  return items.map(classifyIngestedItem);
}
