/**
 * System/code-update version memory. Pins build-identity resolution, a stable
 * corpus fingerprint, and that a code change is recorded once (and is a no-op
 * when nothing changed) — all fail-open.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const FIXED_CORPUS = {
  files: [
    { path: "b.ts", lines: 20, exports: ["y", "z"], imports: [] },
    { path: "a.ts", lines: 10, exports: ["x"], imports: [] },
  ],
  routes: [{ path: "/r" }],
  models: [{ name: "M", usedByFiles: 1 }],
  scripts: [],
  stages: ["S"],
  brain_ops: ["op"],
};

vi.mock("@/lib/admin-worker/self-model", () => ({
  buildSelfModelCorpus: () => FIXED_CORPUS,
}));

import {
  resolveBuildVersion,
  corpusFingerprint,
  recordCodeVersionIfChanged,
  resetCodeVersionThrottle,
  resetCorpusFingerprintCache,
} from "@/lib/admin-worker/code-version";

const VERSION_ENVS = [
  "RAILWAY_GIT_COMMIT_SHA",
  "GIT_SHA",
  "GIT_COMMIT",
  "SOURCE_COMMIT",
  "VERCEL_GIT_COMMIT_SHA",
];
let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = {};
  for (const k of VERSION_ENVS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  // The compare is throttled to once an hour per process; each test is a fresh hour.
  resetCodeVersionThrottle();
  resetCorpusFingerprintCache();
});
afterEach(() => {
  for (const k of VERSION_ENVS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("resolveBuildVersion", () => {
  it("uses an env SHA and shortens it into the label", () => {
    process.env.GIT_SHA = "abcdef1234567890deadbeef";
    const v = resolveBuildVersion();
    expect(v.sha).toBe("abcdef1234567890deadbeef");
    expect(v.label).toBe("admin-worker/abcdef123456");
  });

  it("prefers RAILWAY_GIT_COMMIT_SHA over GIT_SHA", () => {
    process.env.RAILWAY_GIT_COMMIT_SHA = "railwaysha000";
    process.env.GIT_SHA = "othersha111";
    expect(resolveBuildVersion().sha).toBe("railwaysha000");
  });
});

describe("corpusFingerprint", () => {
  it("is deterministic and reports corpus sizes", () => {
    const a = corpusFingerprint();
    const b = corpusFingerprint();
    expect(a.hash).toBe(b.hash);
    expect(a.hash).toHaveLength(64);
    expect(a.fileCount).toBe(2);
    expect(a.totalLines).toBe(30);
    expect(a.routeCount).toBe(1);
    expect(a.prismaModelCount).toBe(1);
  });
});

function makePrisma(latest: unknown) {
  return {
    __create: vi.fn(async (args: unknown) => args),
    adminWorkerCodeVersion: {
      findFirst: vi.fn(async () => latest),
      create: vi.fn(async () => ({ id: "cv1" })),
      update: vi.fn(async () => ({ id: "cv0" })),
    },
    adminWorkerState: { update: vi.fn(async () => ({})) },
    adminWorkerLog: { create: vi.fn(async () => ({ id: "l1" })) },
  };
}

describe("recordCodeVersionIfChanged", () => {
  it("records a new row + updates version + logs on first/changed build", async () => {
    process.env.GIT_SHA = "sha-one-000000";
    const prisma = makePrisma(null);
    const r = await recordCodeVersionIfChanged(prisma as never);
    expect(r.changed).toBe(true);
    expect(prisma.adminWorkerCodeVersion.create).toHaveBeenCalledTimes(1);
    expect(prisma.adminWorkerState.update).toHaveBeenCalledTimes(1);
    expect(prisma.adminWorkerLog.create).toHaveBeenCalledTimes(1);
    expect(r.summary).toMatch(/initial/i);
  });

  it("is a no-op when the corpus hash + sha are unchanged", async () => {
    process.env.GIT_SHA = "sha-one-000000";
    const fp = corpusFingerprint();
    const prisma = makePrisma({ corpusHash: fp.hash, sha: "sha-one-000000" });
    const r = await recordCodeVersionIfChanged(prisma as never);
    expect(r.changed).toBe(false);
    expect(prisma.adminWorkerCodeVersion.create).not.toHaveBeenCalled();
  });

  it("records a change when the SHA moved even if the corpus is identical", async () => {
    process.env.GIT_SHA = "sha-two-111111";
    const fp = corpusFingerprint();
    const prisma = makePrisma({ corpusHash: fp.hash, sha: "sha-one-000000", fileCount: 2 });
    const r = await recordCodeVersionIfChanged(prisma as never);
    expect(r.changed).toBe(true);
    expect(prisma.adminWorkerCodeVersion.create).toHaveBeenCalledTimes(1);
  });
});

/**
 * Cost + coalescing controls: the worker runs on the operator's Mac from the
 * checkout the operator develops in, so the compare must be cheap and a burst
 * of commits must count as ONE upgrade (escalation's post-upgrade grace is one
 * window per burst, not per commit).
 */
