/**
 * SCOPE regression suite for the admin second factor.
 *
 * The security brief draws one hard line: 2FA is for a HUMAN administrator at
 * the interactive admin interface, and for nobody else. Never an ordinary user
 * account. Never the Admin Worker, a cron job, a scheduled task or any other
 * machine path — a worker that had to read a mailbox would stop being
 * autonomous, and the worker is running against production right now.
 *
 * WHAT THIS ADDS OVER THE EXISTING SUITES
 * ---------------------------------------
 * tests/security/admin-2fa-worker-exempt.test.ts greps the worker source tree
 * for mentions of the challenge module. That catches a direct import, but a
 * grep cannot see a dependency acquired two or three modules deep — worker →
 * some helper → `@/lib/auth` barrel → `admin-2fa`. So this file walks the
 * actual import graph transitively from the worker entry points and proves the
 * challenge module is not reachable at all, and that the admin-session store —
 * which IS in the graph, because the worker's reporting wrapper delegates to
 * `requireAdmin()` — is reachable only through the read-only authorization
 * check, with nothing in the worker's reach able to begin, promote or complete
 * a sign-in.
 *
 * The other half is behavioural: an ordinary user really signs in here, over
 * the real `/api/auth/login` route and real iron-session cookies, and the
 * assertions are that no challenge row appears, no admin session appears, the
 * cookie carries none of the admin fields, and `requireAdmin()` refuses the
 * signed-in user.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { NextRequest } from "next/server";

import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";
import { createCookieJar } from "../helpers/cookies-mock";

const REPO_ROOT = resolve(__dirname, "..", "..");
const SRC = join(REPO_ROOT, "src");

/* ------------------------------------------------------------------ */
/* Boundaries                                                          */
/* ------------------------------------------------------------------ */

const cookieJar = createCookieJar();
vi.mock("next/headers", () => ({ cookies: async () => cookieJar }));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

vi.mock("@/lib/security/rate-limit", () => ({
  RATE_POLICIES: { login: { windowMs: 900_000, max: 10 } },
  rateLimit: async () => ({ ok: true, remaining: 10, resetAt: 0 }),
}));

const securityReports: Array<Record<string, unknown>> = [];
vi.mock("@/lib/security/security-events", () => ({
  reportSuspiciousActivity: async (p: Record<string, unknown>) => {
    securityReports.push(p);
  },
  reportSecurityBreach: async (p: Record<string, unknown>) => {
    securityReports.push(p);
  },
}));

/** No mail may leave the building on an ordinary user's sign-in. */
const sentEmails: unknown[] = [];
vi.mock("@/lib/email/resend", () => ({
  isEmailConfigured: () => true,
  sendTransactionalEmail: async (msg: unknown) => {
    sentEmails.push(msg);
    return { ok: true, delivery: "sent" };
  },
}));

vi.mock("@/lib/data/profile", () => ({ getProfileForUser: async () => null }));

/** Every raw statement the request produced, so a challenge write would show. */
const statements: string[] = [];

const USER_PASSWORD = "Correct-Horse-1!";

function makeLoginRequest(email: string, password: string): NextRequest {
  const url = "http://localhost:3000/api/auth/login";
  const base = new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      origin: "http://localhost:3000",
      host: "localhost:3000",
      "x-forwarded-for": "198.51.100.7",
      "user-agent": "Mozilla/5.0 (Macintosh) Safari/605",
    },
    body: new URLSearchParams({ email, password }).toString(),
  });
  return Object.assign(base, {
    nextUrl: new URL(url),
    cookies: { get: () => undefined },
  }) as unknown as NextRequest;
}

beforeEach(() => {
  resetPrismaMock();
  cookieJar.__entries.clear();
  statements.length = 0;
  sentEmails.length = 0;
  securityReports.length = 0;
  prismaMock.$queryRaw.mockImplementation(async (arg: unknown) => {
    statements.push((arg as { sql: string }).sql);
    return [];
  });
  process.env.SESSION_SECRET = "test-session-secret-must-be-32-chars-long";
  process.env.ADMIN_USERNAME = "root";
  process.env.ADMIN_PASSWORD = "an-admin-password-value";
});

/* ================================================================== */
/* Ordinary users                                                      */
/* ================================================================== */

