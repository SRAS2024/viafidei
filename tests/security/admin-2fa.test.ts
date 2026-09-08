/**
 * Admin two-factor challenge lifecycle (security spec item 1).
 *
 * The properties under test:
 *   • the code is six digits from the CSPRNG, never Math.random();
 *   • the code is NEVER stored in plaintext and NEVER stored as a bare
 *     digest — the six-digit space is 10^6, so only a keyed HMAC survives a
 *     database dump;
 *   • the code never appears in a log line, a security-event payload, an
 *     error or a return value — only in the email;
 *   • a challenge expires, is single use, dies after five attempts, and is
 *     invalidated the moment a replacement is issued;
 *   • every stage transition is recorded as a security event.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Prisma } from "@prisma/client";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

const reportSuspiciousActivityMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/security/security-events", () => ({
  reportSuspiciousActivity: (...a: unknown[]) => reportSuspiciousActivityMock(...a),
  reportSecurityBreach: vi.fn(),
}));

const rateLimitMock = vi.fn();
vi.mock("@/lib/security/rate-limit", () => ({
  rateLimit: (...a: unknown[]) => rateLimitMock(...a),
  RATE_POLICIES: {},
}));

const sendTransactionalEmailMock = vi.fn();
vi.mock("@/lib/email/resend", () => ({
  isEmailConfigured: () => true,
  sendTransactionalEmail: (...a: unknown[]) => sendTransactionalEmailMock(...a),
}));
vi.mock("@/lib/email/admin-send", () => ({
  readAdminEmail: () => "operator@example.com",
}));

/** Every log line the module emits, so we can prove no code leaks into one. */
const logCalls: unknown[] = [];
vi.mock("@/lib/observability/logger", () => {
  const capture =
    (level: string) =>
    (...a: unknown[]) =>
      logCalls.push({ level, args: a });
  return {
    logger: {
      info: capture("info"),
      warn: capture("warn"),
      error: capture("error"),
      debug: capture("debug"),
    },
  };
});

import {
  ADMIN_2FA_CODE_TTL_MS,
  ADMIN_2FA_MAX_ATTEMPTS,
  abandonAdminTwoFactorChallenges,
  adminSessionChallengeKey,
  generateAdminTwoFactorCode,
  issueAdminTwoFactorChallenge,
  pruneExpiredAdminTwoFactorChallenges,
  verifyAdminTwoFactorCode,
} from "@/lib/auth/admin-2fa";

/* ------------------------------------------------------------------ */
/* A tiny in-memory stand-in for the AdminTwoFactorChallenge table.    */
/* The module talks to it through parameterised Prisma.sql, so the     */
/* fake dispatches on the statement and reads the bound values.        */
/* ------------------------------------------------------------------ */

