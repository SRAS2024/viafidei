/**
 * Security defender request-path behaviour (spec §21). Verifies:
 *   - normal redirect to login is NOT a Breach
 *   - valid admin session navigation does NOT trigger suspicious activity
 *   - confirmed brute force gets banned
 *   - unauthorized mutation gets banned with high confidence
 *   - normal visitors at /admin/login are not banned
 */

import { describe, expect, it } from "vitest";

import { decideAction } from "@/lib/admin-worker/security-defender";

describe("security defender — request-path classifications (spec §21)", () => {
  it("does NOT ban on a normal redirect-to-login event", () => {
    // The redirect itself is "Info" classification, not Breach.
    const r = decideAction({
      eventType: "redirect_to_login",
      classification: "Info",
      severity: "info",
      route: "/admin",
      reason: "Unauthenticated request redirected to /admin/login.",
      confidence: 1.0,
    });
    expect(r.actionType).toBe("OBSERVE");
  });

  it("does NOT ban a valid admin session navigation", () => {
    // Valid admin nav generates an Info event, never a Breach.
    const r = decideAction({
      eventType: "admin_navigation",
      classification: "Info",
      severity: "info",
      route: "/admin/checklist",
      reason: "Authenticated admin navigated to a page.",
      confidence: 1.0,
    });
    expect(r.actionType).toBe("OBSERVE");
  });

  it("WARN (not ban) on a single failed admin login (Suspicious)", () => {
    const r = decideAction({
      eventType: "admin_failed_login",
      classification: "Suspicious",
      severity: "warning",
      route: "/admin/login",
      reason: "1 failed login.",
      confidence: 0.5,
    });
    expect(r.actionType).toBe("WARN");
  });

  it("WARN (not ban) after three failed admin logins — suspicious activity, not breach yet", () => {
    const r = decideAction({
      eventType: "admin_failed_login_threshold_reached",
      classification: "Suspicious",
      severity: "warning",
      route: "/admin/login",
      reason: "3 consecutive admin-password failures.",
      confidence: 0.8,
    });
    expect(r.actionType).toBe("WARN");
  });

  it("BAN_DEVICE on confirmed brute force (Breach with high confidence + device fingerprint)", () => {
    const r = decideAction({
      eventType: "admin_brute_force_confirmed",
      classification: "Breach",
      severity: "critical",
      route: "/admin/login",
      reason: "10 failed admin logins from a single device in 60 seconds.",
      confidence: 0.95,
      deviceFingerprintHash: "fp:device-x",
    });
    expect(r.actionType).toBe("BAN_DEVICE");
  });

  it("ESCALATE (not auto-ban) on Breach with lower confidence", () => {
    const r = decideAction({
      eventType: "unauthorized_mutation_attempt",
      classification: "Breach",
      severity: "warning",
      route: "/api/admin/users",
      reason: "Anonymous POST to admin route.",
      confidence: 0.5,
      deviceFingerprintHash: "fp:device-y",
    });
    expect(r.actionType).toBe("ESCALATE");
  });

  it("does not ban on Breach when no device fingerprint is available", () => {
    const r = decideAction({
      eventType: "unauthorized_mutation_attempt",
      classification: "Breach",
      severity: "critical",
      route: "/api/admin/users",
      reason: "Confirmed bypass with no fingerprint.",
      confidence: 0.95,
      // no deviceFingerprintHash
    });
    expect(r.actionType).toBe("ESCALATE");
  });

  it("BAN_DEVICE on confirmed admin route probing (Breach + confidence high)", () => {
    const r = decideAction({
      eventType: "admin_route_probe",
      classification: "Breach",
      severity: "critical",
      route: "/admin/.env",
      reason: "Repeated probes for sensitive admin paths from one device.",
      confidence: 0.92,
      deviceFingerprintHash: "fp:probe",
    });
    expect(r.actionType).toBe("BAN_DEVICE");
  });

  it("normal visitor landing on /admin/login is just an Info event — no warn, no ban", () => {
    const r = decideAction({
      eventType: "admin_login_view",
      classification: "Info",
      severity: "info",
      route: "/admin/login",
      reason: "Anonymous visitor loaded the admin login page.",
      confidence: 1.0,
    });
    expect(r.actionType).toBe("OBSERVE");
  });
});
