/**
 * The authenticated HTTPS API the iPhone talks to.
 *
 * Three routes, one job: let the operator watch the Admin Worker and turn it
 * on or off from a phone, WITHOUT the phone ever becoming a worker. The
 * behaviours pinned here are the ones that would silently break that promise:
 *
 *   - the switch route writes the durable row and nothing else — no lease, no
 *     child process, no second lifecycle;
 *   - status is a pure read (a phone polling must not write a row, not even
 *     the AdminWorkerState upsert the shared helper would do);
 *   - an unreadable database reports "unknown", never "off";
 *   - the snapshot route never triggers the goal refresh, which is a write;
 *   - every accepted switch change is recorded with the actor.
 *
 * Gate behaviour (401 / CSRF / banned device) lives in
 * tests/security/worker-remote-control-gate.test.ts.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

const requireAdminMock = vi.fn();
const readMasterSwitchMock = vi.fn();
const setMasterSwitchMock = vi.fn();
const readExecutionStatusMock = vi.fn();
const acquireExecutionLeaseMock = vi.fn();
const readHostPresenceMock = vi.fn();
const loadCommandCenterSnapshotMock = vi.fn();
const writeAuditMock = vi.fn();
const writeAdminActionLogMock = vi.fn();

const { adminWorkerStateFindFirstMock } = vi.hoisted(() => ({
  adminWorkerStateFindFirstMock: vi.fn(),
}));

function dbMock() {
  return { ...prismaMock, adminWorkerState: { findFirst: adminWorkerStateFindFirstMock } };
}

vi.mock("@/lib/auth", () => ({
  requireAdmin: (...args: unknown[]) => requireAdminMock(...args),
}));
vi.mock("@/lib/security/security-events", () => ({
  reportSecurityBreach: vi.fn(),
  reportSuspiciousActivity: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ prisma: dbMock() }));
vi.mock("@/lib/db/client", () => ({ prisma: dbMock() }));
vi.mock("@/lib/admin-worker/execution-host", () => ({
  readMasterSwitch: (...args: unknown[]) => readMasterSwitchMock(...args),
  setMasterSwitch: (...args: unknown[]) => setMasterSwitchMock(...args),
  readExecutionStatus: (...args: unknown[]) => readExecutionStatusMock(...args),
  acquireExecutionLease: (...args: unknown[]) => acquireExecutionLeaseMock(...args),
}));
vi.mock("@/lib/admin-worker/host-presence", () => ({
  readHostPresence: (...args: unknown[]) => readHostPresenceMock(...args),
  describeHostPresence: () => "Mac runtime alive on MacBook Pro, worker running.",
}));
vi.mock("@/lib/admin-worker/command-center", () => ({
  loadCommandCenterSnapshot: (...args: unknown[]) => loadCommandCenterSnapshotMock(...args),
}));
vi.mock("@/lib/audit", () => ({ writeAudit: (...a: unknown[]) => writeAuditMock(...a) }));
vi.mock("@/lib/audit/admin-action-log", () => ({
  writeAdminActionLog: (...a: unknown[]) => writeAdminActionLogMock(...a),
}));

import type { NextRequest } from "next/server";

import { _resetRemoteConsoleCachesForTests } from "@/lib/admin-worker/remote-console";
import { GET as statusGET } from "@/app/api/admin/worker/status/route";
import { GET as snapshotGET } from "@/app/api/admin/worker/snapshot/route";
import { POST as switchPOST } from "@/app/api/admin/worker/switch/route";
import { normalizeSwitchClient } from "@/app/api/admin/worker/shared";

const APP_ORIGIN = "https://viafidei.example.com";

function buildReq(args: {
  path: string;
  method?: string;
  origin?: string | null;
  body?: unknown;
  device?: string;
}): NextRequest {
  const url = `${APP_ORIGIN}${args.path}`;
  const headers = new Headers({
    host: "viafidei.example.com",
    "x-forwarded-host": "viafidei.example.com",
    "x-forwarded-proto": "https",
    "x-request-id": "req-test-1",
  });
  if (args.origin) headers.set("origin", args.origin);
  if (args.body !== undefined) headers.set("content-type", "application/json");
  const base = new Request(url, {
    method: args.method ?? "GET",
    headers,
    ...(args.body === undefined ? {} : { body: JSON.stringify(args.body) }),
  });
  return Object.assign(base, {
    nextUrl: new URL(url),
    cookies: {
      get(name: string) {
        if (name === "vf_dev_id" && args.device) return { value: args.device };
        return undefined;
      },
    },
  }) as unknown as NextRequest;
}

const RUNNING_EXECUTION = {
  state: "LOCAL_ACTIVE" as const,
  switch: {
    on: true,
    changedAt: "2026-09-09T11:00:00.000Z",
    changedBy: "admin",
    changedFrom: "iphone-app",
    known: true,
  },
  lease: {
    runtimeId: "rt-1",
    origin: "LOCAL_MACBOOK" as const,
    host: {
      label: "MacBook Pro · darwin arm64",
      platform: "darwin",
      arch: "arm64",
      cpuCount: 10,
      launchedBy: "swift-app",
    },
    pid: 4242,
    acquiredAt: "2026-09-09T10:00:00.000Z",
    renewedAt: "2026-09-09T11:59:50.000Z",
    workerVersion: "1.0.0",
  },
  leaseAgeMs: 5_000,
  leaseLive: true,
  executingLocally: true,
  label: "Admin Worker active locally on MacBook Pro · darwin arm64.",
  known: true,
};

const PRESENCE = {
  presence: {
    runtimeId: "rt-1",
    hostLabel: "MacBook Pro · darwin arm64",
    pid: 4242,
    origin: "LOCAL_MACBOOK" as const,
    at: new Date().toISOString(),
    intervalMs: 7_000,
    staleAfterMs: 30_000,
    runState: "running" as const,
    workerRunning: true,
    workerStartedAt: "2026-09-09T10:00:00.000Z",
    switchOn: true,
    failureReason: null,
    leaseHeldElsewhere: false,
  },
  ageMs: 1_000,
  alive: true,
  known: true,
};

const STATE_ROW = {
  currentMode: "GROWTH",
  currentPriority: "CONTENT_GROWTH",
  currentGoal: "grow prayers",
  currentTask: "building prayer 12",
  currentBlocker: null,
  lastHeartbeatAt: new Date(Date.now() - 5_000),
  lastSuccessfulAt: new Date(Date.now() - 60_000),
  lastFailedAt: null,
  workerVersion: "1.0.0",
  paused: false,
  pausedReason: null,
};

function minimalSnapshot() {
  return {
    generatedAt: "2026-09-09T12:00:00.000Z",
    execution: RUNNING_EXECUTION,
    state: STATE_ROW,
    heartbeatAgeMs: 5_000,
    workerLive: true,
    diagnostics: { ratings: [], summary: { pass: 1, warn: 0, fail: 0 } },
    metrics: { publishedContentLive: 3412 },
    mission: null,
    goals: [{ contentType: "prayer", currentValidCount: 10, gapCount: 5, status: "BEHIND" }],
    funnel: [],
    coverage: [],
    growth: [],
    pipeline: [],
    artifactStatus: {},
    passes: [],
    decisions: [],
    brain: {
      latestFinalBrain: "python",
      degradedEvents24h: 0,
      selectActionCalls24h: 3,
      latestDecision: null,
      rankedAlternatives: [],
      reasoning: [],
    },
    sourceReputation: [],
    sourceActivity: [],
    memory: [],
    knowledge: { nodes: 1, edges: 2, recentNodes: [] },
    logs: [],
    rules: [],
    skills: [],
    repairPlans: [],
    reviewQueue: [],
    qualityScores: [],
    strictQA: [],
    rollbacks: [],
    security: [],
    homepageDrafts: [],
    publishing: [],
    readingsCoverage: null,
    contentCatalogTotal: 3412,
  };
}

/** Each test gets its own admin username so the rate-limit buckets (keyed by
 * username, and module-level) cannot leak between cases. */
