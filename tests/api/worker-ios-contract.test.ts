/**
 * The wire contract between the three phone routes and the iPhone's decoders.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Every property in `ios/ViaFideiCommandCentre/Core/WorkerModels.swift` and
 * `.../SnapshotModels.swift` is Optional, so a field the server RENAMES or
 * DROPS does not fail the decode — it silently becomes `nil` and the row it
 * feeds just stops being drawn. A field whose TYPE changes is worse: Swift's
 * `JSONDecoder` throws `typeMismatch` on a present-but-wrong-typed value even
 * when the property is Optional, `APIClient.send` turns that into
 * `APIError.malformed("could not read the payload")`, and `WorkerView` renders
 * it as "Could not reach the command centre" above a screen with no detail in
 * it — a connection error for what is really a schema drift.
 *
 * So this test parses the Swift decoding types out of `ios/` and validates a
 * FULLY POPULATED payload from the real server-side builders against them:
 *
 *   - every property the phone declares must be present in the JSON (a
 *     missing one is a section that quietly stops rendering);
 *   - every value must be a type Swift can decode into the declared property
 *     (a mismatch is the "could not connect" symptom);
 *   - every key the server sends that the phone does NOT model is listed
 *     explicitly, so adding one is a deliberate act rather than a surprise.
 *
 * The payloads are built by the real `trimSnapshotForMobile` and the real
 * `readRemoteWorkerStatus`, then round-tripped through `JSON.stringify` so
 * what is checked is the wire form — Dates already serialised, Decimals
 * already coerced — and not the in-process objects.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const readExecutionStatusMock = vi.fn();
const readHostPresenceMock = vi.fn();
const { adminWorkerStateFindFirstMock } = vi.hoisted(() => ({
  adminWorkerStateFindFirstMock: vi.fn(),
}));

vi.mock("@/lib/admin-worker/execution-host", () => ({
  readExecutionStatus: (...args: unknown[]) => readExecutionStatusMock(...args),
}));
vi.mock("@/lib/admin-worker/host-presence", () => ({
  readHostPresence: (...args: unknown[]) => readHostPresenceMock(...args),
  describeHostPresence: () => "Mac runtime alive on MacBook Pro · darwin arm64, worker running.",
}));
vi.mock("@/lib/admin-worker/command-center", () => ({
  loadCommandCenterSnapshot: vi.fn(),
}));

import type { PrismaClient } from "@prisma/client";

import type { CommandCenterSnapshot } from "@/lib/admin-worker/command-center";
import {
  _resetRemoteConsoleCachesForTests,
  readRemoteWorkerStatus,
  trimSnapshotForMobile,
} from "@/lib/admin-worker/remote-console";

/* ------------------------------------------------------------------ */
/* the Swift side: parse the decoders out of ios/                      */
/* ------------------------------------------------------------------ */

const CORE = path.resolve(__dirname, "../../ios/ViaFideiCommandCentre/Core");

type SwiftProperty = { name: string; key: string; type: string; optional: boolean };
type SwiftStruct = { name: string; properties: SwiftProperty[] };

/**
 * Parse `struct X: Decodable { var a: T?; ... }` declarations.
 *
 * Only STORED properties count: a computed one (`var id: String { ... }`) is
 * never decoded, and `Identifiable` conformance adds several of those. The
 * `CodingKeys` enum is honoured because `switch` is a Swift keyword and the
 * two response types have to rename it.
 */
