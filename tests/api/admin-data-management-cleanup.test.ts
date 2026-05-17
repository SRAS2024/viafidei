import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({ requireAdmin: vi.fn() }));
vi.mock("@/lib/audit", () => ({ writeAudit: vi.fn() }));
vi.mock("@/lib/data/site-settings", () => ({
  getDataManagementSettings: vi.fn(),
}));
vi.mock("@/lib/ingestion/queue", () => ({
  enqueueJob: vi.fn(),
  PRIORITY_CONTENT_THRESHOLD_UNMET: 10,
}));
// Banned-device check + Security Breach reporter are exercised in
// their own test suites; here we stub them so this test stays
// focused on the cleanup endpoint's enqueue behavior.
vi.mock("@/lib/security/security-event-store", () => ({
  isDeviceBanned: vi.fn().mockResolvedValue(false),
  recordBannedDeviceHit: vi.fn(),
}));
vi.mock("@/lib/security/security-events", () => ({
  reportSecurityBreach: vi.fn(),
  reportSuspiciousActivity: vi.fn(),
}));

import { POST } from "@/app/api/admin/data-management/cleanup/route";
import { requireAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { getDataManagementSettings } from "@/lib/data/site-settings";
import { enqueueJob } from "@/lib/ingestion/queue";

const requireAdminMock = vi.mocked(requireAdmin);
const writeAuditMock = vi.mocked(writeAudit);
const settingsMock = vi.mocked(getDataManagementSettings);
const enqueueJobMock = vi.mocked(enqueueJob);

function makeReq() {
  return new NextRequest(
    new Request("https://app.example.com/api/admin/data-management/cleanup", {
      method: "POST",
      headers: {
        "x-forwarded-for": "127.0.0.1",
        "user-agent": "test",
        // Same-origin Origin header so CSRF check passes.
        origin: "https://app.example.com",
        "x-forwarded-host": "app.example.com",
        "x-forwarded-proto": "https",
      },
    }),
  );
}

beforeEach(() => {
  requireAdminMock.mockReset();
  writeAuditMock.mockReset();
  settingsMock.mockReset();
  enqueueJobMock.mockReset();
});

describe("POST /api/admin/data-management/cleanup", () => {
  it("rejects unauthenticated callers with 401", async () => {
    requireAdminMock.mockResolvedValue(null);
    const res = await POST(makeReq());
    expect(res.status).toBe(401);
    expect(enqueueJobMock).not.toHaveBeenCalled();
  });

  it("enqueues three cleanup jobs and returns the queued ids", async () => {
    requireAdminMock.mockResolvedValue({ username: "admin" });
    settingsMock.mockResolvedValue({ autoCleanupEnabled: true, hardDeleteAfterDays: 30 });
    enqueueJobMock.mockResolvedValueOnce({ id: "j-strict" });
    enqueueJobMock.mockResolvedValueOnce({ id: "j-dedupe" });
    enqueueJobMock.mockResolvedValueOnce({ id: "j-archive" });

    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.queued).toBe(true);
    expect(body.enqueuedJobIds).toEqual(["j-strict", "j-dedupe", "j-archive"]);
    expect(enqueueJobMock).toHaveBeenCalledTimes(3);
    expect(writeAuditMock).toHaveBeenCalledTimes(1);
  });

  it("returns 500 with the error message when an enqueue throws", async () => {
    requireAdminMock.mockResolvedValue({ username: "admin" });
    settingsMock.mockResolvedValue({ autoCleanupEnabled: true, hardDeleteAfterDays: 30 });
    enqueueJobMock.mockRejectedValue(new Error("queue unavailable"));

    const res = await POST(makeReq());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.message).toContain("queue unavailable");
    expect(writeAuditMock).toHaveBeenCalled();
  });
});
