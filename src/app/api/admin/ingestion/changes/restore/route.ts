import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/db/client";
import { getClientIpOrNull, getUserAgent } from "@/lib/security/request";
import { jsonError, jsonOk, readJsonBody } from "@/lib/http";

const schema = z.object({
  contentVersionId: z.string().min(1).max(120),
});

const ENTITY_RESTORE_HANDLERS: Record<
  string,
  (id: string, title: string | null, body: string | null) => Promise<void>
> = {
  Prayer: async (id, title, body) => {
    if (!title || !body) throw new Error("Cannot restore Prayer without title + body");
    await prisma.prayer.update({
      where: { id },
      data: { defaultTitle: title, body },
    });
  },
  Saint: async (id, title, body) => {
    if (!title || !body) throw new Error("Cannot restore Saint without name + biography");
    await prisma.saint.update({
      where: { id },
      data: { canonicalName: title, biography: body },
    });
  },
  LiturgyEntry: async (id, title, body) => {
    if (!title || !body) throw new Error("Cannot restore LiturgyEntry without title + body");
    await prisma.liturgyEntry.update({
      where: { id },
      data: { title, body },
    });
  },
  SpiritualLifeGuide: async (id, title, body) => {
    if (!title || !body) throw new Error("Cannot restore guide without title + body");
    await prisma.spiritualLifeGuide.update({
      where: { id },
      data: { title, summary: body },
    });
  },
};

/**
 * Restore an entity to the snapshot stored in a ContentVersion row.
 * Only handles Prayer / Saint / LiturgyEntry / SpiritualLifeGuide —
 * the kinds that have a version history snapshot pass in their
 * persister. Other types return a clear error.
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return jsonError("unauthorized");
  const body = await readJsonBody<unknown>(req);
  if (!body.ok) return jsonError("invalid");
  const parsed = schema.safeParse(body.data);
  if (!parsed.success) return jsonError("invalid", { details: parsed.error.flatten() });

  const version = await prisma.contentVersion.findUnique({
    where: { id: parsed.data.contentVersionId },
  });
  if (!version) return jsonError("not_found");

  const handler = ENTITY_RESTORE_HANDLERS[version.entityType];
  if (!handler) {
    return jsonError("invalid", { message: `No restore handler for ${version.entityType}` });
  }
  try {
    await handler(version.entityId, version.previousTitle, version.previousBody);
  } catch (e) {
    return jsonError("invalid", { message: e instanceof Error ? e.message : String(e) });
  }
  await prisma.contentVersion.update({
    where: { id: version.id },
    data: { reviewRequired: false },
  });
  await writeAudit({
    action: "admin.content.version.restore",
    entityType: version.entityType,
    entityId: version.entityId,
    actorUsername: admin.username,
    ipAddress: getClientIpOrNull(req),
    userAgent: getUserAgent(req),
    newValue: { contentVersionId: version.id } as never,
  });
  return jsonOk({ ok: true });
}