function parseSwiftStructs(source: string): SwiftStruct[] {
  const out: SwiftStruct[] = [];
  const structRe = /\bstruct\s+(\w+)(?:<[^>]*>)?\s*:\s*[^{]*\{/g;
  let match: RegExpExecArray | null;
  while ((match = structRe.exec(source)) !== null) {
    const name = match[1]!;
    // Walk braces from the opening one to find the struct body.
    let depth = 1;
    let i = structRe.lastIndex;
    while (i < source.length && depth > 0) {
      if (source[i] === "{") depth += 1;
      else if (source[i] === "}") depth -= 1;
      i += 1;
    }
    const body = source.slice(structRe.lastIndex, i - 1);

    const codingKeys = parseCodingKeys(body);
    const properties: SwiftProperty[] = [];
    // A stored property: `var name: Type` or `var name: Type?`, with nothing
    // but whitespace / a default value after it. A `{` means computed.
    const propRe = /^[ \t]*var\s+(\w+)\s*:\s*([^\n{=]+?)\s*(?:=\s*[^\n]+)?$/gm;
    let prop: RegExpExecArray | null;
    while ((prop = propRe.exec(body)) !== null) {
      const propName = prop[1]!;
      const raw = prop[2]!.trim();
      const optional = raw.endsWith("?");
      properties.push({
        name: propName,
        key: codingKeys.get(propName) ?? propName,
        type: optional ? raw.slice(0, -1).trim() : raw,
        optional,
      });
    }
    out.push({ name, properties });
  }
  return out;
}

function parseCodingKeys(body: string): Map<string, string> {
  const map = new Map<string, string>();
  const enumMatch = /enum\s+CodingKeys\s*:[^{]*\{([\s\S]*?)\}/.exec(body);
  if (!enumMatch) return map;
  for (const line of enumMatch[1]!.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("case ")) continue;
    for (const entry of trimmed.slice(5).split(",")) {
      const [left, right] = entry.split("=").map((part) => part.trim());
      if (!left) continue;
      map.set(left, right ? right.replace(/^"|"$/g, "") : left);
    }
  }
  return map;
}

const SWIFT: Map<string, SwiftStruct> = (() => {
  const registry = new Map<string, SwiftStruct>();
  for (const file of ["WorkerModels.swift", "SnapshotModels.swift"]) {
    for (const struct of parseSwiftStructs(readFileSync(path.join(CORE, file), "utf8"))) {
      registry.set(struct.name, struct);
    }
  }
  return registry;
})();

/* ------------------------------------------------------------------ */
/* validate a JSON value against a Swift type                          */
/* ------------------------------------------------------------------ */

type Report = { mismatches: string[]; missing: string[]; extra: string[] };

function describeJson(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "number") return Number.isInteger(value) ? "int" : "double";
  return typeof value;
}

function checkValue(value: unknown, type: string, at: string, report: Report): void {
  if (value === null) return; // every property the phone declares is Optional
  const generic = /^TrimmedList<(\w+)>$/.exec(type);
  if (generic) {
    if (typeof value !== "object" || Array.isArray(value)) {
      report.mismatches.push(`${at}: expected a TrimmedList object, got ${describeJson(value)}`);
      return;
    }
    const list = value as Record<string, unknown>;
    if (!Array.isArray(list.items)) {
      report.mismatches.push(`${at}.items: expected an array, got ${describeJson(list.items)}`);
    } else {
      list.items.forEach((row, index) =>
        checkValue(row, generic[1]!, `${at}.items[${index}]`, report),
      );
    }
    checkValue(list.total, "Int", `${at}.total`, report);
    return;
  }
  const dictionary = /^\[String\s*:\s*(\w+)\]$/.exec(type);
  if (dictionary) {
    if (typeof value !== "object" || Array.isArray(value)) {
      report.mismatches.push(`${at}: expected an object, got ${describeJson(value)}`);
      return;
    }
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      checkValue(entry, dictionary[1]!, `${at}.${key}`, report);
    }
    return;
  }
  switch (type) {
    case "String":
      if (typeof value !== "string") {
        report.mismatches.push(`${at}: Swift String, JSON ${describeJson(value)}`);
      }
      return;
    case "Bool":
      if (typeof value !== "boolean") {
        report.mismatches.push(`${at}: Swift Bool, JSON ${describeJson(value)}`);
      }
      return;
    case "Int":
      // Swift refuses a fractional value for an Int property outright, and
      // that refusal fails the WHOLE payload, not just this row.
      if (typeof value !== "number" || !Number.isInteger(value)) {
        report.mismatches.push(`${at}: Swift Int, JSON ${describeJson(value)} (${String(value)})`);
      }
      return;
    case "Double":
      if (typeof value !== "number" || !Number.isFinite(value)) {
        report.mismatches.push(`${at}: Swift Double, JSON ${describeJson(value)}`);
      }
      return;
    case "JSONScalar":
      if (!["number", "string", "boolean"].includes(typeof value)) {
        report.mismatches.push(`${at}: JSONScalar cannot carry ${describeJson(value)}`);
      }
      return;
    default:
      break;
  }
  const struct = SWIFT.get(type);
  if (!struct) {
    throw new Error(`Unhandled Swift type "${type}" at ${at} — teach this test about it.`);
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    report.mismatches.push(`${at}: expected ${type} object, got ${describeJson(value)}`);
    return;
  }
  const object = value as Record<string, unknown>;
  const modelled = new Set<string>();
  for (const property of struct.properties) {
    modelled.add(property.key);
    if (!(property.key in object)) {
      report.missing.push(`${at}.${property.key}`);
      continue;
    }
    checkValue(object[property.key], property.type, `${at}.${property.key}`, report);
  }
  for (const key of Object.keys(object)) {
    if (!modelled.has(key)) report.extra.push(`${at}.${key}`);
  }
}

function validate(root: unknown, type: string): Report {
  const report: Report = { mismatches: [], missing: [], extra: [] };
  checkValue(root, type, "$", report);
  return report;
}

/** The wire form: what `URLSession` actually hands the Swift decoder. */
function wire(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value)) as unknown;
}

