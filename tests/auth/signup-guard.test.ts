import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import {
  SIGNUP_FORM_MAX_AGE_MS,
  checkSignupForm,
  issueSignupFormToken,
  spendSignupFormToken,
  takeSignupAllowance,
} from "@/lib/auth/signup-guard";
import { SIGNUP_FORM_MIN_FILL_MS } from "@/lib/auth/signup-guard-fields";
import { RATE_POLICIES } from "@/lib/security/rate-limit";

const NOW = Date.UTC(2026, 10, 14, 18, 0, 0);
const TEST_SECRET = "signup-guard-test-secret-at-least-32-characters";

beforeEach(() => {
  resetPrismaMock();
  vi.stubEnv("SESSION_SECRET", TEST_SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

/** A form as a person sends it back: made `ago` milliseconds before now, trap left empty. */
function sentBack(ago: number, trap: unknown = "") {
  return checkSignupForm({ token: issueSignupFormToken(NOW - ago), trap }, NOW);
}

describe("the sign-up form's signed note", () => {
  it("lets through a form filled in at a person's pace, and names its copy", () => {
    const result = sentBack(20_000);
    expect(result).toMatchObject({ ok: true, issuedAt: NOW - 20_000 });
    expect(result.ok && result.nonce).toMatch(/^[A-Za-z0-9_-]{16}$/);
  });

  it("gives every copy of the form its own note", () => {
    const a = issueSignupFormToken(NOW);
    const b = issueSignupFormToken(NOW);
    expect(a).not.toBe(b);
  });

  // The two bots of 2026 posted 0.2 to 0.9 seconds after fetching the page.
  it("refuses a form sent back sooner than a person could fill it in", () => {
    for (const ago of [0, 200, 900, SIGNUP_FORM_MIN_FILL_MS - 1]) {
      expect(sentBack(ago)).toEqual({ ok: false, reason: "too_fast" });
    }
    expect(sentBack(SIGNUP_FORM_MIN_FILL_MS).ok).toBe(true);
  });

  it("refuses a note more than a day old, and takes up to a day", () => {
    expect(sentBack(SIGNUP_FORM_MAX_AGE_MS).ok).toBe(true);
    expect(sentBack(SIGNUP_FORM_MAX_AGE_MS + 1)).toEqual({ ok: false, reason: "expired" });
  });

  it("allows for clocks that disagree a little, but not for a note from the future", () => {
    expect(sentBack(-60_000)).toEqual({ ok: false, reason: "too_fast" });
    expect(sentBack(-10 * 60_000)).toEqual({ ok: false, reason: "from_future" });
  });

  it("refuses a post without a note, as a script that never fetched the page sends", () => {
    for (const token of [undefined, null, ""]) {
      expect(checkSignupForm({ token, trap: "" }, NOW)).toEqual({
        ok: false,
        reason: "token_missing",
      });
    }
  });

  it("refuses a damaged note", () => {
    const good = issueSignupFormToken(NOW - 20_000);
    for (const token of [
      "x",
      good.replace(/^v1/, "v2"),
      `${good}.extra`,
      good.slice(0, -1),
      `${good}${"A".repeat(300)}`,
      new File(["x"], "token.txt"),
    ]) {
      expect(checkSignupForm({ token, trap: "" }, NOW)).toEqual({
        ok: false,
        reason: typeof token === "string" ? "token_malformed" : "token_missing",
      });
    }
  });

  it("refuses a note whose time was changed, or that this server did not sign", () => {
    const good = issueSignupFormToken(NOW - 20_000);
    const [version, , nonce, signature] = good.split(".");
    const earlier = [version, (NOW - 60_000).toString(36), nonce, signature].join(".");
    expect(checkSignupForm({ token: earlier, trap: "" }, NOW)).toEqual({
      ok: false,
      reason: "token_forged",
    });

    vi.stubEnv("SESSION_SECRET", `${TEST_SECRET}-another-server`);
    expect(checkSignupForm({ token: good, trap: "" }, NOW)).toEqual({
      ok: false,
      reason: "token_forged",
    });
  });
});

describe("the field only a machine fills in", () => {
  it("refuses a form with anything at all in it, even with a good note", () => {
    for (const trap of ["https://spam.example", "x", " ", new File(["x"], "a.txt")]) {
      expect(sentBack(20_000, trap)).toEqual({ ok: false, reason: "trap_filled" });
    }
  });

  it("lets through a form where it was left empty or never sent", () => {
    for (const trap of ["", null, undefined]) {
      expect(sentBack(20_000, trap).ok).toBe(true);
    }
  });
});

describe("spending a note", () => {
  it("makes one account per copy of the form, for the note's whole life", async () => {
    // The database is down here, so the limiter's in-memory fallback answers: the rule
    // holds either way.
    prismaMock.$queryRaw.mockRejectedValue(new Error("database unavailable"));
    const sent = sentBack(20_000);
    if (!sent.ok) throw new Error("expected a good note");
    expect(await spendSignupFormToken(sent.nonce, "203.0.113.9")).toBe(true);
    expect(await spendSignupFormToken(sent.nonce, "198.51.100.4")).toBe(false);
    const other = sentBack(20_000);
    if (!other.ok) throw new Error("expected a good note");
    expect(await spendSignupFormToken(other.nonce, "203.0.113.9")).toBe(true);

    expect(RATE_POLICIES.signupFormToken.max).toBe(1);
    expect(RATE_POLICIES.signupFormToken.windowMs).toBeGreaterThanOrEqual(SIGNUP_FORM_MAX_AGE_MS);
  });
});

describe("the day's allowance of new accounts", () => {
  it("is counted per connection and for the whole site, over a day", () => {
    expect(RATE_POLICIES.registerDaily.windowMs).toBe(24 * 60 * 60_000);
    expect(RATE_POLICIES.registerSiteDaily.windowMs).toBe(24 * 60 * 60_000);
    // Tighter than the hourly limit allowed over a day (5 an hour is 120 a day): the bot
    // that made "Test User" accounts made about 16 a day from each of its six addresses.
    expect(RATE_POLICIES.registerDaily.max).toBeLessThan(16);
    expect(RATE_POLICIES.registerSiteDaily.max).toBeGreaterThan(RATE_POLICIES.registerDaily.max);
    // The browser tests sign up 9 readers in each of two browsers on a fresh database, and
    // may retry a failed test twice.
    expect(RATE_POLICIES.registerSiteDaily.max).toBeGreaterThanOrEqual(2 * 18);
  });

  it("stops a connection at its day's allowance without spending the site's", async () => {
    prismaMock.$queryRaw.mockRejectedValue(new Error("database unavailable"));
    const ip = "192.0.2.77";
    for (let i = 0; i < RATE_POLICIES.registerDaily.max; i += 1) {
      expect(await takeSignupAllowance(ip)).toEqual({ ok: true });
    }
    const keysBefore = prismaMock.$queryRaw.mock.calls.length;
    expect(await takeSignupAllowance(ip)).toEqual({ ok: false, reason: "ip_daily_cap" });
    // Only the connection's counter was asked.
    expect(prismaMock.$queryRaw.mock.calls.length).toBe(keysBefore + 1);
  });

  it("stops everyone once the site has made its day's accounts", async () => {
    prismaMock.$queryRaw.mockImplementation(async (sql: { values?: unknown[] }) => {
      const key = String(sql.values?.[1] ?? "");
      const count = key === "register-site-day" ? RATE_POLICIES.registerSiteDaily.max + 1 : 1;
      return [{ count, resetAt: new Date(NOW + 60_000) }];
    });
    expect(await takeSignupAllowance("192.0.2.78")).toEqual({
      ok: false,
      reason: "site_daily_cap",
    });
  });
});
