import { beforeEach, describe, expect, it } from "vitest";
import {
  recordUserPasswordFailure,
  resetUserPasswordFailureCounter,
  _resetAllUserFailureCountersForTests,
  SUSPICIOUS_USER_FAILURE_THRESHOLD,
  BREACH_USER_FAILURE_THRESHOLD,
} from "@/lib/security/user-failure-counter";

beforeEach(() => {
  _resetAllUserFailureCountersForTests();
  process.env.SESSION_SECRET = "test-session-secret-must-be-32-chars-long";
});

describe("user-account brute-force counter", () => {
  it("the first five failures stay below the Suspicious threshold", () => {
    const args = { email: "user@example.com", ipAddress: "1.2.3.4", deviceCredential: "dev-1" };
    for (let i = 0; i < SUSPICIOUS_USER_FAILURE_THRESHOLD; i++) {
      const r = recordUserPasswordFailure(args);
      expect(r.classification).toBe("below_threshold");
    }
  });

  it("the SIXTH consecutive failure (more than 5) classifies as Suspicious", () => {
    const args = { email: "user@example.com", ipAddress: "1.2.3.4", deviceCredential: "dev-1" };
    for (let i = 0; i < SUSPICIOUS_USER_FAILURE_THRESHOLD; i++) {
      recordUserPasswordFailure(args);
    }
    const r = recordUserPasswordFailure(args);
    expect(r.classification).toBe("suspicious");
    expect(r.count).toBe(SUSPICIOUS_USER_FAILURE_THRESHOLD + 1);
  });

  it("a high-burst run escalates to Breach (brute-force pattern)", () => {
    const args = { email: "user@example.com", ipAddress: "1.2.3.4", deviceCredential: "dev-1" };
    let classification: string = "below_threshold";
    for (let i = 0; i < BREACH_USER_FAILURE_THRESHOLD + 1; i++) {
      classification = recordUserPasswordFailure(args).classification;
    }
    expect(classification).toBe("breach");
  });

  it("counters are keyed by email + IP + device — different keys do not aggregate", () => {
    const base = { ipAddress: "1.2.3.4", deviceCredential: "dev-1" };
    for (let i = 0; i < BREACH_USER_FAILURE_THRESHOLD + 1; i++) {
      recordUserPasswordFailure({ ...base, email: "victim@example.com" });
    }
    const otherEmail = recordUserPasswordFailure({ ...base, email: "other@example.com" });
    expect(otherEmail.classification).toBe("below_threshold");
    expect(otherEmail.count).toBe(1);
  });

  it("a successful login reset clears the counter", () => {
    const args = { email: "user@example.com", ipAddress: "1.2.3.4", deviceCredential: "dev-1" };
    for (let i = 0; i < SUSPICIOUS_USER_FAILURE_THRESHOLD + 1; i++) {
      recordUserPasswordFailure(args);
    }
    resetUserPasswordFailureCounter(args);
    const r = recordUserPasswordFailure(args);
    expect(r.classification).toBe("below_threshold");
    expect(r.count).toBe(1);
  });

  it("a failure outside the 15-minute window resets the counter", () => {
    const args = { email: "user@example.com", ipAddress: "1.2.3.4", deviceCredential: "dev-1" };
    const t0 = 5_000_000;
    for (let i = 0; i < SUSPICIOUS_USER_FAILURE_THRESHOLD; i++) {
      recordUserPasswordFailure({ ...args, now: t0 });
    }
    const later = recordUserPasswordFailure({ ...args, now: t0 + 30 * 60 * 1000 });
    expect(later.classification).toBe("below_threshold");
    expect(later.count).toBe(1);
  });

  it("threshold constants are pinned (5 for Suspicious, 20 for Breach)", () => {
    expect(SUSPICIOUS_USER_FAILURE_THRESHOLD).toBe(5);
    expect(BREACH_USER_FAILURE_THRESHOLD).toBe(20);
  });
});
