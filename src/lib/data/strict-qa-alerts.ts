/**
 * Strict QA admin alerts. The cron route calls `runStrictQAAlerts`
 * after the planner so the operator hears about:
 *
 *   - Invalid public rows lingering (a row with status=PUBLISHED but
 *     publicRenderReady=false).
 *   - Cleanup loop stale (no CLEANUP DataManagementLog row within the
 *     configured stale window).
 *   - Rejection-rate spike (deletes in the last hour are >N× the
 *     deletes in the prior 24h average).
 *   - System health score collapsing (any component score < 60).
 *
 * Each alert has a 24-hour cooldown via AdminNotificationState so a
 * persistent failure produces a daily reminder, not a flood.
 */

import { logger } from "../observability/logger";
import { readAdminEmail, sendCriticalFailureAlert } from "../email";
import { getFlowState, setFlowState } from "./admin-notification-state";
import { getCleanupHealth, getSystemHealthReport } from "../content-qa";
import { prisma } from "../db/client";
import { recordError } from "./error-log";

const RESEND_COOLDOWN_HOURS = 24;
const REJECTION_SPIKE_FACTOR = 5;
const HEALTH_SCORE_FAIL_THRESHOLD = 60;

function isWithinCooldown(lastSentAt: string | null, now: Date): boolean {
  if (!lastSentAt) return false;
  return now.getTime() - new Date(lastSentAt).getTime() < RESEND_COOLDOWN_HOURS * 60 * 60 * 1000;
}

type SimpleState = { lastSentAt: string | null; counter: number };

export type StrictQAAlertResult = {
  invalidPublicAlerted: boolean;
  staleCleanupAlerted: boolean;
  rejectionSpikeAlerted: boolean;
  healthScoreAlerted: boolean;
};

