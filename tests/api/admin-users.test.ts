/**
 * GET /api/admin/users now runs through the centralized admin gate
 * (`gateAdminApiCall`) rather than a bare `requireAdmin()`, so the request
 * fixture here carries the pieces the gate reads: `nextUrl` and the device
 * credential cookie. CSRF is a no-op on this GET (safe method); what the gate
 * adds over the old guard is banned-device enforcement.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

const requireAdminMock = vi.fn();
const listAdminUsersMock = vi.fn();

vi.mock("@/lib/auth", () => ({
  requireAdmin: (...args: unknown[]) => requireAdminMock(...args),
}));
vi.mock("@/lib/security/security-events", () => ({
  reportSecurityBreach: vi.fn(),
  reportSuspiciousActivity: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

vi.mock("@/lib/data/admin-users", () => ({
  listAdminUsers: (...args: unknown[]) => listAdminUsersMock(...args),
}));

import { GET } from "@/app/api/admin/users/route";
import type { NextRequest } from "next/server";

function buildRequest(qs = "", device?: string): NextRequest {
  const url = `https://viafidei.example.com/api/admin/users${qs}`;
  const base = new Request(url, {
    method: "GET",
    headers: {
      host: "viafidei.example.com",
      "x-forwarded-host": "viafidei.example.com",
      "x-forwarded-proto": "https",
    },
  });
  return Object.assign(base, {
    nextUrl: new URL(url),
    cookies: {
      get(name: string) {
        if (name === "vf_dev_id" && device) return { value: device };
        return undefined;
      },
    },
  }) as unknown as NextRequest;
}

beforeEach(() => {
  resetPrismaMock();
  requireAdminMock.mockReset();
  listAdminUsersMock.mockReset();
  prismaMock.bannedDevice.findUnique.mockResolvedValue(null);
  process.env.SESSION_SECRET = "test-session-secret-must-be-32-chars-long";
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/admin/users", () => {
  it("rejects non-admin callers with 401", async () => {
    requireAdminMock.mockResolvedValue(null);
    const res = await GET(buildRequest());
    expect(res.status).toBe(401);
    expect(listAdminUsersMock).not.toHaveBeenCalled();
  });

  it("rejects a banned device with 403 before any admin work runs", async () => {
    requireAdminMock.mockResolvedValue({ username: "admin", signedInAt: Date.now() });
    prismaMock.bannedDevice.findUnique.mockResolvedValue({ active: true });
    const res = await GET(buildRequest("", "dev-banned"));
    expect(res.status).toBe(403);
    expect(listAdminUsersMock).not.toHaveBeenCalled();
  });

  it("returns the user listing for admin callers, omitting hashes/tokens", async () => {
    requireAdminMock.mockResolvedValue({ username: "admin", signedInAt: Date.now() });
    listAdminUsersMock.mockResolvedValue({
      rows: [
        {
          id: "u1",
          firstName: "Maria",
          lastName: "Goretti",
          email: "m@example.com",
          language: "en",
          createdAt: new Date("2024-01-01T00:00:00Z"),
          emailVerified: true,
          role: "USER",
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
      pageCount: 1,
    });
    const res = await GET(buildRequest("?q=maria&page=1"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; users: unknown[] };
    expect(body.ok).toBe(true);
    expect(body.users).toHaveLength(1);

    const json = JSON.stringify(body);
    expect(json).not.toMatch(/passwordHash/i);
    expect(json).not.toMatch(/tokenHash/i);
    expect(json).not.toMatch(/sessions?Token/i);
    expect(json).not.toMatch(/emailEncrypted/i);
    expect(json).not.toMatch(/nameEncrypted/i);
  });
});
