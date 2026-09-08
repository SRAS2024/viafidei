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
 *   5. auto-resolve escalations whose condition has cleared — only after it
 *      has been absent for several consecutive checks, so a warning flapping
 *      at its window edge does not resolve/re-email every 15 minutes
 *   6. a per-(kind, contentType) re-email cooldown (24h) that holds even when
 *      the build SHA — and so the fingerprint — changed, and a cap of one
 *      grace window of post-upgrade deferral per issue kind
 *
 * Reuses existing infra: the self-assessment composer, the governance layer,
 * the escalation PDF generator (which embeds the timeframe developer report),
 * and the shared admin mailer. Records everything to the audit log.
 */

import { createHash } from "node:crypto";

import type { AdminDeveloperReportPeriod, Prisma, PrismaClient } from "@prisma/client";

import { workerExecutionAllowed } from "./execution-context";
import { buildSelfAssessment, type SelfAssessment, type WarningKind } from "./self-assessment";
import { decideGovernance, type EscalationPayload } from "./governance";
import { getVersionContext } from "./code-version";
import { generateAdminWorkerEscalationPdf } from "./pdf";
import { sendAdminWorkerEscalation } from "@/lib/email/admin-send";
import { writeAdminWorkerLog } from "./logs";

const THROTTLE_MS = 15 * 60 * 1000; // ~15 min between full escalation checks
const THROTTLE_KEY = "escalation-check-lastrun";
/** Memory row: `{ [escalationId]: consecutiveAbsentChecks }`. */
const ABSENT_KEY = "escalation-absent-checks";
/** Memory row: `{ [kind]: firstDeferredAtISO }`. */
const DEFERRAL_KEY = "escalation-deferral";
/** Consecutive checks (~15 min apart) a warning must be absent before its escalation resolves. */
const RESOLVE_AFTER_ABSENT_CHECKS = 3;
/** Same kind + content type is emailed at most once per cooldown, whatever the build SHA. */
const REEMAIL_COOLDOWN_MS = 24 * 60 * 60 * 1000;