let seq = 0;
function admin(): { username: string; signedInAt: number } {
  seq += 1;
  return { username: `operator-${seq}`, signedInAt: Date.now() };
}

beforeEach(() => {
  resetPrismaMock();
  _resetRemoteConsoleCachesForTests();
  requireAdminMock.mockReset();
  readMasterSwitchMock.mockReset();
  setMasterSwitchMock.mockReset();
  readExecutionStatusMock.mockReset();
  acquireExecutionLeaseMock.mockReset();
  readHostPresenceMock.mockReset();
  loadCommandCenterSnapshotMock.mockReset();
  writeAuditMock.mockReset();
  writeAdminActionLogMock.mockReset();
  adminWorkerStateFindFirstMock.mockReset();

  requireAdminMock.mockResolvedValue(admin());
  readExecutionStatusMock.mockResolvedValue(RUNNING_EXECUTION);
  readHostPresenceMock.mockResolvedValue(PRESENCE);
  adminWorkerStateFindFirstMock.mockResolvedValue(STATE_ROW);
  readMasterSwitchMock.mockResolvedValue(RUNNING_EXECUTION.switch);
  setMasterSwitchMock.mockImplementation(
    async (_p: unknown, opts: { on: boolean; actor?: string; from?: string }) => ({
      on: opts.on,
      changedAt: "2026-09-09T12:00:00.000Z",
      changedBy: opts.actor ?? "operator",
      changedFrom: opts.from ?? "swift-app",
      known: true,
    }),
  );
  loadCommandCenterSnapshotMock.mockResolvedValue(minimalSnapshot());
  writeAuditMock.mockResolvedValue(undefined);
  writeAdminActionLogMock.mockResolvedValue("action-1");
});