/* ------------------------------------------------------------------ */
/* fully populated server payloads                                     */
/* ------------------------------------------------------------------ */

const LIVE_EXECUTION = {
  state: "LOCAL_ACTIVE" as const,
  switch: {
    on: true,
    changedAt: "2026-09-10T11:00:00.000Z",
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
    acquiredAt: "2026-09-10T10:00:00.000Z",
    renewedAt: "2026-09-10T11:59:50.000Z",
    workerVersion: "1.0.0",
  },
  leaseAgeMs: 5_000,
  leaseLive: true,
  executingLocally: true,
  label: "Admin Worker active locally on MacBook Pro · darwin arm64.",
  known: true,
};

const LIVE_PRESENCE = {
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
    workerStartedAt: "2026-09-10T11:30:00.000Z",
    switchOn: true,
    failureReason: null,
    leaseHeldElsewhere: false,
  },
  ageMs: 1_200,
  alive: true,
  known: true,
};

const WORKER_ROW = {
  currentMode: "AUTONOMOUS",
  currentPriority: "CONTENT_GROWTH",
  currentGoal: "Grow SAINT coverage",
  currentTask: "SOURCE_FETCH",
  currentBlocker: null,
  lastHeartbeatAt: new Date(),
  lastSuccessfulAt: new Date(),
  lastFailedAt: new Date(),
  workerVersion: "admin-worker/0.1",
  paused: false,
  pausedReason: null,
};

function stubPrisma(): PrismaClient {
  return {
    adminWorkerState: { findFirst: adminWorkerStateFindFirstMock },
  } as unknown as PrismaClient;
}

/**
 * A command-centre snapshot with EVERY list non-empty and every optional
 * populated. An empty list proves nothing about the row type inside it, which
 * is exactly where a drift would hide.
 */
