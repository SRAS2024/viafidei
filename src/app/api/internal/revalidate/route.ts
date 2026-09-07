import { timingSafeEqual } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { memoClear, memoStats } from "@/lib/cache/memo";
import { deriveCronSecret, getProvidedCronToken } from "@/lib/security/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cache flush endpoint for the Admin Worker.
 *
 * The worker runs as its own process — usually on the operator's Mac, always
 * outside the Next.js server — so its `revalidateTag()` calls could never
 * reach the web process that actually serves visitors. After a publish it now
 * POSTs here instead (src/lib/cache/revalidate.ts `flushRemoteMemo`), and this
 * route drops the web server's in-process memo so a newly published row shows
 * up on list pages, the "today" block and the sitemap before their TTLs
 * expire.
 *
 * Auth: bearer INTERNAL_API_SECRET when set, otherwise the SESSION_SECRET-
 * derived token the rest of the internal surface already uses. With neither
 * configured the route refuses everything — it is disabled by default, never
 * open by default.
 *
 * Nothing here reads or writes content: the worst a caller can do with a valid
 * token is make the next few page views re-query Postgres.
 */

function constantTimeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  // timingSafeEqual throws on a length mismatch, which would itself leak the
  // length; compare against a same-length buffer and AND in the real result.
  if (left.length !== right.length) {
    timingSafeEqual(left, left);
    return false;
  }
  return timingSafeEqual(left, right);
}

async function isAuthorized(req: NextRequest): Promise<boolean> {
  const provided = getProvidedCronToken(req);
  if (!provided) return false;
  const explicit = process.env.INTERNAL_API_SECRET?.trim();
  if (explicit && constantTimeEquals(provided, explicit)) return true;
  const derived = await deriveCronSecret().catch(() => null);
  return Boolean(derived) && constantTimeEquals(provided, derived as string);
}

/** Tag names map onto memo key prefixes; anything unrecognised clears all. */
const TAG_PREFIXES: ReadonlyArray<{ test: RegExp; prefix: string }> = [
  { test: /^sitemap$/, prefix: "sitemap:" },
  { test: /^search-index$/, prefix: "search-" },
];

export async function POST(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let tags: string[] = [];
  let reason = "unspecified";
  try {
    const body = (await req.json()) as { tags?: unknown; reason?: unknown };
    if (Array.isArray(body?.tags)) {
      tags = body.tags.filter((t): t is string => typeof t === "string").slice(0, 50);
    }
    if (typeof body?.reason === "string") reason = body.reason.slice(0, 64);
  } catch {
    // A missing or malformed body means "flush everything" — the safe default.
  }

  // Content tags do not map one-to-one onto memo keys (a published saint
  // affects list pages, the feast-day memo, subtype counts and the sitemap),
  // so any content tag clears the whole memo. Only the two structural tags
  // have a narrow prefix worth honouring on their own.
  const narrow = tags.length > 0 && tags.every((t) => TAG_PREFIXES.some((p) => p.test.test(t)));
  let cleared = 0;
  if (narrow) {
    for (const tag of tags) {
      const match = TAG_PREFIXES.find((p) => p.test.test(tag));
      if (match) cleared += memoClear(match.prefix);
    }
  } else {
    cleared = memoClear();
  }

  // Best effort: inside the Next server the tag cache exists too. Static
  // generation is not used for these pages today, so a failure here is not an
  // error — the memo flush above is what actually matters.
  let tagsRevalidated = 0;
  if (tags.length > 0) {
    try {
      const mod = (await import("next/cache")) as { revalidateTag?: (tag: string) => void };
      if (typeof mod.revalidateTag === "function") {
        for (const tag of tags) {
          mod.revalidateTag(tag);
          tagsRevalidated += 1;
        }
      }
    } catch {
      tagsRevalidated = 0;
    }
  }

  return NextResponse.json({
    ok: true,
    reason,
    cleared,
    tagsRevalidated,
    remaining: memoStats().size,
  });
}
