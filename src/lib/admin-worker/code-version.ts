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
 * On each worker boot (and then at most hourly) we compare {sha, corpusHash}
 * to the most recent `AdminWorkerCodeVersion` row. On a change we insert a new
 * row with a human diff summary vs the previous build, update
 * `AdminWorkerState.workerVersion` (replacing the static default), and log the
 * upgrade. Everything here is fail-open: a version-memory error must never
 * affect a worker pass.
 *
 * Cost control (the worker runs on the operator's Mac, from the checkout the
 * operator develops in):
 *   - the corpus fingerprint walks and parses every source file, so it is
 *     cached per process and only recomputed when the git HEAD or the
 *     package.json / schema.prisma mtimes change — never once per pass;
 *   - `recordCodeVersionIfChanged` does its database compare at most hourly
 *     (the first call in a process, i.e. boot, always runs);
 *   - rapid commits coalesce: a change landing within COALESCE_MS of the last
 *     recorded row updates that row in place instead of adding a new one, so
 *     a burst of commits counts as ONE upgrade for the escalation grace window
 *     rather than restarting it (and re-superseding open escalations) every
 *     time.
 */

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
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

/** Cheap identity of the checkout: HEAD plus the mtimes of the two files every build touches. */
function fingerprintCacheKey(root: string, sha: string | null): string {
  const mtime = (rel: string): string => {
    try {
      return String(statSync(path.join(root, rel)).mtimeMs);
    } catch {
      return "-";
    }
  };
  return [sha ?? "-", mtime("package.json"), mtime(path.join("prisma", "schema.prisma"))].join("|");
}

let _fingerprintCache: { key: string; fp: CorpusFingerprint } | null = null;

/** For tests: forget the per-process fingerprint cache. */
export function resetCorpusFingerprintCache(): void {
  _fingerprintCache = null;
}

/**
 * Deterministic fingerprint of the code SHAPE. Sorted before hashing so the
 * value is stable across runs on the same tree (filesystem walk order is not
 * guaranteed). Fail-open: on any error returns an empty fingerprint that will
 * simply not match, so a transient read error never fabricates a "changed".
 *
 * Cached per process on (git HEAD, package.json mtime, schema mtime): walking
 * and parsing every source file once per pass on a ~1s idle cadence was pure
 * waste, and an uncommitted edit is not a build the worker needs to record.
 * An empty (failed) fingerprint is never cached.
 */
export function corpusFingerprint(
  opts: { root?: string; sha?: string | null } = {},
): CorpusFingerprint {
  const root = opts.root ?? resolveBrainRoot() ?? process.cwd();
  const key = fingerprintCacheKey(root, opts.sha ?? null);
  if (_fingerprintCache && _fingerprintCache.key === key) return _fingerprintCache.fp;
  const fp = computeCorpusFingerprint();
  if (fp.hash) _fingerprintCache = { key, fp };
  return fp;
}

function computeCorpusFingerprint(): CorpusFingerprint {
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
  /** True when the change was folded into the previous row (rapid commit burst). */
  coalesced?: boolean;
  /** True when the hourly throttle skipped the compare. */
  throttled?: boolean;
}

/** Minimum spacing between database compares (boot always runs). */
const CHECK_INTERVAL_MS = 60 * 60 * 1000;
/** A change landing this soon after the last recorded row is the same upgrade. */
const COALESCE_MS = 60 * 60 * 1000;

let _lastCheckAt = 0;
let _lastResult: CodeVersionResult | null = null;

/** For tests: forget the hourly throttle so the next call compares again. */
export function resetCodeVersionThrottle(): void {
  _lastCheckAt = 0;
  _lastResult = null;
}

/**
 * Compare the running build to the last recorded one; on a change, record a new
 * `AdminWorkerCodeVersion` row (or fold it into the previous row when it landed
 * within COALESCE_MS of it), update the worker version on the state singleton,
 * and log the upgrade. Idempotent (a no-op when nothing changed), throttled to
 * one compare per hour per process (`force` bypasses), and fail-open. Safe to
 * call at startup and every pass.
 */
export async function recordCodeVersionIfChanged(
  prisma: PrismaClient,
  opts: { force?: boolean } = {},
): Promise<CodeVersionResult> {
  if (!opts.force && _lastResult && Date.now() - _lastCheckAt < CHECK_INTERVAL_MS) {
    return { ..._lastResult, changed: false, throttled: true };
  }
  try {
    const version = resolveBuildVersion();
    const fp = corpusFingerprint({ sha: version.sha });
    // An empty fingerprint means the corpus couldn't be read — don't record a
    // spurious version off of it (and don't start the throttle on it either).
    if (!fp.hash) return { changed: false, label: version.label, sha: version.sha };
    _lastCheckAt = Date.now();
    _lastResult = { changed: false, label: version.label, sha: version.sha };

    const latest = await prisma.adminWorkerCodeVersion
      .findFirst({ orderBy: { capturedAt: "desc" } })
      .catch(() => null);

    const unchanged =
      latest && latest.corpusHash === fp.hash && (latest.sha ?? null) === (version.sha ?? null);
    if (unchanged) {
      return { changed: false, label: version.label, sha: version.sha };
    }

    const summary = summarizeChange(version, fp, latest);
    const data = {
      sha: version.sha,
      versionLabel: version.label,
      corpusHash: fp.hash,
      fileCount: fp.fileCount,
      totalLines: fp.totalLines,
      routeCount: fp.routeCount,
      prismaModelCount: fp.prismaModelCount,
      changedSummary: summary,
    };
    // Coalesce a burst of commits into the row it started with: capturedAt
    // stays at the burst's start, so escalation's post-upgrade grace is one
    // window per burst, not one per commit.
    const coalesce = !!latest && Date.now() - new Date(latest.capturedAt).getTime() < COALESCE_MS;
    if (coalesce) {
      await prisma.adminWorkerCodeVersion.update({
        where: { id: latest.id },
        data: { ...data, changedSummary: `${summary} (coalesced with a change <1h earlier)` },
      });
    } else {
      await prisma.adminWorkerCodeVersion.create({ data });
    }

    // Keep the operational state's version string current (it was a static
    // default before this module existed).
    await prisma.adminWorkerState
      .update({ where: { id: SINGLETON_ID }, data: { workerVersion: version.label } })
      .catch(() => undefined);

    await writeAdminWorkerLog(prisma, {
      category: "WORKER_PASS",
      severity: "INFO",
      eventName: "code_version_changed",
      message: `Admin Worker code/version change detected: ${summary}${coalesce ? " (coalesced)" : ""}`,
      safeMetadata: {
        label: version.label,
        sha: version.sha,
        corpusHash: fp.hash.slice(0, 16),
        fileCount: fp.fileCount,
        routeCount: fp.routeCount,
        prismaModelCount: fp.prismaModelCount,
        coalesced: coalesce,
      },
    }).catch(() => undefined);

    _lastResult = { changed: false, label: version.label, sha: version.sha };
    return { changed: true, label: version.label, sha: version.sha, summary, coalesced: coalesce };
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
