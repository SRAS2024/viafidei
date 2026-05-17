/**
 * Public API + sitemap + saints/today safety gate audit. Section 11
 * requires every public surface to filter by the strict where clause.
 *
 * The data-layer accessors are covered by
 * `public-safety-gate-audit.test.ts`; this file covers the *route*
 * layer (src/app/api/**) to catch any direct prisma.* call that
 * bypasses the data layer.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const API_DIR = join(process.cwd(), "src/app/api");

// Routes that serve user-owned data (journal, profile, settings,
// saved items by id) or operate on infrastructure (cron / internal
// cleanup). They do NOT read public catalog content and so are
// exempt from the strict-gate audit.
const EXEMPT_PATHS = [
  "/api/admin/", // admin routes are gated by requireAdmin separately
  "/api/internal/", // cron / cleanup / admin-only operational routes
  "/api/cron/", // scheduler-only routes
  "/api/auth/", // session / login / logout
  "/api/account/", // user account routes
  "/api/profile/", // user profile routes
  "/api/journal/", // user journal entries
  "/api/goal", // user goals
  "/api/milestones/", // user milestones
  "/api/saved/", // user saved items (id lookups, not list reads)
  "/api/settings/", // user preferences
  "/api/security/", // signed-link security actions (e.g. ban-device); not a catalog reader
];

function findRouteFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "admin") continue;
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) {
      out.push(...findRouteFiles(full));
    } else if (entry === "route.ts" || entry === "route.tsx") {
      out.push(full);
    }
  }
  return out;
}

const PUBLIC_ROUTES = findRouteFiles(API_DIR).filter((p) => {
  const norm = p.replace(process.cwd(), "");
  return !EXEMPT_PATHS.some((prefix) => norm.includes(prefix));
});

describe("public API routes never bypass the strict gate", () => {
  it("at least one public API route exists", () => {
    expect(PUBLIC_ROUTES.length).toBeGreaterThan(0);
  });

  for (const route of PUBLIC_ROUTES) {
    const rel = route.replace(process.cwd(), "");
    it(`${rel} either uses a gated helper or STRICT_PUBLIC_WHERE_CLAUSE`, () => {
      const src = readFileSync(route, "utf-8");
      // Skip mutating routes (POST / PUT / DELETE) since they don't
      // return content. We only need to gate GET / HEAD readers.
      const isReader =
        src.includes("export async function GET") || src.includes("export async function HEAD");
      if (!isReader) {
        return;
      }
      // Inline prisma.* calls that select content rows must filter by
      // STRICT_PUBLIC_WHERE_CLAUSE OR isPublicVisible OR
      // PUBLIC_*_WHERE. Routes that delegate to a gated helper
      // (listPublishedX / getPublishedX / searchX) are also fine.
      const usesGatedHelper =
        /\b(?:listPublished\w+|getPublished\w+|searchPublished\w+|listSaintsForFeastDate|listPublicHomepage\w+|getPublic\w+|searchPrayers|searchDevotions|searchSaints)\b/.test(
          src,
        );
      const usesStrictWhere =
        src.includes("STRICT_PUBLIC_WHERE_CLAUSE") || src.includes("isPublicVisible");
      const noPrismaCall = !src.includes("prisma.");
      expect(usesGatedHelper || usesStrictWhere || noPrismaCall).toBe(true);
    });
  }
});