describe("GET /api/admin/worker/status", () => {
  it("serves the durable switch, execution state, Mac presence and worker state", async () => {
    const res = await statusGET(buildReq({ path: "/api/admin/worker/status" }));
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(body.status.switch).toMatchObject({ on: true, known: true, changedFrom: "iphone-app" });
    expect(body.status.execution.state).toBe("LOCAL_ACTIVE");
    expect(body.status.execution.lease).toMatchObject({
      runtimeId: "rt-1",
      hostLabel: "MacBook Pro · darwin arm64",
      live: true,
    });
    expect(body.status.host).toMatchObject({ alive: true, known: true, workerRunning: true });
    expect(body.status.host.label).toContain("Mac runtime alive");
    expect(body.status.worker).toMatchObject({ live: true, mode: "GROWTH", paused: false });
    expect(body.status.degraded).toBe(false);
    // The phone must not hard-code the Mac's poll cadence.
    expect(body.status.actuation.hostPollIntervalMs).toBe(7_000);
    expect(body.status.actuation.pendingWindowMs).toBeGreaterThan(0);
    expect(res.headers.get("cache-control")).toContain("no-store");
  });

  it("is a pure read — a phone polling never writes a row", async () => {
    // The AdminWorkerState delegate on the mock exposes `findFirst` and
    // nothing else, so the shared `getAdminWorkerState` helper (which UPSERTS,
    // bumping updatedAt on every poll) would throw rather than pass here.
    const res = await statusGET(buildReq({ path: "/api/admin/worker/status" }));
    expect(res.status).toBe(200);
    expect(adminWorkerStateFindFirstMock).toHaveBeenCalledTimes(1);
    expect(setMasterSwitchMock).not.toHaveBeenCalled();
    expect(acquireExecutionLeaseMock).not.toHaveBeenCalled();
  });

  it("caches for two seconds so a fast poll does not multiply the reads", async () => {
    for (let i = 0; i < 5; i += 1) {
      const res = await statusGET(buildReq({ path: "/api/admin/worker/status" }));
      expect(res.status).toBe(200);
    }
    expect(readExecutionStatusMock).toHaveBeenCalledTimes(1);
    expect(readHostPresenceMock).toHaveBeenCalledTimes(1);
    expect(adminWorkerStateFindFirstMock).toHaveBeenCalledTimes(1);
  });

  it("reports an unreadable database as unknown, never as OFF", async () => {
    readExecutionStatusMock.mockResolvedValue({
      ...RUNNING_EXECUTION,
      state: "OFF",
      switch: {
        on: false,
        changedAt: null,
        changedBy: null,
        changedFrom: null,
        known: false,
        error: "Can't reach database server",
      },
      known: false,
      error: "Can't reach database server",
      label: "Admin Worker state unknown — the database could not be read.",
    });
    readHostPresenceMock.mockResolvedValue({
      presence: null,
      ageMs: null,
      alive: false,
      known: false,
      error: "Can't reach database server",
    });
    const res = await statusGET(buildReq({ path: "/api/admin/worker/status" }));
    const body = await res.json();
    expect(body.status.degraded).toBe(true);
    expect(body.status.switch.known).toBe(false);
    expect(body.status.execution.known).toBe(false);
    expect(body.status.host.known).toBe(false);
  });

  it("does not call a stale heartbeat a live worker", async () => {
    adminWorkerStateFindFirstMock.mockResolvedValue({
      ...STATE_ROW,
      lastHeartbeatAt: new Date(Date.now() - 60 * 60 * 1000),
    });
    const res = await statusGET(buildReq({ path: "/api/admin/worker/status" }));
    const body = await res.json();
    expect(body.status.worker.live).toBe(false);
    expect(body.status.worker.heartbeatAgeMs).toBeGreaterThan(10 * 60 * 1000);
  });

  it("separates 'the Mac app is up' from 'the worker is working'", async () => {
    // App running, switch off: presence alive, no worker child, no lease.
    readExecutionStatusMock.mockResolvedValue({
      ...RUNNING_EXECUTION,
      state: "OFF",
      switch: { ...RUNNING_EXECUTION.switch, on: false },
      lease: null,
      leaseLive: false,
      leaseAgeMs: null,
      executingLocally: false,
    });
    readHostPresenceMock.mockResolvedValue({
      ...PRESENCE,
      presence: { ...PRESENCE.presence, runState: "off", workerRunning: false, switchOn: false },
    });
    const res = await statusGET(buildReq({ path: "/api/admin/worker/status" }));
    const body = await res.json();
    expect(body.status.host.alive).toBe(true);
    expect(body.status.host.workerRunning).toBe(false);
    expect(body.status.worker.live).toBe(false);
    expect(body.status.execution.state).toBe("OFF");
  });
});

