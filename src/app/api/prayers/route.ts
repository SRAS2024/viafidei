import { NextResponse, type NextRequest } from "next/server";

import { listPublished } from "@/lib/data/published";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public prayer list. Backed by PublishedContent (the same source the
 * /prayers tab reads). `take` is clamped at the safety cap so a
 * crafted ?take=10000 cannot return an unbounded payload — the e2e
 * smoke test guards against regression of this contract.
 */
const MAX_TAKE = 200;
const DEFAULT_TAKE = 50;

function parseTake(raw: string | null): number {
  if (!raw) return DEFAULT_TAKE;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_TAKE;
  return Math.min(n, MAX_TAKE);
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const take = parseTake(url.searchParams.get("take"));
  const items = await listPublished("PRAYER");
  return NextResponse.json({
    items: items.slice(0, take),
    total: items.length,
    take,
    capped: items.length > take,
  });
}
