/**
 * Typed job kinds for the durable ingestion queue. Each kind has a
 * stable identifier (stored in `IngestionJobQueue.jobKind`), a
 * canonical priority band, and a Zod-validated payload shape.
 *
 * The worker uses `jobKind` to route execution, so adapter-name-based
 * dispatch is no longer needed at the queue layer.
 *
 * Stage model: a single combined `content_build` job runs the entire
 * factory pipeline (build → normalize → enrich → cross-source
 * validation → strict QA → persist) in one worker tick. The legacy
 * split stages `content_validate` and `content_persist` only called
 * the same combined factory function, so they have been removed
 * from the active set and live in `REMOVED_JOB_KINDS`.
 *
 * Cross-source validation evidence is collected inside the same
 * `content_build` tick (per spec section 17 — "fold evidence
 * validation into content_build"). There is no separate
 * `content_validate_evidence` job kind because every package built
 * by a non-primary source must already gather evidence before
 * strict QA in the same tick — splitting it would re-introduce the
 * race conditions the unified stage was created to eliminate.
 *
 * `source_ingest` was the legacy single-step adapter executor and is
 * also removed. Active code only enqueues factory-stage kinds
 * (`source_discovery` → `source_fetch` → `content_build`). The
 * runtime translation shim that previously rewrote in-flight legacy
 * rows has been deleted; the queue migration script and the startup
 * safety check are the only paths that touch legacy rows now.
 */

import { z } from "zod";

export const JOB_KINDS = [
  // Source-side kinds.
  "source_discovery",
  "source_fetch",
  "source_freshness",
  "source_config_repair",
  // Factory-stage kind. One combined job runs build + normalize +
  // enrich + strict QA + persist in a single worker tick.
  "content_build",
  // Catalog-wide kinds.
  "content_revalidate",
  "strict_cleanup",
  "archive_cleanup",
  "dedupe_cleanup",
  "sitemap_refresh",
  "report_generate",
] as const;

export type JobKind = (typeof JOB_KINDS)[number];

/**
 * Per-kind default priority. Lower number = higher priority.
 * Freshness checks are very cheap so we let them run early; ingest
 * jobs default to normal; report generation is lowest.
 */
export const PRIORITY_DEFAULTS: Record<JobKind, number> = {
  source_freshness: 50,
  source_fetch: 100,
  source_discovery: 110,
  content_build: 120,
  content_revalidate: 150,
  source_config_repair: 200,
  strict_cleanup: 250,
  dedupe_cleanup: 300,
  archive_cleanup: 400,
  sitemap_refresh: 450,
  report_generate: 500,
};

/**
 * Removed job kinds. Surfacing this list lets the startup safety
 * check and queue-migration scripts identify legacy rows still
 * sitting in the queue so the operator can drain or delete them.
 *
 * The runtime translation shim that previously rewrote in-flight
 * legacy rows has been deleted (the queue has been drained). Legacy
 * rows now fail validation at execution time and surface as a loud
 * diagnostic.
 */
export const REMOVED_JOB_KINDS = ["source_ingest", "content_validate", "content_persist"] as const;
export type RemovedJobKind = (typeof REMOVED_JOB_KINDS)[number];
export function isRemovedJobKind(value: string): value is RemovedJobKind {
  return (REMOVED_JOB_KINDS as readonly string[]).includes(value);
}

// ─── Payload schemas ────────────────────────────────────────────────

const baseSourcePayload = z.object({
  sourceId: z.string().min(1),
  adapterKey: z.string().min(1),
  cursorKey: z.string().min(1).optional(),
  contentType: z.string().min(1).optional(),
});

export const sourceFreshnessPayloadSchema = baseSourcePayload.extend({
  expectedEtag: z.string().optional(),
  expectedLastModified: z.string().optional(),
});

export const sourceDiscoveryPayloadSchema = baseSourcePayload.extend({
  startUrl: z.string().url().optional(),
  maxPages: z.number().int().positive().optional(),
  mode: z.enum(["constant", "maintenance"]).default("constant"),
});

export const contentRevalidatePayloadSchema = z
  .object({
    /** Optional content type filter — when omitted, every type is swept. */
    contentType: z
      .enum([
        "Prayer",
        "Saint",
        "MarianApparition",
        "Devotion",
        "Novena",
        "Sacrament",
        "Rosary",
        "Consecration",
        "SpiritualGuidance",
        "LiturgyEntry",
        "SpiritualLifeGuide",
        "Liturgy",
        "History",
        "Parish",
        "all",
      ])
      .optional(),
    /**
     * Sweep label written to RejectedContentLog.sweepReason — answers
     * "what triggered this delete?" on the dashboard.
     */
    sweepReason: z
      .enum([
        "scheduled",
        "post_ingestion",
        "manual",
        "render_gate",
        "package_version_change",
        "rejection_spike",
        "growth_stall",
        "catalog_revalidate",
      ])
      .optional(),
    triggeredBy: z.enum(["automatic", "manual"]).optional(),
    sourceId: z.string().nullable().optional(),
    workerJobId: z.string().nullable().optional(),
    slug: z.string().optional(),
    previousVersion: z.string().nullable().optional(),
    newVersion: z.string().optional(),
    windowMinutes: z.number().optional(),
    spikeFactor: z.number().optional(),
  })
  .passthrough();

