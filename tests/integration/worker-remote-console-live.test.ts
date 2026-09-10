/**
 * The phone-facing surface, end to end, against a REAL Postgres.
 *
 * tests/api/worker-remote-console.test.ts pins the same three routes with
 * every collaborator mocked. That proves the wiring but cannot prove the one
 * thing the operator actually hit: that a real, completed-2FA admin session
 * plus a real database produces a body the iPhone can decode — in BOTH worlds
 * the phone will meet, the Mac app running and the Mac app closed.
 *
 * So this file drives the real route handlers with:
 *   - the real `gateAdminApiCall` (CSRF, banned device, admin session);
 *   - a real `AdminSession` row promoted through the real two-stage flow
 *     (legitimate here and nowhere else: this is an isolated LOCAL test
 *     database, never production, and the promotion goes through the real
 *     `createPendingAdminSession` / `completeAdminTwoFactor` pair rather
 *     than a hand-forged row);
 *   - the real `readRemoteWorkerStatus` / `loadRemoteSnapshot` against rows
 *     this test writes and deletes.
 *
 * THE CASE THAT MATTERS MOST is "no host-presence row at all" — the operator
 * closed the Mac app. That must be a 200 with a body that says "the Mac is
 * not here", never a 500, never an empty body, and never something the phone
 * would render as a confident "worker off" when the honest answer is "the Mac
 * is not checked in". Both worlds are asserted below, and the exact JSON both
 * produce is asserted field by field against the Swift decoding types in
 * ios/ViaFideiCommandCentre/Core (see tests/api/worker-ios-contract.test.ts
 * for the static half of that comparison).
 */

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Pin the Postgres SESSION timezone to UTC for this file, before the Prisma
 * client is constructed (`vi.hoisted` runs ahead of the ESM imports below).
 *
 * `AdminSession` columns are `timestamp(3) without time zone` and
 * `src/lib/auth/admin-session.ts` reaches them through `$queryRaw`, so a
 * `Date` parameter is cast to the column type USING THE SESSION TIMEZONE.
 * On a Postgres whose timezone is not UTC — a stock Homebrew install
 * inherits the Mac's, e.g. America/Denver — every window the module writes
 * comes back shifted by the local offset and a freshly promoted session
 * reads as `expired_idle` on its very next request. Deployed Postgres runs
 * UTC (which is why the live admin console is unaffected), so this line
 * makes the local run match the deployment rather than papering over a
 * product defect.
 */
vi.hoisted(() => {
  const raw = process.env.TEST_DATABASE_URL;
  if (!raw) return;
  try {
    const url = new URL(raw);
    if (!url.searchParams.has("options")) url.searchParams.set("options", "-c timezone=UTC");
    process.env.DATABASE_URL = url.toString();
  } catch {
    // Leave the URL alone; tests/setup.integration.ts already validated it.
  }
});

// The admin session lives in an encrypted iron-session cookie resolved
// through `next/headers`. There is no request context in Vitest, so the
// cookie store is an in-memory jar — everything else (the sealing, the
// server-side row, the resolution) is the real implementation.
const { cookieJar } = vi.hoisted(() => ({ cookieJar: new Map<string, string>() }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get(name: string) {
      const value = cookieJar.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set(name: string, value: string) {
      cookieJar.set(name, value);
    },
    delete(name: string) {
      cookieJar.delete(name);
    },
  }),
}));

import type { NextRequest } from "next/server";

import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { createPendingAdminSession, completeAdminTwoFactor } from "@/lib/auth/admin-session";
import { requireAdmin } from "@/lib/auth";
import {
  HOST_PRESENCE_KEY,
  writeHostPresence,
  type HostPresenceInput,
} from "@/lib/admin-worker/host-presence";
import { _resetRemoteConsoleCachesForTests } from "@/lib/admin-worker/remote-console";
import { GET as statusGET } from "@/app/api/admin/worker/status/route";
import { GET as snapshotGET } from "@/app/api/admin/worker/snapshot/route";
import { POST as switchPOST } from "@/app/api/admin/worker/switch/route";

const ORIGIN = "http://localhost:3000";

/**
 * A NextRequest good enough for the three handlers: they read `nextUrl`,
 * `cookies`, `headers`, and (on the switch) the body.
 */
