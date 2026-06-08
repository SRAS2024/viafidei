/**
 * Developer Audit — downloadable PDF report.
 *
 * Bundles, for a selected period (24h / 7d / 30d):
 *   - Diagnostic results (current snapshot).
 *   - Worker build logs in the period.
 *   - QA reports in the period.
 *   - Recent admin actions and security events.
 *   - Curated knowledge base size, checklist seed counts.
 *
 * Generated with pdfkit (server-side) and streamed back as a PDF response.
 */

import PDFDocument from "pdfkit";

import { prisma } from "@/lib/db/client";
import { curatedKnowledgeByType, curatedKnowledgeSize, totalChecklistItems } from "@/lib/checklist";
import { runAllDiagnostics, type DiagnosticResult } from "./index";

export type AuditPeriod = "24h" | "week" | "month";

const PERIOD_MS: Record<AuditPeriod, number> = {
  "24h": 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
};

export function periodLabel(period: AuditPeriod): string {
  switch (period) {
    case "24h":
      return "the last 24 hours";
    case "week":
      return "the last 7 days";
    case "month":
      return "the last 30 days";
  }
}

interface AuditData {
  period: AuditPeriod;
  generatedAt: Date;
  diagnostics: DiagnosticResult[];
  buildLogs: Array<{
    id: string;
    createdAt: Date;
    step: string;
    level: string;
    message: string;
    fieldName: string | null;
    sourceUrl: string | null;
    confidence: number | null;
  }>;
  qaReports: Array<{
    id: string;
    createdAt: Date;
    passed: boolean;
    overallScore: number;
    recommendation: string;
    needsHumanReview: boolean;
    title: string;
    contentType: string;
  }>;
  publishedSummary: { total: number; recent: number };
  checklistSummary: { total: number; published: number; qaPending: number; failed: number };
  knowledgeSummary: { total: number; byType: Record<string, number> };
  recentBuilds: Array<{
    id: string;
    createdAt: Date;
    status: string;
    title: string;
    contentType: string;
  }>;
  intelligence: IntelligenceAudit;
}

/** The unified-brain audit section (spec: "developer audit intelligence section"). */
interface IntelligenceAudit {
  brainCalls: number;
  brainOkRate: number;
  avgConfidence: number;
  topOps: Array<{ op: string; count: number; avgConfidence: number }>;
  iqIndex: number | null;
  openRequests: Array<{
    kind: string;
    title: string;
    severity: string;
    occurrences: number;
    source: string | null;
  }>;
  selfModel: {
    fileCount: number;
    coverage: number;
    weak: number;
    untested: number;
    topUpgrades: string[];
  } | null;
  missionNext: string | null;
  stuck: { signals: string[]; strategy: string } | null;
}

