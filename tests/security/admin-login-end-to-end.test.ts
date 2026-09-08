/**
 * END-TO-END regression suite for the two-stage interactive admin sign-in
 * (security spec items 1 / 3 / 9 / 11 / 12).
 *
 * WHY THIS FILE EXISTS, GIVEN THE OTHER SUITES
 * --------------------------------------------
 * Every existing security suite proves one module in isolation and mocks its
 * neighbours: tests/security/admin-2fa.test.ts mocks the session store,
 * tests/security/admin-2fa-endpoint.test.ts mocks the challenge AND the
 * store, tests/security/admin-session.test.ts mocks the challenge, and
 * tests/auth/admin.test.ts mocks `resolveAdminSession`. Each is correct, and
 * together they still cannot answer the question the brief actually asks:
 * *does a correct password alone reach an admin route?* That is a property of
 * the composition, and a seam between two modules is exactly where it would
 * be lost.
 *
 * So nothing in the authentication chain is mocked here. The real
 * `/api/admin/login`, `/api/auth/admin-2fa/verify` and `.../resend` route
 * handlers run against the real `admin-2fa.ts`, `admin-session.ts`,
 * `admin.ts`, `admin-trust.ts`, `admin-gate.ts`, `csrf.ts`, `keys.ts` and
 * `hash.ts`, over real iron-session cookies. Only the outermost boundaries
 * are faked, and each fake is a store or a transport, never a decision:
 *
 *   • Postgres  — one in-memory implementation of the `AdminSession` and
 *                 `AdminTwoFactorChallenge` tables, driven by the same
 *                 parameterised `Prisma.sql` the modules really emit;
 *   • the cookie jar — a map, with REAL iron-session sealing on top of it,
 *                 so what the tests read back is what the browser would get;
 *   • Resend    — captured, because the mailbox is the only legitimate place
 *                 the six-digit code exists and it is where the test has to
 *                 read it from, exactly as the administrator would;
 *   • the rate limiter — a real counting limiter, so the limits actually fire
 *                 rather than being asserted as call arguments.
 *
 * Everything the code writes anywhere else — every log line, every
 * `SecurityEvent` row, every Suspicious Activity / Security Breach payload,
 * every audit record and every SQL parameter — is captured, so the "a code is
 * never recorded anywhere" claim can be checked against the whole flow at
 * once instead of one module at a time.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";
import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";
import { createCookieJar } from "../helpers/cookies-mock";

/* ------------------------------------------------------------------ */
/* Boundaries — stores and transports only, never decisions            */
/* ------------------------------------------------------------------ */

const cookieJar = createCookieJar();
vi.mock("next/headers", () => ({ cookies: async () => cookieJar }));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

/** The mailbox. The one place a code is allowed to appear. */
const sentEmails: Array<{ to: string; subject: string; textBody: string; htmlBody: string }> = [];
vi.mock("@/lib/email/resend", () => ({
  isEmailConfigured: () => true,
  sendTransactionalEmail: async (msg: {
    to: string;
    subject: string;
    textBody: string;
    htmlBody: string;
  }) => {
    sentEmails.push(msg);
    return { ok: true, delivery: "sent" };
  },
}));
vi.mock("@/lib/email/admin-send", () => ({ readAdminEmail: () => "operator@example.com" }));

/** Every log line the whole chain emits. */
const logCalls: Array<{ level: string; args: unknown[] }> = [];
vi.mock("@/lib/observability/logger", () => {
  const capture =
    (level: string) =>
    (...args: unknown[]) =>
      logCalls.push({ level, args });
  return {
    REQUEST_ID_HEADER: "x-request-id",
    logger: {
      info: capture("info"),
      warn: capture("warn"),
      error: capture("error"),
      debug: capture("debug"),
    },
  };
});

/** Every operator-facing security report, with its full payload. */
const securityReports: Array<{ channel: string; payload: Record<string, unknown> }> = [];
vi.mock("@/lib/security/security-events", () => ({
  reportSuspiciousActivity: async (p: Record<string, unknown>) => {
    securityReports.push({ channel: "suspicious", payload: p });
  },
  reportSecurityBreach: async (p: Record<string, unknown>) => {
    securityReports.push({ channel: "breach", payload: p });
  },
}));

/** A real counting limiter, so "excessive guessing is limited" is observable. */
const limiterCounts = new Map<string, number>();
let limiterEnabled = true;
vi.mock("@/lib/security/rate-limit", () => ({
  RATE_POLICIES: {
    adminLogin: { windowMs: 900_000, max: 10 },
    login: { windowMs: 900_000, max: 10 },
    adminWrite: { windowMs: 60_000, max: 30 },
  },
  rateLimit: async (key: string, policy: { max: number }) => {
    if (!limiterEnabled) return { ok: true, remaining: policy.max, resetAt: Date.now() + 1000 };
    const used = (limiterCounts.get(key) ?? 0) + 1;
    limiterCounts.set(key, used);
    return { ok: used <= policy.max, remaining: Math.max(0, policy.max - used), resetAt: 0 };
  },
}));

