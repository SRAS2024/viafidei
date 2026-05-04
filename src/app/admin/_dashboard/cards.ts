export type DashboardCard = {
  href: string;
  labelKey: string;
  eyebrow: string;
};

export const DASHBOARD_CARDS: DashboardCard[] = [
  { href: "/admin/homepage", labelKey: "admin.card.homepage", eyebrow: "I." },
  { href: "/admin/prayers", labelKey: "admin.card.prayers", eyebrow: "II." },
  { href: "/admin/saints", labelKey: "admin.card.saints", eyebrow: "III." },
  { href: "/admin/apparitions", labelKey: "admin.card.apparitions", eyebrow: "IV." },
  { href: "/admin/parishes", labelKey: "admin.card.parishes", eyebrow: "V." },
  { href: "/admin/devotions", labelKey: "admin.card.devotions", eyebrow: "VI." },
  { href: "/admin/liturgy", labelKey: "admin.card.liturgy", eyebrow: "VII." },
  { href: "/admin/translations", labelKey: "admin.card.translations", eyebrow: "VIII." },
  { href: "/admin/ingestion", labelKey: "admin.card.ingestion", eyebrow: "IX." },
  { href: "/admin/sources", labelKey: "admin.card.sources", eyebrow: "X." },
  { href: "/admin/search", labelKey: "admin.card.search", eyebrow: "XI." },
  { href: "/admin/media", labelKey: "admin.card.media", eyebrow: "XII." },
  { href: "/admin/favicon", labelKey: "admin.card.favicon", eyebrow: "XIII." },
  { href: "/admin/audit", labelKey: "admin.card.audit", eyebrow: "XIV." },
  { href: "/admin/users", labelKey: "admin.card.users", eyebrow: "XV." },
];
