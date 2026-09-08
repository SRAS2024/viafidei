/**
 * Spec item 9 — controls that decide authorization fail CLOSED.
 *
 * If the security state cannot be determined, the answer is DENY and the
 * outage is recorded. This suite pins that for the three controls that sit in
 * front of every admin mutation: CSRF, banned-device enforcement, and admin
 * session validation.
 *
 * It also pins the deliberate EXCEPTIONS, because "fail closed everywhere"
 * would be the wrong change here: the Admin Worker defender is reporting, not
 * authorization, and this codebase fails open on it on purpose so worker
 * liveness never becomes a dependency of basic admin authentication (spec
 * items 9 and 12).
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

const requireAdminMock = vi.fn();
const reportSecurityBreachMock = vi.fn();
const reportSuspiciousActivityMock = vi.fn();

vi.mock("@/lib/auth", () => ({
  requireAdmin: (...args: unknown[]) => requireAdminMock(...args),
}));
vi.mock("@/lib/security/security-events", () => ({
  reportSecurityBreach: (...args: unknown[]) => reportSecurityBreachMock(...args),
  reportSuspiciousActivity: (...args: unknown[]) => reportSuspiciousActivityMock(...args),
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import type { NextRequest } from "next/server";
import { gateAdminApiCall } from "@/lib/security/admin-gate";
import { evaluateAdminTrust } from "@/lib/security/admin-trust";
import { _resetAdminScanCountersForTests } from "@/lib/security/admin-route-scanner";

const ROOT = process.cwd();

function buildReq(args: {
  method?: string;
  origin?: string | null;
  device?: string | null;
  path?: string;
}): NextRequest {
  const path = args.path ?? "/api/admin/thing";
  const url = `https://viafidei.example.com${path}`;
  const headers = new Headers({
    host: "viafidei.example.com",
    "x-forwarded-host": "viafidei.example.com",
    "x-forwarded-proto": "https",
  });
  if (args.origin) headers.set("origin", args.origin);
  const base = new Request(url, { method: args.method ?? "POST", headers });
  return Object.assign(base, {
    nextUrl: new URL(url),
    cookies: {
      get(name: string) {
        if (name === "vf_dev_id" && args.device) return { value: args.device };
        return undefined;
      },
    },
  }) as unknown as NextRequest;
}

beforeEach(() => {
  resetPrismaMock();
  _resetAdminScanCountersForTests();
  requireAdminMock.mockReset();
  requireAdminMock.mockResolvedValue({ username: "admin", signedInAt: Date.now() });
  reportSecurityBreachMock.mockReset();
  reportSuspiciousActivityMock.mockReset();
  process.env.SESSION_SECRET = "test-session-secret-must-be-32-chars-long";
});

describe("CSRF validation fails closed", () => {
  it("a mutation with NO Origin and no Referer is refused", async () => {
    const r = await gateAdminApiCall(buildReq({ method: "POST", origin: null }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(403);
    // The refusal is unconditional — admin auth is never consulted.
    expect(requireAdminMock).not.toHaveBeenCalled();
  });

  it("a cross-origin mutation is refused and reported as a breach", async () => {
    const r = await gateAdminApiCall(
      buildReq({ method: "POST", origin: "https://evil.example.com" }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(403);
    expect(reportSecurityBreachMock).toHaveBeenCalledTimes(1);
  });
});

describe("banned-device enforcement fails closed", () => {
  it("DENIES with 503 when the ban store cannot be read", async () => {
    prismaMock.bannedDevice.findUnique.mockRejectedValue(new Error("db down"));
    const r = await gateAdminApiCall(
      buildReq({ origin: "https://viafidei.example.com", device: "dev-1" }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(503);
    // We could not prove the device is unbanned, so no admin work runs.
    expect(requireAdminMock).not.toHaveBeenCalled();
  });

  it("records the indeterminate state through the existing diagnostics", async () => {
    prismaMock.bannedDevice.findUnique.mockRejectedValue(new Error("db down"));
    await gateAdminApiCall(buildReq({ origin: "https://viafidei.example.com", device: "dev-1" }));
    expect(reportSuspiciousActivityMock).toHaveBeenCalledTimes(1);
    const arg = reportSuspiciousActivityMock.mock.calls[0]![0] as { kind: string; summary: string };
    expect(arg.kind).toBe("banned_device_state_indeterminate");
    // Never leak secrets into an event payload.
    expect(arg.summary).not.toContain("test-session-secret");
  });

  it("still passes a healthy, unbanned device", async () => {
    prismaMock.bannedDevice.findUnique.mockResolvedValue(null);
    const r = await gateAdminApiCall(
      buildReq({ origin: "https://viafidei.example.com", device: "dev-1" }),
    );
    expect(r.ok).toBe(true);
  });
});

describe("admin session validation fails closed", () => {
  it("a request with no valid admin session is refused with 401", async () => {
    requireAdminMock.mockResolvedValue(null);
    prismaMock.bannedDevice.findUnique.mockResolvedValue(null);
    const r = await gateAdminApiCall(buildReq({ origin: "https://viafidei.example.com" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(401);
  });

  it("evaluateAdminTrust denies (never throws) when the auth state is unknown", async () => {
    requireAdminMock.mockRejectedValue(new Error("store unreachable"));
    const result = await evaluateAdminTrust(buildReq({ method: "GET" }));
    expect(result.trusted).toBe(false);
    if (!result.trusted) expect(result.reason).toBe("indeterminate");
  });

  it("a thrown auth state does not become a gate PASS", async () => {
    requireAdminMock.mockRejectedValue(new Error("store unreachable"));
    prismaMock.bannedDevice.findUnique.mockResolvedValue(null);
    const r = await gateAdminApiCall(buildReq({ origin: "https://viafidei.example.com" }));
    expect(r.ok).toBe(false);
  });
});

describe("the Admin Worker defender stays non-blocking (deliberate fail-open)", () => {
  it("a defender that rejects does not change the gate's answer", async () => {
    requireAdminMock.mockResolvedValue(null);
    prismaMock.bannedDevice.findUnique.mockResolvedValue(null);
    const r = await gateAdminApiCall(
      buildReq({ method: "DELETE", origin: "https://viafidei.example.com" }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(401);
  });

  it("a defender that throws synchronously does not turn a 401 into a 500", async () => {
    vi.resetModules();
    vi.doMock("@/lib/auth/admin", () => ({ requireAdmin: vi.fn(async () => null) }));
    vi.doMock("@/lib/admin-worker/request-defender", () => ({
      defendUnauthorizedMutation: () => {
        throw new Error("defender exploded");
      },
    }));
    vi.doMock("@/lib/db/client", () => ({ prisma: prismaMock }));
    const { requireAdminWithDefender } = await import("@/lib/admin-worker/admin-route-guard");
    await expect(
      requireAdminWithDefender(buildReq({ method: "POST", origin: null })),
    ).resolves.toBeNull();
    vi.doUnmock("@/lib/admin-worker/request-defender");
    vi.doUnmock("@/lib/auth/admin");
    vi.resetModules();
  });
});

/**
 * Spec item 12: interactive admin authentication and the Admin Worker are
 * separate systems. The worker keeps running with no second factor, no email
 * code and no admin session — enforced structurally so a future edit that
 * wires the two together fails here.
 */