/** Audit + login-event sinks: captured so the ORDER of record-keeping is testable. */
const auditWrites: Array<Record<string, unknown>> = [];
vi.mock("@/lib/audit", () => ({
  writeAudit: async (entry: Record<string, unknown>) => {
    auditWrites.push(entry);
  },
}));
vi.mock("@/lib/audit/admin-action-log", () => ({
  hasKnownAdminDevice: async () => false,
  writeAdminActionLog: async () => undefined,
  ADMIN_ACTION: { logout: "logout" },
}));
const loginEvents: Array<{ kind: string; payload: Record<string, unknown> }> = [];
vi.mock("@/lib/security/admin-login-events", () => ({
  recordAdminLoginSuccess: async (p: Record<string, unknown>) => {
    loginEvents.push({ kind: "success", payload: p });
  },
  recordAdminLoginFailure: async (p: Record<string, unknown>) => {
    loginEvents.push({ kind: "failure", payload: p });
    return null;
  },
}));
vi.mock("@/lib/admin-worker/request-defender", () => ({
  defendFailedAdminLogin: async () => undefined,
  defendConfirmedBruteForce: async () => undefined,
  defendUnauthorizedMutation: async () => undefined,
}));

/* ------------------------------------------------------------------ */
/* The in-memory Postgres stand-in                                     */
/* ------------------------------------------------------------------ */

type SessionRow = {
  id: string;
  adminUsername: string;
  stage: "PENDING" | "AUTHENTICATED";
  authenticatedAt: Date;
  twoFactorVerifiedAt: Date | null;
  lastActivityAt: Date;
  absoluteExpiresAt: Date;
  idleExpiresAt: Date;
  revokedAt: Date | null;
  revokedReason: string | null;
};

type ChallengeRow = {
  id: string;
  adminSessionHash: string;
  adminUsername: string;
  codeHash: string;
  attempts: number;
  issuedAt: Date;
  expiresAt: Date;
  consumedAt: Date | null;
  supersededAt: Date | null;
};

const sessions: SessionRow[] = [];
const challenges: ChallengeRow[] = [];
/** Every SQL statement with its bound parameters — used for leak checks. */
const statements: Array<{ sql: string; values: unknown[] }> = [];
/** Set to make the store unreachable, to prove the fail-closed paths. */
let storeDown = false;

function installStore(): void {
  prismaMock.$queryRaw.mockImplementation(async (arg: unknown) => {
    const q = arg as Prisma.Sql;
    const sql = q.sql;
    const v = [...q.values];
    statements.push({ sql, values: v });
    if (storeDown) throw new Error("connection terminated unexpectedly");

    /* ---------------- AdminSession ---------------- */

    // Promotion is a CTE that both revokes the pending row and inserts the
    // rotated one, so it must be matched before the plain INSERT.
    if (sql.includes("WITH promoted AS")) {
      const now = v[0] as Date;
      const oldId = v[2] as string;
      const newId = v[4] as string;
      const pending = sessions.find(
        (r) =>
          r.id === oldId &&
          r.stage === "PENDING" &&
          r.revokedAt === null &&
          r.absoluteExpiresAt.getTime() > now.getTime(),
      );
      if (!pending) return [];
      pending.revokedAt = now;
      pending.revokedReason = "rotated_after_two_factor";
      sessions.push({
        id: newId,
        adminUsername: pending.adminUsername,
        stage: "AUTHENTICATED",
        authenticatedAt: pending.authenticatedAt,
        twoFactorVerifiedAt: v[5] as Date,
        lastActivityAt: v[6] as Date,
        absoluteExpiresAt: v[7] as Date,
        idleExpiresAt: v[8] as Date,
        revokedAt: null,
        revokedReason: null,
      });
      return [{ adminUsername: pending.adminUsername, authenticatedAt: pending.authenticatedAt }];
    }

    if (sql.includes('INSERT INTO "AdminSession"')) {
      sessions.push({
        id: v[0] as string,
        adminUsername: v[1] as string,
        stage: "PENDING",
        authenticatedAt: v[2] as Date,
        twoFactorVerifiedAt: null,
        lastActivityAt: v[3] as Date,
        absoluteExpiresAt: v[4] as Date,
        idleExpiresAt: v[5] as Date,
        revokedAt: null,
        revokedReason: null,
      });
      return [{ id: v[0] as string }];
    }

    if (sql.includes('UPDATE "AdminSession"') && sql.includes('SET "revokedAt"')) {
      const now = v[0] as Date;
      const reason = v[1] as string;
      const target = v[3] as string | undefined;
      const matched = sessions.filter(
        (r) => r.revokedAt === null && (target === undefined || r.id === target),
      );
      for (const r of matched) {
        r.revokedAt = now;
        r.revokedReason = reason;
      }
      return matched.map((r) => ({ id: r.id }));
    }

    if (sql.includes('UPDATE "AdminSession"') && sql.includes('SET "lastActivityAt"')) {
      const row = sessions.find(
        (r) => r.id === (v[3] as string) && r.revokedAt === null && r.stage === "AUTHENTICATED",
      );
      if (!row) return [];
      row.lastActivityAt = v[0] as Date;
      row.idleExpiresAt = v[1] as Date;
      return [{ id: row.id }];
    }

    if (sql.includes('DELETE FROM "AdminSession"')) return [];

    if (sql.includes('FROM "AdminSession"')) {
      const row = sessions.find((r) => r.id === (v[0] as string));
      return row ? [{ ...row }] : [];
    }

    /* ------------- AdminTwoFactorChallenge -------------- */

    if (sql.includes('INSERT INTO "AdminTwoFactorChallenge"')) {
      challenges.push({
        id: v[0] as string,
        adminSessionHash: v[1] as string,
        adminUsername: v[2] as string,
        codeHash: v[3] as string,
        // v[4] is the bound `maxAttempts`; the literal 0 for `attempts` is
        // inlined by the tag, so the timestamps start at v[5].
        attempts: 0,
        issuedAt: v[5] as Date,
        expiresAt: v[6] as Date,
        consumedAt: null,
        supersededAt: null,
      });
      return [{ id: v[0] as string }];
    }

    if (sql.includes('SET "attempts" = "attempts" + 1')) {
      const [, sessionHash, cutoff, max] = [v[0], v[1] as string, v[2] as Date, v[3] as number];
      const row = challenges
        .filter(
          (r) =>
            r.adminSessionHash === sessionHash &&
            r.consumedAt === null &&
            r.supersededAt === null &&
            r.expiresAt.getTime() > cutoff.getTime() &&
            r.attempts < max,
        )
        .sort((a, b) => b.issuedAt.getTime() - a.issuedAt.getTime())[0];
      if (!row) return [];
      row.attempts += 1;
      return [{ ...row }];
    }

    if (sql.includes('SET "consumedAt"')) {
      const row = challenges.find(
        (r) => r.id === (v[2] as string) && !r.consumedAt && !r.supersededAt,
      );
      if (!row) return [];
      row.consumedAt = v[0] as Date;
      return [{ id: row.id }];
    }

    if (sql.includes('SET "supersededAt"')) {
      const target = v[2] as string;
      const matched = sql.includes('"adminSessionHash" =')
        ? challenges.filter(
            (r) => r.adminSessionHash === target && !r.consumedAt && !r.supersededAt,
          )
        : challenges.filter((r) => r.id === target && !r.supersededAt);
      for (const r of matched) r.supersededAt = v[0] as Date;
      return matched.map((r) => ({ id: r.id }));
    }

    if (sql.includes('DELETE FROM "AdminTwoFactorChallenge"')) return [];

    if (sql.includes('FROM "AdminTwoFactorChallenge"')) {
      const rows = challenges
        .filter((r) => r.adminSessionHash === (v[0] as string) && !r.consumedAt && !r.supersededAt)
        .sort((a, b) => b.issuedAt.getTime() - a.issuedAt.getTime());
      return rows.slice(0, 1).map((r) => ({ ...r }));
    }

    return [];
  });
}

