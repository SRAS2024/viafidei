import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { rateLimit, RATE_POLICIES } from "@/lib/security/rate-limit";
import { jsonError, jsonOk, readJsonBody } from "@/lib/http";
import { reorderChecklist } from "@/lib/data/goals";

const schema = z.object({ itemIds: z.array(z.string().min(1).max(64)).min(1).max(50) });

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (!user) return jsonError("unauthorized");

  const limit = await rateLimit(`goals:${user.id}`, RATE_POLICIES.goalWrite, {
    userId: user.id,
  });
  if (!limit.ok) return jsonError("rate_limited");

  const body = await readJsonBody(req);
  if (!body.ok) return jsonError(body.reason === "too_large" ? "too_large" : "invalid");
  const parsed = schema.safeParse(body.data);
  if (!parsed.success) return jsonError("invalid", { details: parsed.error.flatten() });

  const result = await reorderChecklist(user.id, params.id, parsed.data.itemIds);
  if (!result.ok) {
    return result.reason === "not_found" ? jsonError("not_found") : jsonError("forbidden");
  }
  return jsonOk({ reordered: true });
}
