import type { IngestedItem } from "./types";
import { normalizeSlug } from "./slug";

const ORIGIN_URL_RE = /^(https?:\/\/|mailto:)/i;

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

export function validateItem(item: IngestedItem): string | null {
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
