export type DashboardCard = {
  href: string;
  labelKey: string;
  eyebrow: string;
};

export const DASHBOARD_CARDS: DashboardCard[] = [
  { href: "/admin/homepage", labelKey: "admin.card.homepage", eyebrow: "I." },
  { href: "/admin/checklist", labelKey: "admin.card.checklist", eyebrow: "II." },
  { href: "/admin/checklist/queue", labelKey: "admin.card.queue", eyebrow: "III." },
  { href: "/admin/checklist/qa", labelKey: "admin.card.qa", eyebrow: "IV." },
  { href: "/admin/checklist/published", labelKey: "admin.card.published", eyebrow: "V." },
  { href: "/admin/checklist/sources", labelKey: "admin.card.sources", eyebrow: "VI." },
  { href: "/admin/checklist/failed", labelKey: "admin.card.failed", eyebrow: "VII." },
  { href: "/admin/search", labelKey: "admin.card.search", eyebrow: "VIII." },
  { href: "/admin/media", labelKey: "admin.card.media", eyebrow: "IX." },
  { href: "/admin/favicon", labelKey: "admin.card.favicon", eyebrow: "X." },
  { href: "/admin/logs", labelKey: "admin.card.logs", eyebrow: "XI." },
  { href: "/admin/users", labelKey: "admin.card.users", eyebrow: "XII." },
  { href: "/admin/audit", labelKey: "admin.card.audit", eyebrow: "XIII." },
];
