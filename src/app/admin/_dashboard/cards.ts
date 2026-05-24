export type DashboardCard = {
  href: string;
  labelKey: string;
  eyebrow: string;
};

export const DASHBOARD_CARDS: DashboardCard[] = [
  { href: "/admin/checklist", labelKey: "admin.card.checklist", eyebrow: "I." },
  { href: "/admin/diagnostics", labelKey: "admin.card.diagnostics", eyebrow: "II." },
  { href: "/admin/checklist/queue", labelKey: "admin.card.queue", eyebrow: "III." },
  { href: "/admin/checklist/qa", labelKey: "admin.card.qa", eyebrow: "IV." },
  { href: "/admin/checklist/published", labelKey: "admin.card.published", eyebrow: "V." },
  { href: "/admin/checklist/sources", labelKey: "admin.card.sources", eyebrow: "VI." },
  { href: "/admin/checklist/janitor/edits", labelKey: "admin.card.janitorEdits", eyebrow: "VII." },
  {
    href: "/admin/checklist/janitor/deletes",
    labelKey: "admin.card.janitorDeletes",
    eyebrow: "VIII.",
  },
  { href: "/admin/checklist/failed", labelKey: "admin.card.failed", eyebrow: "IX." },
  { href: "/admin/homepage", labelKey: "admin.card.homepage", eyebrow: "X." },
  { href: "/admin/search", labelKey: "admin.card.search", eyebrow: "XI." },
  { href: "/admin/media", labelKey: "admin.card.media", eyebrow: "XII." },
  { href: "/admin/logs", labelKey: "admin.card.logs", eyebrow: "XIII." },
  { href: "/admin/users", labelKey: "admin.card.users", eyebrow: "XIV." },
  { href: "/admin/audit", labelKey: "admin.card.audit", eyebrow: "XV." },
];
