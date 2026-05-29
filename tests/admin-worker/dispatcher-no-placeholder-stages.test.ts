/**
 * Spec §3.16: a guard test that scans every dispatcher stage handler
 * and FAILS if a handler only logs intent without executing real work.
 *
 * "Real work" = at least one of: a prisma query, a dynamic import of a
 * worker module (orchestrator/verifier/etc.), a pipeline-stage record,
 * a reputation push, or a repair-plan filing. A handler whose body
 * contains only writeAdminWorkerLog + return is a placeholder and must
 * fail this test.
 *
 * This is a static source scan — it does not run the dispatcher — so a
 * regression that reintroduces a log-only stub is caught at test time.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const dispatcherPath = resolve(here, "../../src/lib/admin-worker/dispatcher.ts");
const source = readFileSync(dispatcherPath, "utf8");

/** Every stage handler the dispatcher's switch can route to. */
const STAGE_HANDLERS = [
  "runSecurityDefense",
  "runDiscovery",
  "runCandidatePrioritization",
  "runSourceFetchRead",
  "runClassification",
  "runExtraction",
  "runChecklistOrCitation",
  "runPackageBuild",
  "runCrossSourceVerification",
  "runStrictQA",
  "runPersistAndPublish",
  "runPostPublishVerify",
  "runSearchVerify",
  "runSitemapVerify",
  "runCacheRefresh",
  "runRepair",
  "runHomepageWork",
  "runReporting",
  "runMaintenance",
];

/** Signals that a handler does real work (not just logging). */
const WORK_SIGNALS = [
  "prisma.",
  "await import(",
  "recordStage(",
  "pushReputation",
  "filePlan(",
  "recordStrictQA",
  "runDiscoveryOrchestrator",
  "runRepairOrchestrator",
  "runHomepagePublishOrchestrator",
  "runIndependentVerifiers",
  "verifyPublished",
  "recoverStuckQueue",
  "runCleanupPass",
  "runAdminWorkerDiagnostics",
];

/**
 * Extract a function body by brace-matching from `async function NAME`.
 */
function extractBody(src: string, fnName: string): string {
  const start = src.indexOf(`async function ${fnName}`);
  if (start === -1) return "";
  const braceStart = src.indexOf("{", start);
  if (braceStart === -1) return "";
  let depth = 0;
  for (let i = braceStart; i < src.length; i++) {
    const ch = src[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return src.slice(braceStart + 1, i);
    }
  }
  return "";
}

describe("dispatcher has no log-only placeholder stages (spec §3.16)", () => {
  it("finds every declared stage handler in the source", () => {
    for (const fn of STAGE_HANDLERS) {
      expect(source.includes(`async function ${fn}`)).toBe(true);
    }
  });

  it("every stage handler performs real work, not just logging", () => {
    const offenders: string[] = [];
    for (const fn of STAGE_HANDLERS) {
      const body = extractBody(source, fn);
      expect(body.length).toBeGreaterThan(0);
      const hasWork = WORK_SIGNALS.some((sig) => body.includes(sig));
      if (!hasWork) offenders.push(fn);
    }
    expect(offenders, `log-only placeholder handlers: ${offenders.join(", ")}`).toEqual([]);
  });

  it("no handler contains the known log-only stub phrasings", () => {
    const stubPhrases = [
      "nothing extra to do here",
      "nothing to do here",
      "build engine runs QA inline; nothing",
      "log intent only",
      "placeholder stage",
    ];
    for (const phrase of stubPhrases) {
      expect(source.includes(phrase)).toBe(false);
    }
  });
});