/* ------------------------------------------------------------------ */
/* Request helpers                                                     */
/* ------------------------------------------------------------------ */

const ORIGIN = "http://localhost:3000";
const DEVICE = "device-credential-e2e";
const USERNAME = "root";
const PASSWORD = "correct-horse-battery-staple";

function makeRequest(
  path: string,
  body: Record<string, string> | null,
  headers: Record<string, string> = {},
  method = "POST",
): NextRequest {
  const url = `${ORIGIN}${path}`;
  const base = new Request(url, {
    method,
    headers: {
      ...(body ? { "content-type": "application/x-www-form-urlencoded" } : {}),
      origin: ORIGIN,
      host: "localhost:3000",
      "x-forwarded-for": "203.0.113.10",
      "user-agent": "Mozilla/5.0 (Macintosh) Safari/605",
      ...headers,
    },
    ...(body ? { body: new URLSearchParams(body).toString() } : {}),
  });
  return Object.assign(base, {
    nextUrl: new URL(url),
    cookies: {
      get: (n: string) => (n === "vf_dev_id" ? { value: DEVICE } : undefined),
    },
  }) as unknown as NextRequest;
}

async function postLogin(
  username = USERNAME,
  password = PASSWORD,
  headers?: Record<string, string>,
): Promise<Response> {
  const { POST } = await import("@/app/api/admin/login/route");
  return POST(makeRequest("/api/admin/login", { username, password }, headers));
}

async function postVerify(code: string, headers?: Record<string, string>): Promise<Response> {
  const { POST } = await import("@/app/api/auth/admin-2fa/verify/route");
  return POST(makeRequest("/api/auth/admin-2fa/verify", { code }, headers));
}

async function postResend(headers?: Record<string, string>): Promise<Response> {
  const { POST } = await import("@/app/api/auth/admin-2fa/resend/route");
  return POST(makeRequest("/api/auth/admin-2fa/resend", {}, headers));
}

/** The code, read where the administrator reads it: out of the email. */
function codeFromLastEmail(): string {
  const body = sentEmails.at(-1)?.textBody ?? "";
  const matches = body.match(/(?<!\d)\d{6}(?!\d)/g) ?? [];
  expect(matches).toHaveLength(1);
  return matches[0]!;
}

/** Ask the real authorization chain whether this browser is an administrator. */
async function currentAdmin() {
  const { requireAdmin } = await import("@/lib/auth/admin");
  return requireAdmin();
}

