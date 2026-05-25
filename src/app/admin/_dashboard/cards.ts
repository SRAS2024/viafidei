export type DashboardCard = {
  href: string;
  labelKey: string;
  eyebrow: string;
};

export const DASHBOARD_CARDS: DashboardCard[] = [
  { href: "/admin/admin-worker", labelKey: "admin.card.adminWorker", eyebrow: "I." },
  { href: "/admin/checklist", labelKey: "admin.card.checklist", eyebrow: "II." },
  { href: "/admin/diagnostics", labelKey: "admin.card.diagnostics", eyebrow: "III." },
  { href: "/admin/checklist/queue", labelKey: "admin.card.queue", eyebrow: "IV." },
  { href: "/admin/checklist/qa", labelKey: "admin.card.qa", eyebrow: "V." },
  { href: "/admin/checklist/published", labelKey: "admin.card.published", eyebrow: "VI." },
  { href: "/admin/checklist/sources", labelKey: "admin.card.sources", eyebrow: "VII." },
  { href: "/admin/checklist/janitor/edits", labelKey: "admin.card.janitorEdits", eyebrow: "VIII." },
  {
    href: "/admin/checklist/janitor/deletes",
    labelKey: "admin.card.janitorDeletes",
    eyebrow: "IX.",
  },
  { href: "/admin/checklist/failed", labelKey: "admin.card.failed", eyebrow: "X." },
  { href: "/admin/homepage", labelKey: "admin.card.homepage", eyebrow: "XI." },
  { href: "/admin/search", labelKey: "admin.card.search", eyebrow: "XII." },
  { href: "/admin/media", labelKey: "admin.card.media", eyebrow: "XIII." },
  { href: "/admin/logs", labelKey: "admin.card.logs", eyebrow: "XIV." },
  { href: "/admin/users", labelKey: "admin.card.users", eyebrow: "XV." },
  { href: "/admin/audit", labelKey: "admin.card.audit", eyebrow: "XVI." },
];