function envNum(key: string, fallback: number): number {
  const v = process.env[key];
  if (v === undefined || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

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
          "A way out of the fixated stage through the worker's OWN pipeline — reroute the blocked item to a different approved source, repair the candidate, or force the next productive stage. This is a workflow problem, not a missing API key.",
        action:
          "Let the governor force the internal corrective path (DISCOVERY → CANDIDATE_PRIORITIZATION → SOURCE_FETCH → SOURCE_READ → EXTRACTION → VALIDATION → BUILD → QA → PUBLISH): reroute the fixated item to an alternate source, drain the built backlog, and resolve the repeated failures. The worker resolves this itself — no external AI/source key is required.",
      };
    case "EXTRACTING_WITHOUT_PUBLISHING":
      return {
        needs:
          "The downstream pipeline drained so built work reaches publish — commonly blocked on cross-source validation evidence or strict-QA, not on any external service.",
        action:
          "Check the 'Why Content Isn't Growing' section for the exact blocked stage and let the worker drain it via the internal path (SOURCE_READ → EXTRACTION → VALIDATION → BUILD → QA → PUBLISH): the BUILD_READY drain runs cross-source verification + strict QA and reroutes items missing evidence to another source. No API key needed.",
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
          "The failing content type routed through a DIFFERENT source via the worker's own logic — it keeps failing on the current source and never publishes.",
        action:
          "Let the worker reroute the type to an alternate approved source (candidate prioritization + source reputation already rank them) and re-run SOURCE_FETCH → SOURCE_READ → EXTRACTION deterministically. If every known source genuinely fails, the structured (Wikidata/Wikipedia) ingestor covers this type — no external AI extraction key is involved.",
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

type MemoryMap = Record<string, unknown>;

/** Read one GENERIC memory row's object value (fail-open → empty). */
async function readMemoryMap(prisma: PrismaClient, key: string): Promise<MemoryMap> {
  try {
    const row = await prisma.adminWorkerMemory.findUnique({
      where: { memoryType_memoryKey: { memoryType: "GENERIC", memoryKey: key } },
      select: { memoryValue: true },
    });
    const v = row?.memoryValue;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as MemoryMap) : {};
  } catch {
    return {};
  }
}

async function writeMemoryMap(prisma: PrismaClient, key: string, value: MemoryMap): Promise<void> {
  const memoryValue = value as Prisma.InputJsonObject;
  await prisma.adminWorkerMemory
    .upsert({
      where: { memoryType_memoryKey: { memoryType: "GENERIC", memoryKey: key } },
      update: { memoryValue, lastUsedAt: new Date() },
      create: { memoryType: "GENERIC", memoryKey: key, memoryValue, lastUsedAt: new Date() },
    })
    .catch(() => undefined);
}

/**
 * Auto-resolve open escalations whose kind has been absent from the live
 * assessment for RESOLVE_AFTER_ABSENT_CHECKS consecutive checks, so the same
 * issue can escalate again if it genuinely recurs later. One absent check is
 * not enough: every warning is computed over a sliding window, so a condition
 * sitting at its threshold flickers present/absent as rows age out, and
 * resolving on the first absence re-opened (and re-emailed) it 15 minutes
 * later. The streak lives in AdminWorkerMemory keyed by escalation id and is
 * cleared whenever the kind is seen again.
 */
async function resolveClearedEscalations(
  prisma: PrismaClient,
  self: SelfAssessment,
): Promise<number> {
  const activeKinds = new Set(self.warnings.map((w) => w.kind as string));
  const open = await prisma.adminWorkerEscalation
    .findMany({ where: { resolvedAt: null }, select: { id: true, kind: true } })
    .catch(() => [] as Array<{ id: string; kind: string }>);
  const streaks = await readMemoryMap(prisma, ABSENT_KEY);
  const next: MemoryMap = {};
  let resolved = 0;
  for (const row of open) {
    if (activeKinds.has(row.kind)) continue; // still present → streak resets
    const prev = typeof streaks[row.id] === "number" ? (streaks[row.id] as number) : 0;
    const absent = prev + 1;
    if (absent >= RESOLVE_AFTER_ABSENT_CHECKS) {
      await prisma.adminWorkerEscalation
        .update({
          where: { id: row.id },
          data: { resolvedAt: new Date(), resolvedReason: "condition_cleared" },
        })
        .catch(() => undefined);
      resolved += 1;
    } else {
      next[row.id] = absent;
    }
  }
  // Entries for rows no longer open drop out naturally (only open rows are rewritten).
  if (Object.keys(next).length > 0 || Object.keys(streaks).length > 0) {
    await writeMemoryMap(prisma, ABSENT_KEY, next);
  }
  return resolved;
}

/**
 * The most recent email for this kind + content type, ignoring the build SHA
 * (the fingerprint includes the SHA, so a commit alone would otherwise open a
 * fresh fingerprint and a fresh email for an unchanged condition).
 */
async function lastEmailFor(
  prisma: PrismaClient,
  kind: string,
  contentType: string | null,
): Promise<Date | null> {
  try {
    const row = await prisma.adminWorkerEscalation.findFirst({
      where: { kind, contentType, emailSentAt: { not: null } },
      orderBy: { emailSentAt: "desc" },
      select: { emailSentAt: true },
    });
    return row?.emailSentAt ?? null;
  } catch {
    return null;
  }
}

/**
 * Resolve open escalations raised on a PRIOR build once a new build ships. This
 * is how the worker's self-monitoring "knows when something is fixed": a code
 * update may well have addressed the issue, and because the dedup fingerprint
 * includes the build SHA, a genuinely-persistent issue re-escalates afresh under
 * the NEW build (a new fingerprint → a new email). So closing prior-build rows
 * loses no signal — it just stops an already-shipped fix from showing a stale,
 * still-open escalation. Signal-based (a distinct newer build exists), so it is
 * safe to run regardless of live/paused, unlike the empty-warning clear above.
 */
async function resolveSupersededByUpgrade(
  prisma: PrismaClient,
  currentSha: string | null,
): Promise<number> {
  if (!currentSha) return 0;
  const open = await prisma.adminWorkerEscalation
    .findMany({ where: { resolvedAt: null }, select: { id: true, versionSha: true } })
    .catch(() => [] as Array<{ id: string; versionSha: string | null }>);
  let resolved = 0;
  for (const row of open) {
    // Only rows stamped with a DIFFERENT, non-null build SHA are provably from a
    // prior build. Null-SHA rows can't be attributed to a build, so leave them
    // to the condition-cleared path.
    if (row.versionSha && row.versionSha !== currentSha) {
      await prisma.adminWorkerEscalation
        .update({
          where: { id: row.id },
          data: { resolvedAt: new Date(), resolvedReason: "superseded_by_upgrade" },
        })
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
  /** True when a would-be escalation was held back because a code upgrade landed
   * inside the assessment window — the windowed signal can't yet tell a shipped
   * fix from a still-broken issue, so the fix is given a window to prove out. */
  deferredForUpgrade: boolean;
  /** True when the row was (re)opened but the email was withheld by the 24h
   * per-(kind, contentType) cooldown. */
  cooldown: boolean;
  kind?: string;
  reason?: string;
}

/** Everything `deliverEscalation` needs that the periodic check computes. */
interface EscalationDeliveryContext {
  passId?: string;
  versionSha: string | null;
  /** Assessment window, used for the PDF period + the email's timeframe line. */
  windowHours: number;
  version: Awaited<ReturnType<typeof getVersionContext>> | null;
  guidance: { needs: string; action: string };
}

/**
 * Record + deliver one escalation: fingerprint dedup, the 24h per-(kind,
 * contentType) re-email cooldown, the PDF, the email, and the audit log.
 *
 * Extracted from `runEscalationCheckIfDue` so a caller that has ALREADY decided
 * an issue warrants paging — one the windowed self-assessment cannot see, such
 * as a structured source that has failed N consecutive times — reaches the
 * human through exactly the same governed, deduplicated, cooled-down path
 * rather than a second ad-hoc one. Fail-open throughout.
 */
async function deliverEscalation(
  prisma: PrismaClient,
  payload: EscalationPayload,
  ctx: EscalationDeliveryContext,
  out: EscalationCheckResult,
): Promise<EscalationCheckResult> {
  const fingerprint = computeEscalationFingerprint({
    kind: payload.kind,
    contentType: payload.contentType,
    versionSha: ctx.versionSha,
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
      passId: ctx.passId,
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

  // Re-email cooldown: the same kind + content type was emailed within the
  // last 24h (possibly under a different SHA / fingerprint, or on a row that
  // has since been resolved and flapped back). Keep the row open and count
  // the occurrence, but do not send — the operator already has this page.
  const lastEmailedAt = await lastEmailFor(prisma, payload.kind, payload.contentType);
  if (lastEmailedAt && Date.now() - lastEmailedAt.getTime() < REEMAIL_COOLDOWN_MS) {
    out.cooldown = true;
    await prisma.adminWorkerEscalation
      .upsert({
        where: { fingerprint },
        update: {
          kind: payload.kind,
          severity: payload.severity,
          contentType: payload.contentType,
          detail: payload.detail,
          signals: payload.signals,
          versionSha: ctx.versionSha,
          occurrences,
          emailDelivery: "cooldown",
          resolvedAt: null,
        },
        create: {
          fingerprint,
          kind: payload.kind,
          severity: payload.severity,
          contentType: payload.contentType,
          detail: payload.detail,
          signals: payload.signals,
          versionSha: ctx.versionSha,
          occurrences,
          emailDelivery: "cooldown",
          emailSentAt: null,
        },
      })
      .catch(() => undefined);
    await writeAdminWorkerLog(prisma, {
      passId: ctx.passId,
      category: "REPORT",
      severity: "INFO",
      eventName: "escalation_cooldown",
      message: `Escalation ${payload.kind} recorded without email — the same issue was emailed ${Math.round(
        (Date.now() - lastEmailedAt.getTime()) / 60000,
      )}m ago (24h per-issue cooldown).`,
      contentType: payload.contentType ?? undefined,
      safeMetadata: {
        fingerprint,
        kind: payload.kind,
        lastEmailedAt: lastEmailedAt.toISOString(),
      },
    }).catch(() => undefined);
    return out;
  }

  const period = periodForWindow(ctx.windowHours);
  const guidance = ctx.guidance;
  const versionNote = ctx.version?.upgradedRecently
    ? (ctx.version.recentUpgradeSummary ?? "recent code upgrade")
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
      timeframe: `${ctx.windowHours}h`,
      occurrences,
      versionLabel: ctx.version?.current?.label ?? null,
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
        versionSha: ctx.versionSha,
        occurrences,
        emailDelivery,
        resolvedAt: null,
        // Mirror the create branch: set emailSentAt to now ONLY on a real
        // send, and clear it to null otherwise. This update branch is reached
        // only for a genuinely new send attempt (new fingerprint, a reopened
        // previously-resolved row, or an open row whose earlier send was
        // skipped) — never for the dedup-skip path — so a stale emailSentAt
        // from a PRIOR episode must be cleared, otherwise a skipped/failed
        // re-send would be wrongly treated as already-notified and never
        // retried.
        emailSentAt: emailDelivery === "sent" ? new Date() : null,
      },
      create: {
        fingerprint,
        kind: payload.kind,
        severity: payload.severity,
        contentType: payload.contentType,
        detail: payload.detail,
        signals: payload.signals,
        versionSha: ctx.versionSha,
        occurrences,
        emailDelivery,
        emailSentAt: emailDelivery === "sent" ? new Date() : null,
      },
    })
    .catch(() => undefined);

  await writeAdminWorkerLog(prisma, {
    passId: ctx.passId,
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
      versionLabel: ctx.version?.current?.label ?? null,
    },
  }).catch(() => undefined);

  return out;
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
    deferredForUpgrade: false,
    cooldown: false,
  };
  try {
    // Autonomous escalation (and its email) is Admin Worker work — it runs on
    // the local runtime only, never as a production server workload (spec §9).
    if (!workerExecutionAllowed()) return out;
    if (!(await throttleOk(prisma, opts.force ?? false))) return out;
    out.ran = true;

    const self = await buildSelfAssessment(prisma);
    const version = await getVersionContext(prisma).catch(() => null);
    const versionSha = version?.current?.sha ?? null;

    // (a) Auto-resolve cleared escalations ONLY when the assessment is
    // authoritative — i.e. the worker is live and not paused. An empty warning
    // set from a paused/offline/failed-open assessment does NOT mean the
    // conditions cleared; resolving on it would wrongly close still-open issues
    // and cause a duplicate email on recovery. This is exactly the state the
    // forced startup check sees before the first heartbeat, so the gate matters.
    if (self.workerLive && !self.paused) {
      out.resolved += await resolveClearedEscalations(prisma, self);
    }
    // (b) Resolve prior-build escalations whenever a newer build is running. This
    // is signal-based (a concrete newer build SHA), not absence-of-warnings, so
    // it runs regardless of live/paused. Recognises "a fix shipped" — a
    // still-broken issue simply re-escalates under the new SHA below.
    out.resolved += await resolveSupersededByUpgrade(prisma, versionSha);

    const decision = decideGovernance(self);
    if (!decision.escalate || !decision.escalation) {
      return out;
    }
    out.escalated = true;
    const payload: EscalationPayload = decision.escalation;
    out.kind = payload.kind;
    out.reason = decision.reason;

    // (c) Post-upgrade grace: every warning is computed over a rolling window. If
    // a code upgrade landed INSIDE that window, the signal still reflects
    // pre-upgrade activity, so it cannot yet distinguish a just-shipped fix from
    // a still-broken issue. Hold the page for one grace window (defaults to the
    // assessment window; ADMIN_WORKER_ESCALATION_UPGRADE_GRACE_HOURS overrides, 0
    // disables) so the fix can prove out. Once the window fully post-dates the
    // upgrade, a genuinely-persistent issue escalates for real. Requires a real
    // PRIOR build (not the initial version record) so first boot never defers.
    // Deferral is capped at ONE grace window per issue kind: on the operator's
    // Mac every commit is an "upgrade", and a commit every few hours would
    // otherwise restart the grace forever so a genuine issue was never paged.
    // The first deferral time per kind is remembered in AdminWorkerMemory and
    // cleared once the kind escalates for real.
    const graceHours = envNum("ADMIN_WORKER_ESCALATION_UPGRADE_GRACE_HOURS", self.windowHours);
    const graceMs = graceHours * 60 * 60 * 1000;
    const upgradeAgeMs =
      version?.current && version.previous
        ? Date.now() - new Date(version.current.capturedAt).getTime()
        : Infinity;
    const deferrals = await readMemoryMap(prisma, DEFERRAL_KEY);
    const firstDeferredAt =
      typeof deferrals[payload.kind] === "string"
        ? new Date(deferrals[payload.kind] as string).getTime()
        : null;
    const deferralExhausted =
      firstDeferredAt != null &&
      Number.isFinite(firstDeferredAt) &&
      Date.now() - firstDeferredAt >= graceMs;
    if (graceHours > 0 && upgradeAgeMs < graceMs && !deferralExhausted) {
      out.deferredForUpgrade = true;
      if (firstDeferredAt == null) {
        await writeMemoryMap(prisma, DEFERRAL_KEY, {
          ...deferrals,
          [payload.kind]: new Date().toISOString(),
        });
      }
      await writeAdminWorkerLog(prisma, {
        passId: opts.passId,
        category: "REPORT",
        severity: "INFO",
        eventName: "escalation_deferred_post_upgrade",
        message: `Deferring ${payload.kind} escalation: code upgrade landed ${Math.round(
          upgradeAgeMs / 60000,
        )}m ago (within the ${self.windowHours}h assessment window) — giving the shipped change time to prove out before paging. ${
          version?.recentUpgradeSummary ?? version?.current?.changedSummary ?? ""
        }`.trim(),
        contentType: payload.contentType ?? undefined,
        safeMetadata: {
          kind: payload.kind,
          upgradeAgeMinutes: Math.round(upgradeAgeMs / 60000),
          graceHours,
          versionLabel: version?.current?.label ?? null,
        },
      }).catch(() => undefined);
      return out;
    }
    if (firstDeferredAt != null) {
      const rest = { ...deferrals };
      delete rest[payload.kind];
      await writeMemoryMap(prisma, DEFERRAL_KEY, rest);
    }

    return await deliverEscalation(
      prisma,
      payload,
      {
        passId: opts.passId,
        versionSha,
        windowHours: self.windowHours,
        version,
        guidance: guidanceFor(payload.kind),
      },
      out,
    );
  } catch {
    return out;
  }
}