function fullSnapshot(): CommandCenterSnapshot {
  const now = new Date();
  return {
    generatedAt: now.toISOString(),
    execution: LIVE_EXECUTION,
    state: {
      currentMode: "AUTONOMOUS",
      currentPriority: "CONTENT_GROWTH",
      currentGoal: "Grow SAINT coverage",
      currentTask: "SOURCE_FETCH",
      currentBlocker: "waiting on a source",
      lastHeartbeatAt: now,
      lastSuccessfulAt: now,
      paused: false,
    },
    heartbeatAgeMs: 4_000,
    workerLive: true,
    diagnostics: {
      ratings: [{ label: "Admin Worker overall", status: "pass", summary: "Mode: AUTONOMOUS." }],
      summary: { pass: 22, warn: 3, fail: 1 },
    },
    metrics: {
      publishRate30d: 0.9412,
      qaPassRate30d: 1,
      deletionRate30d: 0,
      reviewQueueCount: 4,
      recentSecurityActions24h: 10,
      monthlyReportLastAt: now,
      monthlyReportFresh: true,
      publishedContentLive: 23_915,
      queueInFlight: 12,
    },
    mission: { stage: "SOURCE_FETCH", contentType: "SAINT", reason: "Candidates available." },
    goals: [
      { contentType: "SAINT", currentValidCount: 1_204, gapCount: 796, status: "IN_PROGRESS" },
    ],
    funnel: [
      {
        contentType: "SAINT",
        candidatesDiscovered: 900,
        sourceReadsCreated: 640,
        packageArtifactsCreated: 480,
        strictQAPasses: 470,
        publishedItems: 455,
      },
    ],
    coverage: [
      {
        contentType: "SAINT",
        coverageScore: 0.6125,
        activeSourceCount: 9,
        recentPublishes7d: 61,
        blockedByCoverage: false,
        blockReason: null,
      },
    ],
    growth: [
      {
        contentType: "SAINT",
        publishedCount: 1_204,
        gap: 796,
        growth24h: 41,
        growth7d: 287,
        status: "GROWING",
      },
    ],
    pipeline: [
      { stage: "SOURCE_FETCH", pending: 12, running: 1, succeeded: 940, failed: 6, blocked: 0 },
    ],
    artifactStatus: { BUILT: 480, PUBLISHED: 455 },
    passes: [
      {
        passType: "CONTENT_GROWTH",
        status: "COMPLETED",
        contentBuilt: 12,
        contentPublished: 11,
        startedAt: now,
      },
    ],
    decisions: [
      {
        chosenAction: "SOURCE_FETCH",
        reason: "Highest expected value.",
        confidence: 0.82,
        createdAt: now,
      },
    ],
    brain: {
      latestFinalBrain: "unified",
      degradedEvents24h: 0,
      selectActionCalls24h: 412,
      latestDecision: { id: "log-1" },
      rankedAlternatives: [{ action: "DISCOVERY", score: 0.51, reason: "Fewer candidates." }],
      reasoning: [
        {
          fromNodeLabel: "SAINT",
          relation: "needs",
          toNodeLabel: "sources",
          explanation: "Coverage below target.",
          confidence: 0.77,
        },
      ],
    },
    sourceReputation: [
      {
        sourceHost: "catholic.org",
        reputationTier: "TRUSTED",
        qaPassRate: 0.98,
        publicPublishRate: 0.91,
      },
    ],
    sourceActivity: [
      {
        sourceUrl: "https://catholic.org/saints/saint.php?saint_id=1",
        detectedContentType: "SAINT",
        confidenceScore: 0.88,
        createdAt: now,
      },
    ],
    memory: [
      { memoryKey: "worker.execution.host", memoryType: "GENERIC", confidence: 1, lastUsedAt: now },
    ],
    knowledge: {
      nodes: 120,
      edges: 310,
      recentNodes: [{ label: "St Agnes", nodeType: "ENTITY", entityType: "SAINT", updatedAt: now }],
    },
    logs: [
      {
        eventName: "pass_completed",
        category: "CONTENT",
        message: "Published 11.",
        createdAt: now,
      },
    ],
    rules: [
      {
        id: "publish.require_source_evidence",
        category: "publish",
        version: 1,
        description: "Every published item cites a source.",
      },
    ],
    skills: [
      {
        skillName: "structured-feed",
        executionStatus: "SUCCEEDED",
        verificationStatus: "VERIFIED",
        riskLevel: "LOW",
        createdAt: now,
      },
    ],
    repairPlans: [
      { kind: "SOURCE_FETCH", status: "OPEN", attempts: 1, maxAttempts: 3, updatedAt: now },
    ],
    reviewQueue: [
      {
        id: "rq-1",
        contentTitle: "St Agnes",
        proposedAction: "PUBLISH",
        reason: "Passed strict QA.",
        confidence: 0.93,
      },
    ],
    qualityScores: [
      { contentType: "SAINT", finalScore: 0.9563329087512868, threshold: 0.8, passed: true },
    ],
    strictQA: [{ contentType: "SAINT", finalScore: 0.94, status: "PASSED", createdAt: now }],
    rollbacks: [
      { slug: "st-agnes", rollbackAction: "UNPUBLISH", rollbackResult: "DONE", createdAt: now },
    ],
    security: [{ actionType: "ESCALATE", severity: "warning", createdAt: now }],
    homepageDrafts: [
      { id: "hd-1", status: "PENDING", reasonSummary: "Seasonal refresh.", createdAt: now },
    ],
    publishing: [{ title: "St Agnes", contentType: "SAINT", slug: "st-agnes", updatedAt: now }],
    readingsCoverage: {
      total: 400,
      published: 395,
      review: 5,
      earliest: now,
      latest: now,
      spanDays: 400,
      todayHasRow: true,
      todayHasText: true,
      next30WithText: 30,
      next90WithText: 90,
      lastUpdatedAt: now,
    },
    contentCatalogTotal: 23_915,
  } as unknown as CommandCenterSnapshot;
}

