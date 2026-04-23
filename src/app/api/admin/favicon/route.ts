import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin, writeAudit } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.redirect(new URL("/admin/login", req.url), 303);
  }

  const form = await req.formData();
  const url = String(form.get("url") ?? "").trim();
  const altText = String(form.get("altText") ?? "").trim();
  if (!url) {
    return NextResponse.redirect(new URL("/admin/favicon", req.url), 303);
  }

  const existing = await prisma.siteSetting.findUnique({ where: { key: "favicon" } });
  const previous = existing?.valueJson ?? null;

  const updated = await prisma.siteSetting.upsert({
    where: { key: "favicon" },
    create: { key: "favicon", valueJson: { url, altText } },
    update: { valueJson: { url, altText } },
  });

  await writeAudit({
    action: "admin.favicon.update",
    entityType: "SiteSetting",
    entityId: updated.id,
    previousValue: previous,
    newValue: updated.valueJson,
    actorUsername: admin.username,
    ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: req.headers.get("user-agent"),
  });

  return NextResponse.redirect(new URL("/admin/favicon?saved=1", req.url), 303);
}