/** What the structured-ingest lane knows about an unusable source. */
export interface StructuredSourceUnusableInput {
  /** The ingestor that cannot be used (e.g. "wikidata-saints"). */
  ingestorId: string;
  /** The content type it is the producer for (e.g. "SAINT"). */
  contentType: string;
  /** Consecutive failures with ZERO successful pages in between. */
  consecutiveFailures: number;
  /** The last failure as the SPARQL client classified it ("timeout (HTTP 504)"). */
  lastFailureKind: string | null;
  /** Cursor offset the failing pages were held at. */
  offset: number;
  /** Epoch ms until which the source is now backed off (null = not backed off). */
  retryAfter: number | null;
  passId?: string;
}

/**
 * Page the operator once when a structured ingestor has been declared UNUSABLE.
 *
 * This is the gap that let the biggest content goal stop growing in silence:
 * the SAINT ingestor failed 311 consecutive times and produced only a repeating
 * WARN, because every escalation signal is computed from windowed pipeline
 * counters that a source which never returns a row simply never moves. A
 * consecutive-failure count IS the signal, and this is where it is spoken.
 *
 * Routed through `deliverEscalation`, so it inherits the same fingerprint dedup,
 * the same 24h per-(kind, contentType) re-email cooldown and the same audit
 * logging as every other escalation — it can never become a mail loop. The
 * caller escalates once per unusable episode; this is the second guard, not the
 * first. Fail-open: returns the (unmodified) result on any error.
 */
