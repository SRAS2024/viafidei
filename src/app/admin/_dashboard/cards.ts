/**
 * Admin dashboard cards (browser admin).
 *
 * The Admin Worker's control surfaces are deliberately NOT here. The worker
 * executes on the operator's MacBook, under the native Via Fidei application,
 * which holds the complete command center — activation, passes, homepage
 * makeover, rules, skills, review, artifacts, intelligence and file ingestion.
 *
 * What remains in the browser is what the operator asked to keep there: user
 * management, diagnostics, logs, and the read-only content surfaces that do not
 * cause Admin Worker computation to run on the production web service.
 */

export type DashboardCard = {
  href: string;
  labelKey: string;
  eyebrow: string;
  /** Optional one-line description shown under the title. */
  descriptionKey?: string;
};

export const DASHBOARD_CARDS: DashboardCard[] = [
  // ── Admin operations (the browser admin's purpose) ────────────────
  { href: "/admin/users", labelKey: "admin.card.users", eyebrow: "I." },
  {
    href: "/admin/diagnostics",
    labelKey: "admin.card.diagnostics",
    descriptionKey: "admin.card.diagnostics.desc",
    eyebrow: "II.",
  },
  { href: "/admin/logs", labelKey: "admin.card.logs", eyebrow: "III." },
  {
    href: "/admin/logs/worker",
    labelKey: "admin.card.adminWorkerLogs",
    descriptionKey: "admin.card.adminWorkerLogs.desc",
    eyebrow: "IV.",
  },

  // ── Checklist (read-only views of what the worker produced) ───────
  { href: "/admin/checklist", labelKey: "admin.card.checklist", eyebrow: "V." },
  { href: "/admin/checklist/queue", labelKey: "admin.card.queue", eyebrow: "VI." },
  { href: "/admin/checklist/qa", labelKey: "admin.card.qa", eyebrow: "VII." },
  { href: "/admin/checklist/published", labelKey: "admin.card.published", eyebrow: "VIII." },
  { href: "/admin/checklist/sources", labelKey: "admin.card.sources", eyebrow: "IX." },
  { href: "/admin/checklist/failed", labelKey: "admin.card.failed", eyebrow: "X." },

  // ── Site surfaces edited by hand (no worker computation) ─────────
  { href: "/admin/homepage", labelKey: "admin.card.homepage", eyebrow: "XI." },
  { href: "/admin/search", labelKey: "admin.card.search", eyebrow: "XII." },
  { href: "/admin/media", labelKey: "admin.card.media", eyebrow: "XIII." },
  { href: "/admin/banned-devices", labelKey: "admin.bannedDevices.title", eyebrow: "XIV." },
];
