/**
 * Server-side admin session store (spec item 3).
 *
 * The property under test throughout: an admin session is only ever trusted
 * when the SERVER says both sign-in stages completed. A cookie that claims
 * ADMIN, a password-verified PENDING row, a revoked row, an idle-expired row
 * and an unreadable store must all fail — and the raw session id must never
 * reach the database.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));
vi.mock("@/lib/security/security-events", () => ({
  reportSuspiciousActivity: vi.fn(),
  reportSecurityBreach: vi.fn(),
}));

const sessionState: {
  data: Record<string, unknown>;
  saves: number;
  destroys: number;
} = { data: {}, saves: 0, destroys: 0 };

vi.mock("@/lib/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/session")>();
  return {
    ...actual,
    getSession: async () =>
      new Proxy(sessionState.data, {
        get(target, prop) {
          if (prop === "save")
            return async () => {
              sessionState.saves += 1;
            };
          if (prop === "destroy")
            return () => {
              sessionState.destroys += 1;
              for (const k of Object.keys(target)) delete target[k];
            };
          return Reflect.get(target, prop);
        },
      }),
  };
});

import {
  ADMIN_PENDING_SESSION_TTL_MS,
  ADMIN_SESSION_ABSOLUTE_TTL_MS,
  ADMIN_SESSION_IDLE_TTL_MS,
  ADMIN_SESSION_RETENTION_MS,
  beginAdminSession,
  completeAdminTwoFactor,
  createPendingAdminSession,
  getPendingAdminSession,
  promoteAdminSession,
  pruneExpiredAdminSessions,
  resolveAdminSession,
  revokeAdminSession,
  revokeCurrentAdminSession,
} from "@/lib/auth/admin-session";

type Captured = { sql: string; values: unknown[] };

function captureQueries(): Captured[] {
  const seen: Captured[] = [];
  prismaMock.$queryRaw.mockImplementation(async (arg: unknown) => {
    const q = arg as Prisma.Sql;
    seen.push({ sql: q.sql, values: [...q.values] });
    return [{ id: "row" }];
  });
  return seen;
}

/** A live, fully authenticated row as `$queryRaw` would return it. */
function authenticatedRow(overrides: Record<string, unknown> = {}) {
  const now = Date.now();
  return {
    id: "stored-id",
    adminUsername: "root",
    stage: "AUTHENTICATED",
    authenticatedAt: new Date(now - 60_000),
    twoFactorVerifiedAt: new Date(now - 59_000),
    lastActivityAt: new Date(now - 1_000),
    absoluteExpiresAt: new Date(now + ADMIN_SESSION_ABSOLUTE_TTL_MS),
    idleExpiresAt: new Date(now + ADMIN_SESSION_IDLE_TTL_MS),
    revokedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  resetPrismaMock();
  sessionState.data = {};
  sessionState.saves = 0;
  sessionState.destroys = 0;
  process.env.SESSION_SECRET = "test-session-secret-must-be-32-chars-long";
});

describe("security constants are internally consistent", () => {
  it("idle and pending windows sit inside the absolute window", () => {
    expect(ADMIN_SESSION_IDLE_TTL_MS).toBeLessThan(ADMIN_SESSION_ABSOLUTE_TTL_MS);
    expect(ADMIN_PENDING_SESSION_TTL_MS).toBeLessThan(ADMIN_SESSION_ABSOLUTE_TTL_MS);
    expect(ADMIN_SESSION_RETENTION_MS).toBeGreaterThan(ADMIN_SESSION_ABSOLUTE_TTL_MS);
  });
});

