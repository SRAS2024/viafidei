import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { runCatalogJanitor } from "@/lib/data/catalog-janitor";
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
 * Manual content-type revalidation. Runs the catalog janitor (the
 * format+clean+validate pipeline against every PUBLISHED row) so an
 * admin can ask "re-check every saint right now" without waiting for
 * the next scheduled tick.
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return jsonError("unauthorized");
  const body = await readJsonBody<unknown>(req);
  const parsed = schema.safeParse(body.ok ? body.data : {});
  if (!parsed.success) return jsonError("invalid", { details: parsed.error.flatten() });

  const result = await runCatalogJanitor();
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
