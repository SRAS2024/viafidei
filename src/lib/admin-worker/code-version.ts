/**
 * System / code-update version memory (spec bullet 4).
 *
 * The platform must recognize when its OWN codebase / worker code has changed,
 * remember what changed between versions, and feed that knowledge into
 * diagnostics, reporting, governance, escalation context, and future decisions.
 *
 * Two independent signals identify a build:
 *   - the git commit SHA when it can be resolved (deploy env var, a build-time
 *     `.build-version` file, or `git rev-parse HEAD` in a checkout), and
 *   - a deterministic CORPUS FINGERPRINT — a stable hash of the self-model
 *     corpus (source file paths + their exports + Prisma models + routes +
 *     pipeline stages + brain ops). This detects a code change even when no SHA
 *     is available (e.g. a container with no `.git`), because the shape of the
 *     code itself changed.
 *
 * On each worker boot (and once per pass, cheaply) we compare {sha, corpusHash}
 * to the most recent `AdminWorkerCodeVersion` row. On a change we insert a new
 * row with a human diff summary vs the previous build, update
 * `AdminWorkerState.workerVersion` (replacing the static default), and log the
 * upgrade. Everything here is fail-open: a version-memory error must never
 * affect a worker pass.
 */

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import type { PrismaClient } from "@prisma/client";

import { buildSelfModelCorpus } from "./self-model";
import { resolveBrainRoot } from "./intelligence";
import { writeAdminWorkerLog } from "./logs";

const SINGLETON_ID = "singleton";

export interface BuildVersion {
  /** Git commit SHA when resolvable, else null. */
  sha: string | null;
  /** Human worker-version label, e.g. "admin-worker/1a2b3c4d". */
  label: string;
}

export interface CorpusFingerprint {
  hash: string;
  fileCount: number;
  totalLines: number;
  routeCount: number;
  prismaModelCount: number;
}

/**
 * Resolve the running build's identity. Precedence (first hit wins for the
 * SHA): deploy env vars → a build-time `.build-version` file (written by
 * Dockerfile.worker) → `git rev-parse HEAD` in a checkout. All steps are
 * fail-open. The label prefers the SHA (short), then npm package version, then
 * a stable default.
 */
export function resolveBuildVersion(root = resolveBrainRoot() ?? process.cwd()): BuildVersion {
  let sha: string | null = null;

  const envSha =
    process.env.RAILWAY_GIT_COMMIT_SHA ||
    process.env.GIT_SHA ||
    process.env.GIT_COMMIT ||
    process.env.SOURCE_COMMIT ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    null;
  if (envSha && envSha.trim()) sha = envSha.trim();

  if (!sha) {
    try {
      const buildFile = path.join(root, ".build-version");
      if (existsSync(buildFile)) {
        const contents = readFileSync(buildFile, "utf8").trim();
        if (contents) sha = contents.split(/\s+/)[0];
      }
    } catch {
      // fail-open
    }
  }

  if (!sha) {
    try {
      const out = execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: root,
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 3000,
      })
        .toString()
        .trim();
      if (out) sha = out;
    } catch {
      // no git / not a checkout — fine
    }
  }

  const npmVersion = process.env.npm_package_version?.trim();
  const label = sha
    ? `admin-worker/${sha.slice(0, 12)}`
    : npmVersion
      ? `admin-worker/${npmVersion}`
      : "admin-worker/0.1";

  return { sha: sha ?? null, label };
}

/**
 * Deterministic fingerprint of the code SHAPE. Sorted before hashing so the
 * value is stable across runs on the same tree (filesystem walk order is not
 * guaranteed). Fail-open: on any error returns an empty fingerprint that will
 * simply not match, so a transient read error never fabricates a "changed".
 */
export function corpusFingerprint(): CorpusFingerprint {
  try {
    const corpus = buildSelfModelCorpus();
    const fileParts = corpus.files
      .map((f) => `${f.path}#${[...f.exports].sort().join(",")}`)
      .sort();
    const modelParts = corpus.models.map((m) => m.name).sort();
    const routeParts = corpus.routes.map((r) => r.path).sort();
    const stageParts = [...corpus.stages].sort();
    const opParts = [...corpus.brain_ops].sort();
    const material = JSON.stringify({
      fileParts,
      modelParts,
      routeParts,
      stageParts,
      opParts,
    });
    const hash = createHash("sha256").update(material).digest("hex");
    const totalLines = corpus.files.reduce((s, f) => s + (f.lines || 0), 0);
    return {
      hash,
      fileCount: corpus.files.length,
      totalLines,
      routeCount: corpus.routes.length,
      prismaModelCount: corpus.models.length,
    };
  } catch {
    return { hash: "", fileCount: 0, totalLines: 0, routeCount: 0, prismaModelCount: 0 };
  }
}

