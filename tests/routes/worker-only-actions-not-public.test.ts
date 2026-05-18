/**
 * Worker-only actions MUST NOT be reachable from public web routes.
 *
 * The worker process (`scripts/run-worker.ts`) is the only consumer
 * of these functions:
 *
 *   * leaseNextJob          — atomic queue row leasing
 *   * completeJob           — final success transition
 *   * failJob               — final failure transition
 *   * writeHeartbeat        — worker liveness reporting
 *   * recoverStaleJobs      — stale-lease recovery
 *   * runJobByKind          — dispatch entry point
 *
 * Exposing any of these from a public web route would let a
 * malicious client steal queue rows, fake heartbeats, or trigger
 * adapter execution outside the worker process.
 *
 * The audit walks every public-facing route (excluding /api/cron
 * and /api/admin which are themselves protected) and asserts none
 * of these imports / calls appear in the source.
 *
 * /api/cron is allowed because it's authenticated by cron-auth
 * (HMAC of the request body) and IS allowed to call
 * `recoverStaleJobs` + `enqueueDueIngestionJobs` as a belt-and-
 * suspenders for single-server deploys without a separate worker.
 *
 * /api/admin is allowed because it sits behind the unified admin
 * gate, so admin-triggered manual queue actions stay safe.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const API_DIR = join(process.cwd(), "src", "app", "api");

// Routes excluded from this audit. These surfaces have their own
// authentication and are allowed to touch the worker layer.
const EXEMPT_PREFIXES = ["/api/cron/", "/api/admin/", "/api/internal/", "/api/security/"];

const WORKER_ONLY_SYMBOLS = [
  "leaseNextJob",
  "completeJob",
  "failJob",
  "writeHeartbeat",
  "recoverStaleJobs",
  "runJobByKind",
];

function findRouteFiles(dir: string): string[] {
  if (!statSync(dir).isDirectory()) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith(".")) continue;
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) out.push(...findRouteFiles(full));
    else if (entry === "route.ts" || entry === "route.tsx") out.push(full);
  }
  return out;
}

const PUBLIC_ROUTES = findRouteFiles(API_DIR).filter((p) => {
  const rel = p.replace(process.cwd(), "");
  return !EXEMPT_PREFIXES.some((prefix) => rel.includes(prefix));
});

describe("worker-only actions are not reachable from public web routes", () => {
  it("at least one public API route exists (sanity check)", () => {
    expect(PUBLIC_ROUTES.length).toBeGreaterThan(0);
  });

  for (const symbol of WORKER_ONLY_SYMBOLS) {
    it(`no public route imports or calls ${symbol}`, () => {
      const offenders: string[] = [];
      for (const file of PUBLIC_ROUTES) {
        const src = readFileSync(file, "utf8");
        // Match the symbol as a word boundary so "completeJobName"
        // (if it existed) wouldn't false-flag.
        const re = new RegExp(`\\b${symbol}\\b`);
        if (re.test(src)) {
          offenders.push(file.replace(process.cwd(), ""));
        }
      }
      if (offenders.length > 0) {
        throw new Error(
          `${symbol} is referenced from public route(s): ${offenders.join(", ")}. Move worker-only actions to /api/admin (admin gate) or /api/cron (HMAC auth).`,
        );
      }
    });
  }
});

describe("public routes never import from the worker dispatch", () => {
  it("no public route imports from @/lib/ingestion/queue/dispatch", () => {
    const offenders: string[] = [];
    for (const file of PUBLIC_ROUTES) {
      const src = readFileSync(file, "utf8");
      if (/from\s+["']@\/lib\/ingestion\/queue\/dispatch["']/.test(src)) {
        offenders.push(file.replace(process.cwd(), ""));
      }
    }
    if (offenders.length > 0) {
      throw new Error(
        `Public route(s) import from worker dispatch: ${offenders.join(", ")}. Worker dispatch is only callable from scripts/run-worker.ts.`,
      );
    }
  });
});
