/**
 * The iPhone remote control can START A WORKLOAD AGAINST PRODUCTION. That is
 * the whole reason this suite exists.
 *
 * The rule is that a native client gets NO second authentication path. It goes
 * through `gateAdminApiCall` like the browser admin does, which means all four
 * of these, in this order: CSRF (mutations), banned device, a completed-2FA
 * admin session, and only then the handler. A native app satisfies the CSRF
 * stage the same way a browser does — by sending an `Origin` header naming the
 * canonical origin — and this suite pins that a POST WITHOUT one is refused,
 * because the temptation with a native client is to exempt the route instead.
 *
 * Proved here, per route:
 *   1. an unauthenticated caller is refused 401 and no work runs;
 *   2. a PENDING (password-only, no second factor) admin session is refused
 *      exactly like an anonymous caller — the switch is not reachable with
 *      half a sign-in;
 *   3. a mutation with a missing Origin is refused 403 before auth is
 *      consulted, and so is a cross-origin one;
 *   4. a banned device is refused 403 and no work runs;
 *   5. a properly authenticated, same-origin caller SUCCEEDS — including the
 *      reads, whose CSRF stage is a documented no-op for safe methods;
 *   6. statically, all three route files reach the central gate in every
 *      exported handler.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

const requireAdminMock = vi.fn();
const isDeviceBannedMock = vi.fn();
const recordBannedDeviceHitMock = vi.fn();
const readMasterSwitchMock = vi.fn();
const setMasterSwitchMock = vi.fn();
const readExecutionStatusMock = vi.fn();
const readHostPresenceMock = vi.fn();
const loadCommandCenterSnapshotMock = vi.fn();
const reportSecurityBreachMock = vi.fn();

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
  reportSecurityBreach: (...args: unknown[]) => reportSecurityBreachMock(...args),
  reportSuspiciousActivity: vi.fn(),
}));
vi.mock("@/lib/security/security-event-store", () => ({
  isDeviceBanned: (...args: unknown[]) => isDeviceBannedMock(...args),
  recordBannedDeviceHit: (...args: unknown[]) => recordBannedDeviceHitMock(...args),
}));
vi.mock("@/lib/db", () => ({ prisma: dbMock() }));
vi.mock("@/lib/db/client", () => ({ prisma: dbMock() }));
vi.mock("@/lib/admin-worker/execution-host", () => ({
  readMasterSwitch: (...args: unknown[]) => readMasterSwitchMock(...args),
  setMasterSwitch: (...args: unknown[]) => setMasterSwitchMock(...args),
  readExecutionStatus: (...args: unknown[]) => readExecutionStatusMock(...args),
  acquireExecutionLease: vi.fn(),
}));
vi.mock("@/lib/admin-worker/host-presence", () => ({
  readHostPresence: (...args: unknown[]) => readHostPresenceMock(...args),
  describeHostPresence: () => "Mac runtime alive.",
}));
vi.mock("@/lib/admin-worker/command-center", () => ({
  loadCommandCenterSnapshot: (...args: unknown[]) => loadCommandCenterSnapshotMock(...args),
}));
vi.mock("@/lib/audit", () => ({ writeAudit: vi.fn() }));
vi.mock("@/lib/audit/admin-action-log", () => ({ writeAdminActionLog: vi.fn() }));

import type { NextRequest } from "next/server";

import { _resetAdminScanCountersForTests } from "@/lib/security/admin-route-scanner";
import {
  adminRoutesBypassingCentralGate,
  scanAdminRouteGateCoverage,
} from "@/lib/security/admin-route-coverage";
import { _resetRemoteConsoleCachesForTests } from "@/lib/admin-worker/remote-console";
import { GET as statusGET } from "@/app/api/admin/worker/status/route";
import { GET as snapshotGET } from "@/app/api/admin/worker/snapshot/route";
import { POST as switchPOST } from "@/app/api/admin/worker/switch/route";

const APP_ORIGIN = "https://viafidei.example.com";
const EVIL_ORIGIN = "https://evil.example.com";
const BANNED_DEVICE = "banned-device-credential-value-0000000000";

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

type RouteCase = {
  name: string;
  route: string;
  path: string;
  method: "GET" | "POST";
  mutating: boolean;
  body?: unknown;
  call: (req: NextRequest) => Promise<Response>;
  /** The domain call the handler makes once the gate lets it through. */
  work: () => ReturnType<typeof vi.fn>;
};

