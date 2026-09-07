/**
 * The worker's self-maintenance organ — the answer to the production failure
 * measured on 2026-09-07 (21 GB of telemetry, 12 MB of content, ~7 M ledger
 * rows written across 30 days with nothing published, worker_stuck × 207,830,
 * loop_paused written once per second).
 *
 * What is pinned here:
 *   - a HEALTHY worker writes ZERO log rows and takes zero actions (the whole
 *     point: this module must never become the thing it repairs);
 *   - SENSE is cheap — pg_class estimates, and an exact count ONLY once an
 *     estimate crosses the threshold;
 *   - every condition carries its evidence and exactly one remedy;
 *   - every repair is individually disable-able by env;
 *   - RESTORE is the only content-mutating action, it snapshots first, it skips
 *     a row a human still owns, and it never deletes;
 *   - VERIFY re-reads the signal, and a repair that does not move it three
 *     sweeps running escalates and backs off instead of retrying forever;
 *   - the event sampler drops over-budget INFO events and says so ONCE.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CONDITION_BACKOFF_MS,
  LEDGER_ROWS_WARN,
  REPAIR_ENV_SWITCH,
  VERIFY_FAILURE_LIMIT,
  diagnoseConditions,
  eventSamplerSnapshot,
  resetEventSampler,
  resetSelfMaintenanceThrottle,
  runSelfMaintenance,
  sampleWorkerEvent,
  senseSelfHealth,
  suppressWorkerEvent,
  type SenseReading,
} from "@/lib/admin-worker/self-maintenance";

const HOUR = 60 * 60 * 1000;
const NOW = Date.UTC(2026, 8, 7, 12, 0, 0);

interface FakeOpts {
  relations?: Array<{ relname: string; est: number; bytes: number }>;
  dbBytes?: number;
  /** Exact counts returned by a bare `model.count()` (the estimate follow-up). */
  exactCounts?: Record<string, number>;
  passes24h?: number;
  published24h?: number;
  stuckEvents?: number;
  eventRates?: Array<{ eventName: string; perHour: number }>;
  lanes?: Array<Record<string, unknown>>;
  cursors?: Array<{ memoryKey: string; memoryValue: Record<string, unknown> }>;
  rollbacks?: Array<Record<string, unknown>>;
  content?: Record<string, Record<string, unknown>>;
  pendingReviews?: number;
  parkedArtifacts?: number;
  parkedRows?: Array<{ id: string }>;
  /** Rows each $executeRaw batch reports deleting (pruneLedgerRows). */
  prunedPerCall?: number[];
}

