import { beforeEach, describe, expect, it } from "vitest";
import {
  recordAdminPasswordFailure,
  resetAdminPasswordFailureCounter,
  _resetAllAdminFailureCountersForTests,
  _readAdminFailureCounterForTests,
  SUSPICIOUS_FAILURE_THRESHOLD,
  BREACH_FAILURE_THRESHOLD,
} from "@/lib/security/admin-failure-counter";

describe("admin password failure counter — Suspicious vs Breach classification", () => {
  beforeEach(() => {
    _resetAllAdminFailureCountersForTests();
    process.env.SESSION_SECRET = "test-session-secret-must-be-32-chars-long";
  });

  it("the first two failures stay below threshold", () => {
    const args = { account: "admin", ipAddress: "1.2.3.4", deviceCredential: "dev-1" };
    for (let i = 0; i < SUSPICIOUS_FAILURE_THRESHOLD - 1; i++) {
      const result = recordAdminPasswordFailure(args);
      expect(result.classification).toBe("below_threshold");
      expect(result.count).toBe(i + 1);
    }
  });

  it("the THIRD consecutive failure (three or more in a row) triggers Suspicious", () => {
    const args = { account: "admin", ipAddress: "1.2.3.4", deviceCredential: "dev-1" };
    for (let i = 0; i < SUSPICIOUS_FAILURE_THRESHOLD - 1; i++) {
      recordAdminPasswordFailure(args);
    }
    const result = recordAdminPasswordFailure(args);
    expect(result.classification).toBe("suspicious");
    expect(result.count).toBe(SUSPICIOUS_FAILURE_THRESHOLD);
  });

  it("a high-burst failure pattern escalates to Breach", () => {
    const args = { account: "admin", ipAddress: "1.2.3.4", deviceCredential: "dev-1" };
    let lastClassification = "below_threshold";
    for (let i = 0; i < BREACH_FAILURE_THRESHOLD + 1; i++) {
      lastClassification = recordAdminPasswordFailure(args).classification;
    }
    expect(lastClassification).toBe("breach");
  });

  it("counters are keyed by account + IP + device — different keys do not aggregate", () => {
    for (let i = 0; i < SUSPICIOUS_FAILURE_THRESHOLD + 1; i++) {
      recordAdminPasswordFailure({
        account: "admin",
        ipAddress: "1.2.3.4",
        deviceCredential: "dev-1",
      });
    }
    // Different IP should still be below threshold.
    const otherIp = recordAdminPasswordFailure({
      account: "admin",
      ipAddress: "5.6.7.8",
      deviceCredential: "dev-1",
    });
    expect(otherIp.classification).toBe("below_threshold");
    expect(otherIp.count).toBe(1);

    // Different device should also be below threshold.
    const otherDev = recordAdminPasswordFailure({
      account: "admin",
      ipAddress: "1.2.3.4",
      deviceCredential: "dev-2",
    });
    expect(otherDev.classification).toBe("below_threshold");
    expect(otherDev.count).toBe(1);
  });

  it("a successful login reset clears the counter", () => {
    const args = { account: "admin", ipAddress: "1.2.3.4", deviceCredential: "dev-1" };
    for (let i = 0; i < SUSPICIOUS_FAILURE_THRESHOLD; i++) {
      recordAdminPasswordFailure(args);
    }
    expect(_readAdminFailureCounterForTests(args)).toBe(SUSPICIOUS_FAILURE_THRESHOLD);
    resetAdminPasswordFailureCounter(args);
    expect(_readAdminFailureCounterForTests(args)).toBe(0);

    // After reset, the next failure starts over at 1, not at threshold + 1.
    const result = recordAdminPasswordFailure(args);
    expect(result.classification).toBe("below_threshold");
    expect(result.count).toBe(1);
  });

  it("a failure outside the window does not extend the previous run", () => {
    const args = { account: "admin", ipAddress: "1.2.3.4", deviceCredential: "dev-1" };
    const t0 = 1_000_000;
    for (let i = 0; i < SUSPICIOUS_FAILURE_THRESHOLD; i++) {
      recordAdminPasswordFailure({ ...args, now: t0 });
    }
    // 30 minutes later — outside the 15-minute window.
    const later = recordAdminPasswordFailure({ ...args, now: t0 + 30 * 60 * 1000 });
    expect(later.classification).toBe("below_threshold");
    expect(later.count).toBe(1);
  });

  it("SUSPICIOUS_FAILURE_THRESHOLD is exactly 3 (rule: three or more in a row)", () => {
    expect(SUSPICIOUS_FAILURE_THRESHOLD).toBe(3);
  });
});