describe("the raw session id never reaches the database", () => {
  it("createPendingAdminSession persists an HMAC, not the id it returns", async () => {
    const seen = captureQueries();
    const created = await createPendingAdminSession({ username: "root" });
    expect(created).not.toBeNull();
    const insert = seen.find((q) => q.sql.includes('INSERT INTO "AdminSession"'))!;
    expect(insert).toBeDefined();
    const stored = insert.values[0] as string;
    // 64 hex characters — a SHA-256 HMAC, not the base64url id.
    expect(stored).toMatch(/^[0-9a-f]{64}$/);
    expect(insert.values).not.toContain(created!.sessionId);
    expect(JSON.stringify(insert.values)).not.toContain(created!.sessionId);
  });

  it("a new pending session starts in stage PENDING with no 2FA timestamp", async () => {
    const seen = captureQueries();
    await createPendingAdminSession({ username: "root" });
    const insert = seen.find((q) => q.sql.includes('INSERT INTO "AdminSession"'))!;
    expect(insert.sql).toContain("'PENDING'");
    expect(insert.sql).toContain("NULL");
  });

  it("returns null (refusing the sign-in) when the store is unreachable", async () => {
    prismaMock.$queryRaw.mockRejectedValue(new Error("db down"));
    expect(await createPendingAdminSession({ username: "root" })).toBeNull();
  });
});

describe("resolveAdminSession — only a completed-2FA session is valid", () => {
  it("accepts a live AUTHENTICATED row", async () => {
    prismaMock.$queryRaw.mockResolvedValue([authenticatedRow()]);
    const r = await resolveAdminSession("sid");
    expect(r.valid).toBe(true);
    if (r.valid) expect(r.record.adminUsername).toBe("root");
  });

  it("REFUSES a password-verified PENDING row", async () => {
    prismaMock.$queryRaw.mockResolvedValue([
      authenticatedRow({ stage: "PENDING", twoFactorVerifiedAt: null }),
    ]);
    const r = await resolveAdminSession("sid");
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toBe("pending_two_factor");
  });

  it("REFUSES an AUTHENTICATED row with no 2FA timestamp (halves must agree)", async () => {
    prismaMock.$queryRaw.mockResolvedValue([authenticatedRow({ twoFactorVerifiedAt: null })]);
    const r = await resolveAdminSession("sid");
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toBe("pending_two_factor");
  });

  it("REFUSES a revoked row", async () => {
    prismaMock.$queryRaw.mockResolvedValue([authenticatedRow({ revokedAt: new Date() })]);
    const r = await resolveAdminSession("sid");
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toBe("revoked");
  });

  it("REFUSES a row past its absolute expiry, even with fresh activity", async () => {
    prismaMock.$queryRaw.mockResolvedValue([
      authenticatedRow({
        absoluteExpiresAt: new Date(Date.now() - 1000),
        idleExpiresAt: new Date(Date.now() + 60_000),
        lastActivityAt: new Date(),
      }),
    ]);
    const r = await resolveAdminSession("sid");
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toBe("expired_absolute");
  });

  it("REFUSES a row past its idle expiry", async () => {
    prismaMock.$queryRaw.mockResolvedValue([
      authenticatedRow({ idleExpiresAt: new Date(Date.now() - 1) }),
    ]);
    const r = await resolveAdminSession("sid");
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toBe("expired_idle");
  });

  it("REFUSES when there is no server-side row for the id", async () => {
    prismaMock.$queryRaw.mockResolvedValue([]);
    const r = await resolveAdminSession("sid");
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toBe("no_server_session");
  });

  it("FAILS CLOSED when the store throws", async () => {
    prismaMock.$queryRaw.mockRejectedValue(new Error("db down"));
    const r = await resolveAdminSession("sid");
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toBe("indeterminate");
  });

  it("FAILS CLOSED when the store answers with something that is not a row set", async () => {
    prismaMock.$queryRaw.mockResolvedValue(undefined);
    const r = await resolveAdminSession("sid");
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toBe("indeterminate");
  });

  it("slides the idle window when activity is stale, and not otherwise", async () => {
    const calls: string[] = [];
    prismaMock.$queryRaw.mockImplementation(async (arg: unknown) => {
      const q = arg as Prisma.Sql;
      calls.push(q.sql);
      if (q.sql.includes("UPDATE")) return [{ id: "stored-id" }];
      return [authenticatedRow({ lastActivityAt: new Date(Date.now() - 10 * 60_000) })];
    });
    await resolveAdminSession("sid");
    expect(calls.some((s) => s.includes('UPDATE "AdminSession"'))).toBe(true);

    calls.length = 0;
    prismaMock.$queryRaw.mockImplementation(async (arg: unknown) => {
      const q = arg as Prisma.Sql;
      calls.push(q.sql);
      return [authenticatedRow({ lastActivityAt: new Date() })];
    });
    await resolveAdminSession("sid");
    expect(calls.some((s) => s.includes('UPDATE "AdminSession"'))).toBe(false);
  });
});