function buildReq(args: { path: string; method?: string; body?: unknown }): NextRequest {
  const url = `${ORIGIN}${args.path}`;
  const headers = new Headers({
    host: "localhost:3000",
    "x-forwarded-host": "localhost:3000",
    "x-forwarded-proto": "http",
    "x-request-id": "req-live-1",
  });
  if (args.method && args.method !== "GET") headers.set("origin", ORIGIN);
  if (args.body !== undefined) headers.set("content-type", "application/json");
  const base = new Request(url, {
    method: args.method ?? "GET",
    headers,
    ...(args.body === undefined ? {} : { body: JSON.stringify(args.body) }),
  });
  return Object.assign(base, {
    nextUrl: new URL(url),
    cookies: {
      get() {
        return undefined;
      },
    },
  }) as unknown as NextRequest;
}

const PRESENCE: HostPresenceInput = {
  runtimeId: "rt-live-test",
  hostLabel: "MacBook Pro · darwin arm64",
  pid: 4242,
  origin: "LOCAL_MACBOOK",
  runState: "running",
  workerRunning: true,
  workerStartedAt: new Date().toISOString(),
  switchOn: true,
  failureReason: null,
  leaseHeldElsewhere: false,
  intervalMs: 7_000,
};

async function deletePresenceRow(): Promise<void> {
  await prisma.adminWorkerMemory
    .deleteMany({ where: { memoryType: "GENERIC", memoryKey: HOST_PRESENCE_KEY } })
    .catch(() => undefined);
}

async function signIn(): Promise<void> {
  cookieJar.clear();
  const pending = await createPendingAdminSession({ username: process.env.ADMIN_USERNAME! });
  expect(pending).not.toBeNull();
  const session = await getSession();
  session.role = "ADMIN";
  session.adminAuthStage = "PENDING";
  session.adminSessionId = pending!.sessionId;
  await session.save();
  const promoted = await completeAdminTwoFactor();
  expect(promoted.ok).toBe(true);
}

type JsonBody = Record<string, unknown>;

/**
 * The key sets the Swift decoders in ios/ViaFideiCommandCentre/Core read.
 * Asserted against the LIVE payload, because every property over there is
 * Optional: a renamed or dropped key does not fail the decode, it silently
 * blanks the row it feeds. `error` is excluded — the server only emits it
 * when the corresponding read failed.
 */
const STATUS_KEYS = [
  "actuation",
  "at",
  "cacheAgeMs",
  "degraded",
  "execution",
  "host",
  "nextPollAfterMs",
  "switch",
  "worker",
];
const SWITCH_KEYS = ["changedAt", "changedBy", "changedFrom", "known", "on"];
const EXECUTION_KEYS = [
  "executingLocally",
  "known",
  "label",
  "lease",
  "leaseAgeMs",
  "leaseLive",
  "state",
];
const HOST_KEYS = [
  "ageMs",
  "alive",
  "failureReason",
  "hostLabel",
  "known",
  "label",
  "leaseHeldElsewhere",
  "runState",
  "runtimeId",
  "switchOn",
  "workerRunning",
  "workerStartedAt",
];
const WORKER_KEYS = [
  "blocker",
  "goal",
  "heartbeatAgeMs",
  "heartbeatAt",
  "known",
  "lastFailedAt",
  "lastSuccessfulAt",
  "live",
  "mode",
  "paused",
  "pausedReason",
  "priority",
  "task",
  "workerVersion",
];
const ACTUATION_KEYS = [
  "expectedLatencyMs",
  "hostPollIntervalMs",
  "hostSwitchCacheMs",
  "pendingWindowMs",
];

function keys(value: unknown): string[] {
  return Object.keys(value as JsonBody).sort();
}

/** Every key the phone reads out of a `status` object, in both worlds. */
function expectDecodableStatus(status: JsonBody): void {
  expect(keys(status)).toEqual(STATUS_KEYS);
  expect(keys(status.switch)).toEqual(SWITCH_KEYS);
  expect(keys(status.execution)).toEqual(EXECUTION_KEYS);
  expect(keys(status.host)).toEqual(HOST_KEYS);
  expect(keys(status.worker)).toEqual(WORKER_KEYS);
  expect(keys(status.actuation)).toEqual(ACTUATION_KEYS);
}

async function json(res: Response): Promise<JsonBody> {
  const text = await res.text();
  expect(text.length).toBeGreaterThan(0);
  return JSON.parse(text) as JsonBody;
}

beforeAll(async () => {
  await signIn();
});

afterAll(async () => {
  // Every row this file created, in the LOCAL test database only.
  await deletePresenceRow();
  await prisma.adminWorkerMemory
    .deleteMany({ where: { memoryType: "GENERIC", memoryKey: "worker.execution.switch" } })
    .catch(() => undefined);
  await prisma
    .$executeRawUnsafe(`DELETE FROM "AdminSession" WHERE "adminUsername" = $1`, [
      process.env.ADMIN_USERNAME ?? "admin",
    ])
    .catch(() => undefined);
  _resetRemoteConsoleCachesForTests();
});

