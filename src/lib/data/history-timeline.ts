/**
 * Cached loader for the /history timeline (audit HIST-09/HIST-10).
 *
 * The timeline is the static event spine merged with the published
 * CHURCH_DOCUMENT rows, plus the slug sets that tell the merge which related
 * pages (popes, saints, doctors, apparitions) actually exist so it never
 * renders a dead chip. Historical facts do not change and documents publish
 * rarely, so the built timeline is cached for an hour under the same
 * `content-type:*` tags the worker revalidates after a publish
 * (`revalidateContentType(input.contentType)` in post-publish-probe) — a new
 * document appears on the next request, not an hour later.
 *
 * Only a body-free projection is cached and shipped: the worker's document
 * excerpts (≤1,200 chars each) stay on the document page. The cache wrapper
 * (`withCacheTags`) degrades to a direct read wherever Next's incremental
 * cache is unavailable (tests, scripts).
 */

import type { ChecklistContentType } from "@prisma/client";

import { withCacheTags } from "@/lib/cache/cached-data";
import { contentTypeTag, tabTag } from "@/lib/cache/tags";
import { prisma } from "@/lib/db/client";
import {
  buildTimeline,
  timelineDocumentFromPayload,
  type HistoryTimeline,
  type RelatedLinkType,
  type TimelineDocument,
} from "@/lib/content-shared/church-history/timeline";

export const HISTORY_TIMELINE_REVALIDATE_SECONDS = 3600;

const RELATED_TYPES: Record<RelatedLinkType, ChecklistContentType> = {
  popes: "POPE",
  saints: "SAINT",
  doctors: "DOCTOR",
  apparitions: "APPARITION",
};

/** Everything the merge needs, already stripped of bodies (serialisable for the cache). */
export interface HistoryTimelineInputs {
  documents: TimelineDocument[];
  publishedSlugs: Record<RelatedLinkType, string[]>;
}

export async function readHistoryTimelineInputs(): Promise<HistoryTimelineInputs> {
  const rows = await prisma.publishedContent.findMany({
    where: { contentType: "CHURCH_DOCUMENT", isPublished: true },
    select: { slug: true, title: true, payload: true },
    orderBy: { slug: "asc" },
  });
  const documents = rows.map((row) =>
    timelineDocumentFromPayload(
      row.slug,
      row.title,
      (row.payload ?? {}) as Record<string, unknown>,
    ),
  );
  const publishedSlugs = { popes: [], saints: [], doctors: [], apparitions: [] } as Record<
    RelatedLinkType,
    string[]
  >;
  for (const [key, contentType] of Object.entries(RELATED_TYPES) as Array<
    [RelatedLinkType, ChecklistContentType]
  >) {
    const slugRows = await prisma.publishedContent.findMany({
      where: { contentType, isPublished: true },
      select: { slug: true },
    });
    publishedSlugs[key] = slugRows.map((r) => r.slug);
  }
  return { documents, publishedSlugs };
}

export function timelineFromInputs(
  inputs: HistoryTimelineInputs,
  currentYear?: number,
): HistoryTimeline {
  return buildTimeline(inputs.documents, {
    currentYear,
    publishedSlugs: {
      popes: new Set(inputs.publishedSlugs.popes),
      saints: new Set(inputs.publishedSlugs.saints),
      doctors: new Set(inputs.publishedSlugs.doctors),
      apparitions: new Set(inputs.publishedSlugs.apparitions),
    },
  });
}

export const HISTORY_TIMELINE_CACHE_TAGS: string[] = [
  contentTypeTag("CHURCH_DOCUMENT"),
  ...Object.values(RELATED_TYPES).map((t) => contentTypeTag(t)),
  tabTag("history"),
];

/** The merged, cached timeline for the /history page. */
export async function loadHistoryTimeline(): Promise<HistoryTimeline> {
  const read = await withCacheTags({
    keyParts: ["history-timeline-inputs", "v1"],
    tags: HISTORY_TIMELINE_CACHE_TAGS,
    revalidateSeconds: HISTORY_TIMELINE_REVALIDATE_SECONDS,
    fn: readHistoryTimelineInputs,
  });
  // Rebuilding from the cached inputs is a few hundred object spreads; the
  // Sets the merge wants are not JSON-serialisable, so they are built here.
  return timelineFromInputs(await read());
}
