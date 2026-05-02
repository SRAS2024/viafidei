import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { rateLimit, RATE_POLICIES } from "@/lib/security/rate-limit";
import {
  countJournalEntries,
  createJournalEntry,
  listJournalEntries,
  type JournalSort,
} from "@/lib/data/journal";
import { jsonError, jsonOk, readJsonBody } from "@/lib/http";

const SORTS: JournalSort[] = ["newest", "oldest", "updated", "favorite"];

const createSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(20000),
});

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

  const [entries, total] = await Promise.all([
    listJournalEntries(user.id, { sort, take, skip, favoritesOnly }),
    countJournalEntries(user.id),
  ]);
  return jsonOk({ entries, total, sort, take, skip });
}

export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user) {
    if (isJsonRequest(req)) return jsonError("unauthorized");
    return NextResponse.redirect(new URL("/login", req.url), 303);
  }

  const limit = await rateLimit(`journal:${user.id}`, RATE_POLICIES.userWrite, {
    userId: user.id,
  });
  if (!limit.ok) {
    if (isJsonRequest(req)) return jsonError("rate_limited");
    return NextResponse.redirect(new URL("/profile/journal", req.url), 303);
  }

  if (isJsonRequest(req)) {
    const body = await readJsonBody(req);
    if (!body.ok) return jsonError(body.reason === "too_large" ? "too_large" : "invalid");
    const parsed = createSchema.safeParse(body.data);
    if (!parsed.success) return jsonError("invalid", { details: parsed.error.flatten() });
    const entry = await createJournalEntry({ userId: user.id, ...parsed.data });
    return jsonOk({ entry });
  }

  const form = await req.formData();
  const parsed = createSchema.safeParse({ title: form.get("title"), body: form.get("body") });
  if (!parsed.success) return NextResponse.redirect(new URL("/profile/journal", req.url), 303);

  await createJournalEntry({
    userId: user.id,
    title: parsed.data.title,
    body: parsed.data.body,
  });
  return NextResponse.redirect(new URL("/profile/journal", req.url), 303);
}
