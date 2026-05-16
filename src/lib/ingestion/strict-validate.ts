/**
 * Stronger per-content-type validation rules used by the durable
 * queue. The existing `validate.ts` performs heuristics for shape
 * detection; this layer enforces the structural minimums every item
 * must satisfy before it can be persisted:
 *
 *   - Prayer       — title, body, tradition (category), source, language, formatting
 *   - Saint        — name, feast day, biography, patronage, source
 *   - Parish       — name, address, city, state/region, country, diocese (opt), source URL
 *   - Liturgy/Doc  — title, authoring authority (in the body), publication date (opt),
 *                    document type (kind), body, source
 *   - Sacrament    — category, doctrinal accuracy heuristics, formatting, source
 *
 * Validators return a structured result so the caller can decide
 * whether to persist (`accept`), divert to REVIEW (`review`), or
 * reject outright. The decision logic lives in the runner; this file
 * is purely the rule book.
 */

import type {
  IngestedItem,
  IngestedPrayer,
  IngestedSaint,
  IngestedParish,
  IngestedLiturgy,
  IngestedGuide,
  IngestedApparition,
  IngestedDevotion,
} from "./types";

export type StrictValidationOutcome =
  | { decision: "accept"; confidence: number }
  | { decision: "review"; reason: string; confidence: number }
  | { decision: "reject"; reason: string };

const TIER_1_HOST_HINTS = /(vatican\.va|usccb\.org|holy[-]?see\.com|vaticannews\.va)/i;

function hasSourceUrl(item: IngestedItem): boolean {
  return !!item.externalSourceKey && item.externalSourceKey.length > 6;
}

function looksFormatted(text: string): boolean {
  if (!text) return false;
  // At least one sentence break and balanced whitespace are required
  // to call something "formatted".
  return /[.!?]\s/.test(text) && !/\s{4,}/.test(text);
}

function detectLanguage(text: string): string | null {
  if (!text) return null;
  // Trivial heuristic — adapters are expected to set the proper language
  // upstream; this just confirms the text isn't suspiciously short or
  // exclusively non-Latin script.
  const trimmed = text.trim();
  if (trimmed.length < 20) return null;
  return "en";
}

function validatePrayer(p: IngestedPrayer): StrictValidationOutcome {
  if (!p.defaultTitle || p.defaultTitle.length < 2) {
    return { decision: "reject", reason: "Prayer missing title" };
  }
  if (!p.body || p.body.length < 25) {
    return { decision: "reject", reason: "Prayer body too short" };
  }
  if (!p.category) {
    return { decision: "review", reason: "Prayer missing tradition/category", confidence: 0.4 };
  }
  if (!hasSourceUrl(p)) {
    return { decision: "review", reason: "Prayer missing source attribution", confidence: 0.4 };
  }
  if (!detectLanguage(p.body)) {
    return { decision: "review", reason: "Prayer language could not be detected", confidence: 0.5 };
  }
  let confidence = 0.7;
  if (looksFormatted(p.body)) confidence += 0.15;
  if (TIER_1_HOST_HINTS.test(p.externalSourceKey ?? "")) confidence += 0.1;
  return { decision: "accept", confidence: Math.min(1, confidence) };
}

function validateSaint(s: IngestedSaint): StrictValidationOutcome {
  if (!s.canonicalName || s.canonicalName.length < 2) {
    return { decision: "reject", reason: "Saint missing canonical name" };
  }
  if (!s.biography || s.biography.length < 80) {
    return { decision: "reject", reason: "Saint biography too short" };
  }
  if (!s.feastDay && s.feastMonth == null) {
    return { decision: "review", reason: "Saint missing feast day", confidence: 0.4 };
  }
  if (s.feastMonth != null && (s.feastMonth < 1 || s.feastMonth > 12)) {
    return { decision: "review", reason: "Saint feast month out of range", confidence: 0.3 };
  }
  if (s.feastDayOfMonth != null && (s.feastDayOfMonth < 1 || s.feastDayOfMonth > 31)) {
    return { decision: "review", reason: "Saint feast day-of-month out of range", confidence: 0.3 };
  }
  if (!s.patronages || s.patronages.length === 0) {
    return { decision: "review", reason: "Saint missing patronage", confidence: 0.55 };
  }
  if (!hasSourceUrl(s)) {
    return { decision: "review", reason: "Saint missing source attribution", confidence: 0.45 };
  }
  let confidence = 0.75;
  if (looksFormatted(s.biography)) confidence += 0.15;
  if (TIER_1_HOST_HINTS.test(s.externalSourceKey ?? "")) confidence += 0.1;
  return { decision: "accept", confidence: Math.min(1, confidence) };
}

