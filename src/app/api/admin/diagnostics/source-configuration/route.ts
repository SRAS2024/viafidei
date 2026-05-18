import { type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import {
  listSourceConfigurationCards,
  listSourcesNotFactoryNative,
} from "@/lib/data/source-configuration-card";
import { REQUEST_ID_HEADER } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return jsonError("unauthorized");
  const [cards, notFactoryNative] = await Promise.all([
    listSourceConfigurationCards().catch(() => []),
    listSourcesNotFactoryNative().catch(() => []),
  ]);
  return jsonOk({
    cards,
    notFactoryNative,
    requestId: req.headers.get(REQUEST_ID_HEADER) ?? null,
  });
}