export async function runStrictQAAlerts(now: Date = new Date()): Promise<StrictQAAlertResult> {
  const result: StrictQAAlertResult = {
    invalidPublicAlerted: false,
    staleCleanupAlerted: false,
    rejectionSpikeAlerted: false,
    healthScoreAlerted: false,
  };

  const adminEmail = readAdminEmail();
  const cleanup = await getCleanupHealth().catch(() => null);
  if (cleanup) {
    // Invalid public rows alert: any row with publicRenderReady=false
    // but status=PUBLISHED means the cleanup loop is behind. We
    // alert daily until the count returns to zero.
    if (cleanup.invalidPublicRowCount > 0) {
      const flow = "alert:strict_qa:invalid_public_rows" as `alert:${string}`;
      const state = (await getFlowState<SimpleState>(flow)) ?? {
        lastSentAt: null,
        counter: 0,
      };
      if (!isWithinCooldown(state.lastSentAt, now)) {
        result.invalidPublicAlerted = true;
        logger.warn("alert.strict_qa.invalid_public_rows", {
          count: cleanup.invalidPublicRowCount,
          breakdown: cleanup.invalidPublicByContentType,
        });
        // Also write to ErrorLog so the monthly error report picks it
        // up. Section 5 of the strict QA spec routes alerts to (a)
        // admin email, (b) admin dashboard, (c) error logs, (d)
        // biweekly admin reports — the first three are now wired.
        await recordError({
          source: "ingestion",
          kind: "strict_qa.invalid_public_rows",
          severity: "warn",
          message: `${cleanup.invalidPublicRowCount} invalid public row(s) lingering across the catalog.`,
          context: cleanup.invalidPublicByContentType,
        }).catch(() => undefined);
        if (adminEmail) {
          await sendCriticalFailureAlert({
            kind: "strict_qa_invalid_public_rows",
            message: `Strict QA: ${cleanup.invalidPublicRowCount} invalid public row(s) found across the catalog. Per type: ${JSON.stringify(cleanup.invalidPublicByContentType)}. The cleanup loop should remove these on the next sweep; if the count is not dropping, check the worker heartbeat and the cleanup health diagnostic.`,
          }).catch(() => undefined);
        }
        await setFlowState(flow, { lastSentAt: now.toISOString(), counter: state.counter + 1 });
      }
    }

    // Stale cleanup alert.
    if (cleanup.isStale) {
      const flow = "alert:strict_qa:stale_cleanup" as `alert:${string}`;
      const state = (await getFlowState<SimpleState>(flow)) ?? {
        lastSentAt: null,
        counter: 0,
      };
      if (!isWithinCooldown(state.lastSentAt, now)) {
        result.staleCleanupAlerted = true;
        logger.warn("alert.strict_qa.stale_cleanup", {
          lastRunAt: cleanup.lastRunAt,
          msSinceLastRun: cleanup.msSinceLastRun,
        });
        await recordError({
          source: "ingestion",
          kind: "strict_qa.stale_cleanup",
          severity: "warn",
          message: `Strict cleanup has not run within its stale window. Last run: ${cleanup.lastRunAt ?? "never"}.`,
        }).catch(() => undefined);
        if (adminEmail) {
          await sendCriticalFailureAlert({
            kind: "strict_qa_stale_cleanup",
            message: `Strict QA cleanup has not run within its stale window. Last run: ${cleanup.lastRunAt ?? "never"}. The auto-trigger fires on every cron tick; if cleanup is still not running, check the worker process or run /admin/content-qa/dashboard's "Run strict QA cleanup now" button.`,
          }).catch(() => undefined);
        }
        await setFlowState(flow, { lastSentAt: now.toISOString(), counter: state.counter + 1 });
      }
    }
  }

  // Rejection-rate spike alert.
  try {
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const [lastHour, lastDay] = await Promise.all([
      prisma.rejectedContentLog.count({
        where: { decision: "delete", deletedAt: { gte: hourAgo } },
      }),
      prisma.rejectedContentLog.count({
        where: { decision: "delete", deletedAt: { gte: dayAgo, lt: hourAgo } },
      }),
    ]);
    // Compare last-hour to average-hour over the prior 23 hours.
    const avgPerHour = lastDay / 23;
    if (avgPerHour > 0 && lastHour > avgPerHour * REJECTION_SPIKE_FACTOR && lastHour >= 10) {
      const flow = "alert:strict_qa:rejection_spike" as `alert:${string}`;
      const state = (await getFlowState<SimpleState>(flow)) ?? {
        lastSentAt: null,
        counter: 0,
      };
      if (!isWithinCooldown(state.lastSentAt, now)) {
        result.rejectionSpikeAlerted = true;
        logger.warn("alert.strict_qa.rejection_spike", {
          lastHour,
          lastDayAvgPerHour: avgPerHour,
        });
        await recordError({
          source: "ingestion",
          kind: "strict_qa.rejection_spike",
          severity: "warn",
          message: `Rejection-rate spike: ${lastHour} deletes in last hour vs ${avgPerHour.toFixed(1)}/h prior 23h average.`,
          context: { lastHour, avgPerHour },
        }).catch(() => undefined);
        if (adminEmail) {
          await sendCriticalFailureAlert({
            kind: "strict_qa_rejection_spike",
            message: `Strict QA rejection spike: ${lastHour} deletes in the last hour vs average ${avgPerHour.toFixed(1)}/h over the prior 23h. A bad source or contract change likely just landed — check the deleted log at /admin/content-qa/deleted-log for the failure category breakdown.`,
          }).catch(() => undefined);
        }
        await setFlowState(flow, { lastSentAt: now.toISOString(), counter: state.counter + 1 });
      }
    }
  } catch (e) {
    logger.warn("alert.strict_qa.rejection_spike_check_failed", {
      error: e instanceof Error ? e.message : String(e),
    });
  }

  // System health score alert.
  try {
    const report = await getSystemHealthReport();
    if (report.scores.system.score < HEALTH_SCORE_FAIL_THRESHOLD) {
      const flow = "alert:strict_qa:system_health_low" as `alert:${string}`;
      const state = (await getFlowState<SimpleState>(flow)) ?? {
        lastSentAt: null,
        counter: 0,
      };
      if (!isWithinCooldown(state.lastSentAt, now)) {
        result.healthScoreAlerted = true;
        logger.warn("alert.strict_qa.system_health_low", {
          score: report.scores.system.score,
          worstComponent: report.scores.system.signals.worstComponent,
        });
        await recordError({
          source: "ingestion",
          kind: "strict_qa.system_health_low",
          severity: "error",
          message: `System health score dropped to ${report.scores.system.score}/100; worst component: ${report.scores.system.signals.worstComponent}.`,
        }).catch(() => undefined);
        if (adminEmail) {
          await sendCriticalFailureAlert({
            kind: "system_health_low",
            message: `System health score dropped to ${report.scores.system.score}/100. Worst component: ${report.scores.system.signals.worstComponent}. Inspect /admin/diagnostics for the per-component breakdown.`,
          }).catch(() => undefined);
        }
        await setFlowState(flow, { lastSentAt: now.toISOString(), counter: state.counter + 1 });
      }
    }
  } catch (e) {
    logger.warn("alert.strict_qa.health_check_failed", {
      error: e instanceof Error ? e.message : String(e),
    });
  }

  return result;
}
