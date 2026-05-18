/**
 * Banned devices are blocked at request time — not just at the
 * admin layout. A device flagged in the BannedDevice table:
 *
 *   * Cannot pass the unified admin gate, regardless of valid
 *     session, valid CSRF origin, or valid admin auth.
 *   * Gets back a 403 with no side effects.
 *   * Updates the BannedDevice.lastSeenAt timestamp so the admin
 *     page can show "still attempting access".
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

const requireAdminMock = vi.fn();
vi.mock("@/lib/auth", () => ({
  requireAdmin: (...args: unknown[]) => requireAdminMock(...args),
}));
vi.mock("@/lib/security/security-events", () => ({
  reportSecurityBreach: vi.fn(),
  reportSuspiciousActivity: vi.fn(),
}));

import type { NextRequest } from "next/server";
import { gateAdminApiCall } from "@/lib/security/admin-gate";

beforeEach(() => {
  resetPrismaMock();
  requireAdminMock.mockReset();
  requireAdminMock.mockResolvedValue({ username: "admin", signedInAt: Date.now() });
  process.env.SESSION_SECRET = "test-session-secret-must-be-32-chars-long";
});

function buildReq(args: { deviceCredential?: string | null }): NextRequest {
  const base = new Request("https://viafidei.example.com/api/admin/x", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://viafidei.example.com",
      "x-forwarded-host": "viafidei.example.com",
      "x-forwarded-proto": "https",
    },
  });
  return Object.assign(base, {
    nextUrl: new URL("https://viafidei.example.com/api/admin/x"),
    cookies: {
      get(name: string) {
        if (name === "vf_dev_id" && args.deviceCredential) {
          return { value: args.deviceCredential };
        }
        return undefined;
      },
    },
  }) as unknown as NextRequest;
}

describe("banned devices are blocked at request time", () => {
  it("a banned device returns 403 even with valid session and same-origin", async () => {
    prismaMock.bannedDevice.findUnique.mockResolvedValue({ active: true });
    prismaMock.bannedDevice.updateMany.mockResolvedValue({ count: 1 });

    const r = await gateAdminApiCall(buildReq({ deviceCredential: "banned-cookie-1" }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.response.status).toBe(403);
    }
  });

  it("requireAdmin is NOT invoked when the device is banned (short-circuit)", async () => {
    prismaMock.bannedDevice.findUnique.mockResolvedValue({ active: true });
    prismaMock.bannedDevice.updateMany.mockResolvedValue({ count: 1 });

    await gateAdminApiCall(buildReq({ deviceCredential: "banned-cookie-2" }));
    expect(requireAdminMock).not.toHaveBeenCalled();
  });

  it("an inactive ban row does NOT block the request", async () => {
    prismaMock.bannedDevice.findUnique.mockResolvedValue({ active: false });
    prismaMock.bannedDevice.updateMany.mockResolvedValue({ count: 0 });

    const r = await gateAdminApiCall(buildReq({ deviceCredential: "old-ban-cookie" }));
    expect(r.ok).toBe(true);
  });

  it("a request with NO device credential cookie is allowed (banned-device check is no-op)", async () => {
    // No ban check is even attempted when there's no cookie.
    const r = await gateAdminApiCall(buildReq({ deviceCredential: null }));
    expect(r.ok).toBe(true);
    expect(prismaMock.bannedDevice.findUnique).not.toHaveBeenCalled();
  });

  it("a banned device hit updates lastSeenAt so the admin page can show repeat attempts", async () => {
    prismaMock.bannedDevice.findUnique.mockResolvedValue({ active: true });
    let updated = false;
    prismaMock.bannedDevice.updateMany.mockImplementation(async () => {
      updated = true;
      return { count: 1 };
    });

    await gateAdminApiCall(buildReq({ deviceCredential: "active-ban-cookie" }));
    expect(updated).toBe(true);
  });
});