function makePrisma(opts: FakeOpts = {}) {
  const memory = new Map<string, Record<string, unknown>>();
  for (const c of opts.cursors ?? []) memory.set(c.memoryKey, c.memoryValue);
  const logs: Array<Record<string, unknown>> = [];
  const contentUpdates: Array<Record<string, unknown>> = [];
  const snapshots: Array<Record<string, unknown>> = [];
  const reviews: Array<Record<string, unknown>> = [];
  const bareCounts: string[] = [];
  let pruneCall = 0;
  // Deep clone: the restore path mutates rows, and the fixtures are shared
  // between cases.
  const content: Record<string, Record<string, unknown>> = structuredClone(opts.content ?? {});

  const prisma = {
    __logs: logs,
    __memory: memory,
    __contentUpdates: contentUpdates,
    __snapshots: snapshots,
    __reviews: reviews,
    __bareCounts: bareCounts,

    $queryRaw: vi.fn(async (strings: TemplateStringsArray) => {
      const sql = strings.join(" ");
      if (sql.includes("pg_database_size")) return [{ bytes: opts.dbBytes ?? 100 * 1024 * 1024 }];
      return (opts.relations ?? []).map((r) => ({
        relname: r.relname,
        est_rows: r.est,
        bytes: r.bytes,
      }));
    }),
    $executeRaw: vi.fn(async () => {
      const n = opts.prunedPerCall?.[pruneCall] ?? 0;
      pruneCall += 1;
      return n;
    }),

    adminWorkerLog: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        logs.push(data);
        return { id: `l${logs.length}` };
      }),
      count: vi.fn(async (arg?: { where?: Record<string, unknown> }) => {
        if (arg === undefined) {
          bareCounts.push("adminWorkerLog");
          return opts.exactCounts?.AdminWorkerLog ?? 0;
        }
        return opts.stuckEvents ?? 0;
      }),
      groupBy: vi.fn(async () =>
        (opts.eventRates ?? []).map((e) => ({
          eventName: e.eventName,
          _count: { _all: e.perHour },
        })),
      ),
    },
    adminWorkerPass: {
      count: vi.fn(async (arg?: unknown) => {
        if (arg === undefined) {
          bareCounts.push("adminWorkerPass");
          return opts.exactCounts?.AdminWorkerPass ?? 0;
        }
        return opts.passes24h ?? 0;
      }),
    },
    adminWorkerDecision: {
      count: vi.fn(async (arg?: unknown) => {
        if (arg === undefined) bareCounts.push("adminWorkerDecision");
        return opts.exactCounts?.AdminWorkerDecision ?? 0;
      }),
    },
    adminWorkerActionScore: { count: vi.fn(async () => 0) },
    adminWorkerStageOutcome: { count: vi.fn(async () => 0) },
    adminWorkerRepairPlan: { count: vi.fn(async () => 0) },

    publishedContent: {
      count: vi.fn(async (arg?: { where?: Record<string, unknown> }) => {
        const where = arg?.where ?? {};
        if (where.isPublished === false) return Object.keys(content).length;
        return opts.published24h ?? 0;
      }),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => content[where.id] ?? null),
      update: vi.fn(
        async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          contentUpdates.push({ id: where.id, ...data });
          const row = content[where.id];
          if (row) Object.assign(row, data);
          return row ?? {};
        },
      ),
      delete: vi.fn(async () => {
        throw new Error("self-maintenance must never delete published content");
      }),
      deleteMany: vi.fn(async () => {
        throw new Error("self-maintenance must never delete published content");
      }),
    },
    publishedContentVersion: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        snapshots.push(data);
        return { id: `v${snapshots.length}` };
      }),
    },

    adminWorkerLaneState: {
      findMany: vi.fn(async (arg?: { where?: { status?: string } }) => {
        const rows = opts.lanes ?? [];
        if (arg?.where?.status) return rows.filter((r) => r.status === arg.where?.status);
        return rows;
      }),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },

    adminWorkerMemory: {
      findUnique: vi.fn(
        async ({ where }: { where: { memoryType_memoryKey: { memoryKey: string } } }) => {
          const key = where.memoryType_memoryKey.memoryKey;
          return memory.has(key) ? { memoryValue: memory.get(key) } : null;
        },
      ),
      upsert: vi.fn(
        async ({
          where,
          update,
        }: {
          where: { memoryType_memoryKey: { memoryKey: string } };
          update: { memoryValue: Record<string, unknown> };
        }) => {
          memory.set(where.memoryType_memoryKey.memoryKey, update.memoryValue);
          return {};
        },
      ),
      findMany: vi.fn(async ({ where }: { where: { memoryKey?: { startsWith?: string } } }) => {
        const prefix = where?.memoryKey?.startsWith ?? "";
        return [...memory.entries()]
          .filter(([k]) => k.startsWith(prefix))
          .map(([memoryKey, memoryValue]) => ({ memoryKey, memoryValue }));
      }),
    },

    adminWorkerRollbackLedger: {
      count: vi.fn(async () => (opts.rollbacks ?? []).length),
      findMany: vi.fn(async () => opts.rollbacks ?? []),
    },
    adminWorkerPackageArtifact: {
      count: vi.fn(async () => opts.parkedArtifacts ?? 0),
      findMany: vi.fn(async () => opts.parkedRows ?? []),
      updateMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        const ids = (where.id as { in?: string[] } | undefined)?.in;
        return { count: ids ? ids.length : 1 };
      }),
    },
    humanReviewQueue: {
      count: vi.fn(async () => opts.pendingReviews ?? 0),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        reviews.push(data);
        return { id: `r${reviews.length}` };
      }),
    },
  };
  return prisma as typeof prisma & Parameters<typeof runSelfMaintenance>[0];
}

/** A quiet, healthy worker: small tables, publishing, calm lanes. */
function healthyOpts(): FakeOpts {
  return {
    relations: [
      { relname: "AdminWorkerLog", est: 1_000, bytes: 1024 * 1024 },
      { relname: "AdminWorkerDecision", est: 200, bytes: 1024 },
      { relname: "AdminWorkerPass", est: 200, bytes: 1024 },
    ],
    dbBytes: 50 * 1024 * 1024,
    passes24h: 40,
    published24h: 12,
    stuckEvents: 0,
    eventRates: [{ eventName: "brain_decided", perHour: 40 }],
    lanes: [],
  };
}