/* ------------------------------------------------------------------ */

/**
 * Keys the server sends that the phone deliberately does not model. Every one
 * of these is inert for the decoder (extra keys are ignored) — the list exists
 * so ADDING a server field is a decision someone makes on purpose.
 */
const UNMODELLED_SNAPSHOT_KEYS = ["$.snapshot.trimmed", "$.snapshot.execution", "$.snapshot.rules"];

/**
 * Properties the phone models that are legitimately absent from a HEALTHY
 * payload. All three are the `error?: string` the server only emits when the
 * corresponding read failed; a `nil` there is the phone's "no error".
 */
const OPTIONAL_ERROR_KEYS = [
  "$.status.switch.error",
  "$.status.execution.error",
  "$.status.host.error",
];

beforeEach(() => {
  vi.clearAllMocks();
  _resetRemoteConsoleCachesForTests();
  readExecutionStatusMock.mockResolvedValue(LIVE_EXECUTION);
  readHostPresenceMock.mockResolvedValue(LIVE_PRESENCE);
  adminWorkerStateFindFirstMock.mockResolvedValue(WORKER_ROW);
});

describe("iPhone wire contract — GET /api/admin/worker/status", () => {
  it("parsed the Swift decoders it is meant to be checking", () => {
    // A silently empty registry would make every assertion below vacuous.
    expect(SWIFT.get("WorkerStatus")?.properties.length).toBeGreaterThan(5);
    expect(SWIFT.get("MobileSnapshot")?.properties.length).toBeGreaterThan(20);
    expect(SWIFT.get("WorkerStatus")?.properties.find((p) => p.name === "switchState")?.key).toBe(
      "switch",
    );
    // Computed properties must NOT be treated as decoded keys.
    expect(SWIFT.get("MasterSwitchView")?.properties.map((p) => p.name)).not.toContain("headline");
    expect(SWIFT.get("GoalRow")?.properties.map((p) => p.name)).not.toContain("target");

    // And nothing was skipped: if the regex ever stops matching a struct,
    // every assertion about that struct quietly disappears.
    const declared = ["WorkerModels.swift", "SnapshotModels.swift"]
      .map((file) => readFileSync(path.join(CORE, file), "utf8"))
      .flatMap((source) => source.match(/\bstruct\s+\w+/g) ?? []).length;
    expect(SWIFT.size).toBe(declared);
  });

  it("emits the exact failure `message` strings the phone has human copy for", () => {
    // APIClient.friendly() turns these three server strings into sentences.
    // Rename one on the server and the phone falls back to a humanised slug.
    const client = readFileSync(path.join(CORE, "APIClient.swift"), "utf8");
    const routes = path.resolve(__dirname, "../../src/app/api/admin/worker");
    const emitted = ["status/route.ts", "snapshot/route.ts", "switch/route.ts"]
      .map((file) => readFileSync(path.join(routes, file), "utf8"))
      .join("\n");
    for (const message of [
      "worker_status_unavailable",
      "worker_snapshot_unavailable",
      "switch_write_failed",
    ]) {
      expect(emitted, `route must still emit ${message}`).toContain(`"${message}"`);
      expect(client, `phone must still translate ${message}`).toContain(`"${message}"`);
    }
  });

  it("keeps the error envelope decodable as APIErrorBody", () => {
    // What `jsonError` actually puts on the wire for the 401 / 503 / 429 the
    // phone has to read before it can say anything useful about a refusal.
    const report = validate(
      wire({
        ok: false,
        error: "server_error",
        message: "worker_status_unavailable",
        requestId: "req-1",
      }),
      "APIErrorBody",
    );
    expect(report.mismatches).toEqual([]);
    expect(report.missing).toEqual([]);
    // `requestId` is sent but not modelled — inert for a Swift decoder.
    expect(report.extra).toEqual(["$.requestId"]);
  });

  it("every property StatusResponse declares is present, and every type decodes", async () => {
    const status = await readRemoteWorkerStatus(stubPrisma(), { force: true });
    const report = validate(wire({ ok: true, status }), "StatusResponse");

    expect(report.mismatches).toEqual([]);
    expect(report.missing).toEqual(OPTIONAL_ERROR_KEYS);
    expect(report.extra).toEqual([]);
  });

  it("keeps the ABSENT-Mac payload decodable — the case the operator actually hit", async () => {
    readHostPresenceMock.mockResolvedValue({
      presence: null,
      ageMs: null,
      alive: false,
      known: true,
    });
    _resetRemoteConsoleCachesForTests();

    const status = await readRemoteWorkerStatus(stubPrisma(), { force: true });
    const body = wire({ ok: true, status }) as {
      status: { host: Record<string, unknown>; switch: Record<string, unknown> };
    };
    const report = validate(body, "StatusResponse");
    expect(report.mismatches).toEqual([]);
    expect(report.missing).toEqual(OPTIONAL_ERROR_KEYS);

    // `known: true` + `alive: false` + a null runtimeId is HostView.Presence
    // `.absent` on the phone — "Not running", not "Unknown", not "off".
    expect(body.status.host.known).toBe(true);
    expect(body.status.host.alive).toBe(false);
    expect(body.status.host.runtimeId).toBeNull();
    // And it does not contaminate the switch: the row was still readable.
    expect(body.status.switch.known).toBe(true);
  });

  it("keeps an UNREADABLE database decodable, and reports it as unknown", async () => {
    readHostPresenceMock.mockResolvedValue({
      presence: null,
      ageMs: null,
      alive: false,
      known: false,
      error: "connection refused",
    });
    readExecutionStatusMock.mockResolvedValue({
      ...LIVE_EXECUTION,
      known: false,
      error: "connection refused",
      switch: { ...LIVE_EXECUTION.switch, known: false, error: "connection refused" },
    });
    _resetRemoteConsoleCachesForTests();

    const status = await readRemoteWorkerStatus(stubPrisma(), { force: true });
    const body = wire({ ok: true, status }) as { status: Record<string, unknown> };
    const report = validate(body, "StatusResponse");
    expect(report.mismatches).toEqual([]);
    // Now the three `error` strings ARE present, so nothing is missing at all.
    expect(report.missing).toEqual([]);
    expect(body.status.degraded).toBe(true);
  });
});

