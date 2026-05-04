import type { ContentStatus } from "@prisma/client";
import type { IngestedItem } from "../types";
import { persistPrayer } from "./persist-prayer";
import { persistSaint } from "./persist-saint";
import { persistApparition } from "./persist-apparition";
import { persistParish } from "./persist-parish";
import { persistDevotion } from "./persist-devotion";
import { persistLiturgy } from "./persist-liturgy";
import { persistGuide } from "./persist-guide";
import { applyTagsToEntity } from "./persist-tags";
import { dedupeBatch } from "./dedup";

export type { PersistOutcome } from "./persist-prayer";
export { dedupeBatch, normalizeExternalKey } from "./dedup";

export type PersistResult = {
  created: number;
  updated: number;
  skipped: number;
};

const ENTITY_TYPE_BY_KIND = {
  prayer: "Prayer",
  saint: "Saint",
  apparition: "MarianApparition",
  parish: "Parish",
  devotion: "Devotion",
  liturgy: "LiturgyEntry",
  guide: "SpiritualLifeGuide",
} as const;

export async function persistItems(
  items: IngestedItem[],
  initialStatus: ContentStatus,
): Promise<PersistResult> {
  const counts = { created: 0, updated: 0, skipped: 0 };
  const deduped = dedupeBatch(items);
  counts.skipped += items.length - deduped.length;
  for (const item of deduped) {
    const outcome = await dispatch(item, initialStatus);
    counts[outcome] += 1;
    if (outcome !== "skipped" && item.tagSlugs && item.tagSlugs.length > 0) {
      await applyTagsToEntity(ENTITY_TYPE_BY_KIND[item.kind], item.slug, item.tagSlugs);
    }
  }
  return counts;
}

function dispatch(item: IngestedItem, status: ContentStatus) {
  switch (item.kind) {
    case "prayer":
      return persistPrayer(item, status);
    case "saint":
      return persistSaint(item, status);
    case "apparition":
      return persistApparition(item, status);
    case "parish":
      return persistParish(item, status);
    case "devotion":
      return persistDevotion(item, status);
    case "liturgy":
      return persistLiturgy(item, status);
    case "guide":
      return persistGuide(item, status);
  }
}
