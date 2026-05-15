import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/data/data-management-log", () => ({
  getRecentActivityByAction: vi.fn(),
}));

vi.mock("@/lib/diagnostics", () => ({
  runEmailDiagnostics: vi.fn(),
  runDataManagementDiagnostics: vi.fn(),
  runSitemapDiagnostics: vi.fn(),
  runAccountDiagnostics: vi.fn(),
  runIngestionDiagnostics: vi.fn(),
  runSaintsFeastDiagnostics: vi.fn(),
  loadIngestionLiveSnapshot: vi.fn(),
  recent24hEditCounts: vi.fn(),
}));

import { GET as emailGet } from "@/app/api/admin/diagnostics/email/route";
import { GET as dataMgmtGet } from "@/app/api/admin/diagnostics/data-management/route";
import { GET as sitemapGet } from "@/app/api/admin/diagnostics/sitemap/route";
import { GET as accountsGet } from "@/app/api/admin/diagnostics/accounts/route";
import { GET as ingestionGet } from "@/app/api/admin/diagnostics/ingestion/route";
import { GET as saintsFeastGet } from "@/app/api/admin/diagnostics/saints-feast/route";
import { requireAdmin } from "@/lib/auth";
import { getRecentActivityByAction } from "@/lib/data/data-management-log";
import {
  recent24hEditCounts,
  runAccountDiagnostics,
  runDataManagementDiagnostics,
  runEmailDiagnostics,
  runIngestionDiagnostics,
  runSaintsFeastDiagnostics,
  runSitemapDiagnostics,
  loadIngestionLiveSnapshot,
} from "@/lib/diagnostics";

const requireAdminMock = vi.mocked(requireAdmin);
const runEmailMock = vi.mocked(runEmailDiagnostics);
const runDataMgmtMock = vi.mocked(runDataManagementDiagnostics);
const runSitemapMock = vi.mocked(runSitemapDiagnostics);
const runAccountsMock = vi.mocked(runAccountDiagnostics);
const runIngestionMock = vi.mocked(runIngestionDiagnostics);
const runSaintsFeastMock = vi.mocked(runSaintsFeastDiagnostics);
const loadIngestionSnapshotMock = vi.mocked(loadIngestionLiveSnapshot);
const recent24hMock = vi.mocked(recent24hEditCounts);
const recentActivityByActionMock = vi.mocked(getRecentActivityByAction);

function makeReq(url = "https://app.example.com/api/admin/diagnostics/email") {
  return new NextRequest(new Request(url, { headers: { "x-forwarded-host": "app.example.com" } }));
}

const STUB_SECTION = {
  id: "email" as const,
  label: "Email",
  severity: "pass" as const,
  results: [],
  ranAt: new Date().toISOString(),
  requestId: "req-test-12345",
};

beforeEach(() => {
  requireAdminMock.mockReset();
  runEmailMock.mockReset();
  runDataMgmtMock.mockReset();
  runSitemapMock.mockReset();
  runAccountsMock.mockReset();
  runIngestionMock.mockReset();
  runSaintsFeastMock.mockReset();
  loadIngestionSnapshotMock.mockReset();
  recent24hMock.mockReset();
  recentActivityByActionMock.mockReset();
});

describe("/api/admin/diagnostics/email", () => {
  it("rejects unauthenticated requests with 401", async () => {
    requireAdminMock.mockResolvedValue(null);
    const res = await emailGet(makeReq());
    expect(res.status).toBe(401);
  });

  it("calls runEmailDiagnostics and returns the section in the JSON body", async () => {
    requireAdminMock.mockResolvedValue({ username: "admin" });
    runEmailMock.mockResolvedValue(STUB_SECTION);
    const res = await emailGet(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.section.id).toBe("email");
    expect(runEmailMock).toHaveBeenCalledTimes(1);
  });
});

describe("/api/admin/diagnostics/data-management", () => {
  it("rejects unauthenticated requests with 401", async () => {
    requireAdminMock.mockResolvedValue(null);
    const res = await dataMgmtGet(makeReq());
    expect(res.status).toBe(401);
  });

  it("returns section + 24h edit counts in the JSON body", async () => {
    requireAdminMock.mockResolvedValue({ username: "admin" });
    runDataMgmtMock.mockResolvedValue({ ...STUB_SECTION, id: "data_management", label: "Data" });
    recent24hMock.mockResolvedValue({ prayer: 3, saint: 1 });
    const res = await dataMgmtGet(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.section.id).toBe("data_management");
    expect(body.edits24h).toEqual({ prayer: 3, saint: 1 });
  });

  it("does not fail the whole route if recent24hEditCounts throws", async () => {
    requireAdminMock.mockResolvedValue({ username: "admin" });
    runDataMgmtMock.mockResolvedValue({ ...STUB_SECTION, id: "data_management", label: "Data" });
    recent24hMock.mockRejectedValue(new Error("aggregate failed"));
    const res = await dataMgmtGet(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.edits24h).toEqual({});
  });
});

