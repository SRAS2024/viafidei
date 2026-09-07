/**
 * @vitest-environment jsdom
 *
 * The "Self-maintenance" block on /admin/diagnostics. The owner asked for the
 * worker's own maintenance work to be reported like any other work — and for a
 * healthy system to READ as healthy, with no alarming empty state when there is
 * nothing to repair.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { SelfMaintenanceSection } from "@/app/admin/_sections/SelfMaintenanceSection";
import type { SelfMaintenanceSummary } from "@/lib/admin-worker/operational-summary";

const NOW = Date.parse("2026-09-07T12:00:00.000Z");

function summary(over: Partial<SelfMaintenanceSummary> = {}): SelfMaintenanceSummary {
  return {
    everRan: true,
    lastSweepAt: new Date(NOW - 60_000),
    lastSweepAgeSeconds: 60,
    conditions: [],
    repairs: [],
    repairsApplied24h: 0,
    contentRestored24h: 0,
    escalations: [],
    backedOff: [],
    size: {
      databaseBytes: 12 * 1024 ** 2,
      databaseThresholdBytes: 2 * 1024 ** 3,
      largestTable: "AdminWorkerLog",
      largestTableRows: 1200,
      rowThreshold: 250_000,
      measuredAt: new Date(NOW - 60_000),
    },
    healthy: true,
    headline: "Healthy — last swept just now; nothing to repair.",
    ...over,
  };
}

describe("SelfMaintenanceSection", () => {
  it("a healthy worker reads as healthy — one calm line, no empty tables", () => {
    const { container } = render(<SelfMaintenanceSection summary={summary()} />);
    expect(container.querySelector("[data-self-maintenance='healthy']")).not.toBeNull();
    expect(screen.getByText(/nothing to repair/i)).toBeTruthy();
    expect(screen.getByText(/No repairs were needed in the last 24 hours/i)).toBeTruthy();
    // Nothing alarming: no condition rows, no repair table at all.
    expect(container.querySelector("[data-condition]")).toBeNull();
    expect(container.querySelector("table")).toBeNull();
    expect(container.textContent).toMatch(/Database 12 MB/);
  });

  it("a never-swept worker states the absence instead of showing a fault", () => {
    const { container } = render(
      <SelfMaintenanceSection
        summary={summary({
          everRan: false,
          healthy: false,
          lastSweepAt: null,
          lastSweepAgeSeconds: null,
          size: null,
          headline:
            "Self-maintenance has not swept yet — it sweeps automatically while the Admin Worker is on.",
        })}
      />,
    );
    expect(container.querySelector("[data-self-maintenance='unmeasured']")).not.toBeNull();
    expect(screen.getByText(/has not swept yet/i)).toBeTruthy();
    // "No repairs needed" would be a lie when nothing has been measured.
    expect(screen.queryByText(/No repairs were needed/i)).toBeNull();
  });

  it("lists each condition with its severity and remedy", () => {
    const { container } = render(
      <SelfMaintenanceSection
        summary={summary({
          healthy: false,
          headline: "Last swept just now: 1 condition(s) raised: LEDGER_BLOAT.",
          conditions: [
            {
              name: "LEDGER_BLOAT",
              severity: "critical",
              remedy: "trim_telemetry",
              detail: "AdminWorkerDecision: 993364 rows, 5743 MB",
            },
          ],
          size: {
            databaseBytes: 21 * 1024 ** 3,
            databaseThresholdBytes: 2 * 1024 ** 3,
            largestTable: "AdminWorkerDecision",
            largestTableRows: 993_364,
            rowThreshold: 250_000,
            measuredAt: new Date(NOW - 60_000),
          },
        })}
      />,
    );
    const row = container.querySelector("[data-condition='LEDGER_BLOAT']");
    expect(row).not.toBeNull();
    expect(row?.getAttribute("data-severity")).toBe("critical");
    expect(row?.textContent).toMatch(/trim_telemetry/);
    expect(container.querySelector("[data-self-maintenance='attention']")).not.toBeNull();
    expect(container.textContent).toMatch(/Database 21\.0 GB/);
    expect(container.textContent).toMatch(/993,364 rows/);
  });

  it("shows the repairs applied and what they moved", () => {
    const { container } = render(
      <SelfMaintenanceSection
        summary={summary({
          repairsApplied24h: 2,
          contentRestored24h: 3,
          repairs: [
            {
              condition: "LEDGER_BLOAT",
              repair: "trim_telemetry",
              attempts: 2,
              succeeded: 2,
              counts: { rowsPruned: 9000, decisions: 2000 },
              verified: true,
              lastAt: new Date(NOW - 60_000),
              detail: "trimmed",
            },
          ],
          headline: "Healthy — last swept just now; 2 repair(s) applied in the last 24 h.",
        })}
      />,
    );
    const cells = container.querySelector("[data-repair='trim_telemetry']");
    expect(cells?.textContent).toMatch(/rowsPruned 9,000/);
    expect(cells?.textContent).toMatch(/decisions 2,000/);
    expect(cells?.textContent).toMatch(/yes/);
    expect(container.textContent).toMatch(/3 content row\(s\) re-published/);
  });

  it("calls out repairs the worker gave up on and what it escalated", () => {
    const { container } = render(
      <SelfMaintenanceSection
        summary={summary({
          healthy: false,
          headline: "Last swept just now: 1 escalated to a person.",
          backedOff: [
            { condition: "LANE_WEDGED", failures: 3, until: new Date(NOW + 6 * 3600_000) },
          ],
          escalations: [
            {
              condition: "PUBLISH_FUTILITY",
              detail: "4000 passes, 0 publishes in 24 h",
              at: new Date(NOW - 120_000),
            },
          ],
        })}
      />,
    );
    expect(screen.getByText(/Repairs the worker gave up on/i)).toBeTruthy();
    expect(container.textContent).toMatch(/LANE_WEDGED/);
    expect(container.textContent).toMatch(/a person needs to fix the underlying cause/i);
    expect(container.textContent).toMatch(/PUBLISH_FUTILITY/);
    expect(container.textContent).toMatch(/0 publishes in 24 h/);
  });
});
