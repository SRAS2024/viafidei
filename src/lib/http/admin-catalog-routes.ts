import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { rateLimit, RATE_POLICIES } from "@/lib/security/rate-limit";
import { getClientIpOrNull, getUserAgent } from "@/lib/security/request";
import { assertCsrfOk, evaluateCsrf } from "@/lib/security/csrf";
import { reportSecurityBreach } from "@/lib/security/security-events";
import { DEVICE_CREDENTIAL_COOKIE } from "@/middleware";
import { jsonError, jsonOk, readJsonBody } from "@/lib/http";

/**
 * Common per-route mutation gate: CSRF check, admin auth, rate
 * limit. Order matters — CSRF check first so a cross-origin admin
 * session cannot mutate, then admin auth, then rate limit so an
 * authenticated admin still has to obey the per-actor cap.
 *
 * Returns a Response when the request must be rejected, or a
 * `{ ok: true, admin }` envelope when the caller may proceed.
 */
async function gateMutation(req: NextRequest): Promise<
  | { ok: true; admin: { username: string } }
  | { ok: false; response: Response }
> {
  // CSRF check first. A failed check is a Security Breach — the
  // attacker is attempting a cross-origin admin mutation.
  const decision = evaluateCsrf(req);
  if (!decision.ok) {
    const deviceCredential = req.cookies.get(DEVICE_CREDENTIAL_COOKIE)?.value ?? undefined;
    void reportSecurityBreach({
      kind: "csrf_violation",
      summary: `CSRF check failed on ${req.method} ${req.nextUrl.pathname} (expected ${decision.expected}, got ${decision.got ?? "missing"}).`,
      ipAddress: getClientIpOrNull(req) ?? undefined,
      userAgent: getUserAgent(req) ?? undefined,
      route: req.nextUrl.pathname,
      httpMethod: req.method,
      deviceCredential,
      attemptedAction: "admin_mutation",
    });
    const blocked = assertCsrfOk(req);
    if (blocked) return { ok: false, response: blocked };
  }
  const admin = await requireAdmin();
  if (!admin) return { ok: false, response: jsonError("unauthorized") };
  const limit = await rateLimit(`admin-catalog:${admin.username}`, RATE_POLICIES.adminWrite);
  if (!limit.ok) return { ok: false, response: jsonError("rate_limited") };
  return { ok: true, admin };
}

type Outcome = { ok: true; entity: unknown; created?: boolean } | { ok: false; reason: string };

export type AdminCatalogHandlers<C extends z.ZodTypeAny, U extends z.ZodTypeAny> = {
  entityType: string;
  createSchema: C;
  updateSchema: U;
  list: () => Promise<unknown>;
  create: (input: z.infer<C>) => Promise<Outcome>;
  update: (id: string, patch: z.infer<U>) => Promise<Outcome>;
  remove: (id: string) => Promise<{ ok: true } | { ok: false; reason: string }>;
};

export function makeAdminCatalogIndex<C extends z.ZodTypeAny, U extends z.ZodTypeAny>(
  config: AdminCatalogHandlers<C, U>,
) {
  async function GET() {
    const admin = await requireAdmin();
    if (!admin) return jsonError("unauthorized");
    const items = await config.list();
    return jsonOk({ items });
  }

  async function POST(req: NextRequest) {
    const gate = await gateMutation(req);
    if (!gate.ok) return gate.response;
    const { admin } = gate;

    const body = await readJsonBody(req);
    if (!body.ok) return jsonError(body.reason === "too_large" ? "too_large" : "invalid");
    const parsed = config.createSchema.safeParse(body.data);
    if (!parsed.success) return jsonError("invalid", { details: parsed.error.flatten() });

    const result = await config.create(parsed.data);
    if (!result.ok) return jsonError("conflict", { message: result.reason });

    await writeAudit({
      action: `admin.${config.entityType.toLowerCase()}.create`,
      entityType: config.entityType,
      entityId: (result.entity as { id?: string }).id ?? "unknown",
      actorUsername: admin.username,
      ipAddress: getClientIpOrNull(req),
      userAgent: getUserAgent(req),
      newValue: result.entity as never,
    });
    return jsonOk({ entity: result.entity });
  }

  return { GET, POST };
}

export function makeAdminCatalogItem<C extends z.ZodTypeAny, U extends z.ZodTypeAny>(
  config: AdminCatalogHandlers<C, U>,
) {
  async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const gate = await gateMutation(req);
    if (!gate.ok) return gate.response;
    const { admin } = gate;

    const body = await readJsonBody(req);
    if (!body.ok) return jsonError(body.reason === "too_large" ? "too_large" : "invalid");
    const parsed = config.updateSchema.safeParse(body.data);
    if (!parsed.success) return jsonError("invalid", { details: parsed.error.flatten() });

    const { id } = await params;
    const result = await config.update(id, parsed.data);
    if (!result.ok) {
      if (result.reason === "not_found") return jsonError("not_found");
      return jsonError("conflict", { message: result.reason });
    }
    await writeAudit({
      action: `admin.${config.entityType.toLowerCase()}.update`,
      entityType: config.entityType,
      entityId: id,
      actorUsername: admin.username,
      ipAddress: getClientIpOrNull(req),
      userAgent: getUserAgent(req),
      newValue: result.entity as never,
    });
    return jsonOk({ entity: result.entity });
  }

  async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const gate = await gateMutation(req);
    if (!gate.ok) return gate.response;
    const { admin } = gate;

    const { id } = await params;
    const result = await config.remove(id);
    if (!result.ok) return jsonError("not_found");
    await writeAudit({
      action: `admin.${config.entityType.toLowerCase()}.delete`,
      entityType: config.entityType,
      entityId: id,
      actorUsername: admin.username,
      ipAddress: getClientIpOrNull(req),
      userAgent: getUserAgent(req),
    });
    return jsonOk({ deleted: true });
  }

  return { PATCH, DELETE };
}