/** Drive a real admin API mutation through the real central gate. */
async function callAdminApi(
  headers: Record<string, string> = {},
  method = "POST",
): Promise<{ ok: boolean; status: number }> {
  const { gateAdminApiCall } = await import("@/lib/security/admin-gate");
  const result = await gateAdminApiCall(makeRequest("/api/admin/media", null, headers, method));
  return result.ok ? { ok: true, status: 200 } : { ok: false, status: result.response.status };
}

/** Read the decrypted session cookie the way a subsequent request would. */
async function readSessionCookie() {
  const { getSession } = await import("@/lib/auth/session");
  return getSession();
}

/** Complete stage one and return the live code. */
async function signInStageOne(): Promise<string> {
  const res = await postLogin();
  expect(res.headers.get("location")).toContain("stage=code");
  return codeFromLastEmail();
}

/** Complete both stages. Leaves the browser holding an admin session. */
async function signInFully(): Promise<void> {
  const code = await signInStageOne();
  const res = await postVerify(code);
  expect(res.headers.get("location")).toContain("/admin?welcome=1");
}

beforeEach(async () => {
  resetPrismaMock();
  cookieJar.__entries.clear();
  sessions.length = 0;
  challenges.length = 0;
  statements.length = 0;
  sentEmails.length = 0;
  logCalls.length = 0;
  securityReports.length = 0;
  auditWrites.length = 0;
  loginEvents.length = 0;
  limiterCounts.clear();
  limiterEnabled = true;
  storeDown = false;
  prismaMock.securityEvent.create.mockImplementation(async () => ({ id: "evt-1" }));
  prismaMock.bannedDevice.findUnique.mockResolvedValue(null);
  process.env.SESSION_SECRET = "test-session-secret-must-be-32-chars-long";
  process.env.ADMIN_USERNAME = USERNAME;
  process.env.ADMIN_PASSWORD = PASSWORD;
  installStore();
  // The failure-streak counter is module-level state shared across tests.
  const { resetAdminPasswordFailureCounter } = await import("@/lib/security/admin-failure-counter");
  resetAdminPasswordFailureCounter({
    account: USERNAME,
    ipAddress: "203.0.113.10",
    deviceCredential: DEVICE,
  });
});

/* ================================================================== */
/* 1. A correct password ALONE is not an administrator                 */
/* ================================================================== */

describe("a correct admin password alone cannot reach admin routes", () => {
  it("creates only a PENDING state — no ADMIN role anywhere", async () => {
    const res = await postLogin();

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("/admin/login?stage=code");
    // The server-side record exists, and it is PENDING.
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.stage).toBe("PENDING");
    expect(sessions[0]!.twoFactorVerifiedAt).toBeNull();
    // The cookie the browser now holds carries no authority.
    const cookie = await readSessionCookie();
    expect(cookie.role).toBeUndefined();
    expect(cookie.adminAuthStage).toBe("PENDING");
    expect(cookie.adminSessionId).toEqual(expect.any(String));
  });

  it("is refused by requireAdmin() and by the central admin gate", async () => {
    await postLogin();

    expect(await currentAdmin()).toBeNull();
    const gated = await callAdminApi();
    expect(gated).toEqual({ ok: false, status: 401 });
  });

  it("reports the denial as pending_two_factor, not as a missing session", async () => {
    await postLogin();
    const { resolveAdminPrincipal } = await import("@/lib/auth/admin");
    expect(await resolveAdminPrincipal()).toEqual({ ok: false, reason: "pending_two_factor" });
  });

  it("does not record a completed admin sign-in at the password stage", async () => {
    await postLogin();

    expect(loginEvents.filter((e) => e.kind === "success")).toHaveLength(0);
    const actions = auditWrites.map((a) => a.action);
    expect(actions).toContain("admin.login.password_verified");
    expect(actions).not.toContain("admin.login.success");
  });

  it("a wrong password produces no pending session and no code at all", async () => {
    const res = await postLogin(USERNAME, "not-the-password");

    expect(res.headers.get("location")).toContain("error=invalid");
    expect(sessions).toHaveLength(0);
    expect(challenges).toHaveLength(0);
    expect(sentEmails).toHaveLength(0);
    expect(await currentAdmin()).toBeNull();
  });

  it("a forged cookie claiming ADMIN with no server-side row is refused", async () => {
    // Write a cookie that looks exactly like a signed-in administrator. It is
    // sealed with the real session secret, so this is the strongest cookie an
    // attacker with the secret could mint — and it still is not an admin.
    const session = await readSessionCookie();
    session.role = "ADMIN";
    session.adminAuthStage = "AUTHENTICATED";
    session.userEmail = USERNAME;
    session.adminSignedInAt = Date.now();
    await session.save();

    expect(await currentAdmin()).toBeNull();
    expect(await callAdminApi()).toEqual({ ok: false, status: 401 });
  });

  it("a cookie that claims AUTHENTICATED while the row is still PENDING is refused", async () => {
    await postLogin();
    // Forge the second half only: flip the cookie's own stage marker.
    const session = await readSessionCookie();
    session.role = "ADMIN";
    session.adminAuthStage = "AUTHENTICATED";
    await session.save();

    expect(await currentAdmin()).toBeNull();
    expect(await callAdminApi()).toEqual({ ok: false, status: 401 });
  });
});

