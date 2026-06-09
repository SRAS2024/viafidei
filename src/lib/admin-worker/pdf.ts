/**
 * Admin Worker PDF generators.
 *
 * Two PDFs ship from here:
 *   1. Developer Audit — operator-triggered from the diagnostics card.
 *      Sections: Diagnostics Results, Worker Logs, System Logs,
 *      Security Logs, Content Growth and Publishing, Homepage Actions,
 *      Recommended Repairs. First page is a table of contents.
 *
 *   2. Monthly Admin Worker Report — sent on the last day of every
 *      month to ADMIN_EMAIL. Daily sections + monthly summary.
 *
 * Both PDFs run every payload through `redactSecrets` before rendering
 * so passwords / API keys / session secrets / tokens / cookies /
 * authorization headers / full database URLs / private env values
 * never land in a download. Useful debugging fields (worker ID,
 * source host, content type, job kind, timestamps, route paths,
 * diagnostic status, failure category) are kept verbatim.
 */

import type { PrismaClient } from "@prisma/client";

import { ReportBuilder, toReportStatus } from "@/lib/pdf/report";
import {
  collectDeveloperAuditData,
  redactSecrets,
  type DeveloperAuditSection,
  DEVELOPER_AUDIT_SECTIONS,
} from "./report-generator";
import type { AdminDeveloperReportPeriod } from "@prisma/client";

function periodLabel(p: AdminDeveloperReportPeriod): string {
  switch (p) {
    case "LAST_24_HOURS":
      return "Last 24 hours";
    case "LAST_7_DAYS":
      return "Last 7 days";
    case "LAST_30_DAYS":
      return "Last 30 days";
  }
}

function fmtTime(d: Date | null | undefined): string {
  return d ? d.toISOString() : "—";
}

function redactString(text: string): string {
  // Per-line scan that catches secrets in raw log lines.
  return text.replace(/([A-Za-z_][A-Za-z0-9_]*\s*[=:]\s*)("[^"]*"|\S+)/g, (match, key: string) => {
    const lower = key.toLowerCase();
    if (
      lower.includes("password") ||
      lower.includes("apikey") ||
      lower.includes("api_key") ||
      lower.includes("token") ||
      lower.includes("cookie") ||
      lower.includes("session_secret") ||
      lower.includes("authorization") ||
      lower.includes("database_url")
    ) {
      return `${key}[REDACTED]`;
    }
    return match;
  });
}

/**
 * Generate the Developer Audit PDF for a chosen period. Records the
 * generation in AdminDeveloperReportLog so the operator can audit how
 * many reports they have pulled.
 */