describe("promoteAdminSession — rotation after password + 2FA", () => {
  it("returns a DIFFERENT session id and revokes the pending one atomically", async () => {
    const seen = captureQueries();
    prismaMock.$queryRaw.mockImplementation(async (arg: unknown) => {
      const q = arg as Prisma.Sql;
      seen.push({ sql: q.sql, values: [...q.values] });
      return [{ adminUsername: "root", authenticatedAt: new Date(Date.now() - 30_000) }];
    });
    const result = await promoteAdminSession("pending-sid");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sessionId).not.toBe("pending-sid");
    expect(result.username).toBe("root");

    const q = seen[seen.length - 1]!;
    // One statement: revoke the pending row AND insert the rotated one.
    expect(q.sql).toContain("WITH promoted");
    expect(q.sql).toContain("rotated_after_two_factor");
    expect(q.sql).toContain('INSERT INTO "AdminSession"');
    expect(q.sql).toContain("'AUTHENTICATED'");
    // Eligibility is enforced in SQL, so a replayed id cannot be promoted.
    expect(q.sql).toContain("'PENDING'");
    expect(q.sql).toContain('"revokedAt" IS NULL');
    // Neither the old nor the new raw id is a parameter.
    expect(JSON.stringify(q.values)).not.toContain("pending-sid");
    expect(JSON.stringify(q.values)).not.toContain(result.sessionId);
  });

  it("REFUSES when the pending row was already promoted, revoked or expired", async () => {
    prismaMock.$queryRaw.mockResolvedValue([]);
    const result = await promoteAdminSession("pending-sid");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("pending_two_factor");
  });

  it("FAILS CLOSED when the store throws", async () => {
    prismaMock.$queryRaw.mockRejectedValue(new Error("db down"));
    const result = await promoteAdminSession("pending-sid");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("indeterminate");
  });
});

describe("revocation", () => {
  it("revokeAdminSession reports whether a live row was actually revoked", async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ id: "x" }]);
    expect(await revokeAdminSession("sid", "logout")).toBe(true);
    prismaMock.$queryRaw.mockResolvedValue([]);
    expect(await revokeAdminSession("sid", "logout")).toBe(false);
  });

  it("revokeAdminSession only touches rows that are still live", async () => {
    const seen = captureQueries();
    await revokeAdminSession("sid", "logout");
    const q = seen[seen.length - 1]!;
    expect(q.sql).toContain('UPDATE "AdminSession"');
    expect(q.sql).toContain('"revokedAt" IS NULL');
    expect(q.values).toContain("logout");
  });
});