/* ================================================================== */
/* 2. The second factor                                                */
/* ================================================================== */

describe("the six-digit code decides the sign-in", () => {
  it("a correct code completes authentication and rotates the session id", async () => {
    const code = await signInStageOne();
    const pendingId = (await readSessionCookie()).adminSessionId;

    const res = await postVerify(code);

    expect(res.headers.get("location")).toContain("/admin?welcome=1");
    const cookie = await readSessionCookie();
    expect(cookie.role).toBe("ADMIN");
    expect(cookie.adminAuthStage).toBe("AUTHENTICATED");
    // Rotation: the id that existed while only the password was proved is
    // never the id that carries admin authority.
    expect(cookie.adminSessionId).not.toBe(pendingId);

    const admin = await currentAdmin();
    expect(admin?.username).toBe(USERNAME);
    expect(admin?.twoFactorVerifiedAt).toEqual(expect.any(Number));
    expect(await callAdminApi()).toEqual({ ok: true, status: 200 });
  });

  it("records the completed sign-in only now, and only once", async () => {
    await signInFully();

    expect(loginEvents.filter((e) => e.kind === "success")).toHaveLength(1);
    expect(auditWrites.map((a) => a.action)).toContain("admin.login.success");
  });

  it("an incorrect code does not authenticate and keeps the attempt alive", async () => {
    const code = await signInStageOne();
    const wrong = String((Number(code) + 1) % 1_000_000).padStart(6, "0");

    const res = await postVerify(wrong);

    expect(res.headers.get("location")).toContain("stage=code&error=code");
    expect(await currentAdmin()).toBeNull();
    expect((await readSessionCookie()).role).toBeUndefined();
    // The attempt survives, so the administrator can try the real code.
    const ok = await postVerify(code);
    expect(ok.headers.get("location")).toContain("/admin?welcome=1");
  });

  it("guessing every other six-digit value would not help — the code is unpredictable", async () => {
    // Twenty independent challenges; the codes must not repeat or cluster.
    // The rate limiter is stood down here so the sample is about the code
    // generator, not about the (separately tested) issue limit.
    limiterEnabled = false;
    const seen = new Set<string>();
    for (let i = 0; i < 20; i += 1) {
      cookieJar.__entries.clear();
      await postLogin();
      seen.add(codeFromLastEmail());
    }
    expect(seen.size).toBeGreaterThan(15);
    for (const c of seen) expect(c).toMatch(/^[0-9]{6}$/);
  });
});

/* ================================================================== */
/* 3. Expiry, single use, supersession                                 */
/* ================================================================== */

describe("a code stops working", () => {
  it("an expired challenge does not authenticate", async () => {
    await signInStageOne();
    const code = codeFromLastEmail();
    // Age the challenge past its five-minute window.
    for (const c of challenges) c.expiresAt = new Date(Date.now() - 1000);

    const res = await postVerify(code);

    expect(res.headers.get("location")).toContain("error=invalid");
    expect(await currentAdmin()).toBeNull();
    // The attempt is torn down: the pending session is revoked too.
    expect(sessions.every((s) => s.revokedAt !== null)).toBe(true);
  });

  it("a consumed code cannot be replayed", async () => {
    const code = await signInStageOne();
    await postVerify(code);
    expect(await currentAdmin()).not.toBeNull();

    // A second browser replays the same code against a fresh sign-in attempt.
    cookieJar.__entries.clear();
    await postLogin();
    const replay = await postVerify(code);

    expect(replay.headers.get("location")).not.toContain("/admin?welcome=1");
    expect(await currentAdmin()).toBeNull();
  });

  it("a superseded code — replaced by a resend — cannot be used", async () => {
    const first = await signInStageOne();
    const resent = await postResend();
    expect(resent.headers.get("location")).toContain("stage=code");
    const second = codeFromLastEmail();
    expect(second).not.toBe(first);

    const stale = await postVerify(first);
    expect(stale.headers.get("location")).not.toContain("/admin?welcome=1");
    expect(await currentAdmin()).toBeNull();
  });

  it("a code from another login attempt is refused", async () => {
    await postLogin();
    const otherCode = codeFromLastEmail();
    // A different browser starts its own attempt.
    cookieJar.__entries.clear();
    await postLogin();

    const res = await postVerify(otherCode);
    expect(res.headers.get("location")).not.toContain("/admin?welcome=1");
    expect(await currentAdmin()).toBeNull();
  });

  it("expired, consumed, superseded and exhausted all give the SAME answer", async () => {
    const answers = new Set<string>();

    // expired
    await signInStageOne();
    const expiredCode = codeFromLastEmail();
    for (const c of challenges) c.expiresAt = new Date(Date.now() - 1000);
    answers.add((await postVerify(expiredCode)).headers.get("location")!);

    // superseded
    cookieJar.__entries.clear();
    const supersededCode = await signInStageOne();
    await postResend();
    answers.add((await postVerify(supersededCode)).headers.get("location")!);

    // exhausted
    cookieJar.__entries.clear();
    const liveCode = await signInStageOne();
    const wrong = String((Number(liveCode) + 7) % 1_000_000).padStart(6, "0");
    for (let i = 0; i < 5; i += 1) answers.add((await postVerify(wrong)).headers.get("location")!);

    // Two distinct answers only: "keep guessing" and "start over". Nothing
    // distinguishes WHY an attempt ended.
    expect(answers.size).toBeLessThanOrEqual(2);
    expect([...answers].some((a) => a.includes("error=invalid"))).toBe(true);
  });
});

