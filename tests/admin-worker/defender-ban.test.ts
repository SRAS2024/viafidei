/**
 * Defender auto-ban — proves "brute force attempts are banned" (spec
 * sections 14, 24). The decideAction returns BAN_DEVICE for Breach +
 * high confidence + known device; the defend() path then inserts the
 * BannedDevice row + sends the Admin Worker Banned Device email.
 */

import type { AdminWorkerSecurityAction, BannedDevice } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/email/admin-send", () => ({
  sendAdminWorkerBannedDevice: vi.fn(async () => ({ ok: true, delivery: "sent" }) as const),
}));

import { defend } from "@/lib/admin-worker/security-defender";
import { sendAdminWorkerBannedDevice } from "@/lib/email/admin-send";

function makePrisma() {
  const actions: Partial<AdminWorkerSecurityAction>[] = [];
  const bans: Partial<BannedDevice>[] = [];
  const logs: unknown[] = [];
  return {
    actions,
    bans,
    logs,
    prisma: {
      adminWorkerSecurityAction: {
        create: vi.fn(async ({ data }: { data: Partial<AdminWorkerSecurityAction> }) => {
          const row = { id: `a${actions.length + 1}`, ...data };
          actions.push(row);
          return row;
        }),
      },
      bannedDevice: {
        upsert: vi.fn(async ({ create }: { create: Partial<BannedDevice> }) => {
          bans.push(create);
          return create;
        }),
      },
      adminWorkerLog: {
        create: vi.fn(async ({ data }: { data: unknown }) => {
          logs.push(data);
          return { id: `l${logs.length}` };
        }),
      },
    } as unknown as Parameters<typeof defend>[0],
  };
}

describe("defend()", () => {
  it("inserts a BannedDevice row when a Breach is confirmed at high confidence", async () => {
    vi.mocked(sendAdminWorkerBannedDevice).mockClear();
    const { prisma, bans } = makePrisma();

    const outcome = await defend(prisma, {
      eventType: "admin_password_brute_force",
      classification: "Breach",
      severity: "critical",
      deviceFingerprintHash: "device-hash",
      ipHash: "ip-hash",
      userAgentHash: "ua-hash",
      route: "/api/admin/login",
      reason: "5 consecutive admin-password failures",
      confidence: 0.95,
    });
    expect(outcome.actionType).toBe("BAN_DEVICE");
    expect(bans).toHaveLength(1);
    expect(bans[0].deviceCredentialHash).toBe("device-hash");
    expect(bans[0].createdBy).toBe("admin_worker");
    expect(sendAdminWorkerBannedDevice).toHaveBeenCalledTimes(1);
  });

  it("does NOT ban on Suspicious classification, even at high confidence", async () => {
    vi.mocked(sendAdminWorkerBannedDevice).mockClear();
    const { prisma, bans } = makePrisma();
    const outcome = await defend(prisma, {
      eventType: "admin_failed_login_threshold_reached",
      classification: "Suspicious",
      severity: "warning",
      deviceFingerprintHash: "device-hash",
      route: "/api/admin/login",
      reason: "3 failed logins",
      confidence: 0.99,
    });
    expect(outcome.actionType).toBe("WARN");
    expect(bans).toHaveLength(0);
    expect(sendAdminWorkerBannedDevice).not.toHaveBeenCalled();
  });

  it("logs an error but does not throw when the email fails", async () => {
    vi.mocked(sendAdminWorkerBannedDevice).mockRejectedValueOnce(new Error("smtp"));
    const { prisma, bans, logs } = makePrisma();
    const outcome = await defend(prisma, {
      eventType: "admin_password_brute_force",
      classification: "Breach",
      severity: "critical",
      deviceFingerprintHash: "device-hash-2",
      route: "/api/admin/login",
      reason: "brute force",
      confidence: 0.95,
    });
    expect(outcome.actionType).toBe("BAN_DEVICE");
    expect(bans).toHaveLength(1);
    expect(logs.some((l) => (l as { eventName: string }).eventName === "ban_email_failed")).toBe(
      true,
    );
  });
});
