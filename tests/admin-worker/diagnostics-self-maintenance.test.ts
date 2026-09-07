/**
 * Self-maintenance is rated pass/warn/fail alongside every other Admin Worker
 * subsystem — the owner asked for the worker's own maintenance work to appear
 * in the audit exactly like publishing does.
 *
 * The measured failure these ratings exist for: production ran for three months
 * writing ~7 M telemetry rows into a 21 GB database, published nothing, and no
 * check anywhere said so.
 */
import { describe, expect, it, vi } from "vitest";

import { runAdminWorkerDiagnostics } from "@/lib/admin-worker/diagnostics";

type Row = Record<string, unknown>;

const NOW = Date.now();

function memoryRow(key: string, value: unknown): Row {
  return { memoryKey: key, memoryValue: value, lastUsedAt: new Date(NOW) };
}

function makePrisma(opts: { memory?: Row[]; logs?: Row[]; switchOn?: boolean } = {}) {
  const zero = vi.fn(async () => 0);
  const nul = vi.fn(async () => null);
  const empty = vi.fn(async () => []);
  // The master switch lives in AdminWorkerMemory; ratings are execution-aware,
  // so "the sweep has not run" is only a fault while the worker is meant to run.
  const findUnique = vi.fn(
    async (args: { where?: { memoryType_memoryKey?: { memoryKey?: string } } }) =>
      opts.switchOn && args?.where?.memoryType_memoryKey?.memoryKey === "worker.execution.switch"
        ? { memoryValue: { on: true }, updatedAt: new Date(NOW) }
        : null,
  );
  const base: Record<string, unknown> = {
    adminWorkerState: { findUnique: nul },
    adminWorkerMemory: { findMany: vi.fn(async () => opts.memory ?? []), findUnique },
    adminWorkerLog: {
      findMany: vi.fn(async () => opts.logs ?? []),
      count: zero,
      groupBy: empty,
      findFirst: nul,
    },
    adminWorkerRepairPlan: {
      count: zero,
      findFirst: nul,
      findMany: empty,
      groupBy: vi.fn(async () => []),
    },
  };
  return new Proxy(base, {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      return { count: zero, findFirst: nul, findMany: empty, groupBy: empty };
    },
  }) as unknown as Parameters<typeof runAdminWorkerDiagnostics>[0];
}

async function ratings(opts: Parameters<typeof makePrisma>[0] = {}) {
  const all = await runAdminWorkerDiagnostics(makePrisma(opts));
  return {
    maintenance: all.find((r) => r.key === "admin_worker_self_maintenance"),
    ledger: all.find((r) => r.key === "admin_worker_ledger_size"),
    all,
  };
}