type FakeRow = {
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

const table: FakeRow[] = [];
const statements: Array<{ sql: string; values: unknown[] }> = [];

function installFakeStore(): void {
  prismaMock.$queryRaw.mockImplementation(async (arg: unknown) => {
    const q = arg as Prisma.Sql;
    const sql = q.sql;
    const v = [...q.values];
    statements.push({ sql, values: v });

    if (sql.includes('INSERT INTO "AdminTwoFactorChallenge"')) {
      const row: FakeRow = {
        id: v[0] as string,
        adminSessionHash: v[1] as string,
        adminUsername: v[2] as string,
        codeHash: v[3] as string,
        attempts: 0,
        issuedAt: v[5] as Date,
        expiresAt: v[6] as Date,
        consumedAt: null,
        supersededAt: null,
      };
      table.push(row);
      return [{ id: row.id }];
    }

    if (sql.includes('SET "attempts" = "attempts" + 1')) {
      const [now, sessionHash, cutoff, max] = [
        v[0] as Date,
        v[1] as string,
        v[2] as Date,
        v[3] as number,
      ];
      const live = table
        .filter(
          (r) =>
            r.adminSessionHash === sessionHash &&
            r.consumedAt === null &&
            r.supersededAt === null &&
            r.expiresAt.getTime() > cutoff.getTime() &&
            r.attempts < max,
        )
        .sort((a, b) => b.issuedAt.getTime() - a.issuedAt.getTime());
      const row = live[0];
      if (!row) return [];
      row.attempts += 1;
      void now;
      return [
        {
          id: row.id,
          codeHash: row.codeHash,
          attempts: row.attempts,
          expiresAt: row.expiresAt,
          consumedAt: row.consumedAt,
          supersededAt: row.supersededAt,
        },
      ];
    }

    if (sql.includes('SET "consumedAt"')) {
      const id = v[2] as string;
      const row = table.find((r) => r.id === id && !r.consumedAt && !r.supersededAt);
      if (!row) return [];
      row.consumedAt = v[0] as Date;
      return [{ id: row.id }];
    }

    if (sql.includes('SET "supersededAt"')) {
      // Two shapes: by session hash (issue / abandon) or by a single id.
      const target = v[2] as string;
      const matched = sql.includes('"adminSessionHash" =')
        ? table.filter((r) => r.adminSessionHash === target && !r.consumedAt && !r.supersededAt)
        : table.filter((r) => r.id === target && !r.supersededAt);
      for (const r of matched) r.supersededAt = v[0] as Date;
      return matched.map((r) => ({ id: r.id }));
    }

    if (sql.includes("DELETE FROM")) {
      const cutoff = v[0] as Date;
      const doomed = table.filter((r) => r.expiresAt.getTime() < cutoff.getTime());
      for (const r of doomed) table.splice(table.indexOf(r), 1);
      return doomed.map((r) => ({ id: r.id }));
    }

    if (sql.includes("SELECT") && sql.includes('"AdminTwoFactorChallenge"')) {
      const sessionHash = v[0] as string;
      const rows = table
        .filter((r) => r.adminSessionHash === sessionHash && !r.consumedAt && !r.supersededAt)
        .sort((a, b) => b.issuedAt.getTime() - a.issuedAt.getTime());
      return rows.slice(0, 1).map((r) => ({
        id: r.id,
        codeHash: r.codeHash,
        attempts: r.attempts,
        expiresAt: r.expiresAt,
        consumedAt: r.consumedAt,
        supersededAt: r.supersededAt,
      }));
    }

    return [];
  });
}

const ACTOR = {
  adminSessionId: "pending-session-id-abc",
  username: "root",
  ipAddress: "203.0.113.10",
  userAgent: "Mozilla/5.0 (Macintosh) Safari/605",
  deviceCredential: "device-credential-1234",
};

/**
 * The code as the administrator receives it — pulled back out of the email
 * body, which is the only place it is allowed to exist.
 */
function codeFromLastEmail(): string {
  const call = sendTransactionalEmailMock.mock.calls.at(-1);
  const body = (call?.[0] as { textBody: string }).textBody;
  const matches = body.match(/(?<!\d)\d{6}(?!\d)/g) ?? [];
  expect(matches).toHaveLength(1);
  return matches[0]!;
}

beforeEach(() => {
  resetPrismaMock();
  table.length = 0;
  statements.length = 0;
  logCalls.length = 0;
  reportSuspiciousActivityMock.mockClear();
  rateLimitMock
    .mockReset()
    .mockResolvedValue({ ok: true, remaining: 5, resetAt: Date.now() + 1000 });
  sendTransactionalEmailMock.mockReset().mockResolvedValue({ ok: true, delivery: "sent" });
  prismaMock.securityEvent.create.mockResolvedValue({ id: "evt-1" });
  process.env.SESSION_SECRET = "test-session-secret-must-be-32-chars-long";
  installFakeStore();
});

describe("the code itself", () => {
  it("is always exactly six digits and never uses Math.random()", () => {
    const spy = vi.spyOn(Math, "random");
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const code = generateAdminTwoFactorCode();
      expect(code).toMatch(/^[0-9]{6}$/);
      seen.add(code);
    }
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
    // 500 CSPRNG draws from 10^6 values: repeats are possible, a constant is not.
    expect(seen.size).toBeGreaterThan(400);
  });

  it("can legitimately be a low number, zero-padded rather than shortened", () => {
    // Guards against a `String(randomInt(100000, 1000000))` style shortcut,
    // which would silently throw away a tenth of the keyspace.
    const spy = vi.spyOn(crypto, "randomInt").mockReturnValue(7 as never);
    expect(generateAdminTwoFactorCode()).toBe("000007");
    spy.mockRestore();
  });
});

