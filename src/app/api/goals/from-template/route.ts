import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { rateLimit, RATE_POLICIES } from "@/lib/security/rate-limit";
import { jsonError, jsonOk, readJsonBody } from "@/lib/http";
import { createGoal } from "@/lib/data/goals";
import { getGoalTemplate } from "@/lib/data/goal-templates";

const schema = z.object({
  templateSlug: z.string().min(1).max(120),
  dueDate: z.string().datetime().nullish(),
  titleOverride: z.string().min(1).max(200).nullish(),
});

export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user) return jsonError("unauthorized");

  const limit = await rateLimit(`goals:${user.id}`, RATE_POLICIES.goalWrite, { userId: user.id });
  if (!limit.ok) return jsonError("rate_limited");

  const body = await readJsonBody(req);
  if (!body.ok) return jsonError(body.reason === "too_large" ? "too_large" : "invalid");
  const parsed = schema.safeParse(body.data);
  if (!parsed.success) return jsonError("invalid", { details: parsed.error.flatten() });

  const template = getGoalTemplate(parsed.data.templateSlug);
  if (!template) return jsonError("not_found");

  const dueDate = parsed.data.dueDate
    ? new Date(parsed.data.dueDate)
    : template.defaultDurationDays
      ? new Date(Date.now() + template.defaultDurationDays * 24 * 60 * 60 * 1000)
      : null;

  const goal = await createGoal({
    userId: user.id,
    title: parsed.data.titleOverride ?? template.title,
    description: template.description,
    dueDate,
    templateSlug: template.slug,
    checklist: template.checklist.map((label) => ({ label })),
  });
  return jsonOk({ goal });
}
