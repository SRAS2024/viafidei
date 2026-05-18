import { beforeEach, describe, expect, it } from "vitest";
import {
  recordAdminScan,
  _resetAdminScanCountersForTests,
  _readAdminScanCounterForTests,
  SUSTAINED_ADMIN_SCAN_THRESHOLD,
} from "@/lib/security/admin-route-scanner";

describe("admin-route scanner — sustained probing escalates to suspicious", () => {
  beforeEach(() => {
    _resetAdminScanCountersForTests();
    process.env.SESSION_SECRET = "test-session-secret-must-be-32-chars-long";
  });

  it("a single 401 on an admin path is benign", () => {
    const r = recordAdminScan({
      ipAddress: "1.2.3.4",
      deviceCredential: "dev-1",
      path: "/api/admin/sources",
    });
    expect(r.classification).toBe("benign");
    expect(r.distinctPaths).toBe(1);
  });

  it("the first five distinct admin paths stay benign", () => {
    const args = { ipAddress: "1.2.3.4", deviceCredential: "dev-1" };
    for (let i = 1; i <= SUSTAINED_ADMIN_SCAN_THRESHOLD; i++) {
      const r = recordAdminScan({ ...args, path: `/api/admin/path-${i}` });
      expect(r.classification).toBe("benign");
    }
  });

  it("the SIXTH distinct admin path (more than 5) escalates to suspicious", () => {
    const args = { ipAddress: "1.2.3.4", deviceCredential: "dev-1" };
    for (let i = 1; i <= SUSTAINED_ADMIN_SCAN_THRESHOLD; i++) {
      recordAdminScan({ ...args, path: `/api/admin/path-${i}` });
    }
    const r = recordAdminScan({ ...args, path: "/api/admin/another-one" });
    expect(r.classification).toBe("suspicious");
    expect(r.distinctPaths).toBe(SUSTAINED_ADMIN_SCAN_THRESHOLD + 1);
  });

  it("refresh-hammering a SINGLE admin URL never escalates (we track distinct paths, not hit count)", () => {
    const args = { ipAddress: "1.2.3.4", deviceCredential: "dev-1" };
    for (let i = 0; i < 50; i++) {
      const r = recordAdminScan({ ...args, path: "/api/admin/sources" });
      expect(r.classification).toBe("benign");
      expect(r.distinctPaths).toBe(1);
    }
  });

  it("scanners are keyed by IP + device — different keys do not aggregate", () => {
    for (let i = 1; i <= SUSTAINED_ADMIN_SCAN_THRESHOLD + 1; i++) {
      recordAdminScan({
        ipAddress: "1.2.3.4",
        deviceCredential: "dev-1",
        path: `/api/admin/path-${i}`,
      });
    }
    const otherIp = recordAdminScan({
      ipAddress: "5.6.7.8",
      deviceCredential: "dev-1",
      path: "/api/admin/something",
    });
    expect(otherIp.classification).toBe("benign");
    expect(otherIp.distinctPaths).toBe(1);
  });

  it("a hit outside the 10-minute window resets the counter", () => {
    const args = { ipAddress: "1.2.3.4", deviceCredential: "dev-1" };
    const t0 = 10_000_000;
    for (let i = 1; i <= SUSTAINED_ADMIN_SCAN_THRESHOLD; i++) {
      recordAdminScan({ ...args, path: `/api/admin/path-${i}`, now: t0 });
    }
    // 30 minutes later
    const later = recordAdminScan({
      ...args,
      path: "/api/admin/late",
      now: t0 + 30 * 60 * 1000,
    });
    expect(later.classification).toBe("benign");
    expect(later.distinctPaths).toBe(1);
  });

  it("SUSTAINED_ADMIN_SCAN_THRESHOLD is 5 (rule: more than 5 distinct paths in a row)", () => {
    expect(SUSTAINED_ADMIN_SCAN_THRESHOLD).toBe(5);
  });

  it("read helper returns 0 for an unknown key", () => {
    expect(
      _readAdminScanCounterForTests({ ipAddress: "9.9.9.9", deviceCredential: "no-such-dev" }),
    ).toBe(0);
  });
});
