import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { rateLimit, RATE_POLICIES } from "@/lib/security/rate-limit";
import { jsonError, jsonOk, readJsonBody } from "@/lib/http";
import { createGoal, completeGoal, listGoals } from "@/lib/data/goals";
import type { GoalStatus } from "@prisma/client";

const STATUS_VALUES: GoalStatus[] = ["ACTIVE", "COMPLETED", "OVERDUE", "ARCHIVED"];

const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(4000).nullish(),
  dueDate: z.string().datetime().nullish(),
  templateSlug: z.string().min(1).max(120).nullish(),
  checklist: z
    .array(z.object({ label: z.string().min(1).max(200) }))
    .max(50)
    .optional(),
  // "Already Completed" path: create the goal then immediately mark it done
  // (and award its milestone) for users who finished it before using the app.
  completed: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  const user = await requireUser();
  if (!user) return jsonError("unauthorized");
  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status");
  const status = STATUS_VALUES.includes(statusParam as GoalStatus)
    ? (statusParam as GoalStatus)
    : undefined;
  const goals = await listGoals(user.id, status);
  return jsonOk({ goals });
}

export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user) return jsonError("unauthorized");

  const limit = await rateLimit(`goals:${user.id}`, RATE_POLICIES.goalWrite, {
    userId: user.id,
  });
  if (!limit.ok) return jsonError("rate_limited");

  const body = await readJsonBody(req);
  if (!body.ok) return jsonError(body.reason === "too_large" ? "too_large" : "invalid");
  const parsed = createSchema.safeParse(body.data);
  if (!parsed.success) return jsonError("invalid", { details: parsed.error.flatten() });

  const goal = await createGoal({
    userId: user.id,
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
    templateSlug: parsed.data.templateSlug ?? null,
    checklist: parsed.data.checklist,
  });

  // "Already Completed": mark it done now and award the milestone, so a goal
  // the user finished before joining still earns its badge.
  if (parsed.data.completed) {
    const done = await completeGoal(user.id, goal.id);
    if (done.ok) return jsonOk({ goal: done.goal, milestone: done.milestone });
  }

  return jsonOk({ goal });
}
