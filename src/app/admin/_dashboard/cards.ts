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
  { href: "/admin/search", labelKey: "admin.card.search", eyebrow: "X." },
  { href: "/admin/media", labelKey: "admin.card.media", eyebrow: "XI." },
  { href: "/admin/favicon", labelKey: "admin.card.favicon", eyebrow: "XII." },
  { href: "/admin/audit", labelKey: "admin.card.audit", eyebrow: "XIII." },
];
