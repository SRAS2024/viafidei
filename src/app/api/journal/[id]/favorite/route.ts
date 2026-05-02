import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { rateLimit, RATE_POLICIES } from "@/lib/security/rate-limit";
import { setJournalFavorite } from "@/lib/data/journal";
import { jsonError, jsonOk, readJsonBody } from "@/lib/http";

const schema = z.object({ isFavorite: z.boolean() });

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (!user) return jsonError("unauthorized");

  const limit = await rateLimit(`journal:${user.id}`, RATE_POLICIES.userWrite, {
    userId: user.id,
  });
  if (!limit.ok) return jsonError("rate_limited");

  const body = await readJsonBody(req);
  if (!body.ok) return jsonError(body.reason === "too_large" ? "too_large" : "invalid");
  const parsed = schema.safeParse(body.data);
  if (!parsed.success) return jsonError("invalid", { details: parsed.error.flatten() });

  const result = await setJournalFavorite(params.id, user.id, parsed.data.isFavorite);
  if (!result.ok) {
    if (result.reason === "not_found") return jsonError("not_found");
    return jsonError("forbidden");
  }
  return jsonOk({ entry: result.entry });
}
