/**
 * Security defender decision policy.
 *
 * Spec section 14 + user clarification:
 *   - Suspicious activity NEVER triggers an automatic ban.
 *   - Confirmed brute-force (Breach + high confidence + known device)
 *     DOES trigger a ban.
 *   - Valid authenticated admin activity is never treated as suspicious
 *     — this is enforced upstream by `recordAdminLoginSuccess`; the
 *     defender itself only sees post-filtered events.
 *   - Only confirmed brute force results in automatic bans.
 */

import { describe, expect, it } from "vitest";

import { decideAction, DEFENDER_RULES } from "@/lib/admin-worker/security-defender";

const baseEvent = {
  eventType: "admin_failed_login_threshold_reached",
  severity: "warning",
  reason: "3+ failed logins",
  confidence: 0.95,
  deviceFingerprintHash: "abc123",
};

describe("decideAction", () => {
  it("never bans on Suspicious classification, even at high confidence", () => {
    const decision = decideAction({
      ...baseEvent,
      classification: "Suspicious",
      confidence: 0.99,
    });
    expect(decision.actionType).toBe("WARN");
  });

  it("bans on confirmed Breach with high confidence and known device", () => {
    const decision = decideAction({
      ...baseEvent,
      classification: "Breach",
      confidence: DEFENDER_RULES.banConfidence,
    });
    expect(decision.actionType).toBe("BAN_DEVICE");
  });

  it("escalates on Breach when device fingerprint is unknown", () => {
    const decision = decideAction({
      ...baseEvent,
      classification: "Breach",
      confidence: DEFENDER_RULES.banConfidence,
      deviceFingerprintHash: undefined,
    });
    expect(decision.actionType).toBe("ESCALATE");
  });

  it("escalates on Breach with below-threshold confidence", () => {
    const decision = decideAction({
      ...baseEvent,
      classification: "Breach",
      confidence: 0.5,
    });
    expect(decision.actionType).toBe("ESCALATE");
  });

  it("observes on Info classification", () => {
    const decision = decideAction({
      ...baseEvent,
      classification: "Info",
    });
    expect(decision.actionType).toBe("OBSERVE");
  });
});
