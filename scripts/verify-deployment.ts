/**
 * Deployment verification.
 *
 * After a deploy, this script exercises each piece of the spec's
 * deployment-verification checklist against the running database
 * and reports pass/fail per item. The exit code is non-zero if any
 * MANDATORY item fails.
 *
 *   1. Database connection.
 *   2. Worker heartbeat.
 *   3. Queue enqueue.
 *   4. Source fetch helpers.
 *   5. Content build helpers.
 *   6. Strict QA pipeline.
 *   7. Persistence helpers.
 *   8. Public query (strict-public where clause).
 *   9. Admin dashboard metrics.
 *  10. Security event logging.
 *  11. Email sending if configured.
 *
 * Invocation: `tsx scripts/verify-deployment.ts`.
 */

import { prisma } from "../src/lib/db/client";
import { hasHealthyWorker } from "../src/lib/ingestion/queue/heartbeat";
import { runCanaryBuilds } from "../src/lib/content-factory";
import { runProductionHealthChecks } from "../src/lib/diagnostics/production-health-checks";
import { validateEnvironment } from "../src/lib/diagnostics/env-validation";

type Check = { id: string; label: string; passed: boolean; detail: string; mandatory: boolean };

async function safe(
  id: string,
  label: string,
  mandatory: boolean,
  fn: () => Promise<{ passed: boolean; detail: string }>,
): Promise<Check> {
  try {
    const out = await fn();
    return { id, label, passed: out.passed, detail: out.detail, mandatory };
  } catch (e) {
    return {
      id,
      label,
      passed: false,
      detail: `threw: ${e instanceof Error ? e.message : String(e)}`,
      mandatory,
    };
  }
}

async function main() {
  const checks: Check[] = [];

  checks.push(
    await safe("database_connection", "Database connection", true, async () => {
      await prisma.$queryRaw`SELECT 1`;
      return { passed: true, detail: "SELECT 1 succeeded" };
    }),
  );
  checks.push(
    await safe("env_validation", "Environment variables", true, async () => {
      const result = validateEnvironment();
      return {
        passed: result.missingRequired === 0,
        detail:
          result.missingRequired === 0
            ? `${result.entries.length} variables inspected, no required missing`
            : `${result.missingRequired} required variable(s) missing`,
      };
    }),
  );
  checks.push(
    await safe("worker_heartbeat", "Worker heartbeat", false, async () => {
      const ok = await hasHealthyWorker();
      return {
        passed: ok,
        detail: ok ? "Worker heartbeat detected" : "No worker heartbeat (start worker process)",
      };
    }),
  );
  checks.push(
    await safe("queue_enqueue", "Queue enqueue readable", true, async () => {
      const count = await prisma.ingestionJobQueue.count();
      return { passed: true, detail: `IngestionJobQueue row count = ${count}` };
    }),
  );
  checks.push(
    await safe("canary_builds", "Content factory canary builds", true, async () => {
      const report = runCanaryBuilds();
      const failing = report.results.filter((r) => !r.passed);
      return {
        passed: report.factoryHealthy,
        detail: report.factoryHealthy
          ? `All ${report.results.length} canary fixtures passed`
          : `Canary failures: ${failing.map((f) => `${f.contentType}/${f.fixtureName} (${f.outcome})`).join(", ")}`,
      };
    }),
  );
  checks.push(
    await safe("strict_qa_helper", "Strict QA helper resolves", true, async () => {
      const { runStrictPipelineSync } = await import("../src/lib/content-qa/pipeline");
      return { passed: typeof runStrictPipelineSync === "function", detail: "import ok" };
    }),
  );
  checks.push(
    await safe("persistence_helper", "Persistence helper resolves", true, async () => {
      const { persistBuiltPackage } = await import("../src/lib/content-factory");
      return { passed: typeof persistBuiltPackage === "function", detail: "import ok" };
    }),
  );
  checks.push(
    await safe("public_query", "Strict public query runs", true, async () => {
      const { STRICT_PUBLIC_WHERE_CLAUSE } = await import("../src/lib/content-qa/thresholds");
      const count = await prisma.prayer.count({ where: STRICT_PUBLIC_WHERE_CLAUSE });
      return { passed: true, detail: `Strict public prayer count = ${count}` };
    }),
  );
  checks.push(
    await safe("admin_metrics", "Admin metrics load", true, async () => {
      await prisma.ingestionJobQueue.count();
      await prisma.workerHeartbeat.count();
      await prisma.contentPackageBuildLog.count();
      return { passed: true, detail: "Admin queries returned" };
    }),
  );
  checks.push(
    await safe("security_event_logging", "Security event logging", true, async () => {
      await prisma.securityEvent.count();
      return { passed: true, detail: "SecurityEvent table readable" };
    }),
  );
  checks.push(
    await safe("email_pipeline", "Email pipeline status", false, async () => {
      const { readResendApiKey } = await import("../src/lib/email/resend");
      const key = readResendApiKey();
      return {
        passed: key !== null,
        detail:
          key === null
            ? "RESEND_API_KEY unset — transactional email disabled (non-blocking)"
            : "RESEND_API_KEY configured",
      };
    }),
  );

  // Aggregate health snapshot for the operator log.
  const healthReport = await runProductionHealthChecks().catch(() => null);
  if (healthReport) {
    checks.push({
      id: "production_health_snapshot",
      label: "Production health snapshot",
      passed: healthReport.healthy,
      detail: healthReport.healthy
        ? "All production health checks pass"
        : `${healthReport.failedCount} production health check(s) failing`,
      mandatory: false,
    });
  }

  // Render the report.
  let mandatoryFailures = 0;
  console.log("=== Deployment verification ===");
  for (const c of checks) {
    const prefix = c.passed ? "[ ok ]" : c.mandatory ? "[FAIL]" : "[warn]";
    console.log(`${prefix} ${c.label} — ${c.detail}`);
    if (!c.passed && c.mandatory) mandatoryFailures += 1;
  }
  console.log("");
  console.log(`Total: ${checks.length}  Mandatory failures: ${mandatoryFailures}`);
  process.exit(mandatoryFailures > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("verify-deployment: fatal", e);
  process.exit(2);
});
