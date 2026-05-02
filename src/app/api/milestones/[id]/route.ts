import { type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { rateLimit, RATE_POLICIES } from "@/lib/security/rate-limit";
import { jsonError, jsonOk } from "@/lib/http";
import { deleteMilestone } from "@/lib/data/milestones";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (!user) return jsonError("unauthorized");

  const limit = await rateLimit(`milestones:${user.id}`, RATE_POLICIES.goalWrite, {
    userId: user.id,
  });
  if (!limit.ok) return jsonError("rate_limited");

  const result = await deleteMilestone(user.id, params.id);
  if (!result.ok) {
    return result.reason === "not_found" ? jsonError("not_found") : jsonError("forbidden");
  }
  return jsonOk({ deleted: true });
}
