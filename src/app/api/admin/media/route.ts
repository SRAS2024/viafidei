import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { rateLimit, RATE_POLICIES } from "@/lib/security/rate-limit";
import { getClientIpOrNull, getUserAgent } from "@/lib/security/request";
import { jsonError, jsonOk, readJsonBody } from "@/lib/http";
import { createMediaAsset, listRecentMedia } from "@/lib/data/media";
import type { MediaKind } from "@prisma/client";

const KINDS: MediaKind[] = [
  "PHOTO",
  "ICON",
  "PAINTING",
  "ILLUSTRATION",
  "STATUE",
  "BOOK_COVER",
  "FAVICON",
  "OTHER",
];

const createSchema = z.object({
  url: z.string().url().max(2000),
  altText: z.string().max(500).nullish(),
  kind: z.enum(KINDS as [MediaKind, ...MediaKind[]]).optional(),
  sourceUrl: z.string().url().max(2000).nullish(),
  sourceHost: z.string().max(255).nullish(),
  licenseInfo: z.string().max(500).nullish(),
  attribution: z.string().max(500).nullish(),
  checksum: z.string().max(128).nullish(),
});

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return jsonError("unauthorized");
  const url = new URL(req.url);
  const take = Math.min(Number(url.searchParams.get("take")) || 60, 200);
  const items = await listRecentMedia(take);
  return jsonOk({ items });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return jsonError("unauthorized");

  const limit = await rateLimit(`admin-media:${admin.username}`, RATE_POLICIES.mediaUpload);
  if (!limit.ok) return jsonError("rate_limited");

  const body = await readJsonBody(req);
  if (!body.ok) return jsonError(body.reason === "too_large" ? "too_large" : "invalid");
  const parsed = createSchema.safeParse(body.data);
  if (!parsed.success) return jsonError("invalid", { details: parsed.error.flatten() });

  const result = await createMediaAsset(parsed.data);
  await writeAudit({
    action: result.created ? "admin.media.create" : "admin.media.dedupe",
    entityType: "MediaAsset",
    entityId: result.asset.id,
    actorUsername: admin.username,
    ipAddress: getClientIpOrNull(req),
    userAgent: getUserAgent(req),
    newValue: result.asset as never,
  });
  return jsonOk({ asset: result.asset, created: result.created });
}