describe("pruneExpiredAdminSessions — maintenance, not authorization", () => {
  it("deletes only rows dead longer than the retention window, in bounded batches", async () => {
    const seen = captureQueries();
    prismaMock.$queryRaw.mockImplementation(async (arg: unknown) => {
      const q = arg as Prisma.Sql;
      seen.push({ sql: q.sql, values: [...q.values] });
      return [{ id: "a" }, { id: "b" }];
    });
    const now = new Date("2026-09-08T00:00:00.000Z");
    const removed = await pruneExpiredAdminSessions({ now, limit: 100 });
    expect(removed).toBe(2);
    const q = seen[seen.length - 1]!;
    expect(q.sql).toContain('DELETE FROM "AdminSession"');
    expect(q.sql).toContain("LIMIT");
    const cutoff = q.values.find((v) => v instanceof Date) as Date;
    expect(cutoff.getTime()).toBe(now.getTime() - ADMIN_SESSION_RETENTION_MS);
    expect(q.values).toContain(100);
  });

  it("never throws when the store is down (cleanup must not break the lane)", async () => {
    prismaMock.$queryRaw.mockRejectedValue(new Error("db down"));
    await expect(pruneExpiredAdminSessions()).resolves.toBe(0);
  });

  it("accepts the worker's own client so cleanup needs no second pool", async () => {
    const client = { $queryRaw: vi.fn(async () => [{ id: "a" }]) };
    await expect(pruneExpiredAdminSessions({ client })).resolves.toBe(1);
    expect(client.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
  });
});

describe("cookie-aware wrappers", () => {
  it("beginAdminSession writes a PENDING cookie that carries NO admin role", async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ id: "stored" }]);
    const r = await beginAdminSession({ username: "root" });
    expect(r.ok).toBe(true);
    expect(sessionState.data.adminAuthStage).toBe("PENDING");
    expect(sessionState.data.role).toBeUndefined();
    expect(typeof sessionState.data.adminSessionId).toBe("string");
    expect(sessionState.saves).toBe(1);
  });

  it("beginAdminSession refuses when the store is unreachable", async () => {
    prismaMock.$queryRaw.mockRejectedValue(new Error("db down"));
    const r = await beginAdminSession({ username: "root" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("store_unavailable");
    expect(sessionState.data.adminSessionId).toBeUndefined();
  });

  it("completeAdminTwoFactor is the only thing that grants the ADMIN role", async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ id: "stored" }]);
    await beginAdminSession({ username: "root" });
    const pendingId = sessionState.data.adminSessionId as string;
    expect(sessionState.data.role).toBeUndefined();

    prismaMock.$queryRaw.mockResolvedValue([
      { adminUsername: "root", authenticatedAt: new Date(Date.now() - 30_000) },
    ]);
    const done = await completeAdminTwoFactor();
    expect(done.ok).toBe(true);
    expect(sessionState.data.role).toBe("ADMIN");
    expect(sessionState.data.adminAuthStage).toBe("AUTHENTICATED");
    // Rotated: the cookie no longer carries the pending id.
    expect(sessionState.data.adminSessionId).not.toBe(pendingId);
  });

  it("completeAdminTwoFactor leaves the cookie unprivileged when promotion fails", async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ id: "stored" }]);
    await beginAdminSession({ username: "root" });
    prismaMock.$queryRaw.mockResolvedValue([]); // pending row not eligible
    const done = await completeAdminTwoFactor();
    expect(done.ok).toBe(false);
    expect(sessionState.data.role).toBeUndefined();
    expect(sessionState.data.adminAuthStage).toBe("PENDING");
  });

  it("completeAdminTwoFactor refuses when there is no pending session at all", async () => {
    const done = await completeAdminTwoFactor();
    expect(done.ok).toBe(false);
    if (!done.ok) expect(done.reason).toBe("no_server_session");
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
  });

  it("getPendingAdminSession exposes the mid-sign-in account without trusting the client", async () => {
    sessionState.data.adminSessionId = "sid";
    prismaMock.$queryRaw.mockResolvedValue([
      authenticatedRow({ stage: "PENDING", twoFactorVerifiedAt: null, adminUsername: "root" }),
    ]);
    const pending = await getPendingAdminSession();
    expect(pending?.username).toBe("root");

    // An already-promoted session is not "pending" any more.
    prismaMock.$queryRaw.mockResolvedValue([authenticatedRow()]);
    expect(await getPendingAdminSession()).toBeNull();
  });

  it("revokeCurrentAdminSession is a no-op for a session with no admin id", async () => {
    expect(await revokeCurrentAdminSession("logout")).toBe(false);
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
  });

  it("revokeCurrentAdminSession revokes the row behind the current cookie", async () => {
    sessionState.data.adminSessionId = "sid";
    prismaMock.$queryRaw.mockResolvedValue([{ id: "stored" }]);
    expect(await revokeCurrentAdminSession("logout")).toBe(true);
  });
});
