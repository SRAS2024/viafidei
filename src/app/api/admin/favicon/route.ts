import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import {
  getFaviconSetting,
  upsertFaviconSetting,
} from "@/lib/data/site-settings";
import { getClientIpOrNull, getUserAgent } from "@/lib/security/request";

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

  const previous = (await getFaviconSetting()).value;
  const updated = await upsertFaviconSetting({ url, altText });

  await writeAudit({
    action: "admin.favicon.update",
    entityType: "SiteSetting",
    entityId: updated.id,
    previousValue: previous,
    newValue: updated.valueJson,
    actorUsername: admin.username,
    ipAddress: getClientIpOrNull(req),
    userAgent: getUserAgent(req),
  });

  return NextResponse.redirect(new URL("/admin/favicon?saved=1", req.url), 303);
}
