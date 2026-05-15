import type { ContentStatus } from "@prisma/client";
import type { IngestedItem } from "../types";
import {
  recordDataManagementLogs,
  type DataManagementLogInput,
} from "../../data/data-management-log";
import { persistPrayer } from "./persist-prayer";
import { persistSaint } from "./persist-saint";
import { persistApparition } from "./persist-apparition";
import { persistParish } from "./persist-parish";
import { persistDevotion } from "./persist-devotion";
import { persistLiturgy } from "./persist-liturgy";
import { persistGuide } from "./persist-guide";
import { applyTagsToEntity } from "./persist-tags";
import { dedupeBatch } from "./dedup";

export type { PersistOutcome, PersistOutcomeDetailed } from "./persist-prayer";
export {
  dedupeBatch,
  normalizeExternalKey,
  normalizeWebsiteIdentity,
  normalizeParishIdentity,
} from "./dedup";

export type PersistResult = {
  created: number;
  updated: number;
  skipped: number;
  /**
   * One DataManagementLog input per persisted row (created, updated, or
   * skipped). The runner appends to this list and writes the whole
   * batch at the end so each ingestion run produces a per-row audit
   * trail of every action taken.
   */
  logs: DataManagementLogInput[];
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

export type PersistOptions = {
  triggeredBy?: "automatic" | "manual";
  actorUsername?: string | null;
  /** Source name (e.g. "Vatican") so log rows can be filtered per source. */
  sourceName?: string;
  /** Job name (e.g. "vatican.encyclicals") so log rows reference the run. */
  jobName?: string;
  /** Skip the data-management write entirely (used by integration tests). */
  skipDataManagementLog?: boolean;
};

export async function persistItems(
  items: IngestedItem[],
  initialStatus: ContentStatus,
  options: PersistOptions = {},
): Promise<PersistResult> {
  const counts: PersistResult = { created: 0, updated: 0, skipped: 0, logs: [] };
  const deduped = dedupeBatch(items);
  const droppedAsDuplicate = items.length - deduped.length;
  counts.skipped += droppedAsDuplicate;
  for (let i = 0; i < droppedAsDuplicate; i++) {
    counts.logs.push({
      action: "DEDUPE",
      contentType: "Unknown",
      contentRef: null,
      reason: "Dropped by dedupeBatch (duplicate slug/externalSourceKey/identity within run)",
      triggeredBy: options.triggeredBy ?? "automatic",
      actorUsername: options.actorUsername ?? null,
    });
  }
  for (const item of deduped) {
    const detail = await dispatch(item, initialStatus);
    counts[detail.outcome] += 1;
    if (detail.outcome !== "skipped" && item.tagSlugs && item.tagSlugs.length > 0) {
      await applyTagsToEntity(ENTITY_TYPE_BY_KIND[item.kind], item.slug, item.tagSlugs);
    }
    const contentType = ENTITY_TYPE_BY_KIND[item.kind];
    if (detail.outcome === "created") {
      counts.logs.push({
        action: "ADD",
        contentType,
        contentRef: detail.contentRef,
        reason:
          options.sourceName && options.jobName
            ? `Ingested from ${options.sourceName} (${options.jobName})`
            : "Ingested from external source",
        triggeredBy: options.triggeredBy ?? "automatic",
        actorUsername: options.actorUsername ?? null,
      });
    } else if (detail.outcome === "updated") {
      counts.logs.push({
        action: "UPDATE",
        contentType,
        contentRef: detail.contentRef,
        reason:
          options.sourceName && options.jobName
            ? `Updated from ${options.sourceName} (${options.jobName})`
            : "Updated from external source",
        triggeredBy: options.triggeredBy ?? "automatic",
        actorUsername: options.actorUsername ?? null,
      });
    } else if (detail.outcome === "skipped") {
      counts.logs.push({
        action: "DEDUPE",
        contentType,
        contentRef: detail.contentRef,
        reason: detail.reason ?? "Skipped — row already in catalog",
        triggeredBy: options.triggeredBy ?? "automatic",
        actorUsername: options.actorUsername ?? null,
      });
    }
  }
  if (!options.skipDataManagementLog && counts.logs.length > 0) {
    await recordDataManagementLogs(counts.logs);
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
