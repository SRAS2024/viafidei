import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { rateLimit, RATE_POLICIES } from "@/lib/security/rate-limit";
import { redirectTo } from "@/lib/security/request";
import {
  countJournalEntries,
  createJournalEntry,
  listJournalEntries,
  type JournalSort,
} from "@/lib/data/journal";
import { jsonError, jsonOk, readJsonBody } from "@/lib/http";
import { logger } from "@/lib/observability";
import {
  JOURNAL_BODY_MAX,
  JOURNAL_JSON_LIMIT_BYTES,
  JOURNAL_TITLE_MAX,
  storableJournalText,
} from "@/app/profile/journal/limits";

const SORTS: JournalSort[] = ["newest", "oldest", "updated", "favorite"];

const createSchema = z.object({
  title: z.preprocess(storableJournalText, z.string().min(1).max(JOURNAL_TITLE_MAX)),
  body: z.preprocess(storableJournalText, z.string().min(1).max(JOURNAL_BODY_MAX)),
  goalId: z.string().min(1).max(64).optional(),
});

/**
 * Where a plain form post goes when it could not save. The journal's form saves by fetch
 * and keeps the reader's words on a failure; only a client without script posts here, so
 * a message is all that can be done for it, and it must not be nothing.
 */
const NOT_SAVED = "/profile/journal?error=not_saved";

function isJsonRequest(req: NextRequest): boolean {
  const contentType = req.headers.get("content-type") ?? "";
  return contentType.includes("application/json");
}

export async function GET(req: NextRequest) {
  const user = await requireUser();
  if (!user) return jsonError("unauthorized");

  const url = new URL(req.url);
  const sortParam = url.searchParams.get("sort");
  const sort: JournalSort = SORTS.includes(sortParam as JournalSort)
    ? (sortParam as JournalSort)
    : "updated";
  const take = Math.min(Number(url.searchParams.get("take")) || 50, 200);
  const skip = Math.max(Number(url.searchParams.get("skip")) || 0, 0);
  const favoritesOnly = url.searchParams.get("favoritesOnly") === "1";
  const goalId = url.searchParams.get("goalId") ?? undefined;

  const [entries, total] = await Promise.all([
    listJournalEntries(user.id, { sort, take, skip, favoritesOnly, goalId }),
    countJournalEntries(user.id),
  ]);
  return jsonOk({ entries, total, sort, take, skip });
}

export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user) {
    if (isJsonRequest(req)) return jsonError("unauthorized");
    return redirectTo(req, "/login?next=/profile/journal");
  }

  const limit = await rateLimit(`journal:${user.id}`, RATE_POLICIES.userWrite, {
    userId: user.id,
  });
  if (!limit.ok) {
    if (isJsonRequest(req)) return jsonError("rate_limited");
    return redirectTo(req, NOT_SAVED);
  }

  if (isJsonRequest(req)) {
    const body = await readJsonBody(req, { limitBytes: JOURNAL_JSON_LIMIT_BYTES });
    if (!body.ok) return jsonError(body.reason === "too_large" ? "too_large" : "invalid");
    const parsed = createSchema.safeParse(body.data);
    if (!parsed.success) return jsonError("invalid", { details: parsed.error.flatten() });
    try {
      const entry = await createJournalEntry({ userId: user.id, ...parsed.data });
      return jsonOk({ entry });
    } catch (error) {
      logger.error("journal.create.failed", {
        userId: user.id,
        message: error instanceof Error ? error.message : "unknown_error",
      });
      return jsonError("server_error");
    }
  }

  const form = await req.formData().catch(() => null);
  const goalIdValue = form?.get("goalId");
  const parsed = createSchema.safeParse({
    title: form?.get("title"),
    body: form?.get("body"),
    ...(typeof goalIdValue === "string" && goalIdValue.length > 0 ? { goalId: goalIdValue } : {}),
  });
  if (!parsed.success) return redirectTo(req, NOT_SAVED);

  try {
    await createJournalEntry({
      userId: user.id,
      title: parsed.data.title,
      body: parsed.data.body,
      goalId: parsed.data.goalId ?? null,
    });
  } catch (error) {
    logger.error("journal.create.failed", {
      userId: user.id,
      message: error instanceof Error ? error.message : "unknown_error",
    });
    return redirectTo(req, NOT_SAVED);
  }
  return redirectTo(req, "/profile/journal");
}
