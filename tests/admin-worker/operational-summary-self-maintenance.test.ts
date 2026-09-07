/**
 * The worker must REPORT the maintenance it does on itself, exactly like it
 * reports publishing. These tests pin three things the owner asked for:
 *
 *   1. the summary is a READER — it re-senses nothing and issues no size query
 *      on an admin page request (buildOperationalSummary runs on a request);
 *   2. it reads the sweep's persisted rows: the AdminWorkerMemory snapshot for
 *      sizes/conditions, the ledger rows for what was actually repaired;
 *   3. a healthy system reads as healthy — no alarming empty state when there
 *      is nothing to repair, and "never swept" is an absence, not a fault.
 */
import { describe, expect, it, vi } from "vitest";

import {
  buildOperationalSummary,
  deriveNextBestAction,
  readSelfMaintenanceSummary,
} from "@/lib/admin-worker/operational-summary";

type Row = Record<string, unknown>;

interface Fixture {
  memory?: Row[];
  logs?: Row[];
  /** Records every model.method the summary touched. */
  calls: string[];
}

function makePrisma(fixture: Fixture) {
  const record = (name: string) => fixture.calls.push(name);
  const zero = async () => 0;
  const empty = async () => [];
  const nul = async () => null;

  const base: Record<string, unknown> = {
    adminWorkerMemory: {
      findMany: async () => {
        record("adminWorkerMemory.findMany");
        return fixture.memory ?? [];
      },
    },
    adminWorkerLog: {
      findMany: async () => {
        record("adminWorkerLog.findMany");
        return fixture.logs ?? [];
      },
      count: zero,
      groupBy: empty,
    },
    $queryRaw: () => {
      record("$queryRaw");
      throw new Error("the summary must never issue raw SQL on a page request");
    },
  };

  return new Proxy(base, {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      return {
        count: zero,
        findFirst: nul,
        findUnique: nul,
        findMany: empty,
        groupBy: empty,
      };
    },
  }) as unknown as Parameters<typeof readSelfMaintenanceSummary>[0];
}

const NOW = Date.parse("2026-09-07T12:00:00.000Z");

function memoryRow(key: string, value: unknown): Row {
  return { memoryKey: key, memoryValue: value, lastUsedAt: new Date(NOW) };
}

function actionRow(over: Partial<Row> & { safeMetadata: Row }, minutesAgo = 1): Row {
  return {
    createdAt: new Date(NOW - minutesAgo * 60_000),
    severity: "INFO",
    eventName: "self_maintenance_action",
    message: "Self-maintenance repaired something.",
    ...over,
  };
}

