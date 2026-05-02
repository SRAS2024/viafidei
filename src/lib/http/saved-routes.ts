import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { rateLimit, RATE_POLICIES } from "@/lib/security/rate-limit";
import { jsonError, jsonOk, readJsonBody } from "@/lib/http";
import { saveItem, unsaveItem, type SavedKind } from "@/lib/data/saved";
import { getLocale } from "@/lib/i18n/server";

const saveSchema = z.object({ id: z.string().min(1).max(64) });
const unsaveSchema = z.object({ id: z.string().min(1).max(64) });

export function makeSavedHandlers(
  kind: SavedKind,
  list: (userId: string, locale: Awaited<ReturnType<typeof getLocale>>) => Promise<unknown>,
) {
  async function GET() {
    const user = await requireUser();
    if (!user) return jsonError("unauthorized");
    const locale = await getLocale();
    const items = await list(user.id, locale);
    return jsonOk({ items });
  }

  async function POST(req: NextRequest) {
    const user = await requireUser();
    if (!user) return jsonError("unauthorized");

    const limit = await rateLimit(`saved:${kind}:${user.id}`, RATE_POLICIES.savedItem, {
      userId: user.id,
    });
    if (!limit.ok) return jsonError("rate_limited");

    const body = await readJsonBody(req);
    if (!body.ok) return jsonError(body.reason === "too_large" ? "too_large" : "invalid");
    const parsed = saveSchema.safeParse(body.data);
    if (!parsed.success) return jsonError("invalid", { details: parsed.error.flatten() });

    const result = await saveItem(kind, user.id, parsed.data.id);
    if (!result.ok) return jsonError("not_found");
    return jsonOk({ saved: true });
  }

  async function DELETE(req: NextRequest) {
    const user = await requireUser();
    if (!user) return jsonError("unauthorized");

    const limit = await rateLimit(`saved:${kind}:${user.id}`, RATE_POLICIES.savedItem, {
      userId: user.id,
    });
    if (!limit.ok) return jsonError("rate_limited");

    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    let candidate: { id?: string } = id ? { id } : {};
    if (!id) {
      const body = await readJsonBody<unknown>(req);
      if (body.ok) candidate = body.data as { id?: string };
    }
    const parsed = unsaveSchema.safeParse(candidate);
    if (!parsed.success) return jsonError("invalid", { details: parsed.error.flatten() });

    await unsaveItem(kind, user.id, parsed.data.id);
    return jsonOk({ removed: true });
  }

  return { GET, POST, DELETE };
}
