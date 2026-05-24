/**
 * Admin Worker modes. The central loop selects exactly one mode per
 * pass; the mode determines which task generators run. Modes are
 * deterministic: given the same state inputs the loop always selects
 * the same mode, which makes the worker explainable and testable.
 */

import type { AdminWorkerMode } from "@prisma/client";

export type ModeDescriptor = {
  mode: AdminWorkerMode;
  label: string;
  description: string;
};

export const ADMIN_WORKER_MODES: readonly ModeDescriptor[] = [
  {
    mode: "SETUP",
    label: "Setup",
    description: "Initialize tables, source jobs, diagnostics, and goals.",
  },
  {
    mode: "CONSTANT_FILL",
    label: "Constant fill",
    description: "Build content until configured goals are met.",
  },
  {
    mode: "MAINTENANCE",
    label: "Maintenance",
    description: "Keep published content fresh; refresh stale items.",
  },
  {
    mode: "REPAIR",
    label: "Repair",
    description: "Fix pipeline failures (queue stalls, source errors, missing fields).",
  },
  {
    mode: "HOMEPAGE",
    label: "Homepage",
    description: "Score and improve the public homepage.",
  },
  {
    mode: "DIAGNOSTICS",
    label: "Diagnostics",
    description: "Audit every subsystem and write DiagnosticSnapshot rows.",
  },
  {
    mode: "SECURITY_DEFENSE",
    label: "Security defense",
    description: "Always-on defense — runs even when other modes are paused.",
  },
  {
    mode: "REPORTING",
    label: "Reporting",
    description: "Generate scheduled reports (monthly PDF, etc.).",
  },
  {
    mode: "PAUSED",
    label: "Paused",
    description: "Non-security tasks paused. Security defense still runs.",
  },
] as const;

export function describeMode(mode: AdminWorkerMode): ModeDescriptor {
  return ADMIN_WORKER_MODES.find((m) => m.mode === mode) ?? ADMIN_WORKER_MODES[0];
}
