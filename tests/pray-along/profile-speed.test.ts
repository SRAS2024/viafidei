/**
 * A member's pray-along speed is saved to their profile (so it follows them to every
 * browser): only 1, 1.25 or 1.5, or null for the normal speed.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  prisma: {
    profile: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    user: { update: vi.fn() },
  },
}));
vi.mock("@/lib/db/client", () => db);

import { updateProfile } from "@/lib/data/profile";

beforeEach(() => {
  vi.clearAllMocks();
  db.prisma.profile.findUnique.mockResolvedValue({ userId: "u1" });
  db.prisma.profile.update.mockImplementation(async ({ data }: { data: unknown }) => data);
});

describe("updateProfile: the pray-along speed", () => {
  it("saves each of the speeds", async () => {
    for (const audioRate of [1, 1.25, 1.5]) {
      const result = await updateProfile("u1", { audioRate });
      expect(result.ok).toBe(true);
      expect(db.prisma.profile.update).toHaveBeenLastCalledWith({
        where: { userId: "u1" },
        data: { audioRate },
      });
    }
  });

  it("returns to the normal speed with null", async () => {
    await updateProfile("u1", { audioRate: null });
    expect(db.prisma.profile.update).toHaveBeenLastCalledWith({
      where: { userId: "u1" },
      data: { audioRate: null },
    });
  });

  it("refuses any other speed and saves nothing", async () => {
    expect(await updateProfile("u1", { audioRate: 2 })).toEqual({
      ok: false,
      reason: "invalid_rate",
    });
    expect(db.prisma.profile.update).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/profile: the pray-along speed", () => {
  const auth = { requireUser: vi.fn() };
  const update = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    vi.doMock("@/lib/auth", () => auth);
    vi.doMock("@/lib/security/rate-limit", () => ({
      RATE_POLICIES: { profileWrite: { windowMs: 60_000, max: 30 } },
      rateLimit: vi.fn(async () => ({ ok: true, remaining: 10, resetAt: Date.now() + 60_000 })),
    }));
    vi.doMock("@/lib/data/profile", () => ({
      getProfileForUser: vi.fn(),
      updateProfile: update,
    }));
    vi.doMock("@/lib/audit", () => ({ writeAudit: vi.fn() }));
    vi.doMock("next/headers", () => ({ cookies: async () => ({ set: vi.fn(), delete: vi.fn() }) }));
    auth.requireUser.mockResolvedValue({ id: "u1", email: "member@example.test" });
    update.mockResolvedValue({ ok: true, profile: {} });
  });

  const patch = async (body: unknown) => {
    const { PATCH } = await import("@/app/api/profile/route");
    return PATCH(
      new NextRequest(
        new Request("http://localhost/api/profile", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
      ),
    );
  };

  it("takes a speed the player offers", async () => {
    const res = await patch({ audioRate: 1.25 });
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith("u1", { audioRate: 1.25 });
  });

  it("refuses a speed the player never offers", async () => {
    const res = await patch({ audioRate: 4 });
    expect(res.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });
});