export async function generateAdminWorkerDeveloperAuditPdf(
  prisma: PrismaClient,
  period: AdminDeveloperReportPeriod,
  generatedByUsername: string,
  options: { includedSections?: DeveloperAuditSection[] } = {},
): Promise<{ pdf: Buffer; reportLogId: string }> {
  // Insert a PENDING row first so even a crash leaves a forensic trail.
  const logRow = await prisma.adminDeveloperReportLog.create({
    data: {
      reportPeriod: period,
      generatedBy: generatedByUsername,
      status: "PENDING",
      includedSections: (options.includedSections ?? DEVELOPER_AUDIT_SECTIONS).map(String),
    },
    select: { id: true },
  });

  try {
    const data = await collectDeveloperAuditData(prisma, period);
    const sectionsToInclude = new Set<string>(
      (options.includedSections ?? DEVELOPER_AUDIT_SECTIONS).map(String),
    );

    const builder = new ReportBuilder({
      reportTitle: "Developer Audit",
      period: periodLabel(period),
      generatedAt: data.generatedAt.toISOString(),
      environment: process.env.NODE_ENV ?? "development",
      appName: "Via Fidei · Admin Worker",
      dashboardSection: "Diagnostics",
      reportVersion: "admin-worker/0.2",
    });

    const has = (s: string) => sectionsToInclude.has(s);

    // Generic renderer for a category of worker logs, so every declared
    // per-stage log section actually appears in the report (nothing the worker
    // recorded in the period is silently dropped). `cap` is generous; the
    // collector already bounds the period to 1000 rows.
    type WLog = (typeof data.workerLogs)[number];
    const renderLogs = (name: string, logs: WLog[], empty: string, cap = 300) => {
      builder.section(name);
      builder.paragraph(
        `${logs.length} log entr${logs.length === 1 ? "y" : "ies"} in this period.`,
      );
      if (logs.length === 0) {
        builder.note(empty);
        return;
      }
      builder.table(
        [
          { header: "When", weight: 120 },
          { header: "Sev", weight: 42 },
          { header: "Event", weight: 130 },
          { header: "Message", weight: 158 },
        ],
        logs
          .slice(0, cap)
          .map((l) => [
            fmtTime(l.createdAt),
            l.severity,
            l.eventName,
            redactString(l.message).slice(0, 90),
          ]),
      );
      if (logs.length > cap) builder.note(`… ${logs.length - cap} more not shown.`);
    };
    const inCat = (cat: string) => data.workerLogs.filter((l) => l.category === cat);

    // ─── Table of Contents ────────────────────────────────────────────
    if (has("Table of Contents")) {
      builder.section("Table of Contents");
      for (const s of options.includedSections ?? DEVELOPER_AUDIT_SECTIONS) {
        if (s !== "Table of Contents") builder.paragraph(`• ${s}`);
      }
    }

    // ─── Executive Summary ────────────────────────────────────────────
    if (has("Executive Summary")) {
      builder.section("Executive Summary");
      builder.keyValue([
        { label: "Period", value: periodLabel(period) },
        { label: "Worker passes", value: String(data.recentPasses.length) },
        { label: "Worker log entries", value: String(data.workerLogs.length) },
        { label: "Brain decisions", value: String(data.brainDecisions.length) },
        { label: "Pipeline stage rows", value: String(data.pipelineStages.length) },
        { label: "Strict-QA results", value: String(data.strictQAResults.length) },
        { label: "Repairs filed", value: String(data.repairPlans.length) },
        { label: "Current blockers", value: String(data.currentBlockers?.length ?? 0) },
        { label: "Open worker requests", value: String((data.workerRequests ?? []).length) },
      ]);
    }

    // ─── Section 1: Diagnostics Results ───────────────────────────────
    if (sectionsToInclude.has("Diagnostics Results")) {
      builder.section("Diagnostics Results");
      builder.paragraph(
        `Admin Worker health snapshot. ${data.diagnosticsSummary.pass} pass, ` +
          `${data.diagnosticsSummary.warn} warn, ${data.diagnosticsSummary.fail} fail, ` +
          `${data.diagnosticsSummary.unknown} unknown.`,
      );
      for (const rating of data.diagnosticsResults) {
        builder.statusLine(rating.label, toReportStatus(rating.status), rating.summary);
        if (rating.recommendedRepair) {
          builder.note(`Repair: ${rating.recommendedRepair}`);
        }
      }
    }

    // ─── Section 2: Worker Logs ────────────────────────────────────────
    if (sectionsToInclude.has("Worker Logs")) {
      builder.section("Worker Logs");
      const passes = data.recentPasses;
      builder.paragraph(`${passes.length} recent pass(es). Most recent first.`);
      if (passes.length > 0) {
        builder.table(
          [
            { header: "Pass type", weight: 90 },
            { header: "Status", weight: 60 },
            { header: "Started", weight: 130 },
            { header: "Built", weight: 40, align: "right" },
            { header: "Pub", weight: 40, align: "right" },
            { header: "Fail", weight: 40, align: "right" },
          ],
          passes.map((p) => [
            p.passType,
            p.status,
            fmtTime(p.startedAt),
            String(p.contentBuilt),
            String(p.contentPublished),
            String(p.tasksFailed),
          ]),
        );
      }
      builder.subsection("Recent worker log entries");
      const workerLogs = data.workerLogs.filter(
        (l) => l.category !== "SECURITY" && l.category !== "ERROR",
      );
      if (workerLogs.length === 0) {
        builder.note("No worker log entries in this period.");
      } else {
        for (const log of workerLogs.slice(0, 500)) {
          builder.paragraph(
            redactString(
              `[${log.createdAt.toISOString()}] ${log.severity} ${log.category} ` +
                `${log.eventName}: ${log.message}`,
            ),
          );
        }
      }
    }

    // ─── Section 3: System Logs (errors + repairs) ─────────────────────
    if (sectionsToInclude.has("System Logs")) {
      builder.section("System Logs");
      const system = data.workerLogs.filter(
        (l) => l.category === "REPAIR" || l.category === "ERROR",
      );
      builder.paragraph(`${system.length} system (error + repair) log entries in this period.`);
      if (system.length === 0) {
        builder.note("No error or repair log entries in this period.");
      } else {
        for (const log of system.slice(0, 300)) {
          builder.paragraph(
            redactString(
              `[${log.createdAt.toISOString()}] ${log.severity} ${log.category}: ${log.message}`,
            ),
          );
        }
      }
    }

    // ─── Section 4: Security Logs ──────────────────────────────────────
    if (sectionsToInclude.has("Security Logs")) {
      builder.section("Security Logs");
      const securityLogs = data.workerLogs.filter((l) => l.category === "SECURITY");
      builder.paragraph(`${securityLogs.length} security log entries.`);
      if (securityLogs.length === 0) {
        builder.note("No security events in this period.");
      } else {
        for (const log of securityLogs) {
          builder.paragraph(
            redactString(
              `[${log.createdAt.toISOString()}] ${log.severity} ${log.eventName}: ${log.message}`,
            ),
          );
        }
      }
    }

    // ─── Section 5: Content Growth and Publishing ──────────────────────
    if (sectionsToInclude.has("Content Growth and Publishing")) {
      builder.section("Content Growth and Publishing");
      const goalRows = await prisma.contentGoal.findMany({
        orderBy: [{ priority: "asc" }],
      });
      if (goalRows.length === 0) {
        builder.note("No content goals seeded yet.");
      } else {
        builder.table(
          [
            { header: "Content type", weight: 130 },
            { header: "Current", weight: 60, align: "right" },
            { header: "Minimum", weight: 60, align: "right" },
            { header: "Desired", weight: 60, align: "right" },
            { header: "Gap", weight: 40, align: "right" },
            { header: "Status", weight: 80 },
          ],
          goalRows.map((g) => [
            g.contentType,
            String(g.currentValidCount),
            String(g.minimumTarget),
            String(g.desiredTarget),
            String(g.gapCount),
            g.status,
          ]),
        );
      }
    }

    // ─── Section 6: Homepage Actions ───────────────────────────────────
    if (sectionsToInclude.has("Homepage Actions")) {
      builder.section("Homepage Actions");
      const drafts = await prisma.homepageWorkerDraft.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      builder.paragraph(`${drafts.length} homepage drafts (most recent first).`);
      if (drafts.length > 0) {
        builder.table(
          [
            { header: "Created", weight: 130 },
            { header: "Mode", weight: 110 },
            { header: "Status", weight: 110 },
            { header: "Conf.", weight: 50, align: "right" },
            { header: "Reason", weight: 100 },
          ],
          drafts.map((d) => [
            fmtTime(d.createdAt),
            d.mode,
            d.status,
            d.confidence.toFixed(2),
            (d.reasonSummary ?? "").slice(0, 60),
          ]),
        );
      }
    }

    // ─── Section 7: Recommended Repairs ────────────────────────────────
    if (sectionsToInclude.has("Recommended Repairs")) {
      builder.section("Recommended Repairs");
      const failed = data.diagnosticsResults.filter(
        (r) => r.status === "fail" || r.status === "warn",
      );
      if (failed.length === 0) {
        builder.paragraph("Every Admin Worker subsystem is healthy. No repairs recommended.");
      } else {
        for (const rating of failed) {
          builder.statusLine(
            rating.label,
            toReportStatus(rating.status),
            rating.recommendedRepair ?? rating.summary,
          );
        }
      }
    }

    // ─── Brain decisions + rejected alternatives (spec §15) ───────────
    if (sectionsToInclude.has("Admin Worker Brain Decisions")) {
      builder.section("Admin Worker Brain Decisions");
      if (data.brainDecisions.length === 0) {
        builder.note("No brain decisions recorded in this period.");
      } else {
        builder.table(
          [
            { header: "When", weight: 120 },
            { header: "Stage", weight: 110 },
            { header: "Type", weight: 70, align: "right" },
            { header: "Conf.", weight: 45, align: "right" },
            { header: "Reason", weight: 145 },
          ],
          data.brainDecisions
            .slice(0, 40)
            .map((d) => [
              fmtTime(d.createdAt),
              d.missionStage ?? "—",
              d.contentType ?? "—",
              d.confidence.toFixed(2),
              (d.brainExplanation ?? d.reason ?? "").slice(0, 80),
            ]),
        );
      }
    }

    // ─── Python brain diagnostics ─────────────────────────────────────
    if (sectionsToInclude.has("Python Brain Diagnostics")) {
      builder.section("Python Brain Diagnostics");
      const d = data.pythonBrainDiagnostics;
      builder.table(
        [
          { header: "Metric", weight: 220 },
          { header: "Value", weight: 200 },
        ],
        [
          ["Final decision brain", d.finalBrain],
          ["Brain calls (ok / failed)", `${d.okCalls} / ${d.failedCalls} of ${d.totalCalls}`],
          ["select_action calls", String(d.selectActionCalls)],
          ["Average latency", `${Math.round(d.avgLatencyMs)} ms`],
          ["Average confidence", `${(d.avgConfidence * 100).toFixed(0)}%`],
          ["Average risk", `${(d.avgRisk * 100).toFixed(0)}%`],
          ["Safe-to-auto-execute rate", `${(d.safeToAutoExecuteRate * 100).toFixed(0)}%`],
          ["Learning events", String(d.learningEvents)],
          ["Strategy-memory rows", String(d.strategyMemoryRows)],
          ["Degraded / rejected events", String(d.degradedEvents)],
        ],
      );
      if (d.byOp.length > 0) {
        builder.note(
          "Brain op mix: " +
            d.byOp
              .slice(0, 16)
              .map((o) => `${o.op}=${o.count}`)
              .join(", "),
        );
      }
      if (d.degradedEvents > 0) {
        builder.note(
          `⚠ PYTHON_BRAIN_UNAVAILABLE occurred ${d.degradedEvents} time(s) — safe degraded mode (no autonomous publishing).`,
        );
      }
    }

    // ─── Rejected alternatives (spec §7 + §450) ───────────────────────
    if (sectionsToInclude.has("Rejected Alternatives")) {
      builder.section("Rejected Alternatives");
      if (data.rejectedAlternatives.length === 0) {
        builder.note("No rejected alternative actions recorded in this period.");
      } else {
        builder.table(
          [
            { header: "When", weight: 120 },
            { header: "Stage", weight: 110 },
            { header: "Type", weight: 70 },
            { header: "Score", weight: 45, align: "right" },
            { header: "Rejected because", weight: 145 },
          ],
          data.rejectedAlternatives
            .slice(0, 40)
            .map((r) => [
              fmtTime(r.createdAt),
              r.missionStage,
              r.actionType,
              r.actionScore.toFixed(1),
              r.rejectedReason.slice(0, 80),
            ]),
        );
      }
    }

    // ─── Reasoning graph (spec §23-45 + §451) ─────────────────────────
    if (sectionsToInclude.has("Reasoning Graph")) {
      builder.section("Reasoning Graph");
      if (data.reasoningGraph.length === 0) {
        builder.note("No reasoning graph edges recorded in this period.");
      } else {
        builder.table(
          [
            { header: "When", weight: 110 },
            { header: "From → To", weight: 130 },
            { header: "Relation", weight: 110 },
            { header: "Why", weight: 130 },
          ],
          data.reasoningGraph
            .slice(0, 50)
            .map((e) => [
              fmtTime(e.createdAt),
              `${e.fromNodeType} → ${e.toNodeType}`,
              e.relation,
              e.explanation.slice(0, 70),
            ]),
        );
      }
    }

    // ─── Pipeline stage history (spec §15) ────────────────────────────
    if (sectionsToInclude.has("Pipeline Stage History")) {
      builder.section("Pipeline Stage History");
      if (data.pipelineStages.length === 0) {
        builder.note("No pipeline stage rows in this period.");
      } else {
        builder.table(
          [
            { header: "When", weight: 120 },
            { header: "Stage", weight: 130 },
            { header: "Status", weight: 90 },
            { header: "Type", weight: 70 },
            { header: "Failure", weight: 80 },
          ],
          data.pipelineStages
            .slice(0, 40)
            .map((s) => [
              fmtTime(s.createdAt),
              s.stageName,
              s.status,
              s.contentType ?? "—",
              (s.failureReason ?? "").slice(0, 50),
            ]),
        );
      }
    }

    // ─── Content growth funnel (spec §17) ─────────────────────────────
    if (sectionsToInclude.has("Content Growth Funnel")) {
      builder.section("Content Growth Funnel");
      if (data.contentFunnel.length === 0) {
        builder.note("No content funnel rows computed yet.");
      } else {
        builder.table(
          [
            { header: "Content type", weight: 120 },
            { header: "Cand.", weight: 50, align: "right" },
            { header: "Artifacts", weight: 60, align: "right" },
            { header: "Strict QA", weight: 60, align: "right" },
            { header: "Published", weight: 60, align: "right" },
            { header: "PostPub", weight: 55, align: "right" },
            { header: "Bottleneck", weight: 110 },
          ],
          data.contentFunnel.map((f) => [
            f.contentType,
            String(f.candidatesDiscovered),
            String(f.packageArtifactsCreated),
            String(f.strictQAPasses),
            String(f.publishedItems),
            String(f.postPublishPasses),
            f.firstEmptyStage ?? "flowing",
          ]),
        );
      }
    }

    // ─── Source coverage (spec §11 + §15) ─────────────────────────────
    if (sectionsToInclude.has("Source Coverage")) {
      builder.section("Source Coverage");
      if (data.sourceCoverage.length === 0) {
        builder.note("No source-coverage rows computed yet.");
      } else {
        builder.table(
          [
            { header: "Content type", weight: 130 },
            { header: "Score", weight: 60, align: "right" },
            { header: "Blocked?", weight: 70 },
            { header: "Reason", weight: 220 },
          ],
          data.sourceCoverage.map((c) => [
            c.contentType,
            c.coverageScore.toFixed(2),
            c.blockedByCoverage ? "BLOCKED" : "ok",
            (c.blockReason ?? "").slice(0, 90),
          ]),
        );
      }
    }

    // ─── Strict QA logs (spec §3 + §15) ───────────────────────────────
    if (sectionsToInclude.has("Strict QA Logs")) {
      builder.section("Strict QA Logs");
      if (data.strictQAResults.length === 0) {
        builder.note("No strict-QA results in this period.");
      } else {
        builder.table(
          [
            { header: "When", weight: 120 },
            { header: "Type", weight: 90 },
            { header: "Status", weight: 90 },
            { header: "Score", weight: 50, align: "right" },
            { header: "Blocking", weight: 130 },
          ],
          data.strictQAResults
            .slice(0, 40)
            .map((q) => [
              fmtTime(q.createdAt),
              q.contentType,
              q.status,
              q.finalScore.toFixed(2),
              q.blockingReasons.join("; ").slice(0, 70),
            ]),
        );
      }
    }

    // ─── Quality score logs (spec §4 + §15) ───────────────────────────
    if (sectionsToInclude.has("Quality Score Logs")) {
      builder.section("Quality Score Logs");
      if (data.qualityScores.length === 0) {
        builder.note("No ContentQualityScore rows in this period.");
      } else {
        builder.table(
          [
            { header: "When", weight: 110 },
            { header: "Content type", weight: 95 },
            { header: "Score / thr.", weight: 75, align: "right" },
            { header: "Result", weight: 55 },
            { header: "Failed dimensions", weight: 160 },
          ],
          data.qualityScores
            .slice(0, 40)
            .map((q) => [
              fmtTime(q.createdAt),
              q.contentType,
              `${q.finalScore.toFixed(2)} / ${q.threshold.toFixed(2)}`,
              q.passed ? "PASS" : "FAIL",
              q.failedDimensions.length > 0 ? q.failedDimensions.join(", ") : "—",
            ]),
        );
      }
    }

    // ─── Structured block logs (spec §1 + §15) ────────────────────────
    if (sectionsToInclude.has("Structured Block Logs")) {
      builder.section("Structured Block Logs");
      const s = data.structuredBlockStats;
      builder.paragraph(
        `${s.total} structured block(s) parsed this period; ${s.rejected} rejected as junk.`,
      );
      if (s.perType.length > 0) {
        builder.table(
          [
            { header: "Block type", weight: 200 },
            { header: "Count", weight: 80, align: "right" },
          ],
          s.perType.map((p) => [p.blockType, String(p.count)]),
        );
      }
    }

    // ─── Post-publish verification logs (spec §8 + §15) ───────────────
    if (sectionsToInclude.has("Post-Publish Verification Logs")) {
      builder.section("Post-Publish Verification Logs");
      if (data.postPublishVerifications.length === 0) {
        builder.note("No post-publish verifications in this period.");
      } else {
        builder.table(
          [
            { header: "When", weight: 120 },
            { header: "Type", weight: 90 },
            { header: "Slug", weight: 130 },
            { header: "Result", weight: 60 },
          ],
          data.postPublishVerifications
            .slice(0, 40)
            .map((v) => [fmtTime(v.createdAt), v.contentType, v.slug.slice(0, 30), v.result]),
        );
      }
    }

    // ─── Rollback ledger (rollback guarantees) ────────────────────────
    if (sectionsToInclude.has("Rollback Ledger")) {
      builder.section("Rollback Ledger");
      if (data.rollbackLedger.length === 0) {
        builder.note("No rollbacks in this period.");
      } else {
        builder.table(
          [
            { header: "When", weight: 105 },
            { header: "Type", weight: 80 },
            { header: "Slug", weight: 95 },
            { header: "Result", weight: 80 },
            { header: "Restorable", weight: 65 },
            { header: "Reason", weight: 130 },
          ],
          data.rollbackLedger
            .slice(0, 40)
            .map((r) => [
              fmtTime(r.createdAt),
              r.contentType ?? "—",
              (r.slug ?? "—").slice(0, 24),
              r.rollbackResult,
              r.restorable ? "yes" : "no",
              (r.failedVerificationReason ?? r.rollbackAction).slice(0, 40),
            ]),
        );
      }
    }

    // ─── Repair logs (spec §9 + §15) ──────────────────────────────────
    if (sectionsToInclude.has("Repair Logs")) {
      builder.section("Repair Logs");
      if (data.repairPlans.length === 0) {
        builder.note("No repair plans in this period.");
      } else {
        builder.table(
          [
            { header: "When", weight: 110 },
            { header: "Kind", weight: 150 },
            { header: "Status", weight: 80 },
            { header: "Att.", weight: 45, align: "right" },
            { header: "Result", weight: 110 },
          ],
          data.repairPlans
            .slice(0, 40)
            .map((p) => [
              fmtTime(p.createdAt),
              p.kind,
              p.status,
              `${p.attempts}/${p.maxAttempts}`,
              (p.finalResult ?? "").slice(0, 50),
            ]),
        );
      }
    }

    // ─── Source reputation changes (spec §10 + §15) ───────────────────
    if (sectionsToInclude.has("Source Reputation Changes")) {
      builder.section("Source Reputation Changes");
      if (data.sourceReputation.length === 0) {
        builder.note("No source reputation rows.");
      } else {
        builder.table(
          [
            { header: "Host", weight: 150 },
            { header: "Tier", weight: 80 },
            { header: "Publish", weight: 60, align: "right" },
            { header: "QA", weight: 50, align: "right" },
            { header: "Paused", weight: 60 },
          ],
          data.sourceReputation
            .slice(0, 40)
            .map((r) => [
              r.sourceHost.slice(0, 28),
              r.reputationTier,
              r.publicPublishRate.toFixed(2),
              r.qaPassRate.toFixed(2),
              r.paused ? "yes" : "no",
            ]),
        );
      }
    }

    // ─── Memory changes (spec §10 + §15) ──────────────────────────────
    if (sectionsToInclude.has("Memory Changes")) {
      builder.section("Memory Changes");
      if (data.recentMemory.length === 0) {
        builder.note("No memory rows recorded.");
      } else {
        builder.table(
          [
            { header: "Type", weight: 140 },
            { header: "Key", weight: 150 },
            { header: "Conf.", weight: 50, align: "right" },
            { header: "OK/Fail", weight: 70, align: "right" },
          ],
          data.recentMemory
            .slice(0, 40)
            .map((m) => [
              m.memoryType,
              m.memoryKey.slice(0, 28),
              m.confidence.toFixed(2),
              `${m.successCount}/${m.failureCount}`,
            ]),
        );
      }
    }

    // ─── Why No Content Growth (spec §14 + §15) ───────────────────────
    if (sectionsToInclude.has("Why No Content Growth")) {
      builder.section("Why No Content Growth");
      const w = data.whyNoGrowth;
      if (!w) {
        builder.note("Why-No-Growth diagnostic unavailable for this period.");
      } else {
        builder.keyValue([
          { label: "Blocker", value: w.blocker },
          { label: "Explanation", value: w.blockerExplanation },
          { label: "Exact table", value: w.exactTable || "—" },
          { label: "Next automatic repair", value: w.nextAutomaticRepair ?? "—" },
          { label: "Next worker decision", value: w.nextWorkerDecision },
        ]);
        if (w.checks.length > 0) {
          builder.subsection("Chain walk");
          builder.table(
            [
              { header: "Stage", weight: 180 },
              { header: "OK?", weight: 50 },
              { header: "Count", weight: 50, align: "right" },
              { header: "Detail", weight: 140 },
            ],
            w.checks.map((c) => [
              c.stage,
              c.ok ? "ok" : "BLOCK",
              String(c.count),
              c.detail.slice(0, 60),
            ]),
          );
        }
      }
    }

    // ─── Current blockers (spec §15) ──────────────────────────────────
    if (sectionsToInclude.has("Current Blockers")) {
      builder.section("Current Blockers");
      if (data.currentBlockers.length === 0) {
        builder.paragraph("No current blockers — the chain is unobstructed.");
      } else {
        for (const b of data.currentBlockers.slice(0, 20)) builder.note(b);
      }
    }

    // ─── Per-stage pipeline logs (every artifact-chain stage) ─────────
    // The worker records each stage as an AdminWorkerLog; render one section
    // per declared stage so the full chain is auditable for the period. Shared
    // categories (SOURCE_READING, CONTENT_BUILD, POST_PUBLISH) split by event.
    if (has("Discovery Logs"))
      renderLogs("Discovery Logs", inCat("SOURCE_DISCOVERY"), "No discovery logs in this period.");
    if (has("Fetch Logs"))
      renderLogs(
        "Fetch Logs",
        data.workerLogs.filter(
          (l) => l.category === "SOURCE_READING" && /^fetch/.test(l.eventName),
        ),
        "No fetch logs in this period.",
      );
    if (has("Source Read Logs"))
      renderLogs(
        "Source Read Logs",
        data.workerLogs.filter(
          (l) => l.category === "SOURCE_READING" && !/^fetch/.test(l.eventName),
        ),
        "No source-read logs in this period.",
      );
    if (has("Classification Logs"))
      renderLogs(
        "Classification Logs",
        inCat("CONTENT_CLASSIFICATION"),
        "No classification logs in this period.",
      );
    if (has("Extraction Logs"))
      renderLogs(
        "Extraction Logs",
        data.workerLogs.filter(
          (l) => l.category === "CONTENT_BUILD" && /extract/i.test(l.eventName),
        ),
        "No extraction logs in this period.",
      );
    if (has("Package Artifact Logs"))
      renderLogs(
        "Package Artifact Logs",
        data.workerLogs.filter(
          (l) =>
            l.category === "CONTENT_BUILD" && /(package|artifact|build_from)/i.test(l.eventName),
        ),
        "No package-artifact logs in this period.",
      );
    if (has("Checklist and Citation Logs"))
      renderLogs(
        "Checklist and Citation Logs",
        data.workerLogs.filter(
          (l) => l.category === "CONTENT_BUILD" && /(checklist|citation)/i.test(l.eventName),
        ),
        "No checklist/citation logs in this period.",
      );
    if (has("Verification Logs"))
      renderLogs("Verification Logs", inCat("VALIDATION"), "No verification logs in this period.");
    if (has("QA Logs")) renderLogs("QA Logs", inCat("QA"), "No QA logs in this period.");
    if (has("Publishing Logs"))
      renderLogs("Publishing Logs", inCat("PUBLISHING"), "No publishing logs in this period.");
    if (has("Search and Sitemap Logs"))
      renderLogs(
        "Search and Sitemap Logs",
        data.workerLogs.filter(
          (l) => l.category === "POST_PUBLISH" && /(search|sitemap)/i.test(l.eventName),
        ),
        "No search/sitemap logs in this period.",
      );
    if (has("Cache Logs"))
      renderLogs(
        "Cache Logs",
        data.workerLogs.filter((l) => l.category === "POST_PUBLISH" && /cache/i.test(l.eventName)),
        "No cache logs in this period.",
      );
    if (has("Homepage Logs"))
      renderLogs("Homepage Logs", inCat("HOMEPAGE"), "No homepage logs in this period.");

    // ─── Content Goal Progress ────────────────────────────────────────
    if (has("Content Goal Progress")) {
      builder.section("Content Goal Progress");
      if (data.contentGoals.length === 0) {
        builder.note("No content goals seeded.");
      } else {
        builder.table(
          [
            { header: "Content type", weight: 150 },
            { header: "Have / Target", weight: 110, align: "right" },
            { header: "Hard max", weight: 70, align: "right" },
            { header: "Gap", weight: 70, align: "right" },
            { header: "Status", weight: 100 },
          ],
          data.contentGoals.map((g) => [
            g.contentType,
            `${g.currentValidCount} / ${g.desiredTarget}`,
            g.canonicalMax == null ? "—" : String(g.canonicalMax),
            String(g.gapCount),
            g.status,
          ]),
        );
      }
    }

    // ─── Mission Plans (the brain's chosen mission each pass) ──────────
    if (has("Mission Plans")) {
      builder.section("Mission Plans");
      if (data.brainDecisions.length === 0) {
        builder.note("No mission plans (brain decisions) in this period.");
      } else {
        builder.table(
          [
            { header: "When", weight: 120 },
            { header: "Mission stage", weight: 130 },
            { header: "Type", weight: 80 },
            { header: "Reason", weight: 130 },
          ],
          data.brainDecisions
            .slice(0, 50)
            .map((d) => [
              fmtTime(d.createdAt),
              d.missionStage ?? "—",
              d.contentType ?? "—",
              (d.reason ?? "").slice(0, 70),
            ]),
        );
      }
    }

    // ─── Intelligence Laboratory (spec: "the Developer Audit report should
    //     include a major Intelligence Laboratory section"): causal/root-cause,
    //     proof packets, hypotheses, strategy tournaments, benchmarks + brain
    //     versions, capability proposals, adversarial weaknesses, architecture
    //     integrity, and the single highest-leverage next change. Everything here
    //     is advisory + review-gated — the lab reasons, proves, benchmarks, and
    //     ranks, but never deploys code, mutates schema, or publishes. ──────────
    if (has("Intelligence Laboratory")) {
      const lab = data.intelligenceLab;
      builder.section("Intelligence Laboratory");
      builder.paragraph(
        "The unified brain's causal + experimental self-evaluation. Every finding " +
          "here is advisory and review-gated: humans approve code, schema, and " +
          "production changes — the lab only recommends.",
      );
      builder.keyValue([
        {
          label: "Highest-leverage next change",
          value: lab.highestLeverage ?? "— (awaiting next lab pass)",
        },
        {
          label: "Architecture integrity",
          value:
            lab.latestArchitectureIntegrity == null
              ? "not yet evaluated"
              : `${(lab.latestArchitectureIntegrity * 100).toFixed(0)}% · ` +
                `${lab.architectureReports.length} report(s)`,
        },
        { label: "Proof packets on record", value: String(lab.proofPackets.length) },
        { label: "Failed proofs", value: String(lab.failedProofCount) },
        { label: "Active hypotheses", value: String(lab.hypotheses.length) },
        {
          label: "Capability proposals (review-gated)",
          value: String(lab.capabilityProposals.length),
        },
        {
          label: "Adversarial weaknesses",
          value: String(lab.adversarialCases.filter((a) => !a.held).length),
        },
        { label: "Ontology gaps", value: String(lab.ontologyGaps) },
      ]);

      builder.subsection("Architecture integrity");
      if (lab.architectureReports.length === 0) {
        builder.note("No architecture-integrity reports recorded yet.");
      } else {
        for (const r of lab.architectureReports.slice(0, 10)) {
          builder.statusLine(
            r.clean ? "clean" : "violations present",
            r.clean ? "pass" : "warn",
            `${(r.integrity * 100).toFixed(0)}% · ${fmtTime(r.createdAt)}`,
          );
        }
      }

      builder.subsection("Proof packets (sensitive-content publishing)");
      builder.paragraph(`${lab.failedProofCount} failed proof(s) on record.`);
      if (lab.proofPackets.length === 0) {
        builder.note("No proof packets recorded yet.");
      } else {
        builder.table(
          [
            { header: "When", weight: 110 },
            { header: "Content type", weight: 110 },
            { header: "Action", weight: 70 },
            { header: "Proven", weight: 60 },
            { header: "Risk", weight: 60 },
          ],
          lab.proofPackets
            .slice(0, 20)
            .map((p) => [
              fmtTime(p.createdAt),
              p.contentType ?? "—",
              p.recommendedAction ?? "?",
              p.proven ? "yes" : "no",
              p.riskLevel,
            ]),
        );
      }

      builder.subsection("Active hypotheses");
      if (lab.hypotheses.length === 0) {
        builder.note("No hypotheses recorded yet.");
      } else {
        builder.table(
          [
            { header: "Statement", weight: 250 },
            { header: "Status", weight: 90 },
            { header: "Conf", weight: 50, align: "right" },
          ],
          lab.hypotheses
            .slice(0, 15)
            .map((h) => [h.statement.slice(0, 80), h.status, h.confidence.toFixed(2)]),
        );
      }

      builder.subsection("Strategy tournaments");
      if (lab.strategyTournaments.length === 0) {
        builder.note("No strategy tournaments recorded yet.");
      } else {
        for (const t of lab.strategyTournaments.slice(0, 10)) {
          builder.paragraph(
            `Winner: ${t.winner ?? "—"} (margin ${t.margin.toFixed(3)}) · ${fmtTime(t.createdAt)}`,
          );
        }
      }

      builder.subsection("Benchmark + brain versions");
      if (lab.benchmarkRuns.length === 0 && lab.brainVersions.length === 0) {
        builder.note("No benchmark runs or brain-version scores recorded yet.");
      } else {
        for (const b of lab.benchmarkRuns.slice(0, 10)) {
          builder.statusLine(
            `benchmark ${b.overall.toFixed(3)}${b.regression ? " — REGRESSION" : ""}`,
            b.regression ? "warn" : "pass",
            b.brainVersion ?? fmtTime(b.createdAt),
          );
        }
        for (const v of lab.brainVersions.slice(0, 10)) {
          builder.paragraph(`version ${v.version}: score ${v.score.toFixed(3)}`);
        }
      }

      builder.subsection("Capability proposals (review-gated)");
      if (lab.capabilityProposals.length === 0) {
        builder.note("No capability proposals recorded yet.");
      } else {
        builder.table(
          [
            { header: "Capability", weight: 210 },
            { header: "Status", weight: 90 },
            { header: "Risk", weight: 50, align: "right" },
          ],
          lab.capabilityProposals
            .slice(0, 15)
            .map((c) => [c.name.slice(0, 70), c.status, c.risk.toFixed(2)]),
        );
      }

      builder.subsection("Adversarial self-testing");
      if (lab.adversarialCases.length === 0) {
        builder.note("No adversarial cases recorded yet.");
      } else {
        for (const a of lab.adversarialCases.slice(0, 15)) {
          builder.statusLine(
            `${a.name} (${a.targetGate ?? "—"})`,
            a.held ? "pass" : "fail",
            a.held ? "held" : "WEAKNESS — regression test requested",
          );
        }
      }

      builder.subsection("Other lab surfaces");
      builder.keyValue([
        { label: "Counterfactual runs", value: String(lab.counterfactualRuns.length) },
        { label: "Experiments", value: String(lab.experimentPlans.length) },
        { label: "Digital-twin runs", value: String(lab.digitalTwinRuns.length) },
        { label: "Curriculum runs", value: String(lab.curriculumRuns.length) },
        { label: "Logic-rule failures", value: String(lab.logicRuleFailures.length) },
      ]);
      const claimEntries = Object.entries(lab.claimsByStatus);
      if (claimEntries.length > 0) {
        builder.paragraph(
          "Claim epistemic statuses: " + claimEntries.map(([s, n]) => `${s} ${n}`).join(", "),
        );
      }
      if (lab.logicRuleFailures.length > 0) {
        builder.paragraph(
          "Failing logic rules: " +
            lab.logicRuleFailures
              .slice(0, 10)
              .map((r) => r.ruleId)
              .join(", "),
        );
      }
      if (lab.digitalTwinRuns.some((d) => d.touchesProduction)) {
        builder.note(
          "A digital-twin run reported touching production — investigate (the twin must stay isolated).",
        );
      }
    }

    // ─── Worker Requests (spec: the "worker request section" at the END of
    //     the report — what the worker believes it needs to be better, smarter,
    //     and more capable). Generated by the brain's self-inspection +
    //     schema/UI/code awareness. Each is a recommendation; code/schema
    //     changes require human review. ──────────────────────────────────────
    if (sectionsToInclude.has("Worker Requests")) {
      builder.section("Worker Requests");
      builder.paragraph(
        "What the Admin Worker believes it needs from the developer to do its job " +
          "better. These are the worker's own self-aware requests (parser, schema, " +
          "source, UI, safety, capability, and code/refactor needs), surfaced from " +
          "its self-inspection and schema/UI/code awareness.",
      );
      const workerRequests = data.workerRequests ?? [];
      if (workerRequests.length === 0) {
        builder.note("No open worker requests — the worker is not currently blocked.");
      } else {
        builder.table(
          [
            { header: "Kind", weight: 70 },
            { header: "Severity", weight: 60 },
            { header: "×", weight: 28, align: "right" },
            { header: "Request", weight: 262 },
          ],
          workerRequests.map((r) => [
            r.kind,
            r.severity,
            String(r.occurrences),
            `${r.title} — ${r.detail}`.slice(0, 160),
          ]),
        );
      }
    }

    const pdf = builder.build();
    await prisma.adminDeveloperReportLog.update({
      where: { id: logRow.id },
      data: {
        status: "GENERATED",
        fileSize: pdf.length,
      },
    });

    return { pdf, reportLogId: logRow.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.adminDeveloperReportLog.update({
      where: { id: logRow.id },
      data: { status: "FAILED", errorMessage: message.slice(0, 500) },
    });
    throw err;
  }
}

/**
 * Generate the Monthly Admin Worker Report PDF. Daily sections cover
 * each calendar day in the chosen window; a monthly summary closes
 * the report.
 */
export async function generateMonthlyAdminWorkerReportPdf(
  prisma: PrismaClient,
  monthStart: Date,
  monthEnd: Date,
): Promise<Buffer> {
  const passes = await prisma.adminWorkerPass.findMany({
    where: { startedAt: { gte: monthStart, lte: monthEnd } },
    orderBy: { startedAt: "asc" },
  });
  const logs = await prisma.adminWorkerLog.findMany({
    where: { createdAt: { gte: monthStart, lte: monthEnd } },
    orderBy: { createdAt: "asc" },
  });
  const homepageDrafts = await prisma.homepageWorkerDraft.count({
    where: { createdAt: { gte: monthStart, lte: monthEnd } },
  });
  const security = await prisma.adminWorkerSecurityAction.count({
    where: { createdAt: { gte: monthStart, lte: monthEnd } },
  });
  const goals = await prisma.contentGoal.findMany({ orderBy: [{ priority: "asc" }] });
  const reputations = await prisma.adminWorkerSourceReputation.findMany();

  const builder = new ReportBuilder({
    reportTitle: "Admin Worker Monthly Report",
    period: `${monthStart.toISOString().slice(0, 10)} – ${monthEnd.toISOString().slice(0, 10)}`,
    generatedAt: new Date().toISOString(),
    environment: process.env.NODE_ENV ?? "development",
    appName: "Via Fidei · Admin Worker",
    dashboardSection: "Monthly report",
    reportVersion: "admin-worker/0.2",
  });

  // Monthly summary.
  builder.section("Monthly Summary");
  const totals = passes.reduce(
    (acc, p) => ({
      built: acc.built + p.contentBuilt,
      published: acc.published + p.contentPublished,
      rejected: acc.rejected + p.contentRejected,
      failures: acc.failures + (p.status === "FAILED" ? 1 : 0),
      total: acc.total + 1,
    }),
    { built: 0, published: 0, rejected: 0, failures: 0, total: 0 },
  );
  const uptime = totals.total === 0 ? 0 : 1 - totals.failures / totals.total;
  builder.keyValue([
    { label: "Total content built", value: String(totals.built) },
    { label: "Total content published", value: String(totals.published) },
    { label: "Total content rejected", value: String(totals.rejected) },
    { label: "Total passes", value: String(totals.total) },
    { label: "Worker failures", value: String(totals.failures) },
    { label: "Worker uptime", value: `${Math.round(uptime * 100)}%` },
    { label: "Homepage changes", value: String(homepageDrafts) },
    { label: "Security actions", value: String(security) },
    { label: "Total sources tracked", value: String(reputations.length) },
  ]);

  // Best / worst sources.
  if (reputations.length > 0) {
    const best = [...reputations]
      .sort((a, b) => b.publicPublishRate - a.publicPublishRate)
      .slice(0, 5);
    const worst = [...reputations]
      .sort((a, b) => b.wrongContentRate - a.wrongContentRate)
      .slice(0, 5);
    builder.subsection("Best sources (by public publish rate)");
    builder.table(
      [
        { header: "Host", weight: 200 },
        { header: "Publish rate", weight: 90, align: "right" },
        { header: "QA pass rate", weight: 90, align: "right" },
        { header: "Tier", weight: 70 },
      ],
      best.map((b) => [
        b.sourceHost,
        b.publicPublishRate.toFixed(2),
        b.qaPassRate.toFixed(2),
        b.reputationTier,
      ]),
    );
    builder.subsection("Worst sources (by wrong-content rate)");
    builder.table(
      [
        { header: "Host", weight: 200 },
        { header: "Wrong-content rate", weight: 110, align: "right" },
        { header: "Tier", weight: 70 },
      ],
      worst.map((w) => [w.sourceHost, w.wrongContentRate.toFixed(2), w.reputationTier]),
    );
  }

  // Content goal progress.
  if (goals.length > 0) {
    builder.subsection("Content goal progress");
    builder.table(
      [
        { header: "Content type", weight: 130 },
        { header: "Current", weight: 60, align: "right" },
        { header: "Minimum", weight: 60, align: "right" },
        { header: "Gap", weight: 50, align: "right" },
        { header: "Status", weight: 80 },
      ],
      goals.map((g) => [
        g.contentType,
        String(g.currentValidCount),
        String(g.minimumTarget),
        String(g.gapCount),
        g.status,
      ]),
    );
  }

  // Daily sections.
  builder.section("Daily breakdown");
  const passesByDay = groupByDay(passes, (p) => p.startedAt);
  const logsByDay = groupByDay(logs, (l) => l.createdAt);

  for (const day of enumerateDays(monthStart, monthEnd)) {
    const dayKey = day.toISOString().slice(0, 10);
    const dayPasses = passesByDay.get(dayKey) ?? [];
    const dayLogs = logsByDay.get(dayKey) ?? [];
    const errors = dayLogs.filter(
      (l) => l.severity === "ERROR" || l.severity === "CRITICAL",
    ).length;
    const warnings = dayLogs.filter((l) => l.severity === "WARN").length;
    const repairs = dayLogs.filter((l) => l.category === "REPAIR").length;
    const securityToday = dayLogs.filter((l) => l.category === "SECURITY").length;
    const built = dayPasses.reduce((s, p) => s + p.contentBuilt, 0);
    const published = dayPasses.reduce((s, p) => s + p.contentPublished, 0);
    const rejected = dayPasses.reduce((s, p) => s + p.contentRejected, 0);
    const homepageActions = dayPasses.reduce((s, p) => s + p.homepageActions, 0);
    const failures = dayPasses.filter((p) => p.status === "FAILED").length;
    const blockers = dayPasses
      .filter((p) => p.errorMessage)
      .map((p) => p.errorMessage)
      .slice(0, 3);

    builder.subsection(dayKey);
    builder.keyValue([
      { label: "Passes completed", value: String(dayPasses.length) },
      { label: "Worker health", value: failures === 0 ? "healthy" : `${failures} failures` },
      { label: "Content built", value: String(built) },
      { label: "Content published", value: String(published) },
      { label: "Content rejected", value: String(rejected) },
      { label: "Homepage actions", value: String(homepageActions) },
      { label: "Security events", value: String(securityToday) },
      { label: "Errors", value: String(errors) },
      { label: "Warnings", value: String(warnings) },
      { label: "Repairs attempted", value: String(repairs) },
      {
        label: "Current blockers",
        value: blockers.length === 0 ? "none" : blockers.join("; ").slice(0, 200),
      },
    ]);
  }

  // Pass through redaction one more time on logs before rendering.
  builder.section("Recent log entries");
  const recentLogs = logs.slice(-200);
  if (recentLogs.length === 0) {
    builder.note("No log entries in this period.");
  } else {
    for (const log of recentLogs) {
      builder.paragraph(
        redactString(
          `[${log.createdAt.toISOString()}] ${log.severity} ${log.category} ` +
            `${log.eventName}: ${JSON.stringify(redactSecrets(log.safeMetadata ?? {}))}`,
        ),
      );
    }
  }

  return builder.build();
}

function groupByDay<T>(items: ReadonlyArray<T>, getDate: (x: T) => Date): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = getDate(item).toISOString().slice(0, 10);
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }
  return map;
}

function* enumerateDays(start: Date, end: Date): Iterable<Date> {
  const cursor = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()),
  );
  const stop = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  while (cursor.getTime() <= stop.getTime()) {
    yield new Date(cursor);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
}