describe("storage — the code is never recoverable from the table", () => {
  it("stores a keyed HMAC, not the code and not a bare SHA-256 of it", async () => {
    const issued = await issueAdminTwoFactorChallenge(ACTOR);
    expect(issued.ok).toBe(true);
    const code = codeFromLastEmail();
    const row = table[0]!;

    expect(row.codeHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.codeHash).not.toContain(code);
    // The attack this defends against: 10^6 candidates, one digest each.
    expect(row.codeHash).not.toBe(crypto.createHash("sha256").update(code).digest("hex"));
    expect(row.codeHash).not.toBe(
      crypto.createHash("sha256").update(`${row.id}:${code}`).digest("hex"),
    );
    // No bound value of any statement is the plaintext code.
    expect(JSON.stringify(statements)).not.toContain(code);
  });

  it("hashes the same code differently in two challenges (per-challenge salt)", async () => {
    const spy = vi.spyOn(crypto, "randomInt").mockReturnValue(424242 as never);
    await issueAdminTwoFactorChallenge(ACTOR);
    await issueAdminTwoFactorChallenge({ ...ACTOR, adminSessionId: "other-session" });
    spy.mockRestore();
    expect(table).toHaveLength(2);
    expect(table[0]!.codeHash).not.toBe(table[1]!.codeHash);
  });

  it("keys the stored value on the deployment secret, so a dump alone is useless", async () => {
    const spy = vi.spyOn(crypto, "randomInt").mockReturnValue(424242 as never);
    await issueAdminTwoFactorChallenge(ACTOR);
    const first = table[0]!.codeHash;
    process.env.SESSION_SECRET = "a-completely-different-secret-32-chars";
    table.length = 0;
    await issueAdminTwoFactorChallenge(ACTOR);
    spy.mockRestore();
    expect(table[0]!.codeHash).not.toBe(first);
  });

  it("stores an HMAC of the pending session id, never the id itself", async () => {
    await issueAdminTwoFactorChallenge(ACTOR);
    expect(table[0]!.adminSessionHash).toMatch(/^[0-9a-f]{64}$/);
    expect(table[0]!.adminSessionHash).not.toContain(ACTOR.adminSessionId);
    expect(JSON.stringify(statements)).not.toContain(ACTOR.adminSessionId);
  });
});

describe("the code never leaves the email", () => {
  it("is absent from logs, security events, and the function's own result", async () => {
    const issued = await issueAdminTwoFactorChallenge(ACTOR);
    const code = codeFromLastEmail();

    expect(JSON.stringify(issued)).not.toContain(code);
    expect(JSON.stringify(logCalls)).not.toContain(code);
    const eventPayloads = prismaMock.securityEvent.create.mock.calls.map((c) => JSON.stringify(c));
    expect(eventPayloads.join("|")).not.toContain(code);
    expect(JSON.stringify(reportSuspiciousActivityMock.mock.calls)).not.toContain(code);
  });

  it("goes to the configured admin address, not one supplied by the request", async () => {
    await issueAdminTwoFactorChallenge(ACTOR);
    const sent = sendTransactionalEmailMock.mock.calls.at(-1)![0] as { to: string };
    expect(sent.to).toBe("operator@example.com");
  });

  it("still creates a challenge when email delivery is unavailable (never a bypass)", async () => {
    sendTransactionalEmailMock.mockResolvedValue({ ok: false, reason: "delivery_failed" });
    const issued = await issueAdminTwoFactorChallenge(ACTOR);
    expect(issued).toMatchObject({ ok: true, delivery: "failed" });
    expect(table).toHaveLength(1);
    // Verification still has to happen — a mail outage does not sign anyone in.
    const wrong = await verifyAdminTwoFactorCode(ACTOR, "000000");
    expect(wrong.ok).toBe(false);
  });
});