describe("/api/admin/diagnostics/sitemap", () => {
  it("rejects unauthenticated requests with 401", async () => {
    requireAdminMock.mockResolvedValue(null);
    const res = await sitemapGet(makeReq());
    expect(res.status).toBe(401);
  });

  it("calls runSitemapDiagnostics with the public origin derived from the request", async () => {
    requireAdminMock.mockResolvedValue({ username: "admin" });
    runSitemapMock.mockResolvedValue({ ...STUB_SECTION, id: "sitemap", label: "Sitemap" });
    const res = await sitemapGet(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.section.id).toBe("sitemap");
    // origin should be the public host the helper derives.
    expect(typeof body.origin).toBe("string");
    expect(runSitemapMock).toHaveBeenCalledTimes(1);
  });
});

describe("/api/admin/diagnostics/accounts", () => {
  it("rejects unauthenticated requests with 401", async () => {
    requireAdminMock.mockResolvedValue(null);
    const res = await accountsGet(makeReq());
    expect(res.status).toBe(401);
  });

  it("calls runAccountDiagnostics and returns the section", async () => {
    requireAdminMock.mockResolvedValue({ username: "admin" });
    runAccountsMock.mockResolvedValue({ ...STUB_SECTION, id: "accounts", label: "Accounts" });
    const res = await accountsGet(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.section.id).toBe("accounts");
  });
});

describe("/api/admin/diagnostics/ingestion", () => {
  const INGESTION_SECTION = {
    ...STUB_SECTION,
    id: "ingestion" as const,
    label: "Ingestion & Data Management",
  };

  const SNAPSHOT_STUB = {
    status: "active" as const,
    detail: "active",
    lastRun: null,
    lastSuccessAt: null,
    lastFailureAt: null,
    totalRuns24h: 0,
    failedRuns24h: 0,
    autoCleanupEnabled: true,
    hardDeleteAfterDays: 30,
  };

  it("rejects unauthenticated requests with 401", async () => {
    requireAdminMock.mockResolvedValue(null);
    const res = await ingestionGet(makeReq());
    expect(res.status).toBe(401);
  });

  it("returns section + snapshot + 24h actions", async () => {
    requireAdminMock.mockResolvedValue({ username: "admin" });
    runIngestionMock.mockResolvedValue(INGESTION_SECTION);
    loadIngestionSnapshotMock.mockResolvedValue(SNAPSHOT_STUB);
    recentActivityByActionMock.mockResolvedValue({ ADD: 5, UPDATE: 2 });
    const res = await ingestionGet(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.section.id).toBe("ingestion");
    expect(body.snapshot.status).toBe("active");
    expect(body.actions24h).toEqual({ ADD: 5, UPDATE: 2 });
  });

  it("falls back to {} when actions24h fails", async () => {
    requireAdminMock.mockResolvedValue({ username: "admin" });
    runIngestionMock.mockResolvedValue(INGESTION_SECTION);
    loadIngestionSnapshotMock.mockResolvedValue(SNAPSHOT_STUB);
    recentActivityByActionMock.mockRejectedValue(new Error("groupBy failed"));
    const res = await ingestionGet(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.actions24h).toEqual({});
  });
});

describe("/api/admin/diagnostics/saints-feast", () => {
  const SAINTS_FEAST_SECTION = {
    ...STUB_SECTION,
    id: "saints_feast" as const,
    label: "Homepage — Today's Feast Day Saints",
  };

  it("rejects unauthenticated requests with 401", async () => {
    requireAdminMock.mockResolvedValue(null);
    const res = await saintsFeastGet(makeReq());
    expect(res.status).toBe(401);
  });

  it("calls runSaintsFeastDiagnostics and returns the section", async () => {
    requireAdminMock.mockResolvedValue({ username: "admin" });
    runSaintsFeastMock.mockResolvedValue(SAINTS_FEAST_SECTION);
    const res = await saintsFeastGet(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.section.id).toBe("saints_feast");
    expect(runSaintsFeastMock).toHaveBeenCalledTimes(1);
  });

  it("accepts ?month=&day= and forwards a target date", async () => {
    requireAdminMock.mockResolvedValue({ username: "admin" });
    runSaintsFeastMock.mockResolvedValue(SAINTS_FEAST_SECTION);
    await saintsFeastGet(
      makeReq("https://app.example.com/api/admin/diagnostics/saints-feast?month=8&day=28"),
    );
    const calledWith = runSaintsFeastMock.mock.calls[0][0];
    expect(calledWith).toBeInstanceOf(Date);
    if (calledWith instanceof Date) {
      expect(calledWith.getUTCMonth() + 1).toBe(8);
      expect(calledWith.getUTCDate()).toBe(28);
    }
  });
});
