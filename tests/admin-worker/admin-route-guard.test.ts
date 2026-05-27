/**
 * Admin-route security guard (spec §12 follow-up). Confirms the
 * guard fires defendUnauthorizedMutation on POST/PUT/PATCH/DELETE
 * but NOT on GET, and passes through to the admin user on success.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/admin", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/admin-worker/request-defender", () => ({
  defendUnauthorizedMutation: vi.fn(async () => null),
}));

vi.mock("@/lib/security/request", () => ({
  getClientIp: vi.fn(() => "1.2.3.4"),
  getUserAgent: vi.fn(() => "test-agent"),
}));

vi.mock("@/lib/security/hash", () => ({
  ipFingerprint: vi.fn((v: string | null) => (v ? `ip:${v}` : null)),
  userAgentFingerprint: vi.fn((v: string | null) => (v ? `ua:${v}` : null)),
  deviceCredentialFingerprint: vi.fn((v: string | null) => (v ? `dev:${v}` : null)),
}));

vi.mock("@/lib/db/client", () => ({
  prisma: {},
}));

vi.mock("@/middleware", () => ({
  DEVICE_CREDENTIAL_COOKIE: "vf_dev_id",
}));

import { requireAdminWithDefender } from "@/lib/admin-worker/admin-route-guard";
import { requireAdmin } from "@/lib/auth/admin";
import { defendUnauthorizedMutation } from "@/lib/admin-worker/request-defender";

function makeReq(method: string, pathname = "/api/admin/users") {
  return {
    method,
    nextUrl: { pathname },
    cookies: { get: () => ({ value: "fp123" }) },
  } as unknown as Parameters<typeof requireAdminWithDefender>[0];
}

describe("requireAdminWithDefender (spec §12)", () => {
  it("returns the admin on success without firing the defender", async () => {
    vi.mocked(requireAdmin).mockResolvedValueOnce({ id: "u1" } as never);
    vi.mocked(defendUnauthorizedMutation).mockClear();
    const out = await requireAdminWithDefender(makeReq("POST"));
    expect(out).toEqual({ id: "u1" });
    expect(vi.mocked(defendUnauthorizedMutation)).not.toHaveBeenCalled();
  });

  it("fires the defender on unauthorized POST", async () => {
    vi.mocked(requireAdmin).mockResolvedValueOnce(null);
    vi.mocked(defendUnauthorizedMutation).mockClear();
    const out = await requireAdminWithDefender(makeReq("POST"));
    expect(out).toBeNull();
    expect(vi.mocked(defendUnauthorizedMutation)).toHaveBeenCalledTimes(1);
  });

  it("fires the defender on unauthorized PUT", async () => {
    vi.mocked(requireAdmin).mockResolvedValueOnce(null);
    vi.mocked(defendUnauthorizedMutation).mockClear();
    await requireAdminWithDefender(makeReq("PUT"));
    expect(vi.mocked(defendUnauthorizedMutation)).toHaveBeenCalledTimes(1);
  });

  it("fires the defender on unauthorized DELETE", async () => {
    vi.mocked(requireAdmin).mockResolvedValueOnce(null);
    vi.mocked(defendUnauthorizedMutation).mockClear();
    await requireAdminWithDefender(makeReq("DELETE"));
    expect(vi.mocked(defendUnauthorizedMutation)).toHaveBeenCalledTimes(1);
  });

  it("does NOT fire the defender on unauthorized GET (read-only)", async () => {
    vi.mocked(requireAdmin).mockResolvedValueOnce(null);
    vi.mocked(defendUnauthorizedMutation).mockClear();
    const out = await requireAdminWithDefender(makeReq("GET"));
    expect(out).toBeNull();
    expect(vi.mocked(defendUnauthorizedMutation)).not.toHaveBeenCalled();
  });

  it("passes the request pathname through to the defender", async () => {
    vi.mocked(requireAdmin).mockResolvedValueOnce(null);
    vi.mocked(defendUnauthorizedMutation).mockClear();
    await requireAdminWithDefender(makeReq("POST", "/api/admin/secret"));
    const call = vi.mocked(defendUnauthorizedMutation).mock.calls[0]?.[0];
    expect(call?.route).toBe("/api/admin/secret");
  });
});