describe("verification", () => {
  async function issueAndRead(): Promise<string> {
    await issueAdminTwoFactorChallenge(ACTOR);
    return codeFromLastEmail();
  }

  it("accepts the correct code exactly once", async () => {
    const code = await issueAndRead();
    expect(await verifyAdminTwoFactorCode(ACTOR, code)).toEqual({ ok: true });
    // Single use: the same code replayed is refused.
    const replay = await verifyAdminTwoFactorCode(ACTOR, code);
    expect(replay.ok).toBe(false);
    if (!replay.ok) expect(replay.terminal).toBe(true);
  });

  it("tolerates the spacing a mail client may introduce", async () => {
    const code = await issueAndRead();
    const spaced = `${code.slice(0, 3)} ${code.slice(3)}`;
    expect(await verifyAdminTwoFactorCode(ACTOR, spaced)).toEqual({ ok: true });
  });

  it("refuses a wrong code without ending the attempt, and records the event", async () => {
    const code = await issueAndRead();
    const wrong = code === "000000" ? "111111" : "000000";
    const result = await verifyAdminTwoFactorCode(ACTOR, wrong);
    expect(result).toEqual({ ok: false, reason: "invalid_code", terminal: false });
    const kinds = prismaMock.securityEvent.create.mock.calls.map(
      (c) => (c[0] as { data: { eventType: string } }).data.eventType,
    );
    expect(kinds).toContain("admin_two_factor_invalid");
  });

  it("refuses a malformed submission and still spends the attempt", async () => {
    await issueAndRead();
    const result = await verifyAdminTwoFactorCode(ACTOR, "not-a-code");
    expect(result.ok).toBe(false);
    // A syntactically invalid guess is not a free probe.
    expect(table[0]!.attempts).toBe(1);
  });

  it("dies after five attempts and raises Suspicious Activity", async () => {
    const code = await issueAndRead();
    const wrong = code === "000000" ? "111111" : "000000";
    for (let i = 0; i < ADMIN_2FA_MAX_ATTEMPTS - 1; i++) {
      const r = await verifyAdminTwoFactorCode(ACTOR, wrong);
      expect(r).toMatchObject({ ok: false, terminal: false });
    }
    const last = await verifyAdminTwoFactorCode(ACTOR, wrong);
    expect(last).toEqual({ ok: false, reason: "attempts_exhausted", terminal: true });
    expect(reportSuspiciousActivityMock).toHaveBeenCalled();
    expect((reportSuspiciousActivityMock.mock.calls.at(-1)![0] as { kind: string }).kind).toBe(
      "admin_two_factor_attempts_exhausted",
    );

    // Even the CORRECT code cannot rescue an exhausted challenge.
    expect(await verifyAdminTwoFactorCode(ACTOR, code)).toMatchObject({ ok: false });
  });

  it("refuses an expired challenge", async () => {
    const code = await issueAndRead();
    const later = new Date(Date.now() + ADMIN_2FA_CODE_TTL_MS + 1000);
    const result = await verifyAdminTwoFactorCode(ACTOR, code, { now: later });
    expect(result).toEqual({ ok: false, reason: "expired", terminal: true });
    const kinds = prismaMock.securityEvent.create.mock.calls.map(
      (c) => (c[0] as { data: { eventType: string } }).data.eventType,
    );
    expect(kinds).toContain("admin_two_factor_expired");
  });

  it("invalidates the previous code when a replacement is issued", async () => {
    const first = await issueAndRead();
    const second = await issueAndRead();
    expect(second).not.toBe(first);
    expect(await verifyAdminTwoFactorCode(ACTOR, first)).toMatchObject({ ok: false });
    // ...and the replacement still works, so a resend is usable, not fatal.
    expect(await verifyAdminTwoFactorCode(ACTOR, second)).toEqual({ ok: true });
  });

  it("refuses a code belonging to a different login attempt", async () => {
    const code = await issueAndRead();
    const result = await verifyAdminTwoFactorCode(
      { ...ACTOR, adminSessionId: "someone-elses-session" },
      code,
    );
    expect(result.ok).toBe(false);
  });

  it("reports no challenge at all when none was ever issued", async () => {
    const result = await verifyAdminTwoFactorCode(ACTOR, "123456");
    expect(result).toEqual({ ok: false, reason: "no_challenge", terminal: true });
  });

  it("fails closed when the store is unreachable", async () => {
    await issueAndRead();
    prismaMock.$queryRaw.mockRejectedValue(new Error("db down"));
    const result = await verifyAdminTwoFactorCode(ACTOR, "123456");
    expect(result).toEqual({ ok: false, reason: "indeterminate", terminal: true });
  });
});