/** Best-effort intelligence snapshot for the audit (all queries guarded). */
async function collectIntelligence(since: Date): Promise<IntelligenceAudit> {
  const [calls, okCalls, confAgg, byOp, requests, intelLog, selfLog, missionLog, stuckLog] =
    await Promise.all([
      prisma.adminWorkerBrainCall.count({ where: { createdAt: { gte: since } } }).catch(() => 0),
      prisma.adminWorkerBrainCall
        .count({ where: { createdAt: { gte: since }, ok: true } })
        .catch(() => 0),
      prisma.adminWorkerBrainCall
        .aggregate({ where: { createdAt: { gte: since } }, _avg: { confidence: true } })
        .catch(() => ({ _avg: { confidence: null } })),
      prisma.adminWorkerBrainCall
        .groupBy({
          by: ["op"],
          where: { createdAt: { gte: since } },
          _count: { _all: true },
          _avg: { confidence: true },
        })
        .catch(
          () =>
            [] as Array<{
              op: string;
              _count: { _all: number };
              _avg: { confidence: number | null };
            }>,
        ),
      prisma.adminWorkerDeveloperRequest
        .findMany({
          where: { status: "OPEN" },
          orderBy: [{ severity: "desc" }, { occurrences: "desc" }, { updatedAt: "desc" }],
          take: 30,
          select: { kind: true, title: true, severity: true, occurrences: true, source: true },
        })
        .catch(() => []),
      prisma.adminWorkerLog
        .findFirst({
          where: { eventName: "intelligence_pass" },
          orderBy: { createdAt: "desc" },
          select: { safeMetadata: true },
        })
        .catch(() => null),
      prisma.adminWorkerLog
        .findFirst({
          where: { eventName: "self_model_built" },
          orderBy: { createdAt: "desc" },
          select: { safeMetadata: true },
        })
        .catch(() => null),
      prisma.adminWorkerLog
        .findFirst({
          where: { eventName: "mission_control" },
          orderBy: { createdAt: "desc" },
          select: { safeMetadata: true },
        })
        .catch(() => null),
      prisma.adminWorkerLog
        .findFirst({
          where: { eventName: "worker_stuck", createdAt: { gte: since } },
          orderBy: { createdAt: "desc" },
          select: { safeMetadata: true },
        })
        .catch(() => null),
    ]);

  const iqMeta = (intelLog?.safeMetadata ?? null) as { iqIndex?: number | null } | null;
  const sm = (selfLog?.safeMetadata ?? null) as {
    model?: { file_count?: number };
    coverage_ratio?: number;
    weak_count?: number;
    untested_count?: number;
    top_upgrades?: string[];
  } | null;
  const mission = (missionLog?.safeMetadata ?? null) as { next_action?: string | null } | null;
  const stuck = (stuckLog?.safeMetadata ?? null) as {
    signals?: string[];
    strategy?: string;
  } | null;

  return {
    brainCalls: calls,
    brainOkRate: calls > 0 ? okCalls / calls : 0,
    avgConfidence: confAgg._avg.confidence ?? 0,
    topOps: byOp
      .slice()
      .sort((a, b) => b._count._all - a._count._all)
      .slice(0, 12)
      .map((o) => ({ op: o.op, count: o._count._all, avgConfidence: o._avg.confidence ?? 0 })),
    iqIndex: iqMeta?.iqIndex ?? null,
    openRequests: requests,
    selfModel: sm
      ? {
          fileCount: sm.model?.file_count ?? 0,
          coverage: sm.coverage_ratio ?? 0,
          weak: sm.weak_count ?? 0,
          untested: sm.untested_count ?? 0,
          topUpgrades: sm.top_upgrades ?? [],
        }
      : null,
    missionNext: mission?.next_action ?? null,
    stuck: stuck?.signals?.length
      ? { signals: stuck.signals, strategy: stuck.strategy ?? "" }
      : null,
  };
}

