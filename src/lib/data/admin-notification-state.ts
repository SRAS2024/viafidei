import { prisma } from "../db/client";

/**
 * Per-flow state for the admin notification scheduler. The scheduler
 * is purely time-driven (cron tick → "is it time to send X?") and
 * has no persistent timer; this table is the single source of truth
 * for "have we sent X yet for this period?".
 *
 * Flows:
 *   - "biweekly_report"        — last Biweekly Admin Report send timestamp.
 *   - "monthly_archive_cleanup" — last Monthly Archive Cleaning Up send (year-month).
 *   - "monthly_error_report"   — last Error Report send (year-month).
 *   - "milestone:<key>"         — per-content-type milestone dedup, one row per
 *     content-type bucket, state shape `{ sent: number[] }` listing the
 *     thresholds (25, 50, 75, 100) that have already been emailed.
 *
 * The `state` column is JSON because each flow has its own shape and
 * adding new flows in the future shouldn't require a schema migration.
 */

export type FlowKey =
  | "biweekly_report"
  | "monthly_archive_cleanup"
  | "monthly_error_report"
  | "monthly_source_quality"
  | "monthly_data_management"
  | `milestone:${string}`
  | `alert:${string}`;

export async function getFlowState<T = Record<string, unknown>>(flow: FlowKey): Promise<T | null> {
  const row = await prisma.adminNotificationState.findUnique({ where: { flow } });
  return (row?.state as T | undefined) ?? null;
}

export async function setFlowState<T extends Record<string, unknown>>(
  flow: FlowKey,
  state: T,
): Promise<void> {
  await prisma.adminNotificationState.upsert({
    where: { flow },
    create: { flow, state: state as never },
    update: { state: state as never },
  });
}

export type BiweeklyState = {
  /** ISO-8601 timestamp of the most recent successful send. */
  lastSentAt: string;
};

export type MonthlySendState = {
  /** "YYYY-MM" — the most recent month a successful send covered. */
  lastSentYearMonth: string;
};

export type MilestoneState = {
  /** Threshold percentages (25, 50, 75, 100) that have already been emailed. */
  sent: number[];
};
