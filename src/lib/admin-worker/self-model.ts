/**
 * Unified self-model + deep code awareness (replaces the old summary-only
 * code-awareness path).
 *
 * TypeScript owns the filesystem: it ingests the codebase into a structured
 * corpus (files with their exports/imports, routes, Prisma models, package
 * scripts, worker stages, brain ops, and test→module links). The Python brain
 * reasons over that corpus — building the self-model, symbol/route/schema/
 * coverage graphs, finding weak/untested/orphaned/duplicate modules, ranking
 * its own upgrades, and explaining its architecture. The brain only ever
 * recommends; production code changes stay human-reviewed.
 *
 * The result is persisted (a durable self-model snapshot log row) and the
 * ranked upgrades become developer requests, so the worker can say what it is,
 * what is weak, and what it needs next.
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";

import type { PrismaClient } from "@prisma/client";

import {
  buildSelfModel,
  buildTestCoverageGraph,
  explainOwnArchitecture,
  findDuplicateLogic,
  findOrphanedCode,
  findUntestedModules,
  findWeakModules,
  isBrainEnabled,
  rankSelfUpgrades,
  resolveBrainRoot,
  type SelfModelCorpus,
  type SelfModelFile,
} from "./intelligence";
import { BRAIN_OPS } from "./intelligence/contracts";
import { BrainCallContext, recordBrainCall, recordDeveloperRequests } from "./intelligence/store";
import { inspectSchema } from "./awareness";
import { writeAdminWorkerLog } from "./logs";

/** Mission stages the Admin Worker dispatcher walks (the artifact chain). */
const MISSION_STAGES = [
  "DISCOVERY",
  "CANDIDATE_PRIORITIZATION",
  "SOURCE_FETCH",
  "SOURCE_READ",
  "CLASSIFICATION",
  "EXTRACTION",
  "CHECKLIST_CREATION",
  "CITATION_CREATION",
  "PACKAGE_BUILD",
  "CROSS_SOURCE_VERIFICATION",
  "STRICT_QA",
  "PERSISTENCE",
  "PUBLIC_PUBLISH",
  "POST_PUBLISH_VERIFY",
  "SEARCH_VERIFY",
  "SITEMAP_VERIFY",
  "CACHE_REFRESH",
  "REPAIR",
  "HOMEPAGE_WORK",
  "REPORTING",
  "SECURITY_DEFENSE",
  "MAINTENANCE",
];

const SOURCE_DIRS = ["src/lib", "src/app", "src/components", "intelligence", "scripts"];
const TEST_DIRS = ["tests", "intelligence/tests"];

function isCodeFile(name: string): boolean {
  return (
    (name.endsWith(".ts") || name.endsWith(".tsx") || name.endsWith(".py")) &&
    !name.endsWith(".d.ts")
  );
}

function isTestPath(rel: string): boolean {
  return rel.includes(".test.") || rel.includes("/tests/") || rel.startsWith("tests/");
}

/** Module basename without extension (used for import/coverage matching). */
function moduleBase(rel: string): string {
  return rel
    .replace(/\\/g, "/")
    .split("/")
    .pop()!
    .replace(/\.(tsx?|py)$/, "");
}

function parseExports(text: string, isPy: boolean): string[] {
  const out = new Set<string>();
  if (isPy) {
    for (const m of text.matchAll(/^(?:def|class)\s+([A-Za-z_]\w*)/gm)) out.add(m[1]);
  } else {
    for (const m of text.matchAll(
      /export\s+(?:async\s+)?(?:function|const|class|interface|type|enum)\s+([A-Za-z_]\w*)/g,
    ))
      out.add(m[1]);
    for (const m of text.matchAll(/export\s*\{([^}]+)\}/g)) {
      for (const part of m[1].split(",")) {
        const name = part
          .trim()
          .split(/\s+as\s+/)[0]
          .trim();
        if (name) out.add(name);
      }
    }
  }
  return [...out];
}

function parseImports(text: string, isPy: boolean): string[] {
  const out = new Set<string>();
  if (isPy) {
    for (const m of text.matchAll(/^\s*from\s+([.\w]+)\s+import/gm)) out.add(m[1]);
    for (const m of text.matchAll(/^\s*import\s+([.\w]+)/gm)) out.add(m[1]);
  } else {
    for (const m of text.matchAll(/(?:import|from)\s+["']([^"']+)["']/g)) out.add(m[1]);
    for (const m of text.matchAll(/import\s*\(\s*["']([^"']+)["']\s*\)/g)) out.add(m[1]);
  }
  return [...out];
}

