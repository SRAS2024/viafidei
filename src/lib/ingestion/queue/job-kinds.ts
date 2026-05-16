/**
 * Typed job kinds for the durable ingestion queue. Each kind has a
 * stable identifier (stored in `IngestionJobQueue.jobKind`), a
 * canonical priority band, and a Zod-validated payload shape.
 *
 * The worker uses `jobKind` to route execution, so adapter-name-based
 * dispatch is no longer needed at the queue layer.
 */

import { z } from "zod";

export const JOB_KINDS = [
  "source_ingest",
  "source_freshness",
  "source_discovery",
  "content_revalidate",
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
  source_ingest: 100,
  source_discovery: 110,
  content_revalidate: 150,
  dedupe_cleanup: 300,
  archive_cleanup: 400,
  sitemap_refresh: 450,
  report_generate: 500,
};

// ─── Payload schemas ────────────────────────────────────────────────

const baseSourcePayload = z.object({
  sourceId: z.string().min(1),
  adapterKey: z.string().min(1),
  cursorKey: z.string().min(1).optional(),
  contentType: z.string().min(1).optional(),
});

export const sourceIngestPayloadSchema = baseSourcePayload.extend({
  mode: z.enum(["constant", "maintenance"]).default("constant"),
  batchSizeLimit: z.number().int().positive().optional(),
});

export const sourceFreshnessPayloadSchema = baseSourcePayload.extend({
  expectedEtag: z.string().optional(),
  expectedLastModified: z.string().optional(),
});

export const sourceDiscoveryPayloadSchema = baseSourcePayload.extend({
  startUrl: z.string().url().optional(),
  maxPages: z.number().int().positive().optional(),
});

export const contentRevalidatePayloadSchema = z.object({
  contentType: z.enum([
    "Prayer",
    "Saint",
    "MarianApparition",
    "Devotion",
    "LiturgyEntry",
    "SpiritualLifeGuide",
    "Parish",
    "all",
  ]),
});

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

export const JOB_PAYLOAD_SCHEMAS: Record<JobKind, z.ZodTypeAny> = {
  source_ingest: sourceIngestPayloadSchema,
  source_freshness: sourceFreshnessPayloadSchema,
  source_discovery: sourceDiscoveryPayloadSchema,
  content_revalidate: contentRevalidatePayloadSchema,
  archive_cleanup: archiveCleanupPayloadSchema,
  dedupe_cleanup: dedupeCleanupPayloadSchema,
  sitemap_refresh: sitemapRefreshPayloadSchema,
  report_generate: reportGeneratePayloadSchema,
};

export type SourceIngestPayload = z.infer<typeof sourceIngestPayloadSchema>;
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
