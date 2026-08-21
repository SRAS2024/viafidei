/**
 * Spec §10 + acceptance §17-§20: the ordinary browser admin must not expose
 * Admin Worker execution controls, and no old worker control route may remain
 * reachable from a browser admin session.
 *
 * This is a structural test on purpose — hiding buttons with CSS would pass a
 * rendering test but fail the requirement.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { DASHBOARD_CARDS } from "@/app/admin/_dashboard/cards";
import { sampleLocalResources, recommendedConcurrency } from "@/lib/admin-worker/local-resources";

const ROOT = process.cwd();

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

describe("browser admin surface", () => {
  it("no longer ships the Admin Worker command center or its API routes", () => {
    expect(existsSync(path.join(ROOT, "src/app/admin/admin-worker"))).toBe(false);
    expect(existsSync(path.join(ROOT, "src/app/api/admin/admin-worker"))).toBe(false);
    expect(existsSync(path.join(ROOT, "src/app/admin/intelligence"))).toBe(false);
    expect(existsSync(path.join(ROOT, "src/app/admin/skills"))).toBe(false);
    expect(existsSync(path.join(ROOT, "src/app/api/admin/developer-audit"))).toBe(false);
  });

  it("keeps user management, diagnostics and logs in the browser", () => {
    const hrefs = DASHBOARD_CARDS.map((c) => c.href);
    expect(hrefs).toContain("/admin/users");
    expect(hrefs).toContain("/admin/diagnostics");
    expect(hrefs).toContain("/admin/logs");
    expect(hrefs).toContain("/admin/logs/worker");
    expect(existsSync(path.join(ROOT, "src/app/admin/login/page.tsx"))).toBe(true);
    expect(existsSync(path.join(ROOT, "src/app/api/admin/logout/route.ts"))).toBe(true);
  });

  it("offers no dashboard card that starts Admin Worker work", () => {
    for (const card of DASHBOARD_CARDS) {
      expect(card.href.startsWith("/admin/admin-worker")).toBe(false);
      expect(card.href).not.toBe("/admin/intelligence");
      expect(card.href).not.toBe("/admin/skills");
    }
  });

  it("has no server route that runs a pass, resumes the worker, or requests a makeover", () => {
    const routes = walk(path.join(ROOT, "src/app/api")).filter((f) => f.endsWith("route.ts"));
    const offenders = routes.filter((file) => {
      const src = readFileSync(file, "utf8");
      return (
        /\brunOnePass\b/.test(src) ||
        /\brunOperatorPass\b/.test(src) ||
        /\brunAdminWorkerLoop\b/.test(src) ||
        /\bredesignHomepage\b/.test(src) ||
        /\brunCleanupPass\b/.test(src) ||
        /\bensureBrainStarted\b/.test(src)
      );
    });
    expect(offenders.map((f) => path.relative(ROOT, f))).toEqual([]);
  });

  it("has no admin page component that spawns worker computation", () => {
    const pages = walk(path.join(ROOT, "src/app/admin")).filter((f) => /\.tsx?$/.test(f));
    const offenders = pages.filter((file) => {
      const src = readFileSync(file, "utf8");
      return (
        /\bprobeBrain\b/.test(src) ||
        /\bredesignHomepage\b/.test(src) ||
        /\brunOperatorPass\b/.test(src) ||
        /api\/admin\/admin-worker/.test(src)
      );
    });
    expect(offenders.map((f) => path.relative(ROOT, f))).toEqual([]);
  });
});

describe("local resource intelligence (spec §20)", () => {
  it("samples this machine without reserving it", () => {
    const sample = sampleLocalResources(null);
    expect(sample.cpuCount).toBeGreaterThan(0);
    expect(sample.processRssBytes).toBeGreaterThan(0);
    expect(sample.totalMemoryBytes).toBeGreaterThan(sample.freeMemoryBytes);
    expect(sample.recommendedConcurrency).toBeGreaterThanOrEqual(1);
    expect(sample.recommendedConcurrency).toBeLessThanOrEqual(Math.max(2, sample.cpuCount));
  });

  it("keeps concurrency bounded rather than proportional to raw core count", () => {
    expect(recommendedConcurrency()).toBeLessThanOrEqual(
      Math.max(2, Math.floor(sampleLocalResources(null).cpuCount / 2)),
    );
  });
});
