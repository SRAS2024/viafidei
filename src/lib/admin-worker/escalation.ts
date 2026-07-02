/**
 * Escalation engine (spec bullets 5-9) — the orchestrator that turns a serious,
 * governed worker warning into a deduplicated email + PDF to the human admin.
 *
 * Flow (all fail-open; a throttle keeps it cheap to call every pass):
 *   1. build a `SelfAssessment` (self-monitoring)
 *   2. `decideGovernance` → if the decision is to `escalate`, we have a payload
 *   3. dedup via `AdminWorkerEscalation` (fingerprint @unique): if an UNRESOLVED
 *      row for the same fingerprint already had its email sent, bump
 *      `occurrences` and DO NOT re-send — the same issue is escalated at most
 *      once while open
 *   4. otherwise generate "Admin Worker Escalation.pdf" and email it, then
 *      stamp `emailSentAt`/`emailDelivery`
 *   5. auto-resolve escalations whose condition has cleared, so a future
 *      recurrence can escalate afresh
 *
 * Reuses existing infra: the self-assessment composer, the governance layer,
 * the escalation PDF generator (which embeds the timeframe developer report),
 * and the shared admin mailer. Records everything to the audit log.
 */

import { createHash } from "node:crypto";

import type { AdminDeveloperReportPeriod, PrismaClient } from "@prisma/client";

import { buildSelfAssessment, type SelfAssessment, type WarningKind } from "./self-assessment";
import { decideGovernance, type EscalationPayload } from "./governance";
import { getVersionContext } from "./code-version";
import { generateAdminWorkerEscalationPdf } from "./pdf";
import { sendAdminWorkerEscalation } from "@/lib/email/admin-send";
import { writeAdminWorkerLog } from "./logs";

const THROTTLE_MS = 15 * 60 * 1000; // ~15 min between full escalation checks
const THROTTLE_KEY = "escalation-check-lastrun";

/** Map the escalation window to a developer-report period for the PDF. */
function periodForWindow(windowHours: number): AdminDeveloperReportPeriod {
  if (windowHours <= 24) return "LAST_24_HOURS";
  if (windowHours <= 24 * 7) return "LAST_7_DAYS";
  return "LAST_30_DAYS";
}

/**
 * Stable fingerprint for dedup: the escalation KIND + primary content type +
 * running build SHA. Same issue on the same build → same fingerprint → emailed
 * once while unresolved. Including the SHA means a NEW build legitimately
 * re-escalates a recurring issue (useful when an upgrade is suspected).
 */
export function computeEscalationFingerprint(input: {
  kind: string;
  contentType: string | null;
  versionSha: string | null;
}): string {
  const material = [input.kind, input.contentType ?? "-", input.versionSha ?? "-"].join("|");
  return createHash("sha256").update(material).digest("hex").slice(0, 32);
}

/** Human-facing "what the worker needs" + "action required" per escalation kind. */
function guidanceFor(kind: WarningKind | "GENERIC"): { needs: string; action: string } {
  switch (kind) {
    case "LOOPING":
      return {
        needs:
          "A way out of the fixated stage — usually a fresh source, a repaired candidate, or a strategy change the governor can't self-apply.",
        action:
          "Review the looping stage in the attached diagnostics; if it is source-starved, add a source/API key, otherwise inspect the stage's repeated failures.",
      };
    case "EXTRACTING_WITHOUT_PUBLISHING":
      return {
        needs:
          "The publish gate to accept work already built — commonly blocked on cross-source validation evidence or strict-QA.",
        action:
          "Check the 'Why Content Isn't Growing' section for the exact blocked stage and drain it (add validation sources or resolve QA blockers).",
      };
    case "PUBLISHING_LOW_QUALITY":
      return {
        needs:
          "Either better sources or a threshold review — most scored content is failing the pre-publish quality gate.",
        action:
          "Review the failing quality dimensions in the developer report; the worker is correctly refusing to publish, but the input quality needs attention.",
      };
    case "BURNING_STORAGE":
      return {
        needs:
          "The in-flight backlog drained or capped — rows are accumulating unpublished and consuming storage.",
        action:
          "Drain the pipeline (resolve the blocking stage) or run a cleanup pass; if the backlog is unrecoverable, prune it.",
      };
    case "REPEATED_TYPE_FAILURE":
      return {
        needs:
          "A working source or extractor for the failing content type — it repeatedly fails and never publishes.",
        action:
          "Confirm the content type has a reachable, parseable source; consider adding a structured ingestor or an API key for it.",
      };
    case "NO_VALUE":
      return {
        needs:
          "A productive path — the worker is active but publishing nothing over an extended window.",
        action:
          "Use the attached developer report + diagnostics to find where the pipeline stalls, then unblock that stage.",
      };
    default:
      return {
        needs:
          "Operator attention — the worker flagged a serious condition it cannot self-resolve.",
        action: "Review the attached escalation PDF for the full context.",
      };
  }
}

