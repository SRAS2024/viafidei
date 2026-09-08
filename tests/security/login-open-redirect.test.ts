/**
 * `next=` on the sign-in routes must never leave the site.
 *
 * Both login and register resolve their post-sign-in destination through
 * `redirectTo(req, path)`, which does `new URL(path, origin)`. A bare
 * "starts with /" check passes "//evil.com" and "/\evil.com", and BOTH of
 * those resolve to a third-party origin — a working open redirect on a
 * successful authentication, which is exactly the shape phishing wants
 * (the victim really did sign in, then lands off-site).
 *
 * The account-gated Favorite control only ever emits usePathname(), so this
 * was not reachable through the UI; a hand-crafted link is enough.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticateMock = vi.fn();
const sessionSaveMock = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/auth", () => ({
  authenticate: (...args: unknown[]) => authenticateMock(...args),
  loginSchema: {
    safeParse: (v: { email: string; password: string }) =>
      typeof v.email === "string" && v.email.includes("@") && v.password
        ? { success: true, data: v }
        : { success: false },
  },
  getSession: vi.fn().mockResolvedValue({ save: sessionSaveMock }),
}));
vi.mock("@/lib/security/rate-limit", () => ({
  rateLimit: vi.fn().mockResolvedValue({ ok: true, remaining: 10, resetAt: Date.now() + 60_000 }),
  RATE_POLICIES: { login: { max: 50, windowMs: 900_000 } },
}));
vi.mock("@/lib/security/security-events", () => ({
  reportSecurityBreach: vi.fn().mockResolvedValue(undefined),
  reportSuspiciousActivity: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/data/profile", () => ({
  getProfileForUser: vi.fn().mockResolvedValue(null),
}));
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ set: vi.fn() }),
}));

import type { NextRequest } from "next/server";

async function login(next: string): Promise<string> {
  const { POST } = await import("@/app/api/auth/login/route");
  const base = new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-forwarded-for": "203.0.113.50",
    },
    body: new URLSearchParams({ email: "user@example.com", password: "correct", next }).toString(),
  });
  const req = Object.assign(base, {
    cookies: { get: () => undefined },
  }) as unknown as NextRequest;
  const res = await POST(req);
  return res.headers.get("location") ?? "";
}

beforeEach(() => {
  authenticateMock.mockReset().mockResolvedValue({
    id: "u1",
    email: "user@example.com",
    firstName: "Test",
    lastName: "User",
    language: "en",
  });
});

describe("login `next=` cannot redirect off-site", () => {
  it("keeps a same-site path", async () => {
    expect(await login("/parishes/st-marys")).toContain("/parishes/st-marys");
  });

  it.each([
    ["protocol-relative", "//evil.com"],
    ["backslash form", "/\\evil.com"],
    ["absolute URL", "https://evil.com"],
    ["scheme-only", "evil.com"],
    ["javascript URL", "javascript:alert(1)"],
  ])("refuses %s and falls back to /profile", async (_label, hostile) => {
    const location = await login(hostile);
    expect(location).not.toContain("evil.com");
    expect(location).not.toContain("javascript:");
    // Resolve it the way redirectTo() does: the destination must stay on our
    // own origin, not merely "look" relative.
    expect(new URL(location, "http://localhost").origin).toBe("http://localhost");
    expect(location).toContain("/profile");
  });
});