/** Build a human diff summary of this build vs the previous recorded row. */
function summarizeChange(
  version: BuildVersion,
  fp: CorpusFingerprint,
  prev: {
    sha: string | null;
    fileCount: number;
    routeCount: number;
    prismaModelCount: number;
  } | null,
): string {
  if (!prev) return `Initial recorded build (${version.label}).`;
  const parts: string[] = [];
  if (version.sha && prev.sha && version.sha !== prev.sha) {
    parts.push(`commit ${prev.sha.slice(0, 8)} → ${version.sha.slice(0, 8)}`);
  } else if (version.sha && !prev.sha) {
    parts.push(`commit now ${version.sha.slice(0, 8)}`);
  }
  const df = fp.fileCount - prev.fileCount;
  const dr = fp.routeCount - prev.routeCount;
  const dm = fp.prismaModelCount - prev.prismaModelCount;
  const fmt = (n: number, noun: string) =>
    n === 0 ? null : `${n > 0 ? "+" : ""}${n} ${noun}${Math.abs(n) === 1 ? "" : "s"}`;
  for (const s of [fmt(df, "file"), fmt(dr, "route"), fmt(dm, "model")]) {
    if (s) parts.push(s);
  }
  if (parts.length === 0) parts.push("code shape changed (exports/imports differ)");
  return `Upgrade: ${parts.join(", ")}.`;
}

export interface CodeVersionResult {
  changed: boolean;
  label: string;
  sha: string | null;
  summary?: string;
}

/**
 * Compare the running build to the last recorded one; on a change, record a new
 * `AdminWorkerCodeVersion` row, update the worker version on the state
 * singleton, and log the upgrade. Idempotent (a no-op when nothing changed) and
 * fail-open. Safe to call at startup and once per pass.
 */
export async function recordCodeVersionIfChanged(prisma: PrismaClient): Promise<CodeVersionResult> {
  try {
    const version = resolveBuildVersion();
    const fp = corpusFingerprint();
    // An empty fingerprint means the corpus couldn't be read — don't record a
    // spurious version off of it.
    if (!fp.hash) return { changed: false, label: version.label, sha: version.sha };

    const latest = await prisma.adminWorkerCodeVersion
      .findFirst({ orderBy: { capturedAt: "desc" } })
      .catch(() => null);

    const unchanged =
      latest && latest.corpusHash === fp.hash && (latest.sha ?? null) === (version.sha ?? null);
    if (unchanged) {
      return { changed: false, label: version.label, sha: version.sha };
    }

    const summary = summarizeChange(version, fp, latest);
    await prisma.adminWorkerCodeVersion.create({
      data: {
        sha: version.sha,
        versionLabel: version.label,
        corpusHash: fp.hash,
        fileCount: fp.fileCount,
        totalLines: fp.totalLines,
        routeCount: fp.routeCount,
        prismaModelCount: fp.prismaModelCount,
        changedSummary: summary,
      },
    });

    // Keep the operational state's version string current (it was a static
    // default before this module existed).
    await prisma.adminWorkerState
      .update({ where: { id: SINGLETON_ID }, data: { workerVersion: version.label } })
      .catch(() => undefined);

    await writeAdminWorkerLog(prisma, {
      category: "WORKER_PASS",
      severity: "INFO",
      eventName: "code_version_changed",
      message: `Admin Worker code/version change detected: ${summary}`,
      safeMetadata: {
        label: version.label,
        sha: version.sha,
        corpusHash: fp.hash.slice(0, 16),
        fileCount: fp.fileCount,
        routeCount: fp.routeCount,
        prismaModelCount: fp.prismaModelCount,
      },
    }).catch(() => undefined);

    return { changed: true, label: version.label, sha: version.sha, summary };
  } catch {
    return { changed: false, label: "admin-worker/0.1", sha: null };
  }
}

export interface VersionContext {
  current: {
    label: string;
    sha: string | null;
    capturedAt: Date;
    changedSummary: string | null;
  } | null;
  previous: { label: string; sha: string | null; capturedAt: Date } | null;
  /** True when the current build was recorded within `withinMs` (default 6h). */
  upgradedRecently: boolean;
  recentUpgradeSummary: string | null;
}

/**
 * Read the version context for diagnostics / reporting / escalation. Reports
 * the current build, the previous one, and whether an upgrade landed recently
 * (so an escalation can be annotated as possibly upgrade-related). Fail-open.
 */
export async function getVersionContext(
  prisma: PrismaClient,
  opts: { withinMs?: number } = {},
): Promise<VersionContext> {
  const withinMs = opts.withinMs ?? 6 * 60 * 60 * 1000;
  try {
    const rows = await prisma.adminWorkerCodeVersion.findMany({
      orderBy: { capturedAt: "desc" },
      take: 2,
    });
    const current = rows[0]
      ? {
          label: rows[0].versionLabel,
          sha: rows[0].sha ?? null,
          capturedAt: rows[0].capturedAt,
          changedSummary: rows[0].changedSummary ?? null,
        }
      : null;
    const previous = rows[1]
      ? { label: rows[1].versionLabel, sha: rows[1].sha ?? null, capturedAt: rows[1].capturedAt }
      : null;
    const upgradedRecently =
      !!current && !!previous && Date.now() - current.capturedAt.getTime() <= withinMs;
    return {
      current,
      previous,
      upgradedRecently,
      recentUpgradeSummary: upgradedRecently ? (current?.changedSummary ?? null) : null,
    };
  } catch {
    return { current: null, previous: null, upgradedRecently: false, recentUpgradeSummary: null };
  }
}
