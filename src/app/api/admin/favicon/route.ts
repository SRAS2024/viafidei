import { type NextRequest } from "next/server";
import { writeAudit } from "@/lib/audit";
import { getFaviconSetting, upsertFaviconSetting } from "@/lib/data/site-settings";
import { getClientIpOrNull, getUserAgent, redirectTo } from "@/lib/security/request";
import { gateAdminApiCall } from "@/lib/security/admin-gate";

export async function POST(req: NextRequest) {
  const gate = await gateAdminApiCall(req);
  if (!gate.ok) {
    // For favicon, redirect to admin login on failure (consistent with
    // the previous behavior — favicon is a form-post route).
    return redirectTo(req, "/admin/login");
  }
  const { admin } = gate;

  const form = await req.formData();
  const url = String(form.get("url") ?? "").trim();
  const altText = String(form.get("altText") ?? "").trim();
  if (!url) {
    return redirectTo(req, "/admin/favicon");
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

  return redirectTo(req, "/admin/favicon?saved=1");
}
