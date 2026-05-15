import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { writeAudit } from "@/lib/audit/log";

beforeEach(() => {
  resetPrismaMock();
});

describe("writeAudit", () => {
  it("creates an AdminAuditLog row with the given action / entityType / entityId", async () => {
    prismaMock.adminAuditLog.create.mockResolvedValue({});
    await writeAudit({
      action: "admin.user_account.deleted",
      entityType: "User",
      entityId: "u1",
      actorUsername: "admin",
      ipAddress: "203.0.113.10",
      userAgent: "vitest",
      requestId: "req-xyz",
    });
    expect(prismaMock.adminAuditLog.create).toHaveBeenCalledTimes(1);
    const args = prismaMock.adminAuditLog.create.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(args.data.action).toBe("admin.user_account.deleted");
    expect(args.data.entityType).toBe("User");
    expect(args.data.entityId).toBe("u1");
    expect(args.data.actorUsername).toBe("admin");
    expect(args.data.ipAddress).toBe("203.0.113.10");
    expect(args.data.userAgent).toBe("vitest");
    expect(args.data.requestId).toBe("req-xyz");
  });

  it("passes through previousValue / newValue when provided", async () => {
    prismaMock.adminAuditLog.create.mockResolvedValue({});
    await writeAudit({
      action: "admin.prayer.update",
      entityType: "Prayer",
      entityId: "p1",
      previousValue: { title: "Old" },
      newValue: { title: "New" },
    });
    const args = prismaMock.adminAuditLog.create.mock.calls[0][0] as {
      data: { previousValue: unknown; newValue: unknown };
    };
    expect(args.data.previousValue).toEqual({ title: "Old" });
    expect(args.data.newValue).toEqual({ title: "New" });
  });

  it("never throws even when the Prisma write fails", async () => {
    prismaMock.adminAuditLog.create.mockRejectedValue(new Error("DB down"));
    // The audit pipeline is intentionally best-effort. If logging breaks,
    // the caller's destructive action must still succeed — we never want
    // a failing audit insert to cancel a legitimate admin action.
    await expect(
      writeAudit({
        action: "admin.test",
        entityType: "Test",
        entityId: "x",
      }),
    ).resolves.toBeUndefined();
  });

  it("defaults missing optional fields to null in the row", async () => {
    prismaMock.adminAuditLog.create.mockResolvedValue({});
    await writeAudit({
      action: "admin.minimal",
      entityType: "Test",
      entityId: "x",
    });
    const args = prismaMock.adminAuditLog.create.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(args.data.actorUsername).toBeNull();
    expect(args.data.ipAddress).toBeNull();
    expect(args.data.userAgent).toBeNull();
    expect(args.data.requestId).toBeNull();
  });
});