function walk(absDir: string, root: string, acc: string[]): void {
  let entries;
  try {
    entries = readdirSync(absDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === "__pycache__" || entry.name.startsWith("."))
      continue;
    const full = path.join(absDir, entry.name);
    if (entry.isDirectory()) walk(full, root, acc);
    else if (isCodeFile(entry.name)) acc.push(path.relative(root, full).replace(/\\/g, "/"));
  }
}

/** Walk the repo and build the self-model corpus (TS owns the filesystem). */
export function buildSelfModelCorpus(root = resolveBrainRoot() ?? process.cwd()): SelfModelCorpus {
  const relPaths: string[] = [];
  for (const d of [...SOURCE_DIRS, ...TEST_DIRS]) {
    const abs = path.join(root, d);
    if (existsSync(abs)) walk(abs, root, relPaths);
  }

  const files: SelfModelFile[] = [];
  const testImportText: string[] = [];
  for (const rel of relPaths) {
    let text = "";
    try {
      text = readFileSync(path.join(root, rel), "utf8");
    } catch {
      continue;
    }
    const isPy = rel.endsWith(".py");
    const isTest = isTestPath(rel);
    const file: SelfModelFile = {
      path: rel,
      lines: text.split("\n").length,
      exports: parseExports(text, isPy),
      imports: parseImports(text, isPy),
      isTest,
    };
    files.push(file);
    if (isTest) testImportText.push(file.imports.join(" "));
  }

  // referencedByTests: a source module is covered if any test imports its base.
  const testBlob = testImportText.join(" ");
  for (const f of files) {
    if (f.isTest) continue;
    const base = moduleBase(f.path);
    f.referencedByTests = base.length > 2 && testBlob.includes(base);
  }

  return {
    files,
    routes: collectRoutes(root),
    models: collectModels(root, files),
    scripts: collectScripts(root),
    stages: MISSION_STAGES,
    brain_ops: [...BRAIN_OPS],
  };
}

function collectRoutes(root: string): SelfModelCorpus["routes"] {
  const appDir = path.join(root, "src", "app");
  const routes: SelfModelCorpus["routes"] = [];
  const walkRoutes = (abs: string, urlPath: string): void => {
    let entries;
    try {
      entries = readdirSync(abs, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith("_") || entry.name === "api") continue;
      const seg = entry.name.startsWith("(") ? "" : `/${entry.name}`;
      const childAbs = path.join(abs, entry.name);
      const childUrl = `${urlPath}${seg}`;
      const pageRel = ["page.tsx", "page.ts"].find((p) => existsSync(path.join(childAbs, p)));
      if (pageRel) {
        routes.push({
          path: childUrl || "/",
          file: path.relative(root, path.join(childAbs, pageRel)).replace(/\\/g, "/"),
        });
      }
      walkRoutes(childAbs, childUrl);
    }
  };
  walkRoutes(appDir, "");
  return routes;
}

function collectModels(root: string, files: SelfModelFile[]): SelfModelCorpus["models"] {
  const models = inspectSchema(root); // [{name, ...}]
  // usedByFiles: count source files referencing the prisma accessor (model
  // name with a lowercased first letter, e.g. ContentGoal → prisma.contentGoal).
  const sourceText: string[] = [];
  for (const f of files) {
    if (f.isTest) continue;
    try {
      sourceText.push(readFileSync(path.join(root, f.path), "utf8"));
    } catch {
      /* ignore */
    }
  }
  return models.map((m) => {
    const accessor = `prisma.${m.name.charAt(0).toLowerCase()}${m.name.slice(1)}`;
    const usedByFiles = sourceText.filter((t) => t.includes(accessor)).length;
    return { name: m.name, usedByFiles };
  });
}

function collectScripts(root: string): string[] {
  try {
    const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
    return Object.keys(pkg.scripts ?? {});
  } catch {
    return [];
  }
}

let _lastSelfModelAt = 0;
const THROTTLE_MS = 6 * 60 * 60 * 1000; // ~4×/day, like the other awareness passes

export interface SelfModelPassResult {
  ran: boolean;
  requests: number;
  weakModules?: number;
  untestedModules?: number;
  coverageRatio?: number;
}

/**
 * Run the unified self-model pass: ingest the codebase, have the brain reason
 * over it, persist a snapshot, and turn ranked self-upgrades into developer
 * requests. Throttled + fail-open (supplementary worker step).
 */
