import { beforeEach, describe, expect, it } from "vitest";
import {
  recordTamperEvent,
  _resetTamperCountersForTests,
  _readTamperCounterForTests,
  SUSTAINED_TAMPER_THRESHOLD,
} from "@/lib/security/tamper-counter";

describe("tamper-probe counter — benign vs suspicious", () => {
  beforeEach(() => {
    _resetTamperCountersForTests();
    process.env.SESSION_SECRET = "test-session-secret-must-be-32-chars-long";
  });

  it("a single tamper event is benign (no Suspicious Activity escalation)", () => {
    const r = recordTamperEvent({ ipAddress: "1.2.3.4", deviceCredential: "dev-1" });
    expect(r.classification).toBe("benign");
    expect(r.count).toBe(1);
  });

  it("the first three events stay benign", () => {
    const args = { ipAddress: "1.2.3.4", deviceCredential: "dev-1" };
    for (let i = 0; i < SUSTAINED_TAMPER_THRESHOLD; i++) {
      const r = recordTamperEvent(args);
      expect(r.classification).toBe("benign");
    }
  });

  it("the FOURTH event (more than 3) escalates to suspicious", () => {
    const args = { ipAddress: "1.2.3.4", deviceCredential: "dev-1" };
    for (let i = 0; i < SUSTAINED_TAMPER_THRESHOLD; i++) {
      recordTamperEvent(args);
    }
    const r = recordTamperEvent(args);
    expect(r.classification).toBe("suspicious");
    expect(r.count).toBe(SUSTAINED_TAMPER_THRESHOLD + 1);
  });

  it("counters are keyed by IP + device (different IP does not aggregate)", () => {
    for (let i = 0; i < SUSTAINED_TAMPER_THRESHOLD + 1; i++) {
      recordTamperEvent({ ipAddress: "1.2.3.4", deviceCredential: "dev-1" });
    }
    const otherIp = recordTamperEvent({ ipAddress: "5.6.7.8", deviceCredential: "dev-1" });
    expect(otherIp.classification).toBe("benign");
    expect(otherIp.count).toBe(1);
  });

  it("an event outside the window starts the count over", () => {
    const args = { ipAddress: "1.2.3.4", deviceCredential: "dev-1" };
    const t0 = 5_000_000;
    for (let i = 0; i < SUSTAINED_TAMPER_THRESHOLD; i++) {
      recordTamperEvent({ ...args, now: t0 });
    }
    // 30 minutes later — outside the 10-minute window.
    const later = recordTamperEvent({ ...args, now: t0 + 30 * 60 * 1000 });
    expect(later.classification).toBe("benign");
    expect(later.count).toBe(1);
  });

  it("SUSTAINED_TAMPER_THRESHOLD is 3 (rule: more than 3 in a row)", () => {
    expect(SUSTAINED_TAMPER_THRESHOLD).toBe(3);
  });

  it("read helper returns 0 for an unknown key", () => {
    expect(
      _readTamperCounterForTests({ ipAddress: "9.9.9.9", deviceCredential: "no-such-dev" }),
    ).toBe(0);
  });
});
