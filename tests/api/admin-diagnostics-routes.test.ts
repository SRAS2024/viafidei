import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/diagnostics", () => ({
  runEmailDiagnostics: vi.fn(),
  runDataManagementDiagnostics: vi.fn(),
  runSitemapDiagnostics: vi.fn(),
  runAccountDiagnostics: vi.fn(),
  recent24hEditCounts: vi.fn(),
}));

import { GET as emailGet } from "@/app/api/admin/diagnostics/email/route";
import { GET as dataMgmtGet } from "@/app/api/admin/diagnostics/data-management/route";
import { GET as sitemapGet } from "@/app/api/admin/diagnostics/sitemap/route";
import { GET as accountsGet } from "@/app/api/admin/diagnostics/accounts/route";
import { requireAdmin } from "@/lib/auth";
import {
  recent24hEditCounts,
  runAccountDiagnostics,
  runDataManagementDiagnostics,
  runEmailDiagnostics,
  runSitemapDiagnostics,
} from "@/lib/diagnostics";

const requireAdminMock = vi.mocked(requireAdmin);
const runEmailMock = vi.mocked(runEmailDiagnostics);
const runDataMgmtMock = vi.mocked(runDataManagementDiagnostics);
const runSitemapMock = vi.mocked(runSitemapDiagnostics);
const runAccountsMock = vi.mocked(runAccountDiagnostics);
const recent24hMock = vi.mocked(recent24hEditCounts);

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
  recent24hMock.mockReset();
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