describe("iPhone wire contract — GET /api/admin/worker/snapshot", () => {
  it("every property SnapshotResponse declares is present, and every type decodes", async () => {
    const status = await readRemoteWorkerStatus(stubPrisma(), { force: true });
    const snapshot = trimSnapshotForMobile(fullSnapshot());
    const body = wire({
      ok: true,
      status,
      snapshot,
      cache: {
        cached: false,
        ageMs: 0,
        ttlMs: 30_000,
        coalesced: false,
        nextPollAfterMs: 30_000,
        forced: false,
      },
    });

    const report = validate(body, "SnapshotResponse");
    expect(report.mismatches).toEqual([]);
    expect(report.missing).toEqual(OPTIONAL_ERROR_KEYS);
    expect(report.extra).toEqual(UNMODELLED_SNAPSHOT_KEYS);
  });

  it("carries a non-empty row through every trimmed list the phone renders", () => {
    // The type check above is only meaningful for lists that actually have a
    // row in them, so pin that the fixture keeps populating all of them.
    const snapshot = wire(trimSnapshotForMobile(fullSnapshot())) as Record<
      string,
      { items?: unknown[] }
    >;
    const lists = [
      "goals",
      "funnel",
      "coverage",
      "growth",
      "pipeline",
      "passes",
      "decisions",
      "sourceReputation",
      "sourceActivity",
      "memory",
      "logs",
      "skills",
      "repairPlans",
      "reviewQueue",
      "qualityScores",
      "strictQA",
      "rollbacks",
      "security",
      "homepageDrafts",
      "publishing",
    ];
    for (const key of lists) {
      expect(snapshot[key]?.items?.length, `${key} must carry a row`).toBeGreaterThan(0);
    }
  });
});

