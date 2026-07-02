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
