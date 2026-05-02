import crypto from "node:crypto";
import type { IngestedItem } from "./types";

function joinTags(tags: string[] | undefined): string {
  if (!tags || tags.length === 0) return "";
  return [...tags].sort().join(",");
}

function canonicalize(item: IngestedItem): string {
  const tags = joinTags(item.tagSlugs);
  switch (item.kind) {
    case "prayer":
      return [
        "prayer",
        item.slug,
        item.defaultTitle,
        item.category,
        item.body,
        tags,
      ].join("|");
    case "saint":
      return [
        "saint",
        item.slug,
        item.canonicalName,
        item.feastDay ?? "",
        (item.patronages ?? []).join(","),
        item.biography,
        item.officialPrayer ?? "",
        tags,
      ].join("|");
    case "apparition":
      return [
        "apparition",
        item.slug,
        item.title,
        item.location ?? "",
        item.country ?? "",
        item.approvedStatus,
        item.summary,
        item.officialPrayer ?? "",
        tags,
      ].join("|");
    case "parish":
      return [
        "parish",
        item.slug,
        item.name,
        item.address ?? "",
        item.city ?? "",
        item.region ?? "",
        item.country ?? "",
        item.phone ?? "",
        item.email ?? "",
        item.websiteUrl ?? "",
        item.diocese ?? "",
        tags,
      ].join("|");
    case "devotion":
      return [
        "devotion",
        item.slug,
        item.title,
        item.summary,
        item.practiceText ?? "",
        String(item.durationMinutes ?? ""),
        tags,
      ].join("|");
  }
}

export function computeChecksum(item: IngestedItem): string {
  return crypto.createHash("sha256").update(canonicalize(item)).digest("hex");
}

export function checksumString(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}