export async function runSelfModelPass(
  prisma: PrismaClient,
  ctx: BrainCallContext = {},
): Promise<SelfModelPassResult> {
  if (!isBrainEnabled() || Date.now() - _lastSelfModelAt < THROTTLE_MS)
    return { ran: false, requests: 0 };
  _lastSelfModelAt = Date.now();
  try {
    const corpus = buildSelfModelCorpus();
    if (corpus.files.length === 0) return { ran: false, requests: 0 };

    const modelEnv = await buildSelfModel(corpus);
    await recordBrainCall(prisma, "build_self_model", modelEnv, ctx);
    if (!modelEnv || !modelEnv.ok || !modelEnv.result) return { ran: false, requests: 0 };

    const [weakEnv, untestedEnv, orphanEnv, dupEnv, coverageEnv] = await Promise.all([
      findWeakModules(corpus.files),
      findUntestedModules(corpus.files),
      findOrphanedCode(corpus.files),
      findDuplicateLogic(corpus.files),
      buildTestCoverageGraph(corpus.files),
    ]);
    await Promise.all([
      recordBrainCall(prisma, "find_weak_modules", weakEnv, ctx),
      recordBrainCall(prisma, "find_untested_modules", untestedEnv, ctx),
      recordBrainCall(prisma, "find_orphaned_code", orphanEnv, ctx),
      recordBrainCall(prisma, "find_duplicate_logic", dupEnv, ctx),
      recordBrainCall(prisma, "build_test_coverage_graph", coverageEnv, ctx),
    ]);

    const coverageRatio =
      coverageEnv?.result?.coverage_ratio ?? modelEnv.result.test_coverage_ratio;
    const upgradesEnv = await rankSelfUpgrades({
      weak_modules: weakEnv?.result?.weak_modules ?? [],
      untested_modules: untestedEnv?.result?.untested_modules ?? [],
      orphan_candidates: orphanEnv?.result?.orphan_candidates ?? [],
      duplicate_pairs: dupEnv?.result?.duplicate_pairs ?? [],
      coverage_ratio: coverageRatio,
    });
    await recordBrainCall(prisma, "rank_self_upgrades", upgradesEnv, ctx);

    const archEnv = await explainOwnArchitecture(modelEnv.result);
    await recordBrainCall(prisma, "explain_own_architecture", archEnv, ctx);

    // Ranked self-upgrades → developer requests (the unified upgrade-request
    // engine; code changes stay human-reviewed).
    const upgrades = upgradesEnv?.result?.upgrades ?? [];
    const devRequests = upgrades.slice(0, 8).map((u) => ({
      kind: "code" as const,
      title: u.title,
      detail: `${u.problem} | gain: ${u.expected_intelligence_gain} | tests: ${u.suggested_tests} | rollback: ${u.rollback_plan}`,
      severity: (u.priority_score >= 0.75 ? "high" : u.priority_score >= 0.5 ? "medium" : "low") as
        | "high"
        | "medium"
        | "low",
      evidence: (u.evidence ?? []).join("; ").slice(0, 300),
    }));
    const { created, bumped } = await recordDeveloperRequests(prisma, devRequests, "self_model");

    // Durable self-model snapshot (Postgres audit trail). A dedicated snapshot
    // table can replace this log row in a later migration.
    await writeAdminWorkerLog(prisma, {
      passId: ctx.passId ?? undefined,
      category: "REPORT",
      severity: weakEnv?.result?.weak_count ? "WARN" : "INFO",
      eventName: "self_model_built",
      message:
        `Self-model: ${modelEnv.result.file_count} files, ${modelEnv.result.brain_op_count} brain ops, ` +
        `${modelEnv.result.route_count} routes, ${modelEnv.result.prisma_model_count} models; ` +
        `coverage ${Math.round(coverageRatio * 100)}%; ${weakEnv?.result?.weak_count ?? 0} weak, ` +
        `${untestedEnv?.result?.untested_count ?? 0} untested; ${created} new + ${bumped} bumped upgrade request(s).`,
      safeMetadata: {
        model: JSON.parse(JSON.stringify(modelEnv.result)),
        weak_count: weakEnv?.result?.weak_count ?? 0,
        untested_count: untestedEnv?.result?.untested_count ?? 0,
        orphan_count: orphanEnv?.result?.orphan_count ?? 0,
        duplicate_pairs: dupEnv?.result?.pair_count ?? 0,
        coverage_ratio: coverageRatio,
        architecture: archEnv?.result?.layers ?? [],
        top_upgrades: upgrades.slice(0, 5).map((u) => u.title),
      },
    }).catch(() => undefined);

    return {
      ran: true,
      requests: created + bumped,
      weakModules: weakEnv?.result?.weak_count ?? 0,
      untestedModules: untestedEnv?.result?.untested_count ?? 0,
      coverageRatio,
    };
  } catch {
    return { ran: false, requests: 0 };
  }
}

/** For tests: reset the self-model throttle. */
export function resetSelfModelThrottle(): void {
  _lastSelfModelAt = 0;
}
