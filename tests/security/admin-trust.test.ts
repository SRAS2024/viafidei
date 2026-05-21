import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const requireAdminMock = vi.fn();

vi.mock("@/lib/auth", () => ({
  requireAdmin: (...a: unknown[]) => requireAdminMock(...a),
}));

import { evaluateAdminTrust, isAdminRoute } from "@/lib/security/admin-trust";

function fakeReq(path: string): NextRequest {
  return { nextUrl: new URL(`http://localhost${path}`) } as unknown as NextRequest;
}

beforeEach(() => {
  requireAdminMock.mockReset();
});

describe("isAdminRoute", () => {
  it("recognises admin pages and admin API routes", () => {
    expect(isAdminRoute("/admin")).toBe(true);
    expect(isAdminRoute("/admin/diagnostics")).toBe(true);
    expect(isAdminRoute("/api/admin")).toBe(true);
    expect(isAdminRoute("/api/admin/diagnostics/developer-report")).toBe(true);
  });

  it("rejects non-admin routes", () => {
    expect(isAdminRoute("/")).toBe(false);
    expect(isAdminRoute("/devotions")).toBe(false);
    expect(isAdminRoute("/administrator-guide")).toBe(false);
  });
});

describe("evaluateAdminTrust", () => {
  it("trusts a request that carries a valid admin session", async () => {
    requireAdminMock.mockResolvedValue({ username: "admin", signedInAt: Date.now() });
    const result = await evaluateAdminTrust(fakeReq("/api/admin/diagnostics/developer-report"));
    expect(result.trusted).toBe(true);
    if (result.trusted) expect(result.admin.username).toBe("admin");
  });

  it("does not trust a request with no valid admin session", async () => {
    requireAdminMock.mockResolvedValue(null);
    const result = await evaluateAdminTrust(fakeReq("/api/admin/diagnostics/developer-report"));
    expect(result.trusted).toBe(false);
    if (!result.trusted) expect(result.reason).toBe("no_admin_session");
  });
});