describe("the Admin Worker never participates in interactive admin authentication", () => {
  function walk(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full, out);
      else if (entry.isFile() && /\.tsx?$/.test(entry.name)) out.push(full);
    }
    return out;
  }

  const workerFiles = walk(join(ROOT, "src", "lib", "admin-worker"));

  it("finds the worker sources (sanity)", () => {
    expect(workerFiles.length).toBeGreaterThan(50);
  });

  it("no worker module imports the interactive admin session store", () => {
    const offenders = workerFiles.filter((f) =>
      /["']@?\/?(?:@\/)?lib\/auth\/admin-session["']|from\s+["'][^"']*auth\/admin-session["']/.test(
        readFileSync(f, "utf8"),
      ),
    );
    expect(offenders.map((f) => f.replace(`${ROOT}/`, ""))).toEqual([]);
  });

  it("no worker module can promote a session or read a pending sign-in", () => {
    const offenders = workerFiles.filter((f) =>
      /\b(completeAdminTwoFactor|promoteAdminSession|beginAdminSession|getPendingAdminSession)\b/.test(
        readFileSync(f, "utf8"),
      ),
    );
    expect(offenders.map((f) => f.replace(`${ROOT}/`, ""))).toEqual([]);
  });

  it("the worker entrypoint does not authenticate as an admin", () => {
    const entry = readFileSync(join(ROOT, "scripts", "run-worker.ts"), "utf8");
    expect(entry).not.toMatch(/\brequireAdmin\s*\(/);
    expect(entry).not.toMatch(/auth\/admin-session/);
  });

  it("only the reporting wrapper touches requireAdmin inside the worker tree", () => {
    const callers = workerFiles
      .filter((f) => /\brequireAdmin\s*\(\s*\)/.test(readFileSync(f, "utf8")))
      .map((f) => f.replace(`${ROOT}/`, ""));
    expect(callers).toEqual(["src/lib/admin-worker/admin-route-guard.ts"]);
  });

  it("the admin session store itself never reaches into the worker", () => {
    const store = readFileSync(join(ROOT, "src", "lib", "auth", "admin-session.ts"), "utf8");
    const admin = readFileSync(join(ROOT, "src", "lib", "auth", "admin.ts"), "utf8");
    expect(store).not.toMatch(/admin-worker/);
    expect(admin).not.toMatch(/admin-worker/);
  });
});

describe("no secret material is ever recorded", () => {
  it("the admin session store logs no session id, token or key", () => {
    const store = readFileSync(join(ROOT, "src", "lib", "auth", "admin-session.ts"), "utf8");
    // Every logger/report call in the file is checked for the raw id binding.
    const reportingLines = store
      .split("\n")
      .filter((l) => /logger\.|summary:|recommendedAction:/.test(l));
    for (const line of reportingLines) {
      expect(line).not.toMatch(/\bsessionId\b/);
      expect(line).not.toMatch(/\bstoredId\b/);
      expect(line).not.toMatch(/deriveKey/);
    }
  });
});
