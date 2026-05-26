/**
 * Request-path defender hooks (spec §21). Confirms the request-path
 * helpers map to the right DefendInput shape and don't ban normal
 * visitors.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/security-defender", () => ({
  defend: vi.fn(async () => ({
    actionType: "OBSERVE" as const,
    actionTaken: "Observed; no action.",
    recordId: "r1",
  })),
}));

import {
  defendAdminRouteProbing,
  defendBannedDeviceReuse,
  defendConfirmedBruteForce,
  defendFailedAdminLogin,
  defendRedirectToLogin,
  defendUnauthorizedMutation,
  defendValidAdminNavigation,
} from "@/lib/admin-worker/request-defender";
import { defend } from "@/lib/admin-worker/security-defender";

const prisma = {} as unknown as Parameters<typeof defendRedirectToLogin>[0]["prisma"];

describe("request-path defender (spec §21)", () => {
  it("defendRedirectToLogin classifies as Info — no ban, no email", async () => {
    vi.mocked(defend).mockClear();
    await defendRedirectToLogin({ prisma, route: "/admin" });
    expect(vi.mocked(defend)).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({ classification: "Info", eventType: "redirect_to_login" }),
    );
  });

  it("defendValidAdminNavigation classifies as Info", async () => {
    vi.mocked(defend).mockClear();
    await defendValidAdminNavigation({ prisma, route: "/admin/checklist" });
    expect(vi.mocked(defend)).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({ classification: "Info", eventType: "admin_navigation" }),
    );
  });

  it("defendFailedAdminLogin classifies as Suspicious", async () => {
    vi.mocked(defend).mockClear();
    await defendFailedAdminLogin({ prisma, attemptsInWindow: 1 });
    expect(vi.mocked(defend)).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({ classification: "Suspicious", eventType: "admin_failed_login" }),
    );
  });

  it("defendFailedAdminLogin at 3+ attempts records Suspicious with higher confidence", async () => {
    vi.mocked(defend).mockClear();
    await defendFailedAdminLogin({ prisma, attemptsInWindow: 3 });
    const call = vi.mocked(defend).mock.calls[0][1];
    expect(call.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it("defendConfirmedBruteForce classifies as Breach with high confidence", async () => {
    vi.mocked(defend).mockClear();
    await defendConfirmedBruteForce({
      prisma,
      deviceFingerprintHash: "fp:abc",
      attemptsInWindow: 10,
    });
    expect(vi.mocked(defend)).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({
        classification: "Breach",
        eventType: "admin_brute_force_confirmed",
        confidence: 0.95,
        deviceFingerprintHash: "fp:abc",
      }),
    );
  });

  it("defendUnauthorizedMutation with a fingerprint classifies as Breach (high confidence)", async () => {
    vi.mocked(defend).mockClear();
    await defendUnauthorizedMutation({
      prisma,
      route: "/api/admin/users",
      deviceFingerprintHash: "fp:abc",
    });
    const call = vi.mocked(defend).mock.calls[0][1];
    expect(call.classification).toBe("Breach");
    expect(call.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("defendUnauthorizedMutation without fingerprint stays at lower confidence", async () => {
    vi.mocked(defend).mockClear();
    await defendUnauthorizedMutation({
      prisma,
      route: "/api/admin/users",
    });
    const call = vi.mocked(defend).mock.calls[0][1];
    expect(call.classification).toBe("Breach");
    expect(call.confidence).toBeLessThan(0.7);
  });

  it("defendAdminRouteProbing classifies as Breach", async () => {
    vi.mocked(defend).mockClear();
    await defendAdminRouteProbing({
      prisma,
      probedRoutes: 8,
      deviceFingerprintHash: "fp:probe",
    });
    expect(vi.mocked(defend)).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({
        classification: "Breach",
        eventType: "admin_route_probe",
        confidence: 0.92,
      }),
    );
  });

  it("defendBannedDeviceReuse classifies as Suspicious", async () => {
    vi.mocked(defend).mockClear();
    await defendBannedDeviceReuse({ prisma, deviceFingerprintHash: "fp:banned" });
    expect(vi.mocked(defend)).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({
        classification: "Suspicious",
        eventType: "banned_device_reuse",
      }),
    );
  });

  it("returns null (does not throw) when defend() throws — fire-and-forget", async () => {
    vi.mocked(defend).mockRejectedValueOnce(new Error("DB down"));
    const result = await defendRedirectToLogin({ prisma, route: "/admin" });
    expect(result).toBeNull();
  });
});
