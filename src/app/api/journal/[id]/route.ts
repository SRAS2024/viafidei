import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { rateLimit, RATE_POLICIES } from "@/lib/security/rate-limit";
import { getJournalEntry, updateJournalEntry } from "@/lib/data/journal";
import { jsonError, jsonOk, readJsonBody } from "@/lib/http";

const patchSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    body: z.string().min(1).max(20000).optional(),
  })
  .refine((v) => v.title !== undefined || v.body !== undefined, {
    message: "no-fields",
  });

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (!user) return jsonError("unauthorized");
  const result = await getJournalEntry(params.id, user.id);
  if (!result.ok) {
    if (result.reason === "not_found") return jsonError("not_found");
    return jsonError("forbidden");
  }
  return jsonOk({ entry: result.entry });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (!user) return jsonError("unauthorized");

  const limit = await rateLimit(`journal:${user.id}`, RATE_POLICIES.userWrite, {
    userId: user.id,
  });
  if (!limit.ok) return jsonError("rate_limited");

  const body = await readJsonBody(req);
  if (!body.ok) return jsonError(body.reason === "too_large" ? "too_large" : "invalid");
  const parsed = patchSchema.safeParse(body.data);
  if (!parsed.success) return jsonError("invalid", { details: parsed.error.flatten() });

  const result = await updateJournalEntry(params.id, user.id, parsed.data);
  if (!result.ok) {
    if (result.reason === "not_found") return jsonError("not_found");
    return jsonError("forbidden");
  }
  return jsonOk({ entry: result.entry });
}