export const archiveCleanupPayloadSchema = z
  .object({
    retentionDays: z.number().int().positive().optional(),
  })
  .strict();

export const dedupeCleanupPayloadSchema = z.object({
  contentType: z.string().optional(),
});

export const sitemapRefreshPayloadSchema = z.object({}).strict();

export const reportGeneratePayloadSchema = z.object({
  reportKind: z.enum(["biweekly", "monthly_archive", "monthly_source_quality", "monthly_error"]),
});

// Factory-stage payload schemas. content_build is the single combined
// stage that runs build + normalize + enrich + strict QA + persist
// inside one worker tick. The previous split stages
// (content_validate, content_persist) called the same factory entry
// point and are removed.
export const sourceFetchPayloadSchema = z.object({
  sourceUrl: z.string().url(),
  sourceId: z.string().min(1).optional(),
  adapterKey: z.string().min(1).optional(),
  discoveredItemId: z.string().min(1).optional(),
  contentType: z.string().min(1).optional(),
});

export const contentBuildPayloadSchema = z.object({
  sourceDocumentId: z.string().min(1).optional(),
  sourceUrl: z.string().url().optional(),
  contentType: z
    .enum([
      "Prayer",
      "Saint",
      "MarianApparition",
      "Parish",
      "Devotion",
      "Novena",
      "Sacrament",
      "Rosary",
      "Consecration",
      "SpiritualGuidance",
      "Liturgy",
      "History",
    ])
    .optional(),
  sourceId: z.string().min(1).optional(),
});

export const sourceConfigRepairPayloadSchema = z
  .object({
    sourceId: z.string().min(1).optional(),
  })
  .strict();

export const strictCleanupPayloadSchema = z
  .object({
    contentType: z.string().optional(),
    sweepReason: z.string().optional(),
  })
  .passthrough();

export const JOB_PAYLOAD_SCHEMAS: Record<JobKind, z.ZodTypeAny> = {
  source_freshness: sourceFreshnessPayloadSchema,
  source_discovery: sourceDiscoveryPayloadSchema,
  source_fetch: sourceFetchPayloadSchema,
  source_config_repair: sourceConfigRepairPayloadSchema,
  content_build: contentBuildPayloadSchema,
  content_revalidate: contentRevalidatePayloadSchema,
  strict_cleanup: strictCleanupPayloadSchema,
  archive_cleanup: archiveCleanupPayloadSchema,
  dedupe_cleanup: dedupeCleanupPayloadSchema,
  sitemap_refresh: sitemapRefreshPayloadSchema,
  report_generate: reportGeneratePayloadSchema,
};

export type SourceFreshnessPayload = z.infer<typeof sourceFreshnessPayloadSchema>;
export type SourceDiscoveryPayload = z.infer<typeof sourceDiscoveryPayloadSchema>;
export type ContentRevalidatePayload = z.infer<typeof contentRevalidatePayloadSchema>;
export type ArchiveCleanupPayload = z.infer<typeof archiveCleanupPayloadSchema>;

/**
 * Validate a payload against the schema for its declared job kind.
 * Returns the parsed payload on success or an error string. Used at
 * enqueue time AND at execution time so a corrupt row never crashes
 * the worker.
 */
export function validatePayload(
  jobKind: string,
  payload: unknown,
): { ok: true; data: unknown } | { ok: false; error: string } {
  if (isRemovedJobKind(jobKind)) {
    return {
      ok: false,
      error: `Removed job kind '${jobKind}' — use the explicit factory stages instead (source_discovery → source_fetch → content_build). content_validate / content_persist are folded into the single content_build stage.`,
    };
  }
  if (!isJobKind(jobKind)) {
    return { ok: false, error: `Unknown job kind: ${jobKind}` };
  }
  const schema = JOB_PAYLOAD_SCHEMAS[jobKind];
  const result = schema.safeParse(payload ?? {});
  if (!result.success) {
    return { ok: false, error: result.error.message };
  }
  return { ok: true, data: result.data };
}

export function isJobKind(value: string): value is JobKind {
  return (JOB_KINDS as readonly string[]).includes(value);
}

/**
 * Sanitize a payload before storing or showing in the admin UI.
 * Strips known sensitive keys (tokens, secrets, cookies, auth
 * headers, api keys) so a payload accidentally containing credentials
 * never appears on a dashboard.
 */
const SENSITIVE_KEY_RE =
  /^(token|secret|cookie|authorization|auth|apiKey|api_key|password|x-api-key|bearer|set-cookie|session)$/i;

export function sanitizePayload(payload: unknown): unknown {
  if (payload == null) return payload;
  if (Array.isArray(payload)) return payload.map(sanitizePayload);
  if (typeof payload !== "object") return payload;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    if (SENSITIVE_KEY_RE.test(key)) {
      out[key] = "[REDACTED]";
      continue;
    }
    out[key] = sanitizePayload(value);
  }
  return out;
}
