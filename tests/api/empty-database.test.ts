import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";
import { createCookieJar } from "../helpers/cookies-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

const cookieJar = createCookieJar();
vi.mock("next/headers", () => ({
  cookies: () => cookieJar,
  headers: () => new Headers(),
}));

// Force the rate limit to always allow during these tests so we're testing
// the empty-DB code path, not the rate limiter.
vi.mock("@/lib/security/rate-limit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/security/rate-limit")>(
    "@/lib/security/rate-limit",
  );
  return {
    ...actual,
    rateLimit: vi.fn(async () => ({ ok: true, remaining: 100, resetAt: Date.now() + 60_000 })),
  };
});

beforeEach(() => {
  resetPrismaMock();
  // Default: every model.findMany returns []. Tests assume empty DB.
  type Findable = { findMany?: ReturnType<typeof vi.fn>; count?: ReturnType<typeof vi.fn> };
  const m = prismaMock as unknown as Record<string, Findable>;
  for (const model of [
    "prayer",
    "saint",
    "marianApparition",
    "parish",
    "devotion",
    "liturgyEntry",
    "spiritualLifeGuide",
    "dailyLiturgy",
  ]) {
    m[model] = { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) };
  }
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function makeReq(url: string): NextRequest {
  return new NextRequest(new Request(url));
}

describe("Public content APIs against an empty database", () => {
  it("/api/prayers returns 200 with an empty items array (no crash)", async () => {
    const { GET } = await import("@/app/api/prayers/route");
    const res = await GET(makeReq("https://x.test/api/prayers"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toEqual([]);
  });

  it("/api/saints returns 200 with an empty items array", async () => {
    const { GET } = await import("@/app/api/saints/route");
    const res = await GET(makeReq("https://x.test/api/saints"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toEqual([]);
  });

  it("/api/apparitions returns 200 with an empty items array", async () => {
    const { GET } = await import("@/app/api/apparitions/route");
    const res = await GET(makeReq("https://x.test/api/apparitions"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toEqual([]);
  });

  it("/api/devotions returns 200 with an empty items array", async () => {
    const { GET } = await import("@/app/api/devotions/route");
    const res = await GET(makeReq("https://x.test/api/devotions"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toEqual([]);
  });
});