describe("GET /api/admin/worker/snapshot", () => {
  it("returns the trimmed command-centre snapshot plus the status header data", async () => {
    const res = await snapshotGET(buildReq({ path: "/api/admin/worker/snapshot" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.snapshot.contentCatalogTotal).toBe(3412);
    expect(body.snapshot.goals.items[0].contentType).toBe("prayer");
    expect(body.snapshot.trimmed.version).toBe(1);
    expect(body.status.execution.state).toBe("LOCAL_ACTIVE");
    expect(body.cache).toMatchObject({ cached: false, forced: false });
    expect(body.cache.ttlMs).toBe(30_000);
  });

  it("never refreshes content goals — a phone poll must not write to production", async () => {
    await snapshotGET(buildReq({ path: "/api/admin/worker/snapshot" }));
    await snapshotGET(buildReq({ path: "/api/admin/worker/snapshot?refresh=1" }));
    for (const call of loadCommandCenterSnapshotMock.mock.calls) {
      expect(call[1]).toEqual({ refreshGoals: false });
    }
  });

  it("serves the cache to repeated polls and reloads only on an explicit refresh", async () => {
    await snapshotGET(buildReq({ path: "/api/admin/worker/snapshot" }));
    const second = await snapshotGET(buildReq({ path: "/api/admin/worker/snapshot" }));
    expect((await second.json()).cache.cached).toBe(true);
    expect(loadCommandCenterSnapshotMock).toHaveBeenCalledTimes(1);

    const forced = await snapshotGET(buildReq({ path: "/api/admin/worker/snapshot?refresh=1" }));
    expect((await forced.json()).cache.forced).toBe(true);
    expect(loadCommandCenterSnapshotMock).toHaveBeenCalledTimes(2);
  });

  it("holds the snapshot for five minutes while nothing is executing", async () => {
    readExecutionStatusMock.mockResolvedValue({
      ...RUNNING_EXECUTION,
      state: "OFF",
      switch: { ...RUNNING_EXECUTION.switch, on: false },
      executingLocally: false,
      leaseLive: false,
    });
    const res = await snapshotGET(buildReq({ path: "/api/admin/worker/snapshot" }));
    expect((await res.json()).cache.ttlMs).toBe(300_000);
  });

  it("answers 503 rather than a broken body when the snapshot cannot be built", async () => {
    loadCommandCenterSnapshotMock.mockRejectedValue(new Error("boom"));
    const res = await snapshotGET(buildReq({ path: "/api/admin/worker/snapshot" }));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toMatchObject({
      ok: false,
      error: "server_error",
      message: "worker_snapshot_unavailable",
    });
    expect(body.requestId).toBe("req-test-1");
  });

  it("rate-limits forced refreshes far harder than ordinary polls", async () => {
    const req = () => buildReq({ path: "/api/admin/worker/snapshot?refresh=1" });
    const statuses: number[] = [];
    for (let i = 0; i < 8; i += 1) {
      statuses.push((await snapshotGET(req())).status);
    }
    expect(statuses.slice(0, 6).every((s) => s === 200)).toBe(true);
    expect(statuses.at(-1)).toBe(429);
  });
});

describe("POST /api/admin/worker/switch", () => {
  const path = "/api/admin/worker/switch";

  it("writes the durable row with the actor and starts nothing", async () => {
    const res = await switchPOST(
      buildReq({
        path,
        method: "POST",
        origin: APP_ORIGIN,
        body: { on: true, client: "iPhone App" },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(setMasterSwitchMock).toHaveBeenCalledTimes(1);
    const [, opts] = setMasterSwitchMock.mock.calls[0]!;
    expect(opts).toMatchObject({ on: true, from: "iphone-app" });
    expect(opts.actor).toMatch(/^operator-/);

    // The phone never runs the worker: no lease claim, no child, no second
    // lifecycle. The Mac's reconcile poll does all of that.
    expect(acquireExecutionLeaseMock).not.toHaveBeenCalled();

    expect(body.switch).toMatchObject({ on: true, changedFrom: "iphone-app", known: true });
    expect(body.actuation.pending).toBe(true);
    expect(body.actuation.windowMs).toBeGreaterThanOrEqual(15_000);
    expect(body.status.switch.on).toBe(true);
  });

  it("records the change as an audit event naming the actor", async () => {
    await switchPOST(buildReq({ path, method: "POST", origin: APP_ORIGIN, body: { on: false } }));

    expect(writeAdminActionLogMock).toHaveBeenCalledTimes(1);
    const action = writeAdminActionLogMock.mock.calls[0]![0];
    expect(action).toMatchObject({
      actionType: "admin_worker_switch_off",
      route: path,
      method: "POST",
      result: "success",
    });
    expect(action.adminUsername).toMatch(/^operator-/);
    expect(action.metadata).toMatchObject({ on: false, from: "remote-api", previousOn: true });

    expect(writeAuditMock).toHaveBeenCalledTimes(1);
    const audit = writeAuditMock.mock.calls[0]![0];
    expect(audit).toMatchObject({
      action: "admin.worker.master_switch",
      entityType: "AdminWorkerSwitch",
      entityId: "worker.execution.switch",
      previousValue: { on: true, known: true },
      newValue: { on: false, changedFrom: "remote-api" },
    });
    expect(audit.actorUsername).toMatch(/^operator-/);
  });

  it("uses a distinct action type per direction so the log cannot collapse a toggle", async () => {
    await switchPOST(buildReq({ path, method: "POST", origin: APP_ORIGIN, body: { on: true } }));
    await switchPOST(buildReq({ path, method: "POST", origin: APP_ORIGIN, body: { on: false } }));
    const types = writeAdminActionLogMock.mock.calls.map((c) => c[0].actionType);
    expect(types).toEqual(["admin_worker_switch_on", "admin_worker_switch_off"]);
  });

  it("refuses anything but a real boolean and writes nothing", async () => {
    for (const bad of [{ on: "true" }, { on: 1 }, { on: null }, {}]) {
      const res = await switchPOST(
        buildReq({ path, method: "POST", origin: APP_ORIGIN, body: bad }),
      );
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({
        ok: false,
        error: "invalid",
        message: "on_must_be_boolean",
      });
    }
    expect(setMasterSwitchMock).not.toHaveBeenCalled();
  });

  it("refuses a request with no body at all", async () => {
    const res = await switchPOST(buildReq({ path, method: "POST", origin: APP_ORIGIN }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "invalid", message: "body_required" });
    expect(setMasterSwitchMock).not.toHaveBeenCalled();
  });

  it("does not claim success when the durable write fails", async () => {
    setMasterSwitchMock.mockRejectedValue(new Error("Can't reach database server"));
    const res = await switchPOST(
      buildReq({ path, method: "POST", origin: APP_ORIGIN, body: { on: true } }),
    );
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({
      ok: false,
      error: "server_error",
      message: "switch_write_failed",
    });
    expect(writeAdminActionLogMock.mock.calls[0]![0]).toMatchObject({ result: "failure" });
    expect(writeAuditMock).not.toHaveBeenCalled();
  });

  it("still honours the operator's intent when the PREVIOUS value cannot be read", async () => {
    readMasterSwitchMock.mockResolvedValue({
      on: false,
      changedAt: null,
      changedBy: null,
      changedFrom: null,
      known: false,
      error: "Can't reach database server",
    });
    const res = await switchPOST(
      buildReq({ path, method: "POST", origin: APP_ORIGIN, body: { on: true } }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).previousOn).toBeNull();
    expect(setMasterSwitchMock).toHaveBeenCalledTimes(1);
  });

  it("rate-limits the toggle and says when to retry", async () => {
    let last: Response | null = null;
    for (let i = 0; i < 14; i += 1) {
      last = await switchPOST(
        buildReq({ path, method: "POST", origin: APP_ORIGIN, body: { on: i % 2 === 0 } }),
      );
    }
    expect(last!.status).toBe(429);
    expect(await last!.json()).toMatchObject({
      ok: false,
      error: "rate_limited",
      message: "worker_switch",
    });
    expect(last!.headers.get("Retry-After")).toBeTruthy();
    expect(last!.headers.get("X-RateLimit-Limit")).toBe("12");
  });
});

describe("normalizeSwitchClient", () => {
  it("reduces client-supplied provenance to a short display slug", () => {
    expect(normalizeSwitchClient("iPhone App")).toBe("iphone-app");
    expect(normalizeSwitchClient("  swift-app  ")).toBe("swift-app");
    expect(normalizeSwitchClient("<script>alert(1)</script>")).toBe("script-alert-1-script");
    expect(normalizeSwitchClient("x".repeat(200))).toHaveLength(32);
  });

  it("falls back to the default for anything unusable", () => {
    expect(normalizeSwitchClient(undefined)).toBe("remote-api");
    expect(normalizeSwitchClient(42)).toBe("remote-api");
    expect(normalizeSwitchClient("!!!")).toBe("remote-api");
  });
});