const CASES: RouteCase[] = [
  {
    name: "status",
    route: "src/app/api/admin/worker/status/route.ts",
    path: "/api/admin/worker/status",
    method: "GET",
    mutating: false,
    call: (req) => statusGET(req),
    work: () => readExecutionStatusMock,
  },
  {
    name: "snapshot",
    route: "src/app/api/admin/worker/snapshot/route.ts",
    path: "/api/admin/worker/snapshot",
    method: "GET",
    mutating: false,
    call: (req) => snapshotGET(req),
    work: () => loadCommandCenterSnapshotMock,
  },
  {
    name: "switch",
    route: "src/app/api/admin/worker/switch/route.ts",
    path: "/api/admin/worker/switch",
    method: "POST",
    mutating: true,
    body: { on: true },
    call: (req) => switchPOST(req),
    work: () => setMasterSwitchMock,
  },
];

const EXECUTION = {
  state: "OFF" as const,
  switch: { on: false, changedAt: null, changedBy: null, changedFrom: null, known: true },
  lease: null,
  leaseAgeMs: null,
  leaseLive: false,
  executingLocally: false,
  label: "Admin Worker OFF.",
  known: true,
};

let seq = 0;

beforeEach(() => {
  resetPrismaMock();
  _resetAdminScanCountersForTests();
  _resetRemoteConsoleCachesForTests();
  requireAdminMock.mockReset();
  isDeviceBannedMock.mockReset().mockResolvedValue(false);
  recordBannedDeviceHitMock.mockReset().mockResolvedValue(undefined);
  readMasterSwitchMock.mockReset().mockResolvedValue(EXECUTION.switch);
  setMasterSwitchMock.mockReset().mockResolvedValue({ ...EXECUTION.switch, on: true });
  readExecutionStatusMock.mockReset().mockResolvedValue(EXECUTION);
  readHostPresenceMock
    .mockReset()
    .mockResolvedValue({ presence: null, ageMs: null, alive: false, known: true });
  loadCommandCenterSnapshotMock.mockReset().mockResolvedValue({
    generatedAt: "2026-09-09T12:00:00.000Z",
    execution: EXECUTION,
    state: {},
    heartbeatAgeMs: null,
    workerLive: false,
    diagnostics: { ratings: [], summary: { pass: 0, warn: 0, fail: 0 } },
    metrics: {},
    mission: null,
    goals: [],
    funnel: [],
    coverage: [],
    growth: [],
    pipeline: [],
    artifactStatus: {},
    passes: [],
    decisions: [],
    brain: {
      latestFinalBrain: null,
      degradedEvents24h: 0,
      selectActionCalls24h: 0,
      latestDecision: null,
      rankedAlternatives: [],
      reasoning: [],
    },
    sourceReputation: [],
    sourceActivity: [],
    memory: [],
    knowledge: { nodes: 0, edges: 0, recentNodes: [] },
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
    contentCatalogTotal: 0,
  });
  reportSecurityBreachMock.mockReset();
  adminWorkerStateFindFirstMock.mockReset().mockResolvedValue(null);
});

/** A fresh admin identity per call so the per-username rate buckets never
 * collide between cases in this file. */
function signedInAdmin(): void {
  seq += 1;
  requireAdminMock.mockResolvedValue({ username: `gate-admin-${seq}`, signedInAt: Date.now() });
}

describe.each(CASES)("$name route goes through the central admin gate", (route) => {
  it("refuses an unauthenticated (or password-only) caller with 401 and runs no work", async () => {
    // `requireAdmin()` resolves the server-side AdminSession row and returns
    // null both for no session at all AND while the row is still PENDING —
    // a password-verified, second-factor-pending sign-in is not an
    // administrator, so the remote control is unreachable with half a login.
    requireAdminMock.mockResolvedValue(null);
    const res = await route.call(
      buildReq({
        path: route.path,
        method: route.method,
        origin: APP_ORIGIN,
        body: route.body,
      }),
    );
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ ok: false, error: "unauthorized" });
    expect(route.work()).not.toHaveBeenCalled();
  });

  it("denies when the authorization state cannot be determined at all", async () => {
    // Fail closed: an exception out of the session store is an UNKNOWN
    // answer, and an unknown answer on a route that can start a production
    // workload is a denial, not a pass.
    requireAdminMock.mockRejectedValue(new Error("session store unreachable"));
    const res = await route.call(
      buildReq({ path: route.path, method: route.method, origin: APP_ORIGIN, body: route.body }),
    );
    expect(res.status).toBe(401);
    expect(route.work()).not.toHaveBeenCalled();
  });

  it("refuses a banned device with 403 and runs no work", async () => {
    signedInAdmin();
    isDeviceBannedMock.mockResolvedValue(true);
    const res = await route.call(
      buildReq({
        path: route.path,
        method: route.method,
        origin: APP_ORIGIN,
        body: route.body,
        device: BANNED_DEVICE,
      }),
    );
    expect(res.status).toBe(403);
    expect(await res.text()).toBe("Forbidden");
    expect(route.work()).not.toHaveBeenCalled();
  });

  it("fails closed with 503 when the ban store cannot be read", async () => {
    signedInAdmin();
    isDeviceBannedMock.mockRejectedValue(new Error("store down"));
    const res = await route.call(
      buildReq({
        path: route.path,
        method: route.method,
        origin: APP_ORIGIN,
        body: route.body,
        device: BANNED_DEVICE,
      }),
    );
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({
      error: "server_error",
      message: "security_state_unavailable",
    });
    expect(route.work()).not.toHaveBeenCalled();
  });

  it("lets an authenticated, same-origin caller through", async () => {
    signedInAdmin();
    const res = await route.call(
      buildReq({ path: route.path, method: route.method, origin: APP_ORIGIN, body: route.body }),
    );
    expect(res.status).toBe(200);
    expect(route.work()).toHaveBeenCalled();
  });
});