export async function escalateStructuredSourceUnusable(
  prisma: PrismaClient,
  input: StructuredSourceUnusableInput,
): Promise<EscalationCheckResult> {
  const out: EscalationCheckResult = {
    ran: false,
    escalated: false,
    emailed: false,
    deduped: false,
    resolved: 0,
    deferredForUpgrade: false,
    cooldown: false,
  };
  try {
    // Same execution boundary as the periodic check: escalation + email is
    // Admin Worker work on the local runtime, never a production server load.
    if (!workerExecutionAllowed()) return out;
    const version = await getVersionContext(prisma).catch(() => null);
    const retryText = input.retryAfter
      ? ` It is now backed off until ${new Date(input.retryAfter).toISOString()} instead of being retried every pass; the other ingestors are unaffected.`
      : "";
    const payload: EscalationPayload = {
      // The structured ingestor IS the source of last resort for this content
      // type, so a dead one is exactly a repeated type failure.
      kind: "REPEATED_TYPE_FAILURE",
      severity: "ERROR",
      contentType: input.contentType,
      detail: `Structured ingestor ${input.ingestorId} — the only producer for ${input.contentType} — has failed ${input.consecutiveFailures} consecutive times with no successful page (last failure: ${input.lastFailureKind ?? "unknown"}), so ${input.contentType} has published nothing from it.${retryText}`,
      signals: [
        `ingestor=${input.ingestorId}`,
        `contentType=${input.contentType}`,
        `consecutiveFailures=${input.consecutiveFailures}`,
        `lastFailureKind=${input.lastFailureKind ?? "unknown"}`,
        `cursorOffset=${input.offset}`,
        input.retryAfter
          ? `backedOffUntil=${new Date(input.retryAfter).toISOString()}`
          : "backedOffUntil=none",
      ],
    };
    out.escalated = true;
    out.ran = true;
    out.kind = payload.kind;
    out.reason = "structured source unusable";
    return await deliverEscalation(
      prisma,
      payload,
      {
        passId: input.passId,
        versionSha: version?.current?.sha ?? null,
        windowHours: 24,
        version,
        guidance: {
          needs: `${input.ingestorId} to return rows again. A source that fails EVERY time — as opposed to intermittently — is usually the query itself: the Wikidata Query Service enforces a 60s execution cap, and a query that enumerates a whole corpus while computing per-row aggregates (OPTIONAL + GROUP_CONCAT) and then sorts it before LIMIT/OFFSET cannot finish at any offset. The alternative causes are network egress to query.wikidata.org being blocked, or this client being throttled.`,
          action: `Run the ingestor's own generated query (STRUCTURED_INGESTORS.find(i => i.id === "${input.ingestorId}").sparql(40, 0)) directly against https://query.wikidata.org/sparql and read the status code. A 504 "upstream request timeout" after ~60s means the query shape is the problem — split it into a cheap ordered ENUMERATION of entity ids plus a HYDRATION query bound with VALUES ?s { … } (as wikidata-saints does) so the aggregate work is bounded by the page. A 200 means the source is reachable and the failure was environmental.`,
        },
      },
      out,
    );
  } catch {
    return out;
  }
}
