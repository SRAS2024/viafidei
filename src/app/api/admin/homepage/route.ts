import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import {
  getHomepageWithBlocks,
  persistHomepageBlocks,
} from "@/lib/data/homepage";
import { getClientIpOrNull, getUserAgent } from "@/lib/security/request";

const blockSchema = z.object({
  id: z.string(),
  blockKey: z.string(),
  blockType: z.string(),
  sortOrder: z.number().int(),
  configJson: z.record(z.unknown()),
});

const payloadSchema = z.object({
  pageId: z.string().min(1),
  blocks: z.array(blockSchema),
});

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const existing = await getHomepageWithBlocks(parsed.data.pageId);
  if (!existing) return NextResponse.json({ error: "notfound" }, { status: 404 });

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

  return NextResponse.json({ ok: true });
}