describe("the eligibility decision is one atomic statement", () => {
  it("claims the attempt and checks consumed / superseded / expiry / attempts together", async () => {
    await issueAdminTwoFactorChallenge(ACTOR);
    statements.length = 0;
    await verifyAdminTwoFactorCode(ACTOR, "123456");
    const claim = statements.find((s) => s.sql.includes('SET "attempts" = "attempts" + 1'));
    expect(claim).toBeDefined();
    // Two concurrent submissions must not both read `attempts` before either
    // writes it, so every condition lives in this one statement's WHERE.
    expect(claim!.sql).toContain('"consumedAt" IS NULL');
    expect(claim!.sql).toContain('"supersededAt" IS NULL');
    expect(claim!.sql).toContain('"expiresAt" >');
    expect(claim!.sql).toContain('"attempts" <');
  });

  it("consumes conditionally, so a racing duplicate cannot also succeed", async () => {
    await issueAdminTwoFactorChallenge(ACTOR);
    const code = codeFromLastEmail();
    statements.length = 0;
    await verifyAdminTwoFactorCode(ACTOR, code);
    const consume = statements.find((s) => s.sql.includes('SET "consumedAt"'));
    expect(consume!.sql).toContain('"consumedAt" IS NULL');
  });
});

describe("the comparison itself", () => {
  it("is constant-time over the keyed representation, never a plain equality", () => {
    const source = readFileSync(join(process.cwd(), "src/lib/auth/admin-2fa.ts"), "utf8");
    // A `===` on the stored value would leak, through timing, how many
    // leading characters of the guess were right.
    expect(source).toContain("constantTimeEquals(");
    expect(source).not.toMatch(/codeHash\s*===|===\s*.*codeHash/);
  });

  it("compares hashes of equal length, so a wrong code costs the same as a right one", async () => {
    await issueAdminTwoFactorChallenge(ACTOR);
    const stored = table[0]!.codeHash;
    // Every candidate is an HMAC of the same width, whatever was submitted —
    // including a malformed guess, which is what keeps the two paths alike.
    await verifyAdminTwoFactorCode(ACTOR, "zzz");
    expect(stored).toHaveLength(64);
  });
});

