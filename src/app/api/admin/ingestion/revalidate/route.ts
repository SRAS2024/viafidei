import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { recordDataManagementLogs } from "@/lib/data/data-management-log";
import { runCatalogJanitor } from "@/lib/data/catalog-janitor";
import { enqueueJob, PRIORITY_NORMAL } from "@/lib/ingestion/queue";
import { isDurableQueueEnabled } from "@/lib/config";
import { getClientIpOrNull, getUserAgent } from "@/lib/security/request";
import { jsonError, jsonOk, readJsonBody } from "@/lib/http";

const schema = z.object({
  contentType: z
    .enum([
      "Prayer",
      "Saint",
      "MarianApparition",
      "Devotion",
      "LiturgyEntry",
      "SpiritualLifeGuide",
      "Parish",
      "all",
    ])
    .default("all"),
});

/**
 * Manual content-type revalidation. In queue-first mode this enqueues
 * a `content_revalidate` job for the worker to pick up; in legacy
 * mode it runs the janitor synchronously.
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return jsonError("unauthorized");
  const body = await readJsonBody<unknown>(req);
  const parsed = schema.safeParse(body.ok ? body.data : {});
  if (!parsed.success) return jsonError("invalid", { details: parsed.error.flatten() });

  let result: unknown;
  if (isDurableQueueEnabled()) {
    const queued = await enqueueJob({
      jobName: `revalidate:${parsed.data.contentType}`,
      jobKind: "content_revalidate",
      dedupeKey: `revalidate:${parsed.data.contentType}:${Date.now()}`,
      contentType: parsed.data.contentType === "all" ? null : parsed.data.contentType,
      priority: PRIORITY_NORMAL,
      triggeredBy: "manual",
      actorUsername: admin.username,
      payload: { contentType: parsed.data.contentType },
    });
    await recordDataManagementLogs([
      {
        action: "ADD",
        contentType: "IngestionQueue",
        contentRef: `revalidate:${parsed.data.contentType}`,
        reason: "Manual revalidation enqueued",
        triggeredBy: "manual",
        actorUsername: admin.username,
      },
    ]);
    result = { enqueued: queued.id };
  } else {
    result = await runCatalogJanitor();
  }
  await writeAudit({
    action: "admin.ingestion.revalidate",
    entityType: "ContentType",
    entityId: parsed.data.contentType,
    actorUsername: admin.username,
    ipAddress: getClientIpOrNull(req),
    userAgent: getUserAgent(req),
    newValue: { contentType: parsed.data.contentType, result } as never,
  });
  return jsonOk({ result });
}