async function collectAuditData(period: AuditPeriod): Promise<AuditData> {
  const since = new Date(Date.now() - PERIOD_MS[period]);
  const [
    diagnostics,
    buildLogs,
    qaReports,
    publishedTotal,
    publishedRecent,
    checklistTotal,
    checklistPublished,
    checklistQaPending,
    checklistFailed,
    recentBuilds,
  ] = await Promise.all([
    runAllDiagnostics(),
    prisma.adminWorkerLog.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 500,
      select: {
        id: true,
        createdAt: true,
        eventName: true,
        severity: true,
        message: true,
        contentType: true,
        sourceUrl: true,
      },
    }),
    prisma.adminWorkerStrictQAResult.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        createdAt: true,
        status: true,
        finalScore: true,
        contentType: true,
      },
    }),
    prisma.publishedContent.count({ where: { isPublished: true } }),
    prisma.publishedContent.count({
      where: { isPublished: true, publishedAt: { gte: since } },
    }),
    prisma.checklistItem.count(),
    prisma.checklistItem.count({ where: { approvalStatus: "PUBLISHED" } }),
    prisma.checklistItem.count({ where: { approvalStatus: "QA_PENDING" } }),
    prisma.workerBuildJob.count({ where: { status: "failed" } }),
    prisma.workerBuildJob.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        checklistItem: { select: { canonicalName: true, contentType: true } },
      },
    }),
  ]);

  return {
    period,
    generatedAt: new Date(),
    diagnostics,
    buildLogs: buildLogs.map((l) => ({
      id: l.id,
      createdAt: l.createdAt,
      step: l.eventName,
      level: l.severity,
      message: l.message,
      fieldName: l.contentType,
      sourceUrl: l.sourceUrl,
      confidence: null,
    })),
    qaReports: qaReports.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      passed: r.status === "PASSED",
      overallScore: r.finalScore,
      recommendation: r.status,
      needsHumanReview: r.status === "NEEDS_REPAIR",
      title: r.contentType,
      contentType: r.contentType,
    })),
    publishedSummary: { total: publishedTotal, recent: publishedRecent },
    checklistSummary: {
      total: checklistTotal,
      published: checklistPublished,
      qaPending: checklistQaPending,
      failed: checklistFailed,
    },
    knowledgeSummary: {
      total: curatedKnowledgeSize(),
      byType: curatedKnowledgeByType() as Record<string, number>,
    },
    recentBuilds: recentBuilds.map((b) => ({
      id: b.id,
      createdAt: b.createdAt,
      status: b.status,
      title: b.checklistItem.canonicalName,
      contentType: b.checklistItem.contentType,
    })),
    intelligence: await collectIntelligence(since),
  };
}

const FONT_TITLE = "Helvetica-Bold";
const FONT_BODY = "Helvetica";

function statusColor(status: "pass" | "warn" | "fail"): string {
  return status === "pass" ? "#16803c" : status === "warn" ? "#a86b00" : "#a8000c";
}

/**
 * Generates the audit PDF and returns it as a Node Buffer.
 */
