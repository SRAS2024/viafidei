import { type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { ADMIN_ACTION, writeAdminActionLog } from "@/lib/audit/admin-action-log";
import { getClientIpOrNull, getUserAgent, redirectTo } from "@/lib/security/request";
import { DEVICE_CREDENTIAL_COOKIE } from "@/middleware";

// iron-session + Prisma audit write need Node runtime.
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (session.role === "ADMIN") {
    const username = session.userEmail ?? "admin";
    await writeAudit({
      action: "admin.logout",
      entityType: "Session",
      entityId: "admin",
      actorUsername: username,
      ipAddress: getClientIpOrNull(req),
      userAgent: getUserAgent(req),
    });
    // A valid admin signing out is benign authenticated activity —
    // record it for the Developer Audit report's Admin Navigation and
    // Actions section, never as a suspicious-activity signal.
    await writeAdminActionLog({
      adminUsername: username,
      actionType: ADMIN_ACTION.logout,
      route: "/api/admin/logout",
      method: "POST",
      result: "success",
      deviceCredential: req.cookies.get(DEVICE_CREDENTIAL_COOKIE)?.value ?? null,
      ipAddress: getClientIpOrNull(req),
      userAgent: getUserAgent(req),
    });
  }
  session.destroy();
  return redirectTo(req, "/admin/login");
}
