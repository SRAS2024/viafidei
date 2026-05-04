import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requireAdminMock = vi.fn();
const listAdminUsersMock = vi.fn();

vi.mock("@/lib/auth/admin", () => ({
  requireAdmin: (...args: unknown[]) => requireAdminMock(...args),
}));

vi.mock("@/lib/data/admin-users", () => ({
  listAdminUsers: (...args: unknown[]) => listAdminUsersMock(...args),
}));

import { GET } from "@/app/api/admin/users/route";
import type { NextRequest } from "next/server";

function buildRequest(qs = ""): NextRequest {
  return new Request(`http://localhost/api/admin/users${qs}`, {
    method: "GET",
  }) as unknown as NextRequest;
}

beforeEach(() => {
  requireAdminMock.mockReset();
  listAdminUsersMock.mockReset();
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
