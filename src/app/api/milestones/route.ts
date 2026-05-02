import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { rateLimit, RATE_POLICIES } from "@/lib/security/rate-limit";
import { jsonError, jsonOk, readJsonBody } from "@/lib/http";
import { createMilestone, listMilestones } from "@/lib/data/milestones";
import type { MilestoneTier } from "@prisma/client";

const TIERS: MilestoneTier[] = ["SACRAMENT", "SPIRITUAL", "PERSONAL"];

const createSchema = z.object({
  tier: z.enum(TIERS as [MilestoneTier, ...MilestoneTier[]]),
  slug: z.string().min(1).max(120),
  title: z.string().min(1).max(200),
  description: z.string().max(4000).nullish(),
});

export async function GET(req: NextRequest) {
  const user = await requireUser();
  if (!user) return jsonError("unauthorized");
  const url = new URL(req.url);
  const tierParam = url.searchParams.get("tier");
  const tier = TIERS.includes(tierParam as MilestoneTier)
    ? (tierParam as MilestoneTier)
    : undefined;
  const milestones = await listMilestones(user.id, tier);
  return jsonOk({ milestones });
}

export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user) return jsonError("unauthorized");

  const limit = await rateLimit(`milestones:${user.id}`, RATE_POLICIES.goalWrite, {
    userId: user.id,
  });
  if (!limit.ok) return jsonError("rate_limited");

  const body = await readJsonBody(req);
  if (!body.ok) return jsonError(body.reason === "too_large" ? "too_large" : "invalid");
  const parsed = createSchema.safeParse(body.data);
  if (!parsed.success) return jsonError("invalid", { details: parsed.error.flatten() });

  const result = await createMilestone({ userId: user.id, ...parsed.data });
  if (!result.ok) return jsonError("conflict", { message: result.reason });
  return jsonOk({ milestone: result.milestone });
}