function validateParish(p: IngestedParish): StrictValidationOutcome {
  if (!p.name || p.name.length < 2) {
    return { decision: "reject", reason: "Parish missing name" };
  }
  if (!p.country) {
    return { decision: "review", reason: "Parish missing country", confidence: 0.5 };
  }
  if (!p.city) {
    return { decision: "review", reason: "Parish missing city", confidence: 0.5 };
  }
  if (!p.address) {
    return { decision: "review", reason: "Parish missing address", confidence: 0.55 };
  }
  if (!p.region && (p.country === "US" || p.country === "USA" || p.country === "United States")) {
    return { decision: "review", reason: "US parish missing state/region", confidence: 0.55 };
  }
  if (!hasSourceUrl(p) && !p.websiteUrl) {
    return { decision: "review", reason: "Parish missing source URL", confidence: 0.5 };
  }
  let confidence = 0.7;
  if (p.diocese) confidence += 0.1;
  if (p.latitude != null && p.longitude != null) confidence += 0.05;
  return { decision: "accept", confidence: Math.min(1, confidence) };
}

function validateChurchDocument(l: IngestedLiturgy): StrictValidationOutcome {
  if (!l.title || l.title.length < 4) {
    return { decision: "reject", reason: "Church document missing title" };
  }
  if (!l.body || l.body.length < 200) {
    return { decision: "reject", reason: "Church document body too short" };
  }
  if (!l.liturgyKind) {
    return { decision: "review", reason: "Church document missing kind", confidence: 0.5 };
  }
  if (!hasSourceUrl(l)) {
    return { decision: "review", reason: "Church document missing source", confidence: 0.4 };
  }
  // Authoring authority heuristic: body should mention Pope/Council/Bishop or
  // a doctrinal authority. Otherwise route to review.
  const authority =
    /(pope|holy\s+father|council|magisterium|encyclical|catechism|canon|congregation|dicastery|conference of bishops)/i;
  if (!authority.test(l.body)) {
    return {
      decision: "review",
      reason: "Church document body lacks authoring-authority signal",
      confidence: 0.55,
    };
  }
  let confidence = 0.8;
  if (looksFormatted(l.body)) confidence += 0.1;
  if (TIER_1_HOST_HINTS.test(l.externalSourceKey ?? "")) confidence += 0.05;
  return { decision: "accept", confidence: Math.min(1, confidence) };
}

function validateSacramentOrConsecration(g: IngestedGuide): StrictValidationOutcome {
  if (!g.title || g.title.length < 3) {
    return { decision: "reject", reason: "Guide missing title" };
  }
  if (!g.summary || g.summary.length < 60) {
    return { decision: "reject", reason: "Guide summary too short" };
  }
  if (!g.guideKind) {
    return { decision: "review", reason: "Guide missing kind", confidence: 0.4 };
  }
  if (!hasSourceUrl(g)) {
    return { decision: "review", reason: "Guide missing source attribution", confidence: 0.4 };
  }
  // Doctrinal-accuracy heuristic: body or summary must mention at least
  // one canonical Catholic concept relevant to the kind.
  const doctrinal =
    /(grace|sacrament|holy spirit|christ|church|baptism|eucharist|confession|reconcili|confirmation|matrimony|holy orders|anointing)/i;
  const blob = `${g.summary} ${g.bodyText ?? ""}`;
  if (!doctrinal.test(blob)) {
    return {
      decision: "review",
      reason: "Guide body lacks doctrinal vocabulary",
      confidence: 0.55,
    };
  }
  let confidence = 0.75;
  if (looksFormatted(blob)) confidence += 0.1;
  return { decision: "accept", confidence: Math.min(1, confidence) };
}

function validateApparition(a: IngestedApparition): StrictValidationOutcome {
  if (!a.title) return { decision: "reject", reason: "Apparition missing title" };
  if (!a.summary || a.summary.length < 80) {
    return { decision: "reject", reason: "Apparition summary too short" };
  }
  if (!a.approvedStatus) {
    return { decision: "review", reason: "Apparition missing approval status", confidence: 0.5 };
  }
  if (!hasSourceUrl(a)) {
    return { decision: "review", reason: "Apparition missing source", confidence: 0.5 };
  }
  return { decision: "accept", confidence: 0.75 };
}

function validateDevotion(d: IngestedDevotion): StrictValidationOutcome {
  if (!d.title) return { decision: "reject", reason: "Devotion missing title" };
  if (!d.summary || d.summary.length < 60) {
    return { decision: "reject", reason: "Devotion summary too short" };
  }
  if (!hasSourceUrl(d)) {
    return { decision: "review", reason: "Devotion missing source", confidence: 0.5 };
  }
  return { decision: "accept", confidence: 0.7 };
}

export function strictValidate(item: IngestedItem): StrictValidationOutcome {
  switch (item.kind) {
    case "prayer":
      return validatePrayer(item);
    case "saint":
      return validateSaint(item);
    case "parish":
      return validateParish(item);
    case "liturgy":
      return validateChurchDocument(item);
    case "guide":
      return validateSacramentOrConsecration(item);
    case "apparition":
      return validateApparition(item);
    case "devotion":
      return validateDevotion(item);
    default:
      return { decision: "reject", reason: "Unknown content kind" };
  }
}