export async function generateDeveloperAuditPdf(period: AuditPeriod): Promise<Buffer> {
  const data = await collectAuditData(period);

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: "LETTER",
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      info: {
        Title: "Via Fidei Developer Audit",
        Author: "Via Fidei worker",
        Subject: `Developer audit — ${periodLabel(period)}`,
        CreationDate: data.generatedAt,
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // ----- Cover --------------------------------------------------------
    doc.font(FONT_TITLE).fontSize(22).fillColor("#1a1a1a");
    doc.text("Via Fidei", { align: "center" });
    doc.fontSize(14).fillColor("#444");
    doc.text("Developer Audit Report", { align: "center" });
    doc.moveDown();
    doc.font(FONT_BODY).fontSize(10).fillColor("#666");
    doc.text(`Period: ${periodLabel(data.period)}`, { align: "center" });
    doc.text(`Generated: ${data.generatedAt.toISOString()}`, { align: "center" });
    doc.moveDown(2);

    // ----- Overview -----------------------------------------------------
    doc.font(FONT_TITLE).fontSize(14).fillColor("#1a1a1a");
    doc.text("System overview");
    doc.font(FONT_BODY).fontSize(10).fillColor("#222");
    doc.moveDown(0.5);
    doc.text(
      `Checklist items: ${data.checklistSummary.total} (${data.checklistSummary.published} published, ${data.checklistSummary.qaPending} QA pending, ${data.checklistSummary.failed} failed builds)`,
    );
    doc.text(`Published content live on the site: ${data.publishedSummary.total}`);
    doc.text(`Published in this period: ${data.publishedSummary.recent}`);
    doc.text(`Curated knowledge entries available to the worker: ${data.knowledgeSummary.total}`);
    doc.text(`Checklist seed total: ${totalChecklistItems()} items across 11 content types.`);
    doc.moveDown();

    // ----- Intelligence (the unified brain) -----------------------------
    const intel = data.intelligence;
    doc.font(FONT_TITLE).fontSize(14).fillColor("#1a1a1a");
    doc.text("Intelligence (the unified brain)");
    doc.font(FONT_BODY).fontSize(10).fillColor("#222");
    doc.moveDown(0.3);
    doc.text(
      `Brain decisions in this period: ${intel.brainCalls} ` +
        `(${(intel.brainOkRate * 100).toFixed(0)}% ok, avg confidence ${(intel.avgConfidence * 100).toFixed(0)}%)` +
        `${intel.iqIndex != null ? ` · Worker IQ index ${intel.iqIndex}` : ""}`,
    );
    if (intel.selfModel) {
      const sm = intel.selfModel;
      doc.text(
        `Self-model: ${sm.fileCount} files · test coverage ${(sm.coverage * 100).toFixed(0)}% · ` +
          `${sm.weak} weak module(s) · ${sm.untested} untested module(s).`,
      );
    } else {
      doc.fillColor("#666").text("Self-model: not built yet.").fillColor("#222");
    }
    if (intel.missionNext) doc.text(`Next mission action: ${intel.missionNext}`);
    if (intel.stuck) {
      doc
        .fillColor("#a86b00")
        .text(
          `Stuckness: ${intel.stuck.signals.slice(0, 2).join("; ")}` +
            `${intel.stuck.strategy ? ` → ${intel.stuck.strategy}` : ""}`,
        );
      doc.fillColor("#222");
    }
    doc.moveDown(0.4);

    // Operation mix (which brain capabilities were exercised).
    doc.font(FONT_TITLE).fontSize(11).fillColor("#1a1a1a").text("Brain operation mix");
    doc.font(FONT_BODY).fontSize(9).fillColor("#222").moveDown(0.2);
    if (intel.topOps.length === 0) {
      doc.fillColor("#666").text("(no brain calls in this period)").fillColor("#222");
    } else {
      for (const o of intel.topOps) {
        doc.text(
          `${o.op}: ${o.count} call(s) · avg confidence ${(o.avgConfidence * 100).toFixed(0)}%`,
        );
      }
    }
    doc.moveDown(0.4);

    // Self-requested upgrades + the open developer-request queue (what the
    // brain says it needs to do its job better).
    doc.font(FONT_TITLE).fontSize(11).fillColor("#1a1a1a");
    doc.text(`Developer requests from the brain (${intel.openRequests.length} open)`);
    doc.font(FONT_BODY).fontSize(9).fillColor("#222").moveDown(0.2);
    if (intel.selfModel && intel.selfModel.topUpgrades.length > 0) {
      doc.fillColor("#444").text("Top self-requested upgrades:");
      intel.selfModel.topUpgrades.slice(0, 5).forEach((u, i) => doc.text(`  ${i + 1}. ${u}`));
      doc.fillColor("#222").moveDown(0.2);
    }
    if (intel.openRequests.length === 0) {
      doc.fillColor("#666").text("(no open developer requests)").fillColor("#222");
    } else {
      for (const r of intel.openRequests) {
        const times = r.occurrences > 1 ? ` ×${r.occurrences}` : "";
        const src = r.source ? ` [${r.source}]` : "";
        doc.fillColor(
          r.severity === "high" ? "#a8000c" : r.severity === "medium" ? "#a86b00" : "#222",
        );
        doc.text(`[${r.severity}] ${r.kind}: ${r.title}${times}${src}`);
      }
      doc.fillColor("#222");
    }
    doc.moveDown();

    // ----- Diagnostics --------------------------------------------------
    doc.font(FONT_TITLE).fontSize(14).fillColor("#1a1a1a");
    doc.text("Diagnostics (current)");
    doc.moveDown(0.5);
    for (const r of data.diagnostics) {
      doc.font(FONT_BODY).fontSize(10).fillColor("#222");
      doc.font(FONT_TITLE).fillColor(statusColor(r.status));
      doc.text(`[${r.status.toUpperCase()}] ${r.label}`, { continued: false });
      doc.font(FONT_BODY).fillColor("#222");
      doc.text(r.summary);
      if (r.details && r.details.length) {
        for (const d of r.details.slice(0, 5)) doc.text(`  · ${d}`);
      }
      if (r.suggestedAction) {
        doc.fillColor("#555").text(`  → ${r.suggestedAction}`);
      }
      doc.moveDown(0.5);
    }
    doc.moveDown();

    // ----- QA reports ---------------------------------------------------
    doc.font(FONT_TITLE).fontSize(14).fillColor("#1a1a1a");
    doc.text(`QA reports (${data.qaReports.length})`);
    doc.font(FONT_BODY).fontSize(9).fillColor("#222");
    doc.moveDown(0.3);
    if (data.qaReports.length === 0) {
      doc.text("(no QA reports in this period)");
    } else {
      for (const r of data.qaReports.slice(0, 50)) {
        const score = r.overallScore.toFixed(2);
        const flag = r.needsHumanReview ? " [review]" : r.passed ? " [pass]" : " [fail]";
        doc.text(
          `${r.createdAt.toISOString()} · ${r.contentType} · ${r.title} · ${score} · ${r.recommendation}${flag}`,
        );
      }
      if (data.qaReports.length > 50) {
        doc.fillColor("#666").text(`...and ${data.qaReports.length - 50} more`);
      }
    }
    doc.moveDown();

    // ----- Recent builds ------------------------------------------------
    doc.font(FONT_TITLE).fontSize(14).fillColor("#1a1a1a");
    doc.text(`Builds in this period (${data.recentBuilds.length})`);
    doc.font(FONT_BODY).fontSize(9).fillColor("#222");
    doc.moveDown(0.3);
    if (data.recentBuilds.length === 0) {
      doc.text("(no builds in this period)");
    } else {
      for (const b of data.recentBuilds.slice(0, 50)) {
        doc.text(`${b.createdAt.toISOString()} · ${b.status} · ${b.contentType} · ${b.title}`);
      }
      if (data.recentBuilds.length > 50) {
        doc.fillColor("#666").text(`...and ${data.recentBuilds.length - 50} more`);
      }
    }
    doc.moveDown();

    // ----- Build logs ---------------------------------------------------
    doc.font(FONT_TITLE).fontSize(14).fillColor("#1a1a1a");
    doc.text(`Worker build logs (${data.buildLogs.length})`);
    doc.font(FONT_BODY).fontSize(8).fillColor("#222");
    doc.moveDown(0.3);
    if (data.buildLogs.length === 0) {
      doc.text("(no build-log entries in this period)");
    } else {
      for (const l of data.buildLogs.slice(0, 200)) {
        const conf = l.confidence != null ? ` (${l.confidence.toFixed(2)})` : "";
        const where = l.sourceUrl ? ` ${l.sourceUrl}` : "";
        doc.fillColor(l.level === "error" ? "#a8000c" : l.level === "warn" ? "#a86b00" : "#222");
        doc.text(
          `${l.createdAt.toISOString()} [${l.level}] ${l.step}: ${l.message}${conf}${where}`,
        );
      }
      if (data.buildLogs.length > 200) {
        doc.fillColor("#666").text(`...and ${data.buildLogs.length - 200} more`);
      }
    }

    // ----- Curated knowledge --------------------------------------------
    doc.moveDown();
    doc.font(FONT_TITLE).fontSize(14).fillColor("#1a1a1a");
    doc.text("Curated knowledge available to the worker");
    doc.font(FONT_BODY).fontSize(10).fillColor("#222");
    doc.moveDown(0.3);
    for (const [type, count] of Object.entries(data.knowledgeSummary.byType)) {
      doc.text(`${type}: ${count}`);
    }

    doc.end();
  });
}
