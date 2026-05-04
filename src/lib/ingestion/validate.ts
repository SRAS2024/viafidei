import type { IngestedItem } from "./types";
import { normalizeSlug } from "./slug";
import { isApprovedUrl } from "./sources/vatican-allowlist";

const ORIGIN_URL_RE = /^(https?:\/\/|mailto:)/i;

/**
 * Tables that are protected from any ingestion write. These are user-generated
 * tables (journals, goals, milestones, saved items, profile data). The
 * ingestion runner must never persist into these tables; the assertion guards
 * against accidental misuse if a new adapter is added that broadens the
 * `kind` union without also extending the persistence layer.
 */
const PROTECTED_USER_KINDS: ReadonlySet<string> = new Set([
  "journal",
  "journalEntry",
  "goal",
  "milestone",
  "userSavedPrayer",
  "userSavedSaint",
  "userSavedApparition",
  "userSavedParish",
  "userSavedDevotion",
  "profile",
  "user",
]);

function nonEmpty(value: string | undefined | null): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function validatePrayer(item: IngestedItem & { kind: "prayer" }): string | null {
  if (!nonEmpty(item.slug)) return "Prayer slug is required";
  if (!nonEmpty(item.defaultTitle)) return "Prayer defaultTitle is required";
  if (!nonEmpty(item.category)) return "Prayer category is required";
  if (!nonEmpty(item.body)) return "Prayer body is required";
  if (item.body.length < 10) return "Prayer body looks too short";
  return null;
}

function validateSaint(item: IngestedItem & { kind: "saint" }): string | null {
  if (!nonEmpty(item.slug)) return "Saint slug is required";
  if (!nonEmpty(item.canonicalName)) return "Saint canonicalName is required";
  if (!nonEmpty(item.biography)) return "Saint biography is required";
  if (item.biography.length < 20) return "Saint biography looks too short";
  return null;
}

function validateApparition(item: IngestedItem & { kind: "apparition" }): string | null {
  if (!nonEmpty(item.slug)) return "Apparition slug is required";
  if (!nonEmpty(item.title)) return "Apparition title is required";
  if (!nonEmpty(item.summary)) return "Apparition summary is required";
  if (!nonEmpty(item.approvedStatus)) return "Apparition approvedStatus is required";
  return null;
}

function validateParish(item: IngestedItem & { kind: "parish" }): string | null {
  if (!nonEmpty(item.slug)) return "Parish slug is required";
  if (!nonEmpty(item.name)) return "Parish name is required";
  if (item.websiteUrl && !ORIGIN_URL_RE.test(item.websiteUrl)) {
    return "Parish websiteUrl must start with http(s):// or mailto:";
  }
  return null;
}

function validateDevotion(item: IngestedItem & { kind: "devotion" }): string | null {
  if (!nonEmpty(item.slug)) return "Devotion slug is required";
  if (!nonEmpty(item.title)) return "Devotion title is required";
  if (!nonEmpty(item.summary)) return "Devotion summary is required";
  if (item.summary.length < 20) return "Devotion summary looks too short";
  if (item.durationMinutes !== undefined && item.durationMinutes <= 0) {
    return "Devotion durationMinutes must be positive";
  }
  return null;
}

const LITURGY_KINDS = new Set([
  "MASS_STRUCTURE",
  "LITURGICAL_YEAR",
  "SYMBOLISM",
  "MARRIAGE_RITE",
  "FUNERAL_RITE",
  "ORDINATION_RITE",
  "COUNCIL_TIMELINE",
  "GLOSSARY",
  "GENERAL",
]);

function validateLiturgy(item: IngestedItem & { kind: "liturgy" }): string | null {
  if (!nonEmpty(item.slug)) return "Liturgy slug is required";
  if (!nonEmpty(item.title)) return "Liturgy title is required";
  if (!nonEmpty(item.body)) return "Liturgy body is required";
  if (item.body.length < 30) return "Liturgy body looks too short";
  if (!LITURGY_KINDS.has(item.liturgyKind)) {
    return `Liturgy kind '${item.liturgyKind}' is not a recognised LiturgyKind`;
  }
  return null;
}

const GUIDE_KINDS = new Set([
  "ROSARY",
  "CONFESSION",
  "ADORATION",
  "DEVOTION",
  "CONSECRATION",
  "VOCATION",
  "GENERAL",
]);

function validateGuide(item: IngestedItem & { kind: "guide" }): string | null {
  if (!nonEmpty(item.slug)) return "Guide slug is required";
  if (!nonEmpty(item.title)) return "Guide title is required";
  if (!nonEmpty(item.summary)) return "Guide summary is required";
  if (item.summary.length < 20) return "Guide summary looks too short";
  if (!GUIDE_KINDS.has(item.guideKind)) {
    return `Guide kind '${item.guideKind}' is not a recognised SpiritualLifeKind`;
  }
  if (item.steps && item.steps.length > 0) {
    for (const s of item.steps) {
      if (!nonEmpty(s.title)) return "Guide step title is required";
      if (!nonEmpty(s.body)) return "Guide step body is required";
    }
  }
  if (item.durationDays !== undefined && item.durationDays <= 0) {
    return "Guide durationDays must be positive";
  }
  return null;
}

function validateExternalSourceKey(item: IngestedItem): string | null {
  const key = item.externalSourceKey;
  if (!key) return null;
  // External keys are URLs in the autofill pipeline; if so, the host MUST be
  // Vatican-approved. Non-URL keys (e.g. legacy seed identifiers) are passed
  // through.
  if (/^https?:\/\//i.test(key) && !isApprovedUrl(key)) {
    return `externalSourceKey '${key}' is not from a Vatican-approved host`;
  }
  return null;
}

export function validateItem(item: IngestedItem): string | null {
  // Guard rail: ingestion must never touch user-generated content tables.
  // If a future adapter is mistakenly tagged with a user-facing kind, this
  // check rejects the item before it can reach persistence.
  if (PROTECTED_USER_KINDS.has((item as { kind: string }).kind)) {
    return `kind '${(item as { kind: string }).kind}' is protected user-generated content and must not be ingested`;
  }
  const sourceError = validateExternalSourceKey(item);
  if (sourceError) return sourceError;
  switch (item.kind) {
    case "prayer":
      return validatePrayer(item);
    case "saint":
      return validateSaint(item);
    case "apparition":
      return validateApparition(item);
    case "parish":
      return validateParish(item);
    case "devotion":
      return validateDevotion(item);
    case "liturgy":
      return validateLiturgy(item);
    case "guide":
      return validateGuide(item);
  }
}

/** Returns a copy of items with normalized slugs and any invalid items removed. */
export function sanitize(items: IngestedItem[]): {
  valid: IngestedItem[];
  rejected: Array<{ item: IngestedItem; reason: string }>;
} {
  const valid: IngestedItem[] = [];
  const rejected: Array<{ item: IngestedItem; reason: string }> = [];
  for (const item of items) {
    const normalized = { ...item, slug: normalizeSlug(item.slug) };
    const reason = validateItem(normalized);
    if (reason) {
      rejected.push({ item, reason });
      continue;
    }
    valid.push(normalized);
  }
  return { valid, rejected };
}
