import { NextResponse, type NextRequest } from "next/server";

import { listPublishedPage } from "@/lib/data/published";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public prayer list. Backed by PublishedContent (the same source the
 * /prayers tab reads). `take` is clamped at the safety cap so a
 * crafted ?take=10000 cannot return an unbounded payload — the e2e
 * smoke test guards against regression of this contract.
 *
 * `skip`/`take` now become SQL OFFSET/LIMIT rather than slicing an
 * already-loaded table: the route used to read every prayer, with its full
 * body, to return fifty of them. `?type=litany` filters on the indexed
 * `subtype` column so the /litanies view no longer scans the whole type.
 */
const MAX_TAKE = 200;
const DEFAULT_TAKE = 50;

function parseTake(raw: string | null): number {
  if (!raw) return DEFAULT_TAKE;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_TAKE;
  return Math.min(n, MAX_TAKE);
}

function parseSkip(raw: string | null): number {
  if (!raw) return 0;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const take = parseTake(url.searchParams.get("take"));
  const skip = parseSkip(url.searchParams.get("skip"));
  const type = url.searchParams.get("type")?.trim() || null;

  // OFFSET is expressed in whole pages, so translate an arbitrary skip into
  // the page that contains it and keep the page size at `take`.
  const page = Math.floor(skip / take) + 1;
  const result = await listPublishedPage("PRAYER", {
    page,
    pageSize: take,
    subtype: type,
  });

  return NextResponse.json({
    items: result.items,
    total: result.total,
    take,
    skip: (result.page - 1) * take,
    page: result.page,
    pageCount: result.pageCount,
    capped: result.total > take,
  });
}