describe("recordCodeVersionIfChanged — throttle, cache, coalescing", () => {
  it("compares at most once per hour per process (force bypasses)", async () => {
    process.env.GIT_SHA = "sha-one-000000";
    const prisma = makePrisma(null);
    const first = await recordCodeVersionIfChanged(prisma as never);
    expect(first.changed).toBe(true);
    const second = await recordCodeVersionIfChanged(prisma as never);
    expect(second.changed).toBe(false);
    expect(second.throttled).toBe(true);
    expect(second.label).toBe(first.label);
    expect(prisma.adminWorkerCodeVersion.findFirst).toHaveBeenCalledTimes(1);
    const forced = await recordCodeVersionIfChanged(prisma as never, { force: true });
    expect(forced.throttled).toBeUndefined();
    expect(prisma.adminWorkerCodeVersion.findFirst).toHaveBeenCalledTimes(2);
  });

  it("folds a change landing within an hour of the last row into that row (coalesce)", async () => {
    process.env.GIT_SHA = "sha-two-111111";
    const fp = corpusFingerprint();
    const prisma = makePrisma({
      id: "cv0",
      corpusHash: fp.hash,
      sha: "sha-one-000000",
      fileCount: 2,
      capturedAt: new Date(Date.now() - 10 * 60_000), // 10 min ago → same upgrade burst
    });
    const r = await recordCodeVersionIfChanged(prisma as never);
    expect(r.changed).toBe(true);
    expect(r.coalesced).toBe(true);
    expect(prisma.adminWorkerCodeVersion.update).toHaveBeenCalledTimes(1);
    expect(prisma.adminWorkerCodeVersion.create).not.toHaveBeenCalled();
    const arg = prisma.adminWorkerCodeVersion.update.mock.calls[0][0] as {
      where: { id: string };
      data: { sha: string; changedSummary: string };
    };
    expect(arg.where.id).toBe("cv0");
    expect(arg.data.sha).toBe("sha-two-111111");
    expect(arg.data.changedSummary).toMatch(/coalesced/);
  });

  it("records a NEW row when the previous one is older than the coalesce window", async () => {
    process.env.GIT_SHA = "sha-two-111111";
    const fp = corpusFingerprint();
    const prisma = makePrisma({
      id: "cv0",
      corpusHash: fp.hash,
      sha: "sha-one-000000",
      fileCount: 2,
      capturedAt: new Date(Date.now() - 3 * 60 * 60_000), // 3h ago → a distinct upgrade
    });
    const r = await recordCodeVersionIfChanged(prisma as never);
    expect(r.changed).toBe(true);
    expect(r.coalesced).toBe(false);
    expect(prisma.adminWorkerCodeVersion.create).toHaveBeenCalledTimes(1);
    expect(prisma.adminWorkerCodeVersion.update).not.toHaveBeenCalled();
  });
});

describe("corpusFingerprint cache", () => {
  it("reuses the fingerprint for the same (sha, mtimes) key and recomputes when the sha changes", () => {
    const a = corpusFingerprint({ sha: "same" });
    const b = corpusFingerprint({ sha: "same" });
    expect(b).toBe(a); // identical object → served from the per-process cache
    const c = corpusFingerprint({ sha: "other" });
    expect(c).not.toBe(a); // new key → recomputed…
    expect(c.hash).toBe(a.hash); // …with the same deterministic hash
  });
});
