/**
 * Spec item 12 — the admin-session sweep runs OUTSIDE the Admin Worker.
 *
 * Dead `AdminSession` rows have to be cleaned up, but the obvious home for
 * that job (the worker's cleanup lane) is the one place it must not go:
 * `tests/security/fail-closed.test.ts` pins that no module under
 * `src/lib/admin-worker/**` imports `lib/auth/admin-session`, which is what
 * keeps the worker out of interactive admin authentication. So the sweep is
 * an operator command — `scripts/maintenance/prune-admin-sessions.ts` — and
 * this suite covers both halves of that decision:
 *
 *   * the command behaves (dry run deletes nothing, --confirm deletes, the
 *     retention window is respected, the batch ceiling holds); and
 *   * the placement itself — the script is outside the worker tree and pulls
 *     in nothing from it, so the isolation the fail-closed suite pins is not
 *     quietly reintroduced through this new file.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));
vi.mock("@/lib/security/security-events", () => ({
  reportSecurityBreach: vi.fn(),
  reportSuspiciousActivity: vi.fn(),
}));

import { ADMIN_SESSION_RETENTION_MS } from "@/lib/auth/admin-session";
import { pruneAdminSessions } from "../../scripts/maintenance/prune-admin-sessions";

const ROOT = process.cwd();
const SCRIPT = join(ROOT, "scripts", "maintenance", "prune-admin-sessions.ts");

const NOW = new Date("2026-09-08T12:00:00.000Z");

/**
 * A stub raw-SQL client. The COUNT query returns `count`; each DELETE returns
 * up to `batchSize` ids until `remaining` is exhausted, which is exactly how
 * the store's bounded delete behaves against a real table.
 */
function stubClient(options: { count: number; remaining?: number; batchSize?: number }) {
  const state = {
    remaining: options.remaining ?? options.count,
    deletes: 0,
    countQueries: 0,
    sql: [] as string[],
  };
  const client = {
    $queryRaw: vi.fn(async (query: { strings?: string[]; sql?: string }) => {
      const text = (query.strings ?? []).join("?") || query.sql || "";
      state.sql.push(text);
      if (/count\(\*\)/i.test(text)) {
        state.countQueries += 1;
        return [{ n: options.count }];
      }
      state.deletes += 1;
      const take = Math.min(options.batchSize ?? 500, state.remaining);
      state.remaining -= take;
      return Array.from({ length: take }, (_, i) => ({ id: `row-${i}` }));
    }),
  };
  return { client, state };
}

beforeEach(() => {
  resetPrismaMock();
  process.env.SESSION_SECRET = "test-session-secret-must-be-32-chars-long";
});

describe("prune-admin-sessions — the sweep itself", () => {
  it("a dry run reports the eligible rows and deletes nothing", async () => {
    const { client, state } = stubClient({ count: 42 });
    const result = await pruneAdminSessions({ client, now: NOW, log: () => {} });

    expect(result.confirmed).toBe(false);
    expect(result.eligible).toBe(42);
    expect(result.deleted).toBe(0);
    expect(state.deletes).toBe(0);
  });

  it("--confirm deletes in bounded batches until the table is clean", async () => {
    const { client, state } = stubClient({ count: 1200, batchSize: 500 });
    const result = await pruneAdminSessions({
      client,
      confirm: true,
      batch: 500,
      now: NOW,
      log: () => {},
    });

    expect(result.deleted).toBe(1200);
    expect(result.truncated).toBe(false);
    // 500 + 500 + 200, then one more that returns nothing and ends the loop.
    expect(state.deletes).toBe(4);
  });

  it("stops at the batch ceiling instead of looping forever", async () => {
    // A client that always claims it deleted rows — the pathological case.
    const client = {
      $queryRaw: vi.fn(async (query: { strings?: string[] }) => {
        const text = (query.strings ?? []).join("?");
        if (/count\(\*\)/i.test(text)) return [{ n: 10_000_000 }];
        return [{ id: "row" }];
      }),
    };
    const result = await pruneAdminSessions({
      client,
      confirm: true,
      batch: 1,
      now: NOW,
      log: () => {},
    });
    expect(result.truncated).toBe(true);
    expect(result.deleted).toBeLessThanOrEqual(200);
  });

  it("only ever names the AdminSession table", async () => {
    const { client, state } = stubClient({ count: 3, batchSize: 3 });
    await pruneAdminSessions({ client, confirm: true, now: NOW, log: () => {} });
    expect(state.sql.length).toBeGreaterThan(1);
    for (const sql of state.sql) {
      expect(sql).toContain('"AdminSession"');
      expect(sql).not.toMatch(/"PublishedContent"|"User"|"AdminWorker[A-Za-z]*"/);
    }
  });

  it("uses the store's retention window as the cutoff, not an ad-hoc one", async () => {
    const { client } = stubClient({ count: 0 });
    const result = await pruneAdminSessions({ client, now: NOW, log: () => {} });
    expect(result.cutoff.getTime()).toBe(NOW.getTime() - ADMIN_SESSION_RETENTION_MS);
  });

  it("importing the module runs nothing — deletion needs a deliberate invocation", () => {
    // The import at the top of this file already proves it: if the script
    // executed on import it would have opened a PrismaClient and swept.
    const source = readFileSync(SCRIPT, "utf8");
    expect(source).toMatch(/process\.argv\[1\]/);
    expect(source).toMatch(/prune-admin-sessions/);
  });
});

describe("prune-admin-sessions — placement, not just behaviour", () => {
  it("lives outside the Admin Worker tree", () => {
    expect(SCRIPT).not.toContain(join("src", "lib", "admin-worker"));
  });

  it("imports nothing from the worker, so the fail-closed isolation still holds", () => {
    const source = readFileSync(SCRIPT, "utf8");
    const imports = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]!);
    expect(imports.filter((i) => i.includes("admin-worker"))).toEqual([]);
  });

  it("does not reimplement the delete — it drives the store's own sweep", () => {
    const source = readFileSync(SCRIPT, "utf8");
    expect(source).toContain("pruneExpiredAdminSessions");
    expect(source).not.toMatch(/DELETE\s+FROM/i);
  });

  it("defaults to a dry run", () => {
    const source = readFileSync(SCRIPT, "utf8");
    expect(source).toMatch(/confirm\s*=\s*false/);
  });
});
