import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin, writeAudit } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";

const payloadSchema = z.object({
  pageId: z.string().min(1),
  blocks: z.array(
    z.object({
      id: z.string(),
      blockKey: z.string(),
      blockType: z.string(),
      sortOrder: z.number().int(),
      configJson: z.record(z.unknown()),
    }),
  ),
});

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const existing = await prisma.homePage.findUnique({
    where: { id: parsed.data.pageId },
    include: { blocks: true },
  });
  if (!existing) return NextResponse.json({ error: "notfound" }, { status: 404 });

  await prisma.$transaction([
    ...parsed.data.blocks.map((b) =>
      prisma.homePageBlock.update({
        where: { id: b.id },
        data: {
          configJson: b.configJson as never,
          sortOrder: b.sortOrder,
          blockType: b.blockType,
          blockKey: b.blockKey,
        },
      }),
    ),
    prisma.homePage.update({
      where: { id: parsed.data.pageId },
      data: { version: { increment: 1 }, status: "PUBLISHED" },
    }),
  ]);

  await writeAudit({
    action: "admin.homepage.save",
    entityType: "HomePage",
    entityId: parsed.data.pageId,
    previousValue: existing.blocks.map((b) => ({ id: b.id, configJson: b.configJson })),
    newValue: parsed.data.blocks.map((b) => ({ id: b.id, configJson: b.configJson })),
    actorUsername: admin.username,
    ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: req.headers.get("user-agent"),
  });

  return NextResponse.json({ ok: true });
}