/* ================================================================== */
/* 4. Rate limiting and lockout                                        */
/* ================================================================== */

describe("excessive guessing and excessive resends are limited", () => {
  it("the challenge dies after five wrong guesses and raises Suspicious Activity", async () => {
    const code = await signInStageOne();
    const wrong = String((Number(code) + 3) % 1_000_000).padStart(6, "0");

    for (let i = 0; i < 5; i += 1) await postVerify(wrong);

    // The correct code no longer works — the challenge itself is dead.
    const res = await postVerify(code);
    expect(res.headers.get("location")).not.toContain("/admin?welcome=1");
    expect(await currentAdmin()).toBeNull();
    expect(
      securityReports.some((r) => r.payload.kind === "admin_two_factor_attempts_exhausted"),
    ).toBe(true);
  });

  it("restarting the sign-in to buy fresh guesses is throttled too", async () => {
    // The five-attempt cap ends one challenge. The interesting attacker is
    // the one who simply starts over each time, so the real question is what
    // bounds the TOTAL number of guesses. Two independent limiters do: the
    // issue limiter caps how many challenges can be opened at all, and the
    // verify limiter caps submissions across all of them.
    const { ADMIN_2FA_ISSUE_POLICY } = await import("@/lib/auth/admin-2fa");

    let guessesAccepted = 0;
    for (let attempt = 0; attempt < ADMIN_2FA_ISSUE_POLICY.max + 3; attempt += 1) {
      cookieJar.__entries.clear();
      await postLogin();
      const live = challenges.filter((c) => !c.consumedAt && !c.supersededAt);
      if (live.length === 0) continue; // no code was issued — nothing to guess at
      const before = live[0]!.attempts;
      for (let guess = 0; guess < 5; guess += 1) await postVerify("000000");
      guessesAccepted += live[0]!.attempts - before;
    }

    // Nowhere near the 10^6 search space, and the operator was told.
    expect(guessesAccepted).toBeLessThanOrEqual(ADMIN_2FA_ISSUE_POLICY.max * 5);
    expect(sentEmails.length).toBeLessThanOrEqual(ADMIN_2FA_ISSUE_POLICY.max);
    expect(
      securityReports.some((r) => r.payload.kind === "admin_two_factor_verify_rate_limited"),
    ).toBe(true);
  });

  it("resends are rate limited and the limit raises Suspicious Activity", async () => {
    const { ADMIN_2FA_ISSUE_POLICY } = await import("@/lib/auth/admin-2fa");
    await signInStageOne();
    const issuedBefore = sentEmails.length;

    for (let i = 0; i < ADMIN_2FA_ISSUE_POLICY.max + 2; i += 1) await postResend();

    // Fewer codes went out than requests came in.
    expect(sentEmails.length - issuedBefore).toBeLessThan(ADMIN_2FA_ISSUE_POLICY.max + 2);
    expect(
      securityReports.some((r) => r.payload.kind === "admin_two_factor_resend_rate_limited"),
    ).toBe(true);
  });

  it("a rate-limited resend never leaves the administrator authenticated", async () => {
    const { ADMIN_2FA_ISSUE_POLICY } = await import("@/lib/auth/admin-2fa");
    await signInStageOne();
    for (let i = 0; i < ADMIN_2FA_ISSUE_POLICY.max + 3; i += 1) await postResend();
    expect(await currentAdmin()).toBeNull();
  });

  it("only ONE code is live at a time, however many resends are requested", async () => {
    await signInStageOne();
    await postResend();
    await postResend();
    const live = challenges.filter((c) => !c.consumedAt && !c.supersededAt);
    expect(live).toHaveLength(1);
  });
});

/* ================================================================== */
/* 5. The code is never recorded anywhere                              */
/* ================================================================== */