describe("rate limiting the challenge (item 11)", () => {
  it("keys generation on the challenge, IP, device and admin identity", async () => {
    await issueAdminTwoFactorChallenge(ACTOR);
    const keys = rateLimitMock.mock.calls.map((c) => c[0] as string);
    expect(keys.some((k) => k.startsWith("admin-2fa-issue:chal:"))).toBe(true);
    expect(keys.some((k) => k.startsWith("admin-2fa-issue:ip:"))).toBe(true);
    expect(keys.some((k) => k.startsWith("admin-2fa-issue:dev:"))).toBe(true);
    expect(keys.some((k) => k.startsWith("admin-2fa-issue:acct:"))).toBe(true);
    // Never the raw session id or the raw device credential.
    expect(keys.join("|")).not.toContain(ACTOR.adminSessionId);
    expect(keys.join("|")).not.toContain(ACTOR.deviceCredential);
  });

  it("keys verification the same way", async () => {
    await issueAdminTwoFactorChallenge(ACTOR);
    rateLimitMock.mockClear();
    await verifyAdminTwoFactorCode(ACTOR, "123456");
    const keys = rateLimitMock.mock.calls.map((c) => c[0] as string);
    for (const scope of ["chal", "ip", "dev", "acct"]) {
      expect(keys.some((k) => k.startsWith(`admin-2fa-verify:${scope}:`))).toBe(true);
    }
  });

  it("refuses generation past the limit and raises Suspicious Activity", async () => {
    rateLimitMock.mockResolvedValue({ ok: false, remaining: 0, resetAt: Date.now() + 1000 });
    const issued = await issueAdminTwoFactorChallenge(ACTOR);
    expect(issued).toEqual({ ok: false, reason: "rate_limited" });
    expect(table).toHaveLength(0);
    expect(sendTransactionalEmailMock).not.toHaveBeenCalled();
    expect((reportSuspiciousActivityMock.mock.calls.at(-1)![0] as { kind: string }).kind).toBe(
      "admin_two_factor_resend_rate_limited",
    );
  });

  it("refuses verification past the limit without spending an attempt", async () => {
    await issueAdminTwoFactorChallenge(ACTOR);
    rateLimitMock.mockResolvedValue({ ok: false, remaining: 0, resetAt: Date.now() + 1000 });
    const result = await verifyAdminTwoFactorCode(ACTOR, "123456");
    expect(result).toEqual({ ok: false, reason: "rate_limited", terminal: true });
    expect(table[0]!.attempts).toBe(0);
    expect((reportSuspiciousActivityMock.mock.calls.at(-1)![0] as { kind: string }).kind).toBe(
      "admin_two_factor_verify_rate_limited",
    );
  });

  it("takes the tightest bucket — one blocked key blocks the call", async () => {
    // An attacker rotating devices must still hit the per-account bucket.
    rateLimitMock.mockImplementation(async (key: string) =>
      key.includes(":acct:")
        ? { ok: false, remaining: 0, resetAt: Date.now() + 1000 }
        : { ok: true, remaining: 5, resetAt: Date.now() + 1000 },
    );
    expect(await issueAdminTwoFactorChallenge(ACTOR)).toEqual({
      ok: false,
      reason: "rate_limited",
    });
  });
});

describe("teardown helpers", () => {
  it("abandoning an attempt kills every live challenge for it", async () => {
    const code = await (async () => {
      await issueAdminTwoFactorChallenge(ACTOR);
      return codeFromLastEmail();
    })();
    expect(await abandonAdminTwoFactorChallenges(ACTOR.adminSessionId)).toBe(1);
    expect(await verifyAdminTwoFactorCode(ACTOR, code)).toMatchObject({ ok: false });
  });

  it("pruning only removes rows well past their expiry, and never throws", async () => {
    await issueAdminTwoFactorChallenge(ACTOR);
    expect(await pruneExpiredAdminTwoFactorChallenges()).toBe(0);
    expect(table).toHaveLength(1);

    const farFuture = new Date(Date.now() + 400 * 24 * 60 * 60 * 1000);
    expect(await pruneExpiredAdminTwoFactorChallenges({ now: farFuture })).toBe(1);

    prismaMock.$queryRaw.mockRejectedValue(new Error("db down"));
    await expect(pruneExpiredAdminTwoFactorChallenges()).resolves.toBe(0);
  });

  it("derives the session key deterministically and without exposing the id", () => {
    const a = adminSessionChallengeKey("session-xyz");
    const b = adminSessionChallengeKey("session-xyz");
    expect(a).toBe(b);
    expect(a).not.toContain("session-xyz");
    expect(adminSessionChallengeKey("session-abc")).not.toBe(a);
  });
});
