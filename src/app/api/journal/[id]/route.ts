import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { rateLimit, RATE_POLICIES } from "@/lib/security/rate-limit";
import { getJournalEntry, updateJournalEntry } from "@/lib/data/journal";
import { jsonError, jsonOk, readJsonBody } from "@/lib/http";
import { logger } from "@/lib/observability";
import {
  JOURNAL_BODY_MAX,
  JOURNAL_JSON_LIMIT_BYTES,
  JOURNAL_TITLE_MAX,
  storableJournalText,
} from "@/app/profile/journal/limits";

const patchSchema = z
  .object({
    title: z.preprocess(storableJournalText, z.string().min(1).max(JOURNAL_TITLE_MAX)).optional(),
    body: z.preprocess(storableJournalText, z.string().min(1).max(JOURNAL_BODY_MAX)).optional(),
  })
  .refine((v) => v.title !== undefined || v.body !== undefined, {
    message: "no-fields",
  });

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  if (!user) return jsonError("unauthorized");
  const result = await getJournalEntry(id, user.id);
  if (!result.ok) {
    if (result.reason === "not_found") return jsonError("not_found");
    return jsonError("forbidden");
  }
  return jsonOk({ entry: result.entry });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  if (!user) return jsonError("unauthorized");

  const limit = await rateLimit(`journal:${user.id}`, RATE_POLICIES.userWrite, {
    userId: user.id,
  });
  if (!limit.ok) return jsonError("rate_limited");

  const body = await readJsonBody(req, { limitBytes: JOURNAL_JSON_LIMIT_BYTES });
  if (!body.ok) return jsonError(body.reason === "too_large" ? "too_large" : "invalid");
  const parsed = patchSchema.safeParse(body.data);
  if (!parsed.success) return jsonError("invalid", { details: parsed.error.flatten() });

  let result: Awaited<ReturnType<typeof updateJournalEntry>>;
  try {
    result = await updateJournalEntry(id, user.id, parsed.data);
  } catch (error) {
    logger.error("journal.update.failed", {
      userId: user.id,
      entryId: id,
      message: error instanceof Error ? error.message : "unknown_error",
    });
    return jsonError("server_error");
  }
  if (!result.ok) {
    if (result.reason === "not_found") return jsonError("not_found");
    return jsonError("forbidden");
  }
  return jsonOk({ entry: result.entry });
}