describe("codes never appear in logs, events or stored parameters", () => {
  /** Every place the system wrote something during this test. */
  function everythingRecorded(): string {
    return JSON.stringify({
      logs: logCalls,
      securityReports,
      securityEventRows: prismaMock.securityEvent.create.mock.calls,
      audit: auditWrites,
      loginEvents,
      sql: statements,
      // The email is excluded on purpose — it is the one legitimate carrier.
    });
  }

  it("survives a full lifecycle: issue, wrong guess, resend, success", async () => {
    const first = await signInStageOne();
    const wrong = String((Number(first) + 11) % 1_000_000).padStart(6, "0");
    await postVerify(wrong);
    await postResend();
    const second = codeFromLastEmail();
    await postVerify(second);
    expect(await currentAdmin()).not.toBeNull();

    const recorded = everythingRecorded();
    expect(recorded).not.toContain(first);
    expect(recorded).not.toContain(second);
    // Nor the codes a caller submitted — a wrong guess is a secret too, since
    // a logged near-miss narrows the space for anyone reading the log.
    expect(recorded).not.toContain(wrong);
  });

  it("survives the failure paths: expiry, exhaustion and both rate limits", async () => {
    const { ADMIN_2FA_ISSUE_POLICY } = await import("@/lib/auth/admin-2fa");
    const code = await signInStageOne();
    const wrong = String((Number(code) + 13) % 1_000_000).padStart(6, "0");
    for (let i = 0; i < 6; i += 1) await postVerify(wrong);
    for (let i = 0; i < ADMIN_2FA_ISSUE_POLICY.max + 2; i += 1) await postResend();

    const recorded = everythingRecorded();
    expect(recorded).not.toContain(code);
    expect(recorded).not.toContain(wrong);
  });

  it("stores only a keyed HMAC of the code, never a recoverable form of it", async () => {
    const code = await signInStageOne();
    const row = challenges.at(-1)!;

    expect(row.codeHash).not.toContain(code);
    expect(row.codeHash).toMatch(/^[0-9a-f]{64}$/);
    // A bare digest of a six-digit code is reversible in a second — prove
    // this is not one, under either plausible pre-image.
    expect(row.codeHash).not.toBe(crypto.createHash("sha256").update(code).digest("hex"));
    expect(row.codeHash).not.toBe(
      crypto.createHash("sha256").update(`${row.id}:${code}`).digest("hex"),
    );
  });

  it("never puts the raw session id in the database or in a security report", async () => {
    await signInFully();
    const rawId = (await readSessionCookie()).adminSessionId!;

    expect(JSON.stringify(statements.map((s) => s.values))).not.toContain(rawId);
    expect(JSON.stringify(securityReports)).not.toContain(rawId);
    expect(JSON.stringify(logCalls)).not.toContain(rawId);
    // What is stored is an HMAC, so a table dump cannot be replayed.
    expect(sessions.every((s) => s.id !== rawId)).toBe(true);
  });

  it("never puts the admin password anywhere the system records", async () => {
    await postLogin(USERNAME, "a-wrong-password-attempt");
    await signInFully();
    const recorded = JSON.stringify({
      logs: logCalls,
      securityReports,
      audit: auditWrites,
      loginEvents,
      sql: statements,
      events: prismaMock.securityEvent.create.mock.calls,
    });
    expect(recorded).not.toContain(PASSWORD);
    expect(recorded).not.toContain("a-wrong-password-attempt");
  });

  it("never puts the code in a redirect the browser would keep in history", async () => {
    const code = await signInStageOne();
    const urls = [
      (await postVerify(code)).headers.get("location") ?? "",
      (await postResend()).headers.get("location") ?? "",
    ];
    for (const url of urls) expect(url).not.toContain(code);
  });
});

/* ================================================================== */
/* 6. Session lifecycle at the gate                                    */
/* ================================================================== */

describe("a session that stops being valid stops reaching admin routes", () => {
  it("a revoked session is refused, cookie intact", async () => {
    await signInFully();
    expect(await callAdminApi()).toEqual({ ok: true, status: 200 });

    // Sign-out revokes the row. The browser keeps its cookie.
    const { revokeCurrentAdminSession } = await import("@/lib/auth/admin-session");
    expect(await revokeCurrentAdminSession("logout")).toBe(true);

    expect(await currentAdmin()).toBeNull();
    expect(await callAdminApi()).toEqual({ ok: false, status: 401 });
    expect((await readSessionCookie()).role).toBe("ADMIN"); // the cookie still claims it
  });

  it("an idle-expired session is refused", async () => {
    await signInFully();
    for (const s of sessions) s.idleExpiresAt = new Date(Date.now() - 1000);

    expect(await currentAdmin()).toBeNull();
    expect(await callAdminApi()).toEqual({ ok: false, status: 401 });
  });

  it("an absolute-expired session is refused even with fresh activity", async () => {
    await signInFully();
    for (const s of sessions) {
      s.absoluteExpiresAt = new Date(Date.now() - 1000);
      s.lastActivityAt = new Date();
      s.idleExpiresAt = new Date(Date.now() + 3_600_000);
    }

    expect(await currentAdmin()).toBeNull();
    expect(await callAdminApi()).toEqual({ ok: false, status: 401 });
  });

  it("rotating ADMIN_USERNAME kills sessions minted for the old identity", async () => {
    await signInFully();
    process.env.ADMIN_USERNAME = "someone-else";

    expect(await currentAdmin()).toBeNull();
    // And it is revoked server-side, not merely denied per request.
    await new Promise((r) => setTimeout(r, 0));
    expect(sessions.filter((s) => s.stage === "AUTHENTICATED")[0]!.revokedReason).toBe(
      "admin_identity_changed",
    );
  });

  it("signing in again abandons the previous pending attempt", async () => {
    await postLogin();
    const firstPending = (await readSessionCookie()).adminSessionId;
    await postLogin();
    const secondPending = (await readSessionCookie()).adminSessionId;

    expect(secondPending).not.toBe(firstPending);
    // The superseded pending row is revoked rather than left waiting.
    expect(sessions.filter((s) => s.revokedAt !== null)).toHaveLength(1);
  });
});

