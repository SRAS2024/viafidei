/**
 * Unified admin API gate: CSRF + banned-device + admin-auth.
 * The three checks must run in order and short-circuit on failure.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

const requireAdminMock = vi.fn();
const reportSecurityBreachMock = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/auth", () => ({
  requireAdmin: (...args: unknown[]) => requireAdminMock(...args),
}));
vi.mock("@/lib/security/security-events", () => ({
  reportSecurityBreach: (...args: unknown[]) => reportSecurityBreachMock(...args),
  reportSuspiciousActivity: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import type { NextRequest } from "next/server";
import { gateAdminApiCall } from "@/lib/security/admin-gate";

beforeEach(() => {
  resetPrismaMock();
  requireAdminMock.mockReset();
  reportSecurityBreachMock.mockClear();
  process.env.SESSION_SECRET = "test-session-secret-must-be-32-chars-long";
});

function buildReq(args: {
  method?: string;
  origin?: string | null;
  host?: string;
  proto?: string;
  cookies?: Record<string, string>;
}): NextRequest {
  const headers = new Headers();
  if (args.origin) headers.set("origin", args.origin);
  if (args.host) {
    headers.set("host", args.host);
    headers.set("x-forwarded-host", args.host);
  }
  if (args.proto) headers.set("x-forwarded-proto", args.proto);
  const url = `${args.proto ?? "https"}://${args.host ?? "viafidei.example.com"}/api/admin/data-management/cleanup`;
  const base = new Request(url, { method: args.method ?? "POST", headers });
  return Object.assign(base, {
    nextUrl: new URL(url),
    cookies: {
      get(name: string) {
        if (args.cookies && name in args.cookies) return { value: args.cookies[name]! };
        return undefined;
      },
    },
  }) as unknown as NextRequest;
}

describe("gateAdminApiCall — cross-origin requests fail at CSRF stage with Security Breach", () => {
  it("a cross-origin POST is rejected with 403 and fires Security Breach", async () => {
    requireAdminMock.mockResolvedValue({ username: "admin", signedInAt: Date.now() });
    prismaMock.bannedDevice.findUnique.mockResolvedValue(null);

    const r = await gateAdminApiCall(
      buildReq({
        method: "POST",
        origin: "https://evil.example.com",
        host: "viafidei.example.com",
        proto: "https",
        cookies: { vf_dev_id: "device-1" },
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.response.status).toBe(403);
    }
    expect(reportSecurityBreachMock).toHaveBeenCalledTimes(1);
    const args = reportSecurityBreachMock.mock.calls[0]![0] as {
      kind: string;
      route: string;
      httpMethod: string;
    };
    expect(args.kind).toBe("csrf_violation");
    expect(args.route).toBe("/api/admin/data-management/cleanup");
    expect(args.httpMethod).toBe("POST");
  });

  it("CSRF failure short-circuits — admin auth is NOT checked", async () => {
    requireAdminMock.mockResolvedValue(null);
    prismaMock.bannedDevice.findUnique.mockResolvedValue(null);

    await gateAdminApiCall(
      buildReq({
        method: "POST",
        origin: "https://evil.example.com",
        host: "viafidei.example.com",
        proto: "https",
      }),
    );
    expect(requireAdminMock).not.toHaveBeenCalled();
  });
});

describe("gateAdminApiCall — banned devices are blocked", () => {
  it("a banned device is rejected with 403 even with valid admin session + same origin", async () => {
    requireAdminMock.mockResolvedValue({ username: "admin", signedInAt: Date.now() });
    prismaMock.bannedDevice.findUnique.mockResolvedValue({ active: true });

    const r = await gateAdminApiCall(
      buildReq({
        method: "POST",
        origin: "https://viafidei.example.com",
        host: "viafidei.example.com",
        proto: "https",
        cookies: { vf_dev_id: "banned-device" },
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.response.status).toBe(403);
    }
  });

  it("banned-device check short-circuits before admin auth", async () => {
    requireAdminMock.mockResolvedValue(null);
    prismaMock.bannedDevice.findUnique.mockResolvedValue({ active: true });

    await gateAdminApiCall(
      buildReq({
        method: "POST",
        origin: "https://viafidei.example.com",
        host: "viafidei.example.com",
        proto: "https",
        cookies: { vf_dev_id: "banned-device" },
      }),
    );
    expect(requireAdminMock).not.toHaveBeenCalled();
  });
});

describe("gateAdminApiCall — admin auth fails last", () => {
  it("a non-admin caller is rejected with 401 (unauthorized)", async () => {
    requireAdminMock.mockResolvedValue(null);
    prismaMock.bannedDevice.findUnique.mockResolvedValue(null);

    const r = await gateAdminApiCall(
      buildReq({
        method: "POST",
        origin: "https://viafidei.example.com",
        host: "viafidei.example.com",
        proto: "https",
        cookies: { vf_dev_id: "device-1" },
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      // The body is { ok: false, error: "unauthorized" } from jsonError.
      const body = (await r.response.json()) as { error: string };
      expect(body.error).toBe("unauthorized");
    }
  });

  it("a valid admin on same origin with unbanned device passes the gate", async () => {
    requireAdminMock.mockResolvedValue({ username: "admin", signedInAt: Date.now() });
    prismaMock.bannedDevice.findUnique.mockResolvedValue(null);

    const r = await gateAdminApiCall(
      buildReq({
        method: "POST",
        origin: "https://viafidei.example.com",
        host: "viafidei.example.com",
        proto: "https",
        cookies: { vf_dev_id: "device-1" },
      }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.admin.username).toBe("admin");
    }
    expect(reportSecurityBreachMock).not.toHaveBeenCalled();
  });
});
