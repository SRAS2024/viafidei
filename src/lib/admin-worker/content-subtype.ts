/**
 * Deterministic content-subtype classifier.
 *
 * The coverage model tracks breadth per (contentType, contentSubtype) by reading
 * `payload->>'contentSubtype'` off each PublishedContent row, and subtype-aware
 * discovery targets the neediest subtype. This resolver runs at the single
 * publish choke point (the publish orchestrator) and stamps the best subtype
 * for the item so per-subtype coverage becomes real.
 *
 * It is deterministic and conservative, and it reads the payload's OWN schema
 * field first (liturgical `kind`, guide `kind`, `devotionType`, `practiceKind`,
 * `documentType`, `approvedStatus`, `sacramentKey`, rite `entryKind`…) before
 * falling back to title/slug/summary signals:
 *   - Types with exactly ONE catalog subtype get it (100% correct).
 *   - Types with NO subtypes get null (nothing to track).
 *   - Multi-subtype types are classified from the payload field when present,
 *     then by clear title/slug/summary signals, defaulting to the neutral
 *     subtype and returning null (never a guess) for doctrinally-sensitive
 *     types when no signal matches — so it can never mislabel an encyclical vs
 *     a decree, or an under-review apparition as approved.
 */

import { MARIAN_DOGMA_YEARS, deriveRiteEntryKind } from "@/lib/content-shared/content-subtitle";
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

function field(payload: Record<string, unknown> | null | undefined, key: string): string {
  const v = payload?.[key];
  return typeof v === "string" ? v.trim() : "";
}

/** The payload field value when it is one of the catalog's declared subtypes. */
function declared(contentType: string, value: string): string | null {
  return value && catalogSubtypes(contentType).includes(value) ? value : null;
}

const PRAYER_TYPE_SUBTYPE: Record<string, string> = {
  marian: "marian_prayer",
  rosary: "marian_prayer",
  litany: "full_litany",
  psalm: "liturgical_prayer",
  canticle: "liturgical_prayer",
};

const SACRAMENT_GROUP: Record<string, string> = {
  baptism: "sacrament_of_initiation",
  confirmation: "sacrament_of_initiation",
  eucharist: "sacrament_of_initiation",
  reconciliation: "sacrament_of_healing",
  anointing_of_the_sick: "sacrament_of_healing",
  holy_orders: "sacrament_of_service",
  matrimony: "sacrament_of_service",
};

const APPROVED_STATUSES = new Set(["approved", "constat_de_supernaturalitate", "nihil_obstat"]);
const REVIEW_STATUSES = new Set([
  "under_investigation",
  "not_yet_judged",
  "prae_oculis_habeatur",
  "curatur",
  "sub_mandato",
]);
const CONDEMNED_STATUSES = new Set([
  "not_supernatural",
  "declaratio_de_non_supernaturalitate",
  "prohibetur_et_obstruatur",
]);
const UNAPPROVED_STATUSES = new Set(["non_constat", "private_revelation"]);

/** Refine a council document into constitution / decree / declaration from its text. */
function councilDocumentSubtype(h: string): string {
  if (/\bconstitution\b/.test(h)) return "council_constitution";
  if (/\bdecree\b/.test(h)) return "council_decree";
  if (/\bdeclaration\b/.test(h)) return "council_declaration";
  return "council_document";
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
    // --- Payload-field-first types (the schema field IS the subtype) --------
    case "LITURGICAL":
      return declared(contentType, field(payload, "kind"));
    case "GUIDE":
      return declared(contentType, field(payload, "kind"));
    case "SPIRITUAL_PRACTICE":
      return declared(contentType, field(payload, "practiceKind"));
    case "DEVOTION":
      return declared(contentType, field(payload, "devotionType"));
    case "SACRAMENT":
      return SACRAMENT_GROUP[field(payload, "sacramentKey")] ?? null;
    case "RITE":
      return deriveRiteEntryKind(payload ?? {});
    case "MARIAN_TITLE": {
      const slug = field(payload, "slug");
      const dogmaYear = payload?.dogmaDefinedYear;
      if ((typeof dogmaYear === "number" && dogmaYear > 0) || (slug && slug in MARIAN_DOGMA_YEARS))
        return "marian_dogma";
      if (field(payload, "associatedApparitionSlug")) return "apparition_title";
      return slug ? "devotional_title" : null; // no slug → no signal → never guess
    }

    case "PRAYER": {
      const byType = PRAYER_TYPE_SUBTYPE[field(payload, "prayerType")];
      if (byType) return byType;
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
      // The schema field is `approvedStatus` (an enum); legacy payloads carried
      // free-text `approvalStatus` / `status`. Never default to "approved".
      const schemaStatus = field(payload, "approvedStatus").toLowerCase();
      if (schemaStatus) {
        if (APPROVED_STATUSES.has(schemaStatus)) return "approved_apparition";
        if (REVIEW_STATUSES.has(schemaStatus)) return "apparition_under_review";
        if (CONDEMNED_STATUSES.has(schemaStatus)) return "condemned_apparition";
        if (UNAPPROVED_STATUSES.has(schemaStatus)) return "unapproved_apparition";
        return null;
      }
      const legacy = String(payload?.approvalStatus ?? payload?.status ?? "").toLowerCase();
      if (!legacy) return null;
      if (legacy.includes("condemn")) return "condemned_apparition";
      if (legacy.includes("unapprov") || legacy.includes("not approv"))
        return "unapproved_apparition";
      if (legacy.includes("review") || legacy.includes("pending")) return "apparition_under_review";
      if (legacy.includes("approv")) return "approved_apparition";
      return null;
    }
    case "CHURCH_DOCUMENT": {
      const documentType = field(payload, "documentType");
      if (documentType) {
        if (documentType === "council_document") {
          // Refine a document OF a council (Lumen Gentium…) by its own text; the
          // council itself (issuingAuthority "Catholic Church") stays as-is.
          const authority = field(payload, "issuingAuthority");
          return /council/i.test(authority) ? councilDocumentSubtype(h) : "council_document";
        }
        if (documentType === "catechism_section") return "catechism_paragraph";
        return declared(contentType, documentType) ?? documentType;
      }
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
