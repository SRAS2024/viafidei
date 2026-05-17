/**
 * /api/internal/security-event classification:
 *
 *   * client_devtools_open is benign on its own — no email fires
 *     for an isolated event.
 *   * Sustained client tamper probing (more than 3
 *     client_devtools_open events from same IP+device within
 *     window) escalates to Suspicious Activity.
 *   * Active manipulation events (DOM tamper, state tamper, ...)
 *     immediately fire a Security Breach email.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const reportSuspiciousActivityMock = vi.fn().mockResolvedValue(undefined);
const reportSecurityBreachMock = vi.fn().mockResolvedValue(undefined);
const rateLimitMock = vi.fn().mockResolvedValue({ ok: true, remaining: 10, resetAt: Date.now() + 60_000 });

vi.mock("@/lib/security/security-events", () => ({
  reportSecurityBreach: (...args: unknown[]) => reportSecurityBreachMock(...args),
  reportSuspiciousActivity: (...args: unknown[]) => reportSuspiciousActivityMock(...args),
}));
vi.mock("@/lib/security/rate-limit", () => ({
  rateLimit: (...args: unknown[]) => rateLimitMock(...args),
  RATE_POLICIES: { publicRead: { max: 100, windowMs: 60_000 } },
}));

import type { NextRequest } from "next/server";
import { _resetTamperCountersForTests } from "@/lib/security/tamper-counter";

beforeEach(() => {
  reportSuspiciousActivityMock.mockClear();
  reportSecurityBreachMock.mockClear();
  rateLimitMock.mockClear();
  rateLimitMock.mockResolvedValue({ ok: true, remaining: 10, resetAt: Date.now() + 60_000 });
  _resetTamperCountersForTests();
  process.env.SESSION_SECRET = "test-session-secret-must-be-32-chars-long";
});

afterEach(() => {
  vi.unstubAllEnvs();
});

async function callRoute(body: unknown, cookieValue = "dev-1"): Promise<Response> {
  const { POST } = await import("@/app/api/internal/security-event/route");
  const base = new Request("http://localhost/api/internal/security-event", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "203.0.113.42",
    },
    body: JSON.stringify(body),
  });
  const req = Object.assign(base, {
    cookies: {
      get(name: string) {
        if (name === "vf_dev_id" && cookieValue) return { value: cookieValue };
        return undefined;
      },
    },
  }) as unknown as NextRequest;
  return POST(req);
}

describe("isolated devtools-open is benign — no email fires", () => {
  it("a single client_devtools_open event does not call any email reporter", async () => {
    const res = await callRoute({
      kind: "client_devtools_open",
      summary: "Devtools panel opened",
      route: "/admin",
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { classification: string };
    expect(body.classification).toBe("benign");
    expect(reportSuspiciousActivityMock).not.toHaveBeenCalled();
    expect(reportSecurityBreachMock).not.toHaveBeenCalled();
  });
});

describe("sustained dev-tool probing escalates to Suspicious Activity", () => {
  it("the fourth client_devtools_open within the window fires Suspicious (not Breach)", async () => {
    for (let i = 0; i < 4; i++) {
      await callRoute({
        kind: "client_devtools_open",
        summary: `Devtools opened (event ${i + 1})`,
        route: "/admin",
      });
    }
    expect(reportSuspiciousActivityMock).toHaveBeenCalledTimes(1);
    expect(reportSecurityBreachMock).not.toHaveBeenCalled();
  });
});

describe("active manipulation events fire Security Breach immediately", () => {
  for (const kind of [
    "client_dom_tamper",
    "client_state_tamper",
    "client_storage_tamper",
    "client_csp_violation",
    "client_unauthorized_action",
  ] as const) {
    it(`${kind} fires a Security Breach on the first event`, async () => {
      const res = await callRoute({
        kind,
        summary: `${kind} observed`,
        route: "/admin/prayers",
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { classification: string };
      expect(body.classification).toBe("Breach");
      expect(reportSecurityBreachMock).toHaveBeenCalledTimes(1);
      expect(reportSuspiciousActivityMock).not.toHaveBeenCalled();
    });
  }
});
