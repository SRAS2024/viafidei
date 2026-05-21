/**
 * Suspicious-activity suppression for valid authenticated admins.
 *
 * The admin API gate checks authentication state FIRST. A request that
 * carries a valid admin session is trusted authenticated admin
 * activity — running diagnostics, downloading the Developer Audit
 * report, using Data Management, navigating content pages — and never
 * triggers a Suspicious Activity email. Unauthenticated probing of
 * admin routes still trips the suspicious-activity logic.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const requireAdminMock = vi.fn();
const reportSuspiciousActivityMock = vi.fn().mockResolvedValue(undefined);
const reportSecurityBreachMock = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/auth", () => ({
  requireAdmin: (...a: unknown[]) => requireAdminMock(...a),
}));
vi.mock("@/lib/security/security-event-store", () => ({
  isDeviceBanned: vi.fn().mockResolvedValue(false),
  recordBannedDeviceHit: vi.fn(),
}));
vi.mock("@/lib/security/security-events", () => ({
  reportSuspiciousActivity: (...a: unknown[]) => reportSuspiciousActivityMock(...a),
  reportSecurityBreach: (...a: unknown[]) => reportSecurityBreachMock(...a),
}));

import { gateAdminApiCall } from "@/lib/security/admin-gate";

let ipSeq = 0;

function gateReq(path: string, ip: string): NextRequest {
  const url = `http://localhost${path}`;
  const base = new Request(url, {
    method: "POST",
    headers: {
      origin: "http://localhost",
      "x-forwarded-host": "localhost",
      "x-forwarded-proto": "http",
      "x-forwarded-for": ip,
      "content-type": "application/json",
    },
  });
  return Object.assign(base, {
    cookies: { get: (n: string) => (n === "vf_dev_id" ? { value: `dev-${ip}` } : undefined) },
    nextUrl: new URL(url),
  }) as unknown as NextRequest;
}

beforeEach(() => {
  requireAdminMock.mockReset();
  reportSuspiciousActivityMock.mockClear();
  reportSecurityBreachMock.mockClear();
  ipSeq += 1;
  process.env.SESSION_SECRET = "test-session-secret-must-be-32-chars-long";
});

describe("valid admin session — suspicious activity is suppressed", () => {
  const adminPages = [
    "/api/admin/diagnostics/run",
    "/api/admin/diagnostics/developer-report",
    "/api/admin/data-management/cleanup",
    "/api/admin/ingestion/run",
    "/api/admin/logs/security",
  ];

  it("trusts a valid admin across diagnostics, reports, data management, and navigation", async () => {
    requireAdminMock.mockResolvedValue({ username: "admin", signedInAt: Date.now() });
    const ip = `198.51.100.${ipSeq}`;
    for (const path of adminPages) {
      const result = await gateAdminApiCall(gateReq(path, ip));
      expect(result.ok).toBe(true);
    }
    expect(reportSuspiciousActivityMock).not.toHaveBeenCalled();
    expect(reportSecurityBreachMock).not.toHaveBeenCalled();
  });

  it("does not flag a valid admin downloading the Developer Audit report", async () => {
    requireAdminMock.mockResolvedValue({ username: "admin", signedInAt: Date.now() });
    const result = await gateAdminApiCall(
      gateReq("/api/admin/diagnostics/developer-report", `198.51.100.${ipSeq}`),
    );
    expect(result.ok).toBe(true);
    expect(reportSuspiciousActivityMock).not.toHaveBeenCalled();
  });
});

describe("no valid admin session — suspicious activity logic still runs", () => {
  it("does not flag a single unauthenticated request (below the scan threshold)", async () => {
    requireAdminMock.mockResolvedValue(null);
    const result = await gateAdminApiCall(gateReq("/api/admin/users", `203.0.113.${ipSeq}`));
    expect(result.ok).toBe(false);
    expect(reportSuspiciousActivityMock).not.toHaveBeenCalled();
  });

  it("flags sustained unauthenticated probing of distinct admin routes", async () => {
    requireAdminMock.mockResolvedValue(null);
    const ip = `203.0.113.${ipSeq}`;
    const probedPaths = [
      "/api/admin/users",
      "/api/admin/sources",
      "/api/admin/diagnostics/run",
      "/api/admin/data-management/cleanup",
      "/api/admin/logs/security",
      "/api/admin/email/self-test",
      "/api/admin/queue/repair",
    ];
    for (const path of probedPaths) {
      const result = await gateAdminApiCall(gateReq(path, ip));
      expect(result.ok).toBe(false);
    }
    expect(reportSuspiciousActivityMock).toHaveBeenCalled();
  });
});
