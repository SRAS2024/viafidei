import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { rateLimit, RATE_POLICIES } from "@/lib/security/rate-limit";
import { jsonError, jsonOk, readJsonBody } from "@/lib/http";
import { deleteGoal, getGoal, updateGoal } from "@/lib/data/goals";
import type { GoalStatus } from "@prisma/client";

const STATUS_VALUES: GoalStatus[] = ["ACTIVE", "COMPLETED", "OVERDUE", "ARCHIVED"];

const patchSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(4000).nullish(),
    dueDate: z.string().datetime().nullish(),
    status: z.enum(STATUS_VALUES as [GoalStatus, ...GoalStatus[]]).optional(),
  })
  .refine(
    (v) =>
      v.title !== undefined ||
      v.description !== undefined ||
      v.dueDate !== undefined ||
      v.status !== undefined,
    { message: "no-fields" },
  );

function reasonToStatus(reason: "not_found" | "forbidden") {
  return reason === "not_found" ? jsonError("not_found") : jsonError("forbidden");
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (!user) return jsonError("unauthorized");
  const result = await getGoal(user.id, params.id);
  if (!result.ok) return reasonToStatus(result.reason);
  return jsonOk({ goal: result.goal });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
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

  const result = await updateGoal(user.id, params.id, {
    title: parsed.data.title,
    description: parsed.data.description ?? undefined,
    dueDate:
      parsed.data.dueDate === undefined
        ? undefined
        : parsed.data.dueDate
          ? new Date(parsed.data.dueDate)
          : null,
    status: parsed.data.status,
  });
  if (!result.ok) return reasonToStatus(result.reason);
  return jsonOk({ goal: result.goal });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (!user) return jsonError("unauthorized");

  const limit = await rateLimit(`goals:${user.id}`, RATE_POLICIES.goalWrite, {
    userId: user.id,
  });
  if (!limit.ok) return jsonError("rate_limited");

  const result = await deleteGoal(user.id, params.id);
  if (!result.ok) return reasonToStatus(result.reason);
  return jsonOk({ deleted: true });
}
