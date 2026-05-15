import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({ requireAdmin: vi.fn() }));
vi.mock("@/lib/audit", () => ({ writeAudit: vi.fn() }));
vi.mock("@/lib/data/cleanup", () => ({
  archiveDuplicatePrayers: vi.fn(),
  cleanupMiscategorisedContent: vi.fn(),
  purgeStaleArchivedContent: vi.fn(),
}));
vi.mock("@/lib/data/site-settings", () => ({
  getDataManagementSettings: vi.fn(),
}));

import { POST } from "@/app/api/admin/data-management/cleanup/route";
import { requireAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import {
  archiveDuplicatePrayers,
  cleanupMiscategorisedContent,
  purgeStaleArchivedContent,
} from "@/lib/data/cleanup";
import { getDataManagementSettings } from "@/lib/data/site-settings";

const requireAdminMock = vi.mocked(requireAdmin);
const writeAuditMock = vi.mocked(writeAudit);
const archiveDuplicateMock = vi.mocked(archiveDuplicatePrayers);
const cleanupMock = vi.mocked(cleanupMiscategorisedContent);
const purgeMock = vi.mocked(purgeStaleArchivedContent);
const settingsMock = vi.mocked(getDataManagementSettings);

function makeReq() {
  return new NextRequest(
    new Request("https://app.example.com/api/admin/data-management/cleanup", {
      method: "POST",
      headers: { "x-forwarded-for": "127.0.0.1", "user-agent": "test" },
    }),
  );
}

beforeEach(() => {
  requireAdminMock.mockReset();
  writeAuditMock.mockReset();
  archiveDuplicateMock.mockReset();
  cleanupMock.mockReset();
  purgeMock.mockReset();
  settingsMock.mockReset();
});

describe("POST /api/admin/data-management/cleanup", () => {
  it("rejects unauthenticated callers with 401", async () => {
    requireAdminMock.mockResolvedValue(null);
    const res = await POST(makeReq());
    expect(res.status).toBe(401);
    expect(cleanupMock).not.toHaveBeenCalled();
  });

  it("runs all three cleanup passes and returns the summary", async () => {
    requireAdminMock.mockResolvedValue({ username: "admin" });
    settingsMock.mockResolvedValue({ autoCleanupEnabled: true, hardDeleteAfterDays: 30 });
    cleanupMock.mockResolvedValue({
      buckets: [{ entity: "Prayer", inspected: 100, archived: 4 }],
      totalArchived: 4,
    });
    archiveDuplicateMock.mockResolvedValue(2);
    purgeMock.mockResolvedValue({
      buckets: [{ entity: "Prayer", deleted: 1 }],
      totalDeleted: 1,
    });

    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.miscategorised.totalArchived).toBe(4);
    expect(body.duplicatePrayers).toBe(2);
    expect(body.hardDeleted.totalDeleted).toBe(1);
    expect(writeAuditMock).toHaveBeenCalledTimes(1);
  });

  it("returns 500 with the error message when a pass throws", async () => {
    requireAdminMock.mockResolvedValue({ username: "admin" });
    settingsMock.mockResolvedValue({ autoCleanupEnabled: true, hardDeleteAfterDays: 30 });
    cleanupMock.mockRejectedValue(new Error("DB unavailable"));
    archiveDuplicateMock.mockResolvedValue(0);
    purgeMock.mockResolvedValue({ buckets: [], totalDeleted: 0 });

    const res = await POST(makeReq());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.message).toContain("DB unavailable");
    expect(writeAuditMock).toHaveBeenCalled();
  });
});
