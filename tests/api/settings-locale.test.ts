/**
 * The language control saves to the account of whoever is signed in. It goes through
 * requireUser, so that a sign-in a password reset has ended cannot write to the account.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { createCookieJar, type FakeCookieJar } from "../helpers/cookies-mock";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

const requireUserMock = vi.fn();
let cookieJar: FakeCookieJar;

vi.mock("@/lib/auth/user", () => ({
  requireUser: () => requireUserMock(),
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("next/headers", () => ({
  cookies: () => cookieJar,
}));

import { POST } from "@/app/api/settings/locale/route";

function choose(locale: string): NextRequest {
  return new Request("http://localhost/api/settings/locale", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ locale }).toString(),
  }) as unknown as NextRequest;
}

beforeEach(() => {
  resetPrismaMock();
  requireUserMock.mockReset();
  cookieJar = createCookieJar();
  prismaMock.$transaction.mockResolvedValue([]);
});

describe("POST /api/settings/locale", () => {
  it("saves the language to the signed-in account", async () => {
    requireUserMock.mockResolvedValue({ id: "u1" });
    await POST(choose("es"));
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { language: "es" },
    });
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(cookieJar.__entries.get("vf_locale")).toBe("es");
  });

  it("writes nothing to any account for a sign-in that has ended, but still sets the browser's", async () => {
    requireUserMock.mockResolvedValue(null);
    const res = await POST(choose("es"));
    expect(res.status).toBe(303);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(cookieJar.__entries.get("vf_locale")).toBe("es");
  });

  it("does not ask who is signed in for an automatic choice, which saves nothing", async () => {
    await POST(choose(""));
    expect(requireUserMock).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("still answers if the account cannot be read", async () => {
    requireUserMock.mockRejectedValue(new Error("connection lost"));
    const res = await POST(choose("es"));
    expect(res.status).toBe(303);
    expect(cookieJar.__entries.get("vf_locale")).toBe("es");
  });
});
