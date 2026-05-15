/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

vi.mock("@/lib/auth", () => ({ requireAdmin: vi.fn() }));
vi.mock("@/lib/i18n/server", () => ({
  getTranslator: async () => ({ t: (k: string) => k, locale: "en", dict: {} }),
}));

// AdminSection is an async server component that renders the dashboard
// header + sign-out. RTL's render() cannot resolve nested async
// components, so we replace it with a synchronous passthrough for
// these page-render tests.
vi.mock("@/app/admin/_sections/AdminSection", () => ({
  AdminSection: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Stub the diagnostic modules so the pages render with deterministic
// section shapes. The point of the test is to verify the page renders
// the section panel (severity, timestamp, requestId, explanation) —
// not to re-test the diagnostic logic itself.
const ingestionSnapshot = {
  status: "active" as const,
  detail: "5 successful runs in the last 24h.",
  lastRun: null,
  lastSuccessAt: null,
  lastFailureAt: null,
  totalRuns24h: 5,
  failedRuns24h: 0,
  autoCleanupEnabled: true,
  hardDeleteAfterDays: 30,
};
const stubSection = {
  id: "ingestion" as const,
  label: "Ingestion & Data Management",
  severity: "pass" as const,
  ranAt: "2026-05-15T12:00:00.000Z",
  requestId: "req-test-abc",
  results: [
    {
      id: "ingestion.live_status",
      label: "Live ingestion status",
      severity: "pass" as const,
      summary: "ACTIVE — 5 successful runs in the last 24h.",
      explanation: "All systems normal.",
      evidence: { totalRuns24h: 5 },
      ranAt: "2026-05-15T12:00:00.000Z",
      requestId: "req-test-abc",
      durationMs: 3,
    },
    {
      id: "ingestion.last_failure",
      label: "Last failed run",
      severity: "warn" as const,
      summary: "No FAILED runs in 24h.",
      ranAt: "2026-05-15T12:00:00.000Z",
      requestId: "req-test-abc",
      durationMs: 2,
    },
  ],
};

vi.mock("@/lib/diagnostics", () => ({
  loadIngestionLiveSnapshot: vi.fn(),
  runIngestionDiagnostics: vi.fn(),
  runSaintsFeastDiagnostics: vi.fn(),
  runAccountDiagnostics: vi.fn(),
  runSitemapDiagnostics: vi.fn(),
  runEmailDiagnostics: vi.fn(),
}));
vi.mock("@/lib/data/data-management-log", () => ({
  getRecentActivityByAction: vi.fn(),
  getRecentActivityByContentType: vi.fn(),
  dataManagementActionLabel: (s: string) => s,
}));

import {
  loadIngestionLiveSnapshot,
  runIngestionDiagnostics,
  runSaintsFeastDiagnostics,
  runAccountDiagnostics,
  runSitemapDiagnostics,
  runEmailDiagnostics,
} from "@/lib/diagnostics";
import {
  getRecentActivityByAction,
  getRecentActivityByContentType,
} from "@/lib/data/data-management-log";
import { requireAdmin } from "@/lib/auth";

import AdminDiagnosticsHub from "@/app/admin/diagnostics/page";
import IngestionDiagnosticsPage from "@/app/admin/diagnostics/ingestion/page";
import SaintsFeastDiagnosticsPage from "@/app/admin/diagnostics/saints/page";
import SitemapDiagnosticsPage from "@/app/admin/diagnostics/sitemap/page";
import AccountsDiagnosticsPage from "@/app/admin/diagnostics/accounts/page";

const requireAdminMock = vi.mocked(requireAdmin);
const loadSnapshotMock = vi.mocked(loadIngestionLiveSnapshot);
const runIngestionMock = vi.mocked(runIngestionDiagnostics);
const runSaintsFeastMock = vi.mocked(runSaintsFeastDiagnostics);
const runAccountMock = vi.mocked(runAccountDiagnostics);
const runSitemapMock = vi.mocked(runSitemapDiagnostics);
const runEmailMock = vi.mocked(runEmailDiagnostics);
const recentByActionMock = vi.mocked(getRecentActivityByAction);
const recentByContentTypeMock = vi.mocked(getRecentActivityByContentType);

beforeEach(() => {
  resetPrismaMock();
  requireAdminMock.mockReset();
  requireAdminMock.mockResolvedValue({ username: "admin" });
  loadSnapshotMock.mockReset();
  runIngestionMock.mockReset();
  runSaintsFeastMock.mockReset();
  runAccountMock.mockReset();
  runSitemapMock.mockReset();
  runEmailMock.mockReset();
  recentByActionMock.mockReset();
  recentByContentTypeMock.mockReset();
  recentByActionMock.mockResolvedValue({});
  recentByContentTypeMock.mockResolvedValue({});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("/admin/diagnostics hub", () => {
  it("renders all five diagnostic cards", async () => {
    loadSnapshotMock.mockResolvedValue(ingestionSnapshot);
    const ui = await AdminDiagnosticsHub();
    render(ui);
    expect(screen.getByText(/^Email$/)).toBeInTheDocument();
    expect(screen.getByText(/Ingestion & Data Management/)).toBeInTheDocument();
    expect(screen.getByText(/Sitemap & Link Paths/)).toBeInTheDocument();
    expect(screen.getByText(/^Accounts$/)).toBeInTheDocument();
    expect(screen.getByText(/Today's Feast Day Saints/)).toBeInTheDocument();
  });

  it("renders the live ingestion snapshot inline", async () => {
    loadSnapshotMock.mockResolvedValue(ingestionSnapshot);
    const ui = await AdminDiagnosticsHub();
    render(ui);
    expect(screen.getByText(/Ingestion at a glance/)).toBeInTheDocument();
    expect(screen.getByText(/successful runs in the last 24h/)).toBeInTheDocument();
  });
});

describe("/admin/diagnostics/ingestion page", () => {
  it("renders the section results with severity / timestamp / requestId", async () => {
    loadSnapshotMock.mockResolvedValue(ingestionSnapshot);
    runIngestionMock.mockResolvedValue(stubSection);
    const ui = await IngestionDiagnosticsPage();
    render(ui);
    expect(screen.getByText("Live ingestion status")).toBeInTheDocument();
    expect(screen.getByText(/ACTIVE — 5 successful runs/)).toBeInTheDocument();
    expect(screen.getByText("All systems normal.")).toBeInTheDocument();
    // Section heading appears in the live-status panel AND the section
    // header — query for the request id which only appears in the
    // section header / each result row.
    const reqIds = screen.getAllByText(/req-test-abc/);
    expect(reqIds.length).toBeGreaterThan(0);
  });
});

describe("/admin/diagnostics/saints page", () => {
  it("renders the saints diagnostic section with explicit pass/warn/fail badges", async () => {
    runSaintsFeastMock.mockResolvedValue({
      ...stubSection,
      id: "saints_feast",
      label: "Homepage — Today's Feast Day Saints",
      severity: "warn",
      results: [
        {
          id: "saints_feast.today_match",
          label: "Saints for today (5/15)",
          severity: "warn",
          summary: "No saints match today's date (5/15).",
          explanation: "Either the catalog has no rows for this calendar day.",
          ranAt: "2026-05-15T12:00:00.000Z",
          requestId: "req-test-abc",
          durationMs: 5,
        },
      ],
    });
    const ui = await SaintsFeastDiagnosticsPage();
    render(ui);
    expect(screen.getByText("Saints for today (5/15)")).toBeInTheDocument();
    expect(screen.getByText(/no saints match today/i)).toBeInTheDocument();
    expect(screen.getByText(/Either the catalog has no rows/)).toBeInTheDocument();
  });
});

describe("/admin/diagnostics/sitemap page", () => {
  it("renders the section returned by runSitemapDiagnostics", async () => {
    runSitemapMock.mockResolvedValue({
      ...stubSection,
      id: "sitemap",
      label: "Sitemap & internal paths",
    });
    const ui = await SitemapDiagnosticsPage();
    render(ui);
    expect(screen.getByText("Live ingestion status")).toBeInTheDocument(); // result label
    expect(screen.getByText(/Sitemap & internal paths/)).toBeInTheDocument(); // section label
  });
});

describe("/admin/diagnostics/accounts page", () => {
  it("renders the section returned by runAccountDiagnostics", async () => {
    runAccountMock.mockResolvedValue({
      ...stubSection,
      id: "accounts",
      label: "Accounts",
    });
    const ui = await AccountsDiagnosticsPage();
    render(ui);
    expect(screen.getByText("Live ingestion status")).toBeInTheDocument(); // result label
    expect(screen.getByText(/^Accounts$/)).toBeInTheDocument();
  });
});