describe("self-maintenance diagnostics ratings", () => {
  it("reports 'not swept yet' as unknown, never as a failure", async () => {
    const { maintenance, ledger } = await ratings();
    expect(maintenance?.status).toBe("unknown");
    expect(maintenance?.summary).toMatch(/has not swept yet/i);
    expect(maintenance?.recommendedRepair).toBeUndefined();
    expect(ledger?.status).toBe("unknown");
    expect(ledger?.summary).toMatch(/not measured yet/i);
  });

  it("a clean recent sweep passes and reads as healthy", async () => {
    const { maintenance, ledger } = await ratings({
      memory: [
        memoryRow("self-maintenance:last-run", { at: NOW - 60_000 }),
        memoryRow("self-maintenance:last-result", {
          at: NOW - 60_000,
          conditions: [],
          signals: [
            {
              key: "database_bytes",
              severity: "ok",
              value: 12 * 1024 ** 2,
              threshold: 2 * 1024 ** 3,
              detail: "database is 12 MB",
            },
            {
              key: "ledger_rows:AdminWorkerLog",
              severity: "ok",
              value: 1200,
              threshold: 250_000,
              detail: "AdminWorkerLog: 1200 rows",
            },
          ],
        }),
      ],
    });
    expect(maintenance?.status).toBe("pass");
    expect(maintenance?.summary).toMatch(/^Healthy/);
    expect(maintenance?.currentBlocker).toBeUndefined();
    expect(maintenance?.recommendedRepair).toBeUndefined();
    expect(ledger?.status).toBe("pass");
    expect(ledger?.summary).toMatch(/12 MB/);
  });

  it("fails on the production shape: a 21 GB database of worker telemetry", async () => {
    const { maintenance, ledger } = await ratings({
      memory: [
        memoryRow("self-maintenance:last-run", { at: NOW - 60_000 }),
        memoryRow("self-maintenance:last-result", {
          at: NOW - 60_000,
          conditions: [
            {
              name: "LEDGER_BLOAT",
              severity: "critical",
              remedy: "trim_telemetry",
              detail: "AdminWorkerDecision: 993364 rows",
            },
          ],
          signals: [
            {
              key: "database_bytes",
              severity: "critical",
              value: 21 * 1024 ** 3,
              threshold: 2 * 1024 ** 3,
              detail: "database is 21504 MB",
            },
            {
              key: "ledger_rows:AdminWorkerDecision",
              severity: "critical",
              value: 993_364,
              threshold: 250_000,
              detail: "AdminWorkerDecision: 993364 rows",
            },
          ],
        }),
      ],
    });
    expect(maintenance?.status).toBe("fail");
    expect(maintenance?.summary).toMatch(/LEDGER_BLOAT/);
    expect(maintenance?.recommendedRepair).toMatch(/trim_telemetry/);
    expect(maintenance?.automaticRepairStatus).toBe("in_progress");
    expect(ledger?.status).toBe("fail");
    expect(ledger?.summary).toMatch(/21\.0 GB/);
    expect(ledger?.summary).toMatch(/AdminWorkerDecision/);
  });

  it("fails when the worker repaired repeatedly and the signal never moved", async () => {
    const { maintenance } = await ratings({
      memory: [
        memoryRow("self-maintenance:last-run", { at: NOW - 60_000 }),
        memoryRow("self-maintenance:condition:PUBLISH_FUTILITY", {
          failures: 3,
          backoffUntil: NOW + 6 * 60 * 60 * 1000,
        }),
      ],
    });
    expect(maintenance?.status).toBe("fail");
    expect(maintenance?.currentBlocker).toMatch(/PUBLISH_FUTILITY/);
    expect(maintenance?.recommendedRepair).toMatch(/never moved/i);
  });

  it("warns when the sweep stopped running while the worker is switched ON", async () => {
    const { maintenance } = await ratings({
      switchOn: true,
      memory: [memoryRow("self-maintenance:last-run", { at: NOW - 12 * 60 * 60 * 1000 })],
    });
    expect(maintenance?.status).toBe("warn");
    expect(maintenance?.summary).toMatch(/No sweep for 12h/);
    expect(maintenance?.recommendedRepair).toMatch(/ADMIN_WORKER_SELF_MAINT/);
  });

  it("a stale sweep while the master switch is OFF is not a fault", async () => {
    // Switch OFF means no worker runs anywhere, so no sweep is EXPECTED.
    const { maintenance } = await ratings({
      memory: [memoryRow("self-maintenance:last-run", { at: NOW - 12 * 60 * 60 * 1000 })],
    });
    expect(maintenance?.status).toBe("pass");
    expect(maintenance?.summary).toMatch(/intentionally inactive/i);
    expect(maintenance?.recommendedRepair).toBeUndefined();
  });

  it("keeps its own automatic-repair status — the sweep files no repair plan", async () => {
    const { maintenance, ledger, all } = await ratings({
      memory: [memoryRow("self-maintenance:last-run", { at: NOW - 60_000 })],
    });
    expect(maintenance?.automaticRepairStatus).toBe("available");
    expect(ledger?.automaticRepairStatus).toBe("available");
    // The existing contract: EVERY rating still carries a status.
    expect(all.every((r) => r.automaticRepairStatus !== undefined)).toBe(true);
  });
});
