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

// AdminSection is async. Substitute a passthrough for unit tests.
vi.mock("@/app/admin/_sections/AdminSection", () => ({
  AdminSection: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import AdminLogsHub from "@/app/admin/logs/page";
import IngestionLogsPage from "@/app/admin/logs/ingestion/page";
import DataManagementLogPage from "@/app/admin/logs/data-management/page";
import { requireAdmin } from "@/lib/auth";

const requireAdminMock = vi.mocked(requireAdmin);

beforeEach(() => {
  resetPrismaMock();
  requireAdminMock.mockReset();
  requireAdminMock.mockResolvedValue({ username: "admin" });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("/admin/logs hub page", () => {
  it("lists all four log areas with entry counts", async () => {
    prismaMock.adminAuditLog.count.mockResolvedValue(15);
    prismaMock.dataManagementLog.count.mockResolvedValue(42);
    prismaMock.ingestionJobRun.count.mockResolvedValue(7);
    const ui = await AdminLogsHub();
    render(ui);
    expect(screen.getByText(/Account audit log/)).toBeInTheDocument();
    expect(screen.getByText(/Admin actions/)).toBeInTheDocument();
    expect(screen.getByText(/Data Management$/)).toBeInTheDocument();
    expect(screen.getByText(/Ingestion runs/)).toBeInTheDocument();
    // Each card shows its count when non-zero. (Account audit and
    // Admin actions both display the same AdminAuditLog total so the
    // 15-entries label appears more than once.)
    expect(screen.getAllByText(/15 entries/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/42 entries/)).toBeInTheDocument();
    expect(screen.getByText(/7 entries/)).toBeInTheDocument();
  });
});

describe("/admin/logs/ingestion page", () => {
  it("renders the empty state when no runs exist", async () => {
    prismaMock.ingestionJobRun.findMany.mockResolvedValue([]);
    prismaMock.ingestionJobRun.count.mockResolvedValue(0);
    const ui = await IngestionLogsPage({ searchParams: Promise.resolve({}) });
    render(ui);
    expect(screen.getByText(/No ingestion runs match this filter yet/i)).toBeInTheDocument();
  });

  it("renders each IngestionJobRun row with source / job / status / counts", async () => {
    prismaMock.ingestionJobRun.findMany.mockResolvedValue([
      {
        id: "r1",
        startedAt: new Date("2026-05-15T10:00:00Z"),
        finishedAt: new Date("2026-05-15T10:00:12Z"),
        status: "SUCCESS",
        recordsSeen: 10,
        recordsCreated: 5,
        recordsUpdated: 0,
        recordsSkipped: 5,
        recordsFailed: 0,
        recordsReviewRequired: 0,
        errorMessage: null,
        job: { jobName: "vatican.encyclicals", source: { name: "Vatican" } },
      },
      {
        id: "r2",
        startedAt: new Date("2026-05-15T09:00:00Z"),
        finishedAt: new Date("2026-05-15T09:00:01Z"),
        status: "FAILED",
        recordsSeen: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        recordsSkipped: 0,
        recordsFailed: 1,
        recordsReviewRequired: 0,
        errorMessage: "upstream 503",
        job: { jobName: "usccb.daily-mass", source: { name: "USCCB" } },
      },
    ]);
    prismaMock.ingestionJobRun.count.mockResolvedValue(2);
    const ui = await IngestionLogsPage({ searchParams: Promise.resolve({}) });
    render(ui);
    expect(screen.getByText("Vatican")).toBeInTheDocument();
    expect(screen.getByText("vatican.encyclicals")).toBeInTheDocument();
    expect(screen.getByText("USCCB")).toBeInTheDocument();
    expect(screen.getByText("usccb.daily-mass")).toBeInTheDocument();
    // SUCCESS / FAILED appear in the filter pill AND the row; assert both rows are present.
    expect(screen.getAllByText("SUCCESS").length).toBeGreaterThan(0);
    expect(screen.getAllByText("FAILED").length).toBeGreaterThan(0);
    expect(screen.getByText(/upstream 503/)).toBeInTheDocument();
  });
});

describe("/admin/logs/data-management page", () => {
  it("renders the empty state when no rows match the filter", async () => {
    prismaMock.dataManagementLog.findMany.mockResolvedValue([]);
    const ui = await DataManagementLogPage({ searchParams: Promise.resolve({}) });
    render(ui);
    expect(
      screen.getByText(/No data-management activity matches this filter yet/i),
    ).toBeInTheDocument();
  });

  it("renders each log row with action / type / reason", async () => {
    prismaMock.dataManagementLog.findMany.mockResolvedValue([
      {
        id: "log-1",
        action: "ADD",
        contentType: "Prayer",
        contentRef: "anima-christi",
        reason: "Ingested from Vatican (vatican.prayers)",
        triggeredBy: "automatic",
        actorUsername: null,
        createdAt: new Date("2026-05-15T10:00:00Z"),
      },
      {
        id: "log-2",
        action: "REJECT",
        contentType: "Saint",
        contentRef: "stub-row",
        reason: "Rejected by validator: biography looks too short",
        triggeredBy: "automatic",
        actorUsername: null,
        createdAt: new Date("2026-05-15T10:00:05Z"),
      },
    ]);
    const ui = await DataManagementLogPage({ searchParams: Promise.resolve({}) });
    render(ui);
    expect(screen.getByText("anima-christi")).toBeInTheDocument();
    expect(screen.getByText("stub-row")).toBeInTheDocument();
    expect(screen.getByText(/biography looks too short/)).toBeInTheDocument();
  });
});
