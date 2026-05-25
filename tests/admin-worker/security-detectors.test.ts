/**
 * Section 14 explicit detectors — proves the worker can detect
 * unauthorized public-flag writes, internal-route mutation,
 * banned-device re-use, and suspicious request bursts.
 */

import { describe, expect, it, vi } from "vitest";

import {
  detectBannedDeviceReuse,
  detectInternalRouteManipulation,
  detectSetPublicFlagOutsideWorker,
  detectSuspiciousBurst,
} from "@/lib/admin-worker/security-detectors";

describe("detectSetPublicFlagOutsideWorker", () => {
  it("allows the admin worker itself to set the public flag", () => {
    expect(
      detectSetPublicFlagOutsideWorker({
        route: "/api/internal/publish",
        actor: "admin_worker",
        bodyKeys: ["isPublished"],
      }),
    ).toBe(false);
  });

  it("fires when a non-worker tries to set isPublished", () => {
    expect(
      detectSetPublicFlagOutsideWorker({
        route: "/api/admin/x",
        actor: "admin",
        bodyKeys: ["isPublished", "title"],
      }),
    ).toBe(true);
  });

  it("fires when a non-worker tries to set publicRenderReady", () => {
    expect(
      detectSetPublicFlagOutsideWorker({
        route: "/api/admin/x",
        actor: "admin",
        bodyKeys: ["publicRenderReady"],
      }),
    ).toBe(true);
  });
});

describe("detectInternalRouteManipulation", () => {
  it("fires on a POST to /api/internal/* from outside the worker", () => {
    expect(
      detectInternalRouteManipulation({
        route: "/api/internal/publish",
        method: "POST",
        actor: "admin",
      }),
    ).toBe(true);
  });

  it("does not fire on GET", () => {
    expect(
      detectInternalRouteManipulation({
        route: "/api/internal/publish",
        method: "GET",
        actor: "admin",
      }),
    ).toBe(false);
  });

  it("does not fire when the actor is the worker", () => {
    expect(
      detectInternalRouteManipulation({
        route: "/api/internal/publish",
        method: "POST",
        actor: "admin_worker",
      }),
    ).toBe(false);
  });
});

describe("detectSuspiciousBurst", () => {
  it("fires only above the admin-route threshold", () => {
    expect(detectSuspiciousBurst({ route: "/admin", recentRequestsInLastMinute: 25 })).toBe(false);
    expect(detectSuspiciousBurst({ route: "/admin", recentRequestsInLastMinute: 31 })).toBe(true);
  });

  it("has a higher threshold for public routes", () => {
    expect(detectSuspiciousBurst({ route: "/prayers", recentRequestsInLastMinute: 100 })).toBe(
      false,
    );
    expect(detectSuspiciousBurst({ route: "/prayers", recentRequestsInLastMinute: 200 })).toBe(
      true,
    );
  });
});

describe("detectBannedDeviceReuse", () => {
  it("returns false when no device credential is supplied", async () => {
    const prisma = {
      bannedDevice: { findUnique: vi.fn(async () => null) },
    } as unknown as Parameters<typeof detectBannedDeviceReuse>[0];
    expect(
      await detectBannedDeviceReuse(prisma, {
        reason: "missing credential",
      }),
    ).toBe(false);
  });

  it("returns true when the device hash matches an active banned row", async () => {
    const prisma = {
      bannedDevice: {
        findUnique: vi.fn(async () => ({ active: true })),
      },
    } as unknown as Parameters<typeof detectBannedDeviceReuse>[0];
    expect(
      await detectBannedDeviceReuse(prisma, {
        deviceCredential: "abcdef",
        reason: "re-use",
      }),
    ).toBe(true);
  });
});
