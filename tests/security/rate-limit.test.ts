import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { RATE_POLICIES, pruneExpiredRateLimits, rateLimit } from "@/lib/security/rate-limit";

beforeEach(() => {
  resetPrismaMock();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("RATE_POLICIES", () => {
  it("includes every policy referenced in the spec", () => {
    const expected = [
      "publicRead",
      "search",
      "login",
      "register",
      "passwordReset",
      "emailVerification",
      "adminLogin",
      "userWrite",
      "savedItem",
      "goalWrite",
      "profileWrite",
      "mediaUpload",
      "adminWrite",
      "ingestionTrigger",
    ];
    for (const name of expected) {
      expect(RATE_POLICIES).toHaveProperty(name);
    }
  });
});

describe("rateLimit (DB path)", () => {
  it("returns ok=true and decrements remaining when count is below max", async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ count: 1, resetAt: new Date(Date.now() + 60_000) }]);
    const policy = { windowMs: 60_000, max: 5 };
    const result = await rateLimit("user:1:login", policy, { ipAddress: "1.2.3.4", userId: "u1" });
    expect(result.ok).toBe(true);
    expect(result.remaining).toBe(4);
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it("returns ok=false with 0 remaining when count exceeds max", async () => {
    const resetAt = new Date(Date.now() + 30_000);
    prismaMock.$queryRaw.mockResolvedValue([{ count: 6, resetAt }]);
    const result = await rateLimit("user:1:login", { windowMs: 60_000, max: 5 });
    expect(result.ok).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.resetAt).toBe(resetAt.getTime());
  });

  it("treats count exactly at max as the last allowed request (remaining=0, ok=true)", async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ count: 5, resetAt: new Date(Date.now() + 60_000) }]);
    const result = await rateLimit("k", { windowMs: 60_000, max: 5 });
    expect(result.ok).toBe(true);
    expect(result.remaining).toBe(0);
  });
});

describe("rateLimit (memory fallback)", () => {
  it("falls back to in-memory counting when the DB throws", async () => {
    prismaMock.$queryRaw.mockRejectedValue(new Error("DB down"));
    const policy = { windowMs: 60_000, max: 2 };
    const key = `mem-fallback-${Math.random()}`;

    const r1 = await rateLimit(key, policy);
    const r2 = await rateLimit(key, policy);
    const r3 = await rateLimit(key, policy);

    expect(r1.ok).toBe(true);
    expect(r1.remaining).toBe(1);
    expect(r2.ok).toBe(true);
    expect(r2.remaining).toBe(0);
    expect(r3.ok).toBe(false);
    expect(r3.remaining).toBe(0);
  });

  it("memory fallback resets after the window expires", async () => {
    prismaMock.$queryRaw.mockRejectedValue(new Error("DB down"));
    const policy = { windowMs: 50, max: 1 };
    const key = `mem-fallback-window-${Math.random()}`;

    const first = await rateLimit(key, policy);
    expect(first.ok).toBe(true);

    const blocked = await rateLimit(key, policy);
    expect(blocked.ok).toBe(false);

    await new Promise((r) => setTimeout(r, 70));

    const afterWindow = await rateLimit(key, policy);
    expect(afterWindow.ok).toBe(true);
  });

  it("falls back to memory when the DB returns no rows", async () => {
    prismaMock.$queryRaw.mockResolvedValue([]);
    const policy = { windowMs: 60_000, max: 1 };
    const key = `db-empty-${Math.random()}`;
    const result = await rateLimit(key, policy);
    expect(result.ok).toBe(true);
    expect(result.remaining).toBe(0);
  });
});

describe("pruneExpiredRateLimits", () => {
  it("returns the deleted row count", async () => {
    prismaMock.rateLimitBucket.deleteMany.mockResolvedValue({ count: 17 });
    const now = new Date("2026-01-01T00:00:00Z");
    const count = await pruneExpiredRateLimits(now);
    expect(count).toBe(17);

    const args = prismaMock.rateLimitBucket.deleteMany.mock.calls[0][0] as {
      where: { resetAt: { lt: Date } };
    };
    expect(args.where.resetAt.lt.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });

  it("returns 0 when the DB throws (does not propagate errors to callers)", async () => {
    prismaMock.rateLimitBucket.deleteMany.mockRejectedValue(new Error("connection refused"));
    expect(await pruneExpiredRateLimits()).toBe(0);
  });
});