describe("readSelfMaintenanceSummary — a reader, not a sensor", () => {
  it("issues exactly two indexed reads and no raw SQL", async () => {
    const fixture: Fixture = { calls: [] };
    const prisma = makePrisma(fixture);
    await readSelfMaintenanceSummary(prisma, { now: NOW });
    expect(fixture.calls).toEqual(["adminWorkerMemory.findMany", "adminWorkerLog.findMany"]);
    expect(fixture.calls).not.toContain("$queryRaw");
  });

  it("reports 'never swept' as an absence, not a fault", async () => {
    const s = await readSelfMaintenanceSummary(makePrisma({ calls: [] }), { now: NOW });
    expect(s.everRan).toBe(false);
    expect(s.lastSweepAt).toBeNull();
    expect(s.conditions).toEqual([]);
    expect(s.repairs).toEqual([]);
    expect(s.headline).toMatch(/has not swept yet/i);
    // Nothing red, nothing to act on.
    expect(s.escalations).toEqual([]);
    expect(s.backedOff).toEqual([]);
  });

  it("a swept, clean worker reads as healthy with no empty-state noise", async () => {
    const s = await readSelfMaintenanceSummary(
      makePrisma({
        calls: [],
        memory: [
          memoryRow("self-maintenance:last-run", { at: NOW - 5 * 60_000 }),
          memoryRow("self-maintenance:last-result", {
            at: NOW - 5 * 60_000,
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
          // A resolved condition (no backoff) must not show as raised.
          memoryRow("self-maintenance:condition:LEDGER_BLOAT", {
            failures: 0,
            backoffUntil: null,
            lastValue: 1200,
          }),
          // Lane bookkeeping shares the prefix and must be ignored.
          memoryRow("self-maintenance:lane:maint-self-heal", { lastOutcome: "ok", repeats: 1 }),
        ],
      }),
      { now: NOW },
    );

    expect(s.everRan).toBe(true);
    expect(s.healthy).toBe(true);
    expect(s.conditions).toEqual([]);
    expect(s.backedOff).toEqual([]);
    expect(s.repairsApplied24h).toBe(0);
    expect(s.headline).toMatch(/^Healthy/);
    expect(s.headline).toMatch(/nothing to repair/i);
    expect(s.size?.databaseBytes).toBe(12 * 1024 ** 2);
    expect(s.size?.databaseThresholdBytes).toBe(2 * 1024 ** 3);
    expect(s.size?.largestTable).toBe("AdminWorkerLog");
    expect(s.size?.rowThreshold).toBe(250_000);
  });

  it("aggregates the last 24 h of repairs with their counts and verification", async () => {
    const s = await readSelfMaintenanceSummary(
      makePrisma({
        calls: [],
        memory: [memoryRow("self-maintenance:last-run", { at: NOW - 60_000 })],
        logs: [
          actionRow(
            {
              message: "Self-maintenance LEDGER_BLOAT → trim_telemetry: trimmed.",
              safeMetadata: {
                condition: "LEDGER_BLOAT",
                severity: "critical",
                repair: "trim_telemetry",
                succeeded: true,
                counts: { rowsPruned: 5000, decisions: 2000 },
                evidence: [
                  {
                    key: "ledger_rows:AdminWorkerDecision",
                    severity: "critical",
                    value: 993_364,
                    threshold: 250_000,
                    detail: "AdminWorkerDecision: 993364 rows, 5743 MB",
                  },
                  {
                    key: "database_bytes",
                    severity: "critical",
                    value: 21 * 1024 ** 3,
                    threshold: 2 * 1024 ** 3,
                    detail: "database is 21504 MB",
                  },
                ],
                verify: { improved: true, before: 993_364, after: 988_364 },
              },
            },
            1,
          ),
          // An earlier attempt of the SAME repair folds into one row.
          actionRow(
            {
              safeMetadata: {
                condition: "LEDGER_BLOAT",
                severity: "critical",
                repair: "trim_telemetry",
                succeeded: true,
                counts: { rowsPruned: 4000 },
                verify: { improved: false },
              },
            },
            600,
          ),
        ],
      }),
      { now: NOW },
    );

    expect(s.repairsApplied24h).toBe(2);
    expect(s.repairs).toHaveLength(1);
    const repair = s.repairs[0]!;
    expect(repair.condition).toBe("LEDGER_BLOAT");
    expect(repair.repair).toBe("trim_telemetry");
    expect(repair.attempts).toBe(2);
    expect(repair.succeeded).toBe(2);
    expect(repair.counts).toEqual({ rowsPruned: 9000, decisions: 2000 });
    expect(repair.verified).toBe(true);
    // The condition raised by the LAST sweep only (the 10h-old row is history).
    expect(s.conditions.map((c) => c.name)).toEqual(["LEDGER_BLOAT"]);
    expect(s.conditions[0]?.severity).toBe("critical");
    expect(s.healthy).toBe(false);
    // Sizes fall back to the evidence the repair carried when no snapshot exists.
    expect(s.size?.databaseBytes).toBe(21 * 1024 ** 3);
    expect(s.size?.largestTable).toBe("AdminWorkerDecision");
  });

  it("surfaces escalations and conditions the worker gave up on", async () => {
    const backoffUntil = NOW + 6 * 60 * 60 * 1000;
    const s = await readSelfMaintenanceSummary(
      makePrisma({
        calls: [],
        memory: [
          memoryRow("self-maintenance:last-run", { at: NOW - 60_000 }),
          memoryRow("self-maintenance:condition:PUBLISH_FUTILITY", {
            failures: 3,
            backoffUntil,
            lastValue: 4000,
          }),
        ],
        logs: [
          actionRow({
            message: "Self-maintenance PUBLISH_FUTILITY → escalate: filed for review.",
            safeMetadata: {
              condition: "PUBLISH_FUTILITY",
              severity: "critical",
              repair: "escalate",
              succeeded: true,
              counts: { queued: 1 },
              verify: { improved: false },
            },
          }),
        ],
      }),
      { now: NOW },
    );

    expect(s.backedOff).toEqual([
      { condition: "PUBLISH_FUTILITY", failures: 3, until: new Date(backoffUntil) },
    ]);
    expect(s.escalations).toHaveLength(1);
    expect(s.escalations[0]?.condition).toBe("PUBLISH_FUTILITY");
    expect(s.healthy).toBe(false);
    expect(s.headline).toMatch(/escalated to a person/i);
    expect(s.headline).toMatch(/backed off/i);
  });

  it("counts restored content separately from repair actions", async () => {
    const s = await readSelfMaintenanceSummary(
      makePrisma({
        calls: [],
        memory: [memoryRow("self-maintenance:last-run", { at: NOW - 60_000 })],
        logs: [
          {
            createdAt: new Date(NOW - 30_000),
            severity: "WARN",
            eventName: "self_maintenance_content_restored",
            message: "Restored st-francis: publish gate now passes.",
            safeMetadata: { slug: "st-francis" },
          },
        ],
      }),
      { now: NOW },
    );
    expect(s.contentRestored24h).toBe(1);
    expect(s.repairsApplied24h).toBe(0);
    expect(s.conditions).toEqual([]);
  });

  it("never throws when the tables are missing entirely", async () => {
    const broken = {
      adminWorkerMemory: {
        findMany: async () => {
          throw new Error("relation does not exist");
        },
      },
      adminWorkerLog: {
        findMany: async () => {
          throw new Error("relation does not exist");
        },
      },
    } as unknown as Parameters<typeof readSelfMaintenanceSummary>[0];
    const s = await readSelfMaintenanceSummary(broken, { now: NOW });
    expect(s.everRan).toBe(false);
    expect(s.headline).toMatch(/has not swept yet/i);
  });
});

describe("buildOperationalSummary — self-maintenance is part of the report", () => {
  it("includes the section and issues no raw SQL", async () => {
    const fixture: Fixture = {
      calls: [],
      memory: [memoryRow("self-maintenance:last-run", { at: NOW - 60_000 })],
    };
    const summary = await buildOperationalSummary(makePrisma(fixture));
    expect(summary.selfMaintenance.everRan).toBe(true);
    expect(summary.selfMaintenance.conditions).toEqual([]);
    expect(fixture.calls).not.toContain("$queryRaw");
  });

  it("degrades to an unmeasured section rather than throwing", async () => {
    const prisma = {
      adminWorkerMemory: {
        findMany: vi.fn(async () => {
          throw new Error("boom");
        }),
      },
    } as unknown as Parameters<typeof buildOperationalSummary>[0];
    const proxied = new Proxy(prisma as unknown as Record<string, unknown>, {
      get(target, prop: string) {
        if (prop in target) return target[prop];
        return {
          count: async () => 0,
          findFirst: async () => null,
          findUnique: async () => null,
          findMany: async () => [],
          groupBy: async () => [],
        };
      },
    }) as unknown as Parameters<typeof buildOperationalSummary>[0];
    const summary = await buildOperationalSummary(proxied);
    expect(summary.selfMaintenance.everRan).toBe(false);
  });
});

describe("deriveNextBestAction — self-maintenance priority", () => {
  const base = {
    paused: false,
    working: true,
    buildReadyGates: [] as Array<{ gate: string; count: number }>,
    buildReadyBacklog: 0,
    openEscalations: 0,
    erroredLaneCount: 0,
    currentAction: "DISCOVERY" as string | null,
  };

  it("a condition the worker gave up on outranks draining the backlog", () => {
    const r = deriveNextBestAction({
      ...base,
      buildReadyBacklog: 40,
      buildReadyGates: [{ gate: "AWAITING_QA", count: 40 }],
      selfMaintenance: {
        conditions: [],
        backedOff: [{ condition: "LANE_WEDGED", failures: 3, until: new Date(NOW) }],
      },
    });
    expect(r).toMatch(/LANE_WEDGED/);
    expect(r).toMatch(/needs a person/i);
  });

  it("a critical condition names its remedy", () => {
    const r = deriveNextBestAction({
      ...base,
      buildReadyBacklog: 40,
      buildReadyGates: [{ gate: "AWAITING_QA", count: 40 }],
      selfMaintenance: {
        conditions: [
          {
            name: "LEDGER_BLOAT",
            severity: "critical",
            remedy: "trim_telemetry",
            detail: "21 GB",
          },
        ],
        backedOff: [],
      },
    });
    expect(r).toMatch(/LEDGER_BLOAT/);
    expect(r).toMatch(/trim_telemetry/);
  });

  it("a healthy sweep never displaces the pipeline recommendation", () => {
    const r = deriveNextBestAction({
      ...base,
      buildReadyBacklog: 40,
      buildReadyGates: [{ gate: "AWAITING_QA", count: 40 }],
      selfMaintenance: { conditions: [], backedOff: [] },
    });
    expect(r).toMatch(/BUILD_READY backlog \(40/);
  });
});