const ENV_KEYS = [
  "ADMIN_WORKER_SELF_MAINT",
  "ADMIN_WORKER_SELF_MAINT_INTERVAL_MS",
  "ADMIN_WORKER_EVENT_BUDGET_PER_HOUR",
  "ADMIN_WORKER_EVENT_COOLDOWN_MS",
  ...Object.values(REPAIR_ENV_SWITCH),
];

beforeEach(() => {
  resetSelfMaintenanceThrottle();
  resetEventSampler();
  for (const k of ENV_KEYS) delete process.env[k];
});

afterEach(() => {
  for (const k of ENV_KEYS) delete process.env[k];
});

/* ------------------------------------------------------------------ */

describe("a healthy worker", () => {
  it("takes no action and writes NOT ONE log row", async () => {
    const prisma = makePrisma(healthyOpts());
    const r = await runSelfMaintenance(prisma, { passId: "p1", now: NOW, force: true });
    expect(r.ran).toBe(true);
    expect(r.conditions).toEqual([]);
    expect(r.repairs).toEqual([]);
    expect(r.actionsTaken).toBe(0);
    // The bug this module exists to fix was one row per tick. A clean sweep is
    // silent — no row, ever, for "I looked and everything was fine".
    expect(prisma.__logs).toHaveLength(0);
  });

  it("still reports every signal so the audit can render them", async () => {
    const prisma = makePrisma(healthyOpts());
    const r = await runSelfMaintenance(prisma, { now: NOW, force: true });
    const keys = r.signals.map((s) => s.key);
    expect(keys).toContain("ledger_rows:AdminWorkerLog");
    expect(keys).toContain("ledger_rows:AdminWorkerDecision");
    expect(keys).toContain("database_bytes");
    expect(keys).toContain("publish_futility");
    expect(keys).toContain("stuck_events_1h");
    expect(keys).toContain("wedged_lanes");
    expect(keys).toContain("stale_cursors");
    expect(keys).toContain("orphaned_unpublished");
    expect(keys).toContain("parked_artifacts");
    expect(keys).toContain("paused_log_rate");
    for (const s of r.signals) expect(s.severity).toBe("ok");
  });
});

describe("SENSE is cheap", () => {
  it("uses the pg_class estimate and pays for an exact count ONLY over the threshold", async () => {
    const cheap = makePrisma({
      ...healthyOpts(),
      relations: [{ relname: "AdminWorkerLog", est: LEDGER_ROWS_WARN - 1, bytes: 1024 }],
    });
    await senseSelfHealth(cheap, { now: NOW });
    expect(cheap.__bareCounts).not.toContain("adminWorkerLog");

    const expensive = makePrisma({
      ...healthyOpts(),
      relations: [{ relname: "AdminWorkerLog", est: LEDGER_ROWS_WARN + 1, bytes: 1024 }],
      exactCounts: { AdminWorkerLog: 5_091_970 },
    });
    const reading = await senseSelfHealth(expensive, { now: NOW });
    expect(expensive.__bareCounts).toContain("adminWorkerLog");
    const sig = reading.signals.find((s) => s.key === "ledger_rows:AdminWorkerLog");
    expect(sig?.value).toBe(5_091_970);
    expect(sig?.severity).toBe("critical");
    expect(sig?.detail).toContain("exact");
  });

  it("degrades to zero-value signals on a client with no raw SQL", async () => {
    const reading = await senseSelfHealth({} as never, { now: NOW });
    expect(reading.signals.length).toBeGreaterThan(0);
    expect(reading.signals.every((s) => s.severity === "ok")).toBe(true);
  });
});

