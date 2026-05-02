import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { getHomepageWithBlocks, persistHomepageBlocks } from "@/lib/data/homepage";
import { getClientIpOrNull, getUserAgent } from "@/lib/security/request";
import { DEFAULT_JSON_BODY_LIMIT_BYTES, jsonError, jsonOk, readJsonBody } from "@/lib/http";

const blockSchema = z.object({
  id: z.string(),
  blockKey: z.string(),
  blockType: z.string(),
  sortOrder: z.number().int(),
  configJson: z.record(z.unknown()),
});

const payloadSchema = z.object({
  pageId: z.string().min(1),
  blocks: z.array(blockSchema).max(200),
});

const HOMEPAGE_BODY_LIMIT_BYTES = DEFAULT_JSON_BODY_LIMIT_BYTES * 4;

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return jsonError("unauthorized");

  const body = await readJsonBody(req, { limitBytes: HOMEPAGE_BODY_LIMIT_BYTES });
  if (!body.ok) {
    return jsonError(body.reason === "too_large" ? "too_large" : "invalid");
  }
  const parsed = payloadSchema.safeParse(body.data);
  if (!parsed.success) {
    return jsonError("invalid", { details: parsed.error.flatten() });
  }

  const existing = await getHomepageWithBlocks(parsed.data.pageId);
  if (!existing) return jsonError("not_found");

  await persistHomepageBlocks(parsed.data.pageId, parsed.data.blocks);

  await writeAudit({
    action: "admin.homepage.save",
    entityType: "HomePage",
    entityId: parsed.data.pageId,
    previousValue: existing.blocks.map((b) => ({ id: b.id, configJson: b.configJson })),
    newValue: parsed.data.blocks.map((b) => ({ id: b.id, configJson: b.configJson })),
    actorUsername: admin.username,
    ipAddress: getClientIpOrNull(req),
    userAgent: getUserAgent(req),
  });

  return jsonOk();
}
