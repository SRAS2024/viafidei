import { type NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/http";
import { gateAdminApiCall } from "@/lib/security/admin-gate";
import { listAdminUsers } from "@/lib/data/admin-users";

export async function GET(req: NextRequest) {
  // Read-only, but still through the central gate: CSRF is a no-op on a safe
  // method while banned-device and admin-session enforcement still apply.
  const gate = await gateAdminApiCall(req);
  if (!gate.ok) return gate.response;

  const url = new URL(req.url);
  const search = url.searchParams.get("q") ?? undefined;
  const page = Number(url.searchParams.get("page") ?? "1");
  const pageSize = Number(url.searchParams.get("pageSize") ?? "20");

  try {
    const result = await listAdminUsers({
      search,
      page: Number.isFinite(page) ? page : 1,
      pageSize: Number.isFinite(pageSize) ? pageSize : 20,
    });
    return jsonOk({
      users: result.rows.map((u) => ({
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        language: u.language,
        createdAt: u.createdAt.toISOString(),
        emailVerified: u.emailVerified,
        role: u.role,
      })),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      pageCount: result.pageCount,
    });
  } catch {
    return jsonError("server_error");
  }
}