describe("an ordinary user signs in exactly as before", () => {
  async function signInUser(): Promise<Response> {
    const { hashPassword } = await import("@/lib/auth/password");
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "pilgrim@example.com",
      firstName: "Pilgrim",
      lastName: "Example",
      role: "USER",
      language: null,
      passwordHash: await hashPassword(USER_PASSWORD),
    });
    const { POST } = await import("@/app/api/auth/login/route");
    return POST(makeLoginRequest("pilgrim@example.com", USER_PASSWORD));
  }

  it("is signed in by password alone — no code, no second stage", async () => {
    const res = await signInUser();

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("/profile");
    expect(res.headers.get("location")).not.toContain("stage=code");
    expect(sentEmails).toHaveLength(0);
  });

  it("gets a USER session carrying none of the admin two-factor fields", async () => {
    await signInUser();
    const { getSession } = await import("@/lib/auth/session");
    const session = await getSession();

    expect(session.role).toBe("USER");
    expect(session.userId).toBe("user-1");
    // The fields that drive the admin challenge must be entirely absent —
    // present-but-empty would still put an ordinary user in the flow.
    expect(session.adminSessionId).toBeUndefined();
    expect(session.adminAuthStage).toBeUndefined();
    expect(session.adminSignedInAt).toBeUndefined();
  });

  it("creates no admin session row and no challenge row", async () => {
    await signInUser();
    const touched = statements.join("\n");
    expect(touched).not.toContain("AdminTwoFactorChallenge");
    expect(touched).not.toContain("AdminSession");
  });

  it("is not an administrator, however valid the user session is", async () => {
    await signInUser();
    const { requireAdmin } = await import("@/lib/auth/admin");
    expect(await requireAdmin()).toBeNull();
  });

  it("a failed user login also never opens a challenge", async () => {
    const { hashPassword } = await import("@/lib/auth/password");
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "pilgrim@example.com",
      firstName: "Pilgrim",
      lastName: "Example",
      role: "USER",
      language: null,
      passwordHash: await hashPassword(USER_PASSWORD),
    });
    const { POST } = await import("@/app/api/auth/login/route");
    const res = await POST(makeLoginRequest("pilgrim@example.com", "wrong-password"));

    expect(res.headers.get("location")).toContain("error=invalid");
    expect(statements.join("\n")).not.toContain("AdminTwoFactorChallenge");
    expect(sentEmails).toHaveLength(0);
  });
});

/* ================================================================== */
/* Static scope checks                                                 */
/* ================================================================== */

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const TWO_FACTOR_MODULES = ["auth/admin-2fa", "auth/admin-session"];

function importsTwoFactor(source: string): boolean {
  return TWO_FACTOR_MODULES.some((m) => source.includes(m));
}

describe("no ordinary-user surface can reach the admin challenge", () => {
  const userAuthRoutes = walk(join(SRC, "app", "api", "auth")).filter(
    (f) => !f.includes(`${join("api", "auth", "admin-2fa")}`),
  );

  it("finds the user-facing auth routes (guards against an empty scan)", () => {
    expect(userAuthRoutes.length).toBeGreaterThan(3);
  });

  it("none of them imports the challenge or the admin session store", () => {
    const offenders = userAuthRoutes.filter((f) => importsTwoFactor(readFileSync(f, "utf8")));
    // /api/auth/logout legitimately revokes an admin session on sign-out; it
    // is the one file allowed to name the store, and it still never issues or
    // verifies a code.
    const allowed = new Set([join(SRC, "app", "api", "auth", "logout", "route.ts")]);
    expect(offenders.filter((f) => !allowed.has(f))).toEqual([]);
    for (const f of offenders) {
      expect(readFileSync(f, "utf8")).not.toContain("admin-2fa");
    }
  });

  it("the user login, register, reset and verify routes name no code at all", () => {
    for (const name of ["login", "register", "reset-password", "forgot-password", "verify-email"]) {
      const file = join(SRC, "app", "api", "auth", name, "route.ts");
      if (!existsSync(file)) continue;
      const source = readFileSync(file, "utf8");
      expect(source).not.toContain("TwoFactor");
      expect(source).not.toContain("admin-2fa");
    }
  });
});

/* ================================================================== */
/* The Admin Worker                                                    */
/* ================================================================== */

/**
 * Resolve one relative/aliased import specifier to a file on disk. Only the
 * project's own modules matter — a node_modules package cannot reach back
 * into `src/lib/auth`.
 */
function resolveImport(fromFile: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = join(SRC, spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(fromFile), spec);
  else return null;
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ]) {
    if (existsSync(candidate) && /\.(ts|tsx)$/.test(candidate)) return candidate;
  }
  return null;
}