async function throttleOk(prisma: PrismaClient, force: boolean): Promise<boolean> {
  if (force) return true;
  const where = {
    memoryType_memoryKey: { memoryType: "GENERIC" as const, memoryKey: THROTTLE_KEY },
  };
  const row = await prisma.adminWorkerMemory
    .findUnique({ where, select: { lastUsedAt: true } })
    .catch(() => null);
  const last = row?.lastUsedAt ? new Date(row.lastUsedAt).getTime() : 0;
  if (Date.now() - last < THROTTLE_MS) return false;
  await prisma.adminWorkerMemory
    .upsert({
      where,
      update: { lastUsedAt: new Date() },
      create: {
        memoryType: "GENERIC",
        memoryKey: THROTTLE_KEY,
        memoryValue: {},
        lastUsedAt: new Date(),
      },
    })
    .catch(() => undefined);
  return true;
}

/** Auto-resolve open escalations whose kind is no longer present in the live
 * assessment, so the same issue can escalate again if it recurs later. */
async function resolveClearedEscalations(
  prisma: PrismaClient,
  self: SelfAssessment,
): Promise<number> {
  const activeKinds = new Set(self.warnings.map((w) => w.kind as string));
  const open = await prisma.adminWorkerEscalation
    .findMany({ where: { resolvedAt: null }, select: { id: true, kind: true } })
    .catch(() => [] as Array<{ id: string; kind: string }>);
  let resolved = 0;
  for (const row of open) {
    if (!activeKinds.has(row.kind)) {
      await prisma.adminWorkerEscalation
        .update({ where: { id: row.id }, data: { resolvedAt: new Date() } })
        .catch(() => undefined);
      resolved += 1;
    }
  }
  return resolved;
}

export interface EscalationCheckResult {
  ran: boolean;
  escalated: boolean;
  emailed: boolean;
  deduped: boolean;
  resolved: number;
  kind?: string;
  reason?: string;
}

/**
 * Run one escalation check. Throttled (~15 min) unless `force`. When governance
 * decides to escalate, deduplicates + (on a genuinely new/open-unsent issue)
 * generates the PDF and emails the admin. Fail-open throughout.
 */