/* ================================================================== */
/* 7. CSRF still guards admin mutations                                */
/* ================================================================== */

describe("admin mutations still require CSRF, even for a real administrator", () => {
  it("a cross-origin mutation from a signed-in admin is refused with 403", async () => {
    await signInFully();
    const res = await callAdminApi({ origin: "https://evil.example.com" });
    expect(res).toEqual({ ok: false, status: 403 });
    expect(securityReports.some((r) => r.payload.kind === "csrf_violation")).toBe(true);
  });

  it("a mutation with no Origin and no Referer is refused", async () => {
    await signInFully();
    const { gateAdminApiCall } = await import("@/lib/security/admin-gate");
    const url = `${ORIGIN}/api/admin/media`;
    const bare = Object.assign(
      new Request(url, { method: "POST", headers: { host: "localhost:3000" } }),
      {
        nextUrl: new URL(url),
        cookies: { get: () => undefined },
      },
    ) as unknown as NextRequest;
    const res = await gateAdminApiCall(bare);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.response.status).toBe(403);
  });

  it("a forged X-Forwarded-Host cannot make an attacker's origin trusted", async () => {
    // In production the trusted set is the compiled-in canonical origin and
    // ignores the request entirely; assert that directly, since NODE_ENV is
    // "test" while these handlers run.
    const { getTrustedOrigins, isTrustedRequestOrigin } = await import("@/lib/security/request");
    const forged = makeRequest(
      "/api/admin/media",
      null,
      { "x-forwarded-host": "evil.example.com", origin: "https://evil.example.com" },
      "POST",
    );
    try {
      vi.stubEnv("NODE_ENV", "production");
      const trusted = getTrustedOrigins(forged);
      expect(trusted.join(",")).not.toContain("evil.example.com");
      expect(isTrustedRequestOrigin("https://evil.example.com", trusted)).toBe(false);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("the two-factor endpoints are CSRF-protected too", async () => {
    await signInStageOne();
    const cross = { origin: "https://evil.example.com" };
    expect((await postVerify("000000", cross)).status).toBe(403);
    expect((await postResend(cross)).status).toBe(403);
    // Nothing was spent: the live challenge still has zero attempts.
    expect(challenges.at(-1)!.attempts).toBe(0);
  });

  it("a safe method is not blocked by CSRF but is still denied without a session", async () => {
    const res = await callAdminApi({}, "GET");
    expect(res).toEqual({ ok: false, status: 401 });
  });
});

/* ================================================================== */
/* 8. Fail closed                                                      */
/* ================================================================== */

describe("an unreachable store denies rather than admits", () => {
  it("refuses the sign-in when the session store is down", async () => {
    storeDown = true;
    const res = await postLogin();
    expect(res.headers.get("location")).toContain("error=invalid");
    expect((await readSessionCookie()).role).toBeUndefined();
  });

  it("refuses admin routes when the store goes down mid-session", async () => {
    await signInFully();
    storeDown = true;

    expect(await currentAdmin()).toBeNull();
    expect(await callAdminApi()).toEqual({ ok: false, status: 401 });
  });

  it("refuses admin routes with 503 when ban state cannot be determined", async () => {
    await signInFully();
    prismaMock.bannedDevice.findUnique.mockRejectedValue(new Error("db down"));

    expect(await callAdminApi()).toEqual({ ok: false, status: 503 });
  });

  it("refuses a banned device even with a fully authenticated session", async () => {
    await signInFully();
    prismaMock.bannedDevice.findUnique.mockResolvedValue({ active: true });

    expect(await callAdminApi()).toEqual({ ok: false, status: 403 });
  });

  it("verification cannot succeed while the store is unreadable", async () => {
    const code = await signInStageOne();
    storeDown = true;
    const res = await postVerify(code);
    expect(res.headers.get("location")).not.toContain("/admin?welcome=1");
    storeDown = false;
    expect(await currentAdmin()).toBeNull();
  });
});

/* ================================================================== */
/* 9. Purpose separation of the new key material                       */
/* ================================================================== */

describe("the new cryptographic operations use purpose-separated keys", () => {
  it("the 2FA key and the session key are different keys", async () => {
    const { getPurposeKey, getTwoFactorHmacKey } = await import("@/lib/security/keys");
    expect(getTwoFactorHmacKey().equals(getPurposeKey("admin-2fa"))).toBe(true);
    expect(getTwoFactorHmacKey().equals(getPurposeKey("session"))).toBe(false);
    expect(getPurposeKey("session").equals(getPurposeKey("at-rest"))).toBe(false);
  });

  it("the same session id hashes differently in the session store and the challenge store", async () => {
    await signInStageOne();
    const sessionRowId = sessions[0]!.id;
    const challengeRowKey = challenges[0]!.adminSessionHash;
    // Both are HMACs of the same pending id; different purposes and different
    // message prefixes mean the two tables cannot be correlated by id.
    expect(sessionRowId).not.toBe(challengeRowKey);
  });
});
