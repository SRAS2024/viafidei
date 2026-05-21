import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

const sendAdminLoginAlertMock = vi.fn().mockResolvedValue({ ok: true, delivery: "sent" });

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));
vi.mock("@/lib/email", () => ({
  sendAdminLoginAlert: (...a: unknown[]) => sendAdminLoginAlertMock(...a),
}));

import {
  recordAdminLoginFailure,
  recordAdminLoginSuccess,
} from "@/lib/security/admin-login-events";
import { _resetAdminActionRateWindowForTests } from "@/lib/audit/admin-action-log";

beforeEach(() => {
  resetPrismaMock();
  sendAdminLoginAlertMock.mockClear();
  _resetAdminActionRateWindowForTests();
  prismaMock.securityEvent.create.mockResolvedValue({ id: "evt-1" });
  prismaMock.adminActionLog.create.mockResolvedValue({ id: "act-1" });
  prismaMock.adminActionLog.findFirst.mockResolvedValue(null);
  process.env.SESSION_SECRET = "test-session-secret-must-be-32-chars-long";
});

describe("recordAdminLoginSuccess", () => {
  it("writes a SecurityEvent of type admin_login_success", async () => {
    await recordAdminLoginSuccess({
      username: "admin",
      ipAddress: "203.0.113.5",
      userAgent: "Mozilla/5.0 (Windows NT 10.0) Chrome/124",
      deviceCredential: "device-1",
      route: "/api/admin/login",
    });
    expect(prismaMock.securityEvent.create).toHaveBeenCalledTimes(1);
    const data = prismaMock.securityEvent.create.mock.calls[0][0].data as {
      eventType: string;
      classification: string;
    };
    expect(data.eventType).toBe("admin_login_success");
    // Benign audit — never classified Suspicious or Breach.
    expect(data.classification).toBe("Audit");
  });

  it("writes an AdminActionLog row of type admin_login_success", async () => {
    await recordAdminLoginSuccess({ username: "admin", deviceCredential: "device-1" });
    expect(prismaMock.adminActionLog.create).toHaveBeenCalledTimes(1);
    const data = prismaMock.adminActionLog.create.mock.calls[0][0].data as {
      actionType: string;
      result: string;
    };
    expect(data.actionType).toBe("admin_login_success");
    expect(data.result).toBe("success");
  });

  it("sends the Admin Log In email", async () => {
    await recordAdminLoginSuccess({
      username: "admin",
      userAgent: "Mozilla/5.0 (Macintosh) Safari/17",
      deviceCredential: "device-1",
    });
    expect(sendAdminLoginAlertMock).toHaveBeenCalledTimes(1);
    const params = sendAdminLoginAlertMock.mock.calls[0][0] as {
      successful: boolean;
      username: string;
    };
    expect(params.successful).toBe(true);
    expect(params.username).toBe("admin");
  });

  it("marks a previously-seen device as recognised", async () => {
    prismaMock.adminActionLog.findFirst.mockResolvedValue({ id: "prior" });
    await recordAdminLoginSuccess({ username: "admin", deviceCredential: "device-1" });
    const params = sendAdminLoginAlertMock.mock.calls[0][0] as { deviceSeenBefore: boolean };
    expect(params.deviceSeenBefore).toBe(true);
  });

  it("never throws even if the database write fails", async () => {
    prismaMock.securityEvent.create.mockRejectedValue(new Error("db down"));
    prismaMock.adminActionLog.create.mockRejectedValue(new Error("db down"));
    await expect(
      recordAdminLoginSuccess({ username: "admin", deviceCredential: "device-1" }),
    ).resolves.toBeUndefined();
  });
});

describe("recordAdminLoginFailure", () => {
  it("writes a SecurityEvent of type admin_login_failed", async () => {
    const id = await recordAdminLoginFailure({
      username: "admin",
      ipAddress: "203.0.113.5",
      deviceCredential: "device-1",
    });
    expect(id).toBe("evt-1");
    const data = prismaMock.securityEvent.create.mock.calls[0][0].data as { eventType: string };
    expect(data.eventType).toBe("admin_login_failed");
  });
});
