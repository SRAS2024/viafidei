/**
 * Admin dashboard cards.
 *
 * Grouped by purpose: the Admin Worker comes first (it's the
 * autonomous brain that runs the site), then the checklist tools
 * the worker reads from, then the other admin surfaces.
 */

export type DashboardCard = {
  href: string;
  labelKey: string;
  eyebrow: string;
  /** Optional one-line description shown under the title. */
  descriptionKey?: string;
};

export const DASHBOARD_CARDS: DashboardCard[] = [
  // ── Admin Worker (autonomous system) ──────────────────────────────
  {
    href: "/admin/admin-worker",
    labelKey: "admin.card.adminWorker",
    descriptionKey: "admin.card.adminWorker.desc",
    eyebrow: "I.",
  },
  {
    href: "/admin/diagnostics",
    labelKey: "admin.card.diagnostics",
    descriptionKey: "admin.card.diagnostics.desc",
    eyebrow: "II.",
  },
  {
    href: "/admin/admin-worker/logs",
    labelKey: "admin.card.adminWorkerLogs",
    descriptionKey: "admin.card.adminWorkerLogs.desc",
    eyebrow: "III.",
  },
  {
    href: "/admin/admin-worker/rules",
    labelKey: "admin.card.adminWorkerRules",
    descriptionKey: "admin.card.adminWorkerRules.desc",
    eyebrow: "IV.",
  },

  // ── Checklist (content the worker builds) ────────────────────────
  { href: "/admin/checklist", labelKey: "admin.card.checklist", eyebrow: "V." },
  { href: "/admin/checklist/queue", labelKey: "admin.card.queue", eyebrow: "VI." },
  { href: "/admin/checklist/qa", labelKey: "admin.card.qa", eyebrow: "VII." },
  { href: "/admin/checklist/published", labelKey: "admin.card.published", eyebrow: "VIII." },
  { href: "/admin/checklist/sources", labelKey: "admin.card.sources", eyebrow: "IX." },
  { href: "/admin/checklist/janitor/edits", labelKey: "admin.card.janitorEdits", eyebrow: "X." },
  {
    href: "/admin/checklist/janitor/deletes",
    labelKey: "admin.card.janitorDeletes",
    eyebrow: "XI.",
  },
  { href: "/admin/checklist/failed", labelKey: "admin.card.failed", eyebrow: "XII." },

  // ── Site surfaces ────────────────────────────────────────────────
  { href: "/admin/homepage", labelKey: "admin.card.homepage", eyebrow: "XIII." },
  { href: "/admin/search", labelKey: "admin.card.search", eyebrow: "XIV." },
  { href: "/admin/media", labelKey: "admin.card.media", eyebrow: "XV." },

  // ── Admin operations ─────────────────────────────────────────────
  { href: "/admin/logs", labelKey: "admin.card.logs", eyebrow: "XVI." },
  { href: "/admin/users", labelKey: "admin.card.users", eyebrow: "XVII." },
  { href: "/admin/audit", labelKey: "admin.card.audit", eyebrow: "XVIII." },
];