const IMPORT_RE = /(?:from\s+|import\s*\(\s*)["']([^"']+)["']/g;

/** Every project file transitively reachable from `entries`. */
function reachableFrom(entries: string[]): Set<string> {
  const seen = new Set<string>();
  const queue = entries.filter((f) => existsSync(f));
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(IMPORT_RE)) {
      const target = resolveImport(file, match[1]!);
      if (target && !seen.has(target)) queue.push(target);
    }
  }
  return seen;
}

describe("the Admin Worker cannot reach the second factor, even transitively", () => {
  const workerEntries = [
    join(REPO_ROOT, "scripts", "run-worker.ts"),
    join(REPO_ROOT, "scripts", "local-worker-host.ts"),
  ].filter((f) => existsSync(f));

  const reachable = reachableFrom(workerEntries);

  it("finds the worker entry point and a substantial module graph", () => {
    expect(workerEntries.length).toBeGreaterThan(0);
    // A graph that collapsed to a handful of files would make every
    // assertion below vacuously true.
    expect(reachable.size).toBeGreaterThan(50);
  });

  it("the challenge module is not reachable from the worker", () => {
    const twoFactor = join(SRC, "lib", "auth", "admin-2fa.ts");
    expect(existsSync(twoFactor)).toBe(true);
    expect(reachable.has(twoFactor)).toBe(false);
  });

  it("the session store is reachable ONLY through the read-only admin check", () => {
    // The worker's reporting wrapper (admin-route-guard.ts) delegates to
    // requireAdmin(), which necessarily pulls in the store — so the store IS
    // in the graph, and pretending otherwise would be a false guarantee. What
    // must hold is that the ONLY importer inside the worker's graph is
    // src/lib/auth/admin.ts, which can only READ a session. Nothing in the
    // worker's reach can begin, promote or complete one.
    const store = join(SRC, "lib", "auth", "admin-session.ts");
    expect(existsSync(store)).toBe(true);

    const importers = [...reachable].filter((f) => {
      if (f === store) return false;
      const source = readFileSync(f, "utf8");
      return /from\s+["'][^"']*(?:auth\/)?admin-session["']/.test(source);
    });
    expect(importers).toEqual([join(SRC, "lib", "auth", "admin.ts")]);

    const adminSource = readFileSync(join(SRC, "lib", "auth", "admin.ts"), "utf8");
    for (const granting of [
      "beginAdminSession",
      "promoteAdminSession",
      "completeAdminTwoFactor",
      "createPendingAdminSession",
      "getPendingAdminSession",
    ]) {
      expect(adminSource).not.toContain(granting);
    }
  });

  it("no file in the worker's reach can grant or advance an admin sign-in", () => {
    const granting =
      /\b(beginAdminSession|promoteAdminSession|completeAdminTwoFactor|createPendingAdminSession|getPendingAdminSession|issueAdminTwoFactorChallenge|verifyAdminTwoFactorCode)\b/;
    const store = join(SRC, "lib", "auth", "admin-session.ts");
    const offenders = [...reachable]
      // The store DEFINES these; the point is that nothing reachable CALLS them.
      .filter((f) => f !== store)
      .filter((f) => granting.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("neither are the interactive admin sign-in routes", () => {
    for (const route of [
      join(SRC, "app", "api", "admin", "login", "route.ts"),
      join(SRC, "app", "api", "auth", "admin-2fa", "verify", "route.ts"),
      join(SRC, "app", "api", "auth", "admin-2fa", "resend", "route.ts"),
    ]) {
      expect(existsSync(route)).toBe(true);
      expect(reachable.has(route)).toBe(false);
    }
  });

  it("the detector would actually fire — a module the worker DOES use is reachable", () => {
    // Negative control: without this, an over-eager resolver that found
    // nothing would make the three assertions above meaningless.
    const dbClient = join(SRC, "lib", "db", "client.ts");
    expect(existsSync(dbClient)).toBe(true);
    expect(reachable.has(dbClient)).toBe(true);
  });

  it("the worker's own machine authentication does not involve a code", () => {
    const cronAuth = readFileSync(join(SRC, "lib", "security", "cron-auth.ts"), "utf8");
    expect(cronAuth).not.toContain("TwoFactor");
    expect(cronAuth).not.toContain("admin-2fa");
    expect(cronAuth).not.toContain("admin-session");
  });
});