export async function runEscalationCheckIfDue(
  prisma: PrismaClient,
  opts: { passId?: string; force?: boolean } = {},
): Promise<EscalationCheckResult> {
  const out: EscalationCheckResult = {
    ran: false,
    escalated: false,
    emailed: false,
    deduped: false,
    resolved: 0,
  };
  try {
    if (!(await throttleOk(prisma, opts.force ?? false))) return out;
    out.ran = true;

    const self = await buildSelfAssessment(prisma);
    // Resolve escalations whose condition has cleared (independent of whether
    // this pass raises a new one).
    out.resolved = await resolveClearedEscalations(prisma, self);

    const decision = decideGovernance(self);
    if (!decision.escalate || !decision.escalation) {
      return out;
    }
    out.escalated = true;
    const payload: EscalationPayload = decision.escalation;
    out.kind = payload.kind;
    out.reason = decision.reason;

    const version = await getVersionContext(prisma).catch(() => null);
    const versionSha = version?.current?.sha ?? null;
    const fingerprint = computeEscalationFingerprint({
      kind: payload.kind,
      contentType: payload.contentType,
      versionSha,
    });

    // Dedup: find an existing UNRESOLVED row for this fingerprint.
    const existing = await prisma.adminWorkerEscalation
      .findUnique({ where: { fingerprint } })
      .catch(() => null);

    if (existing && !existing.resolvedAt && existing.emailSentAt) {
      // Already escalated + emailed and still open — bump occurrences, no email.
      await prisma.adminWorkerEscalation
        .update({
          where: { fingerprint },
          data: { occurrences: { increment: 1 }, detail: payload.detail },
        })
        .catch(() => undefined);
      out.deduped = true;
      await writeAdminWorkerLog(prisma, {
        passId: opts.passId,
        category: "REPORT",
        severity: "INFO",
        eventName: "escalation_deduped",
        message: `Escalation ${payload.kind} already open + emailed — occurrence recorded, no duplicate email.`,
        contentType: payload.contentType ?? undefined,
        safeMetadata: { fingerprint, kind: payload.kind },
      }).catch(() => undefined);
      return out;
    }

    // New issue, OR an open row whose earlier send was only "skipped" (no
    // ADMIN_EMAIL): (re)attempt the email. Upsert the row first (occurrences
    // resets to 1 for a genuinely new fingerprint; a reopened one keeps count).
    const occurrences = existing && !existing.resolvedAt ? existing.occurrences + 1 : 1;

    const period = periodForWindow(self.windowHours);
    const guidance = guidanceFor(payload.kind);
    const versionNote = version?.upgradedRecently
      ? (version.recentUpgradeSummary ?? "recent code upgrade")
      : null;

    let emailDelivery: "sent" | "skipped" | "failed" = "failed";
    try {
      const { pdf } = await generateAdminWorkerEscalationPdf(prisma, period, {
        kind: payload.kind,
        severity: payload.severity,
        detail: payload.detail,
        signals: payload.signals,
        contentType: payload.contentType,
        occurrences,
        whatNeeded: guidance.needs,
        actionRequired: guidance.action,
      });
      const send = await sendAdminWorkerEscalation({
        kind: payload.kind,
        severity: payload.severity,
        whatHappened: payload.detail,
        whatDetected: payload.signals,
        whatNeeded: guidance.needs,
        actionRequired: guidance.action,
        contentType: payload.contentType,
        timeframe: `${self.windowHours}h`,
        occurrences,
        versionLabel: version?.current?.label ?? null,
        versionNote,
        pdfBase64: pdf.toString("base64"),
      });
      emailDelivery = send.ok && send.delivery === "sent" ? "sent" : send.ok ? "skipped" : "failed";
      out.emailed = emailDelivery === "sent";
    } catch {
      emailDelivery = "failed";
    }

    // Record/refresh the escalation memory. `emailSentAt` is only set when the
    // email actually went out, so a "skipped" delivery (no ADMIN_EMAIL) will be
    // retried next check rather than being treated as already-notified.
    await prisma.adminWorkerEscalation
      .upsert({
        where: { fingerprint },
        update: {
          kind: payload.kind,
          severity: payload.severity,
          contentType: payload.contentType,
          detail: payload.detail,
          signals: payload.signals,
          versionSha,
          occurrences,
          emailDelivery,
          resolvedAt: null,
          ...(emailDelivery === "sent" ? { emailSentAt: new Date() } : {}),
        },
        create: {
          fingerprint,
          kind: payload.kind,
          severity: payload.severity,
          contentType: payload.contentType,
          detail: payload.detail,
          signals: payload.signals,
          versionSha,
          occurrences,
          emailDelivery,
          emailSentAt: emailDelivery === "sent" ? new Date() : null,
        },
      })
      .catch(() => undefined);

    await writeAdminWorkerLog(prisma, {
      passId: opts.passId,
      category: "REPORT",
      severity: payload.severity === "ERROR" ? "ERROR" : "WARN",
      eventName: `escalation_${emailDelivery}`,
      message: `Admin Worker escalation ${payload.kind} (${payload.severity}) — email ${emailDelivery}. ${payload.detail}`,
      contentType: payload.contentType ?? undefined,
      safeMetadata: {
        fingerprint,
        kind: payload.kind,
        severity: payload.severity,
        occurrences,
        emailDelivery,
        signals: payload.signals,
        versionLabel: version?.current?.label ?? null,
      },
    }).catch(() => undefined);

    return out;
  } catch {
    return out;
  }
}
