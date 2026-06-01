/**
 * admin-worker:proof:security
 *
 * Proves the defender wiring (spec §503-513) end-to-end against the REAL
 * modules:
 *   1. valid admin activity does NOT send suspicious-activity emails
 *      (it sends the Admin Log In email instead)
 *   2. failed logins trigger Suspicious Activity after the threshold
 *   3. confirmed brute force bans the device
 *   4. unauthorized mutation attempts are banned (high confidence)
 *   5. banned device reuse is detected + blocked
 *   …and a normal redirect-to-login bans nobody.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendAdminLoginAlert = vi.fn(async () => ({ ok: true }));
const sendSuspiciousActivityAlert = vi.fn(async () => ({ ok: true }));

vi.mock("@/lib/email", () => ({
  sendAdminLoginAlert: (...a: unknown[]) => sendAdminLoginAlert(...a),
  sendSuspiciousActivityAlert: (...a: unknown[]) => sendSuspiciousActivityAlert(...a),
}));

import { decideAction, defend } from "@/lib/admin-worker/security-defender";
import {
  defendValidAdminNavigation,
  defendRedirectToLogin,
  defendConfirmedBruteForce,
  defendUnauthorizedMutation,
} from "@/lib/admin-worker/request-defender";
import { detectBannedDeviceReuse } from "@/lib/admin-worker/security-detectors";
import {
  recordAdminPasswordFailure,
  _resetAllAdminFailureCountersForTests,
} from "@/lib/security/admin-failure-counter";
import { recordAdminLoginSuccess } from "@/lib/security/admin-login-events";

beforeEach(() => {
  sendAdminLoginAlert.mockClear();
  sendSuspiciousActivityAlert.mockClear();
  _resetAllAdminFailureCountersForTests();
});
afterEach(() => {
  _resetAllAdminFailureCountersForTests();
});

/** In-memory banned-device + security-action store. */
function makePrisma() {
  const banned = new Map<string, Record<string, unknown>>();
  const actions: Array<Record<string, unknown>> = [];
  return {
    store: { banned, actions },
    prisma: {
      adminWorkerSecurityAction: {
        create: vi.fn(async (args: { data: Record<string, unknown> }) => {
          const row = { id: `sa-${actions.length + 1}`, ...args.data };
          actions.push(row);
          return row;
        }),
      },
      adminWorkerLog: { create: vi.fn(async () => ({ id: "l" })) },
      bannedDevice: {
        upsert: vi.fn(
          async (args: {
            where: { deviceCredentialHash: string };
            create: Record<string, unknown>;
          }) => {
            banned.set(args.where.deviceCredentialHash, args.create);
            return { id: "bd-1" };
          },
        ),
        findUnique: vi.fn(async (args: { where: { deviceCredentialHash: string } }) => {
          const row = banned.get(args.where.deviceCredentialHash);
          return row ? { active: true, ...row } : null;
        }),
      },
    },
  };
}

describe("admin-worker:proof:security", () => {
  it("1. valid admin login sends Admin Log In email, NOT a Suspicious Activity email", async () => {
    // recordAdminLoginSuccess is best-effort and swallows DB errors; we
    // only care that it routes to the Admin Log In email and never to the
    // Suspicious Activity email.
    await recordAdminLoginSuccess({
      username: "admin",
      ipAddress: "203.0.113.5",
      userAgent: "Mozilla/5.0",
      deviceCredential: "device-valid-admin",
      route: "/api/admin/login",
    });
    expect(sendAdminLoginAlert).toHaveBeenCalledTimes(1);
    expect(sendSuspiciousActivityAlert).not.toHaveBeenCalled();
  });

  it("1b. valid admin navigation only OBSERVEs (never WARN/ban → no suspicious email)", async () => {
    const { prisma, store } = makePrisma();
    const out = await defendValidAdminNavigation({
      prisma: prisma as never,
      route: "/admin/checklist",
    });
    expect(out?.actionType).toBe("OBSERVE");
    expect(store.banned.size).toBe(0);
  });

  it("2. failed logins escalate to Suspicious on the third consecutive failure", () => {
    const ctx = {
      account: "admin",
      ipAddress: "203.0.113.9",
      deviceCredential: "device-bruteforce",
    };
    expect(recordAdminPasswordFailure(ctx).classification).toBe("below_threshold");
    expect(recordAdminPasswordFailure(ctx).classification).toBe("below_threshold");
    // The third consecutive failure is what the login route uses to fire
    // the Suspicious Activity email.
    expect(recordAdminPasswordFailure(ctx).classification).toBe("suspicious");
  });

  it("3. confirmed brute force bans the device", async () => {
    const { prisma, store } = makePrisma();
    const out = await defendConfirmedBruteForce({
      prisma: prisma as never,
      deviceFingerprintHash: "hash-brute",
      route: "/api/admin/login",
      attemptsInWindow: 12,
    });
    expect(out?.actionType).toBe("BAN_DEVICE");
    expect(store.banned.has("hash-brute")).toBe(true);
  });

  it("4. unauthorized mutation with a device fingerprint is banned (high confidence)", async () => {
    const { prisma, store } = makePrisma();
    const out = await defendUnauthorizedMutation({
      prisma: prisma as never,
      deviceFingerprintHash: "hash-mutation",
      route: "/api/admin/checklist",
    });
    expect(out?.actionType).toBe("BAN_DEVICE");
    expect(store.banned.has("hash-mutation")).toBe(true);
  });

  it("5. banned device reuse is detected (and thus blockable)", async () => {
    const { prisma } = makePrisma();
    // Ban the device via the defender first.
    await defend(prisma as never, {
      eventType: "admin_brute_force_confirmed",
      classification: "Breach",
      severity: "critical",
      confidence: 0.95,
      deviceFingerprintHash: "device-reuse-raw",
      reason: "brute force",
    });
    // detectBannedDeviceReuse hashes the raw credential — so we must seed
    // the ban under the hashed key. Re-issue the ban using a known hash by
    // banning the fingerprint of the raw credential.
    const { deviceCredentialFingerprint } = await import("@/lib/security/hash");
    const hash = deviceCredentialFingerprint("device-reuse-raw");
    await defend(prisma as never, {
      eventType: "admin_brute_force_confirmed",
      classification: "Breach",
      severity: "critical",
      confidence: 0.95,
      deviceFingerprintHash: hash ?? "device-reuse-hash",
      reason: "brute force",
    });
    const reused = await detectBannedDeviceReuse(prisma as never, {
      deviceCredential: "device-reuse-raw",
      route: "/admin",
    });
    expect(reused).toBe(true);
  });

  it("normal redirect-to-login bans nobody (Info → OBSERVE)", async () => {
    const { prisma, store } = makePrisma();
    const out = await defendRedirectToLogin({ prisma: prisma as never, route: "/admin" });
    expect(out?.actionType).toBe("OBSERVE");
    expect(store.banned.size).toBe(0);

    // And the pure decision for an Info event is always OBSERVE.
    expect(
      decideAction({
        eventType: "redirect_to_login",
        classification: "Info",
        severity: "info",
        reason: "redirect",
        confidence: 1,
      }).actionType,
    ).toBe("OBSERVE");
  });
});
