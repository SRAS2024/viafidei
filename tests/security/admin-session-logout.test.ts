/**
 * Spec item 12 — signing out invalidates SERVER-side session state.
 *
 * Deleting the cookie is not enough: any copy of the encrypted cookie taken
 * before sign-out would keep working until it expired. The AdminSession row
 * has to be revoked, it has to be revoked BEFORE the cookie is destroyed
 * (otherwise a failed cookie write leaves a live session behind), and a
 * revoked row must stop passing the admin authorization checks (proved in
 * tests/security/admin-session.test.ts and tests/auth/admin.test.ts).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";
import { createCookieJar } from "../helpers/cookies-mock";

const cookieJar = createCookieJar({ vf_theme: "dark", vf_locale: "es" });
vi.mock("next/headers", () => ({ cookies: () => cookieJar }));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

/** Order of operations is the property under test, so record the sequence. */
const order: string[] = [];

const revokeCurrentAdminSessionMock = vi.fn(async () => {
  order.push("revoke");
  return true;
});
vi.mock("@/lib/auth/admin-session", () => ({
  revokeCurrentAdminSession: (...args: unknown[]) => revokeCurrentAdminSessionMock(...args),
}));

const destroyMock = vi.fn(() => {
  order.push("destroy-cookie");
});
vi.mock("@/lib/auth", () => ({
  getSession: async () => ({ destroy: destroyMock }),
}));

import type { NextRequest } from "next/server";
import { POST as logout } from "@/app/api/auth/logout/route";

function req(): NextRequest {
  const url = "https://viafidei.example.com/api/auth/logout";
  const base = new Request(url, {
    method: "POST",
    headers: { host: "viafidei.example.com", "x-forwarded-proto": "https" },
  });
  return Object.assign(base, { nextUrl: new URL(url) }) as unknown as NextRequest;
}

beforeEach(() => {
  resetPrismaMock();
  order.length = 0;
  revokeCurrentAdminSessionMock.mockClear();
  destroyMock.mockClear();
  process.env.SESSION_SECRET = "test-session-secret-must-be-32-chars-long";
});

describe("POST /api/auth/logout", () => {
  it("revokes the server-side admin session BEFORE clearing the cookie", async () => {
    await logout(req());
    expect(revokeCurrentAdminSessionMock).toHaveBeenCalledWith("logout");
    expect(order).toEqual(["revoke", "destroy-cookie"]);
  });

  it("still clears the browser cookies and redirects", async () => {
    const res = await logout(req());
    expect(destroyMock).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(303);
    expect(cookieJar.delete).toHaveBeenCalled();
  });
});
