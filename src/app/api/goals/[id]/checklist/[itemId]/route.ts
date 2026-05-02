import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { rateLimit, RATE_POLICIES } from "@/lib/security/rate-limit";
import { jsonError, jsonOk, readJsonBody } from "@/lib/http";
import { deleteChecklistItem, updateChecklistItem } from "@/lib/data/goals";

const patchSchema = z
  .object({
    label: z.string().min(1).max(200).optional(),
    isCompleted: z.boolean().optional(),
  })
  .refine((v) => v.label !== undefined || v.isCompleted !== undefined, { message: "no-fields" });

function asError(reason: "not_found" | "forbidden") {
  return reason === "not_found" ? jsonError("not_found") : jsonError("forbidden");
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; itemId: string } },
) {
  const user = await requireUser();
  if (!user) return jsonError("unauthorized");

  const limit = await rateLimit(`goals:${user.id}`, RATE_POLICIES.goalWrite, {
    userId: user.id,
  });
  if (!limit.ok) return jsonError("rate_limited");

  const body = await readJsonBody(req);
  if (!body.ok) return jsonError(body.reason === "too_large" ? "too_large" : "invalid");
  const parsed = patchSchema.safeParse(body.data);
  if (!parsed.success) return jsonError("invalid", { details: parsed.error.flatten() });

  const result = await updateChecklistItem(user.id, params.id, params.itemId, parsed.data);
  if (!result.ok) return asError(result.reason);
  return jsonOk({ item: result.item });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; itemId: string } },
) {
  const user = await requireUser();
  if (!user) return jsonError("unauthorized");

  const limit = await rateLimit(`goals:${user.id}`, RATE_POLICIES.goalWrite, {
    userId: user.id,
  });
  if (!limit.ok) return jsonError("rate_limited");

  const result = await deleteChecklistItem(user.id, params.id, params.itemId);
  if (!result.ok) return asError(result.reason);
  return jsonOk({ deleted: true });
}
