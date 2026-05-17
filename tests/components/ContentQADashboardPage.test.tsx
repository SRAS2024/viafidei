/**
 * @vitest-environment jsdom
 *
 * Admin Content QA dashboard page — verifies the page surfaces
 * diagnostic errors instead of returning fake zeros and that the
 * cleanup policy + last-run status render correctly.
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

vi.mock("@/app/admin/_sections/AdminSection", () => ({
  AdminSection: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/app/admin/content-qa/dashboard/StrictCleanupButton", () => ({
  StrictCleanupButton: () => <button>Run strict QA cleanup now</button>,
}));

import { requireAdmin } from "@/lib/auth";
import ContentQADashboardPage from "@/app/admin/content-qa/dashboard/page";

beforeEach(() => {
  resetPrismaMock();
  (requireAdmin as ReturnType<typeof vi.fn>).mockResolvedValue({
    username: "admin",
  });
  for (const m of [
    prismaMock.prayer,
    prismaMock.saint,
    prismaMock.marianApparition,
    prismaMock.devotion,
    prismaMock.spiritualLifeGuide,
    prismaMock.liturgyEntry,
    prismaMock.parish,
  ]) {
    m.count.mockResolvedValue(0);
  }
  // Mock the data source card's probes too — every catalog accessor's
  // count must return a number for the card to render.
  for (const m of [
    prismaMock.ingestionJobQueue,
    prismaMock.ingestionBatch,
    prismaMock.ingestionCursor,
    prismaMock.workerHeartbeat,
    prismaMock.queueAuditLog,
    prismaMock.discoveredSourceItem,
    prismaMock.dailyIngestionCounter,
    prismaMock.dataManagementLog,
    prismaMock.ingestionJobRun,
  ]) {
    m.count.mockResolvedValue(0);
  }
  prismaMock.dataManagementLog.findFirst.mockResolvedValue(null);
  prismaMock.rejectedContentLog.count.mockResolvedValue(0);
  prismaMock.rejectedContentLog.groupBy.mockResolvedValue([]);
  prismaMock.rejectedContentLog.findMany.mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ContentQADashboardPage", () => {
  it("renders the cleanup policy panel with mode + deleteAllInvalid", async () => {
    const ui = await ContentQADashboardPage();
    render(ui);
    expect(screen.getByText(/Cleanup policy/i)).toBeInTheDocument();
    expect(screen.getByText(/Last cleanup run/i)).toBeInTheDocument();
    expect(screen.getByText(/Invalid public rows/i)).toBeInTheDocument();
    expect(screen.getByText(/Invalid deleted/i)).toBeInTheDocument();
  });

  it("shows a 'stale' badge when no cleanup log row exists", async () => {
    prismaMock.dataManagementLog.findFirst.mockResolvedValue(null);
    const ui = await ContentQADashboardPage();
    render(ui);
    expect(screen.getByText(/Stale/i)).toBeInTheDocument();
  });

  it("surfaces a dashboard query error banner when a metric query fails", async () => {
    prismaMock.prayer.count.mockRejectedValue(new Error("connection refused"));
    const ui = await ContentQADashboardPage();
    render(ui);
    expect(screen.getByText(/dashboard quer.*returned an error/i)).toBeInTheDocument();
    expect(screen.getByText(/connection refused/)).toBeInTheDocument();
  });

  it("never shows zero without saying why (diagnostic banner explains failed queries)", async () => {
    // Simulate one of the count queries failing.
    prismaMock.saint.count.mockRejectedValue(new Error("query timeout"));
    const ui = await ContentQADashboardPage();
    render(ui);
    expect(screen.getByText(/query timeout/)).toBeInTheDocument();
  });

  it("uses the labels 'Raw Database Rows' and 'Strict Valid Public Packages'", async () => {
    const ui = await ContentQADashboardPage();
    render(ui);
    // The labels appear in both the explanatory paragraph and the table
    // header — getAllByText covers both.
    expect(screen.getAllByText(/Raw Database Rows/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Strict Valid Public Packages/i).length).toBeGreaterThan(0);
  });
});