describe("iPhone wire contract — the check itself has teeth", () => {
  /**
   * A contract test that cannot fail is worse than none: it reads as proof.
   * These three mutations are exactly the drifts this file exists to catch,
   * so they are asserted to be caught rather than assumed to be.
   */
  it("catches a renamed field, a retyped field, and a fractional Int", async () => {
    const status = await readRemoteWorkerStatus(stubPrisma(), { force: true });
    const snapshot = trimSnapshotForMobile(fullSnapshot());

    // 1. The server renames `switchOn` on the host row: Swift decodes it as
    //    nil and the "Mac thinks the switch is..." row silently disappears.
    const renamed = wire({ ok: true, status }) as {
      status: { host: Record<string, unknown> };
    };
    renamed.status.host.switch_on = renamed.status.host.switchOn;
    delete renamed.status.host.switchOn;
    expect(validate(renamed, "StatusResponse").missing).toContain("$.status.host.switchOn");

    // 2. A number becomes a string: Swift throws `typeMismatch` and the WHOLE
    //    payload fails, which the operator sees as "could not connect".
    const retyped = wire({ ok: true, status }) as {
      status: { execution: Record<string, unknown> };
    };
    retyped.status.execution.leaseAgeMs = "5000";
    expect(validate(retyped, "StatusResponse").mismatches).toEqual([
      "$.status.execution.leaseAgeMs: Swift Double, JSON string",
    ]);

    // 3. A property Swift declares `Int` arrives fractional — same fatal
    //    outcome, and far easier to introduce by swapping `int()` for `num()`.
    const fractional = wire({ ok: true, status, snapshot }) as {
      snapshot: { goals: { items: Array<Record<string, unknown>> } };
    };
    fractional.snapshot.goals.items[0]!.gapCount = 796.5;
    expect(validate(fractional, "SnapshotResponse").mismatches).toEqual([
      "$.snapshot.goals.items[0].gapCount: Swift Int, JSON double (796.5)",
    ]);
  });
});

describe("iPhone wire contract — POST /api/admin/worker/switch", () => {
  it("every property SwitchResponse declares is present, and every type decodes", async () => {
    const status = await readRemoteWorkerStatus(stubPrisma(), { force: true });
    const body = wire({
      ok: true,
      switch: {
        on: true,
        changedAt: new Date().toISOString(),
        changedBy: "admin",
        changedFrom: "iphone-app",
        known: true,
      },
      previousOn: false,
      status,
      actuation: {
        pending: true,
        windowMs: 15_000,
        note: "The Mac host reconciles the durable switch on its own poll; execution state follows within this window.",
      },
    });

    const report = validate(body, "SwitchResponse");
    expect(report.mismatches).toEqual([]);
    expect(report.missing).toEqual(["$.switch.error", ...OPTIONAL_ERROR_KEYS]);
    expect(report.extra).toEqual([]);
  });
});
