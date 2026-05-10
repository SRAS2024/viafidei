import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

const requireAdminMock = vi.fn();
const verifyAdminCredentialsMock = vi.fn();
const rateLimitMock = vi.fn();
const writeAuditMock = vi.fn();

vi.mock("@/lib/auth/admin", () => ({
  requireAdmin: (...args: unknown[]) => requireAdminMock(...args),
  verifyAdminCredentials: (...args: unknown[]) => verifyAdminCredentialsMock(...args),
}));

vi.mock("@/lib/security/rate-limit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/security/rate-limit")>(
    "@/lib/security/rate-limit",
  );
  return { ...actual, rateLimit: (...args: unknown[]) => rateLimitMock(...args) };
});

vi.mock("@/lib/audit", () => ({
  writeAudit: (...args: unknown[]) => writeAuditMock(...args),
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

// Add the delete method to the prisma mock surface.
beforeEach(() => {
  resetPrismaMock();
  (prismaMock.user as unknown as { delete: ReturnType<typeof vi.fn> }).delete = vi.fn();
  requireAdminMock.mockReset();
  verifyAdminCredentialsMock.mockReset();
  rateLimitMock.mockReset();
  writeAuditMock.mockReset();
  rateLimitMock.mockResolvedValue({ ok: true, remaining: 10, resetAt: Date.now() + 60_000 });
  requireAdminMock.mockResolvedValue({ username: "admin", signedInAt: Date.now() });
  verifyAdminCredentialsMock.mockReturnValue(true);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

import type { NextRequest } from "next/server";

async function callDelete(id: string, body: unknown): Promise<Response> {
  const { DELETE } = await import("@/app/api/admin/users/[id]/route");
  const req = new Request(`http://localhost/api/admin/users/${id}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.9" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
  return DELETE(req, { params: { id } });
}

describe("DELETE /api/admin/users/[id]", () => {
  it("rejects non-admin callers with 401 without touching prisma", async () => {
    requireAdminMock.mockResolvedValue(null);
    const res = await callDelete("u1", { password: "p" });
    expect(res.status).toBe(401);
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it("rejects a wrong admin password with 401 password_invalid", async () => {
    verifyAdminCredentialsMock.mockReturnValue(false);
    const res = await callDelete("u1", { password: "nope" });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string; message: string };
    expect(body.message).toBe("password_invalid");
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it("returns 400 invalid when the body is missing the password", async () => {
    const res = await callDelete("u1", {});
    expect(res.status).toBe(400);
  });

  it("returns 404 not_found when the target user does not exist", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    const res = await callDelete("ghost", { password: "p" });
    expect(res.status).toBe(404);
  });

  it("refuses to delete ADMIN-role rows with 403 cannot_delete_admin", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "admin1",
      email: "a@example.com",
      firstName: "Admin",
      lastName: "User",
      role: "ADMIN",
    });
    const res = await callDelete("admin1", { password: "p" });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { message: string };
    expect(body.message).toBe("cannot_delete_admin");
    const userMock = prismaMock.user as unknown as { delete: ReturnType<typeof vi.fn> };
    expect(userMock.delete).not.toHaveBeenCalled();
  });

  it("deletes the user and writes an audit log entry on success", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "u1",
      email: "u@example.com",
      firstName: "Maria",
      lastName: "Goretti",
      role: "USER",
    });
    const userMock = prismaMock.user as unknown as { delete: ReturnType<typeof vi.fn> };
    userMock.delete.mockResolvedValue({});

    const res = await callDelete("u1", { password: "right" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; deleted: boolean; id: string };
    expect(body).toEqual({ ok: true, deleted: true, id: "u1" });

    expect(userMock.delete).toHaveBeenCalledWith({ where: { id: "u1" } });
    expect(writeAuditMock).toHaveBeenCalledTimes(1);
    const auditArg = writeAuditMock.mock.calls[0][0] as {
      action: string;
      entityType: string;
      entityId: string;
      previousValue: { email: string; firstName: string; lastName: string };
    };
    expect(auditArg.action).toBe("admin.user_account.deleted");
    expect(auditArg.entityType).toBe("User");
    expect(auditArg.entityId).toBe("u1");
    expect(auditArg.previousValue.email).toBe("u@example.com");
    expect(auditArg.previousValue.firstName).toBe("Maria");
    expect(auditArg.previousValue.lastName).toBe("Goretti");
  });

  it("returns 429 when the rate limiter rejects", async () => {
    rateLimitMock.mockResolvedValue({ ok: false, remaining: 0, resetAt: Date.now() });
    const res = await callDelete("u1", { password: "p" });
    expect(res.status).toBe(429);
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });
});