describe("CSRF — a native client presents what a browser presents", () => {
  const switchCase = CASES.find((c) => c.name === "switch")!;

  it("refuses the switch POST when no Origin or Referer is present", async () => {
    signedInAdmin();
    const res = await switchCase.call(
      buildReq({ path: switchCase.path, method: "POST", body: { on: true } }),
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "csrf", reason: "missing_origin" });
    expect(setMasterSwitchMock).not.toHaveBeenCalled();
    // Refused BEFORE authentication is consulted.
    expect(requireAdminMock).not.toHaveBeenCalled();
  });

  it("refuses the switch POST from a foreign origin and reports a breach", async () => {
    signedInAdmin();
    const res = await switchCase.call(
      buildReq({ path: switchCase.path, method: "POST", origin: EVIL_ORIGIN, body: { on: true } }),
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "csrf", reason: "cross_origin" });
    expect(setMasterSwitchMock).not.toHaveBeenCalled();
    expect(reportSecurityBreachMock).toHaveBeenCalledTimes(1);
    expect(reportSecurityBreachMock.mock.calls[0]![0]).toMatchObject({ kind: "csrf_violation" });
  });

  it("still serves the READS with a foreign Origin — safe methods skip CSRF by design", async () => {
    signedInAdmin();
    const res = await statusGET(
      buildReq({ path: "/api/admin/worker/status", origin: EVIL_ORIGIN }),
    );
    expect(res.status).toBe(200);
    expect(reportSecurityBreachMock).not.toHaveBeenCalled();
  });

  it("accepts a Referer instead of an Origin, as the browser rule allows", async () => {
    signedInAdmin();
    const url = `${APP_ORIGIN}/api/admin/worker/switch`;
    const base = new Request(url, {
      method: "POST",
      headers: new Headers({
        host: "viafidei.example.com",
        "x-forwarded-host": "viafidei.example.com",
        "x-forwarded-proto": "https",
        referer: `${APP_ORIGIN}/admin`,
        "content-type": "application/json",
      }),
      body: JSON.stringify({ on: true }),
    });
    const req = Object.assign(base, {
      nextUrl: new URL(url),
      cookies: { get: () => undefined },
    }) as unknown as NextRequest;
    const res = await switchPOST(req);
    expect(res.status).toBe(200);
    expect(setMasterSwitchMock).toHaveBeenCalledTimes(1);
  });
});

describe("static coverage — the three new routes are inside the gate", () => {
  const reports = scanAdminRouteGateCoverage();

  it.each(CASES)("$route reaches gateAdminApiCall in every exported handler", ({ route }) => {
    const report = reports.find((r) => r.route === route);
    expect(report, `${route} was not found by the scanner`).toBeTruthy();
    expect(report!.gated).toBe(true);
    expect(report!.ungatedHandlers).toEqual([]);
  });

  it("adds nothing to the set of admin routes bypassing the gate", () => {
    const bypassing = adminRoutesBypassingCentralGate(reports).map((r) => r.route);
    expect(bypassing.filter((r) => r.startsWith("src/app/api/admin/worker/"))).toEqual([]);
  });

  it("the switch route's only mutating handler is the gated POST", () => {
    const report = reports.find((r) => r.route === "src/app/api/admin/worker/switch/route.ts")!;
    expect(report.mutations).toEqual(["POST"]);
    expect(report.handlerGuards.POST).toBe("gate");
  });
});
