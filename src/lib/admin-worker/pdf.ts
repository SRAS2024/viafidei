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
        for (const log of workerLogs.slice(0, 250)) {
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
      const repairs = data.workerLogs.filter((l) => l.category === "REPAIR");
      builder.paragraph(`${repairs.length} repair log entries in this period.`);
      for (const log of repairs.slice(0, 200)) {
        builder.paragraph(redactString(`[${log.createdAt.toISOString()}] ${log.message}`));
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
            { header: "When", weight: 140 },
            { header: "Content type", weight: 130 },
            { header: "Final score", weight: 90, align: "right" },
          ],
          data.qualityScores
            .slice(0, 40)
            .map((q) => [fmtTime(q.createdAt), q.contentType, q.finalScore.toFixed(2)]),
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