afterEach(() => {
  _resetRemoteConsoleCachesForTests();
});

describe("phone surface — a completed-2FA session against a real database", () => {
  it("resolves the seeded session as a real administrator", async () => {
    const admin = await requireAdmin();
    expect(admin?.username).toBe(process.env.ADMIN_USERNAME);
    expect(admin?.twoFactorVerifiedAt).toBeTypeOf("number");
  });

  it("GET /status answers 200 with a full body when the Mac is checked in", async () => {
    await writeHostPresence(prisma, PRESENCE);
    _resetRemoteConsoleCachesForTests();

    const res = await statusGET(buildReq({ path: "/api/admin/worker/status" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store, must-revalidate");

    const body = await json(res);
    expect(body.ok).toBe(true);
    const status = body.status as JsonBody;
    expect(status).toBeTruthy();

    // The four durable reads the phone renders.
    expect(typeof status.at).toBe("string");
    expect(status.switch).toBeTruthy();
    expect(status.execution).toBeTruthy();
    expect(status.host).toBeTruthy();
    expect(status.worker).toBeTruthy();
    expect(status.actuation).toBeTruthy();

    const host = status.host as JsonBody;
    expect(host.known).toBe(true);
    expect(host.alive).toBe(true);
    expect(host.runtimeId).toBe(PRESENCE.runtimeId);
    expect(host.workerRunning).toBe(true);
    expect(String(host.label)).toContain("alive");
    expect(typeof host.ageMs).toBe("number");

    expectDecodableStatus(status);
  });

  it("GET /status answers 200 with an ABSENT Mac — not a 500, not an empty body, not 'off'", async () => {
    await deletePresenceRow();
    _resetRemoteConsoleCachesForTests();

    const res = await statusGET(buildReq({ path: "/api/admin/worker/status" }));
    expect(res.status).toBe(200);

    const body = await json(res);
    expect(body.ok).toBe(true);
    const status = body.status as JsonBody;
    const host = status.host as JsonBody;

    // `known: true` says the DATABASE answered; `alive: false` with a null
    // runtimeId is the phone's `.absent` case (HostView.presence in
    // ios/.../Core/WorkerModels.swift). If `known` were false the phone
    // would render "unknown", which would also be honest — what must never
    // happen is a 500 or a body without a `host` object at all.
    expect(host.known).toBe(true);
    expect(host.alive).toBe(false);
    expect(host.runtimeId).toBeNull();
    expect(host.ageMs).toBeNull();
    expect(String(host.label)).toContain("not running");

    // The Mac being absent says NOTHING about the durable switch: the switch
    // row is still readable, so `switch.known` stays true and the phone shows
    // the real value rather than collapsing to OFF.
    const master = status.switch as JsonBody;
    expect(master.known).toBe(true);
    expect(typeof master.on).toBe("boolean");

    // And the payload is still complete — every section the phone renders.
    expect(status.execution).toBeTruthy();
    expect(status.worker).toBeTruthy();
    expect(status.actuation).toBeTruthy();
    expect(typeof status.degraded).toBe("boolean");
    expectDecodableStatus(status);
  });

  it("refuses GET /status and GET /snapshot without a session — reads are gated too", async () => {
    const saved = new Map(cookieJar);
    cookieJar.clear();
    try {
      for (const handler of [statusGET, snapshotGET]) {
        const res = await handler(buildReq({ path: "/api/admin/worker/status" }));
        expect(res.status).toBe(401);
        const body = await json(res);
        expect(body.ok).toBe(false);
        expect(body.error).toBe("unauthorized");
      }
    } finally {
      cookieJar.clear();
      for (const [k, v] of saved) cookieJar.set(k, v);
    }
  });

  it("GET /snapshot answers 200 with status + snapshot + cache in both worlds", async () => {
    for (const world of ["present", "absent"] as const) {
      if (world === "present") await writeHostPresence(prisma, PRESENCE);
      else await deletePresenceRow();
      _resetRemoteConsoleCachesForTests();

      const res = await snapshotGET(buildReq({ path: "/api/admin/worker/snapshot" }));
      expect(res.status, `snapshot in world=${world}`).toBe(200);
      const body = await json(res);
      expect(body.ok).toBe(true);
      expect(body.status).toBeTruthy();
      expect(body.snapshot).toBeTruthy();
      expect(body.cache).toBeTruthy();

      const snapshot = body.snapshot as JsonBody;
      expect(typeof snapshot.generatedAt).toBe("string");
      expect(snapshot.trimmed).toBeTruthy();
      expect(snapshot.diagnostics).toBeTruthy();
      expect(snapshot.goals).toBeTruthy();
      expect(typeof snapshot.contentCatalogTotal).toBe("number");

      const host = (body.status as JsonBody).host as JsonBody;
      expect(host.known).toBe(true);
      expect(host.alive).toBe(world === "present");
      expectDecodableStatus(body.status as JsonBody);

      // The snapshot's own top-level keys, as the phone's `MobileSnapshot`
      // declares them. `trimmed`, `execution` and `rules` are sent but not
      // modelled on the phone; extra keys are inert for a Swift decoder.
      expect(keys(snapshot)).toEqual([
        "artifactStatus",
        "brain",
        "contentCatalogTotal",
        "coverage",
        "decisions",
        "diagnostics",
        "execution",
        "funnel",
        "generatedAt",
        "goals",
        "growth",
        "heartbeatAgeMs",
        "homepageDrafts",
        "knowledge",
        "logs",
        "memory",
        "metrics",
        "mission",
        "passes",
        "pipeline",
        "publishing",
        "qualityScores",
        "readingsCoverage",
        "repairPlans",
        "reviewQueue",
        "rollbacks",
        "rules",
        "security",
        "skills",
        "sourceActivity",
        "sourceReputation",
        "state",
        "strictQA",
        "trimmed",
        "workerLive",
      ]);
      expect(keys(body.cache)).toEqual([
        "ageMs",
        "cached",
        "coalesced",
        "forced",
        "nextPollAfterMs",
        "ttlMs",
      ]);
    }
  }, 60_000);
});

describe("phone surface — the switch mutation", () => {
  it("is refused 401 without a completed-2FA session", async () => {
    const saved = new Map(cookieJar);
    cookieJar.clear();
    try {
      const res = await switchPOST(
        buildReq({
          path: "/api/admin/worker/switch",
          method: "POST",
          body: { on: true, client: "iphone-app" },
        }),
      );
      expect(res.status).toBe(401);
      const body = await json(res);
      expect(body.ok).toBe(false);
      expect(body.error).toBe("unauthorized");
    } finally {
      cookieJar.clear();
      for (const [k, v] of saved) cookieJar.set(k, v);
    }
  });

  it("is refused 401 with a PENDING (password-only) session", async () => {
    const saved = new Map(cookieJar);
    cookieJar.clear();
    try {
      const pending = await createPendingAdminSession({ username: process.env.ADMIN_USERNAME! });
      const session = await getSession();
      session.role = "ADMIN";
      session.adminAuthStage = "PENDING";
      session.adminSessionId = pending!.sessionId;
      await session.save();

      const res = await switchPOST(
        buildReq({
          path: "/api/admin/worker/switch",
          method: "POST",
          body: { on: true, client: "iphone-app" },
        }),
      );
      expect(res.status).toBe(401);
    } finally {
      cookieJar.clear();
      for (const [k, v] of saved) cookieJar.set(k, v);
    }
  });

  it("is accepted with a completed-2FA session and echoes the CONFIRMED durable row", async () => {
    await writeHostPresence(prisma, PRESENCE);
    _resetRemoteConsoleCachesForTests();

    const res = await switchPOST(
      buildReq({
        path: "/api/admin/worker/switch",
        method: "POST",
        body: { on: true, client: "iphone-app", reason: "integration proof" },
      }),
    );
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.ok).toBe(true);

    const next = body.switch as JsonBody;
    expect(next.on).toBe(true);
    expect(next.known).toBe(true);
    expect(next.changedFrom).toBe("iphone-app");
    expect(typeof next.changedAt).toBe("string");
    expect(next.changedBy).toBe(process.env.ADMIN_USERNAME);

    // The status echoed back must already reflect the write, not the 2 s cache.
    const status = body.status as JsonBody;
    expect((status.switch as JsonBody).on).toBe(true);
    expectDecodableStatus(status);
    expect(keys(next)).toEqual(SWITCH_KEYS);
    expect(keys(body).sort()).toEqual(["actuation", "ok", "previousOn", "status", "switch"]);

    const actuation = body.actuation as JsonBody;
    expect(actuation.pending).toBe(true);
    expect(typeof actuation.windowMs).toBe("number");
  });

  it("refuses a non-boolean `on` rather than starting a workload", async () => {
    const res = await switchPOST(
      buildReq({
        path: "/api/admin/worker/switch",
        method: "POST",
        body: { on: "true", client: "iphone-app" },
      }),
    );
    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.message).toBe("on_must_be_boolean");
  });
});
