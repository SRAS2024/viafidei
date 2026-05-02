import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { rateLimit, RATE_POLICIES } from "@/lib/security/rate-limit";
import { getClientIpOrNull, getUserAgent } from "@/lib/security/request";
import { jsonError, jsonOk, readJsonBody } from "@/lib/http";

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
    const admin = await requireAdmin();
    if (!admin) return jsonError("unauthorized");

    const limit = await rateLimit(`admin-catalog:${admin.username}`, RATE_POLICIES.adminWrite);
    if (!limit.ok) return jsonError("rate_limited");

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
  async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
    const admin = await requireAdmin();
    if (!admin) return jsonError("unauthorized");

    const limit = await rateLimit(`admin-catalog:${admin.username}`, RATE_POLICIES.adminWrite);
    if (!limit.ok) return jsonError("rate_limited");

    const body = await readJsonBody(req);
    if (!body.ok) return jsonError(body.reason === "too_large" ? "too_large" : "invalid");
    const parsed = config.updateSchema.safeParse(body.data);
    if (!parsed.success) return jsonError("invalid", { details: parsed.error.flatten() });

    const result = await config.update(params.id, parsed.data);
    if (!result.ok) {
      if (result.reason === "not_found") return jsonError("not_found");
      return jsonError("conflict", { message: result.reason });
    }
    await writeAudit({
      action: `admin.${config.entityType.toLowerCase()}.update`,
      entityType: config.entityType,
      entityId: params.id,
      actorUsername: admin.username,
      ipAddress: getClientIpOrNull(req),
      userAgent: getUserAgent(req),
      newValue: result.entity as never,
    });
    return jsonOk({ entity: result.entity });
  }

  async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
    const admin = await requireAdmin();
    if (!admin) return jsonError("unauthorized");

    const limit = await rateLimit(`admin-catalog:${admin.username}`, RATE_POLICIES.adminWrite);
    if (!limit.ok) return jsonError("rate_limited");

    const result = await config.remove(params.id);
    if (!result.ok) return jsonError("not_found");
    await writeAudit({
      action: `admin.${config.entityType.toLowerCase()}.delete`,
      entityType: config.entityType,
      entityId: params.id,
      actorUsername: admin.username,
      ipAddress: getClientIpOrNull(req),
      userAgent: getUserAgent(req),
    });
    return jsonOk({ deleted: true });
  }

  return { PATCH, DELETE };
}
