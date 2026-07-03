/**
 * Deterministic content-subtype classifier.
 *
 * The coverage model tracks breadth per (contentType, contentSubtype) by reading
 * `payload->>'contentSubtype'` off each PublishedContent row, and subtype-aware
 * discovery targets the neediest subtype. But no producer stamps a subtype, so
 * every item read as "untagged" and every catalog subtype read as MISSING — the
 * subtype half of coverage was blind. This resolver runs at the single publish
 * choke point (the publish orchestrator) and stamps the best subtype for the
 * item so per-subtype coverage becomes real.
 *
 * It is deterministic and conservative:
 *   - Types with exactly ONE catalog subtype get it (100% correct).
 *   - Types with NO subtypes get null (nothing to track).
 *   - Multi-subtype types are classified by clear title/slug/payload signals,
 *     defaulting to the neutral/primary subtype and returning null (never a
 *     guess) for doctrinally-sensitive types when no signal matches — so it can
 *     never mislabel an encyclical vs a decree, etc.
 */

import { CONTENT_TYPE_CATALOG } from "./skills/catalog";

/** Catalog subtypes for a content-type name (the 15 enum types align by name). */
function catalogSubtypes(contentType: string): readonly string[] {
  const spec = CONTENT_TYPE_CATALOG.find((s) => s.type === contentType);
  return spec?.subtypes ?? [];
}

function haystack(payload: Record<string, unknown> | null | undefined): string {
  if (!payload) return "";
  const parts = [payload.title, payload.slug, payload.name, payload.summary]
    .filter((v): v is string => typeof v === "string")
    .join(" ");
  return parts.toLowerCase();
}

/**
 * Resolve the content subtype for a published item, or null when the type has
 * no subtypes / no confident classification.
 */
export function resolveContentSubtype(
  contentType: string,
  payload: Record<string, unknown> | null | undefined,
): string | null {
  // Honour an explicit subtype already on the payload (a producer that knows).
  const explicit = payload?.contentSubtype;
  if (typeof explicit === "string" && explicit.trim()) return explicit.trim();

  const subtypes = catalogSubtypes(contentType);
  if (subtypes.length === 0) return null; // nothing to track for this type
  if (subtypes.length === 1) return subtypes[0]; // unambiguous (saint_biography, pope_biography, …)

  const h = haystack(payload);

  switch (contentType) {
    case "PRAYER": {
      if (
        /\b(hail mary|our lady|blessed mother|rosary|angelus|memorare|regina|salve regina|magnificat|marian)\b/.test(
          h,
        )
      )
        return "marian_prayer";
      if (
        /\b(eucharist|blessed sacrament|adoration|tantum ergo|o salutaris|corpus christi|holy communion|anima christi)\b/.test(
          h,
        )
      )
        return "eucharistic_prayer";
      if (
        /\b(collect|antiphon|psalm|canticle|liturgy of the hours|divine office|vespers|lauds|compline|nunc dimittis)\b/.test(
          h,
        )
      )
        return "liturgical_prayer";
      return "common_prayer";
    }
    case "NOVENA":
      // A published novena is the whole devotion, not a single day.
      return "full_novena";
    case "APPARITION": {
      const status = String(payload?.approvalStatus ?? payload?.status ?? "").toLowerCase();
      if (status.includes("condemn")) return "condemned_apparition";
      if (status.includes("unapprov") || status.includes("not approv"))
        return "unapproved_apparition";
      if (status.includes("review") || status.includes("pending")) return "apparition_under_review";
      return "approved_apparition"; // curated apparitions are Church-approved
    }
    case "CHURCH_DOCUMENT": {
      if (/\bencyclical\b/.test(h)) return "encyclical";
      if (/\bexhortation\b/.test(h)) return "apostolic_exhortation";
      if (/\bapostolic constitution\b/.test(h)) return "apostolic_constitution";
      if (/\bmotu proprio\b/.test(h)) return "motu_proprio";
      if (/\bdecree\b/.test(h)) return "council_decree";
      if (/\bdeclaration\b/.test(h)) return "council_declaration";
      if (/\bconstitution\b/.test(h)) return "council_constitution";
      return null; // don't guess a doctrinal document's kind
    }
    default:
      return null;
  }
}