describe("DIAGNOSE", () => {
  function reading(partial: Partial<SenseReading>): SenseReading {
    return {
      signals: [],
      noisyEvents: [],
      wedgedLanes: [],
      staleCursorKeys: [],
      orphanCount: 0,
      parkedArtifacts: 0,
      ...partial,
    };
  }

  it("names LEDGER_BLOAT with the offending tables as evidence", () => {
    const conditions = diagnoseConditions(
      reading({
        signals: [
          {
            key: "ledger_rows:AdminWorkerDecision",
            value: 993_364,
            threshold: LEDGER_ROWS_WARN,
            severity: "critical",
            detail: "AdminWorkerDecision: 993364 rows",
          },
        ],
      }),
    );
    const bloat = conditions.find((c) => c.name === "LEDGER_BLOAT");
    expect(bloat?.remedy).toBe("trim_telemetry");
    expect(bloat?.severity).toBe("critical");
    expect(bloat?.evidence[0].key).toBe("ledger_rows:AdminWorkerDecision");
  });

  it("names PUBLISH_FUTILITY — many passes, zero publishes — and escalates it", () => {
    const conditions = diagnoseConditions(
      reading({
        signals: [
          {
            key: "publish_futility",
            value: 8_400,
            threshold: 200,
            severity: "critical",
            detail: "8400 pass(es) and 0 publish(es) in the last 24 h",
          },
        ],
      }),
    );
    const futility = conditions.find((c) => c.name === "PUBLISH_FUTILITY");
    // Nothing here can MAKE the worker publish; telling a human once is the
    // honest remedy, not another 200,000 passes.
    expect(futility?.remedy).toBe("escalate");
  });

  it("separates PAUSED_LOOP_HOT_LOOP from ordinary LOG_EVENT_SPAM", () => {
    const conditions = diagnoseConditions(
      reading({
        noisyEvents: [
          { eventName: "loop_paused", perHour: 3_600 },
          { eventName: "brain_decided", perHour: 900 },
        ],
        signals: [
          {
            key: "paused_log_rate",
            value: 3_600,
            threshold: 120,
            severity: "critical",
            detail: "loop_paused wrote 3600 row(s) in the last hour",
          },
          {
            key: "event_rate:brain_decided",
            value: 900,
            threshold: 120,
            severity: "warn",
            detail: "brain_decided wrote 900 row(s)",
          },
        ],
      }),
    );
    expect(conditions.map((c) => c.name)).toContain("PAUSED_LOOP_HOT_LOOP");
    expect(conditions.map((c) => c.name)).toContain("LOG_EVENT_SPAM");
    for (const c of conditions) expect(c.remedy).toBe("sample_noisy_event");
  });

  it("says nothing at all when every signal is ok", () => {
    expect(
      diagnoseConditions(
        reading({
          signals: [
            {
              key: "ledger_rows:AdminWorkerLog",
              value: 10,
              threshold: LEDGER_ROWS_WARN,
              severity: "ok",
              detail: "",
            },
          ],
        }),
      ),
    ).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */

const BLOATED: FakeOpts = {
  relations: [
    { relname: "AdminWorkerLog", est: 5_091_970, bytes: 3_295 * 1024 * 1024 },
    { relname: "AdminWorkerDecision", est: 993_364, bytes: 5_743 * 1024 * 1024 },
  ],
  exactCounts: { AdminWorkerLog: 5_091_970, AdminWorkerDecision: 993_364 },
  dbBytes: 21 * 1024 ** 3,
  passes24h: 10,
  published24h: 4,
  prunedPerCall: [5000, 17],
};

describe("REPAIR: trim telemetry", () => {
  it("delegates to the retention prune and logs ONE row naming counts and verdict", async () => {
    const prisma = makePrisma(BLOATED);
    const r = await runSelfMaintenance(prisma, { passId: "p9", now: NOW, force: true });
    const trim = r.repairs.find((x) => x.repair === "trim_telemetry");
    expect(trim?.attempted).toBe(true);
    expect(trim?.counts.rowsPruned).toBe(5_017);
    const row = prisma.__logs.find((l) => l.eventName === "self_maintenance_action");
    expect(row).toBeDefined();
    expect(row?.category).toBe("REPAIR");
    expect(String(row?.message)).toContain("LEDGER_BLOAT");
    expect(String(row?.message)).toContain("trim_telemetry");
    expect(String(row?.message)).toContain("Verified");
    // One action → one row. Not one per table, and certainly not one per tick.
    expect(prisma.__logs.filter((l) => l.eventName === "self_maintenance_action")).toHaveLength(1);
  });

  it("is individually disable-able and then takes no action and writes no row", async () => {
    process.env[REPAIR_ENV_SWITCH.trim_telemetry] = "0";
    const prisma = makePrisma(BLOATED);
    const r = await runSelfMaintenance(prisma, { now: NOW, force: true });
    const trim = r.repairs.find((x) => x.repair === "trim_telemetry");
    expect(trim?.attempted).toBe(false);
    expect(trim?.disabledBy).toBe(REPAIR_ENV_SWITCH.trim_telemetry);
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
    expect(prisma.__logs).toHaveLength(0);
  });
});

describe("REPAIR: lane wedge + stale cursor", () => {
  it("resets a lane that has been 'running' far longer than its watchdog", async () => {
    const prisma = makePrisma({
      ...healthyOpts(),
      lanes: [
        {
          lane: "drain",
          status: "running",
          lastStartedAt: new Date(NOW - 2 * HOUR).toISOString(),
          lastOutcome: "…",
        },
      ],
    });
    const r = await runSelfMaintenance(prisma, { now: NOW, force: true });
    const repair = r.repairs.find((x) => x.repair === "reset_wedged_lane");
    expect(repair?.attempted).toBe(true);
    expect(repair?.counts.lanesReset).toBe(1);
    expect(prisma.adminWorkerLaneState.updateMany).toHaveBeenCalled();
  });

  it("rewinds a cursor that walked past the end of its corpus", async () => {
    const prisma = makePrisma({
      ...healthyOpts(),
      cursors: [
        { memoryKey: "structured-cursor:saints", memoryValue: { offset: 9000, zeroStreak: 7 } },
      ],
    });
    const r = await runSelfMaintenance(prisma, { now: NOW, force: true });
    const repair = r.repairs.find((x) => x.repair === "reset_cursor");
    expect(repair?.counts.cursorsReset).toBe(1);
    expect(prisma.__memory.get("structured-cursor:saints")).toMatchObject({
      offset: 0,
      zeroStreak: 0,
    });
  });
});

describe("REPAIR: restore content a gate now passes", () => {
  const restorable = {
    ...healthyOpts(),
    rollbacks: [{ contentId: "c1", restorable: true, rollbackResult: "UNPUBLISHED" }],
    content: {
      c1: {
        id: "c1",
        contentType: "PRAYER",
        slug: "act-of-contrition",
        title: "Act of Contrition",
        subtitle: null,
        version: 3,
        payload: { sources: ["https://vatican.va/x"], body: "O my God, I am heartily sorry." },
        isPublished: false,
        contentChecksum: "abc",
      },
    },
  } satisfies FakeOpts;

  it("re-publishes it, snapshots first, and logs the reason — never deletes", async () => {
    const prisma = makePrisma(restorable);
    const r = await runSelfMaintenance(prisma, { passId: "p2", now: NOW, force: true });
    const repair = r.repairs.find((x) => x.repair === "restore_unpublished_content");
    expect(repair?.counts.restored).toBe(1);
    // Reversible: the pre-restore state is snapshotted before the flip.
    expect(prisma.__snapshots).toHaveLength(1);
    expect(prisma.__snapshots[0].changeKind).toBe("restore");
    const flip = prisma.__contentUpdates.find((u) => u.isPublished === true);
    expect(flip).toBeDefined();
    expect(prisma.publishedContent.delete).not.toHaveBeenCalled();
    expect(prisma.publishedContent.deleteMany).not.toHaveBeenCalled();
    const restoreLog = prisma.__logs.find(
      (l) => l.eventName === "self_maintenance_content_restored",
    );
    expect(String(restoreLog?.message)).toContain("act-of-contrition");
    expect(String(restoreLog?.message)).toContain("gate that now passes");
  });

  it("leaves a row alone while a human review is still PENDING on it", async () => {
    const prisma = makePrisma({ ...restorable, pendingReviews: 1 });
    const r = await runSelfMaintenance(prisma, { now: NOW, force: true });
    const repair = r.repairs.find((x) => x.repair === "restore_unpublished_content");
    expect(repair?.counts.restored).toBe(0);
    expect(repair?.counts.awaitingReview).toBe(1);
    expect(prisma.__contentUpdates).toHaveLength(0);
  });

  it("refuses to restore a row the publish-safety gate still blocks", async () => {
    const prisma = makePrisma({
      ...restorable,
      content: {
        c1: {
          ...restorable.content.c1,
          // No citations and no source URL → publish-safety says no.
          payload: { body: "…" },
        },
      },
    });
    const r = await runSelfMaintenance(prisma, { now: NOW, force: true });
    const repair = r.repairs.find((x) => x.repair === "restore_unpublished_content");
    expect(repair?.counts.restored).toBe(0);
    expect(repair?.counts.blocked).toBe(1);
    expect(prisma.__contentUpdates).toHaveLength(0);
  });

  it("is disable-able by env", async () => {
    process.env[REPAIR_ENV_SWITCH.restore_unpublished_content] = "0";
    const prisma = makePrisma(restorable);
    const r = await runSelfMaintenance(prisma, { now: NOW, force: true });
    expect(r.repairs.find((x) => x.condition === "ORPHANED_UNPUBLISHED_CONTENT")?.disabledBy).toBe(
      REPAIR_ENV_SWITCH.restore_unpublished_content,
    );
    expect(prisma.__contentUpdates).toHaveLength(0);
  });
});

describe("REPAIR: parked artifacts", () => {
  it("requeues them to BUILD_READY, bounded by `limit`", async () => {
    const prisma = makePrisma({
      ...healthyOpts(),
      parkedArtifacts: 40,
      parkedRows: [{ id: "a1" }, { id: "a2" }],
    });
    const r = await runSelfMaintenance(prisma, { now: NOW, force: true, limit: 2 });
    const repair = r.repairs.find((x) => x.repair === "requeue_artifact");
    expect(repair?.counts.artifactsRequeued).toBe(2);
    const call = vi.mocked(prisma.adminWorkerPackageArtifact.updateMany).mock.calls.at(-1)?.[0] as {
      data: Record<string, unknown>;
    };
    expect(call.data.status).toBe("BUILD_READY");
  });
});

/* ------------------------------------------------------------------ */

describe("VERIFY", () => {
  /** Bloat that the prune cannot shift: every batch reports 0 rows deleted. */
  const STUBBORN: FakeOpts = { ...BLOATED, prunedPerCall: [] };

  it("records that a repair did not move its signal", async () => {
    const prisma = makePrisma(STUBBORN);
    const r = await runSelfMaintenance(prisma, { now: NOW, force: true });
    const v = r.verifications.find((x) => x.condition === "LEDGER_BLOAT");
    expect(v?.improved).toBe(false);
    expect(v?.consecutiveFailures).toBe(1);
    expect(v?.escalated).toBe(false);
  });

  it("escalates and backs off after N consecutive ineffective repairs", async () => {
    // Sweep N times against a shared memory map so the failure counter carries.
    const shared = makePrisma(STUBBORN);
    let last = await runSelfMaintenance(shared, { now: NOW, force: true });
    for (let i = 1; i < VERIFY_FAILURE_LIMIT; i += 1) {
      resetSelfMaintenanceThrottle();
      last = await runSelfMaintenance(shared, { now: NOW + i * HOUR, force: true });
    }
    const v = last.verifications.find((x) => x.condition === "LEDGER_BLOAT");
    expect(v?.consecutiveFailures).toBe(VERIFY_FAILURE_LIMIT);
    expect(v?.escalated).toBe(true);
    expect(v?.backoffUntil).not.toBeNull();
    expect(last.escalations).toBeGreaterThanOrEqual(1);
    // Escalation goes through the existing HumanReviewQueue path.
    expect(shared.__reviews.length).toBeGreaterThanOrEqual(1);
    expect(String(shared.__reviews[0].proposedAction)).toContain("ledger_bloat");

    // …and the next sweep leaves the condition alone entirely: no repair, no row.
    resetSelfMaintenanceThrottle();
    const before = shared.__logs.length;
    const after = await runSelfMaintenance(shared, {
      now: NOW + VERIFY_FAILURE_LIMIT * HOUR,
      force: true,
    });
    const skipped = after.repairs.find((x) => x.condition === "LEDGER_BLOAT");
    expect(skipped?.attempted).toBe(false);
    expect(skipped?.backedOff).toBe(true);
    expect(shared.__logs.length).toBe(before);
    // The backoff is bounded, not permanent.
    expect(CONDITION_BACKOFF_MS).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ */

describe("throttle + master gate", () => {
  it("runs at most once per interval", async () => {
    const prisma = makePrisma(healthyOpts());
    expect((await runSelfMaintenance(prisma, { now: NOW })).ran).toBe(true);
    const second = await runSelfMaintenance(prisma, { now: NOW + 60_000 });
    expect(second.ran).toBe(false);
    expect(second.skippedReason).toBe("throttled");
    // …and the throttle is DURABLE, so a restart does not re-sweep immediately.
    resetSelfMaintenanceThrottle();
    expect((await runSelfMaintenance(prisma, { now: NOW + 60_000 })).ran).toBe(false);
    expect((await runSelfMaintenance(prisma, { now: NOW + 16 * 60_000 })).ran).toBe(true);
  });

  it("is fully disabled by ADMIN_WORKER_SELF_MAINT=0", async () => {
    process.env.ADMIN_WORKER_SELF_MAINT = "0";
    const prisma = makePrisma(BLOATED);
    const r = await runSelfMaintenance(prisma, { now: NOW, force: true });
    expect(r.ran).toBe(false);
    expect(r.skippedReason).toBe("disabled");
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(prisma.__logs).toHaveLength(0);
  });

  it("never throws, even against a client that has nothing on it", async () => {
    const r = await runSelfMaintenance({} as never, { now: NOW, force: true });
    expect(r.ran).toBe(true);
  });
});

/* ------------------------------------------------------------------ */

describe("event sampler", () => {
  it("writes up to the hourly budget, then drops and says so exactly once", () => {
    const opts = { now: NOW, budgetPerHour: 3, cooldownMs: 10 * 60_000 };
    for (let i = 0; i < 3; i += 1) expect(sampleWorkerEvent("loop_paused", opts).write).toBe(true);
    const first = sampleWorkerEvent("loop_paused", opts);
    expect(first.write).toBe(false);
    expect(first.suppressionStarted).toBe(true);
    // Every subsequent drop is silent — one notice per cool-down, not per tick.
    for (let i = 0; i < 500; i += 1) {
      const d = sampleWorkerEvent("loop_paused", { ...opts, now: NOW + i });
      expect(d.write).toBe(false);
      expect(d.suppressionStarted).toBe(false);
    }
    // After the cool-down the next write carries the suppressed count with it.
    const resumed = sampleWorkerEvent("loop_paused", { ...opts, now: NOW + 11 * 60_000 });
    expect(resumed.write).toBe(true);
    expect(resumed.suppressed).toBeGreaterThan(500);
  });

  it("suppressWorkerEvent silences an event the sweep named from the ledger", () => {
    suppressWorkerEvent("mission_control", { now: NOW, cooldownMs: 60_000 });
    expect(sampleWorkerEvent("mission_control", { now: NOW + 1 }).write).toBe(false);
    expect(sampleWorkerEvent("mission_control", { now: NOW + 61_000 }).write).toBe(true);
  });

  it("the LOG_EVENT_SPAM repair actually silences the offender it named", async () => {
    const prisma = makePrisma({
      ...healthyOpts(),
      eventRates: [{ eventName: "sitemap_discovery", perHour: 9_000 }],
    });
    const r = await runSelfMaintenance(prisma, { now: NOW, force: true });
    expect(r.conditions.map((c) => c.name)).toContain("LOG_EVENT_SPAM");
    const snap = eventSamplerSnapshot().find((s) => s.eventName === "sitemap_discovery");
    expect(snap?.suppressedUntil).toBeGreaterThan(NOW);
  });
});

/* ------------------------------------------------------------------ */

describe("wiring", () => {
  it("runs from an OPS lane — so only while the loop runs, i.e. switch ON", async () => {
    const { OPS_LANES, CONTENT_LANES } = await import("@/lib/admin-worker/worker-lanes");
    const lane = OPS_LANES.find((l) => l.name === "maint-self-heal");
    expect(lane).toBeDefined();
    expect(lane!.capacity).toBe(1);
    expect(lane!.watchdogMs).toBe(6 * 60 * 1000);
    // It is NOT a content lane: it never grows or publishes new content, and it
    // must keep working while the Python brain is degraded.
    expect(CONTENT_LANES.some((l) => l.name === "maint-self-heal")).toBe(false);
    expect(lane!.activeOnly).toBeFalsy();
    expect(lane!.growth).toBeFalsy();
    expect(lane!.discovery).toBeFalsy();
  });

  it("has no timer, interval or cron of its own — the lane is the only trigger", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(
      join(process.cwd(), "src/lib/admin-worker/self-maintenance.ts"),
      "utf8",
    );
    // The master-switch resource guarantee only holds if nothing here can run
    // outside a pass.
    expect(src).not.toMatch(/setInterval|setTimeout|cron/);
  });

  it("is exported from the package index", async () => {
    const index = await import("@/lib/admin-worker");
    expect(typeof index.runSelfMaintenance).toBe("function");
    expect(typeof index.sampleWorkerEvent).toBe("function");
    expect(typeof index.senseSelfHealth).toBe("function");
    expect(typeof index.diagnoseConditions).toBe("function");
  });
});
